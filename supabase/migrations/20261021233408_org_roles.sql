-- Ролі зрізу WS6 і активність працівника (impl-org-settings, задача 1.1; design.md, розділи 1 і 4).
--
-- Ролі PM (requirements/product.md): requester, approver, admin — замість шаблонних member, admin.
-- Порядок з коментаря стартової міграції: зняти старий constraint → дані → default → новий constraint.

-- ── Ролі ────────────────────────────────────────────────────────────────────
alter table public.profiles drop constraint profiles_role_check;
update public.profiles set role = 'requester' where role = 'member';
alter table public.profiles alter column role set default 'requester';
alter table public.profiles add constraint profiles_role_check
  check (role in ('requester', 'approver', 'admin'));

-- ── Активність (AC-ORG-12, AC-ORG-16, AC-ORG-18, AC-ORG-28, AC-ORG-30) ───────
-- Деактивація змінює лише цю колонку: відділи, схвалення, дозволи й роль лишаються
-- (відповідь PM: ValiaBihun/2026-quitcode-dream-team#35).
alter table public.profiles add column is_active boolean not null default true;

-- ── Хелпери ролі й активності ───────────────────────────────────────────────
-- Роль — лише активного профілю: чинна сесія деактивованого працівника не має ролі,
-- тож політики з current_app_role() = 'admin' її не пропускають (AC-ORG-12).
create or replace function private.current_app_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profiles as p
  where p.id = (select auth.uid()) and p.is_active;
$$;

create or replace function private.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.is_active from public.profiles as p where p.id = (select auth.uid())),
    false
  );
$$;

revoke execute on function private.is_active_user() from public, anon;
grant execute on function private.is_active_user() to authenticated;

-- ── Адміністративні колонки профілю (AC-ORG-09) ─────────────────────────────
-- Колонковий grant потрібен адміністратору. Шаблонна політика profiles_update_own пускає кожного
-- до власного рядка, тому змінити role чи is_active не-адміністратору не дає тригер нижче.
grant update (role, is_active) on table public.profiles to authenticated;

create policy profiles_update_admin
  on public.profiles
  for update
  to authenticated
  using ((select private.current_app_role()) = 'admin')
  with check ((select private.current_app_role()) = 'admin');

create or replace function private.guard_profile_admin_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Без auth.uid() зміну робить не користувач застосунку, а service_role (npm run users:demo)
  -- чи міграція: їх пропускаємо явно.
  if (select auth.uid()) is null then
    return new;
  end if;

  if (old.role is distinct from new.role or old.is_active is distinct from new.is_active)
     and coalesce(private.current_app_role(), '') <> 'admin' then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke execute on function private.guard_profile_admin_columns() from public, anon, authenticated;

create trigger profiles_guard_admin_columns
  before update on public.profiles
  for each row execute function private.guard_profile_admin_columns();
