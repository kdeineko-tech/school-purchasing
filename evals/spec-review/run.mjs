#!/usr/bin/env node
// Eval скіла spec-review (WS8, бонус): кожен кейс — фікстура з однією посадженою проблемою перекладу вимог PM у
// специфікацію; прогін зі скілом і без, по RUNS разів, у свіжій копії фікстури. Шлях 3 з гайду курсу (цикл claude -p):
// https://github.com/koldovsky/2026-quitcode-08-quality-hw/blob/main/docs/gates-guide.md#бонус-eval-свого-скіла
//
// Запуск — у звичайному терміналі (не в сесії агента: змінні CLAUDECODE* змінюють поведінку вкладеного claude -p):
//   npm run eval:spec-review                       усі кейси, 3 прогони, модель claude-sonnet-5-5
//   npm run eval:spec-review -- --runs 1 --case 4-hidden-ac
// Результат: evals/spec-review/results/results.json і report.md (таблиця pass rate зі скілом / без).
// Лише читання: claude -p отримує тільки Read, Grep і Glob, працює в тимчасовій теці й нічого в репо не змінює.
import { spawn } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(HERE, "../..");
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const i = args.indexOf(name);
  if (i === -1) return fallback;
  const value = args[i + 1];
  if (value === undefined || value.startsWith("--")) {
    console.error(`✗ Прапорець ${name} потребує значення`);
    process.exit(2);
  }
  return value;
};
const RUNS = Number(option("--runs", "3"));
const MODEL = option("--model", "claude-sonnet-5-5");
const ONLY = option("--case", null);
const CONCURRENCY = Number(option("--concurrency", "3"));

// Однаковий запит в обох варіантах — різниця лише в тому, чи є в теці скіл і чи його викликано.
const WITH_PROMPT = "/spec-review add-leave";
const WITHOUT_PROMPT =
  "Перевір зміну специфікації add-leave (openspec/changes/add-leave/) проти вимог PM у requirements/ перед PR " +
  "«Специфікація» і дай список знахідок.";

const casesDir = path.join(HERE, "cases");
const cases = readdirSync(casesDir)
  .filter((c) => !ONLY || c === ONLY)
  .sort()
  .map((name) => ({ name, ...JSON.parse(readFileSync(path.join(casesDir, name, "expect.json"), "utf8")) }));
if (!cases.length) {
  console.error(`✗ Кейс не знайдено: ${ONLY}`);
  process.exit(2);
}

/** Свіжа копія фікстури; для варіанта «зі скілом» — ще скіл spec-review і таксономія, на яку він посилається. */
function prepare(caseName, withSkill) {
  const dir = mkdtempSync(path.join(tmpdir(), `spec-review-eval-${caseName}-`));
  cpSync(path.join(casesDir, caseName, "fixture"), dir, { recursive: true });
  if (withSkill) {
    for (const rel of [".claude/skills/spec-review", ".claude/skills/spec-clarify/references"]) {
      cpSync(path.join(ROOT, rel), path.join(dir, rel), { recursive: true });
    }
  }
  return dir;
}

function runClaude(cwd, prompt) {
  return new Promise((resolve) => {
    const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("CLAUDECODE") && !k.startsWith("CLAUDE_CODE_")));
    const started = Date.now();
    const child = spawn(
      "claude",
      ["-p", prompt, "--model", MODEL, "--setting-sources", "project", "--output-format", "json", "--allowedTools", "Read", "Grep", "Glob"],
      { cwd, env, stdio: ["ignore", "pipe", "pipe"] },
    );
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("close", (code) => {
      let json = null;
      try {
        json = JSON.parse(out);
      } catch {
        // нижче — як помилка прогону
      }
      resolve({ code, json, err: err.trim().slice(0, 500), ms: Date.now() - started });
    });
  });
}

function grade(text, expect) {
  const checks = expect.map((re) => ({ re, ok: new RegExp(re, "iu").test(text) }));
  return { pass: checks.every((c) => c.ok), checks };
}

const jobs = [];
for (const c of cases) for (const variant of ["with", "without"]) for (let run = 1; run <= RUNS; run++) jobs.push({ c, variant, run });

/** Помилка прогону (не вердикт): немає JSON, claude повернув помилку або скіл не завантажився. */
function runError(r, text) {
  if (/unknown (skill|command)|не знайдено скіл/i.test(text)) return "скіл не завантажився";
  if (!r.json || r.json.is_error) return r.err || "немає JSON";
  return null;
}

async function runJob({ c, variant, run }) {
  const dir = prepare(c.name, variant === "with");
  const r = await runClaude(dir, variant === "with" ? WITH_PROMPT : WITHOUT_PROMPT);
  rmSync(dir, { recursive: true, force: true });
  const text = r.json?.result ?? "";
  const error = runError(r, text);
  const g = error ? { pass: false, checks: [] } : grade(text, c.expect);
  const verdict = error ? `ERROR (${error})` : g.pass ? "PASS" : "FAIL";
  console.log(`${c.name} [${variant === "with" ? "зі скілом" : "без скіла"} #${run}] → ${verdict} · ${(r.ms / 1000).toFixed(0)} с`);
  return { case: c.name, variant, run, pass: g.pass, error, checks: g.checks, costUsd: r.json?.total_cost_usd ?? null, ms: r.ms, answer: text };
}

const results = [];
async function worker() {
  while (jobs.length) results.push(await runJob(jobs.shift()));
}
await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, worker));

const outDir = path.join(HERE, "results");
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
results.sort((a, b) => a.case.localeCompare(b.case) || a.variant.localeCompare(b.variant) || a.run - b.run);
writeFileSync(path.join(outDir, "results.json"), JSON.stringify({ model: MODEL, runs: RUNS, at: new Date().toISOString(), results }, null, 2));

const rate = (name, variant) => {
  const rs = results.filter((r) => r.case === name && r.variant === variant);
  return `${rs.filter((r) => r.pass).length}/${rs.length}`;
};
const cost = results.reduce((s, r) => s + (r.costUsd ?? 0), 0);
const lines = [
  "# Eval скіла spec-review",
  "",
  `Модель: \`${MODEL}\` · прогонів на кейс і варіант: ${RUNS} · ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC · разом $${cost.toFixed(2)} (ціни API)`,
  "",
  "| Кейс | Посаджена проблема | Очікуване у відповіді (регулярні вирази) | Зі скілом | Без скіла |",
  "|---|---|---|---|---|",
  ...cases.map((c) => `| \`${c.name}\` | ${c.what} | ${c.expect.map((e) => `\`${e.replace(/\|/g, "\\|")}\``).join(" і ")} | ${rate(c.name, "with")} | ${rate(c.name, "without")} |`),
  "",
  `Помилки прогонів: ${results.filter((r) => r.error).length}. Відповіді кожного прогону — у \`results.json\`.`,
  "",
];
writeFileSync(path.join(outDir, "report.md"), lines.join("\n"));
console.log(`\nЗвіт: ${path.relative(ROOT, path.join(outDir, "report.md"))}`);
