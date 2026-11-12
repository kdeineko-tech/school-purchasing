// UAT WS9, AC-LANG-09: підписи статусів «Partially approved» і «Returned for revision» у списку «My requests» і на
// сторінці заявки. «В історії» — поза WS9 (ValiaBihun/2026-quitcode-dream-team#75): записів історії про рішення ще
// немає. Пише дані (@writes): одноразові uat-<прогін>-…@example.test — заявник відділу «UAT» і «Марія», схвалювач
// «UAT»; afterAll видаляє обох разом із заявками (OWNED_ROWS у support/admin.ts). Прогони — лише по одному.
// Обидва статуси Марія ставить через інтерфейс, як у AC-DEC-01 і AC-DEC-04.
import { expect, test, type Page } from "@playwright/test";
import { adminClient, createUatRequester, deleteUatUsers } from "./support/admin";
import { openNewestRequest, PAPER, PENS, submitPurchase } from "./support/purchases";
import { attachRuntimeErrors, given, signIn, thenStep, when } from "./support/uat";

test.use({ storageState: { cookies: [], origins: [] } });

const PARTIAL = "Partially approved";
const RETURNED = "Returned for revision";

let requester: { email: string; password: string } | undefined;
let maria: { email: string; password: string } | undefined;

async function signInAs(page: Page, user: { email: string; password: string }) {
  await page.context().clearCookies();
  await signIn(page, user.email, user.password);
}

async function storedStatus(id: string) {
  const { data, error } = await adminClient().from("purchases").select("status").eq("id", id).single();
  if (error) throw error;
  return (data as { status: string }).status;
}

// Без SUPABASE_SECRET_KEY (.env.local) adminClient() падає з поясненням: такий прогін — лише з --grep-invert '@writes'.
test.beforeAll(async () => {
  requester = await createUatRequester("labels", "UAT Labels Requester", "UAT");
  maria = await createUatRequester("maria-labels", "UAT Maria", "UAT", { approves: true });
});

test.afterEach(async ({ page }) => attachRuntimeErrors(page));

test.afterAll(async () => {
  for (const user of [requester, maria]) {
    if (!user) continue;
    const result = await deleteUatUsers(user.email);
    expect(result.remaining, "лишився синтетичний користувач").toEqual([]);
    expect(result.leftoverRequests, "лишились заявки синтетичного користувача").toBe(0);
  }
});

test(
  "AC-LANG-09: заявки «Частково схвалено» і «Повернено на доопрацювання» — у «My requests» і на сторінці заявки текст «Partially approved» і «Returned for revision»",
  { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-LANG-09" } },
  async ({ page }) => {
    let partialId = "";
    let returnedId = "";

    await given(
      "заявка зі статусом «Частково схвалено» і заявка зі статусом «Повернено на доопрацювання» (відділ «UAT», рішення Марії)",
      async () => {
        await signIn(page, requester!.email, requester!.password);
        await submitPurchase(page, [PAPER, PENS]);
        partialId = await openNewestRequest(page);
        await submitPurchase(page, [PAPER]);
        returnedId = await openNewestRequest(page);

        await signInAs(page, maria!);
        await page.goto(`/purchases/${partialId}`);
        await page.getByRole("checkbox", { name: "Reject line 2" }).check();
        await page.getByRole("button", { name: "Approve", exact: true }).click();
        await page.waitForURL((url) => url.searchParams.get("decided") === "approve");

        await page.goto(`/purchases/${returnedId}`);
        await page.getByRole("textbox", { name: /Reason/ }).fill("Уточніть кількість");
        await page.getByRole("button", { name: "Return for revision" }).click();
        await page.waitForURL((url) => url.searchParams.get("decided") === "return");

        expect(await storedStatus(partialId)).toBe("partially_approved");
        expect(await storedStatus(returnedId)).toBe("returned");
      },
    );

    await when("автор відкриває список «My requests»", async () => {
      await signInAs(page, requester!);
      await page.goto("/purchases");
    });

    await thenStep(
      page,
      {
        clause: "статус підписано текстом «Partially approved» чи «Returned for revision» відповідно, а не лише кольором",
        visible: [`у списку «My requests» рядок першої заявки — «${PARTIAL}», другої — «${RETURNED}»`],
        hidden: ["у базі статуси заявок: partially_approved і returned"],
      },
      async () => {
        const list = page.getByTestId("my-requests");
        const row = (id: string) => list.locator(`a[href="/purchases/${id}"]`).getByTestId("purchase-status");
        await expect(row(partialId)).toBeVisible();
        await expect(row(partialId)).toHaveText(PARTIAL);
        await expect(row(returnedId)).toBeVisible();
        await expect(row(returnedId)).toHaveText(RETURNED);
        expect(await storedStatus(partialId)).toBe("partially_approved");
        expect(await storedStatus(returnedId)).toBe("returned");
      },
    );

    await when("автор відкриває сторінку першої заявки", async () => {
      await page.goto(`/purchases/${partialId}`);
    });

    await thenStep(
      page,
      {
        clause: "статус підписано текстом «Partially approved» чи «Returned for revision» відповідно, а не лише кольором",
        visible: [`на сторінці першої заявки статус «${PARTIAL}»`],
        hidden: [],
      },
      async () => {
        await expect(page.getByTestId("purchase-status")).toBeVisible();
        await expect(page.getByTestId("purchase-status")).toHaveText(PARTIAL);
      },
    );

    await when("автор відкриває сторінку другої заявки", async () => {
      await page.goto(`/purchases/${returnedId}`);
    });

    await thenStep(
      page,
      {
        clause: "статус підписано текстом «Partially approved» чи «Returned for revision» відповідно, а не лише кольором",
        visible: [`на сторінці другої заявки статус «${RETURNED}»`],
        hidden: ["у базі статуси заявок: partially_approved і returned — не змінилися від перегляду"],
      },
      async () => {
        await expect(page.getByTestId("purchase-status")).toBeVisible();
        await expect(page.getByTestId("purchase-status")).toHaveText(RETURNED);
        expect(await storedStatus(partialId)).toBe("partially_approved");
        expect(await storedStatus(returnedId)).toBe("returned");
      },
    );
  },
);
