-- Часткове схвалення (impl-decision-history, задача 3.1; AC-DEC-01). Рядок заявки отримує статус; схвалювач відхиляє
-- окремі рядки й схвалює решту — заявка «Частково схвалено». Повернення на доопрацювання (return, return_reason) —
-- задача 4.1: тут лише статус 'returned' у check, щоб не знімати check удруге.

-- 1. Статус рядка: pending до рішення, approved / rejected після. Рядкам наявних заявок — за статусом заявки.
alter table public.purchase_lines
  add column status text not null default 'pending'
  constraint purchase_lines_status_check check (status in ('pending', 'approved', 'rejected'));

update public.purchase_lines as l
set status = p.status
from public.purchases as p
where p.id = l.purchase_id and p.status in ('approved', 'rejected');

-- 2. Нові статуси заявки (AC-DEC-01, AC-LANG-09): зняти старий check → додати новий.
alter table public.purchases drop constraint purchases_status_check;
alter table public.purchases add constraint purchases_status_check
  check (status in ('awaiting_approval', 'approved', 'rejected', 'partially_approved', 'returned'));

-- 3. Рішення з відхиленими рядками. Нова сигнатура з типовим значенням: старий виклик із трьома аргументами (застосунок
--    зрізу 2 до розгортання) працює далі, а drop старої гарантує одну public.decide_purchase — без PGRST203.
drop function public.decide_purchase(uuid, text, text);
drop function private.decide_purchase(uuid, text, text);

create function private.decide_purchase(
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
  if p_decision is null or p_decision not in ('approve', 'reject') then
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

  -- Відхилення заявки — лише з причиною (AC-APR-06) і без позначених рядків: відхиляються всі.
  if p_decision = 'reject' then
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

  -- Статуси рядків (AC-DEC-01): approve — позначені rejected, решта approved; reject — усі rejected.
  update public.purchase_lines as l
  set status = case
    when p_decision = 'reject' or l.id = any(v_rejected) then 'rejected'
    else 'approved'
  end
  where l.purchase_id = p_purchase_id;

  update public.purchases
  set status = case
        when p_decision = 'reject' then 'rejected'
        when cardinality(v_rejected) > 0 then 'partially_approved'
        else 'approved'
      end,
      rejection_reason = case p_decision when 'reject' then btrim(p_reason) end,
      decided_by = v_uid,
      decided_at = now()
  where id = p_purchase_id;
end;
$$;

revoke execute on function private.decide_purchase(uuid, text, text, uuid[]) from public, anon;
grant execute on function private.decide_purchase(uuid, text, text, uuid[]) to authenticated;

-- Тонка обгортка для supabase.rpc('decide_purchase'): Data API бачить лише схему public.
create function public.decide_purchase(
  p_purchase_id uuid,
  p_decision text,
  p_reason text,
  p_rejected_lines uuid[] default '{}'
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.decide_purchase(p_purchase_id, p_decision, p_reason, p_rejected_lines);
$$;

revoke execute on function public.decide_purchase(uuid, text, text, uuid[]) from public, anon;
grant execute on function public.decide_purchase(uuid, text, text, uuid[]) to authenticated;
