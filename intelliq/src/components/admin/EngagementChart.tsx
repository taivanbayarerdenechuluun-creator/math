"use client";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export default function EngagementChart({ data }: { data: { day: string; sessions: number; challenges: number }[] }) {
  return (
    <div className="h-64 w-full" role="img" aria-label="Sessions and daily challenges per day">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis dataKey="day" tick={{ fill: "var(--muted)", fontSize: 11 }} />
          <YAxis allowDecimals={false} tick={{ fill: "var(--muted)", fontSize: 11 }} />
          <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--text)", fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar name="Assessments started" dataKey="sessions" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
          <Bar name="Daily challenges" dataKey="challenges" fill="#22D3EE" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
