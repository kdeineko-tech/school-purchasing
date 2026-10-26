// Компоненти застосунку поверх shadcn/ui (DESIGN.md, розділ 5). Лише вигляд: тексти й поведінку задають сторінки.
// Кольори — лише семантичні токени з src/app/globals.css.
import Image from "next/image";
import type { ComponentProps, ReactNode } from "react";
import type { AppRole } from "@/lib/org/access";
import { cn } from "@/lib/utils";
import { Alert as AlertBase } from "./alert";
import { Badge as BadgeBase } from "./badge";
import { Button as ButtonBase } from "./button";
import { Input as InputBase } from "./input";

export { Label } from "./label";
export { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table";

const ROLE_LABELS: Record<AppRole, string> = {
  requester: "Requester",
  approver: "Approver",
  admin: "Administrator",
};

export function roleLabel(role: string): string {
  return ROLE_LABELS[role as AppRole] ?? role;
}

// Фокус — суцільне кільце `ring` 2px з відступом (DESIGN.md, розділ 7), а не напівпрозоре.
const FOCUS = "focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

// Зона натискання ≥ 40px (DESIGN.md, розділ 4). Варіанти shadcn: default — одна основна дія на екран.
export function Button({ className, ...props }: ComponentProps<typeof ButtonBase>) {
  return <ButtonBase className={cn("h-10 px-4", FOCUS, className)} {...props} />;
}

export function Input({ className, ...props }: ComponentProps<typeof InputBase>) {
  return <InputBase className={cn("h-10 bg-card px-3", FOCUS, className)} {...props} />;
}

// Нативний <select>: форма лишається звичайною HTML-формою для Server Action.
export function Select({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground disabled:opacity-50",
        FOCUS,
        className,
      )}
      {...props}
    />
  );
}

// Лого школи (public/logo.png): герб на власному темно-зеленому тлі, тож однаковий у світлій і темній темі.
// Поруч завжди є назва «School Purchasing», тому зображення декоративне (alt="").
export function Logo({ size, className }: { size: number; className?: string }) {
  return (
    <Image src="/logo.png" alt="" width={size} height={size} priority className={cn("rounded-lg", className)} />
  );
}

export function Card({ title, children, className }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section
      data-slot="card"
      className={cn("rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm", className)}
    >
      {title && <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase">{title}</h2>}
      {children}
    </section>
  );
}

const BADGE_TONES = {
  neutral: "border-border bg-secondary text-secondary-foreground",
  accent: "bg-accent text-accent-foreground",
  danger: "bg-status-rejected text-status-rejected-foreground",
  pending: "bg-status-pending text-status-pending-foreground",
  approved: "bg-status-approved text-status-approved-foreground",
  rejected: "bg-status-rejected text-status-rejected-foreground",
} as const;

// Статус і роль — завжди текстом; колір лише підсилює (DESIGN.md, розділ 2).
export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: keyof typeof BADGE_TONES }) {
  return (
    <BadgeBase variant="outline" className={cn("h-auto rounded-full px-2.5 py-0.5", BADGE_TONES[tone])}>
      {children}
    </BadgeBase>
  );
}

// Підпис ролі — англійська назва з таблиці ValiaBihun/2026-quitcode-dream-team#49; ідентифікатор ролі (requester,
// approver, admin) лишається без змін — у data-role і в підказці (AC-LANG-08).
export function RoleBadge({ role }: { role: string }) {
  return (
    <span data-role={role} title={role} className="inline-flex">
      <Badge tone={role === "admin" ? "accent" : "neutral"}>{roleLabel(role)}</Badge>
    </span>
  );
}

// Помилка введення — destructive; відмова («Not enough permissions») — нейтральна: людина нічого не зламала
// («Вигляд і тон» PM).
export function Alert({
  children,
  testId,
  tone = "error",
}: {
  children: ReactNode;
  testId?: string;
  tone?: "error" | "neutral";
}) {
  return (
    <AlertBase
      variant={tone === "error" ? "destructive" : "default"}
      data-testid={testId}
      className={cn(
        "px-3 py-2",
        tone === "error" ? "border-destructive" : "border-border bg-muted text-foreground",
      )}
    >
      {children}
    </AlertBase>
  );
}

export function Notice({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <p role="status" data-testid={testId} className="rounded-lg bg-accent px-3 py-2 text-sm text-accent-foreground">
      {children}
    </p>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}
