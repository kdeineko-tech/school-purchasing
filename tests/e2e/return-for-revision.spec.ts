// UAT WS9, задача 4 «Повернення й повторне подання»: AC-DEC-06, AC-DEC-04, AC-DEC-07. Пише дані (@writes): одноразові
// uat-<прогін>-…@example.test — заявник відділу «UAT» і «Марія», схвалювач «UAT» (замість «Початкової школи»); afterAll
// видаляє обох разом із заявками (OWNED_ROWS у support/admin.ts). Прогони — лише по одному: deleteUatUsers() прибирає
// всі uat-*. Сценарії йдуть по черзі над однією заявкою: спершу повернення без причини, далі з причиною, далі
// повторне подання. Інтерфейс англійською (ValiaBihun/2026-quitcode-dream-team#49): «Повернути на доопрацювання» —
// «Return for revision», «Вкажіть причину» — «Provide a reason», «Повернено на доопрацювання» — «Returned for
// revision», «Редагувати» — «Edit», «Очікує схвалення» — «Awaiting approval»; підтвердження «Request returned for
// revision» і підпис «Reason» — немає в таблиці #49 (опис PR).
import { expect, test, type Page } from "@playwright/test";
import { adminClient, createUatRequester, deleteUatUsers } from "./support/admin";
import { openNewestRequest, PAPER, PENS, submitPurchase } from "./support/purchases";
import { attachRuntimeErrors, given, signIn, thenStep, when } from "./support/uat";

test.use({ storageState: { cookies: [], origins: [] } });
test.describe.configure({ mode: "serial" });

const REASON = "Уточніть кількість";

let requester: { email: string; password: string } | undefined;
let maria: { email: string; password: string } | undefined;
let id = "";

async function stored(purchaseId: string) {
  const { data, error } = await adminClient()
    .from("purchases")
    .select("status, return_reason, department_id, number")
    .eq("id", purchaseId)
    .single();
  if (error) throw error;
  return data as { status: string; return_reason: string | null; department_id: string; number: number };
}

async function signInAs(page: Page, user: { email: string; password: string }) {
  await page.context().clearCookies();
  await signIn(page, user.email, user.password);
}

