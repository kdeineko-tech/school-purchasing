"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { MESSAGES } from "@/lib/org/messages";
import { getViewer } from "@/lib/org/viewer";
import { linesForDatabase, parseLines, validateSubmission } from "@/lib/purchases/form";
import { loadFormOptions } from "@/lib/purchases/options";
import { createClient } from "@/lib/supabase/server";

export type SubmitState = { error?: string };

// Коди винятків private.submit_purchase → тексти PM (ADR 0003).
const DATABASE_ERRORS: Record<string, string> = {
  FORBIDDEN: MESSAGES.forbidden,
  NO_LINES: MESSAGES.noLines,
};

// AC-FRM-02, AC-FRM-04, AC-FRM-06, AC-FRM-07, AC-FRM-11, AC-FRM-12: подання закупівлі. Перше правило — доменна
// функція з повідомленням PM; функція бази — друга лінія захисту, і на її відмову показуємо те саме повідомлення.
export async function submitPurchase(_prev: SubmitState, formData: FormData): Promise<SubmitState> {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");

  const input = {
    departmentId: String(formData.get("departmentId") ?? ""),
    purchaseType: String(formData.get("purchaseType") ?? ""),
    lines: parseLines(formData.get("lines")),
  };
  const check = validateSubmission(input, await loadFormOptions(viewer));
  if (!check.ok) return { error: check.error };

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_purchase", {
    p_department_id: input.departmentId,
    p_purchase_type: input.purchaseType,
    p_lines: linesForDatabase(input.lines),
  });
  if (error) {
    const known = Object.keys(DATABASE_ERRORS).find((code) => error.message.includes(code));
    if (known) return { error: DATABASE_ERRORS[known] };
    throw new Error(`Failed to submit purchase: ${error.message}`);
  }

  revalidatePath("/purchases");
  redirect("/purchases?submitted=1");
}
