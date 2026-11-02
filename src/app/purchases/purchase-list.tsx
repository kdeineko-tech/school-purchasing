// Рядки списку заявок: відділ, автор (лише у списку для рішення, AC-APR-08), тип · дата подання, статус текстом
// (AC-FRM-10, AC-LANG-06).
// Спільні для «My requests», «Approvals» і головної. Коли місця досить (контейнер ширший за 36rem — повні сторінки
// списків), рядки вишикувані в колонки з заголовками, як таблиця; у вузьких картках головної й на телефоні —
// компактний рядок.
// Рядки без фонового підвантаження (prefetch={false}): інакше кожна видима заявка — окремий серверний запит, який
// конкурує з переходом на іншу сторінку. Посилання меню й карток головної підвантажуються, як і раніше.
import Link from "next/link";
import type { PurchaseListData } from "@/lib/purchases/lists";
import { formatSubmittedAt, PURCHASE_TYPE_LABELS, type PurchaseTypeId } from "@/lib/purchases/form";
import { StatusBadge } from "./status-badge";

const COLUMNS = "@xl:grid @xl:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_minmax(0,1.2fr)_9rem] @xl:items-center @xl:gap-4";

export function PurchaseList({
  rows,
  departmentName,
  authorName,
  testId,
}: Pick<PurchaseListData, "rows" | "departmentName" | "authorName"> & { testId: string }) {
  return (
    <div className="@container">
      <div
        aria-hidden
        className={`hidden border-b border-border pb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase ${COLUMNS}`}
      >
        <span>{authorName ? "Department · Author" : "Department"}</span>
        <span>Purchase type</span>
        <span>Submitted</span>
        <span>Status</span>
      </div>
      <ul className="flex flex-col divide-y divide-border" data-testid={testId}>
        {rows.map((p) => {
          const type = PURCHASE_TYPE_LABELS[p.purchase_type as PurchaseTypeId] ?? p.purchase_type;
          const submitted = formatSubmittedAt(p.created_at);
          return (
            <li key={p.id}>
              <Link
                href={`/purchases/${p.id}`}
                prefetch={false}
                className={`flex flex-wrap items-center justify-between gap-2 py-3 text-sm hover:text-primary ${COLUMNS}`}
              >
                <div className="flex min-w-0 flex-col">
                  <span className="font-medium">{departmentName.get(p.department_id) ?? "—"}</span>
                  {authorName && (
                    <span data-testid="purchase-author">
                      <span className="text-muted-foreground">Author:</span> {authorName.get(p.id) ?? "—"}
                    </span>
                  )}
                  <span className="text-muted-foreground @xl:hidden">
                    {type} · {submitted}
                  </span>
                </div>
                <span className="hidden text-muted-foreground @xl:block">{type}</span>
                <span className="hidden text-muted-foreground tabular-nums @xl:block">{submitted}</span>
                <span className="@xl:justify-self-start">
                  <StatusBadge status={p.status} />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
