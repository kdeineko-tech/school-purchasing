// UAT WS8 для 3 AC зрізу 2 на проді: AC-APR-04 (відмова), AC-FRM-06 (помилка форми), AC-FRM-03 (типи за дозволом).
// Усі три лише читають: прод спільний з PM. AC-FRM-06 натискає «Submit», але сервер відмовляє ще до бази
// (validateSubmission), а submit_purchase повторно перевіряє рядки до insert — заявку не створено.
// Інтерфейс англійською (AC-LANG-01): тексти «Тоді» PM — українською, на екрані — англійські тексти з таблиці PM
// ValiaBihun/2026-quitcode-dream-team#49 («Недостатньо прав» — «Not enough permissions», «Додайте хоча б один рядок» —
// «Add at least one line», «Відділ закупівель» — «Purchasing department», «Самостійна закупівля» — «Self-purchase»).
// Відділ «Початкова школа» в базі — «Primary School» (демо-дані англійською).
import { expect, test, type Page } from "@playwright/test";
import { attachRuntimeErrors, given, thenStep, when } from "./support/uat";

test.use({ storageState: "playwright/.auth/requester.json" });

const ACCOUNT = "Account menu: PM Requester";

/** Активні (не disabled) варіанти випадного списку — підказку «Select …» не рахуємо. */
async function enabledOptions(page: Page, testId: string): Promise<string[]> {
  return page
    .getByTestId(testId)
    .locator("option:not([disabled])")
    .evaluateAll((options) => options.map((o) => (o.textContent ?? "").trim()));
}

test.afterEach(async ({ page }) => attachRuntimeErrors(page));

test(
  "AC-APR-04: працівник 1 з роллю requester відкриває список для рішення за прямим посиланням — «Not enough permissions», жодної заявки",
  { tag: ["@uat"], annotation: { type: "ac", description: "AC-APR-04" } },
  async ({ page }) => {
    await given("працівник 1 з роллю `requester` увійшов", async () => {
      await page.goto("/");
      await expect(page.getByRole("button", { name: ACCOUNT })).toBeVisible();
    });

    await when("він відкриває список для рішення за прямим посиланням", async () => {
      await page.goto("/approvals");
    });

    await thenStep(
      page,
      {
        clause: "він бачить повідомлення «Недостатньо прав», жодної заявки йому не показано, і статуси заявок не змінилися",
        visible: ["повідомлення «Not enough permissions» (англійський текст PM для «Недостатньо прав»)"],
        hidden: [
          "жодної заявки не показано: списку заявок для рішення немає в розмітці сторінки",
          "статуси заявок не змінилися: сторінка лише читає, кнопок рішення немає",
        ],
      },
      async () => {
        await expect(page).toHaveURL((url) => url.pathname === "/approvals");
        await expect(page.getByRole("main").getByRole("alert")).toHaveText("Not enough permissions");
        await expect(page.getByTestId("decision-list")).toHaveCount(0);
        await expect(page.getByRole("button", { name: /^(Approve|Reject)$/ })).toHaveCount(0);
      },
    );
  },
);

test(
  "AC-FRM-06: закупівля без жодного рядка не подається — «Add at least one line», відділ і тип лишаються у формі",
  { tag: ["@uat"], annotation: { type: "ac", description: "AC-FRM-06" } },
  async ({ page }) => {
    await given("працівник 1 обрав відділ «Початкова школа» й тип «Відділ закупівель», але не додав жодного рядка", async () => {
      await page.goto("/purchases/new");
      await page.getByTestId("department-select").selectOption({ label: "Primary School" });
      await page.getByTestId("purchase-type-select").selectOption({ label: "Purchasing department" });
      await expect(page.getByRole("textbox", { name: "Item" })).toHaveCount(0);
    });

    await when("він намагається подати закупівлю", async () => {
      await page.getByRole("button", { name: "Submit" }).click();
    });

    await thenStep(
      page,
      {
        clause:
          "він бачить повідомлення «Додайте хоча б один рядок», обрані відділ і тип лишаються у формі, а закупівлю не подано",
        visible: [
          "повідомлення «Add at least one line» (англійський текст PM для «Додайте хоча б один рядок»)",
          "у полі відділу обрано «Primary School»",
          "у полі типу обрано «Purchasing department»",
        ],
        hidden: ["закупівлю не подано: сторінка лишилась формою /purchases/new, переходу на «My requests» немає"],
      },
      async () => {
        await expect(page.getByRole("main").getByRole("alert")).toHaveText("Add at least one line");
        await expect(page).toHaveURL((url) => url.pathname === "/purchases/new");
        await expect(page.getByTestId("department-select").locator("option:checked")).toHaveText("Primary School");
        await expect(page.getByTestId("purchase-type-select").locator("option:checked")).toHaveText("Purchasing department");
      },
    );
  },
);

test(
  "AC-FRM-03: без ролі admin і без дозволу «Self-purchase» у виборі типу лише «Purchasing department»",
  { tag: ["@uat"], annotation: { type: "ac", description: "AC-FRM-03" } },
  async ({ page }) => {
    await given("працівник 1 без ролі `admin` і без дозволу «Самостійна закупівля»", async () => {
      await page.goto("/");
      await expect(page.getByRole("button", { name: ACCOUNT })).toBeVisible();
    });

    await when("він відкриває форму закупівлі й розкриває вибір типу закупівлі", async () => {
      await page.goto("/purchases/new");
      await page.getByTestId("purchase-type-select").focus();
    });

    await thenStep(
      page,
      {
        clause: "в списку лише «Відділ закупівель», а типу «Самостійна закупівля» немає",
        visible: ["поле «Purchase type» з варіантом «Purchasing department» (англійський текст PM для «Відділ закупівель»)"],
        hidden: [
          "у випадному списку типів лише один активний варіант — «Purchasing department» (нативний список на кадрі не розкривається)",
          "варіанта «Self-purchase» немає в розмітці сторінки",
        ],
      },
      async () => {
        expect(await enabledOptions(page, "purchase-type-select")).toEqual(["Purchasing department"]);
        await expect(page.getByTestId("purchase-type-select").locator("option", { hasText: "Self-purchase" })).toHaveCount(0);
      },
    );
  },
);
