"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Megaphone, Wrench, X } from "lucide-react";
import { useApp } from "./Providers";

export type SiteUser = { id: string; name: string; role: string; hasImage: boolean; prefs: { theme: string; language: string } | null };
type Status = { loaded: boolean; maintenance: boolean; announcements: { id: string; title: string; body: string }[]; user: SiteUser | null; unread: number };
type Ctx = Status & { refresh: () => void; setUnread: (n: number) => void };

const C = createContext<Ctx | null>(null);
const INITIAL: Status = { loaded: false, maintenance: false, announcements: [], user: null, unread: 0 };

export function useStatus() {
  const c = useContext(C);
  if (!c) throw new Error("useStatus must be used inside StatusProvider");
  return c;
}

const stored = (k: string) => {
  try { return localStorage.getItem(k); } catch { return null; }
};

/** One shared /api/status request for the whole app chrome (navbar, banners, maintenance gate). */
export function StatusProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<Status>(INITIAL);
  const { setLang, toggleTheme, theme } = useApp();

  const refresh = useCallback(() => {
    fetch("/api/status", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setS({ loaded: true, maintenance: !!d.maintenance, announcements: d.announcements ?? [], user: d.user ?? null, unread: d.unread ?? 0 }))
      .catch(() => setS((x) => ({ ...x, loaded: true })));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Apply saved account preferences on a device that has no explicit local choice yet.
  const prefs = s.user?.prefs;
  useEffect(() => {
    if (!prefs) return;
    if (!stored("iq-lang") && (prefs.language === "mn" || prefs.language === "en")) setLang(prefs.language);
    if (!stored("iq-theme") && prefs.theme !== theme) toggleTheme();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once when prefs arrive
  }, [prefs?.theme, prefs?.language]);

  return <C.Provider value={{ ...s, refresh, setUnread: (n) => setS((x) => ({ ...x, unread: n })) }}>{children}</C.Provider>;
}

/** Announcement banner (dismissible) and the maintenance gate for non-admins. */
export function SiteBanners() {
  const { tt } = useApp();
  const { maintenance, announcements, user, loaded } = useStatus();
  const path = usePathname();
  const [dismissed, setDismissed] = useState<string[]>([]);
  const visible = announcements.filter((a) => !dismissed.includes(a.id));
  const gate = loaded && maintenance && user?.role !== "ADMIN" && !path.startsWith("/login") && !path.startsWith("/admin");

  return (
    <>
      <AnimatePresence>
        {visible[0] && !gate && (
          <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} role="status" className="glass fixed inset-x-3 bottom-3 z-40 mx-auto flex max-w-xl items-start gap-3 rounded-xl p-4 text-sm">
            <Megaphone size={18} className="mt-0.5 shrink-0 text-cyan-fg" />
            <div className="min-w-0 flex-1"><p className="font-semibold">{visible[0].title}</p><p className="mt-0.5 text-muted">{visible[0].body}</p></div>
            <button onClick={() => setDismissed((d) => [...d, visible[0].id])} aria-label={tt("Dismiss", "Хаах")} className="text-muted hover:text-ink"><X size={16} /></button>
          </motion.div>
        )}
      </AnimatePresence>
      {gate && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-bg p-6 text-center" role="alertdialog" aria-modal="true" aria-label={tt("Maintenance", "Засвар")}>
          <div className="max-w-md">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-violet to-cyan text-white"><Wrench size={28} /></div>
            <h1 className="mt-6 font-display text-3xl font-bold">{tt("We'll be right back", "Удахгүй эргэн ирнэ")}</h1>
            <p className="mt-3 text-muted">{tt("INTELLIQ is undergoing scheduled maintenance. New assessments are paused; please try again shortly.", "INTELLIQ товлосон засвар хийж байна. Шинэ тестүүд түр зогссон; удахгүй дахин оролдоно уу.")}</p>
            <Link href="/login" className="mt-6 inline-block text-sm text-violet-fg underline underline-offset-2 hover:no-underline">{tt("Administrator sign-in", "Админ нэвтрэх")}</Link>
          </div>
        </div>
      )}
    </>
  );
}
