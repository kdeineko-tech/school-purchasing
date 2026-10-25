// Каркас сторінки після входу: шапка з навігацією за роллю, заголовок і вміст.
// Посилання «Налаштування» — за тим самим правилом, що й доступ до /admin (AC-ORG-09).
import Link from "next/link";
import type { ReactNode } from "react";
import { signOut } from "@/app/login/actions";
import { canOpenAdminPages } from "@/lib/org/access";
import type { ViewerProfile } from "@/lib/org/viewer";
import { RoleBadge } from "./ui";

export function PageShell({
  viewer,
  title,
  description,
  back,
  children,
}: {
  viewer: ViewerProfile | null;
  title?: string;
  description?: string;
  back?: { href: string; label: string };
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="grid size-7 place-items-center rounded-lg bg-accent text-sm text-accent-foreground">S</span>
            School Purchasing
          </Link>
          {viewer && (
            <nav className="flex items-center gap-4 text-sm text-muted">
              <Link href="/profile" className="hover:text-foreground">
                My profile
              </Link>
              {canOpenAdminPages(viewer) && (
                <Link href="/admin" className="hover:text-foreground">
                  Settings
                </Link>
              )}
            </nav>
          )}
          {viewer && (
            <div className="ml-auto flex items-center gap-3 text-sm">
              <span className="hidden text-muted sm:inline">{viewer.fullName ?? viewer.email}</span>
              <RoleBadge role={viewer.role} />
              <form action={signOut}>
                <button type="submit" className="text-muted hover:text-foreground">
                  Sign out
                </button>
              </form>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
        {back && (
          <Link href={back.href} className="text-sm text-muted hover:text-foreground">
            ← {back.label}
          </Link>
        )}
        {(title || description) && (
          <div className="flex flex-col gap-1">
            {title && <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>}
            {description && <p className="text-sm text-muted">{description}</p>}
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
