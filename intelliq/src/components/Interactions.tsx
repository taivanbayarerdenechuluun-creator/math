"use client";
import { useEffect } from "react";

/**
 * Pointer polish without per-component listeners (one delegated listener, no layout reads outside the hovered element):
 *  - `.spot` and `.btn-primary` get --mx/--my, the pointer position inside them, which their CSS turns into a light;
 *  - `[data-magnetic]` leans a few pixels towards the pointer (the `translate` property, so it never fights `transform`).
 * Nothing runs on touch screens, and the magnetic lean is skipped for prefers-reduced-motion.
 */
export function Interactions() {
  useEffect(() => {
    const fine = matchMedia("(hover: hover) and (pointer: fine)");
    if (!fine.matches) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)");
    let magnet: HTMLElement | null = null;

    const release = () => {
      if (magnet) magnet.style.translate = "";
      magnet = null;
    };
    const move = (e: PointerEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      const lit = target?.closest<HTMLElement>(".spot, .btn-primary");
      if (lit) {
        const r = lit.getBoundingClientRect();
        lit.style.setProperty("--mx", `${Math.round(e.clientX - r.left)}px`);
        lit.style.setProperty("--my", `${Math.round(e.clientY - r.top)}px`);
      }
      const next = reduce.matches ? null : (target?.closest<HTMLElement>("[data-magnetic]") ?? null);
      if (magnet && magnet !== next) release();
      if (!next) return;
      magnet = next;
      const r = next.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
      const dy = (e.clientY - (r.top + r.height / 2)) / r.height;
      next.style.translate = `${(dx * 12).toFixed(1)}px ${(dy * 9).toFixed(1)}px`;
    };

    document.addEventListener("pointermove", move, { passive: true });
    document.documentElement.addEventListener("pointerleave", release);
    return () => {
      document.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("pointerleave", release);
      release();
    };
  }, []);

  return null;
}
