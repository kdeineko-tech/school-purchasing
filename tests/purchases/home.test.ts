import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Home from "@/app/page";
import { initials } from "@/components/user-menu";
import { getViewer } from "@/lib/org/viewer";
import { createClient } from "@/lib/supabase/server";
import { OFFICE, P1, P2, PRIMARY, viewer } from "./fake-db";

vi.mock("@/lib/org/viewer", () => ({ getViewer: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`);
  }),
}));

type Row = { id: string; author_id: string; department_id: string; purchase_type: string; status: string; created_at: string };

const row = (n: number, over: Partial<Row> = {}): Row => ({
  id: `00000000-0000-4000-8000-0000000001${String(n).padStart(2, "0")}`,
  author_id: P1,
  department_id: PRIMARY.id,
  purchase_type: "purchasing_department",
  status: "awaiting_approval",
  created_at: `2026-10-${String(10 + n).padStart(2, "0")}T15:00:00Z`,
  ...over,
});

// Підставний Supabase для головної: «мої» — purchases.eq(author_id).order(), «для рішення» —
// department_members.eq().eq() і purchases.in().eq().neq().order() (src/lib/purchases/lists.ts).
function setDb({ mine = [], forDecision = [], approves = [] }: { mine?: Row[]; forDecision?: Row[]; approves?: string[] }) {
  const ok = <T>(data: T) => Promise.resolve({ data, error: null });
  const listQuery = { in: () => listQuery, eq: () => listQuery, neq: () => listQuery, order: () => ok(forDecision) };
  const client = {
    from: vi.fn((table: string) => {
      switch (table) {
        case "purchases":
          return { select: () => ({ eq: () => ({ order: () => ok(mine) }), in: () => listQuery }) };
        case "department_members":
          return { select: () => ({ eq: () => ({ eq: () => ok(approves.map((d) => ({ department_id: d }))) }) }) };
        case "departments":
          return { select: () => ok([PRIMARY, OFFICE]) };
        default:
          throw new Error(`unexpected table ${table}`);
      }
    }),
  };
  vi.mocked(createClient).mockResolvedValue(client as never);
  return client;
}

const links = (html: string, testId: string) => {
  const start = html.indexOf(`data-testid="${testId}"`);
  if (start < 0) return 0;
  const end = html.indexOf("</ul>", start);
  return (html.slice(start, end).match(/href="\/purchases\/[0-9a-f-]+"/g) ?? []).length;
};

describe("головна — робоча панель", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("гість на головній бачить сторінку входу", async () => {
    vi.mocked(getViewer).mockResolvedValue(null);

    await expect(Home()).rejects.toThrow("REDIRECT /login");
  });

  it("AC-APR-04: заявник на головній не бачить заявок для рішення — лише власні", async () => {
    vi.mocked(getViewer).mockResolvedValue(viewer(P1, "requester"));
    const client = setDb({ mine: [row(1)], forDecision: [row(2, { author_id: P2 })], approves: [PRIMARY.id] });

    const html = renderToStaticMarkup(await Home());

    expect(html).not.toContain("Awaiting your decision");
    expect(html).not.toContain("dashboard-decisions");
    expect(links(html, "my-requests")).toBe(1);
    expect(client.from).not.toHaveBeenCalledWith("department_members");
  });

  it("AC-APR-01: схвалювач бачить на головній заявки свого відділу для рішення, не більше п'яти, і їх кількість", async () => {
    vi.mocked(getViewer).mockResolvedValue(viewer(P2, "approver"));
    setDb({ forDecision: [1, 2, 3, 4, 5, 6, 7].map((n) => row(n)), approves: [PRIMARY.id] });

    const html = renderToStaticMarkup(await Home());

    expect(html).toContain("Awaiting your decision");
    expect(links(html, "decision-list")).toBe(5);
    expect(html).toMatch(/data-slot="badge"[^>]*>7</);
    expect(html).toContain('href="/approvals"');
  });

  it("AC-APR-01: власна заявка схвалювача не потрапляє в картку для рішення", async () => {
    vi.mocked(getViewer).mockResolvedValue(viewer(P2, "approver"));
    setDb({ forDecision: [row(1, { author_id: P2 }), row(2)], approves: [PRIMARY.id] });

    const html = renderToStaticMarkup(await Home());

    expect(links(html, "decision-list")).toBe(1);
  });

  it("AC-FRM-10: на головній — не більше п'яти власних заявок, новіші першими, і посилання на всі", async () => {
    vi.mocked(getViewer).mockResolvedValue(viewer(P1, "requester"));
    setDb({ mine: [7, 6, 5, 4, 3, 2, 1].map((n) => row(n)) });

    const html = renderToStaticMarkup(await Home());

    expect(links(html, "my-requests")).toBe(5);
    expect(html.indexOf(row(7).id)).toBeLessThan(html.indexOf(row(6).id));
    expect(html).not.toContain(row(2).id);
    expect(html).toContain('href="/purchases"');
  });

  it("AC-FRM-14: без власних заявок — «You have not submitted any requests yet»; без заявок для рішення — «No requests awaiting your decision»", async () => {
    vi.mocked(getViewer).mockResolvedValue(viewer(P2, "approver"));
    setDb({ approves: [PRIMARY.id] });

    const html = renderToStaticMarkup(await Home());

    expect(html).toContain("You have not submitted any requests yet");
    expect(html).toContain("No requests awaiting your decision");
  });

  it("під привітанням — роль і email одним рядком; окремої картки Email / Role немає", async () => {
    vi.mocked(getViewer).mockResolvedValue({ ...viewer(P1, "admin"), fullName: "Olena Demo-Admin" });
    setDb({});

    const html = renderToStaticMarkup(await Home());

    expect(html).toContain("Welcome, Olena Demo-Admin");
    expect(html).toContain("Administrator · 01@example.test");
    expect(html).not.toContain("user-email");
    expect(html).not.toContain("user-role");
  });
});

describe("шапка", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("AC-ORG-09: заявник не бачить у шапці «Approvals» і «Settings»; «My profile» — у меню під аватаром", async () => {
    vi.mocked(getViewer).mockResolvedValue(viewer(P1, "requester"));
    setDb({});

    const html = renderToStaticMarkup(await Home());
    const nav = html.slice(html.indexOf('aria-label="Main"'), html.indexOf("</nav>"));

    expect(nav).toContain("My requests");
    expect(nav).not.toContain("Approvals");
    expect(nav).not.toContain("Settings");
    expect(nav).not.toContain("My profile");
    expect(html).toContain('aria-label="Account menu: 01@example.test"');
  });

  it("AC-ORG-09: адміністратор бачить у шапці «Approvals» і «Settings»", async () => {
    vi.mocked(getViewer).mockResolvedValue(viewer(P1, "admin"));
    setDb({});

    const html = renderToStaticMarkup(await Home());
    const nav = html.slice(html.indexOf('aria-label="Main"'), html.indexOf("</nav>"));

    expect(nav).toContain('href="/approvals"');
    expect(nav).toContain('href="/admin"');
  });

  it("ініціали в аватарі — з перших двох слів імені, без імені — з email", () => {
    expect(initials("Olena Demo-Admin", "admin@example.test")).toBe("OD");
    expect(initials("PM Requester", null)).toBe("PR");
    expect(initials(null, "member1@example.test")).toBe("M");
    expect(initials("  ", null)).toBe("?");
  });
});
