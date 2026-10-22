import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { updateSession } from "@/lib/supabase/proxy";

// Підставний клієнт @supabase/ssr: сесія є, профіль з потрібною активністю; signOut, як справжній,
// очищує cookie сесії через setAll і передає заголовки кешування.
const state = { isActive: true, signOut: vi.fn() };

vi.mock("@supabase/ssr", () => ({
  createServerClient: (
    _url: string,
    _key: string,
    options: { cookies: { setAll: (c: unknown[], h: Record<string, string>) => void } },
  ) => ({
    auth: {
      getClaims: async () => ({ data: { claims: { sub: "u1" } }, error: null }),
      signOut: async () => {
        state.signOut();
        options.cookies.setAll([{ name: "sb-auth", value: "", options: { maxAge: 0 } }], {
          "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
        });
        return { error: null };
      },
    },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: { is_active: state.isActive }, error: null }) }),
      }),
    }),
  }),
}));

describe("сесія деактивованого працівника", () => {
  it("AC-ORG-12: працівника деактивували під час сесії — вихід і повідомлення на сторінці входу", async () => {
    state.isActive = false;
    state.signOut.mockClear();

    const response = await updateSession(new NextRequest("http://localhost:3000/admin/staff"));

    expect(state.signOut).toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("http://localhost:3000/login?error=deactivated");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.cookies.get("sb-auth")?.value).toBe("");
  });

  it("активний працівник проходить далі без виходу з сесії", async () => {
    state.isActive = true;
    state.signOut.mockClear();

    const response = await updateSession(new NextRequest("http://localhost:3000/admin/staff"));

    expect(state.signOut).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBeNull();
  });
});
