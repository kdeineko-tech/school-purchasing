# Пропозиція: уточнення зрізу 3 після відповідей PM (AC-DEC-12, AC-HIST-12 … AC-HIST-14)

## Why

PM відповіла на питання розробника Q10–Q14 (ValiaBihun/2026-quitcode-dream-team#65 … #69) і змінила вимоги. Знімок
вимог від 2026-11-02 після відповідей (шапка `docs/conformance.md`, PR «Оновлення вимог» kdeineko-tech/school-purchasing#47):

- `requirements/63-skhvaliuvach-chastkovo-skhvaliuie.md` — ValiaBihun/2026-quitcode-dream-team#63: новий AC-DEC-12,
  припущення про те, що автор змінює в поверненій заявці;
- `requirements/64-zaiavka-maie-nomer-sumy-riadkiv.md` — ValiaBihun/2026-quitcode-dream-team#64: нові AC-HIST-12,
  AC-HIST-13, AC-HIST-14, припущення про суму «Частково схвалено», номер і записи історії;
- `requirements/product.md` — ValiaBihun/2026-quitcode-dream-team#1: у Roadmap WS9 — 27 AC (DEC-01…12, HIST-01…14, LANG-09).

## What Changes

- MODIFIED вимога «Виправлення й повторне подання поверненої заявки» (`revision-decisions`): автор змінює поля рядків
  (назва, мета, кількість, ціна), додає й прибирає рядки; тип і відділ не змінює; ті самі межі й повідомлення, що при
  першому поданні (відповідь PM на Q11 — ValiaBihun/2026-quitcode-dream-team#66). ADDED сценарій AC-DEC-12: кількість 0
  при повторному поданні — «Кількість: ціле число від 1», статус лишається «Повернено на доопрацювання».
- MODIFIED вимога «Номер заявки» (`purchase-history`): при повторному поданні номер не змінюється (Q13 —
  ValiaBihun/2026-quitcode-dream-team#68). ADDED сценарій AC-HIST-14.
- MODIFIED вимога «Суми рядків і заявки» (`purchase-history`): сума заявки — завжди сума всіх рядків, зокрема для
  «Частково схвалено» (Q10 — ValiaBihun/2026-quitcode-dream-team#65). Сценарій AC-HIST-02 без змін.
- MODIFIED вимога «Історія подання й рішень» (`purchase-history`): окремий запис «Частково схвалено» і запис «Подано» для
  кожного подання, зокрема повторного (Q12 — ValiaBihun/2026-quitcode-dream-team#67). ADDED сценарії AC-HIST-12,
  AC-HIST-13.
- Q14 (ValiaBihun/2026-quitcode-dream-team#69): AC-LANG-09 входить у WS9 — зміна специфікації не потрібна,
  `add-decision-history` уже містить AC-LANG-09.

Наявні сценарії AC-DEC-05, AC-DEC-07, AC-HIST-01, AC-HIST-02, AC-HIST-06 … AC-HIST-09 — без змін; ID PM не змінюються.

## Capabilities

### New Capabilities

—

### Modified Capabilities

- `revision-decisions`: вимога «Виправлення й повторне подання поверненої заявки» (MODIFIED, + AC-DEC-12).
- `purchase-history`: вимоги «Номер заявки» (MODIFIED, + AC-HIST-14), «Суми рядків і заявки» (MODIFIED), «Історія
  подання й рішень» (MODIFIED, + AC-HIST-12, AC-HIST-13).

## Users & roles

Без змін відносно `add-decision-history` (матриця прав `requirements/product.md`): виправляє й подає знову повернену
заявку лише її автор; історію бачать автор, схвалювачі відділу заявки й адміністратор.

## Non-goals

- Зміна типу закупівлі чи відділу в поверненій заявці (ValiaBihun/2026-quitcode-dream-team#63, «Припущення»).
- Решта «Поза межами» `add-decision-history` без змін (рішення адміністратора за відділ без схвалювача — версія 2).

## Assumptions

- Автор поверненої заявки змінює поля рядків (назва, мета, кількість, ціна), додає й прибирає рядки; тип закупівлі й
  відділ не змінює; при повторному поданні діють ті самі межі кількості й ціни та ті самі повідомлення, що при першому
  (ValiaBihun/2026-quitcode-dream-team#63; відповідь на ValiaBihun/2026-quitcode-dream-team#66).
- Сума заявки — завжди сума всіх її рядків, зокрема для «Частково схвалено» (ValiaBihun/2026-quitcode-dream-team#64;
  відповідь на ValiaBihun/2026-quitcode-dream-team#65).
- Номер заявки не змінюється при повторному поданні (ValiaBihun/2026-quitcode-dream-team#64; відповідь на
  ValiaBihun/2026-quitcode-dream-team#68).
- Кожне подання, зокрема повторне, і часткове схвалення мають окремий запис в історії
  (ValiaBihun/2026-quitcode-dream-team#64; відповідь на ValiaBihun/2026-quitcode-dream-team#67).
- Англійські тексти — з таблиці ValiaBihun/2026-quitcode-dream-team#49: «Quantity: a whole number from 1»,
  «Partially approved», «Submitted».

## Open questions

Немає: PM відповіла на Q10–Q14 (ValiaBihun/2026-quitcode-dream-team#65 … #69); відповіді й рішення — у
`docs/spec-reading.md`.
