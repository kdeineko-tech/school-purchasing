"use client";

// Декоративна 3D-книга над формою входу: лежить розгорнута, сторінки гортаються в бік, куди веде миша; коли миша
// під книгою (на формі) чи поза сторінкою — книга повертається розкритою посередині. Лише прикраса: aria-hidden,
// без кліків; за prefers-reduced-motion не рухається. Кожна сторінка — ланцюжок вертикальних смужок, повернутих
// одна відносно одної (rotateY), тож аркуш вигинається під час перегортання, а не крутиться пласкою дощечкою.
import { type CSSProperties, useEffect, useRef } from "react";
import "./open-book.css";

const STRIPS = 16;
const POOL = 8; // скільки аркушів може бути в повітрі одночасно
// Товщина блоку сторінок з кожного боку. Стала: якщо один бік товщає, а другий худне, книга виглядає перекошеною.
const DEPTH = 10; // px
const STEP = 0.02; // умовна частка книги, яку переносить один аркуш
const EDGE = 0.12; // скільки книги лишається з кожного боку, коли миша тримає гортання

type Chain = { root: HTMLElement; strips: HTMLElement[]; faces: HTMLElement[] };
type Flight = { chain: Chain; p: number; dir: 1 | -1; dur: number };

const RAD = Math.PI / 180;

// Профіль аркуша, що лежить: круто здіймається від корінця, опуклий посередині й трохи спадає до зовнішнього краю.
const PROFILE = Array.from({ length: STRIPS }, (_, i) => Math.exp((-i / STRIPS) * 5) - 0.04);
// Біля корінця сторінки в м'якій тіні — так видно западину між ними.
const GUTTER = Array.from({ length: STRIPS }, (_, i) => {
  const x = Math.min(1, i / 5);
  return 0.72 + 0.28 * x * x * (3 - 2 * x);
});

// Кут біля корінця, за якого зовнішній край аркуша лягає на висоту блоку сторінок t.
function liftAngle(t: number, w: number) {
  let lo = 0;
  let hi = 89;
  for (let n = 0; n < 18; n++) {
    const a = (lo + hi) / 2;
    const h = PROFILE.reduce((sum, f) => sum + w * Math.sin(a * f * RAD), 0);
    if (h < t) lo = a;
    else hi = a;
  }
  return lo;
}

// Відносні кути смужок (у градусах) аркуша в положенні p: 0 — лежить праворуч, 1 — ліворуч.
function pageShape(p: number, dir: number, right: number, left: number, w: number, out: number[]) {
  const bend = Math.sin(Math.PI * p);
  const e = 0.5 - 0.5 * Math.cos(Math.PI * p);
  const lift = 0.6 + 3 * bend;
  const a = liftAngle(right + lift, w);
  const b = liftAngle(left + lift, w);
  let prev = 0;
  for (let i = 0; i < STRIPS; i++) {
    const r = a * PROFILE[i];
    const l = 180 - b * PROFILE[i];
    // Корінець веде, край аркуша відстає — так папір вигинається в повітрі.
    const x = i / (STRIPS - 1);
    const curl = bend * (18 - 70 * x * x);
    const abs = r + (l - r) * e + dir * curl;
    out[i] = abs - prev;
    prev = abs;
  }
}

const shade = new Array<number>(STRIPS).fill(0);

function applyShape(chain: Chain, rel: number[]) {
  let cum = 0;
  for (let i = 0; i < STRIPS; i++) {
    cum += rel[i];
    chain.strips[i].style.transform = `rotateY(${-rel[i]}deg)`;
    // Світло зверху: пласкі ділянки світлі, ті, що стоять «ребром», — темніші.
    shade[i] = 1 - (0.8 + 0.2 * Math.abs(Math.cos(cum * RAD))) * GUTTER[i];
  }
  // Межі смужок — середнє сусідніх, тож тінь іде суцільним градієнтом через увесь аркуш.
  for (let i = 0; i < STRIPS; i++) {
    const before = i === 0 ? shade[0] * 1.15 : (shade[i - 1] + shade[i]) / 2;
    const after = i === STRIPS - 1 ? shade[i] : (shade[i] + shade[i + 1]) / 2;
    chain.faces[i].style.setProperty("--s0", before.toFixed(3));
    chain.faces[i].style.setProperty("--s1", after.toFixed(3));
  }
}

