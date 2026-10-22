"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Вхід email + пароль. Реєстрації в шаблоні немає: користувачів створює
// scripts/create-demo-users.mjs (Admin API), бо вбудований SMTP Supabase
// надсилає лише 2 листи/год і лише членам команди проєкту.
export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    redirect("/login?error=missing");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Не показуємо текст помилки Auth: він може підказати, чи існує email.
    redirect("/login?error=invalid");
  }

  // AC-ORG-12: деактивований працівник не входить і бачить повідомлення PM. Пароль він ввів правильно,
  // тож окреме повідомлення не підказує, чи існує email.
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("is_active")
    .eq("id", data.user.id)
    .maybeSingle();
  // Не вдалося перевірити профіль — не пускаємо: нейтральна відмова, як для неправильного пароля.
  if (profileError || !profile) {
    await supabase.auth.signOut();
    redirect("/login?error=invalid");
  }
  if (!profile.is_active) {
    await supabase.auth.signOut();
    redirect("/login?error=deactivated");
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
