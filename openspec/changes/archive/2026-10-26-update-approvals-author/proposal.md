# Пропозиція: автор заявки для схвалювача

## Why

PM відповіла на питання розробника Q9 (ValiaBihun/2026-quitcode-dream-team#62) і змінила вимоги. Знімок вимог від
2026-10-26 (шапка `docs/conformance.md`, PR «Оновлення вимог» kdeineko-tech/school-purchasing#35):

- `requirements/48-skhvaliuvach-vyrishuie-lyshe.md` — ValiaBihun/2026-quitcode-dream-team#48: нові AC-APR-08, AC-APR-09,
  AC-APR-10; у ролях і основному сценарії схвалювач бачить заявки «з іменем автора кожної»; нове припущення про
  видимість імені;
- `requirements/49-interfeis-zastosunku-anhliiskoiu.md` — ValiaBihun/2026-quitcode-dream-team#49: у таблицю додано
  підпис «Автор» / «Author»;
- `requirements/product.md` — ValiaBihun/2026-quitcode-dream-team#1: у матриці прав рядок «Бачити ім'я автора заявки»,
  у глосарії уточнено «Автор заявки».

## What Changes

- ADDED AC-APR-08: схвалювач відділу бачить ім'я автора заявки і в списку для рішення, і на сторінці заявки.
- ADDED AC-APR-09: якщо імені в профілі автора немає, замість нього показано email автора.
- ADDED AC-APR-10: ролі, відділів і дозволів автора схвалювач у списку й на сторінці заявки не бачить.

Усі три — одна нова вимога «Автор заявки для схвалювача» в `approval-decisions`. Наявні AC не змінюються: підпис
«Author» — новий рядок таблиці ValiaBihun/2026-quitcode-dream-team#49, яку вже покриває вимога «Написи інтерфейсу
англійською» (AC-LANG-01).

## Capabilities

### New Capabilities

—

### Modified Capabilities

- `approval-decisions`: AC-APR-08, AC-APR-09, AC-APR-10 (ADDED).

## Users & roles

За матрицею прав `requirements/product.md`, рядок «Бачити ім'я автора заявки»: заявник — лише своє; схвалювач — автора
заявок свого відділу (email, якщо імені немає); адміністратор — так. Схвалювач іншого відділу й заявник, який не автор,
не бачать ні заявки, ні імені (ValiaBihun/2026-quitcode-dream-team#62).

## Non-goals

- Інші дані профілю автора (роль, відділи, дозволи) — схвалювач їх не бачить (AC-APR-10).
- Решта рішень по закупівлі (часткове схвалення, повернення на доопрацювання) — WS8
  (ValiaBihun/2026-quitcode-dream-team#48, «Поза межами»).

## Assumptions

- Ім'я автора бачать автор своєї заявки й схвалювачі її відділу; якщо імені в профілі немає, замість нього показано
  email; інших даних профілю автора схвалювач не отримує (ValiaBihun/2026-quitcode-dream-team#48, «Припущення»;
  відповідь на ValiaBihun/2026-quitcode-dream-team#62).
- Підпис — «Author» з таблиці ValiaBihun/2026-quitcode-dream-team#49.

## Open questions

Немає: PM відповіла на Q9 (ValiaBihun/2026-quitcode-dream-team#62), відповідь і рішення — у `docs/spec-reading.md`.
