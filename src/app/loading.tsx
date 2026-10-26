// Стан завантаження сторінки (DESIGN.md, розділ 6): поки сервер готує сторінку, видно її каркас — шапку, заголовок
// і картки, а не порожній екран. Лише вигляд: aria-busy і прихований текст для читачів екрана.
export default function Loading() {
  return (
    <div className="flex min-h-full flex-1 flex-col" aria-busy="true">
      <span className="sr-only" role="status">
        Loading…
      </span>
      <div className="border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-6 px-4 py-2 sm:px-6">
          <div className="size-8 rounded-lg bg-muted motion-safe:animate-pulse" />
          <div className="h-4 w-36 rounded bg-muted motion-safe:animate-pulse" />
          <div className="ml-auto size-10 rounded-full bg-muted motion-safe:animate-pulse" />
        </div>
      </div>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-2">
          <div className="h-7 w-64 rounded bg-muted motion-safe:animate-pulse" />
          <div className="h-4 w-48 rounded bg-muted motion-safe:animate-pulse" />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {[0, 1].map((card) => (
            <div key={card} className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="h-4 w-40 rounded bg-muted motion-safe:animate-pulse" />
              {[0, 1, 2].map((row) => (
                <div key={row} className="flex items-center justify-between gap-4">
                  <div className="flex flex-col gap-2">
                    <div className="h-4 w-32 rounded bg-muted motion-safe:animate-pulse" />
                    <div className="h-3 w-48 rounded bg-muted motion-safe:animate-pulse" />
                  </div>
                  <div className="h-6 w-28 rounded-full bg-muted motion-safe:animate-pulse" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
