// Хто переглядає сторінку: роль і активність з profiles. Перевірку доступу робимо в кожній сторінці,
// а не в layout: layout не зупиняє рендер вкладених сторінок (Next.js 16, guides/authentication.md).
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { timed } from "@/lib/timing";
import type { AppRole, Viewer } from "./access";

export type ViewerProfile = Viewer & {
  id: string;
  email: string | null;
  fullName: string | null;
};

export async function getViewer(): Promise<ViewerProfile | null> {
  const supabase = await createClient();

  // getClaims() перевіряє JWT. getSession() для авторизації на сервері не використовуємо.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) return null;

  // RLS: власний профіль видно завжди, навіть неактивному.
  const { data: profile, error } = await timed("profile", async () =>
    supabase.from("profiles").select("id, email, full_name, role, is_active").eq("id", claims.sub).maybeSingle(),
  );
  // Помилку бази (наприклад, міграцію ще не застосовано) не видаємо за «не увійшов»:
  // інакше сторінка мовчки перекидає на /login і причину не видно.
  if (error) {
    throw new Error(`Failed to read profile: ${error.message}`);
  }
  // Профіль читаємо лише тут (proxy його не читає). Сесія без профілю чи деактивованого працівника (AC-ORG-12) —
  // вихід із сесії через Route Handler: Server Component cookie не змінює (src/app/auth/signed-out/route.ts).
  if (!profile) redirect("/auth/signed-out");
  if (!profile.is_active) redirect("/auth/signed-out?reason=deactivated");

  return {
    id: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    role: profile.role as AppRole,
    isActive: profile.is_active,
  };
}
