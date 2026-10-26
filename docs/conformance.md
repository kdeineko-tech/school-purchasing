# Матриця відповідності (AC → код → тест → статус)

<!--
Ваша матриця: один рядок на кожен AC з openspec/specs/** — вашої специфікації, у яку ви перекладаєте вимоги PM
(їхній знімок у requirements/ приносить команда агента /requirements-sync).
Рядок «Вимоги» під цим коментарем заповнює лише /requirements-sync: адреса репо вимог PM, звідки взято вимоги (issues
або файли docs/), і дата знімка, через « · ». Руками його не змінюйте: з нього /requirements-sync знає, звідки брати
вимоги наступного разу, а скіли spec-clarify, spec-review і /conformance — куди ставити питання й яку версію вимог ви
реалізуєте. Рядків таблиці /requirements-sync не додає.
Рядки змінюєте ви:
  PR «Специфікація» — після archive зміни: рядок кожного нового AC зі статусом «відкладено (чекає реалізації)»; рядки AC,
                      прибраних зі специфікації (REMOVED), — видалити;
  PR «Реалізація»   — рядок AC задачі в тому самому PR, що й код і тест.
Перебудувати автоматично: /conformance (Claude Code, Cursor).
Перевірка в CI: npm run ac:coverage — падає, якщо
  NO-ROW     AC є в специфікації, а рядка немає (типово — PR «Специфікація» без нових рядків або рядок видалено);
  MISSING    статус «реалізовано», а непропущеного тесту, назва якого починається з цього AC ID, у файлах
             *.test.ts / *.test.tsx немає (*.spec.ts і допоміжні файли Vitest не запускає — вони не рахуються);
  ORPHAN     тест посилається на AC, якого немає в специфікації (AC прибрано або вимогу PM ще не перекладено);
  BAD-STATUS статус не «реалізовано» і не «відкладено (причина)»;
  WRONG-REF  шляху `src/…`/`tests/…`/`supabase/…` з колонок «Код»/«Тест» немає або тест із цим AC в іншому файлі;
і попереджає, не падаючи: AC з вимог PM (requirements/), якого ще немає в openspec/specs/, — «вимогу PM ще не перекладено
в специфікацію».

Приклад рядків (усередині коментаря — скрипт їх не читає):
| AC-LEAVE-02 | заявка на дві посади дає два записи main і additional | `src/app/requests/actions.ts` (createRequest) | `tests/requests.test.ts` | реалізовано |
| AC-LEAVE-04 | заблоковані дні не рахуються | — | — | відкладено (чекаю відповідь PM на Q2, <pm>/<team-slug>-spec#5) |
| AC-LEAVE-07 | менеджер бачить лише свій відділ | — | — | відкладено (рішення PM: поза зрізом 1, <pm>/<team-slug>-spec#8) |
| AC-LEAVE-10 | діапазон лише із заблокованих днів | — | — | відкладено (чекає реалізації) |
-->

Вимоги: https://github.com/ValiaBihun/2026-quitcode-dream-team · джерело: issues · знімок 2026-10-25

| AC | Що перевіряє | Код | Тест | Статус |
|---|---|---|---|---|
| AC-ORG-09 | Користувач без ролі admin на сторінці адміністратора | `src/lib/org/access.ts` (canOpenAdminPages), `src/app/admin/staff/page.tsx`, `src/app/admin/departments/page.tsx` | `tests/org/access.test.ts`, `tests/db/roles.test.ts` | реалізовано |
| AC-ORG-17 | Працівник із дозволом на «Витрату карткою» | `src/lib/org/permissions.ts` (allowedRequestTypes), `src/app/admin/actions.ts` (setPermissions), `src/app/admin/staff/[id]/page.tsx`, `supabase/migrations/20261025160124_permissions.sql` | `tests/org/permissions.test.ts` | реалізовано |
| AC-ORG-26 | Працівник без дозволу на «Витрату карткою» | `src/lib/org/permissions.ts` (allowedRequestTypes), `src/app/admin/staff/[id]/page.tsx` | `tests/org/permissions.test.ts` | реалізовано |
| AC-ORG-25 | Адміністратор без дозволу на «Витрату карткою» | `src/lib/org/permissions.ts` (allowedRequestTypes), `src/app/admin/staff/[id]/page.tsx` | `tests/org/permissions.test.ts` | реалізовано |
| AC-ORG-27 | Працівник без дозволу «Самостійна закупівля» | `src/lib/org/permissions.ts` (allowedPurchaseTypes), `src/app/admin/staff/[id]/page.tsx` | `tests/org/permissions.test.ts` | реалізовано |
| AC-ORG-22 | Адміністратор без відділів обирає відділ | `src/lib/purchases/form.ts` (formDepartments), `supabase/migrations/20261025185729_purchases.sql` (submit_purchase) | `tests/purchases/form.test.ts`, `tests/purchases/submit.test.ts` | реалізовано |
| AC-ORG-29 | Адміністратор-заявник одного відділу обирає інший | `src/lib/purchases/form.ts` (formDepartments), `supabase/migrations/20261025185729_purchases.sql` (submit_purchase) | `tests/purchases/form.test.ts` | реалізовано |
| AC-ORG-23 | Адміністратор без дозволу «Самостійна закупівля» | `src/lib/purchases/form.ts` (formPurchaseTypes), `supabase/migrations/20261025185729_purchases.sql` (submit_purchase) | `tests/purchases/form.test.ts`, `tests/purchases/submit.test.ts`, `tests/db/purchases.test.ts` | реалізовано |
| AC-ORG-34 | Дубль назви відділу в іншому регістрі | `src/lib/org/departments.ts` (validateNewDepartment), `src/app/admin/actions.ts` (createDepartment), `supabase/migrations/20261022000503_departments.sql` | `tests/org/departments.test.ts` | реалізовано |
| AC-ORG-01 | Працівник без відділів стає заявником відділу | `src/lib/org/membership.ts` (addRequester, requesterDepartments), `src/app/admin/actions.ts` (addRequester), `src/app/admin/staff/[id]/page.tsx`, `src/app/profile/page.tsx` | `tests/org/departments.test.ts`, `tests/org/profile.test.ts` | реалізовано |
| AC-ORG-02 | Призначення схвалювачем не заявника | `src/lib/org/membership.ts` (setApprover), `src/app/admin/actions.ts` (setApprover) | `tests/org/approvers.test.ts` | реалізовано |
| AC-ORG-03 | Заявник-схвалювач перестає бути схвалювачем | `src/lib/org/membership.ts` (removeRequester), `src/app/admin/actions.ts` (removeRequester) | `tests/org/approvers.test.ts` | реалізовано |
| AC-ORG-15 | Заявник втрачає автосхвалення відділу | `src/lib/org/membership.ts` (removeRequester), `src/app/admin/actions.ts` (removeRequester), `supabase/migrations/20261025143511_auto_approve.sql` | `tests/org/auto-approve.test.ts` | реалізовано |
| AC-ORG-05 | Призначення схвалювачем дає роль approver | `src/lib/org/roles.ts` (roleFor), `src/app/admin/actions.ts` (setApprover), `supabase/migrations/20261022010957_approvers.sql` | `tests/org/approvers.test.ts`, `tests/db/roles.test.ts` | реалізовано |
| AC-ORG-04 | Зняття з єдиного відділу повертає роль requester | `src/lib/org/roles.ts` (roleFor), `supabase/migrations/20261022010957_approvers.sql` | `tests/org/approvers.test.ts`, `tests/db/roles.test.ts` | реалізовано |
| AC-ORG-19 | Схвалювач кількох відділів лишається approver | `src/lib/org/roles.ts` (roleFor), `src/lib/org/membership.ts` (setApprover) | `tests/org/approvers.test.ts`, `tests/db/roles.test.ts` | реалізовано |
| AC-ORG-24 | Зняття заявника єдиного відділу повертає роль requester | `src/lib/org/roles.ts` (roleFor), `src/lib/org/membership.ts` (removeRequester), `supabase/migrations/20261022010957_approvers.sql` | `tests/org/approvers.test.ts`, `tests/db/roles.test.ts` | реалізовано |
| AC-ORG-20 | Адміністратор-схвалювач лишається admin | `src/lib/org/roles.ts` (roleFor), `supabase/migrations/20261022010957_approvers.sql` | `tests/org/approvers.test.ts` | реалізовано |
| AC-ORG-06 | Автосхвалення лише в одному з відділів | `src/lib/org/membership.ts` (setAutoApprove), `src/app/admin/actions.ts` (setAutoApprove), `supabase/migrations/20261025143511_auto_approve.sql` | `tests/org/auto-approve.test.ts` | реалізовано |
| AC-ORG-33 | Автосхвалення не заявнику | `src/lib/org/membership.ts` (setAutoApprove), `src/app/admin/actions.ts` (setAutoApprove) | `tests/org/auto-approve.test.ts` | реалізовано |
| AC-ORG-14 | Відділ без активного схвалювача | `src/lib/org/departments.ts` (departmentsWithoutApprover), `src/app/admin/departments/page.tsx` | `tests/org/approvers.test.ts` | реалізовано |
| AC-ORG-10 | Єдиний адміністратор знімає з себе роль | — | — | відкладено (чекає реалізації) |
| AC-ORG-18 | Єдиний адміністратор деактивує себе | `src/lib/org/admins.ts` (leavesNoActiveAdmin), `src/app/admin/actions.ts` (setActive), `supabase/migrations/20261022083247_deactivation.sql` | `tests/org/deactivation.test.ts` | реалізовано |
| AC-ORG-21 | Адміністратор знімає з себе роль за наявності другого | — | — | відкладено (чекає реалізації) |
| AC-ORG-31 | Зняття ролі з адміністратора без відділів схвалення | — | — | відкладено (чекає реалізації) |
| AC-ORG-32 | Зняття ролі з адміністратора-схвалювача | — | — | відкладено (чекає реалізації) |
| AC-ORG-11 | Адміністратор без відділів | — | — | відкладено (чекає реалізації) |
| AC-ORG-12 | Деактивований працівник не входить у систему й бачить повідомлення | `src/app/login/actions.ts` (login), `src/lib/supabase/proxy.ts`, `src/app/admin/actions.ts` (setActive) | `tests/org/deactivation.test.ts`, `tests/org/proxy.test.ts`, `tests/db/roles.test.ts` | реалізовано |
| AC-ORG-16 | Вибір схвалювача відділу | — | — | відкладено (чекає реалізації) |
| AC-ORG-28 | Вибір особи «від імені» | — | — | відкладено (чекає реалізації) |
| AC-ORG-30 | Повторна активація схвалювача | — | — | відкладено (чекає реалізації) |
| AC-FRM-01 | Лише відділи, де працівник заявник | `src/lib/purchases/form.ts` (formDepartments), `src/app/purchases/new/page.tsx` | `tests/purchases/form.test.ts`, `tests/purchases/pages.test.ts` | реалізовано |
| AC-FRM-02 | Подання в чужий відділ напряму | `src/lib/purchases/form.ts` (validateSubmission), `src/app/purchases/actions.ts` (submitPurchase), `supabase/migrations/20261025185729_purchases.sql` (submit_purchase) | `tests/purchases/form.test.ts`, `tests/purchases/submit.test.ts`, `tests/db/purchases.test.ts` | реалізовано |
| AC-FRM-03 | Без дозволу «Самостійна закупівля» у формі | `src/lib/purchases/form.ts` (formPurchaseTypes), `src/app/purchases/new/page.tsx` | `tests/purchases/form.test.ts`, `tests/purchases/pages.test.ts` | реалізовано |
| AC-FRM-04 | Подання «Самостійної закупівлі» без дозволу напряму | `src/lib/purchases/form.ts` (validateSubmission), `src/app/purchases/actions.ts` (submitPurchase), `supabase/migrations/20261025185729_purchases.sql` (submit_purchase) | `tests/purchases/form.test.ts`, `tests/purchases/submit.test.ts`, `tests/db/purchases.test.ts` | реалізовано |
| AC-FRM-05 | Форма для працівника без відділів | `src/app/purchases/new/page.tsx`, `src/lib/org/messages.ts` (noDepartments) | `tests/purchases/form.test.ts`, `tests/purchases/pages.test.ts` | реалізовано |
| AC-FRM-06 | Подання без рядків | `src/lib/purchases/form.ts` (validateSubmission), `src/app/purchases/new/purchase-form.tsx`, `src/app/purchases/actions.ts` (submitPurchase), `supabase/migrations/20261025185729_purchases.sql` (submit_purchase) | `tests/purchases/form.test.ts`, `tests/purchases/submit.test.ts`, `tests/db/purchases.test.ts` | реалізовано |
| AC-FRM-07 | Подання закупівлі з одним рядком | `src/app/purchases/actions.ts` (submitPurchase), `supabase/migrations/20261025185729_purchases.sql` (submit_purchase) | `tests/purchases/form.test.ts`, `tests/purchases/submit.test.ts`, `tests/purchases/pages.test.ts`, `tests/db/purchases.test.ts` | реалізовано |
| AC-FRM-12 | Відділ без активного схвалювача | `src/app/purchases/actions.ts` (submitPurchase), `supabase/migrations/20261025185729_purchases.sql` (submit_purchase) | `tests/purchases/submit.test.ts` | реалізовано |
| AC-FRM-13 | Єдиний схвалювач — автор | `supabase/migrations/20261025223225_purchase_decisions.sql` (decide_purchase), `src/lib/purchases/decisions.ts` (canDecide) | `tests/db/decisions.test.ts` | реалізовано |
| AC-FRM-11 | Перехід на «Мої заявки» | `src/app/purchases/actions.ts` (submitPurchase), `src/app/purchases/page.tsx` | `tests/purchases/submit.test.ts`, `tests/purchases/pages.test.ts` | реалізовано |
| AC-FRM-10 | Власна закупівля в «Мої заявки» | `src/app/purchases/page.tsx`, `supabase/migrations/20261025185729_purchases.sql` (submit_purchase) (RLS purchases_select_visible) | `tests/purchases/pages.test.ts`, `tests/db/purchases.test.ts` | реалізовано |
| AC-FRM-08 | Колега відкриває чужу закупівлю | `src/app/purchases/[id]/page.tsx`, `src/lib/purchases/form.ts` (canSeePurchase), `supabase/migrations/20261025185729_purchases.sql` (RLS purchases_select_visible) | `tests/purchases/purchase-page.test.ts`, `tests/db/purchases.test.ts` | реалізовано |
| AC-FRM-09 | Гість відкриває форму | `src/app/purchases/new/page.tsx`, `src/app/purchases/page.tsx` | `tests/purchases/pages.test.ts`, `tests/db/purchases.test.ts` | реалізовано |
| AC-FRM-14 | «Мої заявки» без заявок | `src/app/purchases/page.tsx`, `src/lib/org/messages.ts` (noRequests) | `tests/purchases/pages.test.ts` | реалізовано |
| AC-FRM-15 | Рядок лише з назвою | `src/lib/purchases/form.ts` (validateSubmission), `src/app/purchases/actions.ts` (submitPurchase), `supabase/migrations/20261026100553_purchase_line_fields.sql` (LINE_FIELDS) | `tests/purchases/form.test.ts`, `tests/purchases/submit.test.ts`, `tests/db/purchases.test.ts` | реалізовано |
| AC-APR-01 | Лише заявки свого відділу | `src/lib/purchases/decisions.ts` (decisionList), `src/app/approvals/page.tsx` | `tests/purchases/decisions.test.ts` | реалізовано |
| AC-APR-02 | Схвалювач схвалює заявку свого відділу | `src/lib/purchases/decisions.ts` (canDecide), `src/app/purchases/actions.ts` (decidePurchase), `src/app/purchases/[id]/page.tsx`, `supabase/migrations/20261025223225_purchase_decisions.sql` (decide_purchase) | `tests/purchases/decisions.test.ts`, `tests/db/decisions.test.ts` | реалізовано |
| AC-APR-03 | Схвалювач відкриває заявку чужого відділу | `supabase/migrations/20261025223225_purchase_decisions.sql` (decide_purchase), `src/lib/purchases/decisions.ts` (canDecide), `supabase/migrations/20261025185729_purchases.sql` (RLS) | `tests/purchases/decisions.test.ts`, `tests/db/decisions.test.ts` | реалізовано |
| AC-APR-04 | Заявник відкриває список для рішення | `src/app/approvals/page.tsx`, `supabase/migrations/20261025223225_purchase_decisions.sql` (decide_purchase) | `tests/purchases/decisions.test.ts`, `tests/db/decisions.test.ts` | реалізовано |
| AC-APR-05 | Схвалювач схвалює власну заявку напряму | `supabase/migrations/20261025223225_purchase_decisions.sql` (decide_purchase), `src/lib/purchases/decisions.ts` (canDecide), `src/app/purchases/[id]/page.tsx` | `tests/purchases/decisions.test.ts`, `tests/db/decisions.test.ts` | реалізовано |
| AC-APR-06 | Відхилення без причини | `src/lib/purchases/decisions.ts` (validateDecision), `src/app/purchases/actions.ts` (decidePurchase), `supabase/migrations/20261025223225_purchase_decisions.sql` (decide_purchase) | `tests/purchases/decisions.test.ts`, `tests/db/decisions.test.ts` | реалізовано |
| AC-APR-07 | Відхилення з причиною | `src/app/purchases/actions.ts` (decidePurchase), `src/app/purchases/[id]/page.tsx` (причина поруч зі статусом), `supabase/migrations/20261025223225_purchase_decisions.sql` (decide_purchase) | `tests/purchases/decisions.test.ts`, `tests/db/decisions.test.ts` | реалізовано |
| AC-LANG-01 | Будь-яка сторінка англійською | `src/lib/org/messages.ts`, `src/components/ui.tsx` (roleLabel), `src/components/page-shell.tsx`, `src/app/layout.tsx` (lang="en") | `tests/org/english.test.ts` | реалізовано |
| AC-LANG-02 | Вхід англійською | `src/app/login/page.tsx` | `tests/org/english.test.ts` | реалізовано |
| AC-LANG-03 | Відмова без права англійською | `src/lib/org/messages.ts` (forbidden), `src/app/admin/no-access.tsx` | `tests/org/english.test.ts` | реалізовано |
| AC-LANG-04 | Заявка без рядків англійською | `src/lib/org/messages.ts` (noLines), `src/app/purchases/actions.ts` (submitPurchase) | `tests/purchases/submit.test.ts` | реалізовано |
| AC-LANG-05 | Рішення без причини англійською | `src/lib/org/messages.ts` (provideReason), `src/app/purchases/actions.ts` (decidePurchase) | `tests/purchases/decisions.test.ts` | реалізовано |
| AC-LANG-06 | Підпис статусу | `src/app/purchases/status-badge.tsx`, `src/lib/purchases/form.ts` (STATUS_LABELS) | `tests/purchases/purchase-page.test.ts` | реалізовано |
| AC-LANG-08 | Ролі | — | — | відкладено (чекає реалізації) |
