# QA proof pack: зріз 2 — працівник подає закупівлю, схвалювач вирішує, інтерфейс англійською

<!--
Шаблон з koldovsky/2026-quitcode-08-quality-hw/materials/templates/proof-pack.template.md.
Заповнюємо по кроках WS8 (A → B → C → D). Посилання — на коміти, PR і прогони.
Жодних паролів і пароля від accounts.zip. Акаунти — лише адреси *@example.test.
Цей файл — вхід для конвеєра WS9: на кожен AC видно, чим він доведений.
-->

- Прод-URL: https://school-purchasing-lemon.vercel.app
- Вимоги: https://github.com/ValiaBihun/2026-quitcode-dream-team · джерело: issues · знімок 2026-11-02
- `/api/health` на момент UAT: sha `56fad31`, env production, db ok, 03.11.2026 16:45 (Київ)

## 3 AC

Прод і preview ходять в одну базу, тож UAT нічого не записує. AC-APR-04 і AC-FRM-03 — лише читання. В AC-FRM-06 є
спроба подання, але `submitPurchase` відхиляє порожній список рядків ще до виклику функції бази (`validateSubmission`,
`src/lib/purchases/form.ts`), а `submit_purchase` повторно перевіряє його до `insert` (`NO_LINES`); заявку не
створено. Акаунт — `pm-requester@example.test` (роль `requester`, без дозволу «Самостійна закупівля»).

| AC | Вид | «Тоді» (дослівно з вимоги PM) |
|---|---|---|
| AC-APR-04 | відмова в браузері (заборонена роль) | Тоді він бачить повідомлення «Недостатньо прав», жодної заявки йому не показано, і статуси заявок не змінилися. |
| AC-FRM-06 | стан інтерфейсу (помилка) | Тоді він бачить повідомлення «Додайте хоча б один рядок», обрані відділ і тип лишаються у формі, а закупівлю не подано. |
| AC-FRM-03 | права в інтерфейсі (дозвіл) | Тоді в списку лише «Відділ закупівель», а типу «Самостійна закупівля» немає. |

