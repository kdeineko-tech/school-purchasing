// WS11 (трек B, R06): трекер помилок сервера без Sentry — коротке повідомлення в той самий Telegram-чат, що й алерт
// smoke. Шаблон — materials/ops-kit/src/instrumentation.ts.example курсу; підключення — src/instrumentation.ts.
//
// Що НЕ надсилаємо ніколи: заголовки запиту (там cookie сесії), тіло запиту, рядок запиту (?query), шлях з id
// (лише шаблон маршруту routePath) і error.message (може містити дані користувача). Зі стеку — лише рядки «at …».
// Повний стек — у Runtime Logs Vercel (на Hobby — 1 година) за digest чи часом і маршрутом.
// Секрети (лише назви): TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID — серверні змінні Vercel (Production і Preview), без
// NEXT_PUBLIC_. Немає змінних — нічого не надсилаємо.
// Підписи повідомлення — англійською: у src/ не має бути кирилиці поза коментарями (тест AC-LANG-01).

export const STACK_FRAMES = 5;
export const SAME_ERROR_PAUSE_MS = 60_000; // та сама помилка на тому самому маршруті — не частіше разу на хвилину
const TIMEOUT_MS = 2_500; // Telegram недоступний — повідомлення пропадає, відповідь користувачу не чекає
const FRAME_MAX = 160;

export type ErrorContext = {
  method: string;
  routePath: string;
  routeType: string;
  routerKind: string;
};

export type DeployEnv = Record<string, string | undefined>;

/**
 * Лише рядки «at … файл:рядок:колонка» зі стеку. Заголовок «Назва: текст помилки» відрізаємо цілим (текст може бути
 * багаторядковим і містити дані користувача), абсолютний шлях скорочуємо до .next/…, src/… чи node_modules/…, а будь-який
 * інший — до назви файла, щоб у чат не потрапили каталоги й ім'я користувача ОС з локального шляху.
 */
export function stackFrames(error: unknown): string[] {
  if (!(error instanceof Error) || typeof error.stack !== "string") return [];
  const header = error.message ? `${error.name}: ${error.message}` : error.name;
  const body = error.stack.startsWith(header)
    ? error.stack.slice(header.length)
    : error.stack.split("\n").slice(header.split("\n").length).join("\n");
  return body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("at ") && /:\d+:\d+\)?$/.test(line))
    .map((line) => line.replace(/(?:[A-Za-z]:)?[\\/][^\s()]*?[\\/](\.next|src|node_modules)[\\/]/g, "$1/"))
    // Решта абсолютних шляхів (поза .next, src, node_modules) — лише назва файла з рядком і колонкою.
    .map((line) => line.replace(/(^at |\()(?:file:\/\/)?(?:[A-Za-z]:)?[\\/][^\s()]*[\\/]([^\\/\s()]+:\d+:\d+\)?)$/, "$1$2"))
    .slice(0, STACK_FRAMES)
    .map((line) => line.slice(0, FRAME_MAX));
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : typeof error;
}

function errorDigest(error: unknown): string {
  const raw = (error as { digest?: unknown } | null)?.digest;
  return typeof raw === "string" ? raw.slice(0, 40) : "";
}

/**
 * Ключ для паузи між однаковими повідомленнями: маршрут + digest; без digest — назва помилки й очищені рядки стеку
 * (не error.message), щоб різні помилки одного класу на тому самому маршруті не глушили одна одну.
 */
export function dedupeKey(error: unknown, ctx: ErrorContext): string {
  const fingerprint = errorDigest(error) || [errorName(error), ...stackFrames(error)].join("\n");
  return `${ctx.routePath}|${fingerprint}`;
}

/** Текст повідомлення: маршрут, тип, метод, назва помилки, digest, середовище, деплой, до 5 рядків стеку. */
export function errorAlertText(error: unknown, ctx: ErrorContext, env: DeployEnv): string {
  const name = errorName(error);
  const digest = errorDigest(error);
  const where = env.APP_ENV ?? env.VERCEL_ENV ?? "local"; // APP_ENV=staging — змінна лише для гілки staging
  const branch = env.VERCEL_GIT_COMMIT_REF;
  const frames = stackFrames(error);
  return [
    "SERVER ERROR",
    `Environment: ${where}${branch ? ` (branch ${branch})` : ""}`,
    `Route: ${ctx.method} ${ctx.routePath} (${ctx.routeType}, ${ctx.routerKind})`,
    `Error: ${name}${digest ? `, digest ${digest}` : ""}`,
    `Deploy: ${env.VERCEL_DEPLOYMENT_ID ?? "?"}, commit ${(env.VERCEL_GIT_COMMIT_SHA ?? "local").slice(0, 7)}`,
    ...(frames.length ? ["Stack (top frames):", ...frames] : []),
  ].join("\n");
}

const lastSent = new Map<string, number>();

/** Чи надсилати зараз: та сама помилка на тому самому маршруті — не частіше разу на SAME_ERROR_PAUSE_MS. */
export function shouldSend(key: string, now: number, seen: Map<string, number> = lastSent): boolean {
  if (now - (seen.get(key) ?? Number.NEGATIVE_INFINITY) < SAME_ERROR_PAUSE_MS) return false;
  seen.set(key, now);
  return true;
}

export async function sendErrorAlert(error: unknown, ctx: ErrorContext, env: DeployEnv = process.env): Promise<void> {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  if (!shouldSend(dedupeKey(error, ctx), Date.now())) return;

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: errorAlertText(error, ctx, env) }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    // Навмисно нічого не пишемо: помилка fetch містить адресу запиту, а в ній — токен бота.
  }
}
