"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { motion } from "framer-motion";
import { useApp } from "../Providers";
import { reveal } from "./parts";

export type FaqItem = { q: { en: string; mn: string }; a: { en: string; mn: string } };

/** Accordion: one answer open at a time; the height animates (see ".acc-panel"), closed answers are inert. */
export function Faq({ items }: { items: FaqItem[] }) {
  const { lang } = useApp();
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="mx-auto max-w-3xl space-y-3">
      {items.map((f, i) => {
        const on = open === i;
        return (
          <motion.div key={f.q.en} {...reveal(i)} className={`panel overflow-hidden transition-[border-color,box-shadow] duration-300 ${on ? "border-violet/50 shadow-[var(--glow)]" : ""}`}>
            <h3>
              <button
                type="button"
                id={`faq-b-${i}`}
                aria-expanded={on}
                aria-controls={`faq-p-${i}`}
                onClick={() => setOpen(on ? null : i)}
                className="flex w-full cursor-pointer items-center justify-between gap-4 p-5 text-left text-base font-semibold sm:text-lg"
              >
                <span>{f.q[lang]}</span>
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line transition-all duration-300 ${on ? "rotate-45 border-violet bg-violet/15 text-violet-fg" : "text-muted"}`}>
                  <Plus size={16} />
                </span>
              </button>
            </h3>
            <div id={`faq-p-${i}`} role="region" aria-labelledby={`faq-b-${i}`} className="acc-panel" data-open={on} inert={!on}>
              <div>
                <p className="px-5 pb-5 leading-relaxed text-muted">{f.a[lang]}</p>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
