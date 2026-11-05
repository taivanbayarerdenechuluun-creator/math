"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Menu, Moon, ShieldCheck, Sun, X } from "lucide-react";
import { Logo } from "./Logo";
import { useApp } from "./Providers";
import { useStatus } from "./SiteChrome";
import { NotificationBell } from "./NotificationBell";
import { SearchPalette } from "./SearchPalette";

export function Navbar() {
  const { t, tt, theme, toggleTheme, lang, setLang } = useApp();
  const { user, loaded } = useStatus();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const menuBox = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !menuBox.current?.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [menu]);

  const links = [
    { href: "/assessments", label: t("nav.assessments") },
    { href: "/daily", label: tt("Daily challenge", "Өдрийн сорилт") },
    { href: "/leaderboard", label: tt("Leaderboard", "Тэргүүлэгчид") },
    { href: "/#how", label: t("nav.how") },
    { href: "/#faq", label: t("nav.faq") },
  ];
  const account = user
    ? [
        { href: "/dashboard", label: t("nav.dashboard") },
        { href: "/history", label: tt("History", "Түүх") },
        { href: "/achievements", label: tt("Achievements", "Амжилтууд") },
        { href: "/settings", label: tt("Settings", "Тохиргоо") },
        ...(user.role === "ADMIN" ? [{ href: "/admin", label: tt("Admin", "Админ") }] : []),
      ]
    : [];

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  return (
    <header className="glass fixed inset-x-0 top-0 z-50 border-x-0 border-t-0 after:pointer-events-none after:absolute after:inset-x-0 after:-bottom-px after:h-px after:bg-gradient-to-r after:from-transparent after:via-violet/60 after:to-transparent">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6" aria-label={tt("Main", "Үндсэн")}>
        <Logo />
        <ul className="hidden items-center gap-6 text-sm text-muted lg:flex">
          {links.map((l) => (<li key={l.href}><Link href={l.href} className="transition-colors hover:text-ink">{l.label}</Link></li>))}
        </ul>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <SearchPalette />
          <button onClick={() => setLang(lang === "en" ? "mn" : "en")} className="btn btn-ghost !min-h-10 !px-3 text-xs uppercase" aria-label={tt("Language", "Хэл")}>{lang === "en" ? "MN" : "EN"}</button>
          <button onClick={toggleTheme} className="btn btn-ghost !min-h-10 !px-3" aria-label={t("common.theme")}>{theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}</button>
          {user && <NotificationBell />}
          <div className="hidden items-center gap-2 md:flex">
            {user ? (
              <div ref={menuBox} className="relative">
                <button onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-haspopup="menu" className="btn btn-ghost !min-h-10 gap-2 !px-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {user.hasImage ? <img src={`/api/avatar/${user.id}`} alt="" width={24} height={24} className="h-6 w-6 rounded-full object-cover" /> : <span className="grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-violet to-cyan text-xs font-bold text-white" aria-hidden="true">{user.name.charAt(0).toUpperCase()}</span>}
                  <span className="max-w-[8rem] truncate text-sm">{user.name.split(" ")[0]}</span><ChevronDown size={14} />
                </button>
                {menu && (
                  <div role="menu" className="glass absolute right-0 top-12 z-50 w-52 rounded-xl p-1.5">
                    {account.map((a) => (<Link key={a.href} role="menuitem" href={a.href} onClick={() => setMenu(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-deep">{a.href === "/admin" && <ShieldCheck size={14} className="text-violet-fg" />}{a.label}</Link>))}
                    <button role="menuitem" onClick={() => void logout()} className="mt-1 w-full rounded-lg border-t border-line px-3 py-2 text-left text-sm text-muted hover:bg-deep hover:text-ink">{t("nav.logout")}</button>
                  </div>
                )}
              </div>
            ) : loaded ? (
              <><Link href="/login" className="btn btn-ghost !min-h-10">{t("nav.login")}</Link><Link href="/register" className="btn btn-primary !min-h-10">{t("nav.signup")}</Link></>
            ) : null}
          </div>
          <button className="btn btn-ghost !min-h-10 !px-3 md:hidden" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Menu">{open ? <X size={20} /> : <Menu size={20} />}</button>
        </div>
      </nav>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-line md:hidden">
            <div className="flex max-h-[70vh] flex-col gap-1 overflow-y-auto p-4">
              {[...links, ...account].map((l) => (<Link key={l.href + l.label} href={l.href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-muted hover:bg-deep hover:text-ink">{l.label}</Link>))}
              <div className="mt-2 grid grid-cols-2 gap-2">
                {user ? <button onClick={() => void logout()} className="btn btn-ghost col-span-2">{t("nav.logout")}</button> : <><Link href="/login" className="btn btn-ghost">{t("nav.login")}</Link><Link href="/register" className="btn btn-primary">{t("nav.signup")}</Link></>}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
