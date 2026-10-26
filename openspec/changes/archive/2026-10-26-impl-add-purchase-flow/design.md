# Design: impl-add-purchase-flow

## Context

- Специфікація: `openspec/specs/purchase-form/spec.md` (AC-FRM-01 … 13), `openspec/specs/approval-decisions/spec.md`
  (AC-APR-01 … 07), `openspec/specs/english-interface/spec.md` (AC-LANG-04 … 06), `openspec/specs/access-permissions/spec.md`
  (AC-ORG-22, AC-ORG-23, AC-ORG-29).
- Знімок вимог PM 2026-10-25 після відповідей на Q5–Q8 (ValiaBihun/2026-quitcode-dream-team#57 … #60; зміна
  специфікації `update-purchase-flow`): AC-FRM-14, AC-FRM-15, уточнений AC-APR-07. Інші відповіді PM, які діють: #50 (чернетки немає, «не подано» = немає нової заявки «Очікує схвалення»),
  #52 (відділ без схвалювача не блокує подання; автор-єдиний схвалювач свою заявку не вирішує), #51 (час — за
  `America/New_York`).
- Перший зріз дав: `profiles` (роль, `is_active`, дозволи `can_*`), `departments`, `department_members` (`approves`,
  `auto_approve`), `private.current_app_role()`, `private.is_active_user()`, `src/lib/org/*`, `MESSAGES`.
- Стек шаблону: Next.js 16.4 App Router (`params`/`searchParams` — проміси, `PageProps<…>`), Supabase (міграції лише
  через PR і `db-deploy`; у supabase-js немає транзакцій), Vitest (тести застосунку й тести бази на PGlite), авторизація — `getClaims()`.

## Goals / Non-Goals

**Goals:**

- Кожен AC з `proposal.md`: код + тест з AC ID у назві + рядок «реалізовано» в `docs/conformance.md`.
- Правила, які не можна обійти прямим запитом до Data API, — у базі: подання лише у свій відділ і дозволеного типу,
  хоча б один рядок, рішення лише схвалювачем відділу й не щодо власної заявки, відхилення лише з причиною
  (AC-FRM-02, AC-FRM-04, AC-FRM-06, AC-APR-05, AC-APR-06).
- Права з матриці `requirements/product.md`: бачити заявки — автор, схвалювач її відділу, `admin`.

**Non-Goals:**

- Номер заявки й історія подання, повернення на доопрацювання, часткове схвалення й відхилення рядків, суми й перевірки
  кількості та ціни, автосхвалення заявок, подання від імені колеги, інші типи заявок («Поза межами» PM).
- Рішення адміністратора за відділ без схвалювача — WS8 (примітка до матриці прав `requirements/product.md`): у WS7
  вирішує лише схвалювач відділу; адміністратор вирішує тільки у відділах, які сам схвалює.
