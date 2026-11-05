"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, FileQuestion, History, Settings, Users, ClipboardList, ArrowLeft } from "lucide-react";
import { Logo } from "../Logo";

const NAV = [
  { href: "/admin", label: "Analytics", icon: BarChart3, exact: true },
  { href: "/admin/questions", label: "Questions", icon: FileQuestion },
  { href: "/admin/assessments", label: "Assessments", icon: ClipboardList },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/system", label: "System", icon: Settings },
  { href: "/admin/audit", label: "Audit log", icon: History },
];

export function AdminShell({ children, name }: { children: React.ReactNode; name: string }) {
  const path = usePathname();
  return (
    <div className="min-h-screen bg-bg">
      <header className="glass sticky top-0 z-40 border-x-0 border-t-0">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-3"><Logo /><span className="rounded-full bg-violet/15 px-2.5 py-0.5 text-xs font-semibold text-violet-fg">Admin</span></div>
          <div className="flex items-center gap-3 text-sm text-muted"><span className="hidden sm:inline">{name}</span><Link href="/dashboard" className="btn btn-ghost !min-h-9 text-xs"><ArrowLeft size={14} /> Back to app</Link></div>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 md:grid-cols-[200px_1fr]">
        <nav aria-label="Admin" className="flex gap-1 overflow-x-auto md:flex-col">
          {NAV.map((n) => {
            const active = n.exact ? path === n.href : path.startsWith(n.href);
            return (
              <Link key={n.href} href={n.href} aria-current={active ? "page" : undefined} className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${active ? "bg-violet/15 font-semibold text-violet-fg" : "text-muted hover:bg-deep hover:text-ink"}`}>
                <n.icon size={16} /> {n.label}
              </Link>
            );
          })}
        </nav>
        <main id="main" className="min-w-0">{children}</main>
      </div>
    </div>
  );
}

export const Panel = ({ title, children, className = "" }: { title?: string; children: React.ReactNode; className?: string }) => (
  <section className={`card p-5 ${className}`}>{title && <h2 className="mb-3 font-display text-base font-semibold">{title}</h2>}{children}</section>
);

export const Stat = ({ label, value, hint }: { label: string; value: string | number; hint?: string }) => (
  <div className="card p-4"><p className="font-display text-2xl font-bold">{value}</p><p className="text-xs text-muted">{label}</p>{hint && <p className="mt-1 text-xs text-muted">{hint}</p>}</div>
);
