# Пропозиція: уточнення зрізу WS7 після відповідей PM

## Why

PM відповіла на питання розробника Q5–Q8 (ValiaBihun/2026-quitcode-dream-team#57 … #60) і на питання іншого розробника
ValiaBihun/2026-quitcode-dream-team#61 та змінила вимоги. Знімок вимог від 2026-10-25 після відповідей (шапка
`docs/conformance.md`, PR «Оновлення вимог» kdeineko-tech/school-purchasing#21):

- `requirements/47-pratsivnyk-podaie-zakupivliu.md` — ValiaBihun/2026-quitcode-dream-team#47: нові AC-FRM-14, AC-FRM-15,
  припущення про поля рядка;
- `requirements/48-skhvaliuvach-vyrishuie-lyshe.md` — ValiaBihun/2026-quitcode-dream-team#48: змінено AC-APR-07, нові
  припущення про видимість причини й власну заявку схвалювача;
- `requirements/49-interfeis-zastosunku-anhliiskoiu.md` — ValiaBihun/2026-quitcode-dream-team#49: змінено AC-LANG-03,
  AC-LANG-05, AC-LANG-08, прибрано AC-LANG-07, у таблицю додано два тексти;
- `requirements/product.md` — ValiaBihun/2026-quitcode-dream-team#1: у Roadmap WS7 — 29 AC.

## What Changes

- ADDED AC-FRM-14: працівник без поданих заявок бачить на «Мої заявки» повідомлення «Ви ще не подали жодної заявки»
  замість списку (відповідь PM на Q6 — ValiaBihun/2026-quitcode-dream-team#58).
- ADDED AC-FRM-15: рядок лише з назвою, без мети, кількості й ціни — закупівлю не подано, повідомлення «Заповніть усі
  поля рядка» (відповідь PM на Q8 — ValiaBihun/2026-quitcode-dream-team#60).
- MODIFIED AC-APR-07: причину відхилення не лише збережено, а й показано на сторінці заявки поруч зі статусом
  «Відхилено» (відповідь PM на Q7 — ValiaBihun/2026-quitcode-dream-team#59).
- MODIFIED AC-LANG-03: без випадку «власна заявка схвалювача» (ValiaBihun/2026-quitcode-dream-team#61).
- MODIFIED AC-LANG-05: лише відхилення без причини, без повернення на доопрацювання (Q5 —
  ValiaBihun/2026-quitcode-dream-team#57).
- MODIFIED AC-LANG-08 і RENAMED вимога «Ідентифікатори ролей і номери без змін» → «Ідентифікатори ролей без змін»: лише
  ролі, без номерів `PUR-…` (Q5 — ValiaBihun/2026-quitcode-dream-team#57).
- REMOVED AC-LANG-07: мовні правила історії рішень — у «Поза межами» до зрізу з історією й номерами; ID не
  використовувати повторно (Q5 — ValiaBihun/2026-quitcode-dream-team#57).

Назви сценаріїв AC-LANG-05 («Рішення без причини англійською») і AC-LANG-08 («Ролі й номери») лишаються колишніми:
OpenSpec у MODIFIED не перейменовує сценарії; змінився їхній текст.

## Capabilities

### New Capabilities

—

### Modified Capabilities

- `purchase-form`: AC-FRM-14, AC-FRM-15 (ADDED).
- `approval-decisions`: AC-APR-07 (MODIFIED).
- `english-interface`: AC-LANG-03, AC-LANG-05, AC-LANG-08 (MODIFIED), AC-LANG-07 (REMOVED).

## Users & roles

Без змін відносно `add-purchase-flow` (матриця прав `requirements/product.md`): «Мої заявки» — лише власні заявки
працівника; причину відхилення бачать ті, хто бачить заявку, — автор і схвалювачі відділу
(ValiaBihun/2026-quitcode-dream-team#48, «Припущення»).

## Non-goals

- Межі значень рядка (ціла кількість від 1, ціна від 0) — наступний зріз (ValiaBihun/2026-quitcode-dream-team#47,
  «Припущення»).
- Мовні правила історії рішень і номерів `PUR-…`, повернення на доопрацювання — зріз з історією й номерами, WS8
  (ValiaBihun/2026-quitcode-dream-team#49, «Поза межами»).

## Assumptions

- Усі чотири поля рядка (назва, мета, кількість, ціна) обов'язкові; межі значень — наступний зріз
  (ValiaBihun/2026-quitcode-dream-team#47; відповідь на ValiaBihun/2026-quitcode-dream-team#60).
- Причину відхилення бачать автор і схвалювачі відділу (ValiaBihun/2026-quitcode-dream-team#48; відповідь на
  ValiaBihun/2026-quitcode-dream-team#59).
- Власної заявки в списку для рішення немає, кнопок рішення для неї схвалювач не бачить, а прямий запит не змінює
  статус; тексту на екрані немає (ValiaBihun/2026-quitcode-dream-team#48; відповідь на
  ValiaBihun/2026-quitcode-dream-team#61).
- Англійські тексти нових повідомлень — з таблиці ValiaBihun/2026-quitcode-dream-team#49: «Fill in all line fields»,
  «You have not submitted any requests yet».
- (розробник) AC-LANG-06 «статус … у списку, на сторінці заявки або в історії»: історії у WS7 немає, тож правило діє
  там, де статус показано, — у «Мої заявки», списку для рішення й на сторінці заявки (без нової поведінки).

## Open questions

Немає: PM відповіла на Q5–Q8 (ValiaBihun/2026-quitcode-dream-team#57 … #60), відповіді й рішення — у
`docs/spec-reading.md`. Відкрите питання PM «Що буде, коли працівник двічі поспіль подає ту саму закупівлю» — «не в
цьому зрізі» (ValiaBihun/2026-quitcode-dream-team#47).
