import { beforeEach, describe, expect, it, vi } from "vitest";
import { decidePurchase, resubmitPurchase } from "@/app/purchases/actions";
import { MESSAGES } from "@/lib/org/messages";
import { validateDecision } from "@/lib/purchases/decisions";
import { MAX_LINES, MAX_TEXT_LENGTH, validateLines, type PurchaseLineInput } from "@/lib/purchases/form";
import { createClient } from "@/lib/supabase/server";
import { form, P1, P2, viewer } from "./fake-db";
import { signIn, withViewer } from "../support/viewer";

// Серверні ліміти (зауваження PM 5, kdeineko-tech/school-purchasing#70): ті самі межі, що в базі
// (20261113115937_server_limits.sql), — у доменних функціях форми й рішення, і відмови бази → тексти форми.
// Межі в базі доводить tests/db/server-limits.test.ts.

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`);
  }),
}));

const ID = "00000000-0000-4000-8000-0000000000c1";
const line = (name = "Paper A4", purpose = "Printing"): PurchaseLineInput => ({ name, purpose, quantity: "3", unitPrice: "20.00" });
const lines = (n: number) => Array.from({ length: n }, () => line());
const LINES_JSON = JSON.stringify([line()]);

function setDb(rpcError: { message: string } | null = null) {
  const rpc = vi.fn(() => Promise.resolve({ data: null, error: rpcError }));
  vi.mocked(createClient).mockResolvedValue(withViewer({ rpc }) as never);
  return { rpc };
}

beforeEach(() => vi.clearAllMocks());

describe("ліміти рядків — validateLines", () => {
  it("межі такі самі, як у базі: 100 рядків, 500 символів", () => {
    expect(MAX_LINES).toBe(100);
    expect(MAX_TEXT_LENGTH).toBe(500);
  });

  it("100 рядків — гаразд; 101 — «A purchase can have at most 100 lines»", () => {
    expect(validateLines(lines(MAX_LINES))).toEqual({ ok: true });
    expect(validateLines(lines(MAX_LINES + 1))).toEqual({ ok: false, error: MESSAGES.tooManyLines });
  });

  it("назва чи мета — рівно 500 символів після обрізання гаразд, 501 — «…at most 500 characters»", () => {
    const max = "я".repeat(MAX_TEXT_LENGTH);
    expect(validateLines([line(`  ${max}  `, max)])).toEqual({ ok: true });
    expect(validateLines([line(), line(`${max}я`)])).toEqual({ ok: false, error: MESSAGES.lineTooLong });
    expect(validateLines([line("Pens", `${max}я`)])).toEqual({ ok: false, error: MESSAGES.lineTooLong });
  });

  it("символи рахуються як у базі (char_length), а не одиниці UTF-16: 500 емодзі — гаразд", () => {
    expect(validateLines([line("🖊".repeat(MAX_TEXT_LENGTH))])).toEqual({ ok: true });
  });

  it("порожнє поле важливіше за довжину: спершу «Fill in all line fields»", () => {
    expect(validateLines([line("x".repeat(MAX_TEXT_LENGTH + 1), " ")])).toEqual({ ok: false, error: MESSAGES.lineFields });
  });
});

describe("ліміт причини — validateDecision", () => {
  it("причина відхилення чи повернення 500 символів — гаразд, 501 — «Reason must be at most 500 characters»", () => {
    for (const decision of ["reject", "return"]) {
      expect(validateDecision(decision, "r".repeat(MAX_TEXT_LENGTH))).toMatchObject({ ok: true });
      expect(validateDecision(decision, "r".repeat(MAX_TEXT_LENGTH + 1))).toEqual({ ok: false, error: MESSAGES.reasonTooLong });
    }
  });
});

describe("відмови бази → тексти форми", () => {
  it("повторне подання: TOO_MANY_LINES і LINE_TOO_LONG — ті самі тексти, що й перевірка форми", async () => {
    signIn(viewer(P1));
    setDb({ message: "TOO_MANY_LINES" });
    expect(await resubmitPurchase({}, form({ purchaseId: ID, lines: LINES_JSON }))).toEqual({ error: MESSAGES.tooManyLines });

    setDb({ message: "LINE_TOO_LONG" });
    expect(await resubmitPurchase({}, form({ purchaseId: ID, lines: LINES_JSON }))).toEqual({ error: MESSAGES.lineTooLong });
  });

  it("повторне подання понад 100 рядків — до бази не доходить", async () => {
    signIn(viewer(P1));
    const { rpc } = setDb();

    expect(await resubmitPurchase({}, form({ purchaseId: ID, lines: JSON.stringify(lines(MAX_LINES + 1)) }))).toEqual({
      error: MESSAGES.tooManyLines,
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("рішення: задовга причина — до бази не доходить; порушення check бази — той самий текст", async () => {
    signIn(viewer(P2, "approver"));
    const { rpc } = setDb();
    const tooLong = "r".repeat(MAX_TEXT_LENGTH + 1);
    const back = `REDIRECT /purchases/${ID}?error=${encodeURIComponent(MESSAGES.reasonTooLong)}`;

    await expect(decidePurchase(form({ purchaseId: ID, decision: "reject", reason: tooLong }))).rejects.toThrow(back);
    expect(rpc).not.toHaveBeenCalled();

    setDb({ message: 'new row for relation "purchases" violates check constraint "purchases_rejection_reason_length"' });
    await expect(decidePurchase(form({ purchaseId: ID, decision: "reject", reason: "Too expensive" }))).rejects.toThrow(back);
  });
});
