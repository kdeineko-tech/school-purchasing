"use server";

// AI-пропозиція рядка закупівлі (зріз 4, AC-AI-01 … AC-AI-06; design.md impl-ai-line-suggestions).
// Дія не створює заявки й рядків закупівлі (пише лише технічний журнал ai_calls для SLO-2): повертає рядок у форму, а
// закупівлю подає сам працівник наявною дією «Submit» (submitPurchase → submit_purchase, RLS) —
// тож «нової заявки немає» без натискання людини (AC-AI-01, AC-AI-06).
// Вхід перевіряється ДО виклику моделі: інакше будь-хто з інтернету витрачав би денний ліміт (AC-AI-05).
// Так само до моделі: працівник без відділів (AC-FRM-05) — форми в нього немає, і прямий виклик дії цього не обійде;
// явна спроба ін'єкції (AC-AI-06) — відмова кодом, модель лише друга лінія (огляд WS10, koldovsky/2026-quitcode-10-ai-features-hw#17).
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/org/viewer";
import { MESSAGES } from "@/lib/org/messages";
import { looksLikeInjection } from "@/lib/ai/injection";
import { MAX_DESCRIPTION_LENGTH, SUGGEST_PROMPT_VERSION } from "@/lib/ai/prompts/suggest";
import { loadFormOptions } from "@/lib/purchases/options";
import { failureMessage, proposeLine, toOutcome, type ProposeResult, type SuggestionOutcome } from "@/lib/ai/suggest";
import { isFallback, logLlmCall, type LlmCall } from "@/lib/ai/llm-log";
import { recordAiCall } from "@/lib/ai/ai-call-store";
import { PRODUCT_MODELS } from "@/lib/ai/models";

// `id` — щоб форма відрізнила нову відповідь від попередньої (той самий текст двічі поспіль).
export type SuggestState = (SuggestionOutcome & { id: number; description: string }) | null;

export async function suggestLine(_prev: SuggestState, formData: FormData): Promise<SuggestState> {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");

  const description = String(formData.get("description") ?? "");
  const id = Date.now();
  // Те саме правило, що для сторінки форми й submitPurchase: без відділів подати закупівлю не можна — і пропозиція
  // не потрібна. Ліміт моделі спільний, тож витрачає його лише той, хто справді може подати закупівлю.
  const options = await loadFormOptions(viewer);
  if (options.departments.length === 0) return { kind: "message", message: MESSAGES.noDepartments, id, description: "" };
  // Задовгий опис відхиляємо, а не обрізаємо: обрізаний хвіст (зокрема ін'єкцію після 1000-го символу) модель би не
  // побачила і могла б повернути рядок замість відмови AC-AI-06. Модель не викликаємо — ліміт не витрачено.
  // Ці відмови кодом (без відділів, помилка вводу, явна ін'єкція) — до моделі, тож llm.call і ai_calls їх не пишуть.
  if (!description.trim() || description.length > MAX_DESCRIPTION_LENGTH) {
    return { kind: "message", message: failureMessage("invalid_output"), id, description };
  }
  if (looksLikeInjection(description)) return { kind: "message", message: MESSAGES.aiInjection, id, description };

  // Модуль із ключем (server-only) підвантажуємо лише тут, під час виклику: форма імпортує цю дію, і статичний імпорт
  // тягнув би server-only у дерево клієнтського компонента в тестах сторінок.
  const { productModel } = await import("@/lib/ai/openrouter");
  const model = productModel();
  if (!model) {
    await logCall(null, 0);
    return { kind: "message", message: failureMessage("no_key"), id, description };
  }

  const started = performance.now();
  const result = await proposeLine(description, model);
  await logCall(result, performance.now() - started);
  if (!result.ok) return { kind: "message", message: failureMessage(result.reason), id, description };
  return { ...toOutcome(result.suggestion), id, description };
}

// WS11, трек B: рівно один рядок llm.call на спробу пропозиції (src/lib/ai/llm-log.ts) — модель, затримка, токени,
// стан, fallback, версія промпту, id запиту. Опису, промпту й відповіді моделі тут немає: у журнал іде лише result
// без suggestion-полів, а схема журналу пропускає тільки дозволені поля вузького формату. null — ключа немає.
// Той самий запис — у таблицю ai_calls (SLO-2 операційних вимог PM: 28 днів, а Vercel Logs живуть 1 годину).
async function logCall(result: ProposeResult | null, latencyMs: number) {
  const primary = PRODUCT_MODELS[0];
  const common = { requestId: crypto.randomUUID(), route: "/purchases/new", promptVersion: SUGGEST_PROMPT_VERSION, latencyMs };
  const call: LlmCall = result?.ok
    ? {
        ...common,
        model: result.modelId,
        fallbackUsed: isFallback(result.modelId, primary),
        state: result.suggestion.status,
        ...result.usage,
      }
    : { ...common, model: primary, fallbackUsed: false, state: "unavailable", errorKind: result?.reason ?? "no_key" };
  logLlmCall(call);
  await recordAiCall(call);
}
