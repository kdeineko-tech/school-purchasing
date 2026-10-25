# План реалізації: impl-add-purchase-flow (зріз WS7)

## Why

Реалізуємо другий зріз Purchasing App: працівник подає закупівлю через форму у свій відділ і дозволеного типу, бачить
власні заявки, а схвалювач відділу схвалює чи відхиляє з причиною заявки свого відділу, крім власних. Специфікація —
`openspec/specs/{purchase-form,approval-decisions,english-interface}/spec.md` (зміна `add-purchase-flow`) і відкладені
з першого зрізу AC форми для адміністратора в `openspec/specs/access-permissions/spec.md`; вимоги PM — знімок від
2026-10-25 (шапка `docs/conformance.md`).

## What Changes

Покриває AC зрізу, які ще «відкладено (чекає реалізації)»:

- `purchase-form`: AC-FRM-01 … AC-FRM-13;
- `approval-decisions`: AC-APR-01 … AC-APR-07;
- `english-interface`: AC-LANG-04, AC-LANG-05, AC-LANG-06 (AC-LANG-01 … 03 уже реалізовано в
  kdeineko-tech/school-purchasing#18);
- `access-permissions`: AC-ORG-22, AC-ORG-23, AC-ORG-29 (адміністратор у формі закупівлі — з першого зрізу).

Не реалізуємо до відповіді PM: AC-LANG-07, AC-LANG-08 (Q5, ValiaBihun/2026-quitcode-dream-team#57). Від відкритих
Q6 (ValiaBihun/2026-quitcode-dream-team#58), Q7 (#59) і Q8 (#60) залежать лише окремі частини задач — див. `design.md`,
Risks.

## Capabilities

### New Capabilities

<!-- Немає: план реалізації (skip_specs), специфікацію змінює лише add-purchase-flow. -->

### Modified Capabilities

<!-- Немає. -->

## Impact

- Нова міграція: таблиці заявок і рядків, RLS, функції подання й рішення (`rpc`).
- Нові сторінки: форма закупівлі, «Мої заявки», сторінка заявки, список для рішення; посилання в шапці й на головній.
- Новий доменний модуль `src/lib/purchases/`, нові тексти в `src/lib/org/messages.ts` (англійською за таблицею #49).
- ADR `docs/decisions/0003-purchase-submission-rpc.md` — подання й рішення лише через функції бази.
