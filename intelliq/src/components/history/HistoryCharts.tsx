"use client";
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useReducedMotion } from "framer-motion";

const AXIS = { fill: "var(--muted)", fontSize: 11 };
const TIP = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--text)", fontSize: 12 };

export function TrendChart({ data, perfLabel, accLabel }: { data: { label: string; performance: number; accuracy: number }[]; perfLabel: string; accLabel: string }) {
  const reduce = useReducedMotion();
  return (
    <div className="h-64 w-full" role="img" aria-label={`${perfLabel}: ${data.map((d) => d.performance).join(", ")}`}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis dataKey="label" tick={AXIS} />
          <YAxis domain={[0, 100]} tick={AXIS} />
          <Tooltip contentStyle={TIP} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" name={perfLabel} dataKey="performance" stroke="#8B5CF6" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} isAnimationActive={!reduce} />
          <Line type="monotone" name={accLabel} dataKey="accuracy" stroke="#22D3EE" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3 }} isAnimationActive={!reduce} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TimeChart({ data, label }: { data: { label: string; minutes: number }[]; label: string }) {
  const reduce = useReducedMotion();
  return (
    <div className="h-56 w-full" role="img" aria-label={label}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis dataKey="label" tick={AXIS} />
          <YAxis tick={AXIS} />
          <Tooltip contentStyle={TIP} formatter={(v) => [`${v} min`, label]} />
          <Line type="monotone" name={label} dataKey="minutes" stroke="#3B82F6" strokeWidth={2.5} dot={{ r: 4 }} isAnimationActive={!reduce} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CategoryBars({ data, firstLabel, latestLabel }: { data: { name: string; first: number; latest: number }[]; firstLabel: string; latestLabel: string }) {
  const reduce = useReducedMotion();
  return (
    <div className="h-72 w-full" role="img" aria-label={data.map((d) => `${d.name} ${d.first} to ${d.latest}`).join(", ")}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ ...AXIS, fontSize: 10, angle: -35, textAnchor: "end" }} interval={0} height={78} />
          <YAxis domain={[0, 100]} tick={AXIS} />
          <Tooltip contentStyle={TIP} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar name={firstLabel} dataKey="first" fill="#22D3EE" radius={[4, 4, 0, 0]} isAnimationActive={!reduce} />
          <Bar name={latestLabel} dataKey="latest" fill="#8B5CF6" radius={[4, 4, 0, 0]} isAnimationActive={!reduce} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CompareRadar({ data, aLabel, bLabel }: { data: { name: string; a: number | null; b: number | null }[]; aLabel: string; bLabel: string }) {
  const reduce = useReducedMotion();
  const rows = data.map((d) => ({ name: d.name, a: d.a ?? 0, b: d.b ?? 0 }));
  return (
    <div className="h-80 w-full" role="img" aria-label={`${aLabel} vs ${bLabel}`}>
      <ResponsiveContainer>
        <RadarChart data={rows} outerRadius="58%" margin={{ top: 12, right: 36, bottom: 12, left: 36 }}>
          <PolarGrid stroke="var(--border)" />
          <PolarAngleAxis dataKey="name" tick={AXIS} />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} angle={Math.round(90 - 180 / Math.max(rows.length, 1))} />
          <Tooltip contentStyle={TIP} />
          <Radar name={aLabel} dataKey="a" stroke="#22D3EE" fill="#22D3EE" fillOpacity={0.15} strokeDasharray="5 4" strokeWidth={2} isAnimationActive={!reduce} />
          <Radar name={bLabel} dataKey="b" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.3} strokeWidth={2.5} isAnimationActive={!reduce} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
