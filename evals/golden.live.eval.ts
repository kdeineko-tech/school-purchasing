import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { makeProductModel, PRODUCT_MODELS } from "@/lib/ai/models";
import { SUGGEST_PROMPT_VERSION } from "@/lib/ai/prompts/suggest";
import { LineSuggestionSchema } from "@/lib/ai/schema";
import { passRate, scoreOutcome, type GoldenCase } from "@/lib/ai/scorer";
import { proposeLine, toOutcome } from "@/lib/ai/suggest";
import casesJson from "../tests/fixtures/golden/cases.json";

// `npm run eval` — ЖИВИЙ прогін 10 golden cases PM на безкоштовних моделях OpenRouter. Ніколи не в `npm test` і не в CI.
// Потрібен ключ у .env.local (OPENROUTER_API_KEY). Без ключа всі кейси пропускаються — це не помилка.
// Очікуване PM перевірне кодом (точні поля, «містить», дослівні повідомлення), тож LLM-судді немає: 1 запит на кейс.
// Перший 429 зупиняє прогін: цей і решта кейсів — NOT RUN з причиною, у частку успіху не входять.
//   RUNS=2   — кілька прогонів поспіль; RECORD=1 — успішні відповіді дописати в tests/fixtures/golden/recorded.json.
// Основа — набір курсу materials/ai-feature (evals/golden.live.eval.ts).

const cases = casesJson as GoldenCase[];
const key = process.env.OPENROUTER_API_KEY;
const RECORD = process.env.RECORD === "1";
const RUNS = Math.max(1, Number(process.env.RUNS ?? 1) || 1);
const RECORDED_PATH = "tests/fixtures/golden/recorded.json";
const REPORT_DIR = "evals/reports";
const NEEDED = RUNS * cases.length;
const GAP_MS = 3_500; // ≤ 20 запитів/хв

type Recording = { modelId: string; recordedAt: string; promptVersion: string; text: string };
type Row = { run: number; id: string; ac: string; modelId: string; pass: boolean; notRun?: boolean; why?: string };
const rows: Row[] = [];
const fresh: Record<string, Recording> = {};
let stoppedAt: string | undefined;

describe.skipIf(!key)("golden cases PM, живий прогін (безкоштовні моделі OpenRouter)", () => {
  beforeAll(async () => {
    const res = await fetch("https://openrouter.ai/api/v1/key", { headers: { Authorization: `Bearer ${key}` } });
    const body = (await res.json()) as { data?: { free_model_daily_requests?: { remaining?: number } } };
    const remaining = body.data?.free_model_daily_requests?.remaining;
    if (typeof remaining === "number" && remaining < NEEDED) {
      throw new Error(`Сьогодні лишилось ${remaining} безкоштовних запитів, потрібно ${NEEDED}. Запустіть завтра або зменште RUNS.`);
    }
  });

  for (let run = 1; run <= RUNS; run++) {
    for (const c of cases) {
      it(`прогін ${run}: ${c.ac} golden ${c.id}`, async (ctx) => {
        if (stoppedAt) {
          rows.push({ run, id: c.id, ac: c.ac, modelId: "—", pass: false, notRun: true, why: `NOT RUN: зупинено після 429 (${stoppedAt})` });
          return ctx.skip();
        }
        await sleep(GAP_MS);
        // Таймаут більший, ніж у застосунку (15 с, AC-AI-04): тут міряємо якість відповіді, а не швидкість.
        const result = await proposeLine(c.input, makeProductModel(key), { maxRetries: 0, timeoutMs: 60_000 });
        if (!result.ok) {
          if (result.reason === "rate_limited") {
            stoppedAt = `${c.id}, прогін ${run}`;
            rows.push({ run, id: c.id, ac: c.ac, modelId: "—", pass: false, notRun: true, why: `NOT RUN: 429 — ${result.message}` });
            return ctx.skip();
          }
          rows.push({ run, id: c.id, ac: c.ac, modelId: "—", pass: false, why: `${result.reason}: ${result.message}` });
        }
        expect(result.ok, result.ok ? "" : `${result.reason}: ${result.message}`).toBe(true);
        if (!result.ok) return;
        const outcome = toOutcome(result.suggestion);
        const score = scoreOutcome(c.expected, outcome);
        const got = outcome.kind === "line" ? `рядок ${JSON.stringify(outcome.line)}` : `«${outcome.message}»`;
        rows.push({
          run,
          id: c.id,
          ac: c.ac,
          modelId: result.modelId,
          pass: score.pass,
          why: score.pass ? got : score.mismatches.map((m) => `${m.field}: очікувано «${m.expected}», є «${m.actual}»`).join("; "),
        });
        if (RECORD && score.pass) {
          fresh[c.id] = {
            modelId: result.modelId,
            recordedAt: new Date().toISOString(),
            promptVersion: SUGGEST_PROMPT_VERSION,
            text: JSON.stringify(LineSuggestionSchema.parse(result.suggestion)),
          };
        }
        expect(score.mismatches).toEqual([]);
      });
    }
  }

  afterAll(() => {
    console.table(rows);
    writeReport();
    if (RECORD && Object.keys(fresh).length > 0) {
      const old = JSON.parse(readFileSync(RECORDED_PATH, "utf8")) as Record<string, Recording>;
      writeFileSync(RECORDED_PATH, JSON.stringify({ ...old, ...fresh }, null, 2) + "\n");
    }
  });
});

