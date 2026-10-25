import { beforeEach, describe, expect, it, vi } from "vitest";
import { addRequester as addRequesterAction, createDepartment } from "@/app/admin/actions";
import { isDuplicateName, validateNewDepartment } from "@/lib/org/departments";
import { addRequester, requesterDepartments } from "@/lib/org/membership";
import { MESSAGES } from "@/lib/org/messages";
import { getViewer } from "@/lib/org/viewer";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/org/viewer", () => ({ getViewer: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
// redirect() у Next.js кидає виняток і зупиняє дію — імітуємо так само.
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`);
  }),
}));

const admin = { id: "a1", email: "admin@example.test", fullName: null, role: "admin", isActive: true } as const;

function fakeDepartmentsDb(existingNames: string[]) {
  const insert = vi.fn().mockResolvedValue({ error: null });
  const select = vi.fn().mockResolvedValue({ data: existingNames.map((name) => ({ name })), error: null });
  const client = { from: vi.fn(() => ({ select, insert })) };
  vi.mocked(createClient).mockResolvedValue(client as never);
  return { insert };
}

function form(fields: Record<string, string>) {
  const data = new FormData();
  Object.entries(fields).forEach(([k, v]) => data.set(k, v));
  return data;
}

describe("відділи", () => {
  beforeEach(() => {
    vi.mocked(getViewer).mockResolvedValue(admin);
  });

  it("AC-ORG-34: відділ «початкова школа» не створено, бо вже є «Початкова школа», — повідомлення «Відділ з такою назвою вже є»", () => {
    expect(isDuplicateName("початкова школа", ["Початкова школа"])).toBe(true);
    expect(validateNewDepartment("початкова школа", ["Початкова школа"])).toEqual({
      ok: false,
      error: "A department with this name already exists",
    });
    expect(MESSAGES.departmentExists).toBe("A department with this name already exists");
  });

  it("AC-ORG-34: дія createDepartment не записує дубль і повертає адміністратора з повідомленням", async () => {
    const { insert } = fakeDepartmentsDb(["Початкова школа"]);

    await expect(createDepartment(form({ name: "початкова школа" }))).rejects.toThrow(
      `REDIRECT /admin/departments?error=${encodeURIComponent("A department with this name already exists")}`,
    );
    expect(insert).not.toHaveBeenCalled();
  });

  it("новий відділ із унікальною назвою створено", async () => {
    const { insert } = fakeDepartmentsDb(["Початкова школа"]);

    await expect(createDepartment(form({ name: " Офіс " }))).rejects.toThrow("REDIRECT /admin/departments");
    expect(insert).toHaveBeenCalledWith({ name: "Офіс" });
  });

  it("порожню назву відділу відхилено", () => {
    expect(validateNewDepartment("   ", []).ok).toBe(false);
  });
});

describe("заявники відділу", () => {
  const departments = [
    { id: "d1", name: "Початкова школа" },
    { id: "d2", name: "Офіс" },
  ];

  it("AC-ORG-01: працівника без відділів додано до «Початкова школа» як заявника — у профілі серед відділів, де він подає заявки, лише «Початкова школа»", () => {
    expect(requesterDepartments([], departments, "u1")).toEqual([]);

    const memberships = addRequester([], "u1", "d1");

    expect(requesterDepartments(memberships, departments, "u1").map((d) => d.name)).toEqual(["Початкова школа"]);
  });

  const P1 = "00000000-0000-4000-8000-000000000001";
  const D1 = "00000000-0000-4000-8000-0000000000d1";

  function fakeMembersDb() {
    const insert = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(createClient).mockResolvedValue({ from: vi.fn(() => ({ insert })) } as never);
    return { insert };
  }

  it("AC-ORG-01: дія addRequester адміністратора записує працівника заявником відділу", async () => {
    vi.mocked(getViewer).mockResolvedValue(admin);
    const { insert } = fakeMembersDb();

    await expect(addRequesterAction(form({ profileId: P1, departmentId: D1 }))).rejects.toThrow(
      `REDIRECT /admin/staff/${P1}`,
    );
    expect(insert).toHaveBeenCalledWith({ profile_id: P1, department_id: D1 });
  });

  it("не-адміністратор не додає заявника", async () => {
    vi.mocked(getViewer).mockResolvedValue({ ...admin, role: "requester" });
    const { insert } = fakeMembersDb();

    await expect(addRequesterAction(form({ profileId: P1, departmentId: D1 }))).rejects.toThrow("REDIRECT /admin");
    expect(insert).not.toHaveBeenCalled();
  });

  it("некоректний ідентифікатор не доходить до бази", async () => {
    vi.mocked(getViewer).mockResolvedValue(admin);
    const { insert } = fakeMembersDb();

    await expect(addRequesterAction(form({ profileId: "abc", departmentId: D1 }))).rejects.toThrow(
      "REDIRECT /admin/staff",
    );
    expect(insert).not.toHaveBeenCalled();
  });

  it("повторне додавання до того самого відділу не дублює заявника", () => {
    const once = addRequester([], "u1", "d1");
    expect(addRequester(once, "u1", "d1")).toHaveLength(1);
  });
});
