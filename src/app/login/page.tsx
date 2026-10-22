import { Alert, Button, Input } from "@/components/ui";
import { login } from "./actions";

const ERRORS: Record<string, string> = {
  missing: "Вкажіть email і пароль.",
  invalid: "Невірний email або пароль.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  const message = typeof error === "string" ? ERRORS[error] : undefined;

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span className="grid size-10 place-items-center rounded-xl bg-accent text-lg font-semibold text-accent-foreground">
            З
          </span>
          <div>
            <h1 className="text-xl font-semibold">Вхід</h1>
            <p className="text-sm text-muted">Закупівлі школи</p>
          </div>
        </div>
        <form action={login} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Email
            <Input name="email" type="email" autoComplete="email" required />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Пароль
            <Input name="password" type="password" autoComplete="current-password" required />
          </label>
          {message ? <Alert>{message}</Alert> : null}
          <Button type="submit" className="mt-2 w-full">
            Увійти
          </Button>
        </form>
      </div>
    </main>
  );
}
