import Link from "next/link";
import { db } from "@/lib/db";

const PAGE = 50;

export default async function Page({ searchParams }: { searchParams: Promise<{ p?: string; a?: string }> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.p) || 1);
  const where = sp.a ? { action: { startsWith: sp.a.slice(0, 40) } } : {};
  const [total, logs] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE, include: { actor: { select: { name: true } } } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const link = (p: number) => `?${new URLSearchParams({ ...(sp.a ? { a: sp.a } : {}), p: String(p) })}`;
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold">Audit log <span className="text-base font-normal text-muted">({total})</span></h1>
      <form method="get" className="flex gap-2">
        <input name="a" defaultValue={sp.a} placeholder="Filter by action prefix, e.g. question." className="input !min-h-10 max-w-sm" aria-label="Filter actions" />
        <button className="btn btn-ghost !min-h-10 text-sm">Filter</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead><tr className="border-b border-line text-left text-xs text-muted"><th className="px-4 py-3 font-normal">When (UTC)</th><th className="font-normal">Actor</th><th className="font-normal">Action</th><th className="font-normal">Target</th><th className="font-normal">Details</th></tr></thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-b border-line align-top last:border-0">
                <td className="px-4 py-2 text-muted">{l.createdAt.toISOString().slice(0, 19).replace("T", " ")}</td>
                <td>{l.actor?.name ?? <span className="text-muted">system</span>}</td>
                <td className="font-mono text-xs">{l.action}</td>
                <td className="max-w-[160px] truncate font-mono text-xs text-muted">{l.target}</td>
                <td className="max-w-[220px] truncate font-mono text-xs text-muted" title={l.meta ?? ""}>{l.meta}</td>
              </tr>
            ))}
            {!logs.length && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted">No entries.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex justify-between text-sm text-muted">
        <span>Page {page} of {pages}</span>
        <span className="flex gap-3">
          {page > 1 && <Link className="text-violet-fg underline underline-offset-2 hover:no-underline" href={link(page - 1)}>Newer</Link>}
          {page < pages && <Link className="text-violet-fg underline underline-offset-2 hover:no-underline" href={link(page + 1)}>Older</Link>}
        </span>
      </div>
    </div>
  );
}
