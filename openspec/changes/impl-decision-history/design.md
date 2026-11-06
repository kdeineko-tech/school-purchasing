# Design: impl-decision-history

## Context

- Специфікація: `openspec/specs/revision-decisions/spec.md` (AC-DEC-01, AC-DEC-04, AC-DEC-06, AC-DEC-07),
  `openspec/specs/purchase-history/spec.md` (AC-HIST-01, AC-HIST-02, AC-HIST-06, AC-HIST-10),
  `openspec/specs/english-interface/spec.md` (AC-LANG-09).
- Знімок вимог PM 2026-11-06: зріз скорочено за часом (рішення PM 2026-11-05); відповіді PM — сума за всіма рядками
  (#65), автор поверненої заявки змінює поля рядків, додає й прибирає рядки без типу й відділу (#66), кожне подання —
  окремий запис «Подано» (#67), номер при повторному поданні той самий (#68), нумерація глобальна, наявним заявкам — за
  датою подання (#73), формат запису «Подано» (#74), AC-LANG-09 у WS9 — список і сторінка заявки (#75).
- Другий зріз дав: `purchases` (`status`: `awaiting_approval` / `approved` / `rejected`, `rejection_reason`,
  `decided_by`, `decided_at`), `purchase_lines` (`quantity integer`, `unit_price numeric(12,2)`), RLS
  `purchases_select_visible` (активний і автор / схвалює відділ / `admin`), функції `submit_purchase`,
  `decide_purchase`, `purchase_author_names` (`private` definer + `public` invoker; ADR 0003), `src/lib/purchases/*`,
  `PurchaseList`, `StatusBadge`, сторінки `/purchases`, `/purchases/new`, `/purchases/[id]`, `/approvals`.
- Стек шаблону: Next.js 16.4 App Router, Supabase (міграції лише через PR і `db-deploy`; у supabase-js немає транзакцій),
  Vitest (тести застосунку й тести бази на PGlite), Playwright UAT (`npm run uat`), авторизація — `getClaims()`.

## Goals / Non-Goals

**Goals:**

- Кожен AC з `proposal.md`: код + тест з AC ID у назві + сценарій UAT + рядок «реалізовано» в `docs/conformance.md`.
- Правила, які не можна обійти прямим запитом до Data API, — у базі: рішення лише схвалювачем відділу й не щодо власної
  заявки, повернення лише з причиною (AC-DEC-06), повторне подання лише власної поверненої заявки, номер не
  повторюється, історію бачать лише ті, хто бачить заявку (AC-HIST-10), записи історії не редагуються.
- Права з матриці `requirements/product.md`: «Бачити історію заявки» — заявник власних, схвалювач власних і свого
  відділу, `admin` усіх; «Редагувати заявку» й «Подавати знову повернену заявку» — лише власну; адміністратор вирішує
  лише у відділах, де його призначено схвалювачем.

**Non-Goals:**

- Прибрані PM AC: усі рядки відхилено (AC-DEC-03), окремі відмови зрізу 3 для колеги, заявника й гостя
  (AC-DEC-08 … AC-DEC-10), відхилена без редагування як окремий AC (AC-DEC-11), межі кількості й ціни
  (AC-HIST-03 … AC-HIST-05, AC-DEC-12), записи історії про рішення й повторне подання як AC
  (AC-HIST-07 … AC-HIST-09, AC-HIST-12, AC-HIST-13), номер після повторного подання як AC (AC-HIST-14), гість в історії
  (AC-HIST-11).
- Записи історії про схвалення, часткове схвалення, відхилення й повернення; підпис статусів в історії (#75).
- Замовлення, рішення адміністратора за відділ без схвалювача — версія 2; чернетки; верхні межі; ліміти сум.

## Decisions

Нові привілейовані дії — як в ADR 0003: функції бази `private` definer + `public` invoker. Нове рішення з альтернативами —
ADR 0005 «Історія заявки — записи функцій бази» (задача 2.1): запис пише та сама функція, що змінює заявку, в тій самій
транзакції; не тригери (не видно, хто діяв, коли функцію викликає `service_role`) і не застосунок (дві транзакції,
запис можна пропустити). У WS9 функції пишуть лише `submitted`; інші види — коли PM поверне записи про рішення.

## UI і компоненти

| Сторінка | Хто бачить | Що нового | Порожні стани й помилки (тексти — таблиця #49) | AC |
|---|---|---|---|---|
| `/purchases` («My requests») | усі, хто увійшов | колонка номера `PUR-…`; нові статуси текстом | — | AC-HIST-01, AC-LANG-09 |
| `/purchases/[id]` | автор, схвалювач відділу, `admin` | номер; сума кожного рядка й сума заявки; статус кожного рядка після рішення; причина повернення; блок «History» із записами «Submitted» | чужа заявка — «Not enough permissions» без даних і без історії | AC-DEC-01, AC-HIST-01, AC-HIST-02, AC-HIST-06, AC-HIST-10, AC-LANG-09 |
| `/purchases/[id]` — рішення (`canDecide`) | схвалювач відділу, не автор | позначка «Reject line» біля кожного рядка; «Approve»; «Reject» (причина); «Return for revision» (причина) | повернення без причини — «Provide a reason»; усі рядки позначено й «Approve» — «All lines are rejected: reject the whole request» (захист даних, без AC) | AC-DEC-01, AC-DEC-04, AC-DEC-06 |
| `/purchases/[id]/edit` | лише автор, лише статус «Returned for revision» | форма з рядками заявки (відділ і тип — лише для читання), «Submit» | обов'язкові поля, як при поданні; інший статус чи не автор — «Not enough permissions» | AC-DEC-07 |
| `/approvals`, головна | як у зрізі 2 | номер у рядку | — | AC-HIST-01 |

- Компоненти — лише з `@/components/ui` (DESIGN.md); статус заявки й рядка — `StatusBadge` з текстом (AC-LANG-09):
  «Partially approved», «Returned for revision»; статус рядка — «Approved» / «Rejected» / без позначки до рішення.
- Запис історії (#74): «Submitted · PM Demo Requester · 05.11.2026, 14:32» — підпис «Submitted» (таблиця #49), ім'я
  автора (без імені — email, як `purchase_author_names` і AC-APR-09), дата `dd.mm.yyyy` як у списках зрізу 2, час
  24-годинний за `America/New_York` без позначки поясу (`formatSubmittedAt` + час).
- Суми — у доларах США, у доменному модулі в цілих центах (`Math.round(quantity × price × 100)`), показ — два знаки:
  сума заявки — завжди за всіма рядками, зокрема для «Partially approved» (#65).
- Форма подання й форма редагування — один клієнтський компонент рядків (`useActionState`, керовані поля), різні server
  actions (`submitPurchase`, `resubmitPurchase`); перевірки повторного подання — ті самі `validateSubmission` і
  `MESSAGES`, що при першому поданні зрізу 2.
- Доменний модуль `src/lib/purchases/`: `formatNumber` (AC-HIST-01), `lineTotal`, `purchaseTotal` (AC-HIST-02),
  `formatHistoryEntry` (AC-HIST-06), `validateDecision` з поверненням і рядками (AC-DEC-06), `canEditReturned`
  (AC-DEC-07), `STATUS_LABELS` і `LINE_STATUS_LABELS` (AC-LANG-09). Нові тексти в `MESSAGES` — дослівно з таблиці #49;
  «Reject line», «Total» і «Line total» у таблиці немає — англійською, позначаємо в описі PR.

## Дані й RLS

**Зміни таблиць** (нові міграції; застосовані не змінюємо):

| Таблиця | Зміна | AC |
|---|---|---|
| `purchases` | `number integer unique not null` з послідовності `purchase_number_seq` (start 1); наявні заявки — номери `1…N` за `created_at`, `id` (#73), потім `setval` на найбільший номер (без заявок — `setval(…, 1, false)`); послідовність не відкочується, grant `delete` немає — номер не повторюється; статуси + `partially_approved`, `returned` — новий `purchases_status_check` (зняти старий → додати новий); `return_reason text` + `check`: повернена — лише з причиною | AC-HIST-01, AC-DEC-01, AC-DEC-04, AC-DEC-06 |
| `purchase_lines` | `status text not null default 'pending'` (`pending` / `approved` / `rejected`); рядкам наявних заявок — статус заявки (`approved` / `rejected`, інакше `pending`) | AC-DEC-01 |
| `purchase_events` (нова) | `id`, `purchase_id → purchases on delete cascade`, `kind` (`check`: лише `submitted` у WS9), `actor_id → profiles`, `created_at`; наявні заявки — запис `submitted` з `created_at` / `author_id` | AC-HIST-06, AC-HIST-10 |

**Права на кожну операцію** для `authenticated` (`anon` — нічого):

| Таблиця | select | insert | update | delete |
|---|---|---|---|---|
| `purchases` | без змін (`purchases_select_visible`) | немає grant — `submit_purchase` | немає grant — `decide_purchase`, `resubmit_purchase` | немає grant |
| `purchase_lines` | без змін (видима заявка) | немає grant — `submit_purchase`, `resubmit_purchase` | немає grant — `decide_purchase` (статус рядка) | немає grant — `resubmit_purchase` |
| `purchase_events` | `grant select`; політика: `exists` видимої заявки (та сама умова, що `purchases_select_visible`) — AC-HIST-10 | немає grant — лише функції | немає grant: записи не змінюються | немає grant |

**Функції** — `private.*` (`security definer`, `set search_path = ''`) + обгортка `public.*` (`security invoker`),
`grant execute` лише `authenticated`, `revoke … from public, anon`:

- `submit_purchase` (`create or replace`): номер із послідовності (AC-HIST-01), запис `submitted` (AC-HIST-06).
- `decide_purchase` (нова сигнатура, стару — `drop function`): `p_decision` — `approve` / `reject` / `return`,
  `p_rejected_lines uuid[]`; `for update`; першою — активний (`private.is_active_user()`), інакше `FORBIDDEN`; ті самі
  `FORBIDDEN` (не схвалювач відділу, зокрема `admin`, якого не призначено схвалювачем), `NOT_PENDING`, автор ≠
  переглядач; `approve` з відхиленими рядками → `partially_approved` і статуси рядків (AC-DEC-01); рядок не цієї заявки
  → `FORBIDDEN`; усі рядки відхилено → `ALL_LINES_REJECTED` без змін (захист даних: «частково схвалена» без жодного
  схваленого рядка — суперечність); `return` без причини → `REASON_REQUIRED` (AC-DEC-06); `return` → `returned`,
  `return_reason` (AC-DEC-04).
- `resubmit_purchase(p_purchase_id, p_lines jsonb)`: `for update`; першою — активний; лише автор і лише `returned`,
  інакше `FORBIDDEN`; ті самі перевірки рядків, що в `submit_purchase`; заміна рядків, статуси рядків — `pending`,
  статус — `awaiting_approval`; відділ, тип і номер не змінюються (AC-DEC-07, #68); ще один запис `submitted` (#67).
- `purchase_history(p_purchase_id)`: записи лише видимої заявки з іменем того, хто діяв (без імені — email), без інших
  даних профілю (AC-HIST-06, AC-HIST-10).

## Auth

- `src/proxy.ts` лише перевіряє сесію (`getClaims`) і перенаправляє на `/login`; захистом не є.
- Кожна сторінка — `getViewer()`: `getClaims()`, профіль і роль з `public.profiles`, деактивований — вихід.
  `/purchases/[id]/edit` додатково: автор і статус `returned`, інакше «Not enough permissions» без даних.
- Кожна Server Action (`submitPurchase`, `decidePurchase`, `resubmitPurchase`) — `getViewer()` першою, потім доменна
  перевірка з текстом PM, потім `rpc` клієнтом користувача (діють RLS, GRANT і перевірки функцій). Ідентифікаторам з
  форми не довіряємо: рядки для відхилення — лише рядки цієї заявки.
- Адміністратор вирішує лише у відділах, де його призначено схвалювачем, і тоді діє як цей схвалювач
  (ValiaBihun/2026-quitcode-dream-team#48, матриця прав); в інших — заявку бачить, рішення немає.
- Admin-клієнт і `SUPABASE_SECRET_KEY` не потрібні.

## Тести

- **Тести бази на PGlite** (`tests/db/*.test.ts`), справжня база з RLS, не моки: на кожну відмову — запит забороненої
  ролі й перевірка відмови **і** незмінних даних (`asService`):
  - AC-DEC-06 — повернення без причини: `REASON_REQUIRED`, статус «Очікує схвалення»;
  - AC-HIST-10 — Петро (не автор заявки) схвалює лише «Офіс»: історія заявки «Початкової школи» порожня, статус той самий;
    окремо — автор, який схвалює інший відділ, бачить власну історію (зауваження CodeRabbit у #63);
  - непризначений `admin`: `decide_purchase` для заявки відділу, де він не схвалювач, — `FORBIDDEN`, статус той самий,
    заявки немає в його списку для рішення (зауваження CodeRabbit у #62);
  - номер (AC-HIST-01): дві заявки поспіль — `PUR-1`, `PUR-2`; після перенесення N наявних — N + 1;
  - прямий `insert` / `update` / `delete` у `purchase_events` — `permission denied`.
- **Тести застосунку** (`tests/purchases/*.test.ts`): доменні функції (центи, формат запису, рішення), actions (код
  винятку → текст PM), сторінки. Сторінки, де важливий фільтр чи лічильник, — з `tests/support/viewer.ts` проти бази, а
  не з моками (правило рецензента AGENTS.md). Назви починаються з AC ID.
- **UAT** (`tests/e2e/*.spec.ts`, Playwright на проді): сценарій на кожен з 9 AC у форматі Given / When / Then; AC-HIST-01
  на проді — дві заявки поспіль мають `PUR-n` і `PUR-(n+1)` (#73); звіт `docs/qa/uat/<дата>/`.
- **Мутаційна перевірка** відмов: SQL-мутації (`npm run mutation:sql`) для AC-DEC-06 (`REASON_REQUIRED`), AC-HIST-10
  (політика `select` `purchase_events`) і непризначеного `admin`; Stryker для нових доменних функцій; кожна — саме її
  тест червоний; ≥1 червоний прогін CI мутацією нової міграції за зріз.

## Risks / Trade-offs

- Зміна сигнатури `decide_purchase`: між розгортанням Vercel і `db-deploy` прев'ю й прод можуть на хвилину отримати
  `PGRST202` — показати помилку рішення текстом, а не падінням сторінки.
- AC-HIST-01 на проді не перевірити з порожньою базою — «PUR-1» доводить тест бази, на проді — пара підряд (#73).
- `ALL_LINES_REJECTED` — захист даних без AC: якщо PM поверне AC-DEC-03 з іншим текстом, змінимо лише текст.
