import type { Metadata } from "next";
import { Alert, Button, Input, Logo, OpenBook, SchoolBackdrop, ThemeToggle } from "@/components/ui";
import { MESSAGES } from "@/lib/org/messages";
import { login } from "./actions";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  missing: "Enter your email and password.",
  invalid: "Invalid email or password.",
  deactivated: MESSAGES.deactivated, // AC-ORG-12
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  const message = typeof error === "string" ? ERRORS[error] : undefined;

  // На низькому екрані (≤ 720px) — менші відступи, щоб форма входу вміщалась разом із книгою.
  return (
    <main className="relative isolate flex flex-1 flex-col items-center justify-center gap-6 px-4 py-16 [@media(max-height:720px)]:py-6">
      <SchoolBackdrop />
      <ThemeToggle className="absolute top-4 right-4" />
      <OpenBook />
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-700">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Logo size={88} className="rounded-2xl" />
          <div>
            <h1 className="text-xl font-semibold">Sign in</h1>
            <p className="text-sm text-muted-foreground">School Purchasing</p>
          </div>
        </div>
        <form action={login} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Email
            <Input name="email" type="email" autoComplete="email" required />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Password
            <Input name="password" type="password" autoComplete="current-password" required />
          </label>
          {message ? <Alert>{message}</Alert> : null}
          <Button type="submit" className="mt-2 w-full">
            Sign in
          </Button>
        </form>
      </div>
    </main>
  );
}
