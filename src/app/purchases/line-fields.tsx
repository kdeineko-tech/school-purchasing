"use client";

// Рядки закупівлі у формі: змінити, додати, прибрати (AC-FRM-07, AC-FRM-15). Спільні для нової закупівлі й повторного
// подання поверненої заявки (AC-DEC-07, #66); рядки йдуть у server action одним прихованим полем JSON.
import { startTransition, useActionState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { Button, Input } from "@/components/ui";
import { MAX_TEXT_LENGTH, type PurchaseLineInput } from "@/lib/purchases/form";
import type { SubmitState } from "./actions";

const EMPTY_LINE: PurchaseLineInput = { name: "", purpose: "", quantity: "", unitPrice: "" };

export function LineFields({
  lines,
  setLines,
}: {
  lines: PurchaseLineInput[];
  setLines: Dispatch<SetStateAction<PurchaseLineInput[]>>;
}) {
  const updateLine = (index: number, field: keyof PurchaseLineInput, value: string) =>
    setLines((current) => current.map((line, i) => (i === index ? { ...line, [field]: value } : line)));

  return (
    <>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-sm font-medium">Lines</legend>
        {lines.map((line, index) => (
          <div key={index} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[2fr_2fr_1fr_1fr_auto]">
            <Input aria-label="Item" placeholder="Item" maxLength={MAX_TEXT_LENGTH} value={line.name} onChange={(e) => updateLine(index, "name", e.target.value)} />
            <Input aria-label="Purpose" placeholder="Purpose" maxLength={MAX_TEXT_LENGTH} value={line.purpose} onChange={(e) => updateLine(index, "purpose", e.target.value)} />
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
    </>
  );
}

// Подаємо через onSubmit, а не `<form action>`: після дії `<form action>` React 19 скидає форму до значень першого
// рендеру, і вибраний відділ ставав «Select a department» (знайшов UAT AC-FRM-06 на проді, WS8). Перевірку required
// браузер робить до події submit; далі — та сама server action, але без автоскидання форми.
export function useFormSubmit(action: (prev: SubmitState, formData: FormData) => Promise<SubmitState>) {
  const [state, formAction, pending] = useActionState<SubmitState, FormData>(action, {});
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  };
  return { state, submit, pending };
}
