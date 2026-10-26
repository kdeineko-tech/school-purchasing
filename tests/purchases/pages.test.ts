import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NewPurchasePage from "@/app/purchases/new/page";
import MyRequestsPage from "@/app/purchases/page";
import { getViewer } from "@/lib/org/viewer";
import { createClient } from "@/lib/supabase/server";
import { fakeDb, HIGH, OFFICE, P1, P2, PRIMARY, viewer } from "./fake-db";

vi.mock("@/lib/org/viewer", () => ({ getViewer: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`);
  }),
}));

function props(searchParams: Record<string, string> = {}) {
  return { params: Promise.resolve({}), searchParams: Promise.resolve(searchParams) } as never;
}

function useDb(state: Parameters<typeof fakeDb>[0]) {
  const db = fakeDb({ departments: [PRIMARY, OFFICE, HIGH], ...state });
  vi.mocked(createClient).mockResolvedValue(db.client as never);
  return db;
}

const purchaseOf = (author: string, status = "awaiting_approval") => ({
  id: `p-${author.slice(-2)}`,
  author_id: author,
  department_id: PRIMARY.id,
  purchase_type: "purchasing_department",
  status,
  created_at: "2026-10-25T15:00:00Z",
});

describe("форма закупівлі", () => {
  beforeEach(() => {
    vi.mocked(getViewer).mockResolvedValue(viewer(P1));
  });

  it("AC-FRM-09: гість, що відкриває форму закупівлі за посиланням, бачить сторінку входу", async () => {
    vi.mocked(getViewer).mockResolvedValue(null);

    await expect(NewPurchasePage()).rejects.toThrow("REDIRECT /login");
  });

  it("AC-FRM-01: у виборі відділу лише «Primary School» й «Office», «High School» немає", async () => {
    useDb({
      members: [
        { profile_id: P1, department_id: PRIMARY.id },
        { profile_id: P1, department_id: OFFICE.id },
      ],
    });

    const html = renderToStaticMarkup(await NewPurchasePage());

    expect(html).toContain("Primary School");
    expect(html).toContain("Office");
    expect(html).not.toContain("High School");
  });

  it("AC-FRM-03: без дозволу «Self-purchase» у виборі типу лише «Purchasing department»", async () => {
    useDb({ members: [{ profile_id: P1, department_id: PRIMARY.id }], selfPurchase: false });

    const html = renderToStaticMarkup(await NewPurchasePage());

    expect(html).toContain("Purchasing department");
    expect(html).not.toContain("Self-purchase");
  });

  it("AC-FRM-05: працівник без відділів бачить повідомлення, а полів форми немає", async () => {
    useDb({ members: [] });

    const html = renderToStaticMarkup(await NewPurchasePage());

    expect(html).toContain("You have not been added to any department. Contact your administrator.");
    expect(html).not.toContain("department-select");
    expect(html).not.toContain("purchase-type-select");
    expect(html).not.toContain("Add line");
  });
});

describe("«Мої заявки»", () => {
  beforeEach(() => {
    vi.mocked(getViewer).mockResolvedValue(viewer(P1));
  });

  it("AC-FRM-09: гість не бачить «Мої заявки» — сторінка входу", async () => {
    vi.mocked(getViewer).mockResolvedValue(null);

    await expect(MyRequestsPage(props())).rejects.toThrow("REDIRECT /login");
  });

  it("AC-FRM-10: у списку є закупівля працівника 1 зі статусом «Awaiting approval», заявок інших працівників немає", async () => {
    const db = useDb({ purchases: [purchaseOf(P1), purchaseOf(P2)] });

    const html = renderToStaticMarkup(await MyRequestsPage(props()));

    expect(db.purchasesQuery.author).toBe(P1);
    expect(html).toContain("Primary School");
    expect(html.match(/Awaiting approval/g)).toHaveLength(1);
  });

  it("AC-FRM-07: подана закупівля в списку має статус «Awaiting approval»", async () => {
    useDb({ purchases: [purchaseOf(P1)] });

    const html = renderToStaticMarkup(await MyRequestsPage(props()));

    expect(html).toContain("Awaiting approval");
  });

  it("AC-FRM-11: після подання на «Мої заявки» є повідомлення «Purchase submitted»", async () => {
    useDb({ purchases: [purchaseOf(P1)] });

    const html = renderToStaticMarkup(await MyRequestsPage(props({ submitted: "1" })));

    expect(html).toContain("Purchase submitted");
  });

  it("AC-FRM-14: працівник без жодної поданої заявки бачить «You have not submitted any requests yet», списку немає", async () => {
    useDb({ purchases: [purchaseOf(P2)] });

    const html = renderToStaticMarkup(await MyRequestsPage(props()));

    expect(html).toContain("You have not submitted any requests yet");
    expect(html).not.toContain("my-requests");
  });

  it("без ознаки подання повідомлення немає", async () => {
    useDb({ purchases: [] });

    const html = renderToStaticMarkup(await MyRequestsPage(props()));

    expect(html).not.toContain("Purchase submitted");
  });
});
