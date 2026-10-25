#!/usr/bin/env node
// Архітектурне правило «вхід і роль перевіряє сервер» (ADR docs/decisions/0004-role-in-profiles-table.md).
// 1) Жодного getSession() у src/: на сервері сесію з cookie не перевірено, авторизація — лише getClaims().
// 2) Жодного src/middleware.ts: у Next.js 16 сесію оновлює src/proxy.ts, і він лише перенаправляє (UX), а не захищає.
// 3) Роль і права — лише з public.profiles: user_metadata / app_metadata у коді src/ не читаємо (користувач може
//    змінити user_metadata сам, а роль у токені застаріває до наступного входу).
// 4) Кожна експортована функція файлу з "use server" (Server Action — публічний POST-ендпойнт) перевіряє вхід до
//    першого звернення до бази: getViewer() / getClaims() / requireAdmin() раніше за createClient(). Виняток — дії, що
//    створюють чи завершують сесію (вхід, вихід): над функцією коментар `// auth-ok: <причина>`.
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
  const starts = code.flatMap((line, i) => (/^export\s+async\s+function\s+\w+/.test(line) ? [i] : []));
  starts.forEach((start, k) => {
    const name = code[start].match(/function\s+(\w+)/)[1];
    if (/^\s*\/\/\s*auth-ok:\s*\S/.test(rawLines[start - 1] ?? "")) return;
    const body = code.slice(start, starts[k + 1] ?? code.length);
    const auth = body.findIndex((l) => AUTH_CALL.test(l));
    const db = body.findIndex((l) => DB_CALL.test(l));
    if (auth < 0) report(file, start + 1, `${name}: Server Action без getViewer() / getClaims() / requireAdmin()`);
    else if (db >= 0 && db < auth) report(file, start + db + 1, `${name}: звернення до бази раніше за перевірку входу`);
  });
}

if (problems.length === 0) {
  console.log("check-auth-rules: OK — getClaims без getSession, без middleware.ts, роль з profiles, кожна дія перевіряє вхід.");
  process.exit(0);
}
for (const p of problems) console.log(p);
console.log(`\ncheck-auth-rules: ${problems.length} порушень. Правило — docs/decisions/0004-role-in-profiles-table.md.`);
process.exit(1);
