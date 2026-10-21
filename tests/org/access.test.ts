import { describe, expect, it } from "vitest";
import { canOpenAdminPages } from "@/lib/org/access";
import { MESSAGES } from "@/lib/org/messages";

describe("доступ до сторінок адміністратора", () => {
  it("AC-ORG-09: користувач без ролі admin не відкриває список працівників і налаштування відділів, бачить «Недостатньо прав»", () => {
    expect(canOpenAdminPages({ role: "requester", isActive: true })).toBe(false);
    expect(canOpenAdminPages({ role: "approver", isActive: true })).toBe(false);
    expect(MESSAGES.forbidden).toBe("Недостатньо прав");
  });

  it("активний адміністратор відкриває сторінки адміністратора", () => {
    expect(canOpenAdminPages({ role: "admin", isActive: true })).toBe(true);
  });

  it("деактивований адміністратор і гість не відкривають сторінки адміністратора", () => {
    expect(canOpenAdminPages({ role: "admin", isActive: false })).toBe(false);
    expect(canOpenAdminPages(null)).toBe(false);
  });
});
