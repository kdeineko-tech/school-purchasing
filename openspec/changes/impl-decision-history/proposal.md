# Пропозиція: план реалізації зрізу 3 (WS9)

## Why

Реалізуємо третій зріз за специфікацією в `openspec/specs/` після скорочення зрізу до 9 AC (зміна `trim-decision-history`,
PR «Специфікація» kdeineko-tech/school-purchasing#63): схвалювач частково схвалює чи повертає заявку з причиною, автор
виправляє й подає знову, кожна заявка має номер, суми й запис «Подано» в історії. Вимоги PM —
ValiaBihun/2026-quitcode-dream-team#63, #64, AC-LANG-09 у #49 (знімок 2026-11-06).

## What Changes

Зміна покриває AC з `openspec/specs/`:

- `revision-decisions`: AC-DEC-01, AC-DEC-04, AC-DEC-06, AC-DEC-07.
- `purchase-history`: AC-HIST-01, AC-HIST-02, AC-HIST-06, AC-HIST-10.
- `english-interface`: AC-LANG-09.

План на 27 AC (знімок 2026-11-02) переписано: прибрані PM 18 AC (AC-DEC-02, 03, 05, 08 … 12; AC-HIST-03 … 05, 07 … 09,
11 … 14) — поза зрізом; задача «Межі кількості й ціни» прибрана повністю. Відкритих питань немає: відповіді PM на
#65 … #69 і #73 … #75 — у `design.md`.
