// Спільні кроки UAT для заявок, що пишуть дані (@writes): подання через форму у синтетичний відділ.
import type { Page } from "@playwright/test";

export type Line = { item: string; purpose: string; quantity: string; unitPrice: string };

export const PAPER: Line = { item: "Paper A4", purpose: "Printing", quantity: "3", unitPrice: "20.00" };
export const PENS: Line = { item: "Pens", purpose: "Classes", quantity: "2", unitPrice: "15.50" };

/** Подає закупівлю через форму у відділ department з типом «Purchasing department» і чекає «My requests». */
export async function submitPurchase(page: Page, lines: Line[], department: "UAT" | "UAT-2" = "UAT") {
  await page.goto("/purchases/new");
  await page.getByTestId("department-select").selectOption({ label: department });
  await page.getByTestId("purchase-type-select").selectOption({ label: "Purchasing department" });
  for (const [i, line] of lines.entries()) {
    await page.getByRole("button", { name: "Add line" }).click();
    await page.getByRole("textbox", { name: "Item" }).nth(i).fill(line.item);
    await page.getByRole("textbox", { name: "Purpose" }).nth(i).fill(line.purpose);
    await page.getByRole("spinbutton", { name: "Quantity" }).nth(i).fill(line.quantity);
    await page.getByRole("spinbutton", { name: "Unit price" }).nth(i).fill(line.unitPrice);
  }
  await page.getByRole("button", { name: "Submit" }).click();
  await page.waitForURL((url) => url.pathname === "/purchases");
}

/** Відкриває найновішу заявку з «My requests» і повертає її id з адреси. */
export async function openNewestRequest(page: Page): Promise<string> {
  await page.getByTestId("my-requests").getByRole("link").first().click();
  await page.waitForURL((url) => /^\/purchases\/[0-9a-f-]{36}$/.test(url.pathname));
  return new URL(page.url()).pathname.split("/").pop()!;
}
