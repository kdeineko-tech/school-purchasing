# Tasks

Вертикальні задачі: кожна — міграція/RLS + доменна функція + server action/сторінка + тест з AC ID + сценарій UAT;
окремим пунктом — тести відмов (PGlite) і мутаційна перевірка. Одна задача — одна гілка `task/<коротко>` і один PR
«Реалізація» від свіжого `main` після злиття попереднього. Перевірка — `npm test`, `npm run ac:coverage`, після merge —
зелений `db-deploy`. Перед кожною міграцією — перевірити, що інша відкрита гілка не змінює схему.

## 1. Номер і суми

- [ ] 1.1 Міграція: лічильник `purchase_counter` (один рядок, без grant), `purchases.number` (номери наявних заявок за
  `created_at`, `last_number` = N, далі `not null unique`); `submit_purchase` (`create or replace`) видає номер; `formatNumber`, `lineTotal`,
  `purchaseTotal` (центи); номер у «My requests», «Approvals», на головній і на сторінці заявки; суми рядків і заявки
  на сторінці заявки (за всіма рядками, #65); «Line total», «Total»; тести; UAT.
  Тести відмов і мутації: тест бази — дві заявки поспіль `PUR-1` і `PUR-2`; перше подання після N наявних — N + 1;
  відкочене подання не лишає пропуску (невдале подання → успішне отримує наступний номер); номер і лічильник не змінити
  напряму (немає grant); мутація «номер з `nextval` замість лічильника» чи «лічильник поза транзакцією» — червоний.
  Done when: AC-HIST-01, AC-HIST-02.

## 2. Історія: запис «Подано»

- [ ] 2.1 ADR 0005 «Історія заявки — записи функцій бази»; міграція: `purchase_events` (`kind` лише `submitted`; RLS:
  `select` — видима заявка; інших grant немає), записи для наявних заявок; `submit_purchase` пише `submitted`;
  `purchase_history` з іменем (без імені — email); `formatHistoryEntry`; блок «History» на сторінці заявки:
  «Submitted · <ім'я> · dd.mm.yyyy, HH:MM» за `America/New_York` (#74); тести; UAT.
  Тести відмов і мутації: AC-HIST-10 — Петро (не автор) бачить історію заявки «Офісу», але прямий `select` з
  `purchase_events` не повертає записів заявки «Початкової школи», статус той самий;
  автор-схвалювач іншого відділу бачить власну історію; прямий `insert` / `update` / `delete` у `purchase_events` —
  `permission denied`; мутація політики `select`, що відв'язує її від `purchase_id`, — саме тест AC-HIST-10 червоний; ≥1 червоний прогін CI.
  Done when: AC-HIST-06, AC-HIST-10.

## 3. Часткове схвалення

- [ ] 3.1 Міграція: `purchase_lines.status` (рядкам наявних — за статусом заявки); новий `purchases_status_check` з
  `partially_approved` і `returned` (зняти → додати); `decide_purchase` нової сигнатури з `p_rejected_lines`
  (`p_rejected_lines` з типовим `'{}'`; `ALL_LINES_REJECTED`, рядок чужої заявки — `FORBIDDEN`); `validateDecision`; «Reject line» біля рядків, статуси
  рядків на сторінці заявки; «Partially approved» у списку й на сторінці заявки; запасний варіант на час між
  розгортанням і `db-deploy`; тести; UAT.
  Тести відмов і мутації: непризначений `admin` — `FORBIDDEN`, статус той самий, заявки немає в його списку для
  рішення (#62); усі рядки відхилено — `ALL_LINES_REJECTED`, без змін; виклик із трьома аргументами (як старий
  застосунок) схвалює й відхиляє, як у зрізі 2; мутації — червоні.
  Done when: AC-DEC-01 (підпис «Partially approved» — частина AC-LANG-09, закриває задача 4.1).

## 4. Повернення й повторне подання

- [ ] 4.1 Міграція: `purchases.return_reason` і `check` (повернена — з причиною); `decide_purchase` — `return`
  (`REASON_REQUIRED`); `resubmit_purchase` (лише активний автор, лише `returned`; перевірки рядків як при поданні;
  відділ, тип і номер ті самі; ще один запис `submitted` — #67, #68); `canEditReturned`; «Return for revision» з
  причиною; причина повернення на сторінці заявки; `/purchases/[id]/edit` (змінити, додати, видалити рядки — #66);
  «Returned for revision» у списку й на сторінці заявки; тести; UAT.
  Тести відмов і мутації: AC-DEC-06 — без причини `REASON_REQUIRED`, статус «Очікує схвалення»; `resubmit_purchase` не
  автором чи не для `returned` — `FORBIDDEN`, без змін; деактивований автор — `FORBIDDEN`; мутація `REASON_REQUIRED` —
  саме тест AC-DEC-06 червоний; ≥1 червоний прогін CI.
  Done when: AC-DEC-04, AC-DEC-06, AC-DEC-07, AC-LANG-09.

## Workflow follow-up

- Нові відповіді PM, що змінюють AC, — `/requirements-sync`, нова зміна специфікації з ADDED, MODIFIED або REMOVED, і
  лише потім правка задач.
- Тестові акаунти для всіх ролей зрізів 1–3 (заявник, схвалювач, адміністратор-схвалювач, непризначений адміністратор) —
  `accounts.zip` (WS9, D0.5).
- Відділ «UAT» і тестові акаунти UAT (заявник, схвалювач цього відділу) — лише для заявок і рішень UAT; UAT усіх 9 AC на проді, proof pack WS9 за шаблоном курсу (рядок на кожен AC + «Не перевірено»), ретро
  `docs/qa/retro-ws9.md`; запис екрана на прод-URL — в останньому PR зрізу.
- `npx openspec archive impl-decision-history -y`, потім `/conformance` — в останньому PR зрізу, до merge.
