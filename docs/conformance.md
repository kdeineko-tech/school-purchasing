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
| AC-ORG-09 | Користувач без ролі admin на сторінці адміністратора | `src/lib/org/access.ts` (canOpenAdminPages), `src/app/admin/staff/page.tsx`, `src/app/admin/departments/page.tsx` | `tests/org/access.test.ts` | реалізовано |
| AC-ORG-17 | Працівник із дозволом на «Витрату карткою» | — | — | відкладено (чекає реалізації) |
| AC-ORG-26 | Працівник без дозволу на «Витрату карткою» | — | — | відкладено (чекає реалізації) |
| AC-ORG-25 | Адміністратор без дозволу на «Витрату карткою» | — | — | відкладено (чекає реалізації) |
| AC-ORG-27 | Працівник без дозволу «Самостійна закупівля» | — | — | відкладено (чекає реалізації) |
| AC-ORG-22 | Адміністратор без відділів обирає відділ | — | — | відкладено (чекає реалізації) |
| AC-ORG-29 | Адміністратор-заявник одного відділу обирає інший | — | — | відкладено (чекає реалізації) |
| AC-ORG-23 | Адміністратор без дозволу «Самостійна закупівля» | — | — | відкладено (чекає реалізації) |
| AC-ORG-34 | Дубль назви відділу в іншому регістрі | `src/lib/org/departments.ts` (validateNewDepartment), `src/app/admin/actions.ts` (createDepartment), `supabase/migrations/20261022000503_departments.sql` | `tests/org/departments.test.ts` | реалізовано |
| AC-ORG-01 | Працівник без відділів стає заявником відділу | `src/lib/org/membership.ts` (addRequester, requesterDepartments), `src/app/admin/actions.ts` (addRequester), `src/app/admin/staff/[id]/page.tsx` | `tests/org/departments.test.ts` | реалізовано |
| AC-ORG-02 | Призначення схвалювачем не заявника | `src/lib/org/membership.ts` (setApprover), `src/app/admin/actions.ts` (setApprover) | `tests/org/approvers.test.ts` | реалізовано |
| AC-ORG-03 | Заявник-схвалювач перестає бути схвалювачем | `src/lib/org/membership.ts` (removeRequester), `src/app/admin/actions.ts` (removeRequester) | `tests/org/approvers.test.ts` | реалізовано |
| AC-ORG-15 | Заявник втрачає автосхвалення відділу | — | — | відкладено (чекає реалізації) |
| AC-ORG-05 | Призначення схвалювачем дає роль approver | `src/lib/org/roles.ts` (roleFor), `src/app/admin/actions.ts` (setApprover), `supabase/migrations/20261022010957_approvers.sql` | `tests/org/approvers.test.ts` | реалізовано |
| AC-ORG-04 | Зняття з єдиного відділу повертає роль requester | `src/lib/org/roles.ts` (roleFor), `supabase/migrations/20261022010957_approvers.sql` | `tests/org/approvers.test.ts` | реалізовано |
| AC-ORG-19 | Схвалювач кількох відділів лишається approver | `src/lib/org/roles.ts` (roleFor), `src/lib/org/membership.ts` (setApprover) | `tests/org/approvers.test.ts` | реалізовано |
| AC-ORG-24 | Зняття заявника єдиного відділу повертає роль requester | `src/lib/org/roles.ts` (roleFor), `src/lib/org/membership.ts` (removeRequester), `supabase/migrations/20261022010957_approvers.sql` | `tests/org/approvers.test.ts` | реалізовано |
| AC-ORG-20 | Адміністратор-схвалювач лишається admin | `src/lib/org/roles.ts` (roleFor), `supabase/migrations/20261022010957_approvers.sql` | `tests/org/approvers.test.ts` | реалізовано |
| AC-ORG-06 | Автосхвалення лише в одному з відділів | — | — | відкладено (чекає реалізації) |
| AC-ORG-33 | Автосхвалення не заявнику | — | — | відкладено (чекає реалізації) |
| AC-ORG-14 | Відділ без активного схвалювача | `src/lib/org/departments.ts` (departmentsWithoutApprover), `src/app/admin/departments/page.tsx` | `tests/org/approvers.test.ts` | реалізовано |
| AC-ORG-10 | Єдиний адміністратор знімає з себе роль | — | — | відкладено (чекає реалізації) |
| AC-ORG-18 | Єдиний адміністратор деактивує себе | `src/lib/org/admins.ts` (leavesNoActiveAdmin), `src/app/admin/actions.ts` (setActive), `supabase/migrations/20261022083247_deactivation.sql` | `tests/org/deactivation.test.ts` | реалізовано |
| AC-ORG-21 | Адміністратор знімає з себе роль за наявності другого | — | — | відкладено (чекає реалізації) |
| AC-ORG-31 | Зняття ролі з адміністратора без відділів схвалення | — | — | відкладено (чекає реалізації) |
| AC-ORG-32 | Зняття ролі з адміністратора-схвалювача | — | — | відкладено (чекає реалізації) |
| AC-ORG-11 | Адміністратор без відділів | — | — | відкладено (чекає реалізації) |
| AC-ORG-12 | Деактивований працівник не входить у систему й бачить повідомлення | `src/app/login/actions.ts` (login), `src/lib/supabase/proxy.ts`, `src/app/admin/actions.ts` (setActive) | `tests/org/deactivation.test.ts`, `tests/org/proxy.test.ts` | реалізовано |
| AC-ORG-16 | Вибір схвалювача відділу | — | — | відкладено (чекає реалізації) |
| AC-ORG-28 | Вибір особи «від імені» | — | — | відкладено (чекає реалізації) |
| AC-ORG-30 | Повторна активація схвалювача | — | — | відкладено (чекає реалізації) |
