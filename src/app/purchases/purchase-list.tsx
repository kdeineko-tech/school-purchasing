// Рядки списку заявок: відділ, автор (лише у списку для рішення, AC-APR-08), тип · дата подання, статус текстом
// (AC-FRM-10, AC-LANG-06).
// Спільні для «My requests», «Approvals» і головної.
import Link from "next/link";
import type { PurchaseListData } from "@/lib/purchases/lists";
import { formatSubmittedAt, PURCHASE_TYPE_LABELS, type PurchaseTypeId } from "@/lib/purchases/form";
import { StatusBadge } from "./status-badge";

export function PurchaseList({
  rows,
  departmentName,
  authorName,
  testId,
}: Pick<PurchaseListData, "rows" | "departmentName" | "authorName"> & { testId: string }) {
  return (
    <ul className="flex flex-col divide-y divide-border" data-testid={testId}>
      {rows.map((p) => (
        <li key={p.id}>
          <Link
            href={`/purchases/${p.id}`}
            className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm hover:text-primary"
          >
            <div className="flex flex-col">
              <span className="font-medium">{departmentName.get(p.department_id) ?? "—"}</span>
              {authorName && (
                <span data-testid="purchase-author">
                  <span className="text-muted-foreground">Author:</span> {authorName.get(p.id) ?? "—"}
                </span>
              )}
              <span className="text-muted-foreground">
                {PURCHASE_TYPE_LABELS[p.purchase_type as PurchaseTypeId] ?? p.purchase_type} ·{" "}
                {formatSubmittedAt(p.created_at)}
              </span>
            </div>
            <StatusBadge status={p.status} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
