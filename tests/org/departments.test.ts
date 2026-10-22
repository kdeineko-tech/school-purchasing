import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDepartment } from "@/app/admin/actions";
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
      error: "Відділ з такою назвою вже є",
    });
    expect(MESSAGES.departmentExists).toBe("Відділ з такою назвою вже є");
  });

  it("AC-ORG-34: дія createDepartment не записує дубль і повертає адміністратора з повідомленням", async () => {
    const { insert } = fakeDepartmentsDb(["Початкова школа"]);

    await expect(createDepartment(form({ name: "початкова школа" }))).rejects.toThrow(
      `REDIRECT /admin/departments?error=${encodeURIComponent("Відділ з такою назвою вже є")}`,
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

  it("повторне додавання до того самого відділу не дублює заявника", () => {
    const once = addRequester([], "u1", "d1");
    expect(addRequester(once, "u1", "d1")).toHaveLength(1);
  });
});
