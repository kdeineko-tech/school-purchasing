import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { NoAccess } from "@/app/admin/no-access";
import { PageShell } from "@/components/page-shell";
import { Card } from "@/components/ui";
import { getViewer } from "@/lib/org/viewer";
import { formatNumber } from "@/lib/purchases/amounts";
import { canEditReturned } from "@/lib/purchases/decisions";
import { PURCHASE_TYPE_LABELS, type PurchaseLineInput, type PurchaseTypeId } from "@/lib/purchases/form";
import { createClient } from "@/lib/supabase/server";
import { ResubmitForm } from "./resubmit-form";

export const metadata: Metadata = { title: "Edit purchase" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ReturnedPurchase = {
  id: string;
  author_id: string;
  department_id: string;
  purchase_type: string;
  status: string;
  number: number | null;
  return_reason: string | null;
};
type StoredLine = { name: string | null; purpose: string | null; quantity: number | null; unit_price: number | null };

// Рядок з бази → поле форми: ціна з двома знаками, як її вводять.
const toInput = (line: StoredLine): PurchaseLineInput => ({
  name: line.name ?? "",
  purpose: line.purpose ?? "",
  quantity: line.quantity === null ? "" : String(line.quantity),
  unitPrice: line.unit_price === null ? "" : Number(line.unit_price).toFixed(2),
});

// Сторінка повторного подання (AC-DEC-07): лише автор поверненої заявки; іншим — «Not enough permissions» без даних
// заявки. Відділ, тип і номер показано без змін (їх не змінюють, #66), причину повернення — поруч (AC-DEC-04).
export default async function EditPurchasePage({ params }: PageProps<"/purchases/[id]/edit">) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  const { id } = await params;
  if (!UUID.test(id)) return <NoAccess viewer={viewer} />;

  const supabase = await createClient();
  const [{ data: purchase, error: purchaseError }, { data: lines, error: linesError }] = await Promise.all([
    supabase
      .from("purchases")
      .select("id, author_id, department_id, purchase_type, status, number, return_reason")
      .eq("id", id)
      .maybeSingle() as unknown as PromiseLike<{ data: ReturnedPurchase | null; error: { message: string } | null }>,
    supabase
      .from("purchase_lines")
      .select("name, purpose, quantity, unit_price")
      .eq("purchase_id", id)
      .order("position") as unknown as PromiseLike<{ data: StoredLine[] | null; error: { message: string } | null }>,
  ]);
  const readError = purchaseError ?? linesError;
  if (readError) throw new Error(`Failed to read purchase: ${readError.message}`);
  if (!purchase || !canEditReturned(viewer, { authorId: purchase.author_id, status: purchase.status })) {
    return <NoAccess viewer={viewer} />;
  }

  const { data: department, error: departmentError } = await supabase
    .from("departments")
    .select("name")
    .eq("id", purchase.department_id)
    .maybeSingle();
  if (departmentError) throw new Error(`Failed to read department: ${departmentError.message}`);

  return (
    <PageShell viewer={viewer} title="Edit purchase" back={{ href: `/purchases/${purchase.id}`, label: "Purchase" }}>
      <Card>
        <dl className="grid grid-cols-[max-content_1fr] items-center gap-x-6 gap-y-3 text-sm">
          <dt className="text-muted-foreground">Number</dt>
          <dd className="font-medium tabular-nums">{formatNumber(purchase.number)}</dd>
          <dt className="text-muted-foreground">Department</dt>
          <dd data-testid="purchase-department">{department?.name ?? "—"}</dd>
          <dt className="text-muted-foreground">Purchase type</dt>
          <dd>{PURCHASE_TYPE_LABELS[purchase.purchase_type as PurchaseTypeId] ?? purchase.purchase_type}</dd>
          <dt className="text-muted-foreground">Reason</dt>
          <dd data-testid="return-reason">{purchase.return_reason ?? "—"}</dd>
        </dl>
      </Card>
      <Card>
        <ResubmitForm purchaseId={purchase.id} initialLines={(lines ?? []).map(toInput)} />
      </Card>
    </PageShell>
  );
}
