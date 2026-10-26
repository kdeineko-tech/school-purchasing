#!/usr/bin/env node
// Архітектурне правило «вхід і роль перевіряє сервер» (ADR docs/decisions/0004-role-in-profiles-table.md).
// 1) Жодного getSession() у src/: на сервері сесію з cookie не перевірено, авторизація — лише getClaims().
// 2) Жодного src/middleware.ts: у Next.js 16 сесію оновлює src/proxy.ts, і він лише перенаправляє (UX), а не захищає.
// 3) Роль і права — лише з public.profiles: user_metadata / app_metadata у коді src/ не читаємо (користувач може
//    змінити user_metadata сам, а роль у токені застаріває до наступного входу).
// 4) Кожна експортована функція файлу з "use server" (Server Action — публічний POST-ендпойнт; і `export async
//    function`, і `export const x = async …`) перевіряє вхід до першого звернення до бази: getViewer() / getClaims() /
//    requireAdmin() раніше за createClient(). Результат getViewer() зберігають у змінну й перевіряють
//    (`if (!viewer)`) теж раніше за createClient(), і гілка завершує дію (return / throw / redirect / notFound): сам
//    виклик без перевірки нікого не зупиняє. Виняток — дії, що створюють чи завершують сесію (вхід, вихід): над
//    функцією коментар `// auth-ok: <причина>`, і в тілі є виклик auth.signInWithPassword / signInWithOtp / verifyOtp /
//    signUp / exchangeCodeForSession / signOut.
// Коментарі не перевіряються. Використання: node scripts/check-auth-rules.mjs [--root <dir>]
// Код виходу: 0 — порушень немає, 1 — є порушення, 2 — немає теки src/.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const args = process.argv.slice(2);
const rootIdx = args.indexOf("--root");
const root = rootIdx >= 0 ? args[rootIdx + 1] : process.cwd();
const src = join(root, "src");
if (!existsSync(src)) {
  console.error(`check-auth-rules: у ${root} немає теки src/ — вкажіть --root <корінь проєкту>.`);
  process.exit(2);
}

const EXT = /\.(tsx?|jsx?|mjs|cjs)$/;
const AUTH_CALL = /\b(getViewer|getClaims|requireAdmin)\s*\(/;
const DB_CALL = /\bcreateClient\s*\(/;
const SESSION_CALL = /\bauth\.(signInWithPassword|signInWithOtp|verifyOtp|signUp|exchangeCodeForSession|signOut)\s*\(/;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (EXT.test(name)) out.push(full);
  }
  return out;
}

// Код без коментарів, з тими самими номерами рядків (коментар → пробіли).
function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:"'`])\/\/.*$/gm, (m, p) => p + " ".repeat(m.length - p.length));
}

