-- Автосхвалення заявника у відділі (impl-org-settings, задача 4.1; design.md, розділ 2;
-- ADR docs/decisions/0001-department-membership.md). Додатковий критерій поза спрощеним скоупом PM
-- (ValiaBihun/2026-quitcode-dream-team#46): AC-ORG-06, AC-ORG-15, AC-ORG-33.

-- Колонка рядка заявника: автосхвалення діє окремо для кожного відділу (AC-ORG-06), не-заявнику його не
-- ввімкнути, бо рядка немає (AC-ORG-33), а зняття заявника видаляє рядок разом з автосхваленням (AC-ORG-15).
alter table public.department_members add column auto_approve boolean not null default false;

-- Змінює лише адміністратор: політика department_members_update_admin уже є (міграція approvers).
grant update (auto_approve) on table public.department_members to authenticated;
