# Design: impl-decision-history

## Context

- Специфікація: `openspec/specs/revision-decisions/spec.md` (AC-DEC-01 … AC-DEC-12), `openspec/specs/purchase-history/spec.md`
  (AC-HIST-01 … AC-HIST-14), `openspec/specs/english-interface/spec.md` (AC-LANG-09).
- Знімок вимог PM 2026-11-02 після відповідей на Q10–Q14 (ValiaBihun/2026-quitcode-dream-team#63, #64, #49; питання
  #65 … #69): PM обрала рекомендовані варіанти — сума за всіма рядками, редагування полів і рядків без типу й відділу з
  тими самими межами, окремі записи «Частково схвалено» й повторного «Подано», номер той самий (AC-DEC-12,
  AC-HIST-12 … AC-HIST-14).
- Другий зріз дав: `purchases` (`status`: `awaiting_approval` / `approved` / `rejected`, `rejection_reason`,
  `decided_by`, `decided_at`), `purchase_lines` (`quantity integer`, `unit_price numeric(12,2)`), RLS
  `purchases_select_visible` (активний і автор / схвалює відділ / `admin`), функції `submit_purchase`,
  `decide_purchase`, `purchase_author_names` (`private` definer + `public` invoker; ADR 0003), `src/lib/purchases/*`,
  `PurchaseList`, `StatusBadge`, сторінки `/purchases`, `/purchases/new`, `/purchases/[id]`, `/approvals`.
- Стек шаблону: Next.js 16.4 App Router, Supabase (міграції лише через PR і `db-deploy`; у supabase-js немає транзакцій),
  Vitest (тести застосунку й тести бази на PGlite), авторизація — `getClaims()`.

## Goals / Non-Goals

**Goals:**

- Кожен AC з `proposal.md`: код + тест з AC ID у назві + рядок «реалізовано» в `docs/conformance.md`.
- Правила, які не можна обійти прямим запитом до Data API, — у базі: межі кількості й ціни, рішення лише схвалювачем
  відділу й не щодо власної заявки, повернення лише з причиною, редагування й повторне подання лише власної поверненої
  заявки, номер не повторюється, історію не редагують (AC-HIST-03 … AC-HIST-05, AC-DEC-03, AC-DEC-06, AC-DEC-09, AC-DEC-11).
- Права з матриці `requirements/product.md`: «Бачити історію заявки» — заявник власних, схвалювач власних і свого
  відділу, `admin` усіх; «Редагувати заявку» й «Подавати знову повернену заявку» — лише власну.

**Non-Goals:**

- Замовлення, обробка, рішення адміністратора за відділ без схвалювача — версія 2.
- Одночасні рішення двох схвалювачів, кілька схвалювачів по черзі; скасування, чернетки, копіювання.
- Причина при відхиленні окремого рядка; верхні межі кількості й ціни; ліміти сум.

## Decisions

Рішення згруповано за розділами «UI і компоненти», «Дані й RLS», «Auth»; далі — тести. Нові привілейовані дії — як в
ADR 0003: функції бази `private` definer + `public` invoker. Нове рішення з альтернативами — ADR 0005 «Історія заявки —
записи функцій бази» (задача 3.1; AC-HIST-06 … AC-HIST-09): записи пишуть лише ті самі функції, що змінюють заявку, в тій самій транзакції; не
тригери (не видно, хто діяв, коли функцію викликає `service_role`) і не застосунок (дві транзакції, запис можна
пропустити).

## UI і компоненти

| Сторінка | Хто бачить | Що нового | Порожні стани й помилки (тексти — таблиця #49) | AC |
|---|---|---|---|---|
| `/purchases` («My requests») | усі, хто увійшов | колонка номера `PUR-…`; нові статуси | — | AC-HIST-01, AC-LANG-09 |
| `/purchases/new` | усі, хто увійшов | межі рядка у формі; введене лишається | «Quantity: a whole number from 1», «Price: a number from 0» | AC-HIST-03 … AC-HIST-05 |
| `/purchases/[id]` | автор, схвалювач відділу, `admin` | номер; сума кожного рядка й сума заявки; статус кожного рядка після рішення; причина повернення; блок «History» | чужа заявка — «Not enough permissions» без даних і без історії | AC-DEC-02, AC-DEC-05, AC-DEC-08, AC-DEC-11, AC-HIST-01, AC-HIST-02, AC-HIST-06 … AC-HIST-10, AC-LANG-09 |
| `/purchases/[id]` — рішення (`canDecide`) | схвалювач відділу, не автор | позначка «Reject line» біля кожного рядка; «Approve»; «Reject» (діалог, причина); «Return for revision» (причина) | усі рядки позначено й «Approve» — «All lines are rejected: reject the whole request»; повернення без причини — «Provide a reason» | AC-DEC-01, AC-DEC-03, AC-DEC-04, AC-DEC-06 |
| `/purchases/[id]/edit` | лише автор, лише статус «Returned for revision» | форма з рядками заявки (відділ і тип — лише для читання), «Submit» | обов'язкові поля, як при поданні; межі кількості й ціни ті самі, що при поданні, з тими самими повідомленнями (Q11, #66); інший статус чи не автор — «Not enough permissions» | AC-DEC-05, AC-DEC-07, AC-DEC-11, AC-DEC-12 |
| `/approvals`, головна | як у зрізі 2 | номер у рядку; нові статуси | — | AC-HIST-01, AC-LANG-09 |

- Компоненти — лише з `@/components/ui` (DESIGN.md); статус заявки й рядка — `StatusBadge` з текстом (AC-LANG-09):
  «Partially approved», «Returned for revision»; статус рядка — «Approved» / «Rejected» / без позначки до рішення.
- Підписи історії — «Submitted», «Approved», «Partially approved», «Rejected», «Returned for revision» (таблиця #49), ім'я — як у зрізі 2
  (ім'я, без імені — email), дата й час — `America/New_York` (`formatSubmittedAt`).
- Суми — у доларах США, у доменному модулі в цілих центах (`Math.round(quantity × price × 100)`), показ — два знаки
  (вимога «Суми рядків і заявки»): сума заявки — завжди за всіма рядками, зокрема для «Partially approved»; відхилені
  рядки лише позначено (Q10, #65).
- Форма подання й форма редагування — один клієнтський компонент рядків (`useActionState`, керовані поля), різні
  server actions (`submitPurchase`, `resubmitPurchase`).
- У формі редагування можна змінити поля рядків, додати й видалити рядок; відділ і тип — лише для читання (Q11, #66;
  AC-DEC-07: «відділ той самий»); межі й повідомлення — ті самі `validateSubmission` і `MESSAGES`, що при поданні
  (AC-DEC-12).
- Доменний модуль `src/lib/purchases/`: `formatNumber` (AC-HIST-01), `lineTotal`, `purchaseTotal` (AC-HIST-02),
  `validateSubmission` з межами (AC-HIST-03 … AC-HIST-05), `validateDecision` з поверненням і рядками (AC-DEC-03, AC-DEC-06),
  `canEditReturned` (AC-DEC-05, AC-DEC-11), `STATUS_LABELS` і `LINE_STATUS_LABELS` (AC-LANG-09), `HISTORY_LABELS` (AC-HIST-06 … AC-HIST-09, AC-HIST-12, AC-HIST-13).
- Нові повідомлення в `MESSAGES` — дослівно з таблиці #49.

## Дані й RLS

**Зміни таблиць** (нові міграції; застосовані не змінюємо):

| Таблиця | Зміна | AC |
|---|---|---|
| `purchases` | `number integer unique not null` з послідовності `purchase_number_seq` (start 1); наявні заявки — номери `1…N` за порядком `created_at`, `id` (рішення плану: перенесення наявних даних, а не правило специфікації; AC-HIST-01 описує порожню систему), після чого `setval` переводить послідовність на найбільший номер (без заявок — `setval(…, 1, false)`), тож перше нове подання отримує N + 1, а не зайнятий номер; послідовність не відкочується, а grant `delete` на `purchases` немає — номер не повторюється навіть після видалення (вимога «Номер заявки»); статуси + `partially_approved`, `returned` — новий `purchases_status_check` (зняти старий → додати новий); `return_reason text` + `check`: повернена — лише з причиною | AC-HIST-01, AC-DEC-01, AC-DEC-04, AC-DEC-06 |
| `purchase_lines` | `status text not null default 'pending'` (`pending` / `approved` / `rejected`); рядкам наявних заявок — статус заявки: `approved` для схвалених, `rejected` для відхилених, інакше `pending`; `check` `quantity >= 1` і `unit_price >= 0` як `not valid` — нові й змінені рядки перевіряються, старі тестові дані міграцію не ламають | AC-DEC-01, AC-DEC-02, AC-HIST-03 … AC-HIST-05 |
| `purchase_events` (нова) | `id`, `purchase_id → purchases on delete cascade`, `kind` (`submitted` / `approved` / `partially_approved` / `rejected` / `returned`), `actor_id → profiles`, `reason`, `created_at`; наявні заявки — записи з `created_at` / `author_id` і з `decided_at` / `decided_by` | AC-HIST-06 … AC-HIST-09 |

`kind` має `partially_approved`, а повторне подання — ще один `submitted` (Q12, #67; AC-HIST-12, AC-HIST-13). Номер
видається один раз при першому поданні; повторне подання номер не змінює (Q13, #68; AC-HIST-14).

Кількість — уже `integer`, тож «2.5» відхиляє приведення типу: функції повертають `QUANTITY_RANGE` (а не загальний
`INVALID_LINE`), щоб сторінка показала текст PM (AC-HIST-04).

**Права на кожну операцію** для `authenticated` (`anon` — нічого):

| Таблиця | select | insert | update | delete |
|---|---|---|---|---|
| `purchases` | без змін (`purchases_select_visible`) | немає grant — `submit_purchase` | немає grant — `decide_purchase`, `resubmit_purchase` | немає grant |
| `purchase_lines` | без змін (видима заявка) | немає grant — `submit_purchase`, `resubmit_purchase` | немає grant — `decide_purchase` (статус рядка) | немає grant — `resubmit_purchase` |
| `purchase_events` | `grant select`; політика: `exists` видимої заявки (та сама умова, що й `purchases_select_visible`) — AC-HIST-10, AC-HIST-11 | немає grant — лише функції | немає grant: наявні записи історії не змінюються (вимога «Історія подання й рішень») | немає grant |

Column grants не потрібні: на `update` у `authenticated` grant немає взагалі.

**Функції** — `private.*` (`security definer`, `set search_path = ''`) + обгортка `public.*` (`security invoker`),
`grant execute` лише `authenticated`, `revoke … from public, anon`:

- `submit_purchase` (`create or replace`): + межі рядка (`QUANTITY_RANGE`, `PRICE_RANGE`; AC-HIST-03 … AC-HIST-05), номер
  із послідовності (AC-HIST-01), запис `submitted` в історії (AC-HIST-06).
- `decide_purchase` (нова сигнатура, стару — `drop function`): `p_decision` — `approve` / `reject` / `return`,
  `p_rejected_lines uuid[]`; `for update`; першою — активний (`private.is_active_user()`), інакше `FORBIDDEN`; ті самі `FORBIDDEN`, `NOT_PENDING`, автор ≠ переглядач; `approve` з
  відхиленими рядками → `partially_approved` і статуси рядків; усі рядки відхилено → `ALL_LINES_REJECTED`, без змін
  (AC-DEC-03); `return` без причини → `REASON_REQUIRED` (AC-DEC-06); `return` → `returned`, `return_reason` (AC-DEC-04);
  запис в історії з `decided_by` і причиною (AC-HIST-07 … AC-HIST-09). Заявник без права — `FORBIDDEN` (AC-DEC-09).
- `resubmit_purchase(p_purchase_id, p_lines jsonb)`: `for update`; першою — активний (`private.is_active_user()`, як у
  `submit_purchase` і `decide_purchase`: функцію можна викликати напряму, минаючи `getViewer()`); лише автор і лише
  `returned`, інакше `FORBIDDEN`
  (AC-DEC-08, AC-DEC-11); обов'язкові поля рядків і ті самі межі кількості й ціни, що в `submit_purchase` (`QUANTITY_RANGE`, `PRICE_RANGE` —
  AC-DEC-12; при відмові статус лишається `returned`); заміна рядків, статуси рядків — `pending`, статус заявки —
  `awaiting_approval`, відділ, тип і номер не змінюються (AC-DEC-07, AC-HIST-14); ще один запис `submitted` в історії
  (AC-HIST-13).
- `purchase_history(p_purchase_id)`: записи лише видимої заявки (умова `purchases_select_visible`) з іменем того, хто
  діяв (без імені — email, як `purchase_author_names`), без інших даних профілю (AC-HIST-06 … AC-HIST-10).

Набір ролей не змінюється (drop-first не потрібен). Порядок у міграції зі статусами: зняти `purchases_status_check` →
додати колонки → новий `purchases_status_check`.

## Auth

- `src/proxy.ts` лише перевіряє сесію (`getClaims`) і перенаправляє на `/login` (AC-HIST-11, AC-DEC-10); захистом не є.
- Кожна сторінка — `getViewer()`: `getClaims()`, профіль і роль з `public.profiles`, деактивований — вихід через
  `/auth/signed-out` (AC-ORG-12). `/purchases/[id]/edit` додатково: автор і статус `returned`, інакше «Not enough
  permissions» без даних.
- Кожна Server Action (`submitPurchase`, `decidePurchase`, `resubmitPurchase`) — `getViewer()` першою, потім доменна
  перевірка з текстом PM, потім `rpc` клієнтом користувача (діють RLS, GRANT і перевірки функцій). Ідентифікаторам з
  форми не довіряємо: рядки для відхилення — лише рядки цієї заявки (функція перевіряє `purchase_id`).
- Рішення приймає лише схвалювач відділу заявки, не автор — як у зрізі 2. Адміністратор вирішує тільки у відділах, які сам
  схвалює: «рішення адміністратора за відділ без схвалювача лишається у версії 2 продукту»
  (ValiaBihun/2026-quitcode-dream-team#63, «Користувачі й ролі» і «Поза межами»; примітка до матриці прав
  `requirements/product.md`); окремих AC для адміністратора в зрізі немає.
- Admin-клієнт і `SUPABASE_SECRET_KEY` не потрібні.

## Тести

- **Тести бази на PGlite** (`tests/db/*.test.ts`): на кожен відмовний AC — запит від забороненої ролі, чужого
  користувача чи гостя й перевірка відмови **і** незмінних даних (`asService`): AC-DEC-03, AC-DEC-06, AC-DEC-08, AC-DEC-09, AC-DEC-10, AC-DEC-11, AC-HIST-03, AC-HIST-04, AC-HIST-05, AC-HIST-10, AC-HIST-11; плюс номер (AC-HIST-01), суми не в базі, історія (AC-HIST-06 … AC-HIST-09).
- **Тести застосунку** (`tests/purchases/*.test.ts`): доменні функції (суми в центах, межі, рішення), actions з
  підставним Supabase (код винятку → текст PM), сторінки (номер, суми, статуси рядків, історія, «Edit» лише для
  поверненої). Назви починаються з AC ID.
- **Мутаційна перевірка** на кожен відмовний AC задачі: тимчасово послабити перевірку в тестовій копії міграції →
  саме цей тест червоний → повернути; таблиця в описі PR; ≥2 червоні прогони CI за зріз мутацією нової міграції.
- Ручна перевірка на проді демо-користувачами перед записом екрана.

## Risks / Trade-offs

- Q10–Q14 (#65 … #69) закрито рекомендованими варіантами; порядок задач лишається: 4 і 5 — найбільші, тож останні.
- `not valid` для меж рядка: старі тестові рядки з від'ємною ціною лишаються, але нові й змінені перевіряються; на
  проді — лише синтетичні дані.
- Підписи «Reject line», «Total» і «Line total» у таблиці #49 відсутні — додаємо англійською й позначаємо в описі PR;
  «Line» є в таблиці.
- Зміна сигнатури `decide_purchase`: прев'ю й прод між розгортанням Vercel і `db-deploy` можуть на хвилину отримати
  `PGRST202` — запасний варіант, як для `purchase_author_names`: показати помилку рішення текстом, а не падінням сторінки.
