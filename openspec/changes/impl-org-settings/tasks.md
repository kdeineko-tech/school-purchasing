# Tasks

Вертикальні задачі: кожна — міграція/RLS + доменна функція + server action/сторінка + тест з AC ID. Одна задача —
одна гілка `task/<коротко>` і один PR «Реалізація». Перевірка — `npm test`, `npm run ac:coverage`, після merge —
зелений `db-deploy`.

## 1. Ролі й доступ до сторінок адміністратора

- [x] 1.1 Міграція `org_roles`: ролі `requester`/`approver`/`admin` (зняти constraint → дані → default → новий
  constraint), `profiles.is_active`, `current_app_role()` лише для активного профілю, `private.is_active_user()`,
  тригер `guard_profile_admin_columns` і політика `profiles_update_admin`; `demo-users.json` з ролями
  `admin`/`requester`; `src/lib/org/access.ts`, `viewer.ts`, `messages.ts`; layout `/admin` з відмовою
  «Недостатньо прав»; тест.
  Done when: AC-ORG-09.

## 2. Відділи й заявники

- [x] 2.1 Міграція `departments`: `departments` (унікальна назва без регістру), `department_members` з RLS і GRANT;
  ADR `0001-department-membership`; `departments.ts`, `membership.ts` (`addRequester`); сторінки
  `/admin/departments`, `/admin/staff/[id]`, `/profile`; actions `createDepartment`, `addRequester`; тести.
  Done when: AC-ORG-34, AC-ORG-01.

## 3. Схвалювачі й роль за відділами

- [x] 3.1 Колонка `approves`, тригер `sync_role`; `setApprover`, `removeRequester`, `roleFor`,
  `departmentsWithoutApprover`; позначка «Немає схвалювача»; тести.
  Done when: AC-ORG-02, AC-ORG-03, AC-ORG-04, AC-ORG-05, AC-ORG-14, AC-ORG-19, AC-ORG-20, AC-ORG-24.

## 4. Автосхвалення

- [ ] 4.1 Колонка `auto_approve`; `setAutoApprove`; перемикач на `/admin/staff/[id]`; тести.
  Done when: AC-ORG-06, AC-ORG-15, AC-ORG-33.

## 5. Деактивація й активний адміністратор

- [ ] 5.1 Тригер `guard_admins` (advisory-блокування, `LAST_ADMIN`, роль після зняття `admin`);
  `canChangeAdminState`, `roleAfterAdminRemoval`; actions `setAdminRole`, `setActive`; відмова входу неактивному в
  `login` і `signOut` у `src/proxy.ts`; деактивовані поза `approverCandidates`; тести.
  Done when: AC-ORG-10, AC-ORG-11, AC-ORG-12, AC-ORG-16, AC-ORG-18, AC-ORG-21, AC-ORG-30, AC-ORG-31, AC-ORG-32.

## 6. Дозволи в профілі

- [ ] 6.1 Колонки дозволів; `allowedRequestTypes`, `allowedPurchaseTypes`; action `setPermissions`; списки на
  `/admin/staff/[id]` і `/profile`; тести.
  Done when: AC-ORG-17, AC-ORG-25, AC-ORG-26, AC-ORG-27.

## 7. Заглушка форми заявки

- [ ] 7.1 `/requests/new` без збереження: тип заявки, відділ, тип закупівлі, «від імені»; міграція з функцією
  `on_behalf_candidates` (private `security definer` + public `security invoker`); `selectableDepartments`,
  `selectablePurchaseTypes`, `onBehalfCandidates`; тести.
  Done when: AC-ORG-22, AC-ORG-23, AC-ORG-28, AC-ORG-29.

## 8. Відкладене

- [ ] 8.1 Рядок AC-ORG-13 у `docs/conformance.md` — «відкладено (чекаю відповідь PM на Q2,
  ValiaBihun/2026-quitcode-dream-team#43)».
  Done when: AC-ORG-13 — статус із посиланням на питання PM; `npm run ac:coverage` зелений.

## Workflow follow-up

- Запис екрана 1–2 хв на прод-URL — в останньому PR задачі зрізу.
- `npx openspec archive impl-org-settings -y` — в останньому PR зрізу, до merge.
