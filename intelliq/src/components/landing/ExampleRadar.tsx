"use client";
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from "recharts";

export default function ExampleRadar({ data }: { data: { name: string; value: number }[] }) {
  return (
    <>
      {/* gradients live outside the chart so they resolve whatever the chart library renders */}
      <svg width="0" height="0" className="absolute" aria-hidden="true">
        <defs>
          <linearGradient id="ex-radar-fill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" style={{ stopColor: "var(--cyan)", stopOpacity: 0.55 }} />
            <stop offset="0.5" style={{ stopColor: "var(--violet)", stopOpacity: 0.5 }} />
            <stop offset="1" style={{ stopColor: "var(--mag)", stopOpacity: 0.45 }} />
          </linearGradient>
          <linearGradient id="ex-radar-line" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" style={{ stopColor: "var(--cyan)" }} />
            <stop offset="0.55" style={{ stopColor: "var(--violet)" }} />
            <stop offset="1" style={{ stopColor: "var(--mag)" }} />
          </linearGradient>
        </defs>
      </svg>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke="var(--border)" />
          <PolarAngleAxis dataKey="name" tick={{ fill: "var(--muted)", fontSize: 12 }} />
          <PolarRadiusAxis angle={Math.round(90 - 180 / data.length)} domain={[0, 100]} tick={false} axisLine={false} />
          <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--text)" }} formatter={(v) => [`${v}%`, ""]} />
          <Radar dataKey="value" stroke="url(#ex-radar-line)" fill="url(#ex-radar-fill)" fillOpacity={1} strokeWidth={2.5} dot={{ r: 3.5, fill: "var(--lav)", fillOpacity: 1, strokeWidth: 0 }} />
        </RadarChart>
      </ResponsiveContainer>
    </>
  );
}
