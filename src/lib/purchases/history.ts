// Історія заявки (AC-HIST-06, AC-HIST-10; ADR docs/decisions/0005-purchase-history-events.md). Записи пише база
// (private.submit_purchase), а читає функція public.purchase_history: вона сама перевіряє видимість заявки й повертає
// лише вид запису, час і ім'я того, хто діяв (без імені — email).
import { MISSING_FUNCTION } from "@/lib/purchases/lists";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type HistoryEntry = { kind: string; created_at: string; actor_name: string };

// Підписи — таблиця перекладу ValiaBihun/2026-quitcode-dream-team#49 («Подано» — «Submitted»).
const KIND_LABELS: Record<string, string> = { submitted: "Submitted" };

// Дата й час за America/New_York, 24-годинний, без позначки поясу: «05.11.2026, 14:32» (відповідь PM
// ValiaBihun/2026-quitcode-dream-team#74). Частини збираємо самі, щоб роздільники не залежали від локалі.
const HISTORY_TIME = new Intl.DateTimeFormat("en-GB", {
  timeZone: "America/New_York",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function formatHistoryTime(isoTimestamp: string): string {
  const part = Object.fromEntries(
    HISTORY_TIME.formatToParts(new Date(isoTimestamp)).map(({ type, value }) => [type, value]),
  );
  return `${part.day}.${part.month}.${part.year}, ${part.hour}:${part.minute}`;
}

/** «Submitted · PM Demo Requester · 05.11.2026, 14:32»; невідомий вид — як є. */
export function formatHistoryEntry(entry: HistoryEntry): string {
  return [KIND_LABELS[entry.kind] ?? entry.kind, entry.actor_name, formatHistoryTime(entry.created_at)].join(" · ");
}

// Поки функції в базі немає (код уже на Vercel, а db-deploy ще не застосував міграцію) — історія порожня, а не
// помилка сторінки. Будь-яку іншу помилку бази не ховаємо.
export async function loadHistory(supabase: Supabase, purchaseId: string): Promise<HistoryEntry[]> {
  const { data, error } = await supabase.rpc("purchase_history", { p_purchase_id: purchaseId });
  if (error && MISSING_FUNCTION.has(error.code)) return [];
  if (error) throw new Error(`Failed to read request history: ${error.message}`);
  return data ?? [];
}
