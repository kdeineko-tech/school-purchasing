import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runScript } from "./run-script";

// Регресійні тести правила scripts/check-auth-rules.mjs: кожен випадок — тимчасовий проєкт з одним файлом у src/.
const dirs: string[] = [];

function project(files: Record<string, string>) {
  const root = mkdtempSync(path.join(tmpdir(), "check-auth-rules-"));
  dirs.push(root);
  for (const [rel, text] of Object.entries(files)) {
    const file = path.join(root, rel);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, text);
  }
  return root;
}

const run = (files: Record<string, string>) => runScript("check-auth-rules.mjs", project(files));

const action = (body: string) => ({
  "src/app/x/actions.ts": `"use server";\nimport { redirect } from "next/navigation";\n${body}\n`,
});

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("scripts/check-auth-rules.mjs", () => {
  it("passes an action that checks the viewer and leaves before the database", () => {
    const { code, out } = run(
      action(`export async function save(formData: FormData) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  const supabase = await createClient();
}`),
    );
    expect(out).toContain("OK");
    expect(code).toBe(0);
  });

  it("passes a guard block that returns", () => {
    const { code } = run(
      action(`export async function save() {
  const viewer = await getViewer();
  if (!viewer) {
    return { error: "Not enough permissions" };
  }
  const supabase = await createClient();
}`),
    );
    expect(code).toBe(0);
  });

  it("fails on an empty guard block: if (!viewer) {}", () => {
    const { code, out } = run(
      action(`export async function save() {
  const viewer = await getViewer();
  if (!viewer) {}
  const supabase = await createClient();
}`),
    );
    expect(code).toBe(1);
    expect(out).toContain("save: гілка if (!viewer) не завершує дію");
  });

  it("fails on a guard that keeps going to the database: if (!viewer) createClient()", () => {
    const { code, out } = run(
      action(`export async function save() {
  const viewer = await getViewer();
  if (!viewer) createClient();
  const supabase = await createClient();
}`),
    );
    expect(code).toBe(1);
    expect(out).toContain("save: гілка if (!viewer) не завершує дію");
  });

  it("fails when getViewer() is called but its result is not checked", () => {
    const { code, out } = run(
      action(`export async function save() {
  await getViewer();
  const supabase = await createClient();
}`),
    );
    expect(code).toBe(1);
    expect(out).toContain("результат getViewer() не перевірено");
  });

  it("fails on an exported arrow action without an auth check", () => {
    const { code, out } = run(
      action(`export const save = async (formData: FormData) => {
  const supabase = await createClient();
};`),
    );
    expect(code).toBe(1);
    expect(out).toContain("save: Server Action без getViewer()");
  });

  it("fails when the database is reached before the auth check", () => {
    const { code, out } = run(
      action(`export async function save() {
  const supabase = await createClient();
  await requireAdmin();
}`),
    );
    expect(code).toBe(1);
    expect(out).toContain("save: звернення до бази раніше за перевірку входу");
  });

  it("allows an action marked auth-ok that really creates a session", () => {
    const { code } = run(
      action(`// auth-ok: дія створює сесію.
export async function login(formData: FormData) {
  const supabase = await createClient();
  await supabase.auth.signInWithPassword({ email: "a@example.test", password: "x" });
}`),
    );
    expect(code).toBe(0);
  });

  it("fails on auth-ok over an action without a session call", () => {
    const { code, out } = run(
      action(`// auth-ok: просто так.
export async function wipe() {
  const supabase = await createClient();
  await supabase.from("purchases").delete();
}`),
    );
    expect(code).toBe(1);
    expect(out).toContain("wipe: auth-ok дозволено лише для дій, що створюють або завершують сесію");
  });

  it("passes a guard whose block opens on the next line and returns", () => {
    const { code } = run(
      action(`export async function save() {
  const viewer = await getViewer();
  if (!viewer)
  {
    return { error: "Not enough permissions" };
  }
  const supabase = await createClient();
}`),
    );
    expect(code).toBe(0);
  });

  it("fails on a guard whose next-line block does not leave", () => {
    const { code, out } = run(
      action(`export async function save() {
  const viewer = await getViewer();
  if (!viewer)
  {
  }
  const supabase = await createClient();
}`),
    );
    expect(code).toBe(1);
    expect(out).toContain("save: гілка if (!viewer) не завершує дію");
  });

  it("passes a guard whose statement is on the next line", () => {
    const { code } = run(
      action(`export async function save() {
  const viewer = await getViewer();
  if (!viewer)
    redirect("/login");
  const supabase = await createClient();
}`),
    );
    expect(code).toBe(0);
  });

  it("fails on getSession(), user_metadata and src/middleware.ts", () => {
    const { code, out } = run({
      "src/lib/viewer.ts": `export async function v(s: any) {\n  await s.auth.getSession();\n  return s.user.user_metadata.role;\n}\n`,
      "src/middleware.ts": "export function middleware() {}\n",
    });
    expect(code).toBe(1);
    expect(out).toContain("getSession() — для авторизації лише getClaims()");
    expect(out).toContain("не з user_metadata / app_metadata");
    expect(out).toContain("middleware.ts не використовуємо");
  });

  it("ignores comments", () => {
    const { code } = run({ "src/lib/a.ts": "// getSession() і user_metadata — лише в коментарі\nexport const a = 1;\n" });
    expect(code).toBe(0);
  });
});
