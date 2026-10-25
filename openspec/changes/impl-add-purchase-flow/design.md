# Design: impl-add-purchase-flow

## Context

- Специфікація: `openspec/specs/purchase-form/spec.md` (AC-FRM-01 … 13), `openspec/specs/approval-decisions/spec.md`
  (AC-APR-01 … 07), `openspec/specs/english-interface/spec.md` (AC-LANG-04 … 06), `openspec/specs/access-permissions/spec.md`
  (AC-ORG-22, AC-ORG-23, AC-ORG-29).
- Знімок вимог PM 2026-10-25. Відкриті питання: Q5 (ValiaBihun/2026-quitcode-dream-team#57), Q6 (#58), Q7 (#59),
  Q8 (#60). Відповіді PM, які вже діють: #50 (чернетки немає, «не подано» = немає нової заявки «Очікує схвалення»),
  #52 (відділ без схвалювача не блокує подання; автор-єдиний схвалювач свою заявку не вирішує), #51 (час — за
  `America/New_York`).
- Перший зріз дав: `profiles` (роль, `is_active`, дозволи `can_*`), `departments`, `department_members` (`approves`,
  `auto_approve`), `private.current_app_role()`, `private.is_active_user()`, `src/lib/org/*`, `MESSAGES`.
- Стек шаблону: Next.js 16.4 App Router (`params`/`searchParams` — проміси, `PageProps<…>`), Supabase (міграції лише
  через PR і `db-deploy`; у supabase-js немає транзакцій), Vitest без бази, авторизація — `getClaims()`.

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

### 1. Модель даних (міграція `…_purchases.sql`)

| Таблиця | Ключові колонки | AC |
|---|---|---|
| `purchases` | `id uuid`, `author_id → profiles`, `department_id → departments`, `purchase_type text check in ('purchasing_department','self_purchase')`, `status text check in ('awaiting_approval','approved','rejected') default 'awaiting_approval'`, `rejection_reason text`, `decided_by → profiles`, `decided_at timestamptz`, `created_at timestamptz default now()` | FRM-01…13, APR-01…07 |
| `purchase_lines` | `id`, `purchase_id → purchases on delete cascade`, `position int`, `name text`, `purpose text`, `quantity integer`, `unit_price numeric(12,2)` | FRM-06, FRM-07 |

- Статус і тип — стабільні ідентифікатори; підписи англійською лише в інтерфейсі (AC-LANG-06, таблиця #49).
- `check (status <> 'rejected' or btrim(coalesce(rejection_reason, '')) <> '')` — відхилена заявка завжди має причину
  (AC-APR-06, AC-APR-07).
- Поля рядка без `not null` і без меж значень: обов'язковість — Q8 (#60), межі кількості й ціни — наступний зріз.
  Після відповіді PM — нова міграція з `not null`/`check` і задача 6.

### 2. Подання й рішення — лише функції бази (ADR 0003)

Заявка з рядками — кілька записів, а перевірка прав і запис мають бути разом: це функції Postgres через `rpc`, як
`on_behalf_candidates` у першому зрізі — `private.*` (`security definer`, `set search_path = ''`) і тонка обгортка
`public.*` (`security invoker`), `grant execute … to authenticated`, `revoke … from public, anon`. Прямих
`insert`/`update`/`delete` на `purchases` і `purchase_lines` для `authenticated` немає (лише `select`).

**`submit_purchase(p_department_id uuid, p_purchase_type text, p_lines jsonb) returns uuid`** — в одній транзакції:

1. переглядач активний (`private.is_active_user()`), інакше `FORBIDDEN`;
2. відділ: `admin` — будь-який наявний (AC-ORG-22, AC-ORG-29); інші — лише де є рядок `department_members`
   (AC-FRM-02), інакше `FORBIDDEN`;
3. тип: `self_purchase` — лише `admin` або `can_self_purchase` (AC-FRM-04, AC-ORG-23), інакше `FORBIDDEN`;
4. `p_lines is not null and jsonb_typeof(p_lines) = 'array' and jsonb_array_length(p_lines) >= 1` і кожен елемент —
   `jsonb_typeof(…) = 'object'`, інакше `NO_LINES` (AC-FRM-06) — до будь-якого `insert`. Умову перевіряємо як
   `if not coalesce(…, false)`: `NULL` чи не-масив, переданий прямим `rpc`, не має пройти як «рядки є»;
5. `insert` заявки зі статусом `awaiting_approval` і рядків; наявність схвалювача не перевіряємо (AC-FRM-12, AC-FRM-13).

**`decide_purchase(p_purchase_id uuid, p_decision text, p_reason text)`** — `p_decision in ('approve','reject')`:

1. `select … for update` заявки (два рішення одночасно виконуються по черзі);
2. переглядач активний і має `approves = true` у відділі заявки, інакше `FORBIDDEN` (AC-APR-03; заявник — AC-APR-04);
3. автор ≠ переглядач, інакше `FORBIDDEN` (AC-APR-05, AC-FRM-13);
4. статус `awaiting_approval`, інакше `NOT_PENDING`;
5. `reject` без причини (`btrim` порожній) → `REASON_REQUIRED` (AC-APR-06);
6. `update` статусу, `rejection_reason` (для `reject`), `decided_by`, `decided_at`.

Server action мапить коди винятків на `MESSAGES`: `FORBIDDEN` → «Not enough permissions», `NO_LINES` → «Add at least one
line», `REASON_REQUIRED` → «Provide a reason». Перше правило — доменна функція TypeScript (повідомлення без запиту до
бази), база — друга лінія захисту, як у першому зрізі.

### 3. Хто бачить заявки: RLS `select`

- `purchases`: `author_id = (select auth.uid())` або `private.approves_department(department_id)` або
  `(select private.current_app_role()) = 'admin'`; усе — лише для активного (`private.is_active_user()`).
- `purchase_lines`: `exists` видимої заявки.
- `private.approves_department(dept uuid)` — `security definer`, `stable`: є рядок `department_members` переглядача з
  `approves = true`.
- Заявка, якої RLS не повертає, на сторінці — відмова «Not enough permissions» без даних (AC-FRM-08, AC-APR-03): за
  відсутнім рядком сторінка не розрізняє «немає» і «чужа», тож нічого не розкриває.

### 4. Доменний модуль `src/lib/purchases/` (чистий TypeScript, без Supabase)

| Функція | Що робить | AC |
|---|---|---|
| `formDepartments(viewer, memberships, departments)` | `admin` — усі відділи; інші — де заявник | FRM-01, FRM-05, ORG-22, ORG-29 |
| `formPurchaseTypes(holder)` | через `allowedPurchaseTypes` з `src/lib/org/permissions.ts` | FRM-03, ORG-23 |
| `validateSubmission(input, options)` | відділ і тип зі списків форми, хоча б один рядок | FRM-02, FRM-04, FRM-06 |
| `canSeePurchase(viewer, purchase, approvedDepartmentIds)` | автор / схвалювач відділу / `admin` | FRM-08, APR-03 |
| `canDecide(viewer, purchase, approvedDepartmentIds)` | схвалює відділ, не автор, статус «Очікує схвалення» | APR-02, APR-05, FRM-13 |
| `decisionList(purchases, viewerId, approvedDepartmentIds)` | «Очікує схвалення», відділи схвалювача, крім власних | APR-01 |
| `validateDecision(decision, reason)` | `reject` без причини → «Provide a reason» | APR-06 |
| `STATUS_LABELS`, `PURCHASE_TYPE_LABELS` | «Awaiting approval» / «Approved» / «Rejected»; «Purchasing department» / «Self-purchase» | LANG-06 |

Нові тексти в `MESSAGES` дослівно з таблиці #49: «You have not been added to any department. Contact your
administrator.» (AC-FRM-05), «Add at least one line» (AC-FRM-06, AC-LANG-04), «Purchase submitted» (AC-FRM-11),
«Provide a reason» (AC-APR-06, AC-LANG-05), «No requests awaiting your decision» (порожній список для рішення).

### 5. Сторінки й server actions

| Сторінка | Хто | Що | AC |
|---|---|---|---|
| `/purchases/new` | усі, хто увійшов; гість → `/login` | відділ, тип, рядки (назва, мета, кількість, ціна); без відділів — повідомлення замість полів | FRM-01, 03, 05, 06, 09, ORG-22, 23, 29 |
| `/purchases` («My requests») | усі | лише власні заявки зі статусом-текстом; після подання — «Purchase submitted» | FRM-10, FRM-11, LANG-06 |
| `/purchases/[id]` | автор, схвалювач відділу, `admin`; інші — «Not enough permissions» | рядки, статус; кнопки «Approve» / «Reject» з полем причини, якщо `canDecide` | FRM-08, APR-02, 03, 05–07 |
| `/approvals` | схвалювач і `admin`; `requester` — «Not enough permissions» | список для рішення | APR-01, APR-04 |

- Форма — клієнтський компонент з `useActionState`: рядки додаються без перезавантаження, а після відмови
  (`NO_LINES`) обрані відділ і тип лишаються у формі (AC-FRM-06). Action `submitPurchase` → `rpc('submit_purchase')` →
  `redirect('/purchases?submitted=1')` (AC-FRM-11).
- Action `decidePurchase` → `rpc('decide_purchase')`; відмова чи «Provide a reason» — на сторінці заявки, статус не
  змінено (AC-APR-03, AC-APR-05, AC-APR-06).
- Гість: `getViewer()` → `redirect('/login')` у кожній сторінці (layouts не гейтять рендер у Next.js 16) (AC-FRM-09).
- Шапка й головна: «New purchase», «My requests», «Approvals» (останнє — для `approver` і `admin`).

### 6. Тести

- `tests/purchases/*.test.ts`: доменні функції; actions з підставним Supabase (`rpc` повертає код винятку — action
  показує повідомлення й не переводить на «Мої заявки»); сторінки — рендер з підставним переглядачем, як
  `tests/org/access.test.ts` і `tests/org/english.test.ts`. Назви тестів починаються з AC ID.
- Правила в SQL перевіряє `db-check` (міграції на одноразовій базі) і ручна перевірка на проді трьома демо-користувачами
  (заявник, схвалювач, адміністратор) перед записом екрана; обхід сторінок — `curl` до `/rest/v1/rpc/submit_purchase`
  з токеном заявника.

## Risks / Trade-offs

- Тести без бази: правило в TypeScript і у функції SQL може розійтися. Тримаємо їх поруч у цьому design і перевіряємо
  вручну на проді; pgTAP — коли з'явиться Docker.
- Q8 (#60), поля рядка: до відповіді перевірок рядка, яких немає в AC PM, не додаємо — AC-FRM-06 спрацьовує, коли в
  закупівлі немає жодного рядка. Ризик: порожній рядок формально проходить; саме про це Q8. Після відповіді — задача 6:
  `not null`/`check` новою міграцією, повідомлення з таблиці PM, перевірка в `validateSubmission`.
- Q6 (#58), порожні «Мої заявки»: до відповіді — порожній список без окремого тексту (варіант B, нової поведінки не
  додає); після відповіді — текст PM.
- Q7 (#59), причина відхилення: зберігаємо (`rejection_reason`), але не показуємо, доки PM не скаже де; AC-APR-07
  перевіряємо за статусом і збереженим значенням.
- Q5 (#57): AC-LANG-07, AC-LANG-08 лишаються «відкладено»; номерів і історії в зрізі немає.
- Одночасні рішення двох схвалювачів PM винесла за межі зрізу; `for update` у `decide_purchase` усе одно не дає
  перезаписати рішення (`NOT_PENDING` для другого).
