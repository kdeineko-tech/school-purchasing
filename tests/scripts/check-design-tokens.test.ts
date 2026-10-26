import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runScript } from "./run-script";

// Регресійні тести правила scripts/check-design-tokens.mjs: кожен випадок — тимчасовий проєкт з файлами в src/.
const dirs: string[] = [];

function project(files: Record<string, string>) {
  const root = mkdtempSync(path.join(tmpdir(), "check-design-tokens-"));
  dirs.push(root);
  for (const [rel, text] of Object.entries(files)) {
    const file = path.join(root, rel);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, text);
  }
  return root;
}

const page = (jsx: string) => ({ "src/app/page.tsx": `export default function Page() {\n  return ${jsx};\n}\n` });

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    chmodSync(dir, 0o755);
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("scripts/check-design-tokens.mjs", () => {
  it("passes semantic token classes", () => {
    const { code, out } = runScript(
      "check-design-tokens.mjs",
      project(page(`<p className="bg-primary text-primary-foreground">a</p>`)),
    );
    expect(out).toContain("OK");
    expect(code).toBe(0);
  });

  it("fails on a string color in inline style", () => {
    const { code, out } = runScript("check-design-tokens.mjs", project(page(`<p style={{ color: "red" }}>a</p>`)));
    expect(out).toContain(`[inline-style-color]  color: "red"`);
    expect(code).toBe(1);
  });

  it("fails on a color given by an expression in inline style", () => {
    const { code, out } = runScript(
      "check-design-tokens.mjs",
      project(page(`<p style={{ backgroundColor: statusColor, padding: 4 }}>a</p>`)),
    );
    expect(out).toContain("[inline-style-color]  backgroundColor: statusColor ");
    expect(code).toBe(1);
  });

  it("passes a token via var(--…) in inline style", () => {
    const { code } = runScript(
      "check-design-tokens.mjs",
      project(page(`<p style={{ color: "var(--primary)", background: \`var(--card)\` }}>a</p>`)),
    );
    expect(code).toBe(0);
  });

  it("passes a class map outside style={{ … }}", () => {
    const { code } = runScript(
      "check-design-tokens.mjs",
      project({ "src/lib/status.ts": `export const S = { label: "Approved", color: someClass };\n` }),
    );
    expect(code).toBe(0);
  });

  it.skipIf(process.platform === "win32" || process.getuid?.() === 0)(
    "fails with a clear message when a folder cannot be read",
    () => {
      const root = project(page(`<p>a</p>`));
      chmodSync(path.join(root, "src", "app"), 0o000);
      try {
        const { code, out } = runScript("check-design-tokens.mjs", root);
        expect(out).toContain("не вдалося прочитати src/app");
        expect(out).not.toContain("OK");
        expect(code).toBe(2);
      } finally {
        chmodSync(path.join(root, "src", "app"), 0o755);
      }
    },
  );
});
