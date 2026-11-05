"use client";
import { Legend, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from "recharts";
import { useReducedMotion } from "framer-motion";
import { useApp } from "../Providers";
import type { Key } from "@/lib/i18n";

export type RadarCat = { slug: string; correct: number; total: number; performance: number; prev: number | null };

type Row = { name: string; value: number; prev: number | null; correct: number; total: number; desc: string };

function Tip({ active, payload }: { active?: boolean; payload?: { payload: Row }[] }) {
  const { t } = useApp();
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return (
    <div className="max-w-56 rounded-xl border border-line bg-card p-3 text-xs shadow-lg">
      <p className="font-semibold">{r.name}</p>
      <p className="mt-1 text-muted">{r.desc}</p>
      <p className="mt-2"><span className="font-semibold text-violet-fg">{r.value}%</span> · {r.correct}/{r.total}</p>
      {r.prev !== null && <p className="text-muted">{t("r.previous")}: {r.prev}% ({r.value - r.prev >= 0 ? "+" : ""}{Math.round(r.value - r.prev)})</p>}
    </div>
  );
}

/** Axis label that wraps long names (Mongolian ones are long) onto two lines instead of being clipped by the chart edge. */
function Tick({ x = 0, y = 0, textAnchor, payload }: { x?: number; y?: number; textAnchor?: "start" | "middle" | "end"; payload?: { value: string } }) {
  const text = String(payload?.value ?? "");
  const words = text.split(" ");
  let lines = [text];
  if (words.length > 1 && text.length > 11) {
    let best = 1, diff = Infinity;
    for (let i = 1; i < words.length; i++) {
      const d = Math.abs(words.slice(0, i).join(" ").length - words.slice(i).join(" ").length);
      if (d < diff) { diff = d; best = i; }
    }
    lines = [words.slice(0, best).join(" "), words.slice(best).join(" ")];
  }
  return (
    <text x={x} y={y} textAnchor={textAnchor} fill="var(--muted)" fontSize={11}>
      {lines.map((l, i) => <tspan key={i} x={x} dy={i === 0 ? (lines.length > 1 ? "-0.5em" : 0) : "1.2em"}>{l}</tspan>)}
    </text>
  );
}

export function RadarPanel({ cats }: { cats: RadarCat[] }) {
  const { t } = useApp();
  const reduce = useReducedMotion();
  const hasPrev = cats.some((c) => c.prev !== null);
  const rows: Row[] = cats.map((c) => ({
    name: t(`cat.${c.slug}` as Key),
    desc: t(`cat.${c.slug}.d` as Key),
    value: c.performance,
    prev: c.prev,
    correct: c.correct,
    total: c.total,
  }));
  const data = rows.map((r) => ({ ...r, prevValue: r.prev ?? undefined }));

  return (
    <div className="h-80 w-full sm:h-96" role="img" aria-label={rows.map((r) => `${r.name} ${r.value}%`).join(", ")}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="58%" margin={{ top: 16, right: 44, bottom: 16, left: 44 }}>
          <PolarGrid stroke="var(--border)" />
          <PolarAngleAxis dataKey="name" tick={<Tick />} />
          <PolarRadiusAxis angle={Math.round(90 - 180 / rows.length)} domain={[0, 100]} tick={{ fill: "var(--muted)", fontSize: 9 }} axisLine={false} tickCount={5} />
          <Tooltip content={<Tip />} />
          {hasPrev && (
            <Radar name={t("r.previous")} dataKey="prevValue" stroke="#22D3EE" fill="#22D3EE" fillOpacity={0.12} strokeDasharray="5 4" strokeWidth={2} isAnimationActive={!reduce} />
          )}
          <Radar name={t("r.current")} dataKey="value" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.35} strokeWidth={2.5} dot={{ r: 3, fill: "#8B5CF6" }} isAnimationActive={!reduce} animationDuration={900} />
          {hasPrev && <Legend wrapperStyle={{ fontSize: 12 }} />}
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
