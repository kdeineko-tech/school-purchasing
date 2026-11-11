import { Badge } from "@/components/ui";
import { STATUS_LABELS, type PurchaseStatus } from "@/lib/purchases/form";

// Кольори статусів з «Вигляду й тону» PM: очікує — теплий жовтий, схвалено — зелений, відхилено — червоний;
// частково схвалено — зелений, бо закупівля йде далі (рядки, що відхилено, — на сторінці заявки).
const STATUS_TONE: Record<PurchaseStatus, "pending" | "approved" | "rejected"> = {
  awaiting_approval: "pending",
  approved: "approved",
  rejected: "rejected",
  partially_approved: "approved",
};

// Статус підписано текстом, а не лише кольором (AC-LANG-06).
export function StatusBadge({ status }: { status: string }) {
  const known = status as PurchaseStatus;
  return (
    <Badge tone={STATUS_TONE[known] ?? "neutral"}>
      <span data-testid="purchase-status">{STATUS_LABELS[known] ?? status}</span>
    </Badge>
  );
}
