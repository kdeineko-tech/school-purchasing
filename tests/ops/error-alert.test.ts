// WS11 (трек B): трекер помилок сервера → Telegram. Що йде в повідомлення і чого там не буває ніколи.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type ErrorContext,
  SAME_ERROR_PAUSE_MS,
  dedupeKey,
  errorAlertText,
  sendErrorAlert,
  shouldSend,
  stackFrames,
} from "@/lib/ops/error-alert";

const ctx: ErrorContext = { method: "GET", routePath: "/requests/[id]", routeType: "render", routerKind: "App Router" };
const SECRET_TEXT = "user typed MARKER-9c1e jane@example.test";

function errorWithStack(stack: string, message = SECRET_TEXT): Error {
  const error = new TypeError(message);
  error.stack = stack;
  return error;
}

describe("stackFrames", () => {
  it("бере лише рядки «at …», без заголовка з текстом помилки, і скорочує абсолютні шляхи", () => {
    const error = errorWithStack(
      [
        `TypeError: ${SECRET_TEXT}`,
        "second line of the message",
        "    at load (/Users/someone/app/.next/server/chunks/ssr/page.js:10:5)",
        "    at /home/runner/work/app/src/lib/x.ts:3:7",
        "    at <anonymous>",
      ].join("\n"),
      `${SECRET_TEXT}\nsecond line of the message`,
    );
    expect(stackFrames(error)).toEqual(["at load (.next/server/chunks/ssr/page.js:10:5)", "at src/lib/x.ts:3:7"]);
  });

  it("не більше 5 рядків, кожен до 160 символів; не Error — порожньо", () => {
    const frames = Array.from({ length: 8 }, (_, i) => `    at f${i} (src/${"a".repeat(200)}.ts:${i}:1)`);
    const result = stackFrames(errorWithStack(["TypeError: x", ...frames].join("\n"), "x"));
    expect(result).toHaveLength(5);
    expect(result.every((line) => line.length <= 160)).toBe(true);
    expect(stackFrames("boom")).toEqual([]);
  });
});

describe("errorAlertText", () => {
  it("маршрут, тип, назва, digest, середовище, коміт і стек — без тексту помилки", () => {
    const error = Object.assign(errorWithStack(`TypeError: ${SECRET_TEXT}\n    at f (src/a.ts:1:2)`), {
      digest: "12345",
    });
    const text = errorAlertText(error, ctx, {
      APP_ENV: "staging",
      VERCEL_GIT_COMMIT_REF: "staging",
      VERCEL_DEPLOYMENT_ID: "dpl_1",
      VERCEL_GIT_COMMIT_SHA: "abcdef1234",
    });
    expect(text).toContain("Середовище: staging (гілка staging)");
    expect(text).toContain("Маршрут: GET /requests/[id] (render, App Router)");
    expect(text).toContain("Помилка: TypeError, digest 12345");
    expect(text).toContain("коміт abcdef1");
    expect(text).toContain("at f (src/a.ts:1:2)");
    expect(text).not.toContain("MARKER-9c1e");
    expect(text).not.toContain("@example.test");
  });
});

describe("shouldSend", () => {
  it("та сама помилка на тому самому маршруті — не частіше разу на хвилину", () => {
    const seen = new Map<string, number>();
    const key = dedupeKey(new Error("x"), ctx);
    expect(shouldSend(key, 1_000, seen)).toBe(true);
    expect(shouldSend(key, 1_000 + SAME_ERROR_PAUSE_MS - 1, seen)).toBe(false);
    expect(shouldSend(key, 1_000 + SAME_ERROR_PAUSE_MS, seen)).toBe(true);
    expect(shouldSend(dedupeKey(new Error("x"), { ...ctx, routePath: "/other" }), 1_000, seen)).toBe(true);
  });
});

describe("sendErrorAlert", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("без TELEGRAM_* нічого не надсилає", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await sendErrorAlert(new Error("x"), ctx, {});
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("надсилає в чат лише chat_id і текст; збій мережі не кидає помилку далі", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);
    const env = { TELEGRAM_BOT_TOKEN: "t", TELEGRAM_CHAT_ID: "c" };
    await expect(
      sendErrorAlert(new Error(SECRET_TEXT), { ...ctx, routePath: "/send-test" }, env),
    ).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse((fetchMock.mock.calls[0] as [string, { body: string }])[1].body) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(["chat_id", "text"]);
    expect(String(body.text)).not.toContain("MARKER-9c1e");
  });
});