- Чернетки (відповідь PM #50), редагування й скасування поданої заявки.

## Decisions

Рішення згруповано за трьома розділами WS7: «UI і компоненти», «Дані й RLS», «Auth»; далі — тести. Рішення з
альтернативами винесено в ADR: подання й рішення лише функціями бази — `docs/decisions/0003-purchase-submission-rpc.md`.

## UI і компоненти

| Сторінка | Хто бачить | Що | Порожні стани й помилки (тексти з AC, таблиця #49) | AC |
|---|---|---|---|---|
| `/purchases/new` | усі, хто увійшов; гість → `/login` | відділ, тип, рядки (назва, мета, кількість, ціна) | без відділів — «You have not been added to any department. Contact your administrator.» замість полів; без рядків — «Add at least one line»; незаповнене поле рядка — «Fill in all line fields»; чужий відділ чи тип — «Not enough permissions» | FRM-01, 03, 05, 06, 09, 15, ORG-22, 23, 29, LANG-04 |
| `/purchases` («My requests») | усі, хто увійшов | лише власні заявки, статус текстом, перехід на сторінку заявки | після подання — «Purchase submitted»; без заявок — «You have not submitted any requests yet» | FRM-10, 11, 14, LANG-06 |
| `/purchases/[id]` | автор, схвалювач відділу, `admin` | статус текстом, відділ, тип, дата, рядки; причина відхилення поруч зі статусом «Rejected»; «Approve» / «Reject» з полем причини, якщо `canDecide` | чужа чи неіснуюча заявка — «Not enough permissions» без даних; відхилення без причини — «Provide a reason» | FRM-08, APR-02, 03, 05–07, LANG-05, 06 |
| `/approvals` | `approver`, `admin`; `requester` — відмова | список для рішення: «Awaiting approval» відділів, які переглядач схвалює, крім власних | `requester` — «Not enough permissions»; порожньо — «No requests awaiting your decision» | APR-01, APR-04 |

- Компоненти — лише з `@/components/ui` (`Card`, `Button`, `Input`, `Select`, `Badge`, `Alert`, `Notice`,
  `EmptyState`) і `PageShell`; статус — `StatusBadge` (текст, не лише колір, AC-LANG-06). Після дизайн-системи
  (DESIGN.md, трек B WS7) ці компоненти беруть лише семантичні токени.
- Підпис ролі — англійська назва з таблиці #49 поруч з ідентифікатором ролі (AC-LANG-08, задача 4.2).
- Форма — клієнтський компонент з `useActionState`, поля керовані: після відмови обрані відділ, тип і рядки лишаються
  (AC-FRM-06). Подання → `redirect('/purchases?submitted=1')` (AC-FRM-11).
- Дати й час — `America/New_York` (`formatSubmittedAt`).
- Доменний модуль `src/lib/purchases/` (чистий TypeScript): `formDepartments` (FRM-01, 05, ORG-22, 29),
  `formPurchaseTypes` (FRM-03, ORG-23), `validateSubmission` (FRM-02, 04, 06, 15), `canSeePurchase` (FRM-08),
  `canDecide` (APR-02, 05, FRM-13), `decisionList` (APR-01), `validateDecision` (APR-06), `STATUS_LABELS`,
  `PURCHASE_TYPE_LABELS` (LANG-06).

## Дані й RLS

**Таблиці** (міграція `…_purchases.sql`; `enable row level security`; `revoke all … from anon, authenticated`):

| Таблиця | Ключові колонки | AC |
|---|---|---|
| `purchases` | `id`, `author_id → profiles`, `department_id → departments`, `purchase_type` (`purchasing_department` / `self_purchase`), `status` (`awaiting_approval` / `approved` / `rejected`, default `awaiting_approval`), `rejection_reason`, `decided_by`, `decided_at`, `created_at`; `check`: відхилена — лише з причиною | FRM-01…15, APR-01…07 |
| `purchase_lines` | `id`, `purchase_id → purchases on delete cascade`, `position`, `name`, `purpose`, `quantity integer`, `unit_price numeric(12,2)` | FRM-06, 07, 15 |

Статус і тип — стабільні ідентифікатори, підписи — лише в інтерфейсі (AC-LANG-06). Межі значень рядка — наступний зріз.

**Права на кожну операцію** для ролей застосунку — `authenticated` (і `anon`, у якого немає нічого):

| Таблиця | select | insert | update | delete |
|---|---|---|---|---|
| `purchases` | `grant select`; політика `purchases_select_visible`: активний і (автор або `private.approves_department(department_id)` або `admin`) — FRM-08, 10, APR-03 | немає grant — лише `submit_purchase` (FRM-02, 04, 06, 15) | немає grant — лише `decide_purchase` (APR-02, 05, 06, 07); статус, автора й причину користувач напряму не змінює | немає grant |
| `purchase_lines` | `grant select`; політика: `exists` видимої заявки — FRM-08 | немає grant — лише `submit_purchase` | немає grant | немає grant |

Column grants не потрібні: `authenticated` не має жодного grant на `update`, тож `status`, `author_id`,
`rejection_reason` для користувачів застосунку недоступні для запису. `anon` не має нічого (FRM-09).

`service_role` має `select, insert, update, delete` на обидві таблиці й обходить RLS — це сервісний ключ для Dashboard
і тестів (`asService` у `tests/db/supabase-pglite.ts`). Застосунок його не використовує: admin-клієнта й
`SUPABASE_SECRET_KEY` у Vercel немає (розділ «Auth»).

**Функції для привілейованих дій** — `private.*` (`security definer`, `set search_path = ''`) + тонка обгортка
`public.*` (`security invoker`), `grant execute` лише `authenticated`, `revoke … from public, anon`:

- `submit_purchase(p_department_id, p_purchase_type, p_lines jsonb)` — одна транзакція: активний (`FORBIDDEN`); відділ
  — `admin` будь-який (ORG-22, 29), інші — де заявник (FRM-02); `self_purchase` — `admin` або `can_self_purchase`
  (FRM-04, ORG-23); рядки — три окремі послідовні `if` з `NO_LINES` (`jsonb_typeof` ≠ `array`; порожній масив;
  елемент не об'єкт) до будь-якого `insert`, бо порядок частин `AND` PostgreSQL не гарантує (FRM-06); незаповнене поле
  рядка — `LINE_FIELDS` (FRM-15, задача 4.1); значення, які не приводяться до типу колонки, — `INVALID_LINE`; наявність
  схвалювача не перевіряємо (FRM-12, 13).
- `decide_purchase(p_purchase_id, p_decision, p_reason)` — `select … for update`; активний і `approves = true` у
  відділі заявки, інакше `FORBIDDEN` (APR-03, 04); автор ≠ переглядач (APR-05, FRM-13); статус `awaiting_approval`,
  інакше `NOT_PENDING`; `reject` без причини — `REASON_REQUIRED` (APR-06); `update` статусу, причини, `decided_by`,
  `decided_at` (APR-02, 07).
- `private.approves_department(dept)` — `security definer`, `stable`: переглядач схвалює відділ.

Набір ролей у зрізі не змінюється (drop-first не потрібен).

## Auth

- `src/proxy.ts` лише оновлює сесію й перенаправляє на `/login` (UX), захистом не є.
- Кожна сторінка — `getViewer()`: `supabase.auth.getClaims()` (не `getSession()`), профіль і роль — з
  `public.profiles` за `claims.sub`, ніколи з `user_metadata`; немає claims — `redirect('/login')` (FRM-09);
  неактивний — `redirect('/login?error=deactivated')`. Layouts рендер не гейтять, тож перевірка — у кожній сторінці.
- Кожна Server Action (`submitPurchase`, `decidePurchase`) починається з `getViewer()` (getClaims + роль з profiles),
  потім перевіряє правило доменною функцією з текстом PM, і лише тоді пише — серверним клієнтом користувача через
  `rpc`, тож діють RLS, GRANT і перевірки функції бази. Ідентифікаторам з форми не довіряємо: відділ і тип — лише зі
  списків, які рахує сервер; заявку — лише ту, яку повертає RLS.
- Admin-клієнт і `SUPABASE_SECRET_KEY` у зрізі не потрібні: Admin API зріз не викликає, ключа у Vercel немає.
- Дії, що створюють сесію (вхід), у зрізі не змінюються.

## Тести

- **Тести бази на PGlite** (`tests/db/*.test.ts`, `tests/db/supabase-pglite.ts`): на кожен відмовний AC — запит від
  імені забороненої ролі, чужого користувача (`asUser`) чи гостя (`asAnon`), перевірка відмови **і** незмінних даних
  (`asService`). AC: FRM-02, 04, 06, 08, 09, 15, APR-03, 04, 05, 06.
- **Тести застосунку** (`tests/purchases/*.test.ts`): доменні функції; actions з підставним Supabase (код винятку → текст
  PM, без переходу); сторінки — рендер з підставним переглядачем. Назви починаються з AC ID.
- **Мутаційна перевірка** для кожного відмовного AC задачі: тимчасово послабити політику, grant чи перевірку функції →
  саме цей тест червоний → повернути; таблиця в описі PR. Застосовані міграції не змінюємо навіть тимчасово: мутації —
  у тестовій базі PGlite або в новій міграції PR (≥2 червоні прогони CI за зріз — у задачі 3.1).
- Ручна перевірка на проді демо-користувачами (заявник, схвалювач, адміністратор) перед записом екрана.

## Risks / Trade-offs

- Тести бази на PGlite емулюють Auth і JWT спрощено (`auth.uid()` читає `request.jwt.claim.sub`); налаштування
  хмарного проєкту вони не перевіряють — це ручна перевірка на проді.
- Q8 (#60) — відповідь B: усі чотири поля рядка обов'язкові (AC-FRM-15, «Fill in all line fields»), межі значень —
  наступний зріз. Задача 4.1: правило в `validateSubmission` і в `submit_purchase` (код `LINE_FIELDS`). Кількість чи
  ціну, які база не приводить до числа, `submit_purchase` уже повертає кодом `INVALID_LINE` (ADR 0003).
- Q6 (#58) — відповідь A: порожні «Мої заявки» — «You have not submitted any requests yet» (AC-FRM-14), задача 4.1.
- Q7 (#59) — відповідь A: причину відхилення показуємо на сторінці заявки поруч зі статусом «Rejected»; бачать автор і
  схвалювачі відділу (уточнений AC-APR-07), задача 3.1.
- Q5 (#57) — відповідь A: AC-LANG-07 прибрано; AC-LANG-08 — лише підписи ролей (задача 4.2); номерів і історії в
  зрізі немає.
- Одночасні рішення двох схвалювачів PM винесла за межі зрізу; `for update` у `decide_purchase` усе одно не дає
  перезаписати рішення (`NOT_PENDING` для другого).
