# Tasks

Вертикальні задачі: кожна — міграція/RLS + доменна функція + server action/сторінка + тест з AC ID; окремим пунктом —
тести на відмовні AC (тести бази на PGlite) і мутаційна перевірка. Одна задача — одна гілка `task/<коротко>` і один PR
«Реалізація» від свіжого `main` після злиття попереднього. Перевірка — `npm test`, `npm run ac:coverage`, після merge —
зелений `db-deploy`. Перед кожною міграцією — перевірити, що інша відкрита гілка не змінює схему.

Задачі 1–3 від відповідей PM не залежать; 4 і 5 — останні (Q11 #66, Q12 #67, Q13 #68).

## 1. Номер і суми

- [ ] 1.1 Міграція: послідовність `purchase_number_seq`, `purchases.number` (номери наявних заявок за `created_at`,
  далі `not null unique`); `submit_purchase` (`create or replace`) видає номер; `formatNumber`, `lineTotal`,
  `purchaseTotal` (центи); номер у «My requests», «Approvals», на головній і на сторінці заявки; сума кожного рядка й
  сума заявки на сторінці заявки (до відповіді на Q10 #65 — за всіма рядками); підписи «Line total», «Total»; тести.
  Тести відмов і мутації: тест бази — дві заявки поспіль отримують `PUR-1` і `PUR-2`, номер не можна змінити напряму
  (немає grant); мутація «номер не з послідовності» — червоний.
  Done when: AC-HIST-01, AC-HIST-02.

## 2. Межі кількості й ціни

- [ ] 2.1 Міграція: `purchase_lines` `check (quantity >= 1)` і `check (unit_price >= 0)` як `not valid`;
  `submit_purchase` повертає `QUANTITY_RANGE` (0, 2.5) і `PRICE_RANGE` (−5.00) до будь-якого `insert`;
  `validateSubmission` з тими самими межами; «Quantity: a whole number from 1», «Price: a number from 0» у `MESSAGES`;
  введене лишається у формі; тести.
  Тести відмов і мутації: тести бази на PGlite для AC-HIST-03, AC-HIST-04, AC-HIST-05 — код помилки й жодної нової
  заявки; мутація кожної межі — червоний; ≥1 червоний прогін CI мутацією нової міграції.
  Done when: AC-HIST-03, AC-HIST-04, AC-HIST-05.

## 3. Історія подання й рішень

- [ ] 3.1 ADR 0005 «Історія заявки — записи функцій бази»; міграція: таблиця `purchase_events` (RLS: `select` — видима
  заявка; інших grant немає), записи для наявних заявок, `submit_purchase` і `decide_purchase` пишуть `submitted`,
  `approved`, `rejected`; функція `purchase_history` з іменем того, хто діяв; блок «History» на сторінці заявки
  («Submitted», «Approved», «Rejected», дата й час `America/New_York`, причина); тести.
  Тести відмов і мутації: тести бази для AC-HIST-10 (схвалювач чужого відділу — порожньо, статус той самий) і
  AC-HIST-11 (`anon` — `permission denied`); прямий `insert`/`update`/`delete` у `purchase_events` — `permission
  denied`; мутація політики `select` — червоний; ≥1 червоний прогін CI.
  Done when: AC-HIST-06, AC-HIST-07, AC-HIST-08, AC-HIST-10, AC-HIST-11.

## 4. Часткове схвалення

- [ ] 4.1 Міграція: `purchase_lines.status`; новий `purchases_status_check` з `partially_approved` і `returned`
  (зняти → додати); `decide_purchase` нової сигнатури з `p_rejected_lines` (`ALL_LINES_REJECTED`), запис
  `partially_approved` в історії (до відповіді на Q12 #67 — рекомендація A); `validateDecision`; позначка «Reject line»
  біля рядків і статуси рядків на сторінці заявки; «Partially approved» і «All lines are rejected: reject the whole
  request»; запасний варіант на час між розгортанням і `db-deploy`; тести.
  Тести відмов і мутації: тест бази для AC-DEC-03 — усі рядки відхилено, `ALL_LINES_REJECTED`, статус і рядки без змін;
  відхилення рядка чужої заявки — `FORBIDDEN`; мутації — червоні.
  Done when: AC-DEC-01, AC-DEC-02, AC-DEC-03 (підпис «Partially approved» — частина AC-LANG-09, закриває задача 5.1).

## 5. Повернення, редагування й повторне подання

- [ ] 5.1 Міграція: `purchases.return_reason` і `check` (повернена — з причиною); `decide_purchase` — рішення `return`
  (`REASON_REQUIRED`), запис `returned`; `resubmit_purchase` (лише автор, лише `returned`; обов'язкові поля рядків; межі — до відповіді на доповнення Q11 #66;
  відділ і тип ті самі; запис `submitted`; номер той самий — до відповіді на Q13 #68); `canEditReturned`;
  «Return for revision» з причиною; причина повернення на сторінці заявки; сторінка `/purchases/[id]/edit` (до відповіді
  на Q11 #66 — змінити, додати, видалити рядки); «Returned for revision»; без «Edit» і «Submit» для «Rejected»; тести.
  Тести відмов і мутації: тести бази для AC-DEC-06 (без причини — статус той самий), AC-DEC-08 (колега не бачить
  повернену), AC-DEC-09 (`requester` повертає напряму — `FORBIDDEN`, статус той самий), AC-DEC-10 (`anon` — нічого),
  AC-DEC-11 (`resubmit_purchase` для відхиленої — `FORBIDDEN`); мутації — червоні; ≥1 червоний прогін CI.
  Done when: AC-DEC-04, AC-DEC-05, AC-DEC-06, AC-DEC-07, AC-DEC-08, AC-DEC-09, AC-DEC-10, AC-DEC-11, AC-HIST-09,
  AC-LANG-09.

## Workflow follow-up

- Після відповідей PM на Q10–Q13: якщо відповідь інша, ніж рекомендована, — `/requirements-sync`, зміна специфікації з
  MODIFIED, і лише потім правка задач 1, 4, 5.
- Ручна перевірка на проді демо-користувачами (заявник, схвалювач, адміністратор), зокрема обхід сторінок через `rpc`;
  запис екрана 1–2 хв на прод-URL — в останньому PR зрізу.
- `npx openspec archive impl-decision-history -y` — в останньому PR зрізу, до merge.
