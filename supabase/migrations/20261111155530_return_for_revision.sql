-- Повернення на доопрацювання й повторне подання (impl-decision-history, задача 4.1; AC-DEC-04, AC-DEC-06, AC-DEC-07).
-- Схвалювач повертає заявку з причиною — «Повернено на доопрацювання»; автор виправляє рядки й подає знову —
-- «Очікує схвалення», відділ, тип і номер ті самі. Статус 'returned' у check додано ще в 20261109171140.

-- 1. Причина повернення: повернена заявка — лише з причиною (як rejection_reason для 'rejected').
alter table public.purchases
  add column return_reason text,
  add constraint purchases_return_reason_check
    check (status <> 'returned' or btrim(coalesce(return_reason, '')) <> '');

-- 2. Рішення 'return'. Сигнатура та сама, що в 20261109171140, — create or replace, обгортка public без змін.
create or replace function private.decide_purchase(
  p_purchase_id uuid,
  p_decision text,
  p_reason text,
  p_rejected_lines uuid[] default '{}'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_purchase public.purchases%rowtype;
  v_rejected uuid[] := coalesce(p_rejected_lines, '{}');
begin
  -- Працівник, який увійшов і активний (AC-ORG-12).
  if v_uid is null or not private.is_active_user() then
    raise exception 'FORBIDDEN';
  end if;
  if p_decision is null or p_decision not in ('approve', 'reject', 'return') then
    raise exception 'FORBIDDEN';
  end if;

  -- Блокуємо рядок: два рішення по одній заявці виконуються по черзі, друге бачить уже не «Очікує схвалення».
  select * into v_purchase from public.purchases as p where p.id = p_purchase_id for update;
  if not found then
    raise exception 'FORBIDDEN';
  end if;

  -- Вирішує лише схвалювач відділу заявки (AC-APR-03), зокрема admin — лише якщо його призначено схвалювачем (#62).
  if not exists (
    select 1 from public.department_members as m
    where m.profile_id = v_uid and m.department_id = v_purchase.department_id and m.approves
  ) then
    raise exception 'FORBIDDEN';
  end if;

  -- Власну заявку схвалювач не вирішує (AC-APR-05, AC-FRM-13).
  if v_purchase.author_id = v_uid then
    raise exception 'FORBIDDEN';
  end if;

  if v_purchase.status <> 'awaiting_approval' then
    raise exception 'NOT_PENDING';
  end if;

  -- Відхилення (AC-APR-06) і повернення (AC-DEC-06) — лише з причиною і без позначених рядків.
  if p_decision in ('reject', 'return') then
    if btrim(coalesce(p_reason, '')) = '' then
      raise exception 'REASON_REQUIRED';
    end if;
    if cardinality(v_rejected) > 0 then
      raise exception 'FORBIDDEN';
    end if;
  end if;

  -- Позначені рядки — лише рядки цієї заявки (null чи чужий id — та сама відмова).
  if exists (
    select 1 from unnest(v_rejected) as r(id)
    where not exists (
      select 1 from public.purchase_lines as l where l.id = r.id and l.purchase_id = p_purchase_id
    )
  ) then
    raise exception 'FORBIDDEN';
  end if;

  -- «Частково схвалена» без жодного схваленого рядка — суперечність: тоді треба відхилити заявку цілком.
  if p_decision = 'approve' and not exists (
    select 1 from public.purchase_lines as l
    where l.purchase_id = p_purchase_id and l.id <> all(v_rejected)
  ) then
    raise exception 'ALL_LINES_REJECTED';
  end if;

  -- Статуси рядків (AC-DEC-01): approve — позначені rejected, решта approved; reject — усі rejected;
  -- return — рядки лишаються pending.
  if p_decision <> 'return' then
    update public.purchase_lines as l
    set status = case
      when p_decision = 'reject' or l.id = any(v_rejected) then 'rejected'
      else 'approved'
    end
    where l.purchase_id = p_purchase_id;
  end if;

  update public.purchases
  set status = case
        when p_decision = 'reject' then 'rejected'
        when p_decision = 'return' then 'returned'
        when cardinality(v_rejected) > 0 then 'partially_approved'
        else 'approved'
      end,
      rejection_reason = case p_decision when 'reject' then btrim(p_reason) end,
      return_reason = case p_decision when 'return' then btrim(p_reason) end,
      decided_by = v_uid,
      decided_at = now()
  where id = p_purchase_id;
end;
$$;

-- 3. Повторне подання поверненої заявки (AC-DEC-07). Перевірки входу, відділу й типу — як у submit_purchase
--    (20261109144820), але для відділу й типу самої заявки; рядки — заново через insert_purchase_lines.
create function private.resubmit_purchase(p_purchase_id uuid, p_lines jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_role text;
  v_purchase public.purchases%rowtype;
begin
  -- Працівник, який увійшов і активний (AC-ORG-12).
  if v_uid is null or not private.is_active_user() then
    raise exception 'FORBIDDEN';
  end if;
  v_role := private.current_app_role();

  select * into v_purchase from public.purchases as p where p.id = p_purchase_id for update;
  if not found then
    raise exception 'FORBIDDEN';
  end if;

  -- Лише автор і лише повернена заявка (відхилену автор не редагує).
  if v_purchase.author_id is distinct from v_uid or v_purchase.status <> 'returned' then
    raise exception 'FORBIDDEN';
  end if;

  -- Відділ: адміністратор — будь-який наявний (AC-ORG-22, AC-ORG-29); інші — лише де заявник (AC-FRM-02).
  if v_role is distinct from 'admin' and not exists (
    select 1 from public.department_members as m
    where m.profile_id = v_uid and m.department_id = v_purchase.department_id
  ) then
    raise exception 'FORBIDDEN';
  end if;

  -- Тип: «Самостійна закупівля» — адміністратору або з дозволом (AC-FRM-04, AC-ORG-23).
  if v_purchase.purchase_type = 'self_purchase' and v_role is distinct from 'admin' and not exists (
    select 1 from public.profiles as p where p.id = v_uid and p.can_self_purchase
  ) then
    raise exception 'FORBIDDEN';
  end if;

  -- Рядки заново: ті самі перевірки й повідомлення, що при першому поданні (#66); статус рядків — pending.
  delete from public.purchase_lines where purchase_id = p_purchase_id;
  perform private.insert_purchase_lines(p_purchase_id, p_lines);

  -- Відділ, тип і номер ті самі; поля рішення — порожні (AC-DEC-07).
  update public.purchases
  set status = 'awaiting_approval',
      return_reason = null,
      rejection_reason = null,
      decided_by = null,
      decided_at = null
  where id = p_purchase_id;

  -- Ще один запис «Подано» (AC-HIST-06). Виняток вище скасовує все.
  insert into public.purchase_events (purchase_id, kind, actor_id)
  values (p_purchase_id, 'submitted', v_uid);
end;
$$;

revoke execute on function private.resubmit_purchase(uuid, jsonb) from public, anon;
grant execute on function private.resubmit_purchase(uuid, jsonb) to authenticated;

-- Тонка обгортка для supabase.rpc('resubmit_purchase'): Data API бачить лише схему public.
create function public.resubmit_purchase(p_purchase_id uuid, p_lines jsonb)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.resubmit_purchase(p_purchase_id, p_lines);
$$;

revoke execute on function public.resubmit_purchase(uuid, jsonb) from public, anon;
grant execute on function public.resubmit_purchase(uuid, jsonb) to authenticated;
