import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { Alert, Card } from "@/components/ui";
import { MESSAGES } from "@/lib/org/messages";
import type { ViewerProfile } from "@/lib/org/viewer";

// Відмова «Not enough permissions» без даних: сторінки адміністратора (AC-ORG-09) і чужа закупівля (AC-FRM-08).
export function NoAccess({ viewer = null }: { viewer?: ViewerProfile | null }) {
  return (
    <PageShell viewer={viewer}>
      <Card className="flex flex-col items-start gap-4">
        <Alert testId="no-access" tone="neutral">{MESSAGES.forbidden}</Alert>
        <Link href="/" className="text-sm text-primary hover:underline">
          Back to home
        </Link>
      </Card>
    </PageShell>
  );
}
