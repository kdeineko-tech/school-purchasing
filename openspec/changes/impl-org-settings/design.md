# Design: impl-org-settings

## Context

- Специфікація: `openspec/specs/departments/spec.md`, `openspec/specs/staff-lifecycle/spec.md`,
  `openspec/specs/access-permissions/spec.md` — AC-ORG-01 … AC-ORG-34 (без 07 і 08, їх PM прибрала).
- Знімок вимог PM 2026-10-22; питання Q1–Q4 (ValiaBihun/2026-quitcode-dream-team#42 … #45) відкриті — до відповіді
  реалізуємо текст PM і рекомендований варіант лише там, де він не додає поведінки (див. Risks).
- Відповідь PM у ValiaBihun/2026-quitcode-dream-team#35: деактивація не змінює відділів, схвалення, автосхвалення,
  дозволів і ролі; після повторної активації все діє, як було (AC-ORG-12, AC-ORG-30).
- Стек шаблону: Next.js 16 App Router, Supabase (міграції лише через PR і `db-deploy`), Vitest без бази (Docker не
  потрібен), сесія — `src/proxy.ts`, авторизація на сервері — `getClaims()`.

## Goals / Non-Goals

**Goals:**

- Кожен AC: код + тест з AC ID у назві + рядок «реалізовано» в `docs/conformance.md`.
- Правила, які не можна обійти прямим запитом до Data API, — у базі: роль за відділами, останній активний адміністратор,
  схвалення й автосхвалення лише для заявника, унікальна назва відділу.
- Права з матриці `requirements/product.md`: сторінки адміністратора й зміни налаштувань — лише `admin`.

**Non-Goals:**

- Створення, збереження й подання заявок, чернетки (наступний зріз; AC-ORG-13 — після відповіді на Q2).
- Перейменування й видалення відділів, імпорт, історія змін налаштувань (Non-goals PM).
- Створення користувачів з інтерфейсу: як і в шаблоні, їх створює `npm run users:demo` (Admin API).

## Decisions

### 1. Ролі (міграція `…_org_roles.sql`)

- `profiles.role` ∈ `requester` / `approver` / `admin`; порядок за шаблоном: зняти `profiles_role_check` →
  `update … set role = 'requester' where role = 'member'` → `default 'requester'` → новий `profiles_role_check`.
- `profiles.is_active boolean not null default true` (AC-ORG-12, AC-ORG-16, AC-ORG-18, AC-ORG-28, AC-ORG-30).
- `supabase/demo-users.json`: ролі `admin` і `requester`; відділи й схвалювачів налаштовуємо в застосунку.

### 2. Модель даних (міграція `…_departments.sql`)

| Таблиця | Ключові колонки | AC |
|---|---|---|
| `departments` | `id`, `name` (1–100 символів після прибирання пробілів); унікальний індекс `lower(btrim(name))` | 34, 14 |
| `department_members` | PK (`profile_id`, `department_id`); `approves boolean default false`, `auto_approve boolean default false` | 01–06, 15, 19, 20, 24, 33 |
| `profiles` (+колонки) | `can_card_expense`, `can_check_request`, `can_vendor_invoice`, `can_self_purchase` — `boolean default false` | 17, 25–27 |

- Рядок `department_members` = працівник — заявник відділу. Схвалення й автосхвалення — колонки цього рядка, тож
  «не заявник» не може їх мати за побудовою (AC-ORG-02, AC-ORG-33), а видалення рядка (зняття заявника) знімає і
  схвалення, і автосхвалення (AC-ORG-03, AC-ORG-15). Рішення — ADR `docs/decisions/0001-department-membership.md`
  (у PR задачі 2).
- Автосхвалення — окремо на кожен рядок, тобто на кожен відділ (AC-ORG-06).

### 3. Роль за відділами — тригери в базі

- `private.sync_role(profile_id)` (`security definer`, `search_path = ''`): якщо роль не `admin` —
  `approver`, коли є хоча б один рядок з `approves = true`, інакше `requester` (правило ролей `requirements/product.md`;
  AC-ORG-04, AC-ORG-05, AC-ORG-19, AC-ORG-24). Роль `admin` не змінює (AC-ORG-11, AC-ORG-20).
- Тригер `after insert/update/delete on department_members` викликає `sync_role`.
- Тригер `before update of role, is_active on profiles` (`private.guard_admins`):
  - спершу `perform pg_advisory_xact_lock(hashtext('org_active_admins'))` — одночасні зміни ролі й активності
    виконуються по черзі, тож дві транзакції не можуть кожна побачити «інший адміністратор ще є» і разом прибрати
    останнього;
  - зняття ролі `admin` → роль за `sync_role` (AC-ORG-21, AC-ORG-31, AC-ORG-32);
  - якщо після зміни не лишилося жодного активного `admin` → виняток `LAST_ADMIN` (AC-ORG-10, AC-ORG-18).
- Деактивація змінює лише `is_active` (відповідь PM #35), тож повторна активація повертає все як було (AC-ORG-30).

### 4. Права: GRANT + RLS

| Таблиця | select | insert | update | delete | AC |
|---|---|---|---|---|---|
| `profiles` | власний / admin (шаблон) | — (тригер) | власний `full_name` (шаблон); admin — `role`, `is_active`, дозволи (див. нижче) | — | 09, 10–12, 17, 18, 21, 25–27, 30–32 |
| `departments` | усі активні `authenticated` | admin | — | — | 09, 14, 34 |
| `department_members` | власні рядки / admin | admin | admin (`approves`, `auto_approve`) | admin | 01–06, 09, 15, 19, 20, 24, 33 |

Працівник без ролі `admin` не має insert/update/delete на жодній таблиці налаштувань — це та сама межа, що й відмова
«Недостатньо прав» на сторінках адміністратора (AC-ORG-09).

- `revoke all … from anon, authenticated`, далі явні колонкові GRANT; політика на кожну операцію `to authenticated`
  з `(select private.current_app_role()) = 'admin'` або `(select auth.uid())`.
- **Адміністративні колонки `profiles`** (`role`, `is_active`, `can_*`): `grant update (role, is_active, can_card_expense,
  can_check_request, can_vendor_invoice, can_self_purchase) on public.profiles to authenticated` потрібен адміністратору,
  але шаблонна політика `profiles_update_own` пускає кожного до власного рядка. Тому:
  - нова політика `profiles_update_admin`: `for update to authenticated using ((select private.current_app_role()) =
    'admin') with check ((select private.current_app_role()) = 'admin')`;
  - тригер `before update on profiles` (`private.guard_profile_admin_columns`, `security definer`,
    `search_path = ''`):
    1. якщо `(select auth.uid()) is null` — зміну зробив не користувач застосунку, а `service_role` (скрипт
       `users:demo`) чи міграція: пропускаємо явно, `return new`;
    2. інакше, якщо змінилась будь-яка з цих колонок (`old.* is distinct from new.*`), а
       `coalesce(private.current_app_role(), '') <> 'admin'` → виняток `FORBIDDEN` (`NULL` — неактивний чи
       відсутній профіль — теж не `admin`).

    Так працівник через `profiles_update_own` змінює лише `full_name`, а не собі роль чи дозволи (AC-ORG-09).
- **Деактивований працівник з чинною сесією** (AC-ORG-12): `private.current_app_role()` повертає роль лише активного
  профілю (`… where p.id = (select auth.uid()) and p.is_active`), а всі політики `departments` і `department_members`
  та нові політики `profiles` додатково вимагають `(select private.is_active_user())`. Тож після деактивації запити до
  Data API з чинним токеном не повертають і не змінюють нічого, крім власного профілю (шаблонні `select`/`update own`).
  Крім того, `src/proxy.ts` для неактивного профілю робить `signOut` і веде на `/login`.

### 5. Доменний модуль `src/lib/org/` (чистий TypeScript, без Supabase)

| Файл | Що робить | AC |
|---|---|---|
| `access.ts` | `canOpenAdminPages(role)` | 09 |
| `departments.ts` | `normalizeDepartmentName`, `isDuplicateName`, `departmentsWithoutApprover` | 34, 14 |
| `membership.ts` | `addRequester`, `removeRequester`, `setApprover`, `setAutoApprove` над станом членства — ті самі правила, що в базі | 01–03, 06, 15, 33 |
| `roles.ts` | `roleFor(profile, memberships)`, `roleAfterAdminRemoval`, `canChangeAdminState(admins, change)` | 04, 05, 10, 11, 18–21, 24, 30–32 |
| `permissions.ts` | `allowedRequestTypes(profile)`, `allowedPurchaseTypes(profile)` | 17, 25–27 |
| `choices.ts` | `approverCandidates`, `onBehalfCandidates`, `selectableDepartments`, `selectablePurchaseTypes` | 16, 22, 23, 28, 29 |
| `messages.ts` | тексти з PM: «Відділ з такою назвою вже є», «Спершу додайте працівника до відділу як заявника», «Має лишитись хоча б один активний адміністратор», «Недостатньо прав», «Немає схвалювача» | — |

Предикати активності (`is_active` профілю):

- `approverCandidates` — лише активні заявники відділу (AC-ORG-16);
- `onBehalfCandidates` — лише активні працівники без ролі `admin`, крім самого автора (AC-ORG-28);
- `departmentsWithoutApprover` — відділ «Немає схвалювача», якщо серед його рядків `department_members` немає жодного
  з `approves = true` і активним профілем (AC-ORG-14).

Server action спершу перевіряє правило доменною функцією й показує повідомлення PM; база — друга лінія захисту
(унікальний індекс, тригери, RLS) і на її помилки (`23505`, `LAST_ADMIN`) action показує те саме повідомлення.

### 6. Сторінки й server actions

| Сторінка | Хто | Server actions |
|---|---|---|
| `/admin/*` (layout) | admin; інші — «Недостатньо прав» | — |
| `/admin/departments` | admin | `createDepartment` |
| `/admin/staff`, `/admin/staff/[id]` | admin | `addRequester`, `removeRequester`, `setApprover`, `setAutoApprove`, `setPermissions`, `setAdminRole`, `setActive` |
| `/profile` | усі | — (власні відділи й дозволені типи) |
| `/requests/new` | усі | — (заглушка: тип заявки, відділ, тип закупівлі, «від імені»; нічого не зберігає); список «від імені» — `rpc('on_behalf_candidates')` |
| `/login` | — | `login`: після входу неактивного — `signOut` і відмова (AC-ORG-12) |

Роль і активність переглядача — `src/lib/org/viewer.ts` (`getClaims()` + `profiles`).

**Список «від імені» (AC-ORG-28).** RLS дає не-адміністратору лише власний профіль і власні рядки `department_members`,
тому список колег читаємо вузькою функцією, а не відкриваємо чужі профілі:

- `private.on_behalf_candidates()` — `security definer`, `set search_path = ''`, повертає лише `id`, `full_name`:
  активні працівники без ролі `admin`, що є заявниками хоча б одного відділу, де заявник і переглядач, крім самого
  переглядача; якщо переглядач неактивний — порожньо; для адміністратора — усі активні працівники, крім нього (матриця
  прав: «будь-кого»). Глобальну роль `requester` не вимагаємо: `approver` теж може бути заявником відділу;
- `public.on_behalf_candidates()` — `security invoker`, лише `select * from private.on_behalf_candidates()`;
  `grant execute … to authenticated`, `revoke … from public, anon`;
- до відповіді PM на Q1 (ValiaBihun/2026-quitcode-dream-team#42) список не залежить від обраного в заглушці відділу.

### 7. Тести

- Юніт-тести `tests/org/*.test.ts` над доменним модулем; назви починаються з AC ID (`it("AC-ORG-34: …")`).
- Тригери й RLS перевіряє `db-check` (міграції на одноразовій базі) і ручна перевірка на проді трьома демо-користувачами
  перед записом екрана.

## Risks / Trade-offs

- Тести без бази: правило в TypeScript і в тригері може розійтися. Тримаємо їх поруч у design і перевіряємо вручну на
  проді; pgTAP — коли з'явиться Docker.
- Q1 (#42, «від імені» для заявника кількох відділів): у заглушці список — колеги-заявники відділів автора, крім нього й
  адміністраторів, без деактивованих (AC-ORG-28); після відповіді PM — уточнення.
- Q3 (#44): типи закупівлі «Відділ закупівель» і «Самостійна закупівля» — як у тексті PM AC-ORG-23 і AC-ORG-27.
- Q4 (#45): деактивованому показуємо загальну відмову входу без нового тексту; конкретний текст — після відповіді PM.
