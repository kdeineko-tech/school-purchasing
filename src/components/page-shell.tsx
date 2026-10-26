// Каркас сторінки після входу: шапка з навігацією за роллю, заголовок і вміст.
// Посилання «Налаштування» — за тим самим правилом, що й доступ до /admin (AC-ORG-09).
import Link from "next/link";
import type { ReactNode } from "react";
import { signOut } from "@/app/login/actions";
import { canOpenAdminPages } from "@/lib/org/access";
import type { ViewerProfile } from "@/lib/org/viewer";
import { Button, Logo, RoleBadge, ThemeToggle } from "./ui";

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
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Logo size={32} />
            School Purchasing
          </Link>
          {viewer && (
            <nav className="flex items-center gap-4 text-sm text-muted-foreground">
              <Link href="/purchases" className="hover:text-foreground">
                My requests
              </Link>
              {viewer.role !== "requester" && (
                <Link href="/approvals" className="hover:text-foreground">
                  Approvals
                </Link>
              )}
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
          <div className="ml-auto flex items-center gap-3 text-sm">
            {viewer && (
              <>
                <span className="hidden text-muted-foreground sm:inline">{viewer.fullName ?? viewer.email}</span>
                <RoleBadge role={viewer.role} />
              </>
            )}
            <ThemeToggle />
            {viewer && (
              <form action={signOut}>
                <Button type="submit" variant="ghost" className="h-8 px-2 text-muted-foreground">
                  Sign out
                </Button>
              </form>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
        {back && (
          <Link href={back.href} className="text-sm text-muted-foreground hover:text-foreground">
            ← {back.label}
          </Link>
        )}
        {(title || description) && (
          <div className="flex flex-col gap-1">
            {title && <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>}
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
