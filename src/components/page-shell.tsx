// Каркас сторінки після входу: шапка в один рядок (герб, навігація за роллю, тема, меню під аватаром), заголовок і вміст.
// На телефоні навігація переходить другим рядком під герб.
// Посилання «Налаштування» — за тим самим правилом, що й доступ до /admin (AC-ORG-09).
import Link from "next/link";
import type { ReactNode } from "react";
import { canOpenAdminPages } from "@/lib/org/access";
import type { ViewerProfile } from "@/lib/org/viewer";
import { Logo, ThemeToggle } from "./ui";
import { UserMenu } from "./user-menu";

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
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2 sm:flex-nowrap sm:px-6">
          <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold">
            <Logo size={32} />
            School Purchasing
          </Link>
          <div className="ml-auto flex items-center gap-2 sm:order-last">
            <ThemeToggle />
            {viewer && <UserMenu viewer={viewer} />}
          </div>
          {viewer && (
            <nav
              aria-label="Main"
              className="flex w-full items-center gap-4 overflow-x-auto text-sm text-muted-foreground sm:w-auto"
            >
              <Link href="/purchases" className="whitespace-nowrap hover:text-foreground">
                My requests
              </Link>
              {viewer.role !== "requester" && (
                <Link href="/approvals" className="whitespace-nowrap hover:text-foreground">
                  Approvals
                </Link>
              )}
              {canOpenAdminPages(viewer) && (
                <Link href="/admin" className="whitespace-nowrap hover:text-foreground">
                  Settings
                </Link>
              )}
            </nav>
          )}
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
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
