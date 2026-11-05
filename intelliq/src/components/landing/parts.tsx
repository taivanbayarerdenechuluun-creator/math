"use client";
import { motion } from "framer-motion";

const EASE: [number, number, number, number] = [0.2, 0.8, 0.2, 1];

/** Scroll-triggered reveal, shared by every landing section. `i` staggers siblings. */
export const reveal = (i = 0) => ({
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.65, delay: Math.min(i, 8) * 0.07, ease: EASE },
});

export function Section({
  id, eyebrow, title, sub, band, children,
}: { id?: string; eyebrow?: string; title: string; sub?: string; band?: boolean; children: React.ReactNode }) {
  const inner = (
    <section id={id} className="mx-auto max-w-7xl scroll-mt-20 px-4 py-24 sm:px-6 sm:py-28">
      <motion.div {...reveal()} className="mx-auto mb-14 max-w-2xl text-center">
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2 className="mt-5 text-balance font-display text-3xl font-bold tracking-tight sm:text-5xl">{title}</h2>
        {sub && <p className="mt-4 text-pretty text-base text-muted sm:text-lg">{sub}</p>}
      </motion.div>
      {children}
    </section>
  );
  return band ? <div className="band">{inner}</div> : inner;
}
