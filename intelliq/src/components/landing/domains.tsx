import { BookOpen, Box, Brain, Calculator, MemoryStick, Shapes, Zap, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** The seven cognitive domains: icon, accent pair (theme tokens, so they stay readable in both themes) and an abstract drawing. */
export type Domain = {
  k: "logical" | "abstract" | "numerical" | "verbal" | "spatial" | "memory" | "speed";
  icon: LucideIcon;
  c1: string;
  c2: string;
  /** Layout span on large screens (12 columns). */
  span: string;
  art: ReactNode;
};

// Strokes and fills take the card's own accent pair (--c1, --c2).
const s1 = "[stroke:var(--c1)]", s2 = "[stroke:var(--c2)]", f1 = "[fill:var(--c1)]", f2 = "[fill:var(--c2)]";

const art = {
  // a decision tree
  logical: (
    <svg viewBox="0 0 200 140" fill="none" strokeWidth="2" strokeLinecap="round">
      <path d="M22 70H78M78 70C108 70 108 32 138 32M78 70C108 70 108 108 138 108M138 32H178M138 108H178" className={s1} opacity=".7" />
      <path d="M138 32C158 32 158 70 178 70M138 108C158 108 158 70 178 70" className={s2} opacity=".35" strokeDasharray="3 6" />
      {[[22, 70, 7], [78, 70, 5], [138, 32, 5], [138, 108, 5], [178, 32, 4], [178, 108, 4], [178, 70, 4]].map(([x, y, r]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={r} className={`${f2} ${s2}`} fillOpacity=".3" />
      ))}
    </svg>
  ),
  // overlapping shapes
  abstract: (
    <svg viewBox="0 0 200 140" fill="none" strokeWidth="2" strokeLinejoin="round">
      <circle cx="70" cy="68" r="38" className={`${s1} ${f1}`} fillOpacity=".12" />
      <rect x="92" y="26" width="64" height="64" rx="8" transform="rotate(18 124 58)" className={`${s2} ${f2}`} fillOpacity=".1" />
      <path d="M50 124L100 64L150 124Z" className={`${s1} ${f2}`} fillOpacity=".12" opacity=".9" />
      <circle cx="162" cy="30" r="5" className={f1} opacity=".8" />
    </svg>
  ),
  // a number series
  numerical: (
    <svg viewBox="0 0 200 140" fill="none" strokeWidth="2" strokeLinecap="round">
      {[["2", 14], ["6", 56], ["18", 100], ["54", 146]].map(([v, x]) => (
        <text key={v} x={x} y="84" className={`${f1} font-display`} fontSize="30" fontWeight="700" opacity=".85">{v}</text>
      ))}
      {[30, 76, 124].map((x) => (
        <path key={x} d={`M${x - 6} 52Q${x + 8} 28 ${x + 22} 52`} className={s2} opacity=".7" />
      ))}
      <path d="M14 110H186" className={s1} opacity=".25" strokeDasharray="2 7" />
    </svg>
  ),
  // lines of text
  verbal: (
    <svg viewBox="0 0 200 140" fill="none">
      <text x="10" y="64" className={`${f2} font-display`} fontSize="78" fontWeight="700" opacity=".4">“</text>
      {[[62, 40, 120], [62, 62, 90], [62, 84, 108], [62, 106, 64]].map(([x, y, w], i) => (
        <rect key={y} x={x} y={y} width={w} height="9" rx="4.5" className={i % 2 ? f2 : f1} opacity={i % 2 ? 0.35 : 0.55} />
      ))}
    </svg>
  ),
  // an isometric cube
  spatial: (
    <svg viewBox="0 0 200 140" fill="none" strokeWidth="2" strokeLinejoin="round">
      <path d="M100 18L152 46L100 74L48 46Z" className={`${s1} ${f1}`} fillOpacity=".22" />
      <path d="M48 46L100 74V128L48 100Z" className={`${s2} ${f2}`} fillOpacity=".12" />
      <path d="M152 46L100 74V128L152 100Z" className={`${s1} ${f2}`} fillOpacity=".2" />
      <path d="M100 74V128M100 18V74" className={s2} opacity=".35" strokeDasharray="3 5" />
    </svg>
  ),
  // a grid of dots, some lit
  memory: (
    <svg viewBox="0 0 200 140" fill="none" strokeWidth="2">
      {Array.from({ length: 12 }, (_, i) => {
        const x = 34 + (i % 4) * 44, y = 30 + Math.floor(i / 4) * 40, lit = [1, 4, 6, 11].includes(i);
        return <circle key={i} cx={x} cy={y} r={lit ? 9 : 7} className={lit ? `${f1} twinkle` : s2} fillOpacity={lit ? 0.9 : 0} opacity={lit ? 1 : 0.45} style={{ animationDelay: `${i * 0.35}s` }} />;
      })}
    </svg>
  ),
  // a gauge
  speed: (
    <svg viewBox="0 0 200 140" fill="none" strokeWidth="3" strokeLinecap="round">
      <path d="M28 112A72 72 0 0 1 172 112" className={s1} opacity=".35" />
      <path d="M28 112A72 72 0 0 1 130 46" className={s2} />
      <path d="M100 112L138 66" className={s1} strokeWidth="4" />
      <circle cx="100" cy="112" r="8" className={f1} />
      {[0, 1, 2].map((i) => <path key={i} d={`M${8 + i * 6} ${40 + i * 16}H${34 + i * 6}`} className={s2} opacity={0.5 - i * 0.12} />)}
    </svg>
  ),
};

export const DOMAINS: Domain[] = [
  { k: "logical", icon: Brain, c1: "var(--blue)", c2: "var(--violet)", span: "lg:col-span-6", art: art.logical },
  { k: "abstract", icon: Shapes, c1: "var(--violet)", c2: "var(--mag)", span: "lg:col-span-3", art: art.abstract },
  { k: "numerical", icon: Calculator, c1: "var(--cyan)", c2: "var(--blue)", span: "lg:col-span-3", art: art.numerical },
  { k: "verbal", icon: BookOpen, c1: "var(--lav)", c2: "var(--mag)", span: "lg:col-span-3", art: art.verbal },
  { k: "spatial", icon: Box, c1: "var(--cyan)", c2: "var(--violet)", span: "lg:col-span-3", art: art.spatial },
  { k: "memory", icon: MemoryStick, c1: "var(--mag)", c2: "var(--blue)", span: "lg:col-span-3", art: art.memory },
  { k: "speed", icon: Zap, c1: "var(--cyan)", c2: "var(--mag)", span: "lg:col-span-3", art: art.speed },
];

/** Short domain names for chips and charts. */
export const DOMAIN_SHORT: Record<Domain["k"], { en: string; mn: string }> = {
  logical: { en: "Logical", mn: "Логик" },
  abstract: { en: "Abstract", mn: "Хийсвэр" },
  numerical: { en: "Numerical", mn: "Тооллын" },
  verbal: { en: "Verbal", mn: "Хэл зүйн" },
  spatial: { en: "Spatial", mn: "Орон зай" },
  memory: { en: "Memory", mn: "Ой" },
  speed: { en: "Speed", mn: "Хурд" },
};
