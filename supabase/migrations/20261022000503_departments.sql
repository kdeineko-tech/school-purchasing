-- Відділи й заявники відділів (impl-org-settings, задача 2.1; design.md, розділи 2 і 4;
-- ADR docs/decisions/0001-department-membership.md).

-- ── Відділи (AC-ORG-34) ─────────────────────────────────────────────────────
create table public.departments (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now(),
  -- Назва — текст до 100 символів («Припущення» вимоги ValiaBihun/2026-quitcode-dream-team#2);
  -- пробіли на початку й у кінці не рахуємо (власне припущення, docs/spec-reading.md).
  constraint departments_name_length check (char_length(btrim(name)) between 1 and 100)
);

comment on table public.departments is
  'Відділ школи, від імені якого подають заявки. Створює лише адміністратор.';

-- Назва унікальна без урахування регістру (AC-ORG-34).
create unique index departments_name_unique on public.departments (lower(btrim(name)));

alter table public.departments enable row level security;

-- ── Заявники відділів (AC-ORG-01) ───────────────────────────────────────────
-- Рядок = працівник є заявником відділу. Схвалення й автосхвалення стануть колонками цього рядка
-- (задачі 3.1 і 4.1), тож «не заявник» не матиме їх за побудовою.
create table public.department_members (
  profile_id    uuid not null references public.profiles (id) on delete cascade,
  department_id uuid not null references public.departments (id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (profile_id, department_id)
);

comment on table public.department_members is
  'Працівник — заявник відділу. Додає й прибирає лише адміністратор.';

create index department_members_department_idx on public.department_members (department_id);

alter table public.department_members enable row level security;

-- ── Права (GRANT) ───────────────────────────────────────────────────────────
revoke all on table public.departments from anon, authenticated;
grant select, insert on table public.departments to authenticated;
grant select, insert, update, delete on table public.departments to service_role;

revoke all on table public.department_members from anon, authenticated;
grant select, insert on table public.department_members to authenticated;
grant select, insert, update, delete on table public.department_members to service_role;

-- ── Політики RLS ────────────────────────────────────────────────────────────
-- Назви відділів бачать усі активні користувачі (вибір відділу у формі заявки — задача 7.1).
create policy departments_select_active
  on public.departments
  for select
  to authenticated
  using ((select private.is_active_user()));

create policy departments_insert_admin
  on public.departments
  for insert
  to authenticated
  with check ((select private.current_app_role()) = 'admin');

-- Свої рядки бачить активний працівник (власний профіль), усі — адміністратор.
create policy department_members_select_own_or_admin
  on public.department_members
  for select
  to authenticated
  using (
    (profile_id = (select auth.uid()) and (select private.is_active_user()))
    or (select private.current_app_role()) = 'admin'
  );

create policy department_members_insert_admin
  on public.department_members
  for insert
  to authenticated
  with check ((select private.current_app_role()) = 'admin');