// «Друкований текст» сторінки, намальований кодом: рядки зі «слів» різної довжини, абзаци з відступом і коротким
// останнім рядком. Рядки товсті, а проміжки між ними вузькі: під кутом книги тонкі смуги стискаються до часток
// пікселя й мерехтять, а такий текст читається як рівний сірий тон з нерівними краями — як справжня сторінка здалеку.
function textTexture(width: number, height: number, ink: string, seed: number) {
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return "none";
  ctx.scale(scale, scale);
  ctx.fillStyle = ink;
  ctx.globalAlpha = 0.26;
  let state = seed;
  const rand = () => (state = (state * 16807) % 2147483647) / 2147483647;
  const [left, right, top, bottom] = [width * 0.11, width * 0.89, height * 0.1, height * 0.88];
  const row = 4.4;
  let line = 0;
  let paragraph = 3 + Math.floor(rand() * 6);
  for (let y = top; y < bottom; y += row) {
    const last = line === paragraph - 1;
    const end = last ? left + (right - left) * (0.25 + 0.55 * rand()) : right;
    for (let x = left + (line === 0 ? 7 : 0); x < end - 3; ) {
      const word = Math.min(end - x, 3 + rand() * 14);
      ctx.fillRect(x, y, word, 3);
      x += word + 2.4;
    }
    line += 1;
    if (last) {
      line = 0;
      paragraph = 3 + Math.floor(rand() * 6);
    }
  }
  return `url(${canvas.toDataURL()})`;
}

function Strip({ i }: { i: number }) {
  return (
    <div className="book-strip" data-strip>
      <div className="book-face" data-face style={{ "--i": i } as CSSProperties} />
      {i + 1 < STRIPS ? <Strip i={i + 1} /> : null}
    </div>
  );
}

function Page() {
  return (
    <div className="book-page" data-page>
      <Strip i={0} />
    </div>
  );
}

function Stack({ side }: { side: "left" | "right" }) {
  return (
    <div className={`book-stack book-stack-${side}`} data-stack={side}>
      <div className="book-stack-front" />
      <div className="book-stack-side" />
    </div>
  );
}

