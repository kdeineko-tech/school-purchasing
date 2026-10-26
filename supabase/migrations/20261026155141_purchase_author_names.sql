-- Ім'я автора заявки для тих, хто бачить заявку (AC-APR-08, AC-APR-09, AC-APR-10; відповідь PM
-- ValiaBihun/2026-quitcode-dream-team#62; ADR docs/decisions/0003-purchase-submission-rpc.md — той самий підхід:
-- private security definer + public security invoker). Нової таблиці й нових прав на profiles немає: політика
-- profiles_select_own_or_admin і далі відкриває профіль лише самій людині й адміністратору. Схвалювач отримує з
-- профілю автора рівно одне значення — ім'я, а без імені — email; ролі, відділів і дозволів функція не повертає.

-- ── Ім'я автора для видимих заявок (AC-APR-08, AC-APR-09, AC-APR-10) ─────────────────────────────────────
-- Умова видимості — та сама, що в політиці purchases_select_visible: активний переглядач, і заявка його власна,
-- або її відділ він схвалює, або він адміністратор. Для інших заявок рядка немає — нічого не розкриваємо.
create or replace function private.purchase_author_names(p_purchase_ids uuid[])
returns table (purchase_id uuid, author_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, coalesce(nullif(btrim(a.full_name), ''), a.email)
  from public.purchases as p
  join public.profiles as a on a.id = p.author_id
  where p.id = any (p_purchase_ids)
    and (select private.is_active_user())
    and (
      p.author_id = (select auth.uid())
      or (select private.approves_department(p.department_id))
      or (select private.current_app_role()) = 'admin'
    );
$$;

revoke execute on function private.purchase_author_names(uuid[]) from public, anon;
grant execute on function private.purchase_author_names(uuid[]) to authenticated;

-- Тонка обгортка для supabase.rpc('purchase_author_names'): Data API бачить лише схему public.
create or replace function public.purchase_author_names(p_purchase_ids uuid[])
returns table (purchase_id uuid, author_name text)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.purchase_author_names(p_purchase_ids);
$$;

revoke execute on function public.purchase_author_names(uuid[]) from public, anon;
grant execute on function public.purchase_author_names(uuid[]) to authenticated;
