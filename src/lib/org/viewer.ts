// Хто переглядає сторінку: роль і активність з profiles. Перевірку доступу робимо в кожній сторінці,
// а не в layout: layout не зупиняє рендер вкладених сторінок (Next.js 16, guides/authentication.md).
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, is_active")
    .eq("id", claims.sub)
    .maybeSingle();
  // Помилку бази (наприклад, міграцію ще не застосовано) не видаємо за «не увійшов»:
  // інакше сторінка мовчки перекидає на /login і причину не видно.
  if (error) {
    throw new Error(`Failed to read profile: ${error.message}`);
  }
  if (!profile) return null;
  // AC-ORG-12: деактивований працівник не працює з жодною сторінкою, навіть якщо proxy не зміг перевірити
  // профіль через тимчасову помилку бази.
  if (!profile.is_active) redirect("/login?error=deactivated");

  return {
    id: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    role: profile.role as AppRole,
    isActive: profile.is_active,
  };
}
