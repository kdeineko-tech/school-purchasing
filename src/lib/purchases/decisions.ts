// Рішення схвалювача: хто може вирішувати, що в списку для рішення і чи можна зберегти відхилення
// (impl-add-purchase-flow, design.md, «UI і компоненти»). Ті самі правила тримає функція бази
// private.decide_purchase — друга лінія захисту (ADR docs/decisions/0003-purchase-submission-rpc.md).
import { MESSAGES } from "@/lib/org/messages";

export type DecisionPurchase = { id: string; authorId: string; departmentId: string; status: string };
export type Decision = "approve" | "reject";

// Вирішує схвалювач відділу заявки, не автор, і лише заявку «Очікує схвалення» (AC-APR-02, AC-APR-03, AC-APR-05,
// AC-FRM-13). Адміністратор вирішує тільки у відділах, які сам схвалює (рішення за відділ без схвалювача — WS8).
export function canDecide(
  viewer: { id: string },
  purchase: Omit<DecisionPurchase, "id">,
  approvedDepartmentIds: readonly string[],
): boolean {
  return (
    purchase.status === "awaiting_approval" &&
    purchase.authorId !== viewer.id &&
    approvedDepartmentIds.includes(purchase.departmentId)
  );
}

// Список для рішення: «Очікує схвалення» відділів, які переглядач схвалює, крім власних (AC-APR-01).
export function decisionList<T extends DecisionPurchase>(
  purchases: readonly T[],
  viewerId: string,
  approvedDepartmentIds: readonly string[],
): T[] {
  return purchases.filter((p) => canDecide({ id: viewerId }, p, approvedDepartmentIds));
}

export type DecisionCheck =
  | { ok: true; decision: Decision; reason: string | null; rejectedLines: string[] }
  | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Відхилення лише з причиною (AC-APR-06, AC-LANG-05); схвалення причини не має. Схвалення з позначеними рядками —
// часткове (AC-DEC-01): позначені рядки база відхиляє, решту схвалює. Відхилення заявки відхиляє всі рядки, тож
// позначок не бере. Позначка — лише id рядка; що рядок саме цієї заявки, перевіряє база.
export function validateDecision(decision: string, reason: string, rejectedLines: readonly string[] = []): DecisionCheck {
  if (decision === "approve") {
    if (!rejectedLines.every((id) => UUID.test(id))) return { ok: false, error: MESSAGES.forbidden };
    return { ok: true, decision, reason: null, rejectedLines: [...rejectedLines] };
  }
  if (decision !== "reject") return { ok: false, error: MESSAGES.forbidden };
  const trimmed = reason.trim();
  if (!trimmed) return { ok: false, error: MESSAGES.provideReason };
  return { ok: true, decision, reason: trimmed, rejectedLines: [] };
}