// Звіт для домашки: частка успіху загалом і за моделлю + кожен кейс. Файл комітять (він без секретів).
function writeReport() {
  if (rows.length === 0) return;
  const ran = rows.filter((r) => !r.notRun);
  const notRun = rows.filter((r) => r.notRun);
  const total = passRate(ran);
  const byModel = new Map<string, Row[]>();
  for (const r of ran) byModel.set(r.modelId, [...(byModel.get(r.modelId) ?? []), r]);
  const mustPass = ["GC-01", "GC-08", "GC-11"];
  const mandatory = mustPass.map((id) => `${id} ${ran.some((r) => r.id === id && r.pass) ? "✅" : "❌"}`).join(", ");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const lines = [
    `# Живий прогін golden cases — ${new Date().toISOString()}`,
    "",
    `- Функція: AI пропонує рядок закупівлі (AC-AI-01, AC-AI-02, AC-AI-06); кейси PM — ValiaBihun/2026-quitcode-dream-team#70`,
    `- Промпт: \`${SUGGEST_PROMPT_VERSION}\`; ланцюжок моделей: ${PRODUCT_MODELS.map((m) => `\`${m}\``).join(" → ")}; суддя: немає (очікуване перевіряє код)`,
    `- Прогонів: ${RUNS}; кейсів у прогоні: ${cases.length}`,
    `- **Частка успіху: ${total.passed}/${total.total} (${Math.round(total.rate * 100)}%)** — з кейсів, що отримали відповідь`,
    `- Поріг PM: ≥ 8 з 10, обов'язково № 1, 8, 11 — ${mandatory}`,
    `- Не запущено (NOT RUN): ${notRun.length}${stoppedAt ? ` — ліміт 429, зупинено на: ${stoppedAt}` : ""}`,
    "",
    "| Модель, що відповіла | Пройшло | Усього |",
    "|---|---|---|",
    ...[...byModel].map(([m, rs]) => `| \`${m}\` | ${passRate(rs).passed} | ${rs.length} |`),
    "",
    "| Прогін | Кейс | AC | Модель | Результат | Що повернув помічник / розбіжність |",
    "|---|---|---|---|---|---|",
    ...rows.map(
      (r) =>
        `| ${r.run} | ${r.id} | ${r.ac} | \`${r.modelId}\` | ${r.notRun ? "NOT RUN" : r.pass ? "✅" : "❌"} | ${(r.why ?? "").replaceAll("|", "/")} |`,
    ),
    "",
  ];
  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(`${REPORT_DIR}/${stamp}.md`, lines.join("\n"));
  console.log(`Звіт: ${REPORT_DIR}/${stamp}.md`);
}
