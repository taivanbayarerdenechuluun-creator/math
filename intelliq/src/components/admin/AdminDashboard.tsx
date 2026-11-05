"use client";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Panel, Stat } from "./AdminShell";
import type { AdminStats } from "@/lib/admin-stats";

const EngagementChart = dynamic(() => import("./EngagementChart"), { ssr: false, loading: () => <div className="h-64 animate-pulse rounded-xl bg-deep" /> });

export function AdminDashboard({ s }: { s: AdminStats }) {
  const qRow = (q: AdminStats["hardest"][number]) => (
    <tr key={q.id} className="border-t border-line"><td className="py-2 pr-3"><Link href={`/admin/questions/${q.id}`} className="hover:text-violet-fg underline underline-offset-2 hover:no-underline">{q.prompt.slice(0, 70)}</Link></td><td className="text-muted">{q.category}</td><td className="text-right text-muted">{q.answers}</td><td className="text-right font-semibold">{q.accuracy}%</td></tr>
  );
  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-bold">Analytics</h1>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="stats">
        <Stat label="Total users" value={s.users} hint={`${s.newUsers} new in 7 days`} />
        <Stat label="Active users (7 days)" value={s.activeUsers} />
        <Stat label="Assessments started" value={s.sessions} />
        <Stat label="Completion rate" value={`${s.completionRate}%`} hint={`${s.submitted} submitted`} />
        <Stat label="Results" value={s.results} />
        <Stat label="Avg. performance" value={s.avgPerformance} hint={`accuracy ${s.avgAccuracy}%`} />
        <Stat label="Questions (active / total)" value={`${s.questionsActive} / ${s.questionsTotal}`} hint={`${s.answeredTotal} answers recorded`} />
        <Stat label="Daily challenges done" value={s.challengeTotal} />
      </div>
      <Panel title="Engagement, last 14 days"><EngagementChart data={s.engagement} /></Panel>
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Average performance by category">
          {s.categoryPerformance.length ? (
            <ul className="space-y-3 text-sm">{s.categoryPerformance.map((c) => (<li key={c.slug}><div className="flex justify-between"><span>{c.name}</span><span className="text-muted">{c.avg}% · {c.measured} results</span></div><div className="mt-1 h-2 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-gradient-to-r from-violet to-cyan" style={{ width: `${c.avg}%` }} /></div></li>))}</ul>
          ) : <p className="text-sm text-muted">No results yet.</p>}
        </Panel>
        <Panel title="Achievements unlocked">
          <ul className="space-y-1.5 text-sm">{s.achievementStats.map((a) => <li key={a.code} className="flex justify-between"><span>{a.name}</span><span className="text-muted">{a.unlocked}</span></li>)}</ul>
        </Panel>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        {([["Hardest questions", s.hardest], ["Easiest questions", s.easiest]] as const).map(([title, rows]) => (
          <Panel key={title} title={`${title} (min. 5 answers)`}>
            {rows.length ? <table className="w-full text-sm"><thead><tr className="text-left text-xs text-muted"><th className="font-normal">Question</th><th className="font-normal">Cat.</th><th className="text-right font-normal">Answers</th><th className="text-right font-normal">Correct</th></tr></thead><tbody>{rows.map(qRow)}</tbody></table> : <p className="text-sm text-muted">Not enough answers yet.</p>}
          </Panel>
        ))}
      </div>
    </div>
  );
}
