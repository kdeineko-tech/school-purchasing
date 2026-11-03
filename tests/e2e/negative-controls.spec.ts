// НЕГАТИВНИЙ КОНТРОЛЬ UAT (WS8): навмисно хибне очікування, щоб показати, що UAT уміє падати.
// Не AC-тест: назва починається з NC-, а не з AC ID, тож ac:coverage його не рахує. У звичайному прогоні його немає
// (проєкт chromium має grepInvert @negative-control); запуск — npm run uat:nc. Лише читання: безпечно на проді.
// NC-1 — у твердженні інший текст повідомлення, ніж показує застосунок → твердження падає → FAIL (R1), хоч би що сказав агент.
import { expect, test } from "@playwright/test";
import { attachRuntimeErrors, given, thenStep, when } from "./support/uat";

test.use({ storageState: "playwright/.auth/requester.json" });

const WRONG_MESSAGE = "Access denied";

test.afterEach(async ({ page }) => attachRuntimeErrors(page));

test(
  "NC-1 (AC-APR-04, навмисно хибне очікування в тесті: інший текст повідомлення)",
  {
    tag: ["@negative-control"],
    annotation: [
      { type: "ac", description: "AC-APR-04" },
      { type: "case", description: "NC-1" },
    ],
  },
  async ({ page }) => {
    await given("працівник 1 з роллю `requester` увійшов", async () => {
      await page.goto("/");
    });
    await when("він відкриває список для рішення за прямим посиланням", async () => {
      await page.goto("/approvals");
    });
    await thenStep(
      page,
      {
        clause: "він бачить повідомлення «Недостатньо прав», жодної заявки йому не показано, і статуси заявок не змінилися",
        visible: ["повідомлення «Not enough permissions» (англійський текст PM для «Недостатньо прав»)"],
      },
      async () => {
        await expect(page.getByRole("main").getByRole("alert")).toHaveText(WRONG_MESSAGE, { timeout: 5_000 });
      },
    );
  },
);
