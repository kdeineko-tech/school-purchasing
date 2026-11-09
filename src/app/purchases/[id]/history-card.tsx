import { Card } from "@/components/ui";
import { formatHistoryEntry, type HistoryEntry } from "@/lib/purchases/history";

// Блок «History» сторінки заявки (AC-HIST-06): записи «Submitted · <ім'я> · <дата, час>» у порядку бази; поки функції
// історії в базі немає (loadHistory) — «—».
export function HistoryCard({ history }: { history: HistoryEntry[] }) {
  return (
    <Card title="History">
      {history.length === 0 ? (
        <p className="text-sm text-muted-foreground">—</p>
      ) : (
        <ol className="flex flex-col gap-2 text-sm" data-testid="purchase-history">
          {history.map((entry) => (
            <li key={`${entry.kind}-${entry.created_at}`} data-testid="history-entry">
              {formatHistoryEntry(entry)}
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
