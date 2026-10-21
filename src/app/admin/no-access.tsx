import Link from "next/link";
import { MESSAGES } from "@/lib/org/messages";

// Відмова для сторінок адміністратора (AC-ORG-09).
export function NoAccess() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-6 py-16">
      <p role="alert" data-testid="no-access" className="text-lg font-medium">
        {MESSAGES.forbidden}
      </p>
      <Link href="/" className="text-sm underline">
        На головну
      </Link>
    </main>
  );
}
