"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { useApp } from "./Providers";
import { useStatus } from "./SiteChrome";

type Item = { id: string; title: string; body: string; titleMn: string | null; bodyMn: string | null; href: string | null; readAt: string | null; createdAt: string };

export function NotificationBell() {
  const { tt, lang } = useApp();
  const { unread, setUnread } = useStatus();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[] | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [open]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (!next) return;
    const r = await fetch("/api/notifications", { cache: "no-store" });
    if (r.ok) setItems((await r.json()).items);
    if (unread > 0) {
      const m = await fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ markAll: true }) });
      if (m.ok) setUnread(0);
    }
  }

  return (
    <div ref={box} className="relative">
      <button onClick={() => void toggle()} aria-label={`${tt("Notifications", "Мэдэгдэл")}${unread ? ` (${unread} ${tt("unread", "уншаагүй")})` : ""}`} aria-expanded={open} className="btn btn-ghost relative !min-h-10 !px-3">
        <Bell size={18} />
        {unread > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-violet-700 px-1 text-[10px] font-bold text-white" data-testid="unread">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div role="dialog" aria-label={tt("Notifications", "Мэдэгдэл")} className="glass absolute right-0 top-12 z-50 w-80 max-w-[90vw] rounded-xl p-2">
          <p className="px-3 py-2 text-sm font-semibold">{tt("Notifications", "Мэдэгдэл")}</p>
          {items === null ? <p className="px-3 py-6 text-center text-sm text-muted">…</p> : items.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted">{tt("You're all caught up. Achievements and results will show up here.", "Бүх зүйл шинэчлэгдсэн. Амжилт, үр дүн энд харагдана.")}</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {items.map((n) => {
                const inner = <><p className={`text-sm ${n.readAt ? "" : "font-semibold"}`}>{lang === "mn" && n.titleMn ? n.titleMn : n.title}</p><p className="mt-0.5 text-xs text-muted">{lang === "mn" && n.bodyMn ? n.bodyMn : n.body}</p><p className="mt-1 text-[10px] text-muted">{n.createdAt.slice(0, 16).replace("T", " ")}</p></>;
                return <li key={n.id}>{n.href ? <Link href={n.href} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2 hover:bg-deep">{inner}</Link> : <div className="px-3 py-2">{inner}</div>}</li>;
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