export function OpenBook({ className }: { className?: string }) {
  const bookRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const book = bookRef.current;
    if (!book) return;
    const chains: Chain[] = [...book.querySelectorAll<HTMLElement>("[data-page]")].map((root) => ({
      root,
      strips: [...root.querySelectorAll<HTMLElement>("[data-strip]")],
      faces: [...root.querySelectorAll<HTMLElement>("[data-face]")],
    }));
    const [leftTop, rightTop, ...pool] = chains;
    const leftStack = book.querySelector<HTMLElement>('[data-stack="left"]')!;
    const rightStack = book.querySelector<HTMLElement>('[data-stack="right"]')!;
    const rel = new Array<number>(STRIPS).fill(0);

    // Колір «тексту» — токен book-ink; перемалювати, коли змінюється тема.
    const paintText = () => {
      const ink = getComputedStyle(book).getPropertyValue("--book-ink").trim();
      const textures = [1, 2, 3].map((seed) =>
        textTexture(book.offsetWidth / 2, book.offsetHeight, ink, seed * 7919),
      );
      chains.forEach((chain, n) => chain.root.style.setProperty("--book-text", textures[n % textures.length]));
    };
    paintText();
    const themeWatch = new MutationObserver(paintText);
    themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const scheme = window.matchMedia("(prefers-color-scheme: dark)");
    scheme.addEventListener("change", paintText);

    let s = 0.5; // умовна частка книги, що лежить ліворуч: межа гортання й повернення до середини
    let flights: Flight[] = [];
    let pointer: { x: number; y: number } | null = null;
    let cooldown = 0;
    let last = performance.now();
    let raf = 0;

    let clipFor = 0;
    // Зріз блоку сторінок спереду обрізаємо по вигину верхнього аркуша — інакше біля корінця він стирчить клином.
    const clipStacks = (w: number) => {
      if (w === clipFor) return;
      clipFor = w;
      const a = liftAngle(DEPTH + 0.6, w);
      const width = rightStack.offsetWidth;
      const curve: [number, number][] = [[0, 0]];
      let x = 0;
      let z = 0;
      for (const f of PROFILE) {
        x += w * Math.cos(a * f * RAD);
        z += w * Math.sin(a * f * RAD);
        curve.push([Math.min(x, width), Math.min(z, DEPTH)]);
      }
      const outline = [[width, 0], [width, DEPTH], ...curve.reverse()];
      const polygon = (mirror: boolean) =>
        `polygon(${outline.map(([px, pz]) => `${mirror ? width - px : px}px ${pz}px`).join(", ")})`;
      for (const [stack, mirror] of [[rightStack, false], [leftStack, true]] as const) {
        stack.style.setProperty("--t", `${DEPTH}px`);
        stack.querySelector<HTMLElement>(".book-stack-front")!.style.clipPath = polygon(mirror);
      }
    };

    const draw = () => {
      const w = book.offsetWidth / 2 / STRIPS;
      clipStacks(w);
      pageShape(1, 0, DEPTH, DEPTH, w, rel);
      applyShape(leftTop, rel);
      pageShape(0, 0, DEPTH, DEPTH, w, rel);
      applyShape(rightTop, rel);
      for (const chain of pool) chain.root.style.visibility = "hidden";
      for (const f of flights) {
        f.chain.root.style.visibility = "visible";
        pageShape(f.p, f.dir, DEPTH, DEPTH, w, rel);
        applyShape(f.chain, rel);
      }
    };

    const stopThemeWatch = () => {
      themeWatch.disconnect();
      scheme.removeEventListener("change", paintText);
    };

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      // Куди й як швидко гортати: dir 1 — аркуші йдуть справа наліво, -1 — зліва направо.
      const rect = book.getBoundingClientRect();
      let want: 1 | -1 | 0 = 0;
      let rate = 0;
      let dur = 1;
      let lo = EDGE;
      let hi = 1 - EDGE;
      const at = pointer && pointer.y <= rect.bottom ? pointer : null;
      const steering = at !== null;
      if (!at) {
        const gap = 0.5 - s;
        if (Math.abs(gap) > STEP / 2) {
          want = gap > 0 ? 1 : -1;
          rate = 8;
          dur = 0.75;
          lo = 0;
          hi = 1;
        }
      } else {
        const dx = (at.x - (rect.left + rect.width / 2)) / (rect.width / 2);
        const k = Math.min(1, Math.max(0, (Math.abs(dx) - 0.1) / 0.9));
        if (k > 0) {
          want = dx > 0 ? -1 : 1;
          rate = 1.2 + 5 * k;
          dur = 1.3 - 0.55 * k;
        }
      }

      // Миша змінила бік — аркуші в повітрі падають назад, звідки піднялися. Лише коли веде миша: повернення до
      // середини аркушів не розвертає, інакше напрямок щокадру перемикався б і аркуші застигали в повітрі.
      if (steering && want && flights.length && flights[0].dir !== want) {
        for (const f of flights) {
          s -= f.dir * STEP;
          f.dir = want;
        }
      }

      cooldown -= dt;
      const next = s + want * STEP;
      const free = pool.find((c) => !flights.some((f) => f.chain === c));
      // Новий аркуш — лише в той самий бік, що й ті, що вже летять, і не впритул до попереднього.
      const spaced = flights.every((f) => f.dir === want && (want === 1 ? f.p > 0.14 : f.p < 0.86));
      if (want && cooldown <= 0 && free && spaced && next >= lo && next <= hi) {
        flights.push({ chain: free, p: want === 1 ? 0 : 1, dir: want, dur });
        s = next;
        cooldown = 1 / rate;
      }

      for (const f of flights) f.p += (f.dir * dt) / f.dur;
      flights = flights.filter((f) => f.p > 0 && f.p < 1);

      draw();
      // Нічого не летить і нового аркуша не буде — книга в спокої: лишаємо останній кадр і не крутимо цикл
      // марно. Його знову запускає рух миші, вихід миші за сторінку чи зміна розміру.
      const resting = flights.length === 0 && !(want && next >= lo && next <= hi);
      raf = resting ? 0 : requestAnimationFrame(tick);
    };

    // За prefers-reduced-motion книга лежить розкритою посередині й не гортається; налаштування можна змінити й
    // на відкритій сторінці.
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const start = () => {
      if (reduced.matches) {
        draw();
        return;
      }
      if (raf) return;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    };
    const onReducedChange = () => {
      if (reduced.matches) {
        cancelAnimationFrame(raf);
        raf = 0;
        flights = [];
        s = 0.5;
      }
      start();
    };

    const onMove = (e: PointerEvent) => {
      pointer = e.pointerType === "mouse" ? { x: e.clientX, y: e.clientY } : null;
      start();
    };
    const onLeave = () => {
      pointer = null;
      start();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("resize", start);
    document.documentElement.addEventListener("mouseleave", onLeave);
    reduced.addEventListener("change", onReducedChange);
    start();
    return () => {
      cancelAnimationFrame(raf);
      stopThemeWatch();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("resize", start);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      reduced.removeEventListener("change", onReducedChange);
    };
  }, []);

  return (
    <div aria-hidden className={`book-scene pointer-events-none select-none ${className ?? ""}`}>
      <div ref={bookRef} className="book">
        <div className="book-cover" />
        <Stack side="left" />
        <Stack side="right" />
        <Page />
        <Page />
        {Array.from({ length: POOL }, (_, i) => (
          <Page key={i} />
        ))}
      </div>
    </div>
  );
}
