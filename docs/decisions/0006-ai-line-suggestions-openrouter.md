# 0006. AI-пропозиція рядка закупівлі: AI SDK + OpenRouter (безкоштовні моделі) + zod

- Статус: прийнято
- Дата: 2026-11-16
- AC: AC-AI-01, AC-AI-02, AC-AI-03, AC-AI-04, AC-AI-05, AC-AI-06

Взято з набору курсу: https://github.com/koldovsky/2026-quitcode-10-ai-features-hw/blob/main/materials/ai-feature/docs/decisions/NNNN-ai-feature-openrouter.md

## Контекст

Зріз 4 (вимога ValiaBihun/2026-quitcode-dream-team#71): працівник вставляє вільний опис покупки, а AI пропонує один
заповнений рядок закупівлі (назва, мета, кількість, ціна); працівник перевіряє його й подає закупівлю сам. Обмеження:

- Next.js 16.4 на Vercel Hobby; відповідь — за 15 секунд, інакше «Could not get a suggestion…» (AC-AI-04).
- Модель — безкоштовна через OpenRouter, ключ — власний. Ліміт безкоштовних моделей — 20 запитів/хв і 50/день на
  акаунт; вичерпаний ліміт — «The assistant is unavailable today…» (AC-AI-05, ліміт постачальника — #81).
- Безкоштовні ендпоінти можуть зберігати запити → лише синтетичні описи.
- Відповідь моделі недетермінована, а CI має бути без мережі й без секретів.

## Рішення

- Нові залежності (точні версії, як у наборі курсу): `ai@7.0.162`, `@openrouter/ai-sdk-provider@3.1.0`, `zod@4.6.7`,
  `server-only@0.0.1`; скрипти `eval`, `ai:models`, `ai:quota`.
- Виклик — `generateText` + `Output.object({ schema })`. Схема zod `LineSuggestionSchema` (`src/lib/ai/schema.ts`):
  `status: ok | refused | injection` (AC-AI-01, AC-AI-02, AC-AI-06), поля рядка, «невідоме» = `null` (#79).
- Чиста функція `proposeLine(description, model)` (`src/lib/ai/suggest.ts`) отримує модель параметром; `timeout`
  15 000 мс, `maxRetries: 0`. Межі кількості (ціле від 1) і ціни (від 0) перевіряє код (`toOutcome`), а не промпт (#78).
- Ключ читає лише `src/lib/ai/openrouter.ts` з `import "server-only"`; змінна `OPENROUTER_API_KEY`, без `NEXT_PUBLIC_`.
- Ланцюжок моделей (лише `:free`): `google/gemma-4-31b-it:free` → `google/gemma-4-26b-a4b-it:free` →
  `nvidia/nemotron-3.5-super-vl:free`.
- Людина в контурі: Server Action `suggestLine` (`getViewer()` до виклику моделі) лише повертає рядок у форму і нічого
  не пише в базу; закупівлю створює наявна дія «Submit» (`submitPurchase` → `submit_purchase`, RLS) після людини.
  Окремої дії `confirmDraft` з набору не потрібно.
- Промпт — модуль `src/lib/ai/prompts/suggest.ts` з `SUGGEST_PROMPT_VERSION`; опис між `<description>…</description>`,
  теги з опису вирізано, довжина ≤ 1 000 символів.
- Якість: 10 golden cases PM (ValiaBihun/2026-quitcode-dream-team#70). Очікуване PM перевірне кодом (точні поля,
  «містить», дослівні повідомлення), тож LLM-суддя з набору не потрібен. Офлайн-реплей записаних відповідей — у
  `npm test` (CI); живий прогін — `npm run eval` вручну, звіт у `evals/reports/`.

## Розглянуті варіанти

- Claude Agent SDK у функції Vercel — ні: підпроцес Claude Code більший за ліміт пакета функції Vercel, а тут
  потрібен один виклик моделі.
- Пакет `openai` з `baseURL` OpenRouter — ні: немає валідації схемою з типізованими помилками й `MockLanguageModelV4`.
- Межі кількості й ціни лише в промпті — ні: правило, яке можна перевірити кодом, перевіряє код (рубрика WS10).
- LLM-суддя для назви й мети — ні: правило PM «містить» (#80) перевіряє код, і живий прогін коштує 10 запитів, а не 20.

## Наслідки

- Простіше: провайдера й модель міняємо в одному файлі; CI не залежить від мережі й ліміту.
- Складніше: безкоштовна модель може зникнути або впертися в ліміт — працівник бачить повідомлення AC-AI-04 чи
  AC-AI-05 і заповнює рядки вручну. Ланцюжок перевіряємо `npm run ai:models` перед роботою.
- Записи `tests/fixtures/golden/recorded.json` оновлюємо (`RECORD=1 npm run eval`), коли змінюється промпт
  (`SUGGEST_PROMPT_VERSION`) або схема.
