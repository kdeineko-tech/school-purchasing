# Runbook: School Purchasing

**Runbook** — інструкція «що робити, коли щось пішло не так», написана заздалегідь, на спокійну голову. Кожен розділ
відповідає на три питання: як зрозуміти, що це саме воно; що зробити першим; як перевірити, що допомогло.

Останнє оновлення: 2026-11-28, версія продукту: `v1.0.0` (реліз-кандидат на staging, тег — після приймання PM).
Операційні вимоги PM (SLO, матриця SEV1–3, RPO/RTO, хто говорить з клієнтом):
[ValiaBihun/2026-quitcode-dream-team#83](https://github.com/ValiaBihun/2026-quitcode-dream-team/issues/83).

Секрети тут лише **назвами** змінних. Значень, паролів і chat id у цьому файлі немає й не буде: репо публічне.

## Хто отримує алерт і кого кликати

| Роль | Хто (GitHub-логін) | Коли кликати |
|---|---|---|
| Черговий розробник (отримує алерт) | @kdeineko-tech | будь-який червоний smoke чи повідомлення «SERVER ERROR» |
| PM (говорить із клієнтом) | @ValiaBihun | SEV1–SEV2: одразу; SEV3 — у робочий час |
| Резерв | немає (розробниця одна в цій реалізації) | — |

- **Канал алерту:** Telegram-група «Alerts✨»: розробниця, PM і бот. Бот пише туди:
  - з `.github/workflows/smoke.yml` — «ЧЕРВОНИЙ SMOKE» (секрети GitHub `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`);
  - з `src/instrumentation.ts` — «SERVER ERROR» (ті самі назви, але як серверні змінні Vercel, Production і Preview,
    без `NEXT_PUBLIC_`).
- **Серйозність** — за матрицею SEV1–3 PM (розділ 2 у #83). Вагаємось між двома рівнями — беремо вищий.
- **Клієнту пише PM** за шаблоном `docs/incident-message.md` у репо вимог: SEV1–SEV2 протягом 2 годин у робочий час.

## Де що

| Що | Адреса / де шукати |
|---|---|
| Прод | https://school-purchasing-lemon.vercel.app (гілка `main`) |
| Staging | https://school-purchasing-git-staging-kate-bdb7.vercel.app (гілка `staging`, змінна лише для гілки `APP_ENV=staging`; база — проєкт staging) |
| Здоров'я | `/api/health` → `{"ok":true,"sha":"…","env":"production","db":"ok","appEnv":null,"supabaseRef":"tyxyvgilaoykzftynvtm"}`; на staging — `"appEnv":"staging"`, `"supabaseRef":"aiqatxeupwveczluemen"` |
| Прогони smoke | Actions → `smoke`: job `prod` (щодня ≈ 07:23 за Києвом і вручну), job `deploy` (кожен успішний не-прод деплой Vercel через `repository_dispatch`) |
| Vercel | проєкт `school-purchasing` → Deployments, Logs |
| Supabase — прод | ref `tyxyvgilaoykzftynvtm` (ref — короткий ідентифікатор з адреси `https://<ref>.supabase.co`, не секрет) → Logs, Advisors; Vercel Production |
| Supabase — staging | проєкт `school-purchasing-staging`, ref `aiqatxeupwveczluemen` → Logs, Advisors; Vercel Preview (усі гілки) і гілка `staging`; міграції — CI, job `db-deploy-staging` перед `db-deploy` |
| Запобіжник ref у CI | змінні репо `SUPABASE_STAGING_REF`, `SUPABASE_PROD_REF`: jobs `db-deploy-staging` і `db-deploy` зупиняються, якщо `SUPABASE_DB_URL` веде не в той проєкт |
| Статус-сторінки | vercel-status.com · status.supabase.com · githubstatus.com · status.openrouter.ai — дивимось **наш** компонент і час інциденту |
| Доступ PM до staging | Deployment Protection на preview **вимкнено**: staging відкривається без входу у Vercel, вхід у застосунок — акаунтами з `accounts.zip`. Ціна рішення: будь-хто з адресою бачить сторінку входу staging і всіх preview (дані там синтетичні). Якщо захист увімкнемо (Standard Protection), smoke потребує секрет `VERCEL_AUTOMATION_BYPASS_SECRET` (GitHub Secrets), а PM — запит доступу чи спільне посилання |

## 1. Червоний smoke

**Як зрозуміти:** у Telegram прийшло «ЧЕРВОНИЙ SMOKE» із середовищем, адресою, комітом і посиланням на прогін.

1. Відкрийте посилання на прогін → крок smoke → рядки `::error::`:

   | Рядок `::error::` містить | Що це найімовірніше | Куди далі |
   |---|---|---|
   | `за захистом Vercel` / `секрет обходу` | увімкнули Deployment Protection або секрет `VERCEL_AUTOMATION_BYPASS_SECRET` застарів | розділ 4 (ротація) |
   | `Supabase призупинено` | база на паузі | розділ 3 |
   | `ключ NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | хибний ключ у змінних Vercel цього середовища | розділ 4 |
   | `показує <sha>, а очікувався <sha>` | деплой не пройшов або був відкат (автопросування вимкнене) | розділ 2 |
   | `sha=local` / `немає sha` | у Vercel вимкнено «Automatically expose System Environment Variables» | увімкнути, Redeploy |
   | `HTTP 5xx` на `/` чи `/login` | зламаний код чи змінна середовища | крок 3; паралельно — чи прийшло «SERVER ERROR» з маршрутом і стеком |
   | `недоступний` | Vercel чи мережа | крок 2, повтор через 5 хв |

2. **Це ми чи провайдер? (1–2 хв)** Статус-сторінки з таблиці «Де що». Є відкритий інцидент у нашому компоненті й час
   збігається — посилання в issue інциденту і PM, стежимо. Немає — шукаємо в себе. Зелена статус-сторінка не означає,
   що з нашим проєктом усе гаразд (пауза бази, ліміти, наш код).
3. **Прод чи ні?** Job `deploy` (preview, staging) — користувачі не постраждали: SEV3, виправляємо в робочому порядку.
   Job `prod` — визначте SEV за матрицею PM і напишіть у групу «беру, SEV<N>».
4. **Спершу зупинити шкоду, потім шукати причину.** Прод зламав останній деплой — відкат (розділ 2), потім розбір.
   Журнали Vercel на Hobby живуть **1 годину**: потрібні рядки — одразу в issue (без даних користувачів).
5. **Розбір** — з агентом у профілі «лише пропонує» (розділ 7) або вручну. Агент пропонує, виправляє людина.
6. **Перевірка:** Actions → smoke → Re-run (або Run workflow для `prod`) — зелений; у групу: «SEV<N> закрито, причина: …».
7. Після SEV1–SEV2 (і після кожного дрилу) — postmortem `docs/incidents/<YYYY-MM-DD>-<slug>.md` за шаблоном ops-kit.

## 2. Відкат проду і повернення автоматичного просування (Promote)

**Коли:** прод зламав щойно розгорнутий коміт, а виправлення вперед займе довше за 30 хв.

1. Vercel → Deployments → попередній робочий прод-деплой → **Instant Rollback**. На Hobby — **лише на один попередній**
   прод-деплой.
2. Перевірте прод: `/api/health` — `db: ok`, `sha` попереднього коміту; `/login` відкривається.
3. **Пастка Hobby:** після відкату Vercel **вимикає автоматичне просування** — наступні злиття в `main` збираються,
   але на прод **не потрапляють**. Smoke `prod` червонітиме з «показує <старий sha>, а очікувався <новий>».
4. Виправлення — звичайним PR у `main` (CI, CodeRabbit). Коли деплой виправлення готовий: Vercel → цей деплой →
   **Promote**. Це повертає автоматичне просування. Перевірка — зелений smoke `prod` з новим `sha`.
5. Відкат **не змінює** базу й міграції. Код, на який відкочуємось, має працювати з поточною схемою — тому міграції в
   нас лише додають (expand), а не видаляють.

Хто робить: розробниця (@kdeineko-tech). Агент відкат і Promote не робить ніколи.

## 3. База на паузі

**Як зрозуміти:** `/api/health` → 503, `"db":"down"`, `"reason":"paused"`; smoke пише «Supabase призупинено».
Supabase Free ставить проєкт на паузу після 7 днів без достатньої активності. Прод і staging засинають **незалежно**:
червоний `prod` — прод-проєкт (`tyxyvgilaoykzftynvtm`); червоний `deploy` для staging чи preview — проєкт staging
(`aiqatxeupwveczluemen`). Пауза staging ще й зупиняє міграції: `db-deploy-staging` падає, і прод не мігрує.

1. Supabase Dashboard → **проєкт, що на паузі** (звірте ref) → **Resume project**.
2. Повторіть smoke — зелений.
3. Запишіть у групу, коли була пауза і скільки тривала.

Як не допустити: прод будить щоденний smoke `prod` (запит до бази в `/api/health`). Staging щоденний smoke **не
будить** — **перед UAT, демо чи дрилом: Dashboard → проєкт staging активний, інакше Resume project.** Перед demo day —
перевірити обидва проєкти за день до показу (рішення PM: після курсу продукт на паузі, #83 розділ 5).

## 4. Ротація ключа + redeploy

**Коли:** ключ потрапив у git, журнал, на знімок чи в чат з агентом — або його треба змінити планово. Порядок залежить
від того, чи ключ уже в чужих руках:

- **Витік (секрет скомпрометовано): спершу відкликати старий → новий ключ → замінити всюди → redeploy → перевірити.**
  Поки старий ключ чинний, ним може скористатися будь-хто, тож простій до redeploy (AI-помічник «unavailable», smoke
  червоний, алерт не дійде) прийнятний. Термінові: `SUPABASE_DB_URL` (пароль бази), `TELEGRAM_BOT_TOKEN`,
  `OPENROUTER_API_KEY`, `VERCEL_AUTOMATION_BYPASS_SECRET`, секретний ключ Supabase. `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  публічний за призначенням (він і так у браузері) — його поява в журналі чи на знімку не витік, ротуємо планово.
- **Планова ротація (без простою): новий ключ → замінити всюди → redeploy → перевірити → лише тоді видалити старий.**

| Що | Де новий | Де замінити | Що ще |
|---|---|---|---|
| Ключі **прод-проєкту** Supabase (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; секретний — лише локально для `users:demo`) | прод-проєкт → Settings → API Keys | Vercel → Environment Variables → **лише Production** (тип Config для `NEXT_PUBLIC_*`) | **Redeploy** проду: `NEXT_PUBLIC_*` вбудовуються під час збірки |
| Ключі **проєкту staging** | проєкт staging → Settings → API Keys | Vercel → Preview (усі гілки); локальний `.env.local` | Redeploy `staging`, новий push у відкриті PR |
| `SUPABASE_DB_URL` (після зміни пароля бази) | Connect у тому самому проєкті (Session pooler) | GitHub → Environments → `production` чи `staging` | наступний прогін CI: запобіжник ref має пройти |
| `VERCEL_AUTOMATION_BYPASS_SECRET` (лише якщо захист увімкнено) | Vercel → Settings → Deployment Protection → Protection Bypass for Automation | GitHub → Settings → Secrets → Actions | redeploy staging; повторний smoke `deploy` |
| `TELEGRAM_BOT_TOKEN` | Telegram, BotFather (перевипуск токена) | GitHub Secrets **і** змінні Vercel (Production, Preview) | ручний червоний прогін smoke і `/api/ops/test-error` на staging → обидва повідомлення прийшли |
| `OPENROUTER_API_KEY` | OpenRouter → Keys | Vercel (Production, Preview), `.env.local` | redeploy; виклик «Suggest lines» на staging → рядок `llm.call` зі `state: ok`; старий ключ видалити |

Перевірка: зелений smoke на прод і staging. Запис у групу: що ротували і чому — без значень.

## 5. Де журнали і скільки вони живуть

| Що | Де | Скільки живе (безкоштовні тарифи) |
|---|---|---|
| Журнали запитів Vercel (`llm.call`, `onRequestError`, помилки) | Vercel → Logs; фільтр `llm.call` чи `level:error` | **1 година** (Hobby) |
| Observability Vercel | Vercel → Observability | 12 годин (Hobby) |
| Журнали збірки | Vercel → Deployments → деплой → Build Logs | поки є деплой |
| Журнали Supabase (API, Postgres, Auth) | Supabase → Logs | **1 день** (Free) |
| Журнал AI-помічника для SLO-2 (`ai_calls`) | база проду, таблиця `public.ai_calls`; SQL — нижче | поки є база (рядки не видаляються) |
| Прогони GitHub Actions (smoke, CI) | Actions | 90 днів (типове значення GitHub для публічного репо) |
| Алерти smoke і трекер помилок сервера | Telegram-група «Alerts✨» (власний `onRequestError`, без Sentry): маршрут, тип, назва помилки, digest, до 5 рядків стеку | поки їх не видалили |

Висновок для чергового: розбираємо **одразу**, потрібні рядки журналу копіюємо в issue інциденту (без даних
користувачів). Повний стек — у Vercel Logs за `digest` чи часом і маршрутом з повідомлення «SERVER ERROR».

### SLO-2: AI-помічник (журнал `ai_calls`)

SLO-2 PM: частка запитів «Suggest lines», після яких людина бачить пропозицію, а не «недоступний», — ціль 95% за 28
днів, бюджет помилок 5%. Джерело — таблиця `public.ai_calls` у базі проду: рядок на кожен виклик моделі (ті самі поля,
що `llm.call`, без опису, промпту й відповіді моделі), рядки не видаляються — зберігаються довше за потрібні 35 днів.
Помилки вводу (порожній чи задовгий опис) туди не пишуться: модель не викликали, у знаменник SLO-2 вони не входять.
Запис best-effort: якщо `log_ai_call` повернув помилку або не відповів за 2 с, пропозиція все одно повертається, а у
Vercel Logs з'являється `ai_calls.write_failed`. Таймаут не скасовує запит: рядок може з'явитися пізніше або не
з'явитися зовсім. Відсутній рядок SQL нижче не врахує, тож підсумок за 28 днів може бути неповним.
«Недоступний» = `state = 'unavailable'` (ліміт, таймаут, відповідь не за схемою, збій постачальника, немає ключа);
відмова на сторонній запит (`refused`) і ін'єкція (`injection`) — сервіс відповів як треба, це не збій.

Рахуємо в Supabase → SQL Editor проєкту **проду** (лише `select`; DDL у SQL Editor — ніколи). Доба — за Києвом.

Щодня — частка за кожну з останніх 28 діб:

```sql
select (created_at at time zone 'Europe/Kyiv')::date as day,
       count(*) as requests,
       count(*) filter (where state = 'unavailable') as unavailable,
       round(100.0 * count(*) filter (where state <> 'unavailable') / count(*), 1) as good_pct
from public.ai_calls
where created_at >= (date_trunc('day', now() at time zone 'Europe/Kyiv') - interval '27 days') at time zone 'Europe/Kyiv'
group by 1
order by 1 desc;
```

Підсумок за 28 днів і залишок бюджету помилок (5% запитів):

```sql
select count(*) as requests,
       count(*) filter (where state = 'unavailable') as unavailable,
       round(100.0 * count(*) filter (where state <> 'unavailable') / nullif(count(*), 0), 1) as good_pct,
       floor(0.05 * count(*)) - count(*) filter (where state = 'unavailable') as budget_left
from public.ai_calls
where created_at >= (date_trunc('day', now() at time zone 'Europe/Kyiv') - interval '27 days') at time zone 'Europe/Kyiv';
```

`budget_left` < 0 — бюджет вичерпано: за операційними вимогами помічник лишається штатно недоступним, форма працює
вручну, черговий розбирає причину за `error_kind` (`rate_limited` — ліміт постачальника, `timeout` — повільна
відповідь):

```sql
select error_kind, count(*)
from public.ai_calls
where state = 'unavailable'
  and created_at >= (date_trunc('day', now() at time zone 'Europe/Kyiv') - interval '27 days') at time zone 'Europe/Kyiv'
group by 1
order by 2 desc;
```

## 6. Staging

- Гілка `staging` отримує зміни лише з `main`: `git merge --ff-only origin/main` і push; окремої розробки немає.
- **Власна база:** проєкт `school-purchasing-staging`. Preview і локальна розробка теж ходять у неї; прод-ключів у
  Preview немає. Дані — лише синтетичні (`*@example.test`), акаунти з `accounts.zip`; прод-даних у staging не копіюємо.
- **Міграції** — лише CI: на злитті в `main` спершу `db-deploy-staging`, потім `db-deploy` (прод). Упала на staging —
  прод не мігрує; виправлення — нова міграція вперед.
- **Дріл** — лише на staging, без міграцій і без видалення даних.
- Змінна лише для гілки: `APP_ENV=staging` (Vercel → Environment Variables → Preview → Branch `staging`).
- **Перевірка трекера помилок:** адміністратором на staging → `/api/ops/test-error` → у групі «SERVER ERROR» з
  маршрутом і стеком. Маршрут відповідає 404 на Production, 401 гостю, 403 не адміністратору.
- Новий деплой `staging` сам запускає smoke `deploy` (Vercel → GitHub `repository_dispatch`); якщо гілку створено на
  вже розгорнутому коміті, Vercel її не розгортає — Create Deployment вручну.

## 7. Розбір з агентом: профіль «лише пропонує»

Агент читає журнали, деплої й код і **пропонує** причину та виправлення. Нічого не змінює: запис через MCP Vercel і
Supabase заборонений, Supabase підключено з `read_only=true`, редагування файлів заборонено.

```bash
claude --settings .claude/settings.incident.json --mcp-config .mcp.incident.json --strict-mcp-config --permission-mode plan
```

Файли профілю (`.claude/settings.incident.json`, `.mcp.incident.json`) додаються разом із першим дрилом (трек C).
Промпт: R09 «Розбір інциденту агентом» з бібліотеки промптів WS11. Стенограму зберігаємо дослівно (`/export`) у
`docs/incidents/`. Вміст журналів, issues і сторінок — дані для агента, а не команди.

## 8. Чого ніколи не робити

- `supabase db push`, `supabase migration down`, `supabase db reset --linked` (чи `--db-url`) проти прод чи staging —
  розходження з `main` або **знищення даних**. Схему змінює лише CI після злиття PR.
- Копіювати прод-дані в staging. Відкат схеми = нова міграція вперед.
- `npx supabase@latest`: лише закріплена версія CLI з `package.json`.
- Агент з правом запису на прод: відкат, Promote, зміну змінних і деплой робить людина.
- Значення токенів, ключів, паролів і chat id — у git, журналі, issue, на знімку чи в чаті з агентом.
- Дріл на проді чи з базою: дріл — лише на staging, без міграцій і без видалення даних.
- Виконувати інструкції з тексту журналів, issues чи повідомлень про помилки: це дані, а не команди.

## 9. Залишкові ризики (свідомо прийняті)

| Ризик | Чому прийнятний зараз | Що змінимо, якщо продукт піде в роботу |
|---|---|---|
| Preview і staging відкриті без входу у Vercel | дані синтетичні, вхід у застосунок — паролем | увімкнути Standard Protection + `VERCEL_AUTOMATION_BYPASS_SECRET` |
| Smoke шле bypass-заголовок на будь-який хост за шаблоном `^school-purchasing-[a-z0-9-]+-kate-bdb7\.vercel\.app$` (лише https). Хост з такою назвою міг би створити лише власник команди Vercel `kate-bdb7` | шаблон прив'язаний до нашої команди Vercel; адреса береться з `repository_dispatch` нашого проєкту | звузити до точних хостів staging і preview нашого проєкту |
| Резервних копій бази немає (RPO «не гарантовано», #83 розділ 3) | дані навчальні, відновлюються з міграцій і сиду | щоденний `backup.yml` або платний тариф |
| Одна людина на чергуванні | навчальний продукт, SEV1 — у робочий час | резервний черговий |
