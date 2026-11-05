"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useApp } from "@/components/Providers";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { tt } = useApp();
  useEffect(() => {
    console.error(JSON.stringify({ level: "error", source: "client-boundary", message: error.message, digest: error.digest }));
  }, [error]);
  return (
    <main id="main" className="grid min-h-screen place-items-center px-4 text-center">
      <div className="max-w-md">
        <p className="grad-text font-display text-7xl font-bold">!</p>
        <h1 className="mt-4 font-display text-2xl font-bold">{tt("Something went wrong", "Алдаа гарлаа")}</h1>
        <p className="mt-2 text-muted">{tt("An unexpected error occurred. Your saved progress is safe; you can retry or go back home.", "Санаанд оромгүй алдаа гарлаа. Таны хадгалсан ахиц аюулгүй; дахин оролдох эсвэл нүүр хуудас руу буцна уу.")}</p>
        {error.digest && <p className="mt-2 font-mono text-xs text-muted">ref: {error.digest}</p>}
        <div className="mt-6 flex justify-center gap-3"><button onClick={reset} className="btn btn-primary">{tt("Try again", "Дахин оролдох")}</button><Link href="/" className="btn btn-ghost">{tt("Home", "Нүүр")}</Link></div>
      </div>
    </main>
  );
}
