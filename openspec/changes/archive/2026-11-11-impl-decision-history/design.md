# Design: impl-decision-history

## Context

- Специфікація: `openspec/specs/revision-decisions/spec.md` (AC-DEC-01, AC-DEC-04, AC-DEC-06, AC-DEC-07),
  `openspec/specs/purchase-history/spec.md` (AC-HIST-01, AC-HIST-02, AC-HIST-06, AC-HIST-10),
  `openspec/specs/english-interface/spec.md` (AC-LANG-09).
- Знімок вимог PM 2026-11-06: зріз скорочено за часом (рішення PM 2026-11-05); відповіді PM — сума за всіма рядками
  (#65), автор поверненої заявки змінює поля рядків, додає й прибирає рядки без типу й відділу (#66), кожне подання,
  зокрема повторне, — окремий запис «Подано» (#67; запис про часткове схвалення з тієї ж відповіді — після WS9, «Поза
  межами» #64), номер при повторному поданні той самий (#68), нумерація глобальна, наявним заявкам — за датою подання
  (#73), формат запису «Подано» (#74), AC-LANG-09 у WS9 — список і сторінка заявки (#75).
- Другий зріз дав: `purchases` (`status`: `awaiting_approval` / `approved` / `rejected`, `rejection_reason`,
  `decided_by`, `decided_at`), `purchase_lines` (`quantity integer`, `unit_price numeric(12,2)`,
  `unique (purchase_id, position)`), RLS `purchases_select_visible` (активний і автор / схвалює відділ / `admin`),
  функції `submit_purchase`, `decide_purchase`, `purchase_author_names` (`private` definer + `public` invoker; ADR 0003),
  `src/lib/purchases/*`, `PurchaseList`, `StatusBadge`, сторінки `/purchases`, `/purchases/new`, `/purchases/[id]`,
  `/approvals`; SQL-мутанти A1, A2, F1 у `scripts/mutants.mjs`; UAT з прибиранням (`tests/e2e/support/admin.ts`,
  `cleanup.teardown.ts`).
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

- Поведінка, прибрана PM зі зрізу 3 (рішення PM 2026-11-05): усі рядки відхилено, окремі відмови для колеги, заявника
  й гостя, відхилена заявка без редагування, межі кількості й ціни (зокрема при повторному поданні), записи історії про
  рішення, окремі сценарії для запису й номера при повторному поданні (сам запис `submitted` при повторному поданні
  пишемо за #67 і номер не змінюємо за #68, але окремими AC не перевіряємо), гість в історії.
- Підпис статусів в історії (#75).
- Замовлення, рішення адміністратора за відділ без схвалювача — версія 2; чернетки; верхні межі; ліміти сум.

## Decisions

Нові привілейовані дії — як в ADR 0003: функції бази `private` definer + `public` invoker. Нове рішення з альтернативами —
ADR 0005 «Історія заявки — записи функцій бази» (задача 2.1; AC-HIST-06): запис пише та сама функція, що змінює заявку,
в тій самій транзакції; не тригери (не видно, хто діяв, коли функцію викликає `service_role`) і не застосунок (дві
транзакції, запис можна пропустити). У WS9 функції пишуть лише `submitted`; інші види — коли PM поверне записи про
рішення.

## UI і компоненти

| Сторінка | Хто бачить | Що нового | Порожні стани й помилки (тексти — таблиця #49) | AC |
|---|---|---|---|---|
| `/purchases` («My requests») | усі, хто увійшов | колонка номера `PUR-…`; нові статуси текстом | — | AC-HIST-01, AC-LANG-09 |
| `/purchases/[id]` | автор, схвалювач відділу, `admin` | номер; сума кожного рядка й сума заявки; статус кожного рядка після рішення; причина повернення; блок «History» із записами «Submitted»; для автора зі статусом «Returned for revision» — кнопка «Edit» на `/purchases/[id]/edit`, іншим — немає | чужа заявка — «Not enough permissions» без даних і без історії | AC-DEC-01, AC-DEC-07, AC-HIST-01, AC-HIST-02, AC-HIST-06, AC-HIST-10, AC-LANG-09 |
| `/purchases/[id]` — рішення (`canDecide`) | схвалювач відділу, не автор | позначка «Reject line» біля кожного рядка; «Approve»; «Reject» (причина); «Return for revision» (причина) | повернення без причини — «Provide a reason»; усі рядки позначено й «Approve» — «All lines are rejected: reject the whole request» (захист даних, без AC) | AC-DEC-01, AC-DEC-04, AC-DEC-06 |
| `/purchases/[id]/edit` | лише автор, лише статус «Returned for revision» | форма з рядками заявки (відділ і тип — лише для читання), «Submit» | обов'язкові поля, як при поданні; інший статус чи не автор — «Not enough permissions» | AC-DEC-07 |
| `/approvals`, головна | як у зрізі 2 | номер у рядку | — | AC-HIST-01 |

- Компоненти — лише з `@/components/ui` (DESIGN.md); статус заявки й рядка — `StatusBadge` з текстом (AC-LANG-09):
  «Partially approved», «Returned for revision»; статус рядка — «Approved» / «Rejected» / без позначки до рішення.
- Запис історії (AC-HIST-06, #74): «Submitted · PM Demo Requester · 05.11.2026, 14:32» — підпис «Submitted» (таблиця
  #49), ім'я автора (без імені — email, як `purchase_author_names` і AC-APR-09), дата `dd.mm.yyyy` як у списках
  зрізу 2, час 24-годинний за `America/New_York` без позначки поясу (`formatSubmittedAt` + час).
- Суми — у доларах США, у доменному модулі в цілих центах (`Math.round(quantity × price × 100)`), показ — два знаки:
  сума заявки — завжди за всіма рядками, зокрема для «Partially approved» (#65).
- Форма подання й форма редагування — один клієнтський компонент рядків (`useActionState`, керовані поля), різні server
  actions (`submitPurchase`, `resubmitPurchase`); перевірки повторного подання — ті самі `validateSubmission` і
  `MESSAGES`, що при першому поданні зрізу 2 (AC-DEC-07).
- Доменний модуль `src/lib/purchases/`: `formatNumber` (AC-HIST-01), `lineTotal`, `purchaseTotal` (AC-HIST-02),
  `formatHistoryEntry` (AC-HIST-06), `validateDecision` з поверненням і рядками (AC-DEC-06), `canEditReturned`
  (AC-DEC-07), `STATUS_LABELS` і `LINE_STATUS_LABELS` (AC-LANG-09). Нові тексти в `MESSAGES` — дослівно з таблиці #49.
  Немає в таблиці #49 — «Reject line», «Total», «Line total» і наявний зі зрізу 2 підпис причини «Reason» (тепер і для
  причини повернення): англійською, позначаємо в описі PR кожної задачі.

## Дані й RLS

**Зміни таблиць** (нові міграції; застосовані не змінюємо). Supabase за замовчуванням дає новим таблицям у `public`
усі права для `anon` і `authenticated`, тож кожна нова таблиця — `enable row level security`, явний
`revoke all … from anon, authenticated` і явні `grant` (як `purchases.sql`); PGlite цих типових прав не емулює, тому
тест прав — через `has_table_privilege`.

| Таблиця | Зміна | AC |
|---|---|---|
| `private.purchase_counter` (нова, схема `private` — поза Data API) | `id boolean primary key default true check (id)` — один рядок, `last_number integer not null`; `enable row level security`, `revoke all … from public, anon, authenticated`; `submit_purchase` робить `update … set last_number = last_number + 1 returning` — рядок заблоковано до кінця транзакції, одночасні подання йдуть по черзі, а відкат подання повертає й лічильник (без пропусків; послідовність Postgres не відкочується й дала б пропуск); лічильник лише зростає — номер не повторюється навіть після видалення заявки | AC-HIST-01 |
| `purchases` | `number integer unique not null`: наявні заявки — номери `1…N` за `created_at`, `id` (#73), `last_number` = N, далі `not null unique`; статуси + `partially_approved`, `returned` — новий `purchases_status_check` (зняти старий → додати новий); `return_reason text` + `check`: повернена — лише з причиною | AC-HIST-01, AC-DEC-01, AC-DEC-04, AC-DEC-06 |
| `purchase_lines` | `status text not null default 'pending'` (`pending` / `approved` / `rejected`); рядкам наявних заявок — статус заявки (`approved` / `rejected`, інакше `pending`) | AC-DEC-01 |
| `purchase_events` (нова) | `id`, `purchase_id → purchases on delete cascade`, `kind` (`check`: лише `submitted` у WS9), `actor_id → profiles on delete cascade` (щоб прибирання синтетичних користувачів UAT не падало), `created_at`; наявні заявки — запис `submitted` з `created_at` / `author_id` | AC-HIST-06, AC-HIST-10 |

**Права на кожну операцію** для `authenticated` (`anon` — нічого; `service_role` — `select, insert, update, delete`,
як у `purchases.sql`):

| Таблиця | select | insert | update | delete |
|---|---|---|---|---|
| `purchases` | без змін (`purchases_select_visible`) | немає grant — `submit_purchase` | немає grant — `decide_purchase`, `resubmit_purchase` | немає grant |
| `purchase_lines` | без змін (видима заявка) | немає grant — функції | немає grant — `decide_purchase` (статус рядка) | немає grant — `resubmit_purchase` |
| `purchase_events` | `grant select`; політика: `exists` видимої заявки (та сама умова, що `purchases_select_visible`, зокрема `is_active_user()`) — AC-HIST-10 | немає grant — лише функції | немає grant: записи не змінюються | немає grant |
| `private.purchase_counter` | немає | немає | немає — лише `submit_purchase` | немає |

**Функції** — `private.*` (`security definer`, `set search_path = ''`) + обгортка `public.*` (`security invoker`),
`grant execute` лише `authenticated`, `revoke … from public, anon`:

- `private.insert_purchase_lines(p_purchase_id, p_lines)` (нова, спільна для подання й повторного подання; `revoke
  execute … from public, anon, authenticated`): перевірки рядків `NO_LINES`, `LINE_FIELDS`, `INVALID_LINE` зі зрізу 2 і
  `insert` з `ordinality` для `position` — щоб перевірки не розійшлися між двома функціями (AC-FRM-06, AC-FRM-15,
  AC-DEC-07).
- `submit_purchase` (`create or replace`): номер із `private.purchase_counter` (AC-HIST-01), рядки —
  `insert_purchase_lines`, запис `submitted` (AC-HIST-06).
- `decide_purchase`: `drop function public.decide_purchase(uuid, text, text)` і
  `drop function private.decide_purchase(uuid, text, text)`, потім нові обидві з
  `p_rejected_lines uuid[] default '{}'` — старий виклик із трьома аргументами (прев'ю чи відкат застосунку до
  `db-deploy`) працює далі, без `PGRST202` і без `PGRST203` (у `pg_proc` рівно одна `public.decide_purchase`);
  `p_decision` — `approve` / `reject` / `return`; `for update`; першою — активний (`private.is_active_user()`), інакше
  `FORBIDDEN`; ті самі `FORBIDDEN` (не схвалювач відділу, зокрема `admin`, якого не призначено схвалювачем, — умова
  `m.approves` зі зрізу 2), `NOT_PENDING`, автор ≠ переглядач. Статуси рядків: `approve` — непозначені рядки
  `approved`, позначені — `rejected`, заявка `approved` або `partially_approved` (AC-DEC-01); `reject` — усі рядки
  `rejected`; `return` — рядки `pending`. `coalesce(p_rejected_lines, '{}')`; рядок не цієї заявки, або непорожній
  `p_rejected_lines` при `reject` / `return` → `FORBIDDEN`; усі рядки відхилено (`not exists` рядка цієї заявки з
  `id <> all(p_rejected_lines)`) → `ALL_LINES_REJECTED` без змін (захист даних: «частково схвалена» без жодного
  схваленого рядка — суперечність); `return` без причини → `REASON_REQUIRED` (AC-DEC-06); `return` → `returned`,
  `return_reason` (AC-DEC-04).
- `resubmit_purchase(p_purchase_id, p_lines jsonb)`: `for update`; першою — активний; лише автор і лише `returned`,
  інакше `FORBIDDEN`; ті самі перевірки відділу й типу, що в `submit_purchase` (відділ: `admin` — будь-який наявний,
  інші — член відділу заявки; «Самостійна закупівля»: `admin` або з дозволом), інакше `FORBIDDEN`; `delete` усіх
  рядків заявки, потім
  `insert_purchase_lines`; статуси рядків — `pending`, статус — `awaiting_approval`; `return_reason`,
  `rejection_reason`, `decided_by`, `decided_at` — `null`; відділ, тип і номер не змінюються (AC-DEC-07, #68); ще один
  запис `submitted` (#67).
- `private.purchase_history(p_purchase_id)` (`stable`, definer — обходить RLS, тож видимість перевіряє сама функція):
  умова дослівно як у `private.purchase_author_names` — `is_active_user()` і (автор / `approves_department` / `admin`);
  для невидимої чи неіснуючої заявки — 0 рядків, без винятку; повертає лише `kind`, `created_at`, ім'я того, хто діяв
  (без імені — email), без інших даних профілю (AC-HIST-06, AC-HIST-10).

## Auth

- `src/proxy.ts` лише перевіряє сесію (`getClaims`) і перенаправляє на `/login`; захистом не є.
- Кожна сторінка — `getViewer()`: `getClaims()`, профіль і роль з `public.profiles`, деактивований — вихід (AC-ORG-12).
  `/purchases/[id]/edit` додатково: автор і статус `returned`, інакше «Not enough permissions» без даних.
- Кожна Server Action (`submitPurchase`, `decidePurchase`, `resubmitPurchase`) — `getViewer()` першою, потім доменна
  перевірка з текстом PM, потім `rpc` клієнтом користувача (діють RLS, GRANT і перевірки функцій). Ідентифікаторам з
  форми не довіряємо: рядки для відхилення — лише рядки цієї заявки.
- Адміністратор вирішує лише у відділах, де його призначено схвалювачем, і тоді діє як цей схвалювач
  (ValiaBihun/2026-quitcode-dream-team#48, матриця прав; у базі — умова `m.approves` у `decide_purchase` зі зрізу 2);
  в інших — заявку бачить, рішення немає.
- Admin-клієнт і `SUPABASE_SECRET_KEY` у застосунку не потрібні (ключ — лише для прибирання UAT локально).

## Тести

- **Тести бази на PGlite** (`tests/db/*.test.ts`), справжня база з RLS, не моки: на кожну відмову — запит забороненої
  ролі й перевірка відмови **і** незмінних даних (`asService`):
  - AC-DEC-06 — повернення без причини: `REASON_REQUIRED`, статус «Очікує схвалення»;
  - AC-HIST-10 — Петро (не автор заявки) схвалює лише «Офіс» і бачить історію заявки «Офісу», але ні прямий `select` з
    `purchase_events`, ні `public.purchase_history` не повертають записів заявки «Початкової школи», статус той самий;
    мутація політики `select` і мутація перевірки видимості у `private.purchase_history` роблять червоним саме цей
    тест; окремо — автор, який схвалює інший відділ, бачить власну історію (зауваження CodeRabbit у #63);
  - непризначений `admin`: `decide_purchase` для заявки відділу, де він не схвалювач, — `FORBIDDEN`, статус той самий,
    заявки немає в його списку для рішення (зауваження CodeRabbit у #62);
  - номер (AC-HIST-01): дві заявки поспіль — `PUR-1`, `PUR-2`; після перенесення N наявних — N + 1; подання, що
    відкотилося після видачі номера (помилка рядка), не лишає пропуску — наступне успішне отримує наступний номер;
  - права: `has_table_privilege` — `authenticated` і `anon` не мають `insert` / `update` / `delete` на
    `purchase_events` і жодних прав на `private.purchase_counter`; прямий запис — `permission denied`;
  - `decide_purchase`: у `pg_proc` рівно одна `public.decide_purchase`; виклик із трьома аргументами схвалює й
    відхиляє, як у зрізі 2;
  - `resubmit_purchase`: не автор, не `returned`, деактивований автор, автор не `admin` поза відділом — `FORBIDDEN`,
    заявка без змін; активний автор `admin` без членства у відділі заявки подає знову (як у `submit_purchase`); після
    повторного подання поля рішення порожні, номер той самий, в історії ще один `submitted`.
- **Тести застосунку** (`tests/purchases/*.test.ts`): доменні функції (центи, формат запису, рішення), actions (код
  винятку → текст PM), сторінки. Сторінки, де важливий фільтр чи лічильник, — з `tests/support/viewer.ts` проти бази, а
  не з моками (правило рецензента AGENTS.md); AC-HIST-10 — сторінка `/purchases/[id]` для Петра: «Not enough
  permissions», блоку «History» і даних заявки немає. Назви починаються з AC ID.
- **UAT** (`tests/e2e/*.spec.ts`, Playwright на проді): сценарій на кожен з 9 AC у форматі Given / When / Then з
  «Тоді» дослівно з AC. Заявки й рішення UAT роблять лише синтетичні одноразові `uat-<запуск>-…@example.test`
  (`uatEmail`) у синтетичних відділах «UAT» (заявник і схвалювач) і «UAT-2» (схвалювач лише «UAT-2» — Петро для
  AC-HIST-10), тег `@writes`; робочих схвалювачів і даних демо PM у цих відділах немає (перевірити перед прогоном).
  Прибирання після себе — `cleanup.teardown.ts`: `OWNED_ROWS` у `tests/e2e/support/admin.ts` — `purchases.author_id`
  (рядки й події йдуть каскадом), потім `deleteUser`; `leftoverRequests` = 0; номер не повторюється, бо лічильник не
  відкочується після видалення. Прогони UAT — лише по одному: `deleteUatUsers()` навмисно прибирає всі `uat-*`, зокрема
  залишки обірваних прогонів, тож паралельних прогонів на одній базі немає. AC-HIST-01 на проді: пара підряд `PUR-n`,
  `PUR-(n+1)` (#73); якщо між ними вклинилась чужа заявка — перевірити, що проміжні номери мають інших авторів, і
  повторити прогін; знову не підряд — рядок «Не перевірено» в proof pack з причиною й посиланням на тест бази. «PUR-1 і
  PUR-2 у порожній системі» — рядок «Не перевірено» в proof pack з причиною (на проді вже є заявки) і посиланням на тест
  бази. Звіт
  `docs/qa/uat/<дата>/`, негативний контроль `npm run uat:nc` (NC-1 → FAIL) у звіті.
- **Мутаційна перевірка** відмов — мутанти в `scripts/mutants.mjs` (`id`, `ac`, `file` — нова міграція, `tests`, `find`
  рівно один раз), `npm run mutation:sql -- --markdown` → `KILLED`, вивід — в описі PR:
  - AC-DEC-06 — `REASON_REQUIRED` у `decide_purchase`;
  - AC-HIST-10 — умова політики `select` `purchase_events` → `true` і умова видимості в `private.purchase_history` →
    `true` (не видалення політики);
  - непризначений `admin` — `m.approves` у новому `decide_purchase`;
  - AC-HIST-01 — `last_number + 1` → `last_number + 2` (тест «PUR-1, PUR-2» червоний);
  - наявні A1 і F1 — `file` перенести в нові міграції, де `decide_purchase` і `submit_purchase` перевизначено (мутант
    у старій міграції — мертвий код і переживе прогін).

  Stryker (`npm run mutation:ts`) — для нових доменних функцій; ≥1 червоний прогін CI мутацією нової міграції за зріз.

## Risks / Trade-offs

- Зміна сигнатури `decide_purchase`: новий параметр має типове значення, тож старий застосунок після міграції працює;
  новий застосунок до `db-deploy` може на хвилину отримати `PGRST202` — показати помилку рішення текстом, а не падінням
  сторінки.
- Відкат застосунку до версії зрізу 2 після міграцій зрізу 3 не плануємо: старий `StatusBadge` не знає «Partially
  approved» і «Returned for revision» (покаже код статусу як є) і не показує причину повернення; дій на таких заявках
  старий застосунок не дає, бо `decide_purchase` повертає `NOT_PENDING`. Якщо щось зламається — виправлення вперед, а не
  відкат.
- AC-HIST-01 на проді не перевірити з порожньою базою — «PUR-1» доводить тест бази, на проді — пара підряд (#73).
- `ALL_LINES_REJECTED` — захист даних без AC: якщо PM поверне сценарій «усі рядки відхилено» з іншим текстом, змінимо
  лише текст.
