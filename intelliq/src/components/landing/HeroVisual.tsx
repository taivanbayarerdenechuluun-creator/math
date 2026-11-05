"use client";
import { useEffect } from "react";
import { motion, useMotionValue, useScroll, useSpring, useTransform } from "framer-motion";
import { BrainCircuit, MemoryStick, Zap } from "lucide-react";
import { useApp } from "../Providers";

// Two mirrored "hemispheres" of nodes joined by a central axis: an abstract, brain-inspired network.
const LEFT: [number, number][] = [[170, 138], [112, 200], [134, 282], [202, 336], [208, 214], [168, 252], [214, 150]];
const RIGHT = LEFT.map(([x, y]) => [520 - x, y] as [number, number]);
const HUB: [number, number][] = [[260, 196], [260, 268], [260, 330]];
const NODES = [...LEFT, ...RIGHT, ...HUB]; // 0-6 left, 7-13 right, 14-16 axis
const HEMI: [number, number][] = [[0, 1], [1, 2], [2, 3], [0, 6], [6, 4], [4, 5], [5, 3], [1, 4], [2, 5], [0, 4]];
const EDGES: [number, number][] = [
  ...HEMI,
  ...HEMI.map(([a, b]) => [a + 7, b + 7] as [number, number]),
  [4, 14], [11, 14], [5, 15], [12, 15], [3, 16], [10, 16], [14, 15], [15, 16], [6, 14], [13, 14],
];
const TONES = ["--blue", "--violet", "--cyan", "--mag", "--lav"];

const orbit = (r: number, deg: number): [number, number] => [
  Number((260 + r * Math.cos((deg * Math.PI) / 180)).toFixed(1)),
  Number((260 + r * Math.sin((deg * Math.PI) / 180)).toFixed(1)),
];

const SYMBOLS = [
  { v: "∑", x: "7%", y: "14%", d: 0 },
  { v: "π", x: "86%", y: "10%", d: 1.2 },
  { v: "∞", x: "93%", y: "58%", d: 2.1 },
  { v: "√", x: "3%", y: "66%", d: 1.6 },
  { v: "29", x: "47%", y: "-3%", d: 0.6 },
  { v: "÷", x: "80%", y: "90%", d: 2.6 },
  { v: "7", x: "20%", y: "94%", d: 0.9 },
];

