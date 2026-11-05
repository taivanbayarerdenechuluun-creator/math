"use client";
import { motion } from "framer-motion";
import { Navbar } from "../Navbar";

export function AuthShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main id="main" className="relative grid min-h-screen place-items-center px-4 pb-12 pt-24">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.18),transparent_60%)]" />
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass relative w-full max-w-md rounded-2xl p-6 sm:p-8">
          <h1 className="font-display text-2xl font-bold">{title}</h1>
          <div className="mt-6">{children}</div>
        </motion.div>
      </main>
    </>
  );
}

export function Field({ label, id, ...p }: { label: string; id: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm text-muted">{label}</label>
      <input id={id} name={id} className="input" {...p} />
    </div>
  );
}

export function FormError({ msg }: { msg: string }) {
  return msg ? (
    <p role="alert" className="rounded-lg border border-rose-400/40 bg-rose-400/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">{msg}</p>
  ) : null;
}
