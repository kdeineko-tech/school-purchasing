# Tasks

Вертикальні задачі: кожна — міграція/RLS + доменна функція + server action/сторінка + тест з AC ID; окремим пунктом —
тести на відмовні AC (тести бази на PGlite) і мутаційна перевірка. Одна задача —
одна гілка `task/<коротко>` і один PR «Реалізація». Перевірка — `npm test`, `npm run ac:coverage`, після merge —
зелений `db-deploy`. Перед кожною міграцією — перевірити, що інша відкрита гілка не змінює схему.

## 1. Подання закупівлі й «Мої заявки»

- [x] 1.1 Міграція `purchases`: таблиці `purchases`, `purchase_lines` (design §1), RLS `select` (автор / схвалювач
  відділу / `admin`, лише активний), `private.approves_department`, `submit_purchase` (`private` definer + `public`
  invoker; `FORBIDDEN`, `NO_LINES`); ADR `0003-purchase-submission-rpc`; `src/lib/purchases/` (`formDepartments`,
  `formPurchaseTypes`, `validateSubmission`, `STATUS_LABELS`, `PURCHASE_TYPE_LABELS`); нові `MESSAGES`; сторінки
  `/purchases/new` (форма з `useActionState`) і `/purchases`; action `submitPurchase`; посилання в шапці й на головній;
  тести.
  Done when: AC-FRM-01, AC-FRM-02, AC-FRM-03, AC-FRM-04, AC-FRM-05, AC-FRM-06, AC-FRM-07, AC-FRM-09, AC-FRM-10,
  AC-FRM-11, AC-FRM-12, AC-ORG-22, AC-ORG-23, AC-ORG-29, AC-LANG-04.

## 2. Сторінка заявки й доступ до неї

- [x] 2.1 `/purchases/[id]`: рядки, тип, відділ, статус текстом; відмова «Not enough permissions» без даних, якщо RLS
  не повертає заявку; `canSeePurchase`; статус-текст і в «Мої заявки»; тести.
  Done when: AC-FRM-08, AC-LANG-06.

## 3. Рішення схвалювача

- [x] 3.1 Міграція `…_purchase_decisions.sql` — лише функції `decide_purchase` (`private` + обгортка `public`) для
  наявної таблиці `purchases` (колонки рішення вже є; нової таблиці немає): `for update`; `FORBIDDEN`, `NOT_PENDING`,
  `REASON_REQUIRED`; `canDecide`, `decisionList`, `validateDecision`; сторінка `/approvals` (`requester` — відмова;
  порожньо — «No requests awaiting your decision»); кнопки «Approve» / «Reject» з причиною на `/purchases/[id]`;
  action `decidePurchase`; посилання «Approvals» для `approver` і `admin`; тести.
  Тести відмов і мутації: тести бази на PGlite для AC-APR-03, AC-APR-04, AC-APR-05, AC-APR-06 (відмова й незмінний
  статус); мутаційна перевірка на кожен із них — таблиця в описі PR і ≥2 червоні прогони CI мутацією нової міграції.
  Done when: AC-APR-01, AC-APR-02, AC-APR-03, AC-APR-04, AC-APR-05, AC-APR-06, AC-APR-07, AC-FRM-13, AC-LANG-05.

## 4. Після відповідей PM (зміна специфікації `update-purchase-flow`)

- [ ] 4.1 Обов'язкові поля рядка й порожні «Мої заявки» (відповіді PM на Q8 — ValiaBihun/2026-quitcode-dream-team#60,
  Q6 — ValiaBihun/2026-quitcode-dream-team#58): нова міграція — `submit_purchase` відхиляє рядок без назви, мети,
  кількості чи ціни кодом `LINE_FIELDS` (`create or replace function`); `validateSubmission` з тим самим правилом;
  «Fill in all line fields» і «You have not submitted any requests yet» у `MESSAGES`; порожній стан на `/purchases`;
  тести.
  Тести відмов і мутації: тест бази на PGlite для AC-FRM-15 — табличний, чотири випадки (рядок без назви, без мети,
  без кількості, без ціни): у кожному `LINE_FIELDS` і жодної нової заявки; мутаційна перевірка — таблиця в описі PR.
  Done when: AC-FRM-14, AC-FRM-15.
- [ ] 4.2 Підписи ролей: ідентифікатори `requester` / `approver` / `admin` без змін, поруч — англійська назва з таблиці
  ValiaBihun/2026-quitcode-dream-team#49 (відповідь PM на Q5 — ValiaBihun/2026-quitcode-dream-team#57); тести.
  Тести відмов і мутації: відмовних AC у задачі немає (лише підписи).
  Done when: AC-LANG-08.

Причину відхилення на сторінці заявки поруч зі статусом «Rejected» (відповідь PM на Q7 —
ValiaBihun/2026-quitcode-dream-team#59, уточнений AC-APR-07) показує задача 3.1. AC-LANG-07 PM прибрала (Q5).

## Workflow follow-up

- Ручна перевірка на проді трьома демо-користувачами (заявник, схвалювач, адміністратор), зокрема обхід сторінок
  через `rpc`; запис екрана 1–2 хв на прод-URL — в останньому PR задачі зрізу.
- `npx openspec archive impl-add-purchase-flow -y` — в останньому PR зрізу, до merge.
