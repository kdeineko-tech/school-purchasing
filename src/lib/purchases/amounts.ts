// Номер і суми заявки (AC-HIST-01, AC-HIST-02). Суми — у доларах США, 2 знаки, округлення до центів: рахуємо в
// цілих центах, щоб 0.1 + 0.2 не давало 0.30000000000000004, і форматуємо лише для показу.

/** Номер заявки виду «PUR-1»; до застосування міграції номера ще немає — «—». */
export function formatNumber(number: number | null | undefined): string {
  // Number.isInteger відкидає null, undefined і дробові.
  return Number.isInteger(number) && Number(number) >= 1 ? `PUR-${number}` : "—";
}

type Amount = number | string | null | undefined;

const toNumber = (value: Amount): number | null => {
  // Number(undefined) — NaN, тож окремої перевірки не треба; а null і "" дали б 0.
  if (value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

/** Сума рядка в центах: кількість × ціна; без кількості чи ціни — null. */
export function lineTotal(quantity: Amount, unitPrice: Amount): number | null {
  const q = toNumber(quantity);
  const p = toNumber(unitPrice);
  if (q === null || p === null) return null;
  return Math.round(q * Math.round(p * 100));
}

/** Сума заявки в центах — завжди за всіма рядками, зокрема для «Частково схвалено» (#65); рядки без суми — 0. */
export function purchaseTotal(lines: { quantity: Amount; unit_price: Amount }[]): number {
  return lines.reduce((sum, line) => sum + (lineTotal(line.quantity, line.unit_price) ?? 0), 0);
}

/** Центи → «91.00»; null — «—». */
export function formatCents(cents: number | null): string {
  if (cents === null) return "—";
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}
