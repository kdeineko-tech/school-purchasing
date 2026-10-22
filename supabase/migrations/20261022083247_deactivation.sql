-- Деактивація працівника й захист останнього активного адміністратора (impl-org-settings, задача 5.1;
-- design.md, розділ 3; специфікація staff-lifecycle після зміни update-org-settings).
--
-- Колонка profiles.is_active, колонковий grant і захист від не-адміністратора вже є (міграція org_roles).
-- Тут — правило «хоча б один активний адміністратор» (AC-ORG-18), без якого адміністратор, деактивуючи
-- працівників (AC-ORG-12), міг би заблокувати й самого себе.

create or replace function private.guard_last_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  others integer;
begin
  -- Нічого не змінилось для ролі чи активності — перевіряти нема чого.
  if old.role is not distinct from new.role and old.is_active is not distinct from new.is_active then
    return new;
  end if;

  -- Одночасні зміни ролі й активності виконуються по черзі: дві транзакції не можуть кожна побачити
  -- «інший адміністратор ще є» і разом прибрати останнього.
  perform pg_advisory_xact_lock(hashtext('org_active_admins'));

  if new.role = 'admin' and new.is_active then
    return new;
  end if;

  select count(*) into others
  from public.profiles as p
  where p.id <> new.id and p.role = 'admin' and p.is_active;

  if others = 0 and old.role = 'admin' and old.is_active then
    raise exception 'LAST_ADMIN' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke execute on function private.guard_last_admin() from public, anon, authenticated;

create trigger profiles_guard_last_admin
  before update of role, is_active on public.profiles
  for each row execute function private.guard_last_admin();
