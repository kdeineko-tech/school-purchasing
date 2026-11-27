// D0: /api/health відрізняє «база відповіла» від «база недоступна, призупинена чи ключ хибний».
import { describe, expect, it } from "vitest";
import { appEnvFrom, classifyDbProbe, supabaseRefFromUrl } from "@/lib/health";

describe("classifyDbProbe (/api/health)", () => {
  it("рахує базу живою, коли запит пройшов або Postgres відмовив у правах (42501)", () => {
    expect(classifyDbProbe({ status: 200, error: null })).toEqual({ db: "ok", reason: "" });
    expect(classifyDbProbe({ status: 401, error: { code: "42501", message: "permission denied for table profiles" } })).toEqual({
      db: "ok",
      reason: "",
    });
    expect(classifyDbProbe({ status: 400, error: { code: "PGRST100", message: "bad filter" } }).db).toBe("ok");
  });

  it("повідомляє «paused», коли Supabase відповідає 540 (безкоштовний проєкт призупинено)", () => {
    expect(classifyDbProbe({ status: 540, error: { message: "project paused" } })).toEqual({ db: "down", reason: "paused" });
  });

  it("повідомляє про хибний публічний ключ", () => {
    expect(classifyDbProbe({ status: 401, error: { message: "Invalid API key" } })).toEqual({
      db: "down",
      reason: "invalid-api-key",
    });
  });

  it("повідомляє код, коли PostgREST не дістає до бази або мережі немає", () => {
    expect(classifyDbProbe({ status: 503, error: { code: "PGRST002", message: "schema cache" } })).toEqual({
      db: "down",
      reason: "status-503-PGRST002",
    });
    expect(classifyDbProbe({ status: 0, error: { message: "fetch failed" } })).toEqual({ db: "down", reason: "status-0" });
  });

  it("не рахує базу живою за відповіді 5xx, навіть з кодом PostgREST (PGRST300 — конфігурація JWT)", () => {
    expect(classifyDbProbe({ status: 500, error: { code: "PGRST300", message: "JWT secret" } })).toEqual({
      db: "down",
      reason: "status-500-PGRST300",
    });
    expect(classifyDbProbe({ status: 500, error: { code: "XX000", message: "internal" } }).db).toBe("down");
  });

  it("не рахує базу живою, коли PostgREST відхилив JWT ключа (PGRST301, PGRST303)", () => {
    expect(classifyDbProbe({ status: 401, error: { code: "PGRST301", message: "JWT expired" } })).toEqual({
      db: "down",
      reason: "status-401-PGRST301",
    });
    expect(classifyDbProbe({ status: 401, error: { code: "PGRST303", message: "JWT claims" } }).db).toBe("down");
  });
});

// WS11: staging — по /api/health видно середовище (APP_ENV) і базу (ref проєкту Supabase).
describe("supabaseRefFromUrl (/api/health, поле supabaseRef)", () => {
  it("бере ref — перший сегмент хоста https://<ref>.supabase.co", () => {
    expect(supabaseRefFromUrl("https://abcdefghijklmnopqrst.supabase.co")).toBe("abcdefghijklmnopqrst");
    expect(supabaseRefFromUrl("https://abcdefghijklmnopqrst.supabase.co/")).toBe("abcdefghijklmnopqrst");
  });

  it("повертає null без змінної, для локального Supabase і для адреси не того вигляду", () => {
    expect(supabaseRefFromUrl(undefined)).toBeNull();
    expect(supabaseRefFromUrl("")).toBeNull();
    expect(supabaseRefFromUrl("http://127.0.0.1:54321")).toBeNull();
    expect(supabaseRefFromUrl("https://abcdefghijklmnopqrst.supabase.co.evil.example")).toBeNull();
    expect(supabaseRefFromUrl("not a url")).toBeNull();
  });
});

describe("appEnvFrom (/api/health, поле appEnv)", () => {
  it("повертає значення APP_ENV, а без нього — null", () => {
    expect(appEnvFrom("staging")).toBe("staging");
    expect(appEnvFrom(" staging\n")).toBe("staging");
    expect(appEnvFrom(undefined)).toBeNull();
    expect(appEnvFrom("  ")).toBeNull();
  });
});
