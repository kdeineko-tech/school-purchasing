// UAT WS10, задача 2.1 «Прод і UAT»: AC-AI-01 (рядок з опису) і AC-AI-02 (відмова поза закупівлями) на проді.
// Обидва лише читають: «Suggest lines» нічого не пише в базу (дія suggestLine без запису), а «Submit» тест не натискає.
// Відповідь дає жива безкоштовна модель OpenRouter (ключ — OPENROUTER_API_KEY у Vercel Production), тож кожен прогін —
// 2 запити з денного ліміту 50. Модель може відповісти інакше, ніж у golden cases: тоді тест червоний, і це чесний
// результат UAT, а не привід «підкрутити» перевірку.
// Усе англійською (рішення PM 2026-11-16, ValiaBihun/2026-quitcode-dream-team#71): опис, кнопка «Suggest lines» і
// повідомлення. Назву й мету перевіряємо правилом PM «містить» (golden case № 1): назва містить «paper», мета — «print»;
// дослівно — лише кількість 3 і ціна 20.00.
import { expect, test, type Page } from "@playwright/test";
import { attachRuntimeErrors, given, thenStep, when } from "./support/uat";

test.use({ storageState: "playwright/.auth/requester.json" });

const ACCOUNT = "Account menu: PM Requester";
// Таймаут дії в застосунку — 15 с (AC-AI-04); чекаємо трохи довше, ніж сервер чекає модель.
const AI_TIMEOUT = 20_000;

test.afterEach(async ({ page }) => attachRuntimeErrors(page));

/** Скільки заявок у «My requests» — окремою вкладкою, щоб не змінити кадр форми. */
async function myRequestsCount(page: Page): Promise<number> {
  const tab = await page.context().newPage();
  try {
    await tab.goto("/purchases");
    return await tab.getByTestId("my-requests").getByRole("link").count();
  } finally {
    await tab.close();
  }
}

async function openNewPurchase(page: Page) {
  await page.goto("/purchases/new");
  await expect(page.getByRole("button", { name: ACCOUNT })).toBeVisible();
  await expect(page.getByTestId("purchase-description")).toBeVisible();
}

async function suggest(page: Page, description: string) {
  await page.getByTestId("purchase-description").fill(description);
  await page.getByTestId("suggest-lines").click();
  // Відповідь прийшла, коли зник напис «Looking for lines…».
  await expect(page.getByTestId("suggest-pending")).toHaveCount(0, { timeout: AI_TIMEOUT });
}

test(
  "AC-AI-01: працівник 1 вставляє опис «Need 3 packs of A4 paper for printing, 20 dollars each» — рядок A4 paper / For printing / 3 / 20.00, закупівлю не подано",
  { tag: ["@uat"], annotation: { type: "ac", description: "AC-AI-01" } },
  async ({ page }) => {
    let before = 0;

    await given("працівник 1 відкрив форму нової закупівлі", async () => {
      before = await myRequestsCount(page);
      await openNewPurchase(page);
    });

    await when(
      "він вставляє опис «Need 3 packs of A4 paper for printing, 20 dollars each» і натискає «Suggest lines»",
      async () => {
        await suggest(page, "Need 3 packs of A4 paper for printing, 20 dollars each");
      },
    );

    await thenStep(
      page,
      {
        clause: "він бачить один рядок: назва «A4 paper», мета «For printing», кількість 3, ціна 20.00",
        visible: [
          "у формі рівно один рядок закупівлі",
          "поле «Item» містить «paper» (у PM — «A4 paper»)",
          "поле «Purpose» містить «print» (у PM — «For printing»)",
          "поле «Quantity» — 3",
          "поле «Unit price» — 20.00",
        ],
      },
      async () => {
        await expect(page.getByRole("textbox", { name: "Item" })).toHaveCount(1, { timeout: AI_TIMEOUT });
        await expect(page.getByRole("textbox", { name: "Item" })).toHaveValue(/paper/i);
        await expect(page.getByRole("textbox", { name: "Purpose" })).toHaveValue(/print/i);
        await expect(page.getByRole("spinbutton", { name: "Quantity" })).toHaveValue("3");
        await expect(page.getByRole("spinbutton", { name: "Unit price" })).toHaveValue("20.00");
      },
    );

    await thenStep(
      page,
      {
        clause: "закупівлю ще не подано",
        visible: ["форма нової закупівлі ще відкрита, кнопка «Submit» на місці, повідомлення «Purchase submitted» немає"],
        hidden: ["кількість заявок у «My requests» не змінилася (окрема вкладка, до і після)"],
      },
      async () => {
        await expect(page).toHaveURL((url) => url.pathname === "/purchases/new");
        await expect(page.getByRole("button", { name: "Submit" })).toBeVisible();
        await expect(page.getByText("Purchase submitted")).toHaveCount(0);
        expect(await myRequestsCount(page)).toBe(before);
      },
    );
  },
);

test(
  "AC-AI-02: працівник 1 вставляє опис «Book me a doctor's appointment for Friday» — «I can only help with purchases», рядків не додано",
  { tag: ["@uat"], annotation: { type: "ac", description: "AC-AI-02" } },
  async ({ page }) => {
    await given("працівник 1 відкрив форму нової закупівлі", async () => {
      await openNewPurchase(page);
    });

    await when("він вставляє опис «Book me a doctor's appointment for Friday» і натискає «Suggest lines»", async () => {
      await suggest(page, "Book me a doctor's appointment for Friday");
    });

    await thenStep(
      page,
      {
        clause: "він бачить повідомлення «I can only help with purchases»",
        visible: ["повідомлення «I can only help with purchases»"],
      },
      async () => {
        await expect(page.getByTestId("suggest-message")).toHaveText("I can only help with purchases", {
          timeout: AI_TIMEOUT,
        });
      },
    );

    await thenStep(
      page,
      {
        clause: "рядків у формі не додано",
        visible: ["у формі немає жодного рядка закупівлі: полів «Item», «Purpose», «Quantity», «Unit price» немає"],
      },
      async () => {
        await expect(page.getByRole("textbox", { name: "Item" })).toHaveCount(0);
        await expect(page.getByRole("spinbutton", { name: "Quantity" })).toHaveCount(0);
      },
    );
  },
);
