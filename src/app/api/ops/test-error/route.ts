// WS11 (трек B): навмисна помилка сервера, щоб перевірити трекер (src/instrumentation.ts → Telegram) на staging.
// Лише для активного адміністратора (роль з profiles через getViewer, AC-ORG-09) і лише поза Production Vercel:
// на проді маршрут відповідає 404 навіть адміністратору. Не в PUBLIC_PATHS — без сесії proxy перенаправляє на /login.
// Після перевірки на staging маршрут лишається закритим так само (рішення — docs/runbook.md, трек C).
import { NextResponse } from "next/server";
import { canOpenAdminPages } from "@/lib/org/access";
import { getViewer } from "@/lib/org/viewer";

export const dynamic = "force-dynamic";

class TrackerTestError extends Error {
  override name = "TrackerTestError";
}

export async function GET() {
  if (process.env.VERCEL_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (!canOpenAdminPages(viewer)) return NextResponse.json({ error: "Not enough permissions" }, { status: 403 });

  throw new TrackerTestError("Intentional error to test the error tracker");
}
