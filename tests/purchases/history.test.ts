import { describe, expect, it } from "vitest";
import { formatHistoryEntry, formatHistoryTime } from "@/lib/purchases/history";

// Запис історії (AC-HIST-06; формат — відповідь PM ValiaBihun/2026-quitcode-dream-team#74): доменні функції.
// Сторінка — tests/purchases/purchase-page.test.ts, база — tests/db/history.test.ts.

describe("запис історії — доменні функції", () => {
  it("AC-HIST-06: запис «Подано» — «Submitted · <ім'я> · dd.mm.yyyy, HH:MM» за America/New_York", () => {
    expect(
      formatHistoryEntry({ kind: "submitted", created_at: "2026-11-05T19:32:00Z", actor_name: "PM Demo Requester" }),
    ).toBe("Submitted · PM Demo Requester · 05.11.2026, 14:32");
  });

  it("AC-HIST-06: час 24-годинний, без позначки поясу; перехід доби й літній час — за America/New_York", () => {
    expect(formatHistoryTime("2026-11-06T04:05:00Z")).toBe("05.11.2026, 23:05");
    expect(formatHistoryTime("2026-11-06T05:00:00Z")).toBe("06.11.2026, 00:00");
    // Липень — літній час (UTC−4), листопад після 01.11 — зимовий (UTC−5).
    expect(formatHistoryTime("2026-07-01T16:00:00Z")).toBe("01.07.2026, 12:00");
    expect(formatHistoryTime("2026-11-05T17:00:00Z")).toBe("05.11.2026, 12:00");
  });

  it("AC-HIST-06: без імені база віддає email — він і в записі; невідомий вид — як є", () => {
    expect(
      formatHistoryEntry({ kind: "submitted", created_at: "2026-11-05T19:32:00Z", actor_name: "petro@example.test" }),
    ).toBe("Submitted · petro@example.test · 05.11.2026, 14:32");
    expect(formatHistoryEntry({ kind: "archived", created_at: "2026-11-05T19:32:00Z", actor_name: "Петро" })).toBe(
      "archived · Петро · 05.11.2026, 14:32",
    );
  });
});
