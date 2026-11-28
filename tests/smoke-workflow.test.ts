// Дія з postmortem дрилу 2026-11-28 (docs/incidents/2026-11-28-staging-publishable-key.md): деплой staging на коміті,
// який уже є в історії main, через подію status і умову contains(github.event.branches…) запускав job prod — і в групу
// приходив хибний алерт «прод показує інший коміт». Тест тримає тригери smoke.yml такими, щоб це не повернулося.
// Без парсера YAML (нової залежності): перевіряємо текст блоку `on:` і умови `if:` job prod.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(".github/workflows/smoke.yml", "utf8");
const withoutComments = workflow
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("#"))
  .join("\n");

function section(text: string, start: RegExp, end: RegExp): string {
  const from = text.search(start);
  expect(from).toBeGreaterThanOrEqual(0);
  const rest = text.slice(from);
  const bodyStart = rest.indexOf("\n") + 1; // кінець шукаємо з наступного рядка, не в самому заголовку секції
  const to = rest.slice(bodyStart).search(end);
  return to < 0 ? rest : rest.slice(0, bodyStart + to);
}

const triggers = section(withoutComments, /^on:/m, /^\S/m);
const prodJob = section(withoutComments, /^ {2}prod:/m, /^ {2}\S/m);
const prodIf = section(prodJob, /^ {4}if:/m, /^ {4}\S/m);

describe("smoke.yml: прод-перевірку запускає лише деплой проду", () => {
  it("серед тригерів немає події status (вона приходить і від деплою staging)", () => {
    expect(triggers).toMatch(/^ {2}repository_dispatch:/m);
    expect(triggers).not.toMatch(/^ {2}status:/m);
  });

  it("job prod: розклад, ручний запуск з main або repository_dispatch з environment == production", () => {
    expect(prodIf).toContain("github.event_name == 'schedule'");
    expect(prodIf).toContain("github.event.client_payload.environment == 'production'");
    expect(prodIf).not.toContain("'status'");
    expect(prodIf).not.toContain("github.event.branches");
  });

  it("job prod: production-подія без client_payload.git.sha — явний збій, а не порівняння з HEAD main", () => {
    const guard = section(prodJob, /^ {6}- name: Коміт деплою передано/m, /^ {6}- /m);
    expect(guard).toContain("if: github.event_name == 'repository_dispatch'");
    expect(guard).toContain("PAYLOAD_SHA: ${{ github.event.client_payload.git.sha }}");
    expect(guard).toMatch(/if \[ -z "\$PAYLOAD_SHA" \]; then[\s\S]*exit 1/);
    expect(prodJob.indexOf("Коміт деплою передано")).toBeLessThan(prodJob.indexOf("node scripts/smoke.mjs"));
  });
});
