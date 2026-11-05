import Link from "next/link";
import { db } from "@/lib/db";
import { containsCI } from "@/lib/db-compat";
import { getCurrentUser } from "@/lib/session";
import { UserActions } from "@/components/admin/UserActions";

const PAGE = 25;

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; p?: string }> }) {
  const sp = await searchParams;
  const me = await getCurrentUser();
  const page = Math.max(1, Number(sp.p) || 1);
  const q = sp.q?.trim().slice(0, 80);
  const where = q ? { OR: [{ email: containsCI(q) }, { name: containsCI(q) }] } : {};
  const [total, users, roles] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE,
      select: { id: true, name: true, email: true, createdAt: true, disabledAt: true, emailVerifiedAt: true, role: { select: { name: true } }, _count: { select: { results: true, sessions: true } }, results: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } } },
    }),
    db.role.findMany({ orderBy: { name: "asc" }, select: { name: true } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const link = (p: number) => `?${new URLSearchParams({ ...(q ? { q } : {}), p: String(p) })}`;
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold">Users <span className="text-base font-normal text-muted">({total})</span></h1>
      <form method="get" className="flex gap-2">
        <input name="q" defaultValue={q} placeholder="Search name or email" className="input !min-h-10 max-w-sm" aria-label="Search users" />
        <button className="btn btn-ghost !min-h-10 text-sm">Search</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead><tr className="border-b border-line text-left text-xs text-muted"><th className="px-4 py-3 font-normal">User</th><th className="font-normal">Joined</th><th className="font-normal">Results</th><th className="font-normal">Last result</th><th className="font-normal">Status</th><th className="font-normal">Manage</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-line align-top last:border-0">
                <td className="px-4 py-2.5">
                  <Link href={`/admin/users/${u.id}`} className="font-medium hover:text-violet-fg underline underline-offset-2 hover:no-underline">{u.name}</Link>
                  <div className="text-xs text-muted">{u.email}{!u.emailVerifiedAt && " · unverified"}</div>
                </td>
                <td className="text-muted">{u.createdAt.toISOString().slice(0, 10)}</td>
                <td className="text-muted">{u._count.results}</td>
                <td className="text-muted">{u.results[0]?.createdAt.toISOString().slice(0, 10) ?? "–"}</td>
                <td>{u.disabledAt ? <span className="text-rose-700 dark:text-rose-400">suspended</span> : <span className="text-emerald-700 dark:text-emerald-400">active</span>}</td>
                <td className="py-2"><UserActions id={u.id} role={u.role.name} roles={roles.map((r) => r.name)} disabled={!!u.disabledAt} self={u.id === me?.id} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-between text-sm text-muted">
        <span>Page {page} of {pages}</span>
        <span className="flex gap-3">
          {page > 1 && <Link className="text-violet-fg underline underline-offset-2 hover:no-underline" href={link(page - 1)}>Previous</Link>}
          {page < pages && <Link className="text-violet-fg underline underline-offset-2 hover:no-underline" href={link(page + 1)}>Next</Link>}
        </span>
      </div>
    </div>
  );
}
