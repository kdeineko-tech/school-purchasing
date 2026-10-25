import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { NoAccess } from "@/app/admin/no-access";
import LoginPage from "@/app/login/page";
import { MESSAGES } from "@/lib/org/messages";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

const CYRILLIC = /[А-Яа-яІіЇїЄєҐґ]/;

// Код без коментарів: коментарі для розробника лишаються українською, користувач їх не бачить.
function withoutComments(code: string) {
  return code
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

function loginProps(error?: string) {
  return { params: Promise.resolve({}), searchParams: Promise.resolve(error ? { error } : {}) } as never;
}

describe("інтерфейс англійською", () => {
  it("AC-LANG-01: у текстах сторінок, компонентів і повідомлень немає жодного українського слова", () => {
    const files = execSync("git ls-files src", { encoding: "utf8" })
      .split("\n")
      .filter((f) => /\.(ts|tsx)$/.test(f) && !f.endsWith("database.types.ts"));
    expect(files.length).toBeGreaterThan(0);

    const ukrainian = files.flatMap((file) =>
      withoutComments(readFileSync(file, "utf8"))
        .split("\n")
        .map((line, i) => ({ where: `${file}:${i + 1}`, line: line.trim() }))
        .filter(({ line }) => CYRILLIC.test(line)),
    );
    expect(ukrainian).toEqual([]);
  });

  it("AC-LANG-02: сторінку входу показано англійською", async () => {
    const html = renderToStaticMarkup(await LoginPage(loginProps()));

    expect(html).toContain("Sign in");
    expect(html).toContain("Password");
    expect(html).not.toMatch(CYRILLIC);
  });

  it("AC-LANG-02: повідомлення про неправильні дані для входу англійською", async () => {
    const html = renderToStaticMarkup(await LoginPage(loginProps("invalid")));

    expect(html).toContain("Invalid email or password.");
    expect(html).not.toMatch(CYRILLIC);
  });

  it("AC-LANG-03: працівник без права бачить «Not enough permissions» замість «Недостатньо прав»", () => {
    const html = renderToStaticMarkup(createElement(NoAccess));

    expect(MESSAGES.forbidden).toBe("Not enough permissions");
    expect(html).toContain("Not enough permissions");
    expect(html).not.toMatch(CYRILLIC);
  });
});
