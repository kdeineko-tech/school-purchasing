// WS11: UAT на розгорнутій адресі пише синтетичні дані лише в ту базу, у яку дивиться застосунок (scripts/uat/target.mjs).
import { describe, expect, it } from "vitest";
import { bypassHeaders, supabaseRef, targetMismatch } from "../scripts/uat/target.mjs";

const STAGING = "https://aaaaaaaaaaaaaaaaaaaa.supabase.co";
const PROD = "https://bbbbbbbbbbbbbbbbbbbb.supabase.co";

describe("targetMismatch: запобіжник UAT перед першим записом", () => {
  it("пропускає, коли /api/health цільової адреси і .env.local — той самий проєкт", () => {
    expect(targetMismatch({ health: { supabaseRef: "aaaaaaaaaaaaaaaaaaaa" }, localUrl: STAGING })).toBeNull();
  });

  it("зупиняє, коли застосунок дивиться в іншу базу, ніж .env.local", () => {
    expect(targetMismatch({ health: { supabaseRef: "bbbbbbbbbbbbbbbbbbbb" }, localUrl: STAGING })).toMatch(
      /bbbbbbbbbbbbbbbbbbbb.*aaaaaaaaaaaaaaaaaaaa/,
    );
  });

  it("зупиняє, коли health не повідомляє supabaseRef або не відповів", () => {
    expect(targetMismatch({ health: { ok: true, sha: "x" }, localUrl: PROD })).toMatch(/supabaseRef/);
    expect(targetMismatch({ health: null, localUrl: PROD })).toMatch(/supabaseRef/);
  });

  it("зупиняє, коли в .env.local немає адреси Supabase хмари", () => {
    expect(targetMismatch({ health: { supabaseRef: "aaaaaaaaaaaaaaaaaaaa" }, localUrl: undefined })).toMatch(/NEXT_PUBLIC_SUPABASE_URL/);
    expect(targetMismatch({ health: { supabaseRef: "aaaaaaaaaaaaaaaaaaaa" }, localUrl: "http://127.0.0.1:54321" })).toMatch(
      /NEXT_PUBLIC_SUPABASE_URL/,
    );
  });

  it("supabaseRef бере ref лише з https://<ref>.supabase.co", () => {
    expect(supabaseRef(PROD)).toBe("bbbbbbbbbbbbbbbbbbbb");
    expect(supabaseRef("https://bbbbbbbbbbbbbbbbbbbb.supabase.co.evil.example")).toBeNull();
  });
});

describe("bypassHeaders: обхід захисту Vercel лише за наявної змінної", () => {
  it("без VERCEL_AUTOMATION_BYPASS_SECRET — жодних заголовків", () => {
    expect(bypassHeaders({})).toEqual({});
    expect(bypassHeaders({ VERCEL_AUTOMATION_BYPASS_SECRET: " " })).toEqual({});
  });

  it("зі змінною — заголовок обходу і cookie для переходів сторінками", () => {
    expect(bypassHeaders({ VERCEL_AUTOMATION_BYPASS_SECRET: "test-bypass" })).toEqual({
      "x-vercel-protection-bypass": "test-bypass",
      "x-vercel-set-bypass-cookie": "true",
    });
  });
});
