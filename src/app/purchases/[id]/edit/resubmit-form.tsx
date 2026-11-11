"use client";

// Повторне подання поверненої заявки (AC-DEC-07): автор змінює, додає й прибирає рядки; відділ і тип не змінюються
// (#66). Подаємо через onSubmit (useFormSubmit), як у формі нової закупівлі: після відмови рядки лишаються у формі.
import { useState } from "react";
import { Alert, Button } from "@/components/ui";
import type { PurchaseLineInput } from "@/lib/purchases/form";
import { resubmitPurchase } from "../../actions";
import { LineFields, useFormSubmit } from "../../line-fields";

export function ResubmitForm({ purchaseId, initialLines }: { purchaseId: string; initialLines: PurchaseLineInput[] }) {
  const { state, submit, pending } = useFormSubmit(resubmitPurchase);
  const [lines, setLines] = useState<PurchaseLineInput[]>(initialLines);

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" data-testid="resubmit-form">
      <input type="hidden" name="purchaseId" value={purchaseId} />
      <LineFields lines={lines} setLines={setLines} />
      {state.error ? <Alert testId="form-error">{state.error}</Alert> : null}
      <Button type="submit" disabled={pending} className="self-start">
        Submit
      </Button>
    </form>
  );
}
