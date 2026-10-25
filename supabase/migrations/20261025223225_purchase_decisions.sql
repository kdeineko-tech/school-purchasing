-- Рішення схвалювача по закупівлі (impl-add-purchase-flow, задача 3.1; design.md, «Дані й RLS»;
-- ADR docs/decisions/0003-purchase-submission-rpc.md). Нової таблиці немає: колонки рішення (status,
-- rejection_reason, decided_by, decided_at) створила міграція 20261025185729_purchases.sql, а authenticated не має
-- на purchases жодного grant update — статус змінює лише ця функція.

-- ── Рішення (AC-APR-02, AC-APR-03, AC-APR-04, AC-APR-05, AC-APR-06, AC-APR-07, AC-FRM-13) ─────────────────
-- Коди винятків server action показує повідомленнями: FORBIDDEN → «Not enough permissions»,
-- REASON_REQUIRED → «Provide a reason» (тексти PM); NOT_PENDING — заявку вже вирішено.
create or replace function private.decide_purchase(p_purchase_id uuid, p_decision text, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_purchase public.purchases%rowtype;
begin
  -- Працівник, який увійшов і активний (AC-ORG-12).
  if v_uid is null or not private.is_active_user() then
    raise exception 'FORBIDDEN';
  end if;
  if p_decision is null or p_decision not in ('approve', 'reject') then
    raise exception 'FORBIDDEN';
  end if;

  -- Блокуємо рядок: два рішення по одній заявці виконуються по черзі, друге бачить уже не «Очікує схвалення».
  select * into v_purchase from public.purchases as p where p.id = p_purchase_id for update;
  -- Неіснуюча заявка — та сама відмова, що й чужа: нічого не розкриваємо.
  if not found then
    raise exception 'FORBIDDEN';
  end if;

  -- Вирішує лише схвалювач відділу заявки (AC-APR-03; заявник — AC-APR-04). Рішення адміністратора за відділ без
  -- схвалювача — WS8 (примітка до матриці прав requirements/product.md).
  if not exists (
    select 1 from public.department_members as m
    where m.profile_id = v_uid and m.department_id = v_purchase.department_id and m.approves
  ) then
    raise exception 'FORBIDDEN';
  end if;

  -- Власну заявку схвалювач не вирішує, зокрема в обхід сторінок (AC-APR-05, AC-FRM-13).
  if v_purchase.author_id = v_uid then
    raise exception 'FORBIDDEN';
  end if;

  if v_purchase.status <> 'awaiting_approval' then
    raise exception 'NOT_PENDING';
  end if;

  -- Відхилення лише з причиною (AC-APR-06).
  if p_decision = 'reject' and btrim(coalesce(p_reason, '')) = '' then
    raise exception 'REASON_REQUIRED';
  end if;

  update public.purchases
  set status = case p_decision when 'approve' then 'approved' else 'rejected' end,
      rejection_reason = case p_decision when 'reject' then btrim(p_reason) end,
      decided_by = v_uid,
      decided_at = now()
  where id = p_purchase_id;
end;
$$;

revoke execute on function private.decide_purchase(uuid, text, text) from public, anon;
grant execute on function private.decide_purchase(uuid, text, text) to authenticated;

-- Тонка обгортка для supabase.rpc('decide_purchase'): Data API бачить лише схему public.
create or replace function public.decide_purchase(p_purchase_id uuid, p_decision text, p_reason text)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.decide_purchase(p_purchase_id, p_decision, p_reason);
$$;

revoke execute on function public.decide_purchase(uuid, text, text) from public, anon;
grant execute on function public.decide_purchase(uuid, text, text) to authenticated;
