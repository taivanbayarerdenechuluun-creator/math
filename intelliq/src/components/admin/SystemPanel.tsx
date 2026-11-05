"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Panel } from "./AdminShell";
import { adminApi } from "./api";

type Settings = { maintenance: string; registrationOpen: string; leaderboardEnabled: string };
type Ann = { id: string; title: string; body: string; active: boolean; at: string };
type Role = { id: string; name: string; users: number };

const TOGGLES: { key: keyof Settings; label: string; hint: string; invert?: boolean }[] = [
  { key: "maintenance", label: "Maintenance mode", hint: "Blocks new tests, sign-ups and challenges for non-admins and shows a notice." },
  { key: "registrationOpen", label: "Registration open", hint: "When off, new accounts cannot be created." },
  { key: "leaderboardEnabled", label: "Leaderboards enabled", hint: "When off, rankings are hidden from everyone." },
];

export function SystemPanel({ settings, announcements, roles }: { settings: Settings; announcements: Ann[]; roles: Role[] }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [ann, setAnn] = useState({ title: "", body: "" });
  const [role, setRole] = useState("");

  async function run(p: Promise<Awaited<ReturnType<typeof adminApi>>>, ok: string, after?: () => void) {
    const r = await p;
    setMsg(r.ok ? { kind: "ok", text: ok } : { kind: "err", text: r.data.error ?? "Failed." });
    if (r.ok) { after?.(); router.refresh(); }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3"><h1 className="font-display text-2xl font-bold">System</h1>{msg && <p role={msg.kind === "err" ? "alert" : "status"} className={`text-sm ${msg.kind === "err" ? "text-rose-700 dark:text-rose-300" : "text-emerald-700 dark:text-emerald-400"}`}>{msg.text}</p>}</div>

      <Panel title="Settings">
        <ul className="divide-y divide-line">
          {TOGGLES.map((t) => {
            const on = settings[t.key] === "1";
            return (
              <li key={t.key} className="flex items-center justify-between gap-4 py-3">
                <div><p className="text-sm font-medium">{t.label}</p><p className="text-xs text-muted">{t.hint}</p></div>
                <button role="switch" aria-checked={on} aria-label={t.label} onClick={() => void run(adminApi("PUT", "settings", { key: t.key, value: on ? "0" : "1" }), `${t.label}: ${on ? "off" : "on"}`)} className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? "bg-violet" : "bg-line"}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${on ? "left-[22px]" : "left-0.5"}`} /></button>
              </li>
            );
          })}
        </ul>
      </Panel>

      <Panel title="Announcements">
        <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
          <input value={ann.title} onChange={(e) => setAnn({ ...ann, title: e.target.value })} placeholder="Title" maxLength={100} className="input !min-h-9" aria-label="Announcement title" />
          <input value={ann.body} onChange={(e) => setAnn({ ...ann, body: e.target.value })} placeholder="Message shown in the site banner" maxLength={500} className="input !min-h-9" aria-label="Announcement message" />
          <button onClick={() => void run(adminApi("POST", "announcements", ann), "Announcement published.", () => setAnn({ title: "", body: "" }))} className="btn btn-primary !min-h-9 text-sm">Publish</button>
        </div>
        <ul className="mt-4 divide-y divide-line text-sm">
          {announcements.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0"><p className="truncate font-medium">{a.title} {!a.active && <span className="text-xs text-muted">(hidden)</span>}</p><p className="truncate text-xs text-muted">{a.at} · {a.body}</p></div>
              <div className="flex shrink-0 gap-3"><button onClick={() => void run(adminApi("PUT", `announcements/${a.id}`, { active: !a.active }), a.active ? "Hidden." : "Shown.")} className="text-violet-fg underline underline-offset-2 hover:no-underline">{a.active ? "Hide" : "Show"}</button><button onClick={() => void run(adminApi("DELETE", `announcements/${a.id}`), "Deleted.")} className="text-rose-700 dark:text-rose-400 hover:underline">Delete</button></div>
            </li>
          ))}
          {!announcements.length && <li className="py-4 text-muted">No announcements.</li>}
        </ul>
      </Panel>

      <Panel title="Roles">
        <p className="mb-3 text-xs text-muted">USER and ADMIN are built in. Only ADMIN grants administrative access; custom roles are labels you can assign to users.</p>
        <ul className="divide-y divide-line text-sm">
          {roles.map((r) => (
            <li key={r.id} className="flex items-center justify-between py-2.5"><span><span className="font-mono text-xs">{r.name}</span> <span className="text-xs text-muted">· {r.users} users</span></span>{!["USER", "ADMIN"].includes(r.name) && <button onClick={() => void run(adminApi("DELETE", `roles/${r.id}`), "Role deleted.")} className="text-rose-700 dark:text-rose-400 hover:underline">Delete</button>}</li>
          ))}
        </ul>
        <div className="mt-3 flex gap-2"><input value={role} onChange={(e) => setRole(e.target.value.toUpperCase())} placeholder="NEW_ROLE" className="input !min-h-9 max-w-xs font-mono" aria-label="New role name" /><button onClick={() => void run(adminApi("POST", "roles", { name: role }), "Role created.", () => setRole(""))} className="btn btn-ghost !min-h-9 text-sm">Add role</button></div>
      </Panel>
    </div>
  );
}
