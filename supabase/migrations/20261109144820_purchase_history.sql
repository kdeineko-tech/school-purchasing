-- Історія заявки: запис «Подано» (impl-decision-history, задача 2.1; AC-HIST-06, AC-HIST-10; ADR
-- docs/decisions/0005-purchase-history-events.md). Запис пише та сама функція, що змінює заявку, у тій самій транзакції.
-- У WS9 вид лише один — submitted; рішення додадуть нові види, коли PM поверне їхні записи в історію.

-- 1. Записи історії. Прав на запис у authenticated немає: пишуть лише функції security definer. Записи не змінюються.
create table public.purchase_events (
  id          uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases (id) on delete cascade,
  kind        text not null check (kind in ('submitted')),
  -- on delete cascade: прибирання синтетичних користувачів UAT не падає на записах історії.
  actor_id    uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now()
);

create index purchase_events_purchase_id_idx on public.purchase_events (purchase_id, created_at);

alter table public.purchase_events enable row level security;

revoke all on table public.purchase_events from anon, authenticated;
grant select on table public.purchase_events to authenticated;
grant select, insert, update, delete on table public.purchase_events to service_role;

-- Записи бачить той, хто бачить заявку (AC-HIST-10): exists читає purchases під її RLS (purchases_select_visible —
-- активний, і автор, або схвалювач відділу, або адміністратор), як purchase_lines_select_visible.
create policy purchase_events_select_visible
  on public.purchase_events
  for select
  to authenticated
  using (exists (select 1 from public.purchases as p where p.id = purchase_id));

-- 2. Наявні заявки: запис «Подано» з датою подання й автором.
insert into public.purchase_events (purchase_id, kind, actor_id, created_at)
select p.id, 'submitted', p.author_id, p.created_at
from public.purchases as p;

-- 3. Подання: тіло з 20261106234630_purchase_number.sql без змін + запис submitted (AC-HIST-06). now() — час початку
--    транзакції, тож created_at запису й заявки однакові.
create or replace function private.submit_purchase(p_department_id uuid, p_purchase_type text, p_lines jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_role text;
  v_number integer;
  v_purchase_id uuid;
begin
  -- Працівник, який увійшов і активний (AC-ORG-12).
  if v_uid is null or not private.is_active_user() then
    raise exception 'FORBIDDEN';
  end if;
  v_role := private.current_app_role();

  -- Відділ: адміністратор — будь-який наявний (AC-ORG-22, AC-ORG-29); інші — лише де заявник (AC-FRM-02).
  if not exists (select 1 from public.departments as d where d.id = p_department_id) then
    raise exception 'FORBIDDEN';
  end if;
  if v_role is distinct from 'admin' and not exists (
    select 1 from public.department_members as m
    where m.profile_id = v_uid and m.department_id = p_department_id
  ) then
    raise exception 'FORBIDDEN';
  end if;

  -- Тип: «Самостійна закупівля» — адміністратору або з дозволом (AC-FRM-04, AC-ORG-23).
  if p_purchase_type is null or p_purchase_type not in ('purchasing_department', 'self_purchase') then
    raise exception 'FORBIDDEN';
  end if;
  if p_purchase_type = 'self_purchase' and v_role is distinct from 'admin' and not exists (
    select 1 from public.profiles as p where p.id = v_uid and p.can_self_purchase
  ) then
    raise exception 'FORBIDDEN';
  end if;

  -- Наскрізний номер (AC-HIST-01).
  update private.purchase_counter
  set last_number = last_number + 1
  where id
  returning last_number into v_number;

  -- Наявність схвалювача не перевіряємо: заявка чекає (AC-FRM-12, AC-FRM-13).
  insert into public.purchases (author_id, department_id, purchase_type, number)
  values (v_uid, p_department_id, p_purchase_type, v_number)
  returning id into v_purchase_id;

  perform private.insert_purchase_lines(v_purchase_id, p_lines);

  -- Запис «Подано» (AC-HIST-06). Виняток вище скасовує і його.
  insert into public.purchase_events (purchase_id, kind, actor_id)
  values (v_purchase_id, 'submitted', v_uid);

  return v_purchase_id;
end;
$$;

-- 4. Історія для сторінки заявки (AC-HIST-06, AC-HIST-10). Definer обходить RLS, тож видимість перевіряє сама функція —
--    умова дослівно як у private.purchase_author_names. Невидима чи неіснуюча заявка — 0 рядків, без винятку.
--    З профілю того, хто діяв, — лише ім'я, а без імені — email.
create or replace function private.purchase_history(p_purchase_id uuid)
returns table (kind text, created_at timestamptz, actor_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select e.kind, e.created_at, coalesce(nullif(btrim(a.full_name), ''), a.email)
  from public.purchase_events as e
  join public.purchases as p on p.id = e.purchase_id
  join public.profiles as a on a.id = e.actor_id
  where e.purchase_id = p_purchase_id
    and (select private.is_active_user())
    and (
      p.author_id = (select auth.uid())
      or (select private.approves_department(p.department_id))
      or (select private.current_app_role()) = 'admin'
    )
  order by e.created_at, e.id;
$$;

revoke execute on function private.purchase_history(uuid) from public, anon;
grant execute on function private.purchase_history(uuid) to authenticated;

-- Тонка обгортка для supabase.rpc('purchase_history'): Data API бачить лише схему public.
create or replace function public.purchase_history(p_purchase_id uuid)
returns table (kind text, created_at timestamptz, actor_name text)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.purchase_history(p_purchase_id);
$$;

revoke execute on function public.purchase_history(uuid) from public, anon;
grant execute on function public.purchase_history(uuid) to authenticated;
