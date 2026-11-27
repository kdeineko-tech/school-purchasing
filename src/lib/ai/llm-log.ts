// Журнал AI-функції: один рядок JSON `llm.call` на кожен виклик моделі — модель, затримка, токени, стан, fallback,
// версія промпту, id запиту. БЕЗ тексту користувача, промпту й відповіді моделі: таких полів у схемі просто немає,
// а дозволені поля мають вузький формат (див. src/lib/log.ts).
// WS11, трек B. Пише дія suggestLine (src/app/purchases/new/suggest-action.ts); тест — tests/llm-log.test.ts.
// Джерело: набір курсу ops-kit WS11. Стани — з нашої схеми відповіді (src/lib/ai/schema.ts: ok / refused / injection)
// + unavailable (відповіді немає: немає ключа, ліміт, таймаут, не за схемою, збій постачальника).
//
// Приклад рядка в Runtime Logs Vercel:
// {"event":"llm.call","ts":"2026-11-27T10:15:00.000Z","requestId":"3f0c…","route":"/purchases/new",
//  "model":"nvidia/nemotron-3.5-super-vl:free","fallbackUsed":true,"state":"ok","latencyMs":1830,"inputTokens":612,
//  "outputTokens":44,"promptVersion":"suggest-v3"}
import { logEvent, type LogSchema } from "@/lib/log";

/** ok / refused / injection — відповідь моделі за схемою (schema.ts); unavailable — відповіді немає. */
export const LLM_STATES = ["ok", "refused", "injection", "unavailable"] as const;
export type LlmState = (typeof LLM_STATES)[number];

export type LlmCall = {
  /** id запиту, щоб зв'язати рядок з іншими подіями цього запиту (напр. crypto.randomUUID()). */
  requestId: string;
  /** маршрут-шаблон, не адреса з параметрами: "/purchases/new". */
  route: string;
  /** id моделі, яка відповіла (або перша в ланцюжку, якщо відповіді немає). */
  model: string;
  /** відповіла не перша модель ланцюжка. */
  fallbackUsed: boolean;
  state: LlmState;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  /** вартість у USD, якщо постачальник її повернув (для :free — 0). */
  costUsd?: number;
  /** версія промпту, напр. SUGGEST_PROMPT_VERSION = "suggest-v3". */
  promptVersion: string;
  /** КОД причини (no_key, rate_limited, timeout, invalid_output, provider_error), ніколи не текст помилки. */
  errorKind?: string;
};

/** Коди причин збою: FailureReason з src/lib/ai/suggest.ts і no_key (ключа немає — модель не викликали). */
export const LLM_ERROR_KINDS = ["no_key", "rate_limited", "timeout", "invalid_output", "provider_error"] as const;

/** Схема llm.call: єдиний список полів, які взагалі можуть потрапити в журнал. */
export const LLM_CALL_SCHEMA = {
  requestId: "token",
  route: "path",
  model: "token",
  fallbackUsed: "boolean",
  state: LLM_STATES,
  latencyMs: "int",
  inputTokens: "int",
  outputTokens: "int",
  costUsd: "number",
  promptVersion: "token",
  errorKind: LLM_ERROR_KINDS, // перелік, не "token": код причини відомий наперед
} as const satisfies LogSchema;

/** Пише рядок llm.call: unavailable — рівнем error (видно у фільтрі level:error), решта — info. Повертає рядок. */
export function logLlmCall(call: LlmCall): string {
  return logEvent("llm.call", call, LLM_CALL_SCHEMA, call.state === "unavailable" ? "error" : "info");
}

/** Порівнює моделі без суфікса ":free": формат id у відповіді постачальника може відрізнятися від запитаного. */
export function isFallback(answeredModel: string, primaryModel: string): boolean {
  const strip = (id: string) => id.replace(/:free$/, "");
  return strip(answeredModel) !== strip(primaryModel);
}