// Чи завершує дію гілка `if (!viewer)`: return, throw, redirect(…) чи notFound() — в однорядковій формі в тому самому
// рядку (або в наступному, якщо дужок немає), у формі з блоком — до закривної дужки. Евристика: знаходить вихід, але
// не доводить, що він виконається завжди (умову в гілці правило не аналізує).
const EXIT = /\b(return|throw)\b|\bredirect\s*\(|\bnotFound\s*\(/;
function guardExits(body, at) {
  const line = body[at];
  const condEnd = closingParen(line, line.search(/if\s*\(/) + line.slice(line.search(/if\s*\(/)).indexOf("("));
  let rest = condEnd >= 0 ? line.slice(condEnd + 1) : "";
  let from = at;
  // Після умови в тому самому рядку порожньо — гілка починається з наступного непорожнього рядка (`{` чи інструкція).
  if (!rest.trim()) {
    const next = body.findIndex((l, j) => j > at && l.trim());
    if (next < 0) return false;
    rest = body[next];
    from = next;
  }
  if (!rest.trim().startsWith("{")) return EXIT.test(rest);
  let depth = 0;
  let text = "";
  for (let j = from; j < body.length; j++) {
    const chunk = j === from ? rest : body[j];
    for (const ch of chunk) {
      text += ch;
      if (ch === "{") depth++;
      if (ch === "}" && --depth === 0) return EXIT.test(text);
    }
    text += "\n";
  }
  return EXIT.test(text);
}

// Позиція дужки, що закриває «(» на позиції open.
function closingParen(line, open) {
  let depth = 0;
  for (let i = open; i < line.length; i++) {
    if (line[i] === "(") depth++;
    if (line[i] === ")" && --depth === 0) return i;
  }
  return -1;
}

// Назва експортованої Server Action у рядку: `export async function x`, `export default async function x`,
// `export const x = async …` (з типом чи без).
function exportedActionName(line) {
  const fn = line.match(/^export\s+(?:default\s+)?async\s+function\s*(\w*)/);
  if (fn) return fn[1] || "default";
  const arrow = line.match(/^export\s+(?:const|let)\s+(\w+)\s*(?::[^=]+)?=\s*async\b/);
  return arrow ? arrow[1] : null;
}

const problems = [];
const report = (file, line, message) =>
  problems.push(`${relative(root, file).split(sep).join("/")}:${line}  ${message}`);

if (existsSync(join(src, "middleware.ts"))) {
  report(join(src, "middleware.ts"), 1, "middleware.ts не використовуємо: у Next.js 16 — src/proxy.ts, і він лише перенаправляє");
}

for (const file of walk(src)) {
  const raw = readFileSync(file, "utf8");
  const rawLines = raw.split(/\r?\n/);
  const code = stripComments(raw).split(/\r?\n/);

  code.forEach((line, i) => {
    if (/\bgetSession\s*\(/.test(line)) report(file, i + 1, "getSession() — для авторизації лише getClaims()");
    if (/\b(user_metadata|app_metadata)\b/.test(line)) {
      report(file, i + 1, "роль і права — лише з public.profiles, не з user_metadata / app_metadata");
    }
  });

  if (!/^\s*["']use server["']/m.test(raw)) continue;
  const starts = code.flatMap((line, i) => {
    const name = exportedActionName(line);
    return name ? [{ i, name }] : [];
  });
  starts.forEach(({ i: start, name }, k) => {
    const body = code.slice(start, starts[k + 1]?.i ?? code.length);
    // Виняток лише для дій, що справді створюють чи завершують сесію: сам коментар без сесійного виклику не рахується.
    if (/^\s*\/\/\s*auth-ok:\s*\S/.test(rawLines[start - 1] ?? "")) {
      if (!body.some((l) => SESSION_CALL.test(l))) {
        report(file, start + 1, `${name}: auth-ok дозволено лише для дій, що створюють або завершують сесію`);
      }
      return;
    }
    const auth = body.findIndex((l) => AUTH_CALL.test(l));
    const db = body.findIndex((l) => DB_CALL.test(l));
    if (auth < 0) {
      report(file, start + 1, `${name}: Server Action без getViewer() / getClaims() / requireAdmin()`);
      return;
    }
    if (db >= 0 && db < auth) {
      report(file, start + db + 1, `${name}: звернення до бази раніше за перевірку входу`);
      return;
    }
    // getViewer() повертає null для гостя: результат має бути збережено й перевірено раніше за createClient().
    if (/\bgetViewer\s*\(/.test(body[auth])) {
      const assigned = body[auth].match(/\b(?:const|let)\s+(\w+)\s*=\s*await\s+getViewer\s*\(/);
      const checked = assigned
        ? body.findIndex((l, j) => j > auth && new RegExp(`if\\s*\\(\\s*!\\s*${assigned[1]}\\b`).test(l))
        : -1;
      if (checked < 0 || (db >= 0 && db < checked)) {
        report(file, start + auth + 1, `${name}: результат getViewer() не перевірено (if (!viewer)) до звернення до бази`);
      } else if (!guardExits(body, checked)) {
        report(
          file,
          start + checked + 1,
          `${name}: гілка if (!viewer) не завершує дію — потрібні return, throw, redirect(…) чи notFound()`,
        );
      }
    }
  });
}

if (problems.length === 0) {
  console.log("check-auth-rules: OK — getClaims без getSession, без middleware.ts, роль з profiles, кожна дія перевіряє вхід.");
  process.exit(0);
}
for (const p of problems) console.log(p);
console.log(`\ncheck-auth-rules: ${problems.length} порушень. Правило — docs/decisions/0004-role-in-profiles-table.md.`);
process.exit(1);
