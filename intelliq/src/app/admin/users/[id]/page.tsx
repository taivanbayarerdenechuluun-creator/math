import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { levelOf } from "@/lib/gamification";
import { Panel } from "@/components/admin/AdminShell";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await db.user.findUnique({
    where: { id },
    include: {
      role: true, streak: true,
      _count: { select: { results: true, sessions: true, achievements: true, attempts: true } },
      results: { orderBy: { createdAt: "desc" }, take: 10, include: { session: { select: { assessment: { select: { titleEn: true } } } } } },
    },
  });
  if (!u) notFound();
  const logs = await db.auditLog.findMany({ where: { OR: [{ target: id }, { actorId: id }] }, orderBy: { createdAt: "desc" }, take: 20 });
  const lv = levelOf(u.xp);
  const rows: [string, string][] = [
    ["Email", u.email], ["Role", u.role.name], ["Joined", u.createdAt.toISOString().slice(0, 10)],
    ["Email verified", u.emailVerifiedAt ? "yes" : "no"], ["Status", u.disabledAt ? "suspended" : "active"], ["Level / XP", `${lv.level} / ${u.xp}`],
    ["Streak (current / longest)", `${u.streak?.current ?? 0} / ${u.streak?.longest ?? 0}`],
    ["Results · sessions · badges · challenges", `${u._count.results} · ${u._count.sessions} · ${u._count.achievements} · ${u._count.attempts}`],
    ["Rankings opt-in", u.showOnLeaderboard ? "yes" : "no"], ["Public profile", u.publicProfile ? "yes" : "no"],
  ];
  return (
    <div className="space-y-5">
      <Link href="/admin/users" className="text-sm text-muted hover:text-ink">← All users</Link>
      <h1 className="font-display text-2xl font-bold">{u.name}</h1>
      <Panel>
        <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          {rows.map(([k, v]) => <div key={k} className="flex justify-between gap-4 border-b border-line py-1.5"><dt className="text-muted">{k}</dt><dd className="font-medium">{v}</dd></div>)}
        </dl>
      </Panel>
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Recent results">
          {u.results.length ? (
            <ul className="divide-y divide-line text-sm">
              {u.results.map((r) => <li key={r.id} className="flex justify-between py-2"><span>{r.session.assessment.titleEn}</span><span className="text-muted">{r.createdAt.toISOString().slice(0, 10)} · <span className="font-semibold text-ink">{r.performanceScore}</span></span></li>)}
            </ul>
          ) : <p className="text-sm text-muted">No results.</p>}
        </Panel>
        <Panel title="Account activity (audit)">
          {logs.length ? (
            <ul className="divide-y divide-line text-sm">
              {logs.map((l) => <li key={l.id} className="py-2"><span className="font-medium">{l.action}</span> <span className="text-xs text-muted">{l.createdAt.toISOString().slice(0, 16).replace("T", " ")}</span></li>)}
            </ul>
          ) : <p className="text-sm text-muted">No recorded events.</p>}
        </Panel>
      </div>
    </div>
  );
}
