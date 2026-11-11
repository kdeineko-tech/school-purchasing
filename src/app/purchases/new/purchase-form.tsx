"use client";

// Форма закупівлі. Поля керовані: після відмови (наприклад, «Add at least one line») обрані відділ, тип і рядки
// лишаються у формі (AC-FRM-06). Рядки йдуть у server action одним прихованим полем JSON.
// Подаємо через onSubmit (useFormSubmit): інакше React 19 скидає обраний відділ після відмови.
import { useState } from "react";
import { Alert, Button, Select } from "@/components/ui";
import type { Department } from "@/lib/org/membership";
import { PURCHASE_TYPE_LABELS, type PurchaseLineInput, type PurchaseTypeId } from "@/lib/purchases/form";
import { submitPurchase } from "../actions";
import { LineFields, useFormSubmit } from "../line-fields";

export function PurchaseForm({
  departments,
  purchaseTypes,
}: {
  departments: Department[];
  purchaseTypes: PurchaseTypeId[];
}) {
  const { state, submit, pending } = useFormSubmit(submitPurchase);
  const [departmentId, setDepartmentId] = useState(departments.length === 1 ? departments[0].id : "");
  const [purchaseType, setPurchaseType] = useState<string>(purchaseTypes.length === 1 ? purchaseTypes[0] : "");
  const [lines, setLines] = useState<PurchaseLineInput[]>([]);

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
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

      <LineFields lines={lines} setLines={setLines} />
      {state.error ? <Alert testId="form-error">{state.error}</Alert> : null}
      <Button type="submit" disabled={pending} className="self-start">
        Submit
      </Button>
    </form>
  );
}
