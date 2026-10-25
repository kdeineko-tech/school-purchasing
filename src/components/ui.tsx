// Спільні елементи інтерфейсу. Лише вигляд: тексти й поведінку задають сторінки.
import type { ComponentProps, ReactNode } from "react";
import type { AppRole } from "@/lib/org/access";

const ROLE_LABELS: Record<AppRole, string> = {
  requester: "Requester",
  approver: "Approver",
  admin: "Administrator",
};

export function roleLabel(role: string): string {
  return ROLE_LABELS[role as AppRole] ?? role;
}

export function Card({ title, children, className = "" }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-border bg-surface p-5 shadow-sm ${className}`}>
      {title && <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted uppercase">{title}</h2>}
      {children}
    </section>
  );
}

export function Button({ variant = "primary", className = "", ...props }: ComponentProps<"button"> & {
  variant?: "primary" | "secondary";
}) {
  const look =
    variant === "primary"
      ? "bg-accent text-accent-foreground hover:opacity-90"
      : "border border-border bg-surface hover:bg-background";
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition ${look} ${className}`}
    />
  );
}

const FIELD = "w-full rounded-lg border border-border bg-surface px-3 py-2 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft sm:text-sm";

export function Input({ className = "", ...props }: ComponentProps<"input">) {
  return <input {...props} className={`${FIELD} ${className}`} />;
}

export function Select({ className = "", ...props }: ComponentProps<"select">) {
  return <select {...props} className={`${FIELD} ${className}`} />;
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "accent" | "danger" }) {
  const look = {
    neutral: "bg-background text-muted border border-border",
    accent: "bg-accent-soft text-accent",
    danger: "bg-danger-soft text-danger",
  }[tone];
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${look}`}>{children}</span>;
}

export function RoleBadge({ role }: { role: string }) {
  return <Badge tone={role === "admin" ? "accent" : "neutral"}>{roleLabel(role)}</Badge>;
}

export function Alert({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <p role="alert" data-testid={testId} className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
      {children}
    </p>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted">{children}</p>;
}
