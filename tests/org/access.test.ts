import { beforeEach, describe, expect, it, vi } from "vitest";
import DepartmentsPage from "@/app/admin/departments/page";
import { NoAccess } from "@/app/admin/no-access";
import AdminHome from "@/app/admin/page";
import StaffPage from "@/app/admin/staff/page";
import { canOpenAdminPages, type AppRole } from "@/lib/org/access";
import { MESSAGES } from "@/lib/org/messages";
import { getViewer } from "@/lib/org/viewer";

// Сторінки адміністратора рендеримо без бази: переглядача підставляємо, Supabase не викликається,
// бо не-адміністратор отримує відмову ще до запиту.
vi.mock("@/lib/org/viewer", () => ({ getViewer: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

function viewer(role: AppRole, isActive = true) {
  return { id: "u1", email: "member1@example.test", fullName: null, role, isActive };
}

const adminPages = [
  ["/admin", AdminHome],
  ["/admin/staff", StaffPage],
  ["/admin/departments", DepartmentsPage],
] as const;

describe("доступ до сторінок адміністратора", () => {
  beforeEach(() => {
    vi.mocked(getViewer).mockReset();
  });

  it("AC-ORG-09: користувач без ролі admin не відкриває список працівників і налаштування відділів, бачить «Недостатньо прав»", () => {
    expect(canOpenAdminPages({ role: "requester", isActive: true })).toBe(false);
    expect(canOpenAdminPages({ role: "approver", isActive: true })).toBe(false);
    expect(MESSAGES.forbidden).toBe("Недостатньо прав");
  });

  it.each(adminPages)("AC-ORG-09: заявник на %s бачить відмову «Недостатньо прав»", async (_path, Page) => {
    vi.mocked(getViewer).mockResolvedValue(viewer("requester"));
    const element = await Page();
    expect(element.type).toBe(NoAccess);
  });

  it.each(adminPages)("AC-ORG-09: схвалювач на %s бачить відмову «Недостатньо прав»", async (_path, Page) => {
    vi.mocked(getViewer).mockResolvedValue(viewer("approver"));
    const element = await Page();
    expect(element.type).toBe(NoAccess);
  });

  it("активний адміністратор відкриває сторінки адміністратора", () => {
    expect(canOpenAdminPages({ role: "admin", isActive: true })).toBe(true);
  });

  it("деактивований адміністратор і гість не відкривають сторінки адміністратора", () => {
    expect(canOpenAdminPages({ role: "admin", isActive: false })).toBe(false);
    expect(canOpenAdminPages(null)).toBe(false);
  });
});
