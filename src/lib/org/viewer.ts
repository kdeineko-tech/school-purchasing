// Хто переглядає сторінку: роль і активність з profiles. Перевірку доступу робимо в кожній сторінці,
// а не в layout: layout не зупиняє рендер вкладених сторінок (Next.js 16, guides/authentication.md).
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
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, is_active")
    .eq("id", claims.sub)
    .maybeSingle();
  if (!profile) return null;

  return {
    id: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    role: profile.role as AppRole,
    isActive: profile.is_active,
  };
}
