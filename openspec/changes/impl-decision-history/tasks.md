# Tasks

Вертикальні задачі: кожна — міграція/RLS + доменна функція + server action/сторінка + тест з AC ID + сценарій UAT;
окремим пунктом — тести відмов (PGlite) і мутаційна перевірка. Одна задача — одна гілка `task/<коротко>` і один PR
«Реалізація» від свіжого `main` після злиття попереднього. У кожному PR: рядки `docs/conformance.md` для AC задачі
(`/conformance`), `npm test`, `npm run ac:coverage`, зелені `quality` і CI, `@coderabbitai review` окремим коментарем
і відповідь на кожну знахідку; тексти, яких немає в таблиці #49, — переліком в описі PR; після merge — зелений
`db-deploy`. Перед кожною міграцією — перевірити, що інша відкрита гілка не змінює схему.

## 1. Номер і суми

- [x] 1.1 Міграція: `private.purchase_counter` (один рядок, RLS, `revoke all … from public, anon, authenticated`),
  `purchases.number` (номери наявних заявок за `created_at`, `last_number` = N, далі `not null unique`);
  `private.insert_purchase_lines` (спільні перевірки рядків); `submit_purchase` (`create or replace`) видає номер;
  `formatNumber`, `lineTotal`, `purchaseTotal` (центи); номер у «My requests», «Approvals», на головній і на сторінці
  заявки; суми рядків і заявки на сторінці заявки (за всіма рядками, #65); «Line total», «Total» (немає в таблиці #49 —
  позначити в PR); тести; UAT.
  Тести відмов і мутації: тест бази — дві заявки поспіль `PUR-1` і `PUR-2`; перше подання після N наявних — N + 1;
  відкочене подання не лишає пропуску (невдале подання → успішне отримує наступний номер); `has_table_privilege` — у
  `authenticated` і `anon` немає прав на лічильник; мутант `last_number + 1` → `last_number + 2` у `scripts/mutants.mjs`
  — тест «PUR-1, PUR-2» червоний; `file` мутанта F1 перенести в нову міграцію з `submit_purchase`.
  Done when: AC-HIST-01, AC-HIST-02.

## 2. Історія: запис «Подано»

