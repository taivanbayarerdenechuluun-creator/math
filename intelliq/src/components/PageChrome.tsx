"use client";
import Link from "next/link";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useApp } from "./Providers";

/** "Skip to content" for keyboard and screen-reader users, in the language of the interface. */
export function SkipLink() {
  const { tt } = useApp();
  return (
    <a href="#main" className="sr-only z-[200] rounded-lg bg-violet-700 px-4 py-2 text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
      {tt("Skip to content", "Агуулга руу шилжих")}
    </a>
  );
}

// Pages with no <h1> of their own get a fixed Mongolian title.
const FALLBACK_MN: [string, string][] = [["/test/", "Тест үргэлжилж байна"], ["/results/", "Таны үр дүн"], ["/certificate/", "Оролцооны гэрчилгээ"], ["/r/", "Хуваалцсан үр дүн"]];

/**
 * The server sends page titles in English (the language is a choice kept on the device). In Mongolian the tab title is
 * rebuilt from the page's own, already translated, <h1>; switching back restores the server's title.
 */
export function TitleSync() {
  const { lang } = useApp();
  const path = usePathname();

  useEffect(() => {
    const el = document.querySelector("title");
    if (!el) return;
    let server = document.title; // the latest title that came from the server
    let ours = "";
    const apply = () => {
      if (document.title !== ours) server = document.title;
      let next = server;
      if (lang === "mn") {
        const h1 = document.querySelector("h1")?.textContent?.replace(/\s+/g, " ").trim();
        const fallback = FALLBACK_MN.find(([p]) => window.location.pathname.startsWith(p))?.[1];
        const heading = h1 || fallback;
        if (heading) next = `${heading} · INTELLIQ`;
      }
      if (next !== document.title) { ours = next; document.title = next; }
    };
    apply();
    const obs = new MutationObserver(apply);
    obs.observe(el, { childList: true, characterData: true, subtree: true });
    const late = setTimeout(apply, 700); // headings that render after data arrives
    return () => { obs.disconnect(); clearTimeout(late); };
  }, [lang, path]);

  return null;
}

export function NotFoundView() {
  const { tt } = useApp();
  return (
    <div>
      <p className="grad-text font-display text-8xl font-bold">404</p>
      <h1 className="mt-4 font-display text-2xl font-bold">{tt("This pattern doesn't exist", "Ийм хэв маяг байхгүй")}</h1>
      <p className="mt-2 text-muted">{tt("The page you were looking for could not be found.", "Таны хайсан хуудас олдсонгүй.")}</p>
      <Link href="/" className="btn btn-primary mt-6">{tt("Back home", "Нүүр хуудас руу")}</Link>
    </div>
  );
}
