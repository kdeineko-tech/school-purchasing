import { Card } from "@/components/ui";
import { formatCents, lineTotal, purchaseTotal } from "@/lib/purchases/amounts";
import { LINE_STATUS_LABELS } from "@/lib/purchases/form";

export type PurchaseLine = {
  id?: string;
  position: number;
  name: string | null;
  purpose: string | null;
  quantity: number | null;
  unit_price: number | null;
  // Немає, поки міграцію часткового схвалення не застосовано.
  status?: string;
};

const price = (value: number | null) => (value === null ? "—" : Number(value).toFixed(2));

// Блок «Lines» сторінки заявки: сума кожного рядка й сума заявки за всіма рядками (AC-HIST-02, #65). Після рішення —
// статус кожного рядка «Approved» / «Rejected» (AC-DEC-01); до рішення колонки статусу немає. Схвалювачу, який вирішує
// заявку (decisionFormId), — позначка «Reject line» біля кожного рядка: checkbox належить формі рішення (атрибут form),
// тож «Approve» передає позначені рядки тим самим server action.
export function LinesCard({ lines, decisionFormId }: { lines: PurchaseLine[]; decisionFormId?: string }) {
  const decided = lines.some((line) => line.status !== undefined && line.status in LINE_STATUS_LABELS);
  return (
    <Card title="Lines">
      <table aria-label="Lines" className="w-full text-left text-sm" data-testid="purchase-lines">
        <thead className="text-muted-foreground">
          <tr>
            {decisionFormId && <th className="py-2 pr-2 font-medium">Reject line</th>}
            <th className="py-2 font-medium">Item</th>
            <th className="py-2 font-medium">Purpose</th>
            <th className="py-2 text-right font-medium">Quantity</th>
            <th className="py-2 text-right font-medium">Unit price</th>
            <th className="py-2 text-right font-medium">Line total</th>
            {decided && <th className="py-2 pl-4 font-medium">Status</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {lines.map((line) => (
            <tr key={line.position}>
              {decisionFormId && (
                <td className="py-2 pr-2">
                  <input
                    type="checkbox"
                    name="rejectedLines"
                    value={line.id}
                    form={decisionFormId}
                    aria-label={`Reject line ${line.position}`}
                    data-testid="reject-line"
                  />
                </td>
              )}
              <td className="py-2">{line.name ?? "—"}</td>
              <td className="py-2">{line.purpose ?? "—"}</td>
              <td className="py-2 text-right">{line.quantity ?? "—"}</td>
              <td className="py-2 text-right">{price(line.unit_price)}</td>
              <td className="py-2 text-right tabular-nums" data-testid="line-total">
                {formatCents(lineTotal(line.quantity, line.unit_price))}
              </td>
              {decided && (
                <td className="py-2 pl-4" data-testid="line-status">
                  {LINE_STATUS_LABELS[line.status ?? ""] ?? "—"}
                </td>
              )}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-border font-medium">
            <td className="py-2" colSpan={(decisionFormId ? 1 : 0) + 4}>
              Total
            </td>
            <td className="py-2 text-right tabular-nums" data-testid="purchase-total">
              {formatCents(purchaseTotal(lines))}
            </td>
            {decided && <td />}
          </tr>
        </tfoot>
      </table>
    </Card>
  );
}
