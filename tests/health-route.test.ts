// WS11: /api/health віддає appEnv і supabaseRef поруч із наявними полями D0 (ok, sha, env, db, reason) — без мережі.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        limit: () => ({ abortSignal: async () => ({ error: null, status: 200 }) }),
      }),
    }),
  }),
}));

const { GET } = await import("@/app/api/health/route");

describe("GET /api/health: середовище й база", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abcdefghijklmnopqrst.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "abc1234");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("на staging: appEnv із APP_ENV і ref бази; наявні поля не змінились", async () => {
    vi.stubEnv("APP_ENV", "staging");
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      sha: "abc1234",
      env: "preview",
      db: "ok",
      reason: "",
      appEnv: "staging",
      supabaseRef: "abcdefghijklmnopqrst",
    });
  });

  it("без APP_ENV (прод, PR-preview): appEnv = null, ref бази — є", async () => {
    vi.stubEnv("APP_ENV", "");
    const body = await (await GET()).json();
    expect(body.appEnv).toBeNull();
    expect(body.supabaseRef).toBe("abcdefghijklmnopqrst");
  });
});
