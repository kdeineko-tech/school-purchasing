"use client";

// Сторінка помилки у стилі застосунку (DESIGN.md, розділ 6). Текст помилки сервера не показуємо: у ньому можуть
// бути деталі бази. «Try again» перерендерює сторінку, «Back to home» — вихід, якщо помилка повторюється.
import Link from "next/link";
import { Button, Logo } from "@/components/ui";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div
        role="alert"
        className="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl border border-border bg-card p-8 text-center shadow-sm"
      >
        <Logo size={56} className="rounded-xl" />
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="text-sm text-muted-foreground">Please try again. If it happens again, go back to the home page.</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button type="button" onClick={reset}>
            Try again
          </Button>
          <Link
            href="/"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-input px-4 text-sm font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:outline-solid"
          >
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
