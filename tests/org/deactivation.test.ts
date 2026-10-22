import { beforeEach, describe, expect, it, vi } from "vitest";
import { setActive } from "@/app/admin/actions";
import { login } from "@/app/login/actions";
import { leavesNoActiveAdmin } from "@/lib/org/admins";
import { MESSAGES } from "@/lib/org/messages";
import { getViewer } from "@/lib/org/viewer";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/org/viewer", () => ({ getViewer: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`);
  }),
}));

const ADMIN = "00000000-0000-4000-8000-0000000000a1";
const P1 = "00000000-0000-4000-8000-000000000001";

function form(fields: Record<string, string>) {
  const data = new FormData();
  Object.entries(fields).forEach(([k, v]) => data.set(k, v));
  return data;
}

// Підставний Supabase для входу: пароль правильний, профіль з потрібною активністю.
function fakeLoginDb(isActive: boolean | null) {
  const signOut = vi.fn().mockResolvedValue({ error: null });
  const client = {
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({ data: { user: { id: P1 } }, error: null }),
      signOut,
    },
    from: vi.fn(() => ({
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: isActive === null ? null : { is_active: isActive }, error: null }) }) }),
    })),
  };
  vi.mocked(createClient).mockResolvedValue(client as never);
  return { signOut };
}

describe("деактивація працівника", () => {
  it("AC-ORG-12: деактивований працівник не може увійти в систему й бачить «Обліковий запис деактивовано. Зверніться до адміністратора»", async () => {
    const { signOut } = fakeLoginDb(false);

    await expect(login(form({ email: "member1@example.test", password: "x" }))).rejects.toThrow(
      "REDIRECT /login?error=deactivated",
    );
    expect(signOut).toHaveBeenCalled();
    expect(MESSAGES.deactivated).toBe("Обліковий запис деактивовано. Зверніться до адміністратора");
  });

  it("AC-ORG-12: активний працівник входить у систему", async () => {
    const { signOut } = fakeLoginDb(true);

    await expect(login(form({ email: "member1@example.test", password: "x" }))).rejects.toThrow("REDIRECT /");
    expect(signOut).not.toHaveBeenCalled();
  });

  it("якщо профіль не вдалося перевірити, вхід не відбувається — нейтральна відмова", async () => {
    const { signOut } = fakeLoginDb(null);

    await expect(login(form({ email: "member1@example.test", password: "x" }))).rejects.toThrow(
      "REDIRECT /login?error=invalid",
    );
    expect(signOut).toHaveBeenCalled();
  });

  it("AC-ORG-12: дія setActive адміністратора деактивує працівника", async () => {
    vi.mocked(getViewer).mockResolvedValue({ id: ADMIN, email: "admin@example.test", fullName: null, role: "admin", isActive: true });
    const update = vi.fn(() => ({ eq: () => Promise.resolve({ error: null }) }));
    const staff = [
      { id: ADMIN, role: "admin", is_active: true },
      { id: P1, role: "requester", is_active: true },
    ];
    vi.mocked(createClient).mockResolvedValue({
      from: vi.fn(() => ({ select: () => Promise.resolve({ data: staff, error: null }), update })),
    } as never);

    await expect(setActive(form({ profileId: P1, active: "false" }))).rejects.toThrow(`REDIRECT /admin/staff/${P1}`);
    expect(update).toHaveBeenCalledWith({ is_active: false });
  });
});

describe("останній активний адміністратор", () => {
  beforeEach(() => {
    vi.mocked(getViewer).mockResolvedValue({ id: ADMIN, email: "admin@example.test", fullName: null, role: "admin", isActive: true });
  });

  it("AC-ORG-18: єдиний активний адміністратор не деактивує себе — «Має лишитись хоча б один активний адміністратор»", async () => {
    const staff = [
      { id: ADMIN, role: "admin" as const, isActive: true },
      { id: P1, role: "requester" as const, isActive: true },
    ];
    expect(leavesNoActiveAdmin(staff, ADMIN, false)).toBe(true);

    const update = vi.fn();
    vi.mocked(createClient).mockResolvedValue({
      from: vi.fn(() => ({
        select: () =>
          Promise.resolve({
            data: staff.map((p) => ({ id: p.id, role: p.role, is_active: p.isActive })),
            error: null,
          }),
        update,
      })),
    } as never);

    await expect(setActive(form({ profileId: ADMIN, active: "false" }))).rejects.toThrow(
      `REDIRECT /admin/staff/${ADMIN}?error=${encodeURIComponent("Має лишитись хоча б один активний адміністратор")}`,
    );
    expect(update).not.toHaveBeenCalled();
  });

  it("AC-ORG-18: відмова бази LAST_ADMIN (зміна між перевіркою й записом) дає те саме повідомлення", async () => {
    const staff = [
      { id: ADMIN, role: "admin", is_active: true },
      { id: P1, role: "admin", is_active: true },
    ];
    const update = vi.fn(() => ({ eq: () => Promise.resolve({ error: { message: "LAST_ADMIN" } }) }));
    vi.mocked(createClient).mockResolvedValue({
      from: vi.fn(() => ({ select: () => Promise.resolve({ data: staff, error: null }), update })),
    } as never);

    await expect(setActive(form({ profileId: P1, active: "false" }))).rejects.toThrow(
      `REDIRECT /admin/staff/${P1}?error=${encodeURIComponent(MESSAGES.lastAdmin)}`,
    );
    expect(update).toHaveBeenCalled();
  });

  it("AC-ORG-18: за наявності другого активного адміністратора деактивація дозволена", () => {
    const staff = [
      { id: ADMIN, role: "admin" as const, isActive: true },
      { id: P1, role: "admin" as const, isActive: true },
    ];
    expect(leavesNoActiveAdmin(staff, ADMIN, false)).toBe(false);
  });
});
