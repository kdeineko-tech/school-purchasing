# QA proof pack: зріз 2 — працівник подає закупівлю, схвалювач вирішує, інтерфейс англійською

<!--
Шаблон з koldovsky/2026-quitcode-08-quality-hw/materials/templates/proof-pack.template.md.
Заповнюємо по кроках WS8 (A → B → C → D). Посилання — на коміти, PR і прогони.
Жодних паролів і пароля від accounts.zip. Акаунти — лише адреси *@example.test.
Цей файл — вхід для конвеєра WS9: на кожен AC видно, чим він доведений.
-->

- Прод-URL: https://school-purchasing-lemon.vercel.app
- Вимоги: https://github.com/ValiaBihun/2026-quitcode-dream-team · джерело: issues · знімок 2026-11-02
- `/api/health` на момент UAT: <!-- заповнюємо в кроці C -->

## 3 AC

Усі три — лише читання: прод і preview ходять в одну базу, тож UAT нічого не записує (AC-FRM-06 — відмова сервера,
закупівлю не подано). Акаунт — `pm-requester@example.test` (роль `requester`, без дозволу «Самостійна закупівля»).

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
- Обов'язкові перевірки в `solo-main`: «Ворота: fallow audit», «Покриття: доменна підлога» — додає власниця репо після
  зеленого прогону на `main` <!-- дата -->. «Порада: вразливі залежності» (`npm audit`) — дорадча завжди.

Що працює:

| Шар | Де | Статус |
|---|---|---|
| тестові правила лінтера (`@vitest/eslint-plugin` 1.6.27, `eslint-plugin-playwright` 2.12.1) | `eslint.config.mjs` → `npm run lint` у job `app` | обов'язковий одразу |
| `fallow audit` (3.35.0) — лише нові знахідки відносно бази PR | `quality.yml`, «Ворота: fallow audit» | дорадчий → обов'язковий |
| покриття з підлогою для 10 доменних модулів | `quality.yml`, «Покриття: доменна підлога» (+ таблиця в Summary) | дорадчий → обов'язковий |
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
| duplicate exports `addRequester` / `removeRequester` (`src/app/admin/actions.ts` ↔ `src/lib/org/membership.ts`) | 1 пара | навмисна | лишено: Server Action обгортає доменну функцію з тією ж назвою; бочок немає, імпорти однозначні |
| дублікати коду | 9 груп | навмисна / борг | лишено (ворота валять лише нові): `globals.css` — два однакові блоки темної теми навмисно (DESIGN.md, розділ 2); `check-design-tokens` ↔ `check-server-boundary` і `check-auth-rules` ↔ `check-server-boundary` — однаковий обхід файлів у наших скриптах WS7; `profile/page.tsx` ↔ `purchases/options.ts`, `admin/staff/[id]` ↔ `profile`, `purchases/lists.ts`, `org/membership.ts`, `admin/actions.ts` — дрібні повтори; усе — окремим рефакторингом |
| складність скриптів шаблону курсу (`check-spec`, `create-demo-users`) | 4 | навмисна | `health.ignore` з причиною: початковий коміт шаблону, ми їх не змінюємо; `check-spec` має тести в `tests/scripts`, `create-demo-users` — локальний скрипт поза CI |
| складність наших скриптів WS7 (`check-auth-rules` ×4, `check-design-tokens` ×3, `check-server-boundary` ×2) | 9 | справжня (борг) | не ігноруємо: наш код (kdeineko-tech/school-purchasing#27, #32); `check-auth-rules` і `check-design-tokens` мають тести в `tests/scripts`, `check-server-boundary` — ні; ворота валять лише нові знахідки, спрощення й тест — окремою задачею |
| складність нашого коду застосунку (`purchases/[id]/page.tsx`, `admin/staff/[id]/page.tsx` ×2, `profile/page.tsx`, `admin/departments/page.tsx`, `api/health/route.ts`) | 6 | справжня (борг) | лишено як контекст: успадковане, ворота не валять; спрощення — окремими задачами |
| складність `src/components/ui/open-book.tsx` (декоративна 3D-книга входу) | 3 | навмисна | лишено: анімація за кадрами |
| `ignoreDependencies` `@tailwindcss/turbopack`, `@vitest/coverage-v8` (з матеріалів) | 2 | хибна | Tailwind 4 підключено рядком у `next.config.ts`; провайдер покриття Vitest вантажить за назвою з конфігу |

Після розбору повний `npx fallow` (main після kdeineko-tech/school-purchasing#53, без файлу покриття — CRAP лише оцінка): мертвого
коду 0; лишаються пара однакових назв, 9 груп дублікатів і 18 складних функцій з таблиці — усе успадковане, `fallow
audit` валить лише нові. У першому прогоні до `health.ignore` складних функцій було 23; `getViewer` після виправлення
моків (покриття 91 %) у списку більше немає.

## B. Якість тестів

<!-- крок B: рівень для кожного AC, покриття, доказ мутацією -->

## C. UAT на проді

<!-- крок C: специфікації Playwright, звіт, кадри, вердикт агента, приймання PM -->

## D. Eval рецензента

<!-- крок D: гілка з 3 вадами й приманкою, таблиця з цитатами, правило, повторний прогін -->
