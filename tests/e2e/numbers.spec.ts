// UAT WS9, задача 1 «Номер і суми»: AC-HIST-01 (номер заявки) і AC-HIST-02 (суми рядків і заявки).
// Обидва AC пишуть дані (@writes): одноразовий заявник uat-<прогін>-…@example.test у синтетичному відділі «UAT»
// подає закупівлі через форму, а afterAll видаляє його разом із заявками (OWNED_ROWS у support/admin.ts); залишки
// обірваних прогонів прибирає cleanup.teardown.ts. Прогони — лише по одному: deleteUatUsers() прибирає всі uat-*.
// На проді вже є заявки, тож «PUR-1 і PUR-2 у порожній системі» тут не перевірити: перевіряємо пару підряд PUR-n,
// PUR-(n+1) — дві заявки, створені й подані одна за одною (відповіді PM ValiaBihun/2026-quitcode-dream-team#73 і
// #76); «PUR-1, PUR-2» доводить тест бази
// tests/db/numbers.test.ts. Чужа заявка між двома поданнями — повторити прогін; знову не підряд — «Не перевірено».
// Інтерфейс англійською: «Мої заявки» — «My requests».
import { expect, test } from "@playwright/test";
import { createUatRequester, deleteUatUsers } from "./support/admin";
import { openNewestRequest, PAPER, PENS, submitPurchase } from "./support/purchases";
import { attachRuntimeErrors, given, signIn, thenStep, when } from "./support/uat";

test.use({ storageState: { cookies: [], origins: [] } });
test.describe.configure({ mode: "serial" });

let requester: { email: string; password: string } | undefined;

// Без SUPABASE_SECRET_KEY (.env.local) adminClient() падає з поясненням: такий прогін — лише з --grep-invert '@writes'.
test.beforeAll(async () => {
  requester = await createUatRequester("number", "UAT Number Requester", "UAT");
});

test.afterEach(async ({ page }) => attachRuntimeErrors(page));

test.afterAll(async () => {
  if (!requester) return;
  const result = await deleteUatUsers(requester.email);
  expect(result.remaining, "лишився синтетичний заявник").toEqual([]);
  expect(result.leftoverRequests, "лишились заявки синтетичного заявника").toBe(0);
});

test(
  "AC-HIST-01: працівник 1 подає першу закупівлю, а потім другу — у «My requests» вони мають номери підряд",
  { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-HIST-01" } },
  async ({ page }) => {
    await given(
      "в системі ще немає жодної закупівлі — на проді заявки вже є, тож новий заявник без жодної заявки (відповідь PM #73)",
      async () => {
        await signIn(page, requester!.email, requester!.password);
        await page.goto("/purchases");
        await expect(page.getByTestId("purchase-number")).toHaveCount(0);
      },
    );

    await when("працівник 1 подає першу закупівлю, а потім другу", async () => {
      await submitPurchase(page, [PAPER]);
      await submitPurchase(page, [PENS]);
    });

    await thenStep(
      page,
      {
        clause: "в списку «Мої заявки» вони мають номери «PUR-1» і «PUR-2»",
        visible: [
          "у списку «My requests» дві заявки з номерами «PUR-n» і «PUR-(n+1)» — друга на одиницю більша за першу " +
            "(на проді вже є заявки, тож замість «PUR-1» і «PUR-2» — пара підряд, відповідь PM #73)",
        ],
        hidden: [
          "«PUR-1» і «PUR-2» у системі без жодної закупівлі — тест бази tests/db/numbers.test.ts",
          "номери читаються з тих самих рядків списку, новіша заявка перша",
        ],
      },
      async () => {
        await expect(page.getByTestId("purchase-number")).toHaveCount(2);
        const [second, first] = await page.getByTestId("purchase-number").allTextContents();
        expect(first).toMatch(/^PUR-\d+$/);
        expect(second).toBe(`PUR-${Number(first.slice(4)) + 1}`);
      },
    );
  },
);

test(
  "AC-HIST-02: автор відкриває заявку з рядками 3 × 20.00 і 2 × 15.50 — суми рядків 60.00 і 31.00, сума заявки 91.00",
  { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-HIST-02" } },
  async ({ page }) => {
    await given("закупівля з двома рядками: кількість 3 за ціною 20.00 і кількість 2 за ціною 15.50", async () => {
      await signIn(page, requester!.email, requester!.password);
      await submitPurchase(page, [PAPER, PENS]);
    });

    await when("автор відкриває заявку", async () => {
      await openNewestRequest(page);
    });

    await thenStep(
      page,
      {
        clause: "суми рядків 60.00 і 31.00, а сума заявки 91.00",
        visible: [
          "у колонці «Line total» рядка «Paper A4» — 60.00, рядка «Pens» — 31.00",
          "у рядку «Total» під рядками — 91.00",
        ],
      },
      async () => {
        await expect(page.getByTestId("line-total")).toHaveText(["60.00", "31.00"]);
        await expect(page.getByTestId("purchase-total")).toHaveText("91.00");
      },
    );
  },
);
