// Оновлення сесії Supabase на кожен запит (викликається з src/proxy.ts).
// Офіційний патерн @supabase/ssr ≥ 0.10: setAll(cookies, headers) — заголовки
// Cache-Control/Expires/Pragma копіюємо у відповідь, щоб CDN не кешував auth-відповіді.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./database.types";

// Сторінки, доступні без входу.
const PUBLIC_PATHS = ["/login", "/auth"];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  // Заголовки кешування з setAll — щоб перенести їх і в перенаправлення після signOut (AC-ORG-12).
  let authCacheHeaders: Record<string, string> = {};

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          // Об'єднуємо: наступний виклик (signOut) не має стерти заголовки з першого запису cookie.
          authCacheHeaders = { ...authCacheHeaders, ...headers };
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([key, value]) =>
            supabaseResponse.headers.set(key, value),
          );
        },
      },
    },
  );

  // Між createServerClient і getClaims() не додавайте жодного коду:
  // інакше користувачів може випадково «розлогінювати».
  // getClaims() перевіряє підпис JWT; getSession() для авторизації НЕ використовуємо.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  const isPublic = PUBLIC_PATHS.some((path) =>
    request.nextUrl.pathname.startsWith(path),
  );

  if (!claims && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // AC-ORG-12: працівника деактивували, поки він був у системі, — виходимо з сесії й показуємо повідомлення PM.
  // Дані йому й так недоступні (RLS: current_app_role() лише активного профілю).
  if (claims && !isPublic) {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("is_active")
      .eq("id", claims.sub)
      .maybeSingle();
    // Профілю немає — сесія ні до чого не прив'язана: виходимо. Тимчасову помилку бази пропускаємо:
    // дані закриває RLS, а сторінка покаже помилку читання профілю (getViewer), не виганяючи всіх із сесії.
    if (!error && (!profile || !profile.is_active)) {
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = profile ? "?error=deactivated" : "";
      const response = NextResponse.redirect(url);
      // Cookie без сесії, які поставив signOut, переносимо у відповідь-перенаправлення.
      supabaseResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
      // Лише заголовки кешування з setAll (Cache-Control тощо), без службових x-middleware-*.
      Object.entries(authCacheHeaders).forEach(([key, value]) => response.headers.set(key, value));
      return response;
    }
  }

  // Повертаємо саме supabaseResponse: у ньому оновлені cookie сесії.
  return supabaseResponse;
}
