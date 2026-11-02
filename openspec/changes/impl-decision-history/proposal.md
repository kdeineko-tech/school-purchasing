# Пропозиція: план реалізації зрізу 3 (WS9)

## Why

Реалізуємо третій зріз зі специфікації `add-decision-history` і уточнення `update-decision-history` після відповідей PM
(злиті в PR «Специфікація»): схвалювач частково схвалює чи
повертає заявку з причиною, автор виправляє й подає знову, кожна заявка має номер, суми й історію подання та рішень,
рядок має межі кількості й ціни. Вимоги PM — ValiaBihun/2026-quitcode-dream-team#63, #64, AC-LANG-09 у #49 (знімок
2026-11-02).

## What Changes

Зміна покриває AC з `openspec/specs/`:

- `revision-decisions`: AC-DEC-01, AC-DEC-02, AC-DEC-03, AC-DEC-04, AC-DEC-05, AC-DEC-06, AC-DEC-07, AC-DEC-08,
  AC-DEC-09, AC-DEC-10, AC-DEC-11, AC-DEC-12.
- `purchase-history`: AC-HIST-01, AC-HIST-02, AC-HIST-03, AC-HIST-04, AC-HIST-05, AC-HIST-06, AC-HIST-07, AC-HIST-08,
  AC-HIST-09, AC-HIST-10, AC-HIST-11, AC-HIST-12, AC-HIST-13, AC-HIST-14.
- `english-interface`: AC-LANG-09.

PM відповіла на Q10–Q14 (ValiaBihun/2026-quitcode-dream-team#65 … #69) рекомендованими варіантами; рішення в `design.md`
більше не залежать від відкритих питань.
