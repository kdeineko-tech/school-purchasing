"use client";

// AI-пропозиція рядка на формі нової закупівлі (AC-AI-01 … AC-AI-06). Окрема форма поруч із формою закупівлі (не
// вкладена): «Suggest lines» лише просить пропозицію, а подає закупівлю тільки «Submit» основної форми.
// Модуль із ключем сюди не імпортуємо: лише Server Action (tests/ai-key.test.ts).
import { useActionState, useEffect, useState } from "react";
import { Alert, Button, Input } from "@/components/ui";
import { MESSAGES } from "@/lib/org/messages";
import type { PurchaseLineInput } from "@/lib/purchases/form";
import { MAX_DESCRIPTION_LENGTH } from "@/lib/ai/prompts/suggest";
import { suggestLine, type SuggestState } from "./suggest-action";

export function LineSuggestion({ onLine }: { onLine: (line: PurchaseLineInput) => void }) {
  const [state, action, pending] = useActionState<SuggestState, FormData>(suggestLine, null);
  // Керований опис: лишається в полі й під час очікування, і після відповіді (AC-AI-03).
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (state?.kind === "line") onLine(state.line);
    // Лише нова відповідь (id), а не кожен рендер.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.id]);

  return (
    <form action={action} className="flex flex-col gap-2" data-testid="line-suggestion">
      <SuggestControls
        description={description}
        onDescription={setDescription}
        pending={pending}
        message={!pending && state?.kind === "message" ? state.message : undefined}
      />
    </form>
  );
}

// Розмітка без стану — щоб тест перевірив очікування (AC-AI-03) і повідомлення без браузера.
export function SuggestControls({
  description,
  onDescription,
  pending,
  message,
}: {
  description: string;
  onDescription: (value: string) => void;
  pending: boolean;
  message?: string;
}) {
  return (
    <>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        {MESSAGES.purchaseDescription}
        <Input
          name="description"
          required
          maxLength={MAX_DESCRIPTION_LENGTH}
          value={description}
          onChange={(e) => onDescription(e.target.value)}
          data-testid="purchase-description"
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="secondary" disabled={pending} data-testid="suggest-lines">
          {MESSAGES.suggestLines}
        </Button>
        {pending ? (
          <span role="status" className="text-sm text-muted-foreground" data-testid="suggest-pending">
            {MESSAGES.lookingForLines}
          </span>
        ) : null}
      </div>
      {message ? <Alert testId="suggest-message" tone="neutral">{message}</Alert> : null}
    </>
  );
}
