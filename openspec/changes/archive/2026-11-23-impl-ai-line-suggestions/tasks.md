## 1. AI-пропозиція рядка (функція, офлайн golden cases, живий eval)

- [x] 1.1 ADR `docs/decisions/0006-ai-line-suggestions-openrouter.md` і залежності (`ai`, `@openrouter/ai-sdk-provider`,
  `zod`, `server-only` — точні версії з набору курсу); `src/lib/ai/` (схема, промпт з версією, `suggestLine` — чиста
  функція, ланцюжок `:free`, `openrouter.ts` з `server-only`), Server Action `suggestLine` (getViewer → модель → рядок,
  без запису), поле «Purchase description» і «Suggest lines» у формі нової закупівлі; `cases.json` з 10 golden cases PM,
  `recorded.json` живим `RECORD=1`, звіт `evals/reports/…md`; `tests/golden.test.ts`, тести збоїв, дії й форми,
  `tests/ai-key.test.ts`; рядки `docs/conformance.md`.
  Done when: AC-AI-01, AC-AI-02, AC-AI-03, AC-AI-04, AC-AI-05, AC-AI-06 — тести з AC ID зелені в CI, `npm run eval`
  звіт закомічено, `npm run ac:coverage` OK.

## 2. Прод і UAT

- [x] 2.1 `OPENROUTER_API_KEY` у Vercel Production; UAT на проді: специфікації Playwright AC-AI-01 (рядок заповнено,
  закупівлю не подано без «Submit») і AC-AI-02 (відмова) — звіт у `docs/qa/uat/<дата>/`; archive `impl-ai-line-suggestions`.
  Done when: AC-AI-01, AC-AI-02 — UAT-запис на проді; «eval готовий» у чаті команди.
