import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/ui";

export const metadata: Metadata = { title: "Page not found" };

// Сторінка 404 у стилі застосунку замість стандартної Next.js: неправильне посилання не «ламає» вигляд.
export default function NotFound() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <Logo size={56} className="rounded-xl" />
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">Page not found</h1>
          <p className="text-sm text-muted-foreground">The link may be wrong or the page no longer exists.</p>
        </div>
        <Link
          href="/"
          className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:outline-solid"
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}
