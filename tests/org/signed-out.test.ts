import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/auth/signed-out/route";
import { getViewer } from "@/lib/org/viewer";
import { createClient } from "@/lib/supabase/server";

// AC-ORG-12 під час сесії: getViewer читає профіль один раз і перенаправляє деактивованого працівника на
// /auth/signed-out, а той виходить із сесії й показує повідомлення PM на сторінці входу.
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`);
  }),
}));

const signOut = vi.fn(async () => ({ error: null }));

function setProfile(profile: { is_active: boolean } | null) {
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getClaims: async () => ({ data: { claims: { sub: "u1" } }, error: null }),
      signOut,
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: profile && { id: "u1", email: "u1@example.test", full_name: null, role: "requester", ...profile },
            error: null,
          }),
        }),
      }),
    }),
  } as never);
}

describe("вихід деактивованого працівника під час сесії", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("AC-ORG-12: працівника деактивували під час сесії — getViewer перенаправляє на вихід із повідомленням", async () => {
    setProfile({ is_active: false });

    await expect(getViewer()).rejects.toThrow("REDIRECT /auth/signed-out?reason=deactivated");
  });

  it("AC-ORG-12: вихід із сесії й повідомлення «Account deactivated» на сторінці входу", async () => {
    setProfile(null);

    const response = await GET(new NextRequest("http://localhost:3000/auth/signed-out?reason=deactivated"));

    expect(signOut).toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("http://localhost:3000/login?error=deactivated");
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("AC-ORG-12: активний працівник проходить далі без виходу з сесії", async () => {
    setProfile({ is_active: true });

    await expect(getViewer()).resolves.toMatchObject({ id: "u1", isActive: true });
    expect(signOut).not.toHaveBeenCalled();
  });

  it("сесія без профілю — вихід і сторінка входу без повідомлення про деактивацію", async () => {
    setProfile(null);

    await expect(getViewer()).rejects.toThrow("REDIRECT /auth/signed-out");
    const response = await GET(new NextRequest("http://localhost:3000/auth/signed-out"));
    expect(signOut).toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("http://localhost:3000/login");
  });
});
