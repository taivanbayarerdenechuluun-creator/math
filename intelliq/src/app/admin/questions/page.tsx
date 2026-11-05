import Link from "next/link";
import { db } from "@/lib/db";
import { containsCI } from "@/lib/db-compat";
import { Panel } from "@/components/admin/AdminShell";

const PAGE = 25;

export default async function Page({ searchParams }: { searchParams: Promise<{ cat?: string; q?: string; d?: string; a?: string; p?: string; o?: string }> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.p) || 1);
  const cats = await db.category.findMany({ orderBy: { slug: "asc" }, select: { slug: true, nameEn: true } });
  const where = {
    ...(sp.cat && cats.some((c) => c.slug === sp.cat) ? { category: { slug: sp.cat } } : {}),
    ...(sp.d && /^[1-5]$/.test(sp.d) ? { difficulty: Number(sp.d) } : {}),
    ...(sp.a === "1" ? { active: true } : sp.a === "0" ? { active: false } : {}),
    // Questions generated for daily challenges are bookkeeping rows; show them only on request (?o=daily).
    ...(sp.o === "daily" ? { origin: "daily" } : { origin: { not: "daily" } }),
    ...(sp.q ? { prompt: containsCI(sp.q.slice(0, 80)) } : {}),
  };
  const [total, rows] = await Promise.all([
    db.question.count({ where }),
    db.question.findMany({ where, orderBy: [{ category: { slug: "asc" } }, { difficulty: "asc" }, { createdAt: "asc" }], skip: (page - 1) * PAGE, take: PAGE, select: { id: true, prompt: true, difficulty: true, active: true, version: true, kind: true, category: { select: { slug: true } }, _count: { select: { answers: true } } } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const qs = (o: Record<string, string | undefined>) => new URLSearchParams(Object.entries({ ...sp, ...o }).filter(([, v]) => v) as [string, string][]).toString();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="font-display text-2xl font-bold">Questions <span className="text-base font-normal text-muted">({total})</span></h1><Link href="/admin/questions/new" className="btn btn-primary !min-h-10 text-sm">New question</Link></div>
      <Panel>
        <form className="flex flex-wrap items-end gap-3 text-sm" method="get">
          <label className="grid gap-1 text-xs text-muted">Search<input name="q" defaultValue={sp.q} className="input !min-h-9" placeholder="prompt contains…" /></label>
          <label className="grid gap-1 text-xs text-muted">Category<select name="cat" defaultValue={sp.cat ?? ""} className="input !min-h-9"><option value="">All</option>{cats.map((c) => <option key={c.slug} value={c.slug}>{c.nameEn}</option>)}</select></label>
          <label className="grid gap-1 text-xs text-muted">Difficulty<select name="d" defaultValue={sp.d ?? ""} className="input !min-h-9"><option value="">All</option>{[1, 2, 3, 4, 5].map((d) => <option key={d}>{d}</option>)}</select></label>
          <label className="grid gap-1 text-xs text-muted">Status<select name="a" defaultValue={sp.a ?? ""} className="input !min-h-9"><option value="">All</option><option value="1">Active</option><option value="0">Inactive</option></select></label>
          <button className="btn btn-ghost !min-h-9 text-sm">Filter</button>
        </form>
      </Panel>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead><tr className="border-b border-line text-left text-xs text-muted"><th className="px-4 py-3 font-normal">Question</th><th className="font-normal">Category</th><th className="font-normal">Diff.</th><th className="font-normal">Answers</th><th className="font-normal">v</th><th className="font-normal">Status</th></tr></thead>
          <tbody>
            {rows.map((q) => (
              <tr key={q.id} className="border-b border-line last:border-0">
                <td className="px-4 py-2.5"><Link href={`/admin/questions/${q.id}`} className="hover:text-violet-fg underline underline-offset-2 hover:no-underline">{q.prompt.slice(0, 80)}</Link>{q.kind !== "text" && <span className="ml-2 rounded bg-deep px-1.5 py-0.5 text-xs text-muted">{q.kind}</span>}</td>
                <td className="text-muted">{q.category.slug}</td><td>{q.difficulty}</td><td className="text-muted">{q._count.answers}</td><td className="text-muted">{q.version}</td>
                <td>{q.active ? <span className="text-emerald-700 dark:text-emerald-400">active</span> : <span className="text-muted">inactive</span>}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted">No questions match.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-sm text-muted">
        <span>Page {page} of {pages}</span>
        <span className="flex gap-3">{page > 1 && <Link className="text-violet-fg underline underline-offset-2 hover:no-underline" href={`?${qs({ p: String(page - 1) })}`}>Previous</Link>}{page < pages && <Link className="text-violet-fg underline underline-offset-2 hover:no-underline" href={`?${qs({ p: String(page + 1) })}`}>Next</Link>}</span>
      </div>
    </div>
  );
}
