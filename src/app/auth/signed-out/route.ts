// Вихід із сесії, яка більше ні до чого не веде (AC-ORG-12): працівника деактивували, поки він був у системі, або
// профілю немає. Сюди перенаправляє getViewer (src/lib/org/viewer.ts) — він уже прочитав профіль, тож proxy профіль
// не читає. Server Component cookie не змінює, а Route Handler може: тут signOut очищує cookie сесії.
// Шлях публічний (/auth у PUBLIC_PATHS proxy), тож без чинної сесії сюди теж можна потрапити — тоді просто вхід.
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = request.nextUrl.searchParams.get("reason") === "deactivated" ? "?error=deactivated" : "";
  const response = NextResponse.redirect(url);
  // Сторінку виходу не кешуємо: інакше CDN міг би віддати її іншому відвідувачу разом із cookie.
  response.headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate, max-age=0");
  return response;
}