- [x] 2.1 ADR 0005 «Історія заявки — записи функцій бази»; міграція: `purchase_events` (`kind` лише `submitted`;
  `actor_id → profiles on delete cascade`; RLS, `revoke all … from anon, authenticated`, `grant select` — політика
  «видима заявка»; `service_role` — усі права), записи для наявних заявок; `submit_purchase` пише `submitted`;
  `private.purchase_history` (видимість — дослівно як у `purchase_author_names`; невидима — 0 рядків) з іменем (без
  імені — email); `formatHistoryEntry`; блок «History» на сторінці заявки: «Submitted · <ім'я> · dd.mm.yyyy, HH:MM»
  за `America/New_York` (#74); `OWNED_ROWS` у `tests/e2e/support/admin.ts` — `purchases.author_id`; прогони
  UAT — лише по одному (`deleteUatUsers()` прибирає всі `uat-*`); тести; UAT.
  Тести відмов і мутації: AC-HIST-10 — Петро (не автор) бачить історію заявки «Офісу», але ні прямий `select` з
  `purchase_events`, ні `public.purchase_history` не повертають записів заявки «Початкової школи», статус той самий;
  сторінка `/purchases/[id]` для Петра — «Not enough permissions», без «History» і даних; автор-схвалювач іншого відділу
  бачить власну історію; `has_table_privilege` і прямий `insert` / `update` / `delete` у `purchase_events` —
  `permission denied`; мутанти AC-HIST-10 у `scripts/mutants.mjs`: умова політики `select` → `true` і умова видимості в
  `private.purchase_history` → `true` — обидва вбиває саме тест AC-HIST-10; ≥1 червоний прогін CI.
  Done when: AC-HIST-06, AC-HIST-10.

## 3. Часткове схвалення

- [ ] 3.1 Міграція: `purchase_lines.status` (рядкам наявних — за статусом заявки); новий `purchases_status_check` з
  `partially_approved` і `returned` (зняти → додати); `drop function` старого `decide_purchase(uuid, text, text)` у
  `public` і `private`, нові обидві з `p_rejected_lines uuid[] default '{}'` (статуси рядків для `approve` / `reject` /
  `return`; `ALL_LINES_REJECTED`; рядок чужої заявки чи рядки при `reject` / `return` — `FORBIDDEN`); `validateDecision`;
  «Reject line» біля рядків (немає в таблиці #49 — позначити в PR), статуси рядків на сторінці заявки; «Partially
  approved» у списку й на сторінці заявки; запасний варіант на час між розгортанням і `db-deploy`; тести; UAT.
  Тести відмов і мутації: непризначений `admin` — `FORBIDDEN`, статус той самий, заявки немає в його списку для
  рішення (#62); усі рядки відхилено — `ALL_LINES_REJECTED`, без змін; у `pg_proc` одна `public.decide_purchase`; виклик
  із трьома аргументами (як старий застосунок) схвалює й відхиляє, як у зрізі 2; мутант `m.approves` у новій міграції
  (непризначений `admin`); `file` мутанта A1 перенести в нову міграцію з `decide_purchase`; мутації — червоні.
  Done when: AC-DEC-01 (підпис «Partially approved» — частина AC-LANG-09, закриває задача 4.1).

## 4. Повернення й повторне подання

- [ ] 4.1 Міграція: `purchases.return_reason` і `check` (повернена — з причиною); `decide_purchase` — `return`
  (`REASON_REQUIRED`); `resubmit_purchase` (лише активний автор, лише `returned`; ті самі перевірки відділу, типу й
  рядків, що при поданні (`admin` — будь-який наявний відділ), — через `insert_purchase_lines`; поля рішення —
  `null`; відділ, тип і номер ті самі; ще один запис `submitted` — #67, #68); `canEditReturned`; «Return for
  revision» з причиною; причина повернення на сторінці заявки (підпис «Reason» — немає в таблиці #49, позначити в
  PR); кнопка «Edit» для автора поверненої заявки; `/purchases/[id]/edit` (змінити, додати, видалити рядки — #66);
  «Returned for revision» у списку й на сторінці заявки; тести; UAT.
  Тести відмов і мутації: AC-DEC-06 — без причини `REASON_REQUIRED`, статус «Очікує схвалення»; `resubmit_purchase` не
  автором, не для `returned`, деактивованим автором чи автором не `admin` поза відділом — `FORBIDDEN`, без змін;
  активний автор `admin` без членства у відділі подає знову; після повторного подання поля рішення порожні, номер
  той самий, в історії ще один `submitted`; мутант `REASON_REQUIRED` у `scripts/mutants.mjs` — саме тест AC-DEC-06
  червоний; ≥1 червоний прогін CI.
  Done when: AC-DEC-04, AC-DEC-06, AC-DEC-07, AC-LANG-09.

## Workflow follow-up

- Нові відповіді PM, що змінюють AC, — `/requirements-sync`, нова зміна специфікації з ADDED, MODIFIED або REMOVED, і
  лише потім правка задач.
- Тестові акаунти для всіх ролей зрізів 1–3 (заявник, схвалювач, адміністратор-схвалювач, непризначений адміністратор) —
  `accounts.zip` (WS9, D0.5).
- `npx openspec archive impl-decision-history -y`, потім `/conformance` — в останньому PR задачі 4, до merge.
- Після злиття задачі 4 і `/api/health` = SHA `main` — окремий PR «UAT WS9 на проді»: синтетичні відділи «UAT» і
  «UAT-2», одноразові `uat-<запуск>-…@example.test`, прибирання (`leftoverRequests` = 0), `npm run uat:nc` (NC-1 →
  FAIL), звіт `docs/qa/uat/<дата>/`, відео — вкладенням; у чаті команди — «UAT готовий», прод-URL і ролі. Строк — до
  кінця Пт 13.11: AC без звіту UAT PM не приймає.
- Потім окремий PR «Proof pack WS9»: поточний `docs/qa/proof-pack.md` → `docs/qa/proof-pack-ws8.md`; новий
  `docs/qa/proof-pack.md` за шаблоном WS9 — рядок на кожен з 9 AC, «Не перевірено» (зокрема «PUR-1 і PUR-2 у порожній
  системі» для AC-HIST-01), розділ «Приймання PM»; ретро `docs/qa/retro-ws9.md`.
- Приймання PM: на кожне issue «Відхилення від вимог» у нашому репо — PR з тестом, що відтворює відхилення, і
  `Fixes #N`, повторний прогін UAT цього AC; в issue — «Виправлено: <PR>, прогін UAT: <посилання>» до кінця Сб 14.11.
