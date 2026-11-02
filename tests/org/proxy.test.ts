import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { updateSession } from "@/lib/supabase/proxy";

// Підставний клієнт @supabase/ssr для proxy: є сесія чи ні. Профіль proxy не читає — це робить getViewer на
// сторінці (tests/org/signed-out.test.ts), тож from() тут має лишитися невикликаним.
const state = { claims: true as boolean, from: vi.fn() };

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getClaims: async () => ({ data: state.claims ? { claims: { sub: "u1" } } : null, error: null }),
    },
    from: (...args: unknown[]) => {
      state.from(...args);
      throw new Error("proxy must not read the database");
    },
  }),
}));

describe("proxy: перевірка сесії", () => {
  it("працівник із сесією проходить далі; профіль із бази proxy не читає", async () => {
    state.claims = true;
    state.from.mockClear();

    const response = await updateSession(new NextRequest("http://localhost:3000/admin/staff"));

    expect(response.headers.get("location")).toBeNull();
    expect(state.from).not.toHaveBeenCalled();
  });

  it("відповідь має заголовок Server-Timing з тривалістю перевірки сесії", async () => {
    state.claims = true;

    const response = await updateSession(new NextRequest("http://localhost:3000/approvals"));

    expect(response.headers.get("server-timing")).toMatch(/^proxy;desc="session check";dur=\d+$/);
  });

  it("без сесії на закриту сторінку — перенаправлення на вхід", async () => {
    state.claims = false;

    const response = await updateSession(new NextRequest("http://localhost:3000/approvals"));

    expect(response.headers.get("location")).toBe("http://localhost:3000/login");
  });

  it("без сесії сторінка входу й /auth/signed-out відкриваються", async () => {
    state.claims = false;

    for (const path of ["/login", "/auth/signed-out?reason=deactivated"]) {
      const response = await updateSession(new NextRequest(`http://localhost:3000${path}`));
      expect(response.headers.get("location")).toBeNull();
    }
  });
});
