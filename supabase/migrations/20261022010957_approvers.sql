-- Схвалювачі відділів і роль за відділами (impl-org-settings, задача 3.1; design.md, розділи 2–4;
-- ADR docs/decisions/0001-department-membership.md).

-- ── Схвалення — колонка рядка заявника (AC-ORG-02, AC-ORG-03) ────────────────
-- Схвалювач може бути лише заявником відділу: колонка живе в рядку заявника,
-- а видалення рядка (зняття заявника) знімає й схвалення.
alter table public.department_members add column approves boolean not null default false;

-- ── Права (GRANT) ───────────────────────────────────────────────────────────
grant update (approves) on table public.department_members to authenticated;
grant delete on table public.department_members to authenticated;

-- ── Політики RLS ────────────────────────────────────────────────────────────
create policy department_members_update_admin
  on public.department_members
  for update
  to authenticated
  using ((select private.current_app_role()) = 'admin')
  with check ((select private.current_app_role()) = 'admin');

create policy department_members_delete_admin
  on public.department_members
  for delete
  to authenticated
  using ((select private.current_app_role()) = 'admin');

-- ── Роль за відділами (AC-ORG-04, AC-ORG-05, AC-ORG-19, AC-ORG-20, AC-ORG-24) ─
-- Правило ролей (requirements/product.md): approver — працівник без ролі admin, який схвалює хоча б
-- один відділ; коли таких відділів не лишилося — requester. Роль admin від відділів не залежить.
create or replace function private.sync_role(target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles as p
  set role = case
    when exists (
      select 1 from public.department_members as m
      where m.profile_id = target and m.approves
    ) then 'approver'
    else 'requester'
  end
  where p.id = target and p.role <> 'admin';
end;
$$;

revoke execute on function private.sync_role(uuid) from public, anon, authenticated;

create or replace function private.department_members_sync_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform private.sync_role(old.profile_id);
    return old;
  end if;
  perform private.sync_role(new.profile_id);
  return new;
end;
$$;

revoke execute on function private.department_members_sync_role() from public, anon, authenticated;

create trigger department_members_sync_role
  after insert or update of approves or delete on public.department_members
  for each row execute function private.department_members_sync_role();
