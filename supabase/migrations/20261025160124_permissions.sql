-- Дозволи на типи заявок і тип закупівлі «Самостійна закупівля» (impl-org-settings, задача 6.1; design.md,
-- розділи 2 і 4): AC-ORG-17, AC-ORG-25, AC-ORG-26, AC-ORG-27. Потрібні й другому зрізу (AC-FRM-03, AC-FRM-04).

-- Дозвіл діє, доки адміністратор його не забере («Припущення» вимоги ValiaBihun/2026-quitcode-dream-team#40).
alter table public.profiles
  add column can_card_expense   boolean not null default false,
  add column can_check_request  boolean not null default false,
  add column can_vendor_invoice boolean not null default false,
  add column can_self_purchase  boolean not null default false;

-- Видає дозволи лише адміністратор: колонковий grant + наявна політика profiles_update_admin,
-- а захист від зміни власних дозволів через profiles_update_own — у тригері нижче.
grant update (can_card_expense, can_check_request, can_vendor_invoice, can_self_purchase)
  on table public.profiles to authenticated;

-- Той самий тригер, що в міграції org_roles, тепер стежить і за колонками дозволів.
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

  if (old.role is distinct from new.role
      or old.is_active is distinct from new.is_active
      or old.can_card_expense is distinct from new.can_card_expense
      or old.can_check_request is distinct from new.can_check_request
      or old.can_vendor_invoice is distinct from new.can_vendor_invoice
      or old.can_self_purchase is distinct from new.can_self_purchase)
     and coalesce(private.current_app_role(), '') <> 'admin' then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  return new;
end;
$$;