Інтерфейс англійською (ValiaBihun/2026-quitcode-dream-team#49): «Недостатньо прав» — «Not enough permissions»,
«Додайте хоча б один рядок» — «Add at least one line», «Відділ закупівель» — «Purchasing department», «Самостійна
закупівля» — «Self-purchase».

## A. Ворота

- PR воріт: https://github.com/kdeineko-tech/school-purchasing/pull/53
- Зелений `quality` на `main`: https://github.com/kdeineko-tech/school-purchasing/actions/runs/41528293073 (коміт `c65758c`, 2026-11-02; усі три jobs — success)
- Обов'язкові перевірки в `solo-main` з 2026-11-02 (після зеленого прогону на `main`): `spec`, `app`, `conformance`,
  `db-check`, «Ворота: fallow audit», «Покриття: доменна підлога» (GitHub Actions). «Порада: вразливі залежності»
  (`npm audit`) — дорадча завжди.

Що працює:

| Шар | Де | Статус |
|---|---|---|
| тестові правила лінтера (`@vitest/eslint-plugin` 1.6.27, `eslint-plugin-playwright` 2.12.1) | `eslint.config.mjs` → `npm run lint` у job `app` | обов'язковий одразу |
| `fallow audit` (3.35.0) — лише нові знахідки відносно бази PR | `quality.yml`, «Ворота: fallow audit» | обов'язковий з 2026-11-02 |
| покриття з підлогою для 10 доменних модулів | `quality.yml`, «Покриття: доменна підлога» (+ таблиця в Summary) | обов'язковий з 2026-11-02 |
| `npm audit --omit=dev --audit-level=high` | `quality.yml`, «Порада: вразливі залежності» | лише попередження |
| локально перед PR | `npm run gates` (lint + typecheck + `fallow audit --base origin/main`) | — |

Знахідки лінтера в тому самому PR — 12, виправлено: усі тести сторінок і дій мокали власний `@/lib/org/viewer`
(`no-restricted-syntax`). Тепер працює справжній `getViewer`, а помічник `tests/support/viewer.ts` підставляє сесію й
профіль у мок клієнта Supabase (дозволений мок). Покриття `src/lib/org/viewer.ts` — 0 % → 91 % рядків. Правил не
вимкнено, рівня `warn` немає.

Розбір першого повного прогону `fallow` (той самий — в описі PR воріт):

| Група знахідок | Скільки | Справжня / навмисна / хибна | Дія і причина |
|---|---|---|---|
| unused file `src/lib/supabase/client.ts` (браузерний клієнт шаблону) | 1 | справжня | видалено: усі запити — на сервері |
| unused file `src/components/ui/card.tsx` (shadcn) | 1 | справжня | видалено: застосунок використовує власний `Card` з `src/components/ui/index.tsx` |
| unused export `AC_ID_GLOBAL` (`scripts/lib/spec-lib.mjs`) | 1 | справжня | прибрано (у файлі теж не використовувався) |
| duplicate exports `addRequester` / `removeRequester` (`src/app/admin/actions.ts` ↔ `src/lib/org/membership.ts`) | 1 пара | навмисна / борг | лишено: Server Actions (`src/app/admin/actions.ts`) пишуть у `department_members` напряму; однойменні функції `src/lib/org/membership.ts` — модель правил, яку викликають лише тести; імпорти однозначні. Борг для треку B: частина тестів AC-ORG-01/03 перевіряє цю модель, а не дію — правило в базі доводять тести дій і бази |
| дублікати коду | 9 груп | навмисна / борг | лишено (ворота валять лише нові): `globals.css` — два однакові блоки темної теми навмисно (DESIGN.md, розділ 2); `check-design-tokens` ↔ `check-server-boundary` і `check-auth-rules` ↔ `check-server-boundary` — однаковий обхід файлів у наших скриптах WS7; `profile/page.tsx` ↔ `purchases/options.ts`, `admin/staff/[id]` ↔ `profile`, `purchases/lists.ts`, `org/membership.ts`, `admin/actions.ts` — дрібні повтори; усе — окремим рефакторингом |
| складність скриптів шаблону курсу (`check-spec`, `create-demo-users`) | 4 | навмисна | `health.ignore` з причиною: початковий коміт шаблону, ми їх не змінюємо; `check-spec` має тести в `tests/scripts`, `create-demo-users` — локальний скрипт поза CI |
| складність наших скриптів WS7 (`check-auth-rules` ×4, `check-design-tokens` ×3, `check-server-boundary` ×2) | 9 | справжня (борг) | не ігноруємо: наш код (kdeineko-tech/school-purchasing#27, #32); `check-auth-rules` і `check-design-tokens` мають тести в `tests/scripts`, `check-server-boundary` — ні; ворота валять лише нові знахідки, спрощення й тест — окремою задачею |
| складність нашого коду застосунку (`purchases/[id]/page.tsx`, `admin/staff/[id]/page.tsx` ×2, `profile/page.tsx`, `admin/departments/page.tsx`, `api/health/route.ts`) | 6 | справжня (борг) | лишено як контекст: успадковане, ворота не валять; спрощення — окремими задачами |
| складність `src/components/ui/open-book.tsx` (декоративна 3D-книга входу) | 3 | навмисна | лишено: анімація за кадрами |

Відомі хибні тривоги на нашому стеку прибрано ще до прогону — `ignoreDependencies` з матеріалів курсу:
`@tailwindcss/turbopack` (Tailwind 4 підключено рядком у `next.config.ts`) і `@vitest/coverage-v8` (Vitest вантажить
провайдер покриття за назвою з конфігу). У нашому прогоні хибних знахідок не було.

Після розбору повний `npx fallow` (main після kdeineko-tech/school-purchasing#53, без файлу покриття — CRAP лише оцінка): мертвого
коду 0; лишаються пара однакових назв, 9 груп дублікатів і 18 складних функцій з таблиці — усе успадковане, `fallow
audit` валить лише нові. У першому прогоні до `health.ignore` складних функцій було 23; `getViewer` після виправлення
моків (покриття 91 %) у списку більше немає.

## B. Якість тестів

PR: гілка `task/test-quality` (Stryker 10.1.1, `scripts/mutation-check.mjs` з матеріалів курсу, мутанти на правила наших AC).

### Рівень для кожного AC

| AC | Де живе правило | Рівень | Чому | Тест |
|---|---|---|---|---|
| AC-APR-04 | сторінка `src/app/approvals/page.tsx:20` (`role === "requester"` → відмова); політика `purchases_select_visible` (`20261025185729_purchases.sql:87`); `decide_purchase` (`20261025223225_purchase_decisions.sql:38`) | база (PGlite) + сторінка; текст на екрані — UAT | відмова живе в RLS і функції бази: без тесту бази обхід сторінки (прямий `select` чи `rpc`) нічим не доведено | [tests/db/decisions.test.ts:91](https://github.com/kdeineko-tech/school-purchasing/blob/dba9155/tests/db/decisions.test.ts#L91), [tests/db/decisions.test.ts:98](https://github.com/kdeineko-tech/school-purchasing/blob/dba9155/tests/db/decisions.test.ts#L98), [tests/purchases/decisions.test.ts:187](https://github.com/kdeineko-tech/school-purchasing/blob/dba9155/tests/purchases/decisions.test.ts#L187) |
| AC-FRM-06 | `validateSubmission` (`src/lib/purchases/form.ts:76`); `submit_purchase` — `NO_LINES` (`20261026100553_purchase_line_fields.sql:57`) | unit + база (PGlite) + дія | сервер відмовляє ще до бази, база — вдруге для прямого `rpc`; збережені значення форми — UAT | [tests/purchases/form.test.ts:72](https://github.com/kdeineko-tech/school-purchasing/blob/dba9155/tests/purchases/form.test.ts#L72), [tests/purchases/submit.test.ts:93](https://github.com/kdeineko-tech/school-purchasing/blob/dba9155/tests/purchases/submit.test.ts#L93), [tests/db/purchases.test.ts:82](https://github.com/kdeineko-tech/school-purchasing/blob/dba9155/tests/db/purchases.test.ts#L82) |
| AC-FRM-03 | `formPurchaseTypes` (`src/lib/purchases/form.ts:60`) і `permissionsFromRow` (`src/lib/org/permissions.ts:37`) — список типів з дозволу в профілі | unit + сторінка | правило — чистий TS; подання напряму в обхід форми — AC-FRM-04 (не з наших 3) | [tests/purchases/form.test.ts:42](https://github.com/kdeineko-tech/school-purchasing/blob/dba9155/tests/purchases/form.test.ts#L42), [tests/purchases/pages.test.ts:62](https://github.com/kdeineko-tech/school-purchasing/blob/dba9155/tests/purchases/pages.test.ts#L62) + нова контрольна пара `tests/purchases/pages.test.ts:73` |

### Покриття

`npm run test:coverage` після PR (разом: рядки 81 %, гілки 68 %; підлога для 10 доменних модулів тримається).

| Файл за AC | Рядки | Гілки | Чим доведено, якщо нижче |
|---|---|---|---|
| `src/lib/purchases/form.ts` | 100 % | 96 % | — (у `FLOORED`) |
| `src/lib/org/permissions.ts` | 100 % | 100 % | — (у `FLOORED`) |
| `src/lib/purchases/options.ts` | 100 % | 62 % | гілки — помилки читання бази; правило AC-FRM-03 — у `formPurchaseTypes` |
| `src/app/approvals/page.tsx` | 100 % | 83 % | гілка «не увійшов» — AC-APR-04 її не стосується; відмова — RLS і `decide_purchase` (SQL-мутанти A1, A2) |
| `src/app/purchases/actions.ts` | 97 % | 82 % | `NO_LINES` у базі — SQL-мутант F1 |
| `src/app/purchases/new/purchase-form.tsx` | 50 % | 63 % | клієнтська форма (стан полів після помилки) — UAT AC-FRM-06 |
| політики RLS і функції SQL | — | — | JS-покриття їх не бачить: SQL-мутації нижче |

### Доказ мутацією

Stryker на модулях наших AC (`--mutate src/lib/purchases/form.ts,src/lib/org/permissions.ts,src/lib/org/access.ts`):
**92,67 % → 94,00 %** (139 → 141 вбитих зі 150; ще 4 мутанти не компілюються — `errors`); `permissions.ts` 90,48 % → **100 %**.

| Мутант (файл:рядок, що змінено) | AC під загрозою | До | Тест, посилений з тексту AC | Після |
|---|---|---|---|---|
| `src/lib/org/permissions.ts:42` BlockStatement → `{}` і `:43` ObjectLiteral → `{}` (`permissionsFromRow` губить дозволи з рядка профілю) | AC-FRM-03 — нерозрізнений вхід: тест AC-FRM-03 бере працівника **без** дозволу, тож мутант «у всіх немає дозволів» дає той самий список | вижили (2) | `tests/purchases/pages.test.ts:73` «AC-FRM-03: контрольна пара — з дозволом «Self-purchase» у профілі в виборі типу є обидва типи» (до «лише Purchasing department» з AC-FRM-03); перевірено вручну: червоний на мутанті, зелений на коді | убиті |

Інші вижилі в `form.ts` (8) — не на рядках наших AC або еквівалентні:

| Мутант | Категорія | Причина |
|---|---|---|
| `form.ts:87` `typeof raw !== "string"` → `false`, `form.ts:91` `catch {}` → порожній (`parseLines`, шлях AC-FRM-06) | еквівалентний | не-рядок чи зіпсований JSON однаково дають `[]`: `JSON.parse` нерядка або кидає (→ `catch`), або повертає не-масив (→ `!Array.isArray` → `[]`); порожній `catch` теж веде до `return []` |
| `form.ts:95` `text()` (2) | прогалина AC-FRM-15 (не з наших 3) | поле рядка не-рядком у JSON; борг для AC-FRM-15 |
| `form.ts:78` `every` → `some` | прогалина AC-FRM-15 (не з наших 3) | у тестах AC-FRM-15 один рядок, а на одному рядку `every` і `some` однакові; потрібен тест з двома рядками; борг |
| `form.ts:55` сортування відділів адміністратора (2) | не наш AC (AC-ORG-22) | порядок у списку не перевіряється; борг |
| `form.ts:26`, `form.ts:32` формат дати подання | не наш AC (AC-FRM-10) | жоден тест не перевіряє результат `formatSubmittedAt`; борг |

- SQL-мутації (`npm run mutation:sql -- --markdown`), гарнес — наш `tests/db/supabase-pglite.ts`:

| Мутант | AC | Що зламано | Вердикт | Який тест упав |
|---|---|---|---|---|
| A1 | AC-APR-04 | `decide_purchase`: вирішує будь-хто з відділу заявки, а не лише його схвалювач (прибрано `and m.approves`) | KILLED | AC-APR-04: працівник 1 з роллю requester не вирішує заявку — FORBIDDEN, статус той самий |
| A2 | AC-APR-04 | `purchases_select_visible`: заявки відділу бачить будь-хто з входом, а не лише схвалювач відділу | KILLED | AC-APR-03: Марія не бачить заявки відділу «Office» за прямим запитом; AC-APR-04: заявник не бачить чужих заявок свого відділу, тож і списку для рішення |
| F1 | AC-FRM-06 | `submit_purchase`: порожній масив рядків більше не дає `NO_LINES` | KILLED | AC-FRM-06: закупівля без жодного рядка — NO_LINES, нової заявки немає (і для NULL чи не-масиву) |

  Мутаційний бал SQL: 3 з 3 (100 %), ≈3 с. AC-FRM-03 у SQL правила не має (подання в обхід форми — AC-FRM-04).
- Еквівалентні мутанти: `form.ts:87` і `form.ts:91` (вище); `Stryker disable` не додавали — код не змінюємо, причину
  записано тут.
- Stryker і тест AC-LANG-01: `tests/org/english.test.ts` сканує файли через `git ls-files`, а в пісочниці Stryker
  `.git` немає — тест виключено лише з `vitest.stryker.config.mts` (з причиною); у `npm test` і CI він працює.
- Борг з треку A: функції `addRequester` / `removeRequester` у `src/lib/org/membership.ts` викликають лише тести
  (дії пишуть у базу напряму) — частина тестів AC-ORG-01/03 перевіряє модель; не наші 3 AC, окрема задача.

## C. UAT на проді

Специфікація: `tests/e2e/purchases.spec.ts` (3 AC, тег `@uat`), вхід — `tests/e2e/auth.setup.ts` (роль `requester` =
`pm-requester@example.test`, пароль — `DEMO_USER_PASSWORD` з `.env.local`, без запису). Прогін — `npm run uat -- --url
https://school-purchasing-lemon.vercel.app --grep-invert '@writes'` у звичайному терміналі.

| AC | Специфікація | Тест (твердження) | Агент | Вердикт | Кадр |
|---|---|---|---|---|---|
| AC-APR-04 | `tests/e2e/purchases.spec.ts` (AC-APR-04) | passed | Haiku: PASS | **PASS** (R6) | `docs/qa/uat/2026-11-03/frames/AC-APR-04-then-1.png` |
| AC-FRM-06 | `tests/e2e/purchases.spec.ts` (AC-FRM-06) | passed | Haiku: PASS | **PASS** (R6) | `docs/qa/uat/2026-11-03/frames/AC-FRM-06-then-1.png` |
| AC-FRM-03 | `tests/e2e/purchases.spec.ts` (AC-FRM-03) | passed | Haiku: PASS | **PASS** (R6) | `docs/qa/uat/2026-11-03/frames/AC-FRM-03-then-1.png` |

- Звіт: `docs/qa/uat/2026-11-03/report.md` (і `manifest.json`), прод `56fad31`, 03.11.2026 16:45, Playwright 20,9 с.
- **UAT знайшов ваду продукту.** Перший прогін на проді (до `56fad31`): AC-FRM-06 — **FAIL**, і твердження, і Haiku за
  кадром — після «Add at least one line» відділ скидався на «Select a department» (React 19 скидає форму після дії
  `<form action>`). Виправлення — kdeineko-tech/school-purchasing#56 (подання через `onSubmit` без автоскидання);
  прогін на preview #56 — 3 з 3 PASS; на проді після деплою — 3 з 3 PASS (цей звіт). Unit- і page-тести (Vitest без
  DOM) ваду не бачили.
- **Збій інструмента в першому прогоні.** AC-APR-04 і AC-FRM-03: твердження пройшли, Haiku — PASS, але `afterEach`
  (`attachRuntimeErrors` з матеріалів) чекав відповіді фонового запиту до тайм-ауту 60 с → R1 FAIL. Виправлено в
  `tests/e2e/support/uat.ts`: відповідь кожного запиту — не довше 2 с, запит без відповіді не є 5xx.
- Відео: вкладення в описі PR `task/uat` (не в git).
- Рецензент: `claude-haiku-5-5` (суперечок не було, Sonnet не викликався); $0,2884 за 3 AC (ціни API; за підпискою — у
  межах ліміту плану).
- Негативний контроль: NC-1 (`tests/e2e/negative-controls.spec.ts`, `npm run uat:nc`) — у твердженні навмисно
  «Access denied» замість «Not enough permissions»: твердження впало, **Haiku сказав PASS**, підсумок — **FAIL** (R1:
  агент не перекриває впале твердження). Звіт NC — `test-results/uat-report-nc/report.md` (не в git), рядок — в описі PR.
- Дані: лише читання, `@writes` немає; прибирання — 0 синтетичних акаунтів створено й лишилось.
- Що агент не оцінює з кадру (лише твердження, `hidden`): «статуси заявок не змінилися» (AC-APR-04), «закупівлю не
  подано» (AC-FRM-06), відсутність «Self-purchase» у нерозкритому нативному списку (AC-FRM-03).

### Приймання PM

| AC | Рішення PM | Посилання |
|---|---|---|
| AC-APR-04 | <!-- ✅ / ❌ / NEEDS-HUMAN → … --> | <!-- коментар-підпис або issue «Відхилення від вимог» --> |
| AC-FRM-06 | <!-- ✅ / ❌ / NEEDS-HUMAN → … --> | <!-- коментар-підпис або issue «Відхилення від вимог» --> |
| AC-FRM-03 | <!-- ✅ / ❌ / NEEDS-HUMAN → … --> | <!-- коментар-підпис або issue «Відхилення від вимог» --> |

## D. Eval рецензента

- PR з вадами (не злитий): https://github.com/kdeineko-tech/school-purchasing/pull/58 — гілка `task/approvals-polish`;
  усі вади пройшли обов'язкові перевірки CI, включно з тестами бази на PGlite з новою міграцією.
- Ключ і таблиця: https://github.com/kdeineko-tech/school-purchasing/pull/58#issuecomment-6619467379
- Рецензенти: CodeRabbit (`.coderabbit.yaml`, профіль ASSERTIVE) і `/code-review high` (`claude -p`, лише читання,
  `--setting-sources project`, модель claude-opus-5-5: 72 с / $0,52 і 64 с / $0,45).

| # | Вада (ключ) | CodeRabbit | `/code-review high` |
|---|---|---|---|
| 1 | права в даних: `supabase/migrations/20261103160000_purchases_select_policy.sql` — політика без `is_active_user()` | знайшов (Major, CWE-862): «Деактивований користувач із чинним JWT може читати власні заявки або заявки свого відділу» | знайшов: «Deactivated users can read purchases again, even though the comment says visibility is unchanged» |
| 2 | логіка: `src/lib/purchases/lists.ts` — без `.neq("author_id")` лічильник рахує власні заявки (AC-APR-01) | пропустив і закріпив: «Збережіть поточний department-wide `total`… тести очікують `3`, а не `2`» | знайшов: «The "Awaiting your decision" number is now too high» |
| 3 | тести: `tests/purchases/home.test.ts` — новий тест AC-APR-01 перевіряє мок і очікує 3 | пропустив: посаджений тест став аргументом | знайшов: «The new home test locks in the wrong count… The fake database ignores `.neq`» |
| П | приманка: `canOpenApprovals` (`src/lib/org/access.ts`) — поведінка та сама | шум: «Додайте AC ID до назви тесту»; хибної тривоги щодо прав немає | порада, не вада: «canOpenApprovals isn't reused», «ignores isActive» |

- Інші знахідки: CodeRabbit — «Оновіть матрицю відповідності для AC-APR-01» (процедурне, слушне для справжнього PR);
  `/code-review` — наслідок вади 2 з `limit` 5 (слушна), застарілий коментар моку (слушна).
- Правило, що закриває пропуск: kdeineko-tech/school-purchasing#59 (`AGENTS.md`, «Процес і ролі») — лічильник і список
  рахуються з тих самих фільтрів запиту; фільтр, перенесений у TS, — «must fix»; тест на моках, що ігнорують аргументи
  `.eq/.neq/.in`, фільтра не доводить, очікуване число — з тексту AC.
- Повторний прогін (після `git merge main`, коміт `94f6004`):
  - CodeRabbit (`@coderabbitai full review`) — вада 2 **знайдена**: «Виключіть власні заявки з кількості для рішення…
    Поверніть фільтр до запиту»; вада 3 — частково («Оновіть очікування в `tests/purchases/home.test.ts`»); вада 1 —
    тред з першого прогону відкритий;
  - `/code-review high` — усі 3, вада 2 піднялась на 1-ше місце з цитатою правила («must fix»), вада 3 — з цитатою
    «Тест на моках Supabase… фільтра не доводить».
- Висновок: `/code-review high` надійніший на логіці й тестах; CodeRabbit сильний на безпеці, але посаджений тест його
  переконав. Правило закрило пропуск щодо лічильника; «тест перевіряє мок» CodeRabbit і з правилом бачить лише частково.
  Обидва рецензенти дорадчі — жодна вада не зупинила CI, тож рішення лишається за воротами й людиною.
