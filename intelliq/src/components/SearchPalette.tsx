"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { useApp } from "./Providers";

type Hit = { type: string; title: string; sub?: string; href: string };

/** Global search: Ctrl/Cmd+K or the button. Arrow keys + Enter to navigate, Esc to close. */
export function SearchPalette() {
  const { tt } = useApp();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o); }
      else if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => input.current?.focus(), 30);
  }, [open]);

  useEffect(() => {
    if (q.trim().length < 2) return;
    let live = true;
    const h = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q.trim())}`).then((r) => r.json()).then((d) => { if (live) { setHits(d.hits ?? []); setActive(0); } }).catch(() => {});
    }, 180);
    return () => { live = false; clearTimeout(h); };
  }, [q]);

  const shown = q.trim().length < 2 ? [] : hits;
  const go = (h: Hit) => { setOpen(false); setQ(""); router.push(h.href); };

  return (
    <>
      <button onClick={() => setOpen(true)} aria-label={tt("Search (Ctrl+K)", "Хайх (Ctrl+K)")} className="btn btn-ghost !min-h-10 !px-3"><Search size={18} /></button>
      {open && (
        <div className="fixed inset-0 z-[90] grid place-items-start bg-black/60 p-4 pt-24" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label={tt("Search", "Хайлт")} className="glass mx-auto w-full max-w-lg rounded-2xl p-3">
            <div className="flex items-center gap-2 px-2"><Search size={18} className="text-muted" />
              <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder={tt("Search assessments, pages, achievements…", "Тест, хуудас, амжилт хайх…")} aria-label={tt("Search", "Хайлт")} role="combobox" aria-expanded={shown.length > 0} aria-controls="search-results" className="min-h-11 w-full bg-transparent outline-none placeholder:text-muted"
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, shown.length - 1)); }
                  else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
                  else if (e.key === "Enter" && shown[active]) go(shown[active]);
                }} />
            </div>
            <ul id="search-results" role="listbox" className="mt-2 max-h-80 overflow-y-auto">
              {shown.map((h, i) => (
                // Combobox pattern: focus stays in the input (arrow keys + Enter); options are not nested controls.
                <li key={h.href + h.title} role="option" aria-selected={i === active} onClick={() => go(h)} onMouseEnter={() => setActive(i)} className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm ${i === active ? "bg-violet/15" : ""}`}>
                  <span className="min-w-0"><span className="block truncate font-medium">{h.title}</span>{h.sub && <span className="block truncate text-xs text-muted">{h.sub}</span>}</span>
                  <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-[10px] uppercase text-muted">{h.type}</span>
                </li>
              ))}
              {q.trim().length >= 2 && shown.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">{tt("No matches", "Олдсонгүй")}</li>}
              {q.trim().length < 2 && <li className="px-3 py-6 text-center text-sm text-muted">{tt("Type at least 2 characters.", "Дор хаяж 2 тэмдэгт бичнэ үү.")}</li>}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
