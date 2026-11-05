"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { MotionConfig } from "framer-motion";
import { dictionaries, type Key, type Lang } from "@/lib/i18n";
import { localizeError } from "@/lib/server-errors";

type Theme = "dark" | "light";
type Ctx = {
  theme: Theme;
  toggleTheme: () => void;
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: Key) => string;
  /** Inline bilingual text: tt("English", "Монгол"). */
  tt: (en: string, mn: string) => string;
  /** Server error message in the current language (the API answers in English). */
  te: (msg: string) => string;
};

const C = createContext<Ctx | null>(null);

function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function Providers({ children }: { children: ReactNode }) {
  // Initial values match what the blocking script in <head> already applied.
  const [theme, setTheme] = useState<Theme>("dark");
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const th = document.documentElement.dataset.theme === "light" ? "light" : "dark";
    const lg = read("iq-lang") === "mn" ? "mn" : "en";
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate persisted prefs after mount
    setTheme(th);
    setLangState(lg);
    document.documentElement.lang = lg;
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((cur) => {
      const next = cur === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      try {
        localStorage.setItem("iq-theme", next);
      } catch {}
      return next;
    });
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    document.documentElement.lang = l;
    try {
      localStorage.setItem("iq-lang", l);
    } catch {}
  }, []);

  const t = useCallback((k: Key) => dictionaries[lang][k] ?? dictionaries.en[k], [lang]);

  const tt = useCallback((en: string, mn: string) => (lang === "mn" ? mn : en), [lang]);

  const te = useCallback((msg: string) => localizeError(msg, lang), [lang]);

  // reducedMotion="user": every framer-motion animation drops its movement when the OS asks for less motion.
  return (
    <C.Provider value={{ theme, toggleTheme, lang, setLang, t, tt, te }}>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </C.Provider>
  );
}

export function useApp() {
  const c = useContext(C);
  if (!c) throw new Error("useApp must be used inside Providers");
  return c;
}
