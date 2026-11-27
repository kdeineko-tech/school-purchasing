import { APICallError, NoObjectGeneratedError, Output, RetryError, generateText, type LanguageModel } from "ai";
import { MESSAGES } from "@/lib/org/messages";
import type { PurchaseLineInput } from "@/lib/purchases/form";
import { SUGGEST_INSTRUCTIONS, wrapDescription } from "./prompts/suggest";
import { LineSuggestionSchema, type LineSuggestion } from "./schema";

// Чиста функція пропозиції рядка (AC-AI-01 … AC-AI-06): модель передають параметром. Застосунок передає модель
// OpenRouter (src/lib/ai/openrouter.ts, server-only), тести — MockLanguageModelV4 із записаною відповіддю.
// Тут немає `import "server-only"` і process.env, тож Vitest і `npm run eval` імпортують цей файл.
// Основа — набір курсу materials/ai-feature (src/lib/ai/draft.ts).

export type FailureReason = "invalid_output" | "rate_limited" | "timeout" | "provider_error";

export type ProposeResult =
  | { ok: true; suggestion: LineSuggestion; modelId: string; usage: { inputTokens?: number; outputTokens?: number } }
  | { ok: false; reason: FailureReason; message: string };

export type ProposeOptions = { maxRetries?: number; timeoutMs?: number };

// 15 секунд — чекання відповіді до повідомлення «Could not get a suggestion…» (AC-AI-04).
export const SUGGEST_TIMEOUT_MS = 15_000;

export async function proposeLine(description: string, model: LanguageModel, opts: ProposeOptions = {}): Promise<ProposeResult> {
  try {
    const result = await generateText({
      model,
      instructions: SUGGEST_INSTRUCTIONS,
      messages: [{ role: "user", content: [{ type: "text", text: wrapDescription(description) }] }],
      output: Output.object({ name: "line", schema: LineSuggestionSchema }),
      temperature: 0,
      // Повтор не вклався б у 15 секунд і витрачав би той самий денний ліміт: за замовчуванням 0.
      maxRetries: opts.maxRetries ?? 0,
      timeout: opts.timeoutMs ?? SUGGEST_TIMEOUT_MS,
    });
    // usage — для журналу llm.call (src/lib/ai/llm-log.ts): лише числа токенів, без тексту.
    const usage = { inputTokens: result.usage?.inputTokens, outputTokens: result.usage?.outputTokens };
    return { ok: true, suggestion: result.output, modelId: result.response.modelId, usage };
  } catch (error) {
    return classifyError(error);
  }
}

export function classifyError(error: unknown): Extract<ProposeResult, { ok: false }> {
  // Після повторів AI SDK загортає останню помилку в RetryError — спершу розгортаємо.
  const cause = RetryError.isInstance(error) ? error.lastError : error;
  if (NoObjectGeneratedError.isInstance(cause)) {
    return { ok: false, reason: "invalid_output", message: "model output did not match the schema" };
  }
  if (APICallError.isInstance(cause)) {
    // OpenRouter може відповісти HTTP 200 з тілом `error`; провайдер тоді кидає statusCode 200 + data.
    const code = cause.statusCode === 200 ? (cause.data as { code?: unknown } | undefined)?.code : cause.statusCode;
    if (code === 429 || code === "429") {
      return { ok: false, reason: "rate_limited", message: "free-model limit reached" };
    }
  }
  if (cause instanceof Error && (cause.name === "TimeoutError" || cause.name === "AbortError")) {
    return { ok: false, reason: "timeout", message: "model did not answer in time" };
  }
  return { ok: false, reason: "provider_error", message: cause instanceof Error ? cause.message : String(cause) };
}

// Що бачить працівник, коли пропозиції немає: ліміт постачальника — AC-AI-05 (ValiaBihun/2026-quitcode-dream-team#81);
// таймаут, немає ключа, помилка постачальника чи відповідь не за схемою — AC-AI-04. Форма завжди лишається ручною.
export function failureMessage(reason: FailureReason | "no_key"): string {
  return reason === "rate_limited" ? MESSAGES.aiUnavailableToday : MESSAGES.aiNoSuggestion;
}

export type SuggestionOutcome = { kind: "line"; line: PurchaseLineInput } | { kind: "message"; message: string };

const amount = (value: number) => (Math.round(value * 100) / 100).toFixed(2);

// Відповідь моделі → що бачить працівник. Межі перевіряє код, а не промпт (design.md, «AI»): кількість — ціле від 1,
// ціна — від 0 (припущення PM, ValiaBihun/2026-quitcode-dream-team#78). Невідоме поле лишається порожнім (#79).
export function toOutcome(suggestion: LineSuggestion): SuggestionOutcome {
  if (suggestion.status === "refused") return { kind: "message", message: MESSAGES.aiOffTopic };
  if (suggestion.status === "injection") return { kind: "message", message: MESSAGES.aiInjection };
  const { name, purpose, quantity, unitPrice } = suggestion;
  if (quantity !== null && (!Number.isInteger(quantity) || quantity < 1)) {
    return { kind: "message", message: MESSAGES.quantityRange };
  }
  if (unitPrice !== null && (!Number.isFinite(unitPrice) || unitPrice < 0)) {
    return { kind: "message", message: MESSAGES.priceRange };
  }
  return {
    kind: "line",
    line: {
      name: name?.trim() ?? "",
      purpose: purpose?.trim() ?? "",
      quantity: quantity === null ? "" : String(quantity),
      unitPrice: unitPrice === null ? "" : amount(unitPrice),
    },
  };
}

// Рядок від AI лягає в перший порожній рядок форми, якщо він є, інакше додається новий (ValiaBihun/2026-quitcode-dream-team#82).
export function placeLine(lines: readonly PurchaseLineInput[], line: PurchaseLineInput): PurchaseLineInput[] {
  const empty = lines.findIndex((l) => !l.name.trim() && !l.purpose.trim() && !l.quantity.trim() && !l.unitPrice.trim());
  return empty === -1 ? [...lines, line] : lines.map((l, i) => (i === empty ? line : l));
}
