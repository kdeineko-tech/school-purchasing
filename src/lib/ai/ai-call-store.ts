// Журнал запитів AI-помічника в базі (таблиця public.ai_calls, міграція 20261128075610_ai_calls.sql) — джерело SLO-2
// операційних вимог PM: рядок llm.call у Vercel Logs живе 1 годину, а SLO рахуємо за 28 днів. Ті самі поля, що й
// llm.call, — без опису, промпту й відповіді моделі. Запис best-effort: збій журналу не має ламати пропозицію рядка,
// тож помилку лише пишемо в консоль кодом (без тексту користувача) і йдемо далі. Без import "server-only": модуль
// імпортує дія форми, а createClient (next/headers) і так працює лише на сервері.
import { createClient } from "@/lib/supabase/server";
import type { LlmCall } from "@/lib/ai/llm-log";

export async function recordAiCall(call: LlmCall): Promise<void> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("log_ai_call", {
      p_request_id: call.requestId,
      p_route: call.route,
      p_model: call.model,
      p_fallback_used: call.fallbackUsed,
      p_state: call.state,
      p_error_kind: call.errorKind ?? null,
      p_latency_ms: Math.max(0, Math.round(call.latencyMs)),
      p_input_tokens: call.inputTokens ?? null,
      p_output_tokens: call.outputTokens ?? null,
      p_cost_usd: call.costUsd ?? null,
      p_prompt_version: call.promptVersion,
    });
    if (error) console.warn(JSON.stringify({ event: "ai_calls.write_failed", code: error.code ?? "unknown" }));
  } catch {
    console.warn(JSON.stringify({ event: "ai_calls.write_failed", code: "exception" }));
  }
}
