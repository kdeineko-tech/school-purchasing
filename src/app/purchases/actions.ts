"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { MESSAGES } from "@/lib/org/messages";
import { getViewer } from "@/lib/org/viewer";
import { validateDecision } from "@/lib/purchases/decisions";
import { linesForDatabase, parseLines, validateSubmission } from "@/lib/purchases/form";
import { loadFormOptions } from "@/lib/purchases/options";
import { createClient } from "@/lib/supabase/server";

export type SubmitState = { error?: string };

// Коди винятків private.submit_purchase → тексти PM (ADR 0003).
const DATABASE_ERRORS: Record<string, string> = {
  FORBIDDEN: MESSAGES.forbidden,
  NO_LINES: MESSAGES.noLines,
  INVALID_LINE: MESSAGES.invalidLine,
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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Коди винятків private.decide_purchase → тексти PM (ADR 0003). NOT_PENDING (заявку вже вирішено) окремого тексту не
// має: сторінка заявки й так показує поточний статус.
const DECISION_ERRORS: Record<string, string | null> = {
  FORBIDDEN: MESSAGES.forbidden,
  REASON_REQUIRED: MESSAGES.provideReason,
  NOT_PENDING: null,
};

function backToPurchase(id: string, error?: string): never {
  revalidatePath(`/purchases/${id}`);
  revalidatePath("/approvals");
  redirect(`/purchases/${id}${error ? `?error=${encodeURIComponent(error)}` : ""}`);
}

// AC-APR-02, AC-APR-03, AC-APR-05, AC-APR-06, AC-APR-07: рішення схвалювача. Перше правило — доменна функція з
// повідомленням PM; функція бази — друга лінія захисту (схвалювач відділу, не автор, статус, причина).
export async function decidePurchase(formData: FormData) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");

  const id = String(formData.get("purchaseId") ?? "");
  if (!UUID.test(id)) redirect("/purchases");
  const check = validateDecision(String(formData.get("decision") ?? ""), String(formData.get("reason") ?? ""));
  if (!check.ok) backToPurchase(id, check.error);

  const supabase = await createClient();
  const { error } = await supabase.rpc("decide_purchase", {
    p_purchase_id: id,
    p_decision: check.decision,
    p_reason: check.reason,
  });
  if (error) {
    const known = Object.keys(DECISION_ERRORS).find((code) => error.message.includes(code));
    if (known) backToPurchase(id, DECISION_ERRORS[known] ?? undefined);
    throw new Error(`Failed to decide purchase: ${error.message}`);
  }

  backToPurchase(id);
}
