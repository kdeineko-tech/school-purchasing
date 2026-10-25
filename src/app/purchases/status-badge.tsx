import { Badge } from "@/components/ui";
import { STATUS_LABELS, type PurchaseStatus } from "@/lib/purchases/form";

const STATUS_TONE: Record<PurchaseStatus, "neutral" | "accent" | "danger"> = {
  awaiting_approval: "neutral",
  approved: "accent",
  rejected: "danger",
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
