// Декоративне тло сторінки входу: шкільне приладдя й закупівлі повільно погойдуються (DESIGN.md, розділ 7 — рух
// мінімальний). Лише прикраса: aria-hidden, без кліків, анімація — тільки за motion-safe.
import {
  Backpack,
  BookOpen,
  Calculator,
  ClipboardCheck,
  GraduationCap,
  NotebookPen,
  Package,
  Paperclip,
  Pencil,
  Ruler,
  Scissors,
  ShoppingBasket,
  type LucideIcon,
} from "lucide-react";
import type { CSSProperties } from "react";

type Item = { Icon: LucideIcon; top: string; left: string; size: number; tilt: number; delay: number };

// Позиції — по краях екрана, щоб не заходити під форму входу.
const ITEMS: Item[] = [
  { Icon: Pencil, top: "8%", left: "6%", size: 40, tilt: 8, delay: 0 },
  { Icon: BookOpen, top: "22%", left: "18%", size: 48, tilt: -6, delay: 1.5 },
  { Icon: Ruler, top: "64%", left: "5%", size: 44, tilt: 10, delay: 3 },
  { Icon: Backpack, top: "82%", left: "20%", size: 48, tilt: -5, delay: 4.5 },
  { Icon: Calculator, top: "44%", left: "10%", size: 36, tilt: 6, delay: 6 },
  { Icon: Paperclip, top: "90%", left: "44%", size: 32, tilt: -10, delay: 2 },
  { Icon: ShoppingBasket, top: "10%", left: "80%", size: 48, tilt: -8, delay: 0.8 },
  { Icon: ClipboardCheck, top: "30%", left: "90%", size: 40, tilt: 6, delay: 2.4 },
  { Icon: Package, top: "56%", left: "84%", size: 44, tilt: -6, delay: 3.8 },
  { Icon: NotebookPen, top: "78%", left: "92%", size: 40, tilt: 8, delay: 5.2 },
  { Icon: GraduationCap, top: "4%", left: "46%", size: 36, tilt: -4, delay: 7 },
  { Icon: Scissors, top: "70%", left: "72%", size: 32, tilt: 10, delay: 6.5 },
];

export function SchoolBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {ITEMS.map(({ Icon, top, left, size, tilt, delay }) => (
        <Icon
          key={`${top}-${left}`}
          size={size}
          strokeWidth={1.5}
          className="absolute text-primary opacity-15 motion-safe:animate-drift"
          // Від'ємна затримка — кожна іконка одразу в іншій фазі руху, без ривка на старті.
          style={{ top, left, animationDelay: `-${delay}s`, "--drift-tilt": `${tilt}deg` } as CSSProperties}
        />
      ))}
    </div>
  );
}
