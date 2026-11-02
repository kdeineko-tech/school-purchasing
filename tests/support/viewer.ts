import { vi } from "vitest";
import { VIEWER_PROFILE_COLUMNS, type ViewerProfile } from "@/lib/org/viewer";
import { createClient } from "@/lib/supabase/server";

// Хто «увійшов» у тестах сторінок і server actions. Власний getViewer не мокаємо (правило ESLint WS8): справжній
// getViewer читає сесію й профіль через мок клієнта Supabase, а цей помічник підставляє в мок відповіді —
// getClaims() з sub і рядок profiles за колонками VIEWER_PROFILE_COLUMNS. Решту запитів обробляє мок тесту.
// Файл тесту має мокати "@/lib/supabase/server" і "next/navigation" (redirect для деактивованого).

type TestViewer = Pick<ViewerProfile, "id" | "role" | "isActive"> &
  Partial<Pick<ViewerProfile, "email" | "fullName">>;

let current: TestViewer | null = null;

/** Увійти в тесті як `viewer` (null — гість). Клієнт, який тест ще не підставив, — порожній. */
export function signIn(viewer: TestViewer | null) {
  current = viewer;
  if (!vi.mocked(createClient).getMockImplementation()) {
    vi.mocked(createClient).mockResolvedValue(withViewer({}) as never);
  }
}

/** Мок клієнта Supabase з тесту + сесія й профіль того, хто зараз увійшов (signIn). */
export function withViewer<T extends object>(client: T): T {
  const inner = client as Record<string, unknown> & {
    auth?: Record<string, unknown>;
    from?: (table: string) => { select: (columns: string) => unknown };
  };
  const auth = {
    ...inner.auth,
    getClaims: async () => ({
      data: current ? { claims: { sub: current.id } } : null,
      error: null,
    }),
  };
  const from = (table: string) => {
    if (table !== "profiles") return inner.from!(table);
    const viewerQuery = {
      eq: (_column: string, id: string) => ({
        maybeSingle: async () => ({
          data: current?.id === id ? profileRow(current) : null,
          error: null,
        }),
      }),
    };
    // Запит getViewer — з колонок VIEWER_PROFILE_COLUMNS; решта (інші колонки, update тощо) — до моку тесту, лише коли їх
    // справді викликали: інакше перевірки «from не викликано» в тестах рахували б і запит сесії.
    return new Proxy({} as Record<string, (...args: unknown[]) => unknown>, {
      get: (_target, key) =>
        key === "select"
          ? (columns: string) =>
              columns === VIEWER_PROFILE_COLUMNS
                ? viewerQuery
                : inner.from!(table).select(columns)
          : (...args: unknown[]) =>
              (
                inner.from!(table) as Record<
                  string,
                  (...a: unknown[]) => unknown
                >
              )[key as string](...args),
    });
  };
  return new Proxy(inner, {
    get: (target, key) =>
      key === "auth" ? auth : key === "from" ? from : Reflect.get(target, key),
  }) as T;
}

function profileRow(viewer: TestViewer) {
  return {
    id: viewer.id,
    email: viewer.email ?? null,
    full_name: viewer.fullName ?? null,
    role: viewer.role,
    is_active: viewer.isActive,
  };
}
