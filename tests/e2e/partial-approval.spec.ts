// UAT WS9, задача 3 «Часткове схвалення»: AC-DEC-01. Пише дані (@writes): одноразові uat-<прогін>-…@example.test —
// заявник відділу «UAT» і «Марія», схвалювач «UAT» (замість «Початкової школи»); afterAll видаляє обох разом із
// заявками (OWNED_ROWS у support/admin.ts). Прогони — лише по одному: deleteUatUsers() прибирає всі uat-*.
// Інтерфейс англійською (ValiaBihun/2026-quitcode-dream-team#49): «Частково схвалено» — «Partially approved»,
// «Схвалено» — «Approved», «Відхилено» — «Rejected»; позначка «Reject line» — немає в таблиці #49 (опис PR).
import { expect, test } from "@playwright/test";
import { adminClient, createUatRequester, deleteUatUsers } from "./support/admin";
import { MARKERS, openNewestRequest, PAPER, PENS, submitPurchase } from "./support/purchases";
import { attachRuntimeErrors, given, signIn, thenStep, when } from "./support/uat";

test.use({ storageState: { cookies: [], origins: [] } });
test.describe.configure({ mode: "serial" });

let requester: { email: string; password: string } | undefined;
let maria: { email: string; password: string } | undefined;

async function lineStatuses(id: string) {
  const { data, error } = await adminClient()
    .from("purchase_lines")
    .select("name, status")
    .eq("purchase_id", id)
    .order("position");
  if (error) throw error;
  return data as { name: string; status: string }[];
}

// Без SUPABASE_SECRET_KEY (.env.local) adminClient() падає з поясненням: такий прогін — лише з --grep-invert '@writes'.
test.beforeAll(async () => {
  requester = await createUatRequester("partial", "UAT Partial Requester", "UAT");
  maria = await createUatRequester("maria", "UAT Maria", "UAT", { approves: true });
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
  "AC-DEC-01: Марія відхиляє рядок 2 і схвалює заявку — «Partially approved», автор бачить рядок 2 «Rejected», рядки 1 і 3 «Approved»",
  { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-DEC-01" } },
  async ({ page }) => {
    let id = "";
    await given(
      "заявка відділу «UAT» (замість «Початкової школи») з трьома рядками «Очікує схвалення», автор — не Марія, Марія схвалює цей відділ",
      async () => {
        await signIn(page, requester!.email, requester!.password);
        await submitPurchase(page, [PAPER, PENS, MARKERS]);
        id = await openNewestRequest(page);
        expect((await lineStatuses(id)).map((l) => l.status)).toEqual(["pending", "pending", "pending"]);
        await page.context().clearCookies();
        await signIn(page, maria!.email, maria!.password);
      },
    );

    await when("Марія відхиляє рядок 2 і схвалює заявку", async () => {
      await page.goto(`/purchases/${id}`);
      await page.getByRole("checkbox", { name: "Reject line 2" }).check();
      await page.getByRole("button", { name: "Approve", exact: true }).click();
      await page.waitForURL((url) => url.searchParams.get("decided") === "approve");
    });

    await thenStep(
      page,
      {
        clause: "статус заявки «Частково схвалено», автор бачить рядок 2 зі статусом «Відхилено», а рядки 1 і 3 — «Схвалено»",
        visible: [
          "у автора на сторінці заявки статус «Partially approved»",
          "рядок 2 «Pens» — «Rejected», рядки 1 «Paper A4» і 3 «Markers» — «Approved»",
        ],
        hidden: ["статуси рядків у базі: approved, rejected, approved"],
      },
      async () => {
        await page.context().clearCookies();
        await signIn(page, requester!.email, requester!.password);
        await page.goto(`/purchases/${id}`);
        await expect(page.getByTestId("purchase-status")).toHaveText("Partially approved");
        await expect(page.getByTestId("line-status")).toHaveText(["Approved", "Rejected", "Approved"]);
        expect(await lineStatuses(id)).toEqual([
          { name: "Paper A4", status: "approved" },
          { name: "Pens", status: "rejected" },
          { name: "Markers", status: "approved" },
        ]);
      },
    );
  },
);
