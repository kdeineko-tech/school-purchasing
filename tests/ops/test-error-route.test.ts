// WS11 (трек B): тестовий маршрут трекера — помилка лише для активного адміністратора і лише поза Production.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signIn } from "../support/viewer";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

const { GET } = await import("@/app/api/ops/test-error/route");

describe("GET /api/ops/test-error", () => {
  beforeEach(() => vi.stubEnv("VERCEL_ENV", "preview"));
  afterEach(() => vi.unstubAllEnvs());

  it("гість — 401, без помилки", async () => {
    signIn(null);
    expect((await GET()).status).toBe(401);
  });

  it("не адміністратор — 403, без помилки", async () => {
    signIn({ id: "u-1", role: "approver", isActive: true });
    expect((await GET()).status).toBe(403);
  });

  it("адміністратор поза Production — навмисна помилка", async () => {
    signIn({ id: "u-2", role: "admin", isActive: true });
    await expect(GET()).rejects.toMatchObject({ name: "TrackerTestError" });
  });

  it("на Production — 404 навіть адміністратору", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    signIn({ id: "u-2", role: "admin", isActive: true });
    expect((await GET()).status).toBe(404);
  });
});
