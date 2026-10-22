import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { Alert, Card } from "@/components/ui";
import { MESSAGES } from "@/lib/org/messages";
import type { ViewerProfile } from "@/lib/org/viewer";

// Відмова для сторінок адміністратора (AC-ORG-09).
export function NoAccess({ viewer = null }: { viewer?: ViewerProfile | null }) {
  return (
    <PageShell viewer={viewer}>
      <Card className="flex flex-col items-start gap-4">
        <Alert testId="no-access">{MESSAGES.forbidden}</Alert>
        <Link href="/" className="text-sm text-accent hover:underline">
          На головну
        </Link>
      </Card>
    </PageShell>
  );
}
