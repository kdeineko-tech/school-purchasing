"use client";

// Форма закупівлі. Поля керовані: після відмови (наприклад, «Add at least one line») обрані відділ, тип і рядки
// лишаються у формі (AC-FRM-06). Рядки йдуть у server action одним прихованим полем JSON.
import { useActionState, useState } from "react";
import { Alert, Button, Input, Select } from "@/components/ui";
import type { Department } from "@/lib/org/membership";
import { PURCHASE_TYPE_LABELS, type PurchaseLineInput, type PurchaseTypeId } from "@/lib/purchases/form";
import { submitPurchase, type SubmitState } from "../actions";

const EMPTY_LINE: PurchaseLineInput = { name: "", purpose: "", quantity: "", unitPrice: "" };

export function PurchaseForm({
  departments,
  purchaseTypes,
}: {
  departments: Department[];
  purchaseTypes: PurchaseTypeId[];
}) {
  const [state, formAction, pending] = useActionState<SubmitState, FormData>(submitPurchase, {});
  const [departmentId, setDepartmentId] = useState(departments.length === 1 ? departments[0].id : "");
  const [purchaseType, setPurchaseType] = useState<string>(purchaseTypes.length === 1 ? purchaseTypes[0] : "");
  const [lines, setLines] = useState<PurchaseLineInput[]>([]);

  const updateLine = (index: number, field: keyof PurchaseLineInput, value: string) =>
    setLines((current) => current.map((line, i) => (i === index ? { ...line, [field]: value } : line)));

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Department
          <Select
            name="departmentId"
            required
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            data-testid="department-select"
          >
            <option value="" disabled>
              Select a department
            </option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Purchase type
          <Select
            name="purchaseType"
            required
            value={purchaseType}
            onChange={(e) => setPurchaseType(e.target.value)}
            data-testid="purchase-type-select"
          >
            <option value="" disabled>
              Select a purchase type
            </option>
            {purchaseTypes.map((t) => (
              <option key={t} value={t}>
                {PURCHASE_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
        </label>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-sm font-medium">Lines</legend>
        {lines.map((line, index) => (
          <div key={index} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[2fr_2fr_1fr_1fr_auto]">
            <Input aria-label="Item" placeholder="Item" value={line.name} onChange={(e) => updateLine(index, "name", e.target.value)} />
            <Input aria-label="Purpose" placeholder="Purpose" value={line.purpose} onChange={(e) => updateLine(index, "purpose", e.target.value)} />
            <Input aria-label="Quantity" placeholder="Quantity" type="number" inputMode="numeric" value={line.quantity} onChange={(e) => updateLine(index, "quantity", e.target.value)} />
            <Input aria-label="Unit price" placeholder="Unit price" type="number" step="0.01" inputMode="decimal" value={line.unitPrice} onChange={(e) => updateLine(index, "unitPrice", e.target.value)} />
            <Button type="button" variant="secondary" onClick={() => setLines((current) => current.filter((_, i) => i !== index))}>
              Remove
            </Button>
          </div>
        ))}
        <Button type="button" variant="secondary" className="self-start" onClick={() => setLines((current) => [...current, EMPTY_LINE])}>
          Add line
        </Button>
      </fieldset>

      <input type="hidden" name="lines" value={JSON.stringify(lines)} />
      {state.error ? <Alert testId="form-error">{state.error}</Alert> : null}
      <Button type="submit" disabled={pending} className="self-start">
        Submit
      </Button>
    </form>
  );
}
