"use server";

// AI-пропозиція рядка закупівлі (зріз 4, AC-AI-01 … AC-AI-06; design.md impl-ai-line-suggestions).
// Дія НІЧОГО не пише в базу: повертає рядок у форму, а закупівлю подає сам працівник наявною дією «Submit»
// (submitPurchase → submit_purchase, RLS) — тож «нової заявки немає» без натискання людини (AC-AI-01, AC-AI-06).
// Вхід перевіряється ДО виклику моделі: інакше будь-хто з інтернету витрачав би денний ліміт (AC-AI-05).
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/org/viewer";
import { MAX_DESCRIPTION_LENGTH } from "@/lib/ai/prompts/suggest";
import { failureMessage, proposeLine, toOutcome, type SuggestionOutcome } from "@/lib/ai/suggest";

// `id` — щоб форма відрізнила нову відповідь від попередньої (той самий текст двічі поспіль).
export type SuggestState = (SuggestionOutcome & { id: number; description: string }) | null;

export async function suggestLine(_prev: SuggestState, formData: FormData): Promise<SuggestState> {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");

  const description = String(formData.get("description") ?? "");
  const id = Date.now();
  // Задовгий опис відхиляємо, а не обрізаємо: обрізаний хвіст (зокрема ін'єкцію після 1000-го символу) модель би не
  // побачила і могла б повернути рядок замість відмови AC-AI-06. Модель не викликаємо — ліміт не витрачено.
  if (!description.trim() || description.length > MAX_DESCRIPTION_LENGTH) {
    return { kind: "message", message: failureMessage("invalid_output"), id, description };
  }

  // Модуль із ключем (server-only) підвантажуємо лише тут, під час виклику: форма імпортує цю дію, і статичний імпорт
  // тягнув би server-only у дерево клієнтського компонента в тестах сторінок.
  const { productModel } = await import("@/lib/ai/openrouter");
  const model = productModel();
  if (!model) return { kind: "message", message: failureMessage("no_key"), id, description };

  const result = await proposeLine(description, model);
  if (!result.ok) return { kind: "message", message: failureMessage(result.reason), id, description };
  return { ...toOutcome(result.suggestion), id, description };
}
