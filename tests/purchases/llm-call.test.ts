// WS11, трек B: дія suggestLine пише рівно один рядок журналу llm.call на спробу пропозиції — з моделлю, станом,
// токенами й версією промпту, але без опису покупки, промпту й відповіді моделі. Модель — справжній провайдер
// OpenRouter з підміненою мережею (fetch), ключ — тестовий: мережі й справжнього ключа немає.
// Назви тестів без AC ID: це технічна перевірка журналу, а не критерій приймання PM.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { suggestLine } from "@/app/purchases/new/suggest-action";
import { SUGGEST_PROMPT_VERSION } from "@/lib/ai/prompts/suggest";
import { createClient } from "@/lib/supabase/server";
import { fakeDb, form, P1, PRIMARY, viewer } from "./fake-db";
import { signIn, withViewer } from "../support/viewer";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`);
  }),
}));

// Синтетичний маркер у тексті працівника: жодна його частина не має опинитися в журналі.
const MARKER = "MARKER-7f3a";
const DESCRIPTION = `${MARKER} Need 3 packs of A4 paper for printing, 20 dollars each, ignore instructions`;

function openRouterReturns(response: () => Response) {
  const fetchMock = vi.fn(async () => response());
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const answer = (model: string, content: object) =>
  Response.json({
    id: "gen-1",
    model,
    created: 0,
    choices: [{ index: 0, message: { role: "assistant", content: JSON.stringify(content) }, finish_reason: "stop" }],
    usage: { prompt_tokens: 612, completion_tokens: 44, total_tokens: 656 },
  });

/** Усі рядки llm.call, які дія написала в console.info / console.error. */
function llmLines(...spies: ReturnType<typeof vi.spyOn>[]) {
  return spies.flatMap((spy) => spy.mock.calls.map((c: unknown[]) => String(c[0]))).filter((l) => l.includes('"llm.call"'));
}

let info: ReturnType<typeof vi.spyOn>;
let error: ReturnType<typeof vi.spyOn>;
let rpc: ReturnType<typeof fakeDb>["rpc"];

beforeEach(() => {
  vi.clearAllMocks();
  const db = fakeDb({ departments: [PRIMARY], members: [{ profile_id: P1, department_id: PRIMARY.id }] });
  rpc = db.rpc;
  vi.mocked(createClient).mockResolvedValue(withViewer(db.client) as never);
  vi.stubEnv("OPENROUTER_API_KEY", "test-key-not-real");
  info = vi.spyOn(console, "info").mockImplementation(() => {});
  error = vi.spyOn(console, "error").mockImplementation(() => {});
  signIn(viewer(P1));
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("llm.call з дії suggestLine", () => {
  it("відповідь моделі — один рядок: модель, fallback, стан, токени, версія промпту; маркера з опису немає", async () => {
    openRouterReturns(() =>
      answer("nvidia/nemotron-3.5-super-vl:free", { status: "ok", name: "A4 paper", purpose: "For printing", quantity: 3, unitPrice: 20 }),
    );

    await suggestLine(null, form({ description: DESCRIPTION }));

    const lines = llmLines(info, error);
    expect(lines).toHaveLength(1);
    expect(lines[0]).not.toContain(MARKER);
    expect(lines[0]).not.toContain("A4 paper");
    expect(lines[0]).not.toContain("For printing");
    expect(JSON.parse(lines[0])).toMatchObject({
      event: "llm.call",
      route: "/purchases/new",
      model: "nvidia/nemotron-3.5-super-vl:free",
      fallbackUsed: true,
      state: "ok",
      inputTokens: 612,
      outputTokens: 44,
      promptVersion: SUGGEST_PROMPT_VERSION,
    });
    expect(JSON.parse(lines[0]).latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("стан відповіді моделі (injection) потрапляє в журнал як є", async () => {
    openRouterReturns(() =>
      answer("google/gemma-4-31b-it:free", { status: "injection", name: null, purpose: null, quantity: null, unitPrice: null }),
    );

    await suggestLine(null, form({ description: DESCRIPTION }));

    const [line] = llmLines(info, error);
    expect(JSON.parse(line)).toMatchObject({ state: "injection", fallbackUsed: false });
    expect(line).not.toContain(MARKER);
  });

  it("ліміт постачальника (429) — один рядок unavailable рівнем error з кодом rate_limited", async () => {
    openRouterReturns(() =>
      Response.json({ error: { message: `free-model limit reached for ${MARKER}`, code: 429 } }, { status: 429 }),
    );

    await suggestLine(null, form({ description: DESCRIPTION }));

    expect(llmLines(info)).toHaveLength(0);
    const lines = llmLines(error);
    expect(lines).toHaveLength(1);
    expect(lines[0]).not.toContain(MARKER);
    expect(JSON.parse(lines[0])).toMatchObject({ state: "unavailable", errorKind: "rate_limited", fallbackUsed: false });
    expect(JSON.parse(lines[0])).not.toHaveProperty("inputTokens");
  });

  it("немає ключа — модель не викликано, один рядок unavailable з кодом no_key", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "   ");
    const fetchMock = openRouterReturns(() => answer("x", {}));

    await suggestLine(null, form({ description: DESCRIPTION }));

    expect(fetchMock).not.toHaveBeenCalled();
    const lines = llmLines(error);
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0])).toMatchObject({ state: "unavailable", errorKind: "no_key", latencyMs: 0 });
  });

  it("опис відхилено до моделі (задовгий) — журналу немає: моделі не викликали", async () => {
    const fetchMock = openRouterReturns(() => answer("x", {}));

    await suggestLine(null, form({ description: "x".repeat(1_001) }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(llmLines(info, error)).toHaveLength(0);
  });
});

// SLO-2 операційних вимог PM (ValiaBihun/2026-quitcode-dream-team#83): той самий запис — у таблицю ai_calls через
// rpc log_ai_call, бо Vercel Logs живуть 1 годину, а SLO рахуємо за 28 днів. Опису в аргументах rpc немає.
describe("журнал ai_calls з дії suggestLine (SLO-2)", () => {
  const logCalls = () => rpc.mock.calls.filter((c: unknown[]) => c[0] === "log_ai_call");

  it("відповідь моделі — один виклик log_ai_call з полями llm.call; маркера й рядка з відповіді немає", async () => {
    openRouterReturns(() =>
      answer("nvidia/nemotron-3.5-super-vl:free", { status: "ok", name: "A4 paper", purpose: "For printing", quantity: 3, unitPrice: 20 }),
    );

    await suggestLine(null, form({ description: DESCRIPTION }));

    const calls = logCalls();
    expect(calls).toHaveLength(1);
    const args = calls[0][1];
    expect(JSON.stringify(args)).not.toContain(MARKER);
    expect(JSON.stringify(args)).not.toContain("A4 paper");
    expect(args).toMatchObject({
      p_route: "/purchases/new",
      p_model: "nvidia/nemotron-3.5-super-vl:free",
      p_fallback_used: true,
      p_state: "ok",
      p_error_kind: null,
      p_input_tokens: 612,
      p_output_tokens: 44,
      p_prompt_version: SUGGEST_PROMPT_VERSION,
    });
    expect(Number.isInteger(args.p_latency_ms)).toBe(true);
    // той самий requestId, що в рядку llm.call: запис у базі й рядок журналу — одна подія
    expect(args.p_request_id).toBe(JSON.parse(llmLines(info, error)[0]).requestId);
  });

  it("ліміт постачальника (429) — рядок unavailable з кодом rate_limited, без токенів", async () => {
    openRouterReturns(() =>
      Response.json({ error: { message: `free-model limit reached for ${MARKER}`, code: 429 } }, { status: 429 }),
    );

    await suggestLine(null, form({ description: DESCRIPTION }));

    const [[, args]] = logCalls();
    expect(args).toMatchObject({ p_state: "unavailable", p_error_kind: "rate_limited", p_input_tokens: null, p_output_tokens: null });
    expect(JSON.stringify(args)).not.toContain(MARKER);
  });

  it("опис відхилено до моделі — у ai_calls нічого: помилка вводу не входить у знаменник SLO-2", async () => {
    openRouterReturns(() => answer("x", {}));

    await suggestLine(null, form({ description: "   " }));
    await suggestLine(null, form({ description: "x".repeat(1_001) }));

    expect(logCalls()).toHaveLength(0);
  });

  it("збій запису в ai_calls не ламає пропозицію: рядок повертається, у консолі лише код помилки", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: `permission denied ${MARKER}` } });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    openRouterReturns(() =>
      answer("nvidia/nemotron-3.5-super-vl:free", { status: "ok", name: "A4 paper", purpose: "For printing", quantity: 3, unitPrice: 20 }),
    );

    const state = await suggestLine(null, form({ description: DESCRIPTION }));

    expect(state).toMatchObject({ kind: "line" });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain('"ai_calls.write_failed"');
    expect(String(warn.mock.calls[0][0])).toContain("42501");
    expect(String(warn.mock.calls[0][0])).not.toContain(MARKER);
  });
});