// Без SUPABASE_SECRET_KEY (.env.local) adminClient() падає з поясненням: такий прогін — лише з --grep-invert '@writes'.
test.beforeAll(async () => {
  requester = await createUatRequester("return", "UAT Return Requester", "UAT");
  maria = await createUatRequester("maria-return", "UAT Maria", "UAT", { approves: true });
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
  "AC-DEC-06: Марія повертає заявку на доопрацювання без причини — «Provide a reason», статус лишається «Awaiting approval»",
  { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-DEC-06" } },
  async ({ page }) => {
    await given("заявка відділу «UAT» (замість «Початкової школи») зі статусом «Очікує схвалення», Марія схвалює цей відділ", async () => {
      await signIn(page, requester!.email, requester!.password);
      await submitPurchase(page, [PAPER, PENS]);
      id = await openNewestRequest(page);
      await signInAs(page, maria!);
    });

    await when("Марія повертає заявку на доопрацювання без причини", async () => {
      await page.goto(`/purchases/${id}`);
      await page.getByRole("button", { name: "Return for revision" }).click();
      await page.waitForURL((url) => url.searchParams.has("error"));
    });

    await thenStep(
      page,
      {
        clause: "вона бачить повідомлення «Вкажіть причину», а статус заявки лишається «Очікує схвалення»",
        visible: ["повідомлення «Provide a reason»", "статус «Awaiting approval»"],
        hidden: ["статус у базі: awaiting_approval, без причини повернення"],
      },
      async () => {
        await expect(page.getByTestId("decision-error")).toHaveText("Provide a reason");
        await expect(page.getByTestId("purchase-status")).toHaveText("Awaiting approval");
        expect(await stored(id)).toMatchObject({ status: "awaiting_approval", return_reason: null });
      },
    );
  },
);

test(
  "AC-DEC-04: Марія повертає заявку з причиною «Уточніть кількість» — статус «Returned for revision»",
  { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-DEC-04" } },
  async ({ page }) => {
    await given("заявка відділу «UAT» зі статусом «Очікує схвалення», автор — не Марія, Марія схвалює цей відділ", async () => {
      expect(id, "спершу — сценарій AC-DEC-06").not.toBe("");
      expect((await stored(id)).status).toBe("awaiting_approval");
      await signInAs(page, maria!);
    });

    await when("Марія повертає заявку на доопрацювання з причиною «Уточніть кількість»", async () => {
      await page.goto(`/purchases/${id}`);
      await page.getByRole("textbox", { name: /Reason/ }).fill(REASON);
      await page.getByRole("button", { name: "Return for revision" }).click();
      await page.waitForURL((url) => url.searchParams.get("decided") === "return");
    });

    // Два кадри: у Марії одразу після рішення й у автора. Один кадр (лише автор) рецензент не прийняв: «у Марії» —
    // не видно (UAT 2026-11-12, R3).
    await thenStep(
      page,
      {
        clause: "статус заявки «Повернено на доопрацювання»",
        visible: ["у Марії на сторінці заявки статус «Returned for revision»"],
        hidden: ["статус у базі: returned"],
      },
      async () => {
        await expect(page.getByTestId("purchase-status")).toHaveText("Returned for revision");
        expect((await stored(id)).status).toBe("returned");
      },
    );

    await when("автор відкриває свою заявку", async () => {
      await signInAs(page, requester!);
      await page.goto(`/purchases/${id}`);
    });

    await thenStep(
      page,
      {
        clause: "статус заявки «Повернено на доопрацювання»",
        visible: ["у автора на сторінці заявки статус «Returned for revision»", "причина «Уточніть кількість»"],
        hidden: ["у базі: returned, причина «Уточніть кількість»"],
      },
      async () => {
        await expect(page.getByTestId("purchase-status")).toHaveText("Returned for revision");
        await expect(page.getByTestId("return-reason")).toHaveText(REASON);
        expect(await stored(id)).toMatchObject({ status: "returned", return_reason: REASON });
      },
    );
  },
);

test(
  "AC-DEC-07: автор виправив рядок 1 і подає заявку знову — статус «Awaiting approval», відділ той самий",
  { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-DEC-07" } },
  async ({ page }) => {
    let before: Awaited<ReturnType<typeof stored>>;
    await given("заявка зі статусом «Повернено на доопрацювання», автор виправив рядок 1", async () => {
      expect(id, "спершу — сценарії AC-DEC-06 і AC-DEC-04").not.toBe("");
      before = await stored(id);
      expect(before.status).toBe("returned");
      await signInAs(page, requester!);
      await page.goto(`/purchases/${id}`);
      await page.getByTestId("edit-purchase").click();
      await page.waitForURL((url) => url.pathname === `/purchases/${id}/edit`);
      await page.getByRole("spinbutton", { name: "Quantity" }).first().fill("5");
    });

    await when("автор подає заявку знову", async () => {
      await page.getByRole("button", { name: "Submit" }).click();
      await page.waitForURL((url) => url.pathname === "/purchases");
    });

    // Два кадри: «My requests» з повідомленням про подання, далі сторінка заявки. Один кадр (лише сторінка заявки)
    // не показував повідомлення — рецензент сказав FAIL (UAT 2026-11-12, R3).
    await thenStep(
      page,
      {
        clause: "статус заявки «Очікує схвалення», відділ той самий",
        visible: ["повідомлення «Purchase submitted»", "у списку «My requests» заявка зі статусом «Awaiting approval»"],
        hidden: [],
      },
      async () => {
        await expect(page.getByTestId("submitted")).toHaveText("Purchase submitted");
        await expect(
          page.getByTestId("my-requests").locator(`a[href="/purchases/${id}"]`).getByTestId("purchase-status"),
        ).toHaveText("Awaiting approval");
      },
    );

    await when("автор відкриває заявку", async () => {
      await page.goto(`/purchases/${id}`);
    });

    await thenStep(
      page,
      {
        clause: "статус заявки «Очікує схвалення», відділ той самий",
        visible: ["на сторінці заявки статус «Awaiting approval», відділ «UAT»"],
        hidden: ["у базі: awaiting_approval, той самий відділ і номер, рядок 1 — кількість 5"],
      },
      async () => {
        await expect(page.getByTestId("purchase-status")).toHaveText("Awaiting approval");
        await expect(page.getByTestId("purchase-department")).toHaveText("UAT");
        const after = await stored(id);
        expect(after).toEqual({ ...before, status: "awaiting_approval", return_reason: null });
        const { data: lines } = await adminClient()
          .from("purchase_lines")
          .select("name, quantity")
          .eq("purchase_id", id)
          .order("position");
        expect(lines).toEqual([
          { name: "Paper A4", quantity: 5 },
          { name: "Pens", quantity: 2 },
        ]);
      },
    );
  },
);
