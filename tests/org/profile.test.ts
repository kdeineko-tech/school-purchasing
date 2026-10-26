import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProfilePage from "@/app/profile/page";
import { getViewer } from "@/lib/org/viewer";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/org/viewer", () => ({ getViewer: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`);
  }),
}));

const ME = "00000000-0000-4000-8000-000000000001";
const PRIMARY = { id: "00000000-0000-4000-8000-0000000000d1", name: "Primary School" };
const OFFICE = { id: "00000000-0000-4000-8000-0000000000d2", name: "Office" };
const HIGH = { id: "00000000-0000-4000-8000-0000000000d3", name: "High School" };

// Підставний Supabase для профілю: RLS повертає лише власні рядки department_members.
function setDb(members: { department_id: string; approves: boolean; auto_approve: boolean }[]) {
  const ok = <T>(data: T) => Promise.resolve({ data, error: null });
  const client = {
    from: vi.fn((table: string) => {
      switch (table) {
        case "departments":
          return { select: () => ok([PRIMARY, OFFICE, HIGH]) };
        case "department_members":
          return { select: () => ({ eq: () => ok(members.map((m) => ({ profile_id: ME, ...m }))) }) };
        case "profiles":
          return {
            select: () => ({
              eq: () => ({
                single: () =>
                  ok({ can_card_expense: false, can_check_request: false, can_vendor_invoice: false, can_self_purchase: false }),
              }),
            }),
          };
        default:
          throw new Error(`unexpected table ${table}`);
      }
    }),
  };
  vi.mocked(createClient).mockResolvedValue(client as never);
}

const viewer = (role: "requester" | "approver" | "admin") => ({
  id: ME,
  email: "member1@example.test",
  fullName: null,
  role,
  isActive: true,
});

// Рядок відділу в картці «My departments»: назва й позначки.
const departmentRow = (html: string, name: string) =>
  html.split('data-testid="my-department"').find((chunk) => chunk.includes(`>${name}<`)) ?? "";

describe("профіль працівника", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("AC-ORG-01: у профілі — відділи, де працівник подає заявки, а відділу, де він не заявник, немає", async () => {
    vi.mocked(getViewer).mockResolvedValue(viewer("approver"));
    setDb([
      { department_id: PRIMARY.id, approves: true, auto_approve: true },
      { department_id: OFFICE.id, approves: false, auto_approve: false },
    ]);

    const html = renderToStaticMarkup(await ProfilePage());

    expect(html).toContain("Primary School");
    expect(html).toContain("Office");
    expect(html).not.toContain("High School");
  });

  it("біля відділу видно, де працівник схвалює і де ввімкнено автосхвалення", async () => {
    vi.mocked(getViewer).mockResolvedValue(viewer("approver"));
    setDb([
      { department_id: PRIMARY.id, approves: true, auto_approve: true },
      { department_id: OFFICE.id, approves: false, auto_approve: false },
    ]);

    const html = renderToStaticMarkup(await ProfilePage());

    expect(departmentRow(html, "Primary School")).toContain("Approver");
    expect(departmentRow(html, "Primary School")).toContain("Auto-approval");
    expect(departmentRow(html, "Office")).toContain("Requester");
    expect(departmentRow(html, "Office")).not.toContain("Approver");
    expect(departmentRow(html, "Office")).not.toContain("Auto-approval");
  });

  it("посилання на заявки: заявник бачить «New purchase» і «My requests», без «Approvals»", async () => {
    vi.mocked(getViewer).mockResolvedValue(viewer("requester"));
    setDb([{ department_id: PRIMARY.id, approves: false, auto_approve: false }]);

    const links = renderToStaticMarkup(await ProfilePage()).split('data-testid="profile-links"')[1] ?? "";

    expect(links).toContain('href="/purchases/new"');
    expect(links).toContain('href="/purchases"');
    expect(links).not.toContain('href="/approvals"');
  });

  it("посилання на заявки: схвалювач бачить і «Approvals»", async () => {
    vi.mocked(getViewer).mockResolvedValue(viewer("approver"));
    setDb([{ department_id: PRIMARY.id, approves: true, auto_approve: false }]);

    const links = renderToStaticMarkup(await ProfilePage()).split('data-testid="profile-links"')[1] ?? "";

    expect(links).toContain('href="/approvals"');
  });

  it("працівник без відділів бачить «None.»", async () => {
    vi.mocked(getViewer).mockResolvedValue(viewer("requester"));
    setDb([]);

    const html = renderToStaticMarkup(await ProfilePage());

    expect(html).toContain("None.");
  });

  it("гість — сторінка входу", async () => {
    vi.mocked(getViewer).mockResolvedValue(null);

    await expect(ProfilePage()).rejects.toThrow("REDIRECT /login");
  });
});
