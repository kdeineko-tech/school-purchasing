import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MyRequestsPage from "@/app/purchases/page";
import PurchasePage from "@/app/purchases/[id]/page";
import { canSeePurchase } from "@/lib/purchases/form";
import { getViewer } from "@/lib/org/viewer";
import { createClient } from "@/lib/supabase/server";
import { ADMIN, fakeDb, P1, P2, PRIMARY, viewer } from "./fake-db";

vi.mock("@/lib/org/viewer", () => ({ getViewer: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`);
  }),
}));

const PURCHASE_ID = "00000000-0000-4000-8000-0000000000c1";
const purchase = (status = "awaiting_approval") => ({
  id: PURCHASE_ID,
  author_id: P1,
  department_id: PRIMARY.id,
  purchase_type: "purchasing_department",
  status,
  created_at: "2026-10-25T15:00:00Z",
});
const line = { position: 1, name: "Paper A4", purpose: "Printing", quantity: 3, unit_price: 20 };

// Підставний Supabase для сторінки закупівлі: visible — що повертає RLS (null — чужа закупівля не видна).
function setPurchaseDb({ visible, approves = [] }: { visible: ReturnType<typeof purchase> | null; approves?: string[] }) {
  const ok = <T>(data: T) => Promise.resolve({ data, error: null });
  const client = {
    from: vi.fn((table: string) => {
      switch (table) {
        case "purchases":
          return { select: () => ({ eq: () => ({ maybeSingle: () => ok(visible) }) }) };
        case "purchase_lines":
          return { select: () => ({ eq: () => ({ order: () => ok(visible ? [line] : []) }) }) };
        case "department_members":
          return { select: () => ({ eq: () => ({ eq: () => ok(approves.map((d) => ({ department_id: d }))) }) }) };
        case "departments":
          return { select: () => ({ eq: () => ({ maybeSingle: () => ok({ name: PRIMARY.name }) }) }) };
        default:
          throw new Error(`unexpected table ${table}`);
      }
    }),
  };
  vi.mocked(createClient).mockResolvedValue(client as never);
}

const props = (id: string) => ({ params: Promise.resolve({ id }), searchParams: Promise.resolve({}) }) as never;

describe("сторінка закупівлі", () => {
  beforeEach(() => {
    vi.mocked(getViewer).mockResolvedValue(viewer(P1));
  });

  it("AC-FRM-08: працівник 2 (заявник відділу, не автор і не схвалювач) бачить «Not enough permissions», даних закупівлі немає", async () => {
    vi.mocked(getViewer).mockResolvedValue(viewer(P2));
    setPurchaseDb({ visible: null });

    const html = renderToStaticMarkup(await PurchasePage(props(PURCHASE_ID)));

    expect(html).toContain("Not enough permissions");
    expect(html).not.toContain("Paper A4");
    expect(html).not.toContain(PRIMARY.name);
  });

  it("AC-FRM-08: правило видимості — автор, схвалювач відділу, адміністратор; колега-заявник — ні", () => {
    const p = { authorId: P1, departmentId: PRIMARY.id };

    expect(canSeePurchase({ id: P2, role: "requester" }, p, [])).toBe(false);
    expect(canSeePurchase({ id: P1, role: "requester" }, p, [])).toBe(true);
    expect(canSeePurchase({ id: P2, role: "approver" }, p, [PRIMARY.id])).toBe(true);
    expect(canSeePurchase({ id: ADMIN, role: "admin" }, p, [])).toBe(true);
  });

  it("AC-LANG-06: на сторінці заявки статус підписано текстом «Awaiting approval»", async () => {
    setPurchaseDb({ visible: purchase() });

    const html = renderToStaticMarkup(await PurchasePage(props(PURCHASE_ID)));

    expect(html).toMatch(/data-testid="purchase-status">Awaiting approval</);
    expect(html).toContain("Paper A4");
    expect(html).toContain("20.00");
  });

  it("AC-LANG-06: статуси «Approved» і «Rejected» підписано текстом", async () => {
    for (const [status, label] of [
      ["approved", "Approved"],
      ["rejected", "Rejected"],
    ]) {
      setPurchaseDb({ visible: purchase(status) });
      const html = renderToStaticMarkup(await PurchasePage(props(PURCHASE_ID)));
      expect(html).toContain(`data-testid="purchase-status">${label}<`);
    }
  });

  it("AC-LANG-06: у «Мої заявки» статус підписано текстом", async () => {
    const db = fakeDb({ departments: [PRIMARY], purchases: [{ ...purchase(), author_id: P1 }] });
    vi.mocked(createClient).mockResolvedValue(db.client as never);

    const html = renderToStaticMarkup(
      await MyRequestsPage({ params: Promise.resolve({}), searchParams: Promise.resolve({}) } as never),
    );

    expect(html).toContain(`data-testid="purchase-status">Awaiting approval<`);
    expect(html).toContain(`href="/purchases/${PURCHASE_ID}"`);
  });

  it("схвалювач відділу бачить закупівлю свого відділу", async () => {
    vi.mocked(getViewer).mockResolvedValue(viewer(P2, "approver"));
    setPurchaseDb({ visible: purchase(), approves: [PRIMARY.id] });

    const html = renderToStaticMarkup(await PurchasePage(props(PURCHASE_ID)));

    expect(html).toContain("Paper A4");
  });

  it("некоректний ідентифікатор — відмова без запиту до бази", async () => {
    setPurchaseDb({ visible: purchase() });

    const html = renderToStaticMarkup(await PurchasePage(props("not-a-uuid")));

    expect(html).toContain("Not enough permissions");
    expect(createClient).not.toHaveBeenCalled();
  });

  it("гість — сторінка входу", async () => {
    vi.mocked(getViewer).mockResolvedValue(null);

    await expect(PurchasePage(props(PURCHASE_ID))).rejects.toThrow("REDIRECT /login");
  });
});
