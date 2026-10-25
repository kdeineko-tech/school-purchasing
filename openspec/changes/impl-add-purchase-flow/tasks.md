# Tasks

Вертикальні задачі: кожна — міграція/RLS + доменна функція + server action/сторінка + тест з AC ID. Одна задача —
одна гілка `task/<коротко>` і один PR «Реалізація». Перевірка — `npm test`, `npm run ac:coverage`, після merge —
зелений `db-deploy`. Перед кожною міграцією — перевірити, що інша відкрита гілка не змінює схему.

## 1. Подання закупівлі й «Мої заявки»

- [ ] 1.1 Міграція `purchases`: таблиці `purchases`, `purchase_lines` (design §1), RLS `select` (автор / схвалювач
  відділу / `admin`, лише активний), `private.approves_department`, `submit_purchase` (`private` definer + `public`
  invoker; `FORBIDDEN`, `NO_LINES`); ADR `0003-purchase-submission-rpc`; `src/lib/purchases/` (`formDepartments`,
  `formPurchaseTypes`, `validateSubmission`, `STATUS_LABELS`, `PURCHASE_TYPE_LABELS`); нові `MESSAGES`; сторінки
  `/purchases/new` (форма з `useActionState`) і `/purchases`; action `submitPurchase`; посилання в шапці й на головній;
  тести.
  Done when: AC-FRM-01, AC-FRM-02, AC-FRM-03, AC-FRM-04, AC-FRM-05, AC-FRM-06, AC-FRM-07, AC-FRM-09, AC-FRM-10,
  AC-FRM-11, AC-FRM-12, AC-ORG-22, AC-ORG-23, AC-ORG-29, AC-LANG-04.

## 2. Сторінка заявки й доступ до неї

- [ ] 2.1 `/purchases/[id]`: рядки, тип, відділ, статус текстом; відмова «Not enough permissions» без даних, якщо RLS
  не повертає заявку; `canSeePurchase`; статус-текст і в «Мої заявки»; тести.
  Done when: AC-FRM-08, AC-LANG-06.

## 3. Рішення схвалювача

- [ ] 3.1 Міграція `purchase_decisions`: `decide_purchase` (`for update`; `FORBIDDEN`, `NOT_PENDING`,
  `REASON_REQUIRED`); `canDecide`, `decisionList`, `validateDecision`; сторінка `/approvals` (`requester` — відмова;
  порожньо — «No requests awaiting your decision»); кнопки «Approve» / «Reject» з причиною на `/purchases/[id]`;
  action `decidePurchase`; посилання «Approvals» для `approver` і `admin`; тести.
  Done when: AC-APR-01, AC-APR-02, AC-APR-03, AC-APR-04, AC-APR-05, AC-APR-06, AC-APR-07, AC-FRM-13, AC-LANG-05.

## 4. Після відповідей PM

- [ ] 4.1 Q8 (ValiaBihun/2026-quitcode-dream-team#60): обов'язкові поля рядка — після `/requirements-sync` і зміни
  специфікації; нова міграція (`not null`/`check`), повідомлення з таблиці PM, `validateSubmission`, тести.
  Done when: нові чи змінені AC PM про поля рядка — «реалізовано».
- [ ] 4.2 Q6 (#58): текст порожньої сторінки «Мої заявки»; Q7 (#59): де показувати причину відхилення.
  Done when: AC-FRM-10 і AC-APR-07 за відповідями PM; `npm run ac:coverage` зелений.
- [ ] 4.3 Q5 (#57): AC-LANG-07, AC-LANG-08 — за відповіддю PM (реалізація або зміна специфікації).
  Done when: рядки AC-LANG-07, AC-LANG-08 у `docs/conformance.md` — «реалізовано» або причина з посиланням на рішення PM.

## Workflow follow-up

- Ручна перевірка на проді трьома демо-користувачами (заявник, схвалювач, адміністратор), зокрема обхід сторінок
  через `rpc`; запис екрана 1–2 хв на прод-URL — в останньому PR задачі зрізу.
- `npx openspec archive impl-add-purchase-flow -y` — в останньому PR зрізу, до merge.
