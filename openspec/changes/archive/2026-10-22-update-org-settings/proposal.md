# Пропозиція: уточнення зрізу WS6 після відповідей PM

## Why

PM відповіла на питання розробника Q1–Q4 (ValiaBihun/2026-quitcode-dream-team#42 … #45) і змінила вимоги. Знімок вимог
від 2026-10-22 після відповідей (шапка `docs/conformance.md`, PR «Оновлення вимог» з гілки `sync/2026-10-22-2`):

- `requirements/39-administrator-deaktyvuie-pratsivnykiv.md` — ValiaBihun/2026-quitcode-dream-team#39: змінено AC-ORG-12,
  прибрано AC-ORG-13, нові припущення;
- `requirements/40-administrator-vydaie-dozvoly.md` — ValiaBihun/2026-quitcode-dream-team#40: журнал змін (тип закупівлі);
- `requirements/product.md` — ValiaBihun/2026-quitcode-dream-team#1: у глосарій додано «Тип закупівлі».

## What Changes

- MODIFIED AC-ORG-12: дано активний працівник; після деактивації він не може увійти й бачить повідомлення «Обліковий
  запис деактивовано. Зверніться до адміністратора» (відповідь PM на Q2 і Q4 — ValiaBihun/2026-quitcode-dream-team#43,
  ValiaBihun/2026-quitcode-dream-team#45).
- REMOVED AC-ORG-13: видалення чернетки деактивованого працівника переходить у WS7, бо заявок і чернеток у зрізі WS6 немає
  (рішення PM на Q2 — ValiaBihun/2026-quitcode-dream-team#43).
- Тексти AC-ORG-23, AC-ORG-27 і AC-ORG-28 PM не змінювала; уточнення до них — у «Припущеннях» нижче.

## Capabilities

### New Capabilities

—

### Modified Capabilities

- `staff-lifecycle`: AC-ORG-12 (MODIFIED), AC-ORG-13 (REMOVED).

## Users & roles

Без змін відносно `add-org-settings`: деактивує й знову активує працівників лише адміністратор (`admin`); заявник
(`requester`) і схвалювач (`approver`) цих дій не виконують (ValiaBihun/2026-quitcode-dream-team#39, «Користувачі й ролі»).

## Non-goals

- Видалення чернеток деактивованого працівника й частина AC-ORG-12 про подані заявки — WS7 (ValiaBihun/2026-quitcode-dream-team#43).
- Створення, збереження й подання заявок — наступний зріз.

## Assumptions

- Повідомлення при вході деактивованого працівника показує сторінка входу застосунку («Припущення» вимоги
  ValiaBihun/2026-quitcode-dream-team#39).
- Список особи «від імені» у заглушці форми містить лише заявників обраного відділу, без автора й без деактивованих
  працівників («Припущення» вимоги ValiaBihun/2026-quitcode-dream-team#39; відповідь PM на Q1 —
  ValiaBihun/2026-quitcode-dream-team#42).
- Типів закупівлі рівно два: «Відділ закупівель» (купує відділ закупівель) і «Самостійна закупівля» (купує сам
  працівник); у назві типу «Відділ закупівель» — не роль `admin` (глосарій `requirements/product.md`; відповідь PM на Q3 —
  ValiaBihun/2026-quitcode-dream-team#44).

## Open questions

Немає: PM відповіла на Q1–Q4 (ValiaBihun/2026-quitcode-dream-team#42 … #45), відповіді й рішення — у `docs/spec-reading.md`.
