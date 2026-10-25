-- Закупівлі й їхні рядки, подання через функцію бази (impl-add-purchase-flow, задача 1.1; design.md, розділи 1–3;
-- ADR docs/decisions/0003-purchase-submission-rpc.md).

-- ── Закупівлі ───────────────────────────────────────────────────────────────
-- Статус і тип — стабільні ідентифікатори; підписи англійською лише в інтерфейсі (AC-LANG-06).
create table public.purchases (
  id               uuid primary key default gen_random_uuid(),
  author_id        uuid not null references public.profiles (id) on delete restrict,
  department_id    uuid not null references public.departments (id) on delete restrict,
  purchase_type    text not null,
  status           text not null default 'awaiting_approval',
  rejection_reason text,
  decided_by       uuid references public.profiles (id) on delete restrict,
  decided_at       timestamptz,
  created_at       timestamptz not null default now(),
  constraint purchases_type_check check (purchase_type in ('purchasing_department', 'self_purchase')),
  constraint purchases_status_check check (status in ('awaiting_approval', 'approved', 'rejected')),
  -- Відхилена заявка завжди має причину (AC-APR-06, AC-APR-07; рішення — задача 3.1).
  constraint purchases_rejection_reason_check
    check (status <> 'rejected' or btrim(coalesce(rejection_reason, '')) <> '')
);

comment on table public.purchases is
  'Закупівля працівника. Подають лише через rpc submit_purchase; прямих записів у таблицю немає.';

create index purchases_author_idx on public.purchases (author_id);
create index purchases_department_status_idx on public.purchases (department_id, status);

alter table public.purchases enable row level security;

-- ── Рядки закупівлі ─────────────────────────────────────────────────────────
-- Поля рядка без not null і без меж значень: обов'язковість — питання PM Q8
-- (ValiaBihun/2026-quitcode-dream-team#60), межі кількості й ціни — наступний зріз.
create table public.purchase_lines (
  id          uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases (id) on delete cascade,
  position    integer not null,
  name        text,
  purpose     text,
  quantity    integer,
  unit_price  numeric(12, 2),
  unique (purchase_id, position)
);

comment on table public.purchase_lines is
  'Рядок закупівлі: що купити, для чого, кількість, ціна за одиницю.';

alter table public.purchase_lines enable row level security;

-- ── Хелпер: переглядач схвалює відділ ───────────────────────────────────────
create or replace function private.approves_department(dept uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.department_members as m
    where m.profile_id = (select auth.uid()) and m.department_id = dept and m.approves
  );
$$;

revoke execute on function private.approves_department(uuid) from public, anon;
grant execute on function private.approves_department(uuid) to authenticated;

-- ── Права (GRANT): лише читання ─────────────────────────────────────────────
revoke all on table public.purchases from anon, authenticated;
grant select on table public.purchases to authenticated;
grant select, insert, update, delete on table public.purchases to service_role;

revoke all on table public.purchase_lines from anon, authenticated;
grant select on table public.purchase_lines to authenticated;
grant select, insert, update, delete on table public.purchase_lines to service_role;

-- ── Політики RLS ────────────────────────────────────────────────────────────
-- Заявку бачать автор, схвалювач її відділу й адміністратор — лише активні (матриця прав
-- requirements/product.md, «Бачити заявки»; AC-FRM-08, AC-FRM-10, AC-APR-03).
create policy purchases_select_visible
  on public.purchases
  for select
  to authenticated
  using (
    (select private.is_active_user())
    and (
      author_id = (select auth.uid())
      or (select private.approves_department(department_id))
      or (select private.current_app_role()) = 'admin'
    )
  );

create policy purchase_lines_select_visible
  on public.purchase_lines
  for select
  to authenticated
  using (exists (select 1 from public.purchases as p where p.id = purchase_id));

-- ── Подання закупівлі (AC-FRM-02, AC-FRM-04, AC-FRM-06, AC-FRM-07, AC-FRM-12, AC-FRM-13, AC-ORG-22, AC-ORG-23,
-- AC-ORG-29) ────────────────────────────────────────────────────────────────
-- Заявка з рядками — одна транзакція: перевірки прав і запис разом. Коди винятків server action показує
-- повідомленнями PM: FORBIDDEN → «Not enough permissions», NO_LINES → «Add at least one line».
create or replace function private.submit_purchase(p_department_id uuid, p_purchase_type text, p_lines jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_role text;
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

  -- Рядки (AC-FRM-06): окремі послідовні перевірки — порядок частин AND PostgreSQL не гарантує,
  -- тож jsonb_array_length не виконується раніше за перевірку типу.
  if jsonb_typeof(p_lines) is distinct from 'array' then
    raise exception 'NO_LINES';
  end if;
  if jsonb_array_length(p_lines) = 0 then
    raise exception 'NO_LINES';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_lines) as line(value)
    where jsonb_typeof(line.value) is distinct from 'object'
  ) then
    raise exception 'NO_LINES';
  end if;

  -- Наявність схвалювача не перевіряємо: заявка чекає (AC-FRM-12, AC-FRM-13; відповідь PM
  -- ValiaBihun/2026-quitcode-dream-team#52).
  insert into public.purchases (author_id, department_id, purchase_type)
  values (v_uid, p_department_id, p_purchase_type)
  returning id into v_purchase_id;

  insert into public.purchase_lines (purchase_id, position, name, purpose, quantity, unit_price)
  select
    v_purchase_id,
    line.position,
    nullif(btrim(line.value ->> 'name'), ''),
    nullif(btrim(line.value ->> 'purpose'), ''),
    nullif(btrim(line.value ->> 'quantity'), '')::integer,
    nullif(btrim(line.value ->> 'unit_price'), '')::numeric(12, 2)
  from jsonb_array_elements(p_lines) with ordinality as line(value, position);

  return v_purchase_id;
end;
$$;

revoke execute on function private.submit_purchase(uuid, text, jsonb) from public, anon;
grant execute on function private.submit_purchase(uuid, text, jsonb) to authenticated;

-- Тонка обгортка для supabase.rpc('submit_purchase'): Data API бачить лише схему public.
create or replace function public.submit_purchase(p_department_id uuid, p_purchase_type text, p_lines jsonb)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.submit_purchase(p_department_id, p_purchase_type, p_lines);
$$;

revoke execute on function public.submit_purchase(uuid, text, jsonb) from public, anon;
grant execute on function public.submit_purchase(uuid, text, jsonb) to authenticated;
