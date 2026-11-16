import { MESSAGES } from "@/lib/org/messages";
import type { SuggestionOutcome } from "./suggest";

// Один golden case PM (ValiaBihun/2026-quitcode-dream-team#70): вхід → очікуване. Файл — tests/fixtures/golden/cases.json.
// Очікуване PM перевірне кодом, тож LLM-суддя не потрібен: точні поля (кількість, ціна) — дослівно; назва й мета —
// «містить» (правило PM, ValiaBihun/2026-quitcode-dream-team#80); повідомлення — дослівний текст з таблиці #49.
export type MessageKey = "aiOffTopic" | "aiInjection" | "quantityRange" | "priceRange";

export type GoldenCase = {
  id: string; // "GC-01" — номер кейсу PM
  ac: "AC-AI-01" | "AC-AI-02" | "AC-AI-06";
  input: string;
  expected:
    | { kind: "line"; quantity: string; unitPrice: string; nameContains: string; purposeContains: string }
    | { kind: "message"; message: MessageKey };
  rubric: string; // очікуване словами PM — для звіту
};

const contains = (text: string, part: string) => text.toLocaleLowerCase("uk").includes(part.toLocaleLowerCase("uk"));

export function scoreOutcome(expected: GoldenCase["expected"], actual: SuggestionOutcome) {
  const mismatches: { field: string; expected: string; actual: string }[] = [];
  const miss = (field: string, want: string, got: string) => mismatches.push({ field, expected: want, actual: got });
  if (expected.kind === "message") {
    const want = MESSAGES[expected.message];
    if (actual.kind !== "message") miss("kind", "message", `line «${actual.line.name}»`);
    else if (actual.message !== want) miss("message", want, actual.message);
  } else if (actual.kind !== "line") {
    miss("kind", "line", actual.message);
  } else {
    const { line } = actual;
    if (line.quantity !== expected.quantity) miss("quantity", expected.quantity, line.quantity);
    if (line.unitPrice !== expected.unitPrice) miss("unitPrice", expected.unitPrice, line.unitPrice);
    if (!contains(line.name, expected.nameContains)) miss("name contains", expected.nameContains, line.name);
    if (!contains(line.purpose, expected.purposeContains)) miss("purpose contains", expected.purposeContains, line.purpose);
  }
  return { pass: mismatches.length === 0, mismatches };
}

// Частка успіху (pass rate) — визначення eval з WS8: прогін на задачах із відомими відповідями → бал.
export function passRate(results: { pass: boolean }[]) {
  const passed = results.filter((r) => r.pass).length;
  return { passed, total: results.length, rate: results.length ? passed / results.length : 0 };
}