export function HeroVisual() {
  const { tt } = useApp();
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 55, damping: 18 });
  const sy = useSpring(my, { stiffness: 55, damping: 18 });
  // Three depth layers move by different amounts with the pointer; the whole visual drifts up slightly on scroll.
  const backX = useTransform(sx, (v) => v * -12), backY = useTransform(sy, (v) => v * -12);
  const midX = useTransform(sx, (v) => v * 16), midY = useTransform(sy, (v) => v * 16);
  const frontX = useTransform(sx, (v) => v * 34), frontY = useTransform(sy, (v) => v * 34);
  const { scrollY } = useScroll();
  const lift = useTransform(scrollY, [0, 700], [0, -64]);

  useEffect(() => {
    if (!matchMedia("(hover: hover) and (pointer: fine)").matches || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const move = (e: PointerEvent) => {
      mx.set(e.clientX / window.innerWidth - 0.5);
      my.set(e.clientY / window.innerHeight - 0.5);
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, [mx, my]);

  return (
    <motion.div style={{ y: lift }} className="relative mx-auto aspect-square w-full max-w-[500px]" aria-hidden="true">
      {/* the core's light */}
      <div className="absolute inset-[14%] rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--violet)_55%,transparent),color-mix(in_srgb,var(--blue)_22%,transparent)_45%,transparent_70%)]" />

      {/* back layer: orbits */}
      <motion.svg style={{ x: backX, y: backY }} viewBox="0 0 520 520" className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id="hv-ring" gradientUnits="userSpaceOnUse" x1="40" y1="40" x2="480" y2="480">
            <stop offset="0" style={{ stopColor: "var(--blue)" }} />
            <stop offset="0.5" style={{ stopColor: "var(--violet)" }} />
            <stop offset="1" style={{ stopColor: "var(--cyan)" }} />
          </linearGradient>
        </defs>
        <g className="spin-ccw" style={{ animationDuration: "70s" }}>
          <circle cx="260" cy="260" r="104" fill="none" stroke="url(#hv-ring)" strokeOpacity=".5" strokeDasharray="2 9" strokeLinecap="round" />
          {[20, 140, 260].map((a) => { const [x, y] = orbit(104, a); return <circle key={a} cx={x} cy={y} r="4.5" style={{ fill: "var(--cyan)" }} />; })}
        </g>
        <g className="spin-cw" style={{ animationDuration: "110s" }}>
          <circle cx="260" cy="260" r="158" fill="none" stroke="url(#hv-ring)" strokeOpacity=".4" />
          {[0, 72, 144, 216, 288].map((a) => { const [x, y] = orbit(158, a); return <circle key={a} cx={x} cy={y} r="5" style={{ fill: "var(--mag)" }} />; })}
        </g>
        <g className="spin-ccw" style={{ animationDuration: "170s" }}>
          <circle cx="260" cy="260" r="214" fill="none" stroke="url(#hv-ring)" strokeOpacity=".28" strokeDasharray="1 7" strokeLinecap="round" />
          {[45, 165, 285].map((a) => { const [x, y] = orbit(214, a); return <circle key={a} cx={x} cy={y} r="3.5" style={{ fill: "var(--lav)" }} />; })}
        </g>
      </motion.svg>

      {/* middle layer: the network */}
      <motion.svg style={{ x: midX, y: midY }} viewBox="0 0 520 520" className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id="hv-edge" gradientUnits="userSpaceOnUse" x1="100" y1="120" x2="420" y2="380">
            <stop offset="0" style={{ stopColor: "var(--blue)" }} />
            <stop offset="0.5" style={{ stopColor: "var(--violet)" }} />
            <stop offset="1" style={{ stopColor: "var(--mag)" }} />
          </linearGradient>
        </defs>
        <g transform="translate(0 22)">
          {EDGES.map(([a, b], i) => (
            <g key={i}>
              <line x1={NODES[a][0]} y1={NODES[a][1]} x2={NODES[b][0]} y2={NODES[b][1]} stroke="url(#hv-edge)" strokeWidth="1.3" strokeOpacity=".5" />
              <line className="flow" style={{ animationDelay: `${(i % 7) * -0.45}s` }} x1={NODES[a][0]} y1={NODES[a][1]} x2={NODES[b][0]} y2={NODES[b][1]} stroke="url(#hv-edge)" strokeWidth="2" strokeLinecap="round" strokeOpacity=".9" />
            </g>
          ))}
          {NODES.map(([x, y], i) => {
            const hub = i >= 14;
            const r = hub ? 9 : i % 3 === 0 ? 7 : 5.5;
            const tone = `var(${TONES[i % TONES.length]})`;
            return (
              <g key={i}>
                <circle className="twinkle" style={{ fill: tone, transformBox: "fill-box", transformOrigin: "center", animationDelay: `${(i % 6) * 0.7}s`, animationDuration: `${4 + (i % 4)}s` }} cx={x} cy={y} r={r * 2.8} fillOpacity=".16" />
                <circle cx={x} cy={y} r={r} style={{ fill: tone }} />
                {hub && <circle cx={x} cy={y} r={r} fill="none" strokeWidth="1.5" style={{ stroke: tone, transformBox: "fill-box", transformOrigin: "center", animation: `pulse-ring 3.2s ${(i - 14) * 0.8}s ease-out infinite` }} />}
              </g>
            );
          })}
        </g>
      </motion.svg>

      {/* front layer: symbols and domain chips */}
      <motion.div style={{ x: frontX, y: frontY }} className="absolute inset-0">
        {SYMBOLS.map((s) => (
          <span key={s.v} className="float absolute font-display text-2xl font-semibold text-lav/70" style={{ left: s.x, top: s.y, animationDelay: `${s.d}s` }}>{s.v}</span>
        ))}
        <span className="glass float absolute left-[2%] top-[30%] flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium" style={{ animationDelay: "0.4s" }}>
          <BrainCircuit size={14} className="text-cyan-fg" />{tt("Logic", "Логик")}
        </span>
        <span className="glass float absolute right-[0%] top-[52%] flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium" style={{ animationDelay: "1.7s" }}>
          <MemoryStick size={14} className="text-violet-fg" />{tt("Memory", "Ой")}
        </span>
        <span className="glass float absolute bottom-[12%] left-[12%] flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium" style={{ animationDelay: "2.5s" }}>
          <Zap size={14} className="text-lav" />{tt("Speed", "Хурд")}
        </span>
      </motion.div>
    </motion.div>
  );
}
