"use client";
import Link from "next/link";
import { useState } from "react";
import { Award, Check, Copy, Download, FileSpreadsheet, Link2, Link2Off } from "lucide-react";
import { useApp } from "../Providers";

export function ShareBar({ id, initialToken, signedIn }: { id: string; initialToken: string | null; signedIn: boolean }) {
  const { tt, lang, te } = useApp();
  const [token, setToken] = useState(initialToken);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState("");
  const url = token && typeof window !== "undefined" ? `${window.location.origin}/r/${token}` : "";

  async function toggle(enable: boolean) {
    setBusy(true);
    setErr("");
    const r = await fetch(`/api/results/${id}/share`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enable }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.ok) setToken(j.shareToken);
    else setErr(te(j.error ?? "Error"));
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setErr(tt("Copy failed; select the link and copy it manually.", "Хуулж чадсангүй; холбоосыг гараар хуулна уу."));
    }
  }

  return (
    <section className="card mt-5 p-6 sm:p-8" aria-label={tt("Report, sharing and export", "Тайлан, хуваалцах, экспорт")}>
      <h2 className="font-display text-xl font-semibold">{tt("Report & sharing", "Тайлан ба хуваалцах")}</h2>
      <div className="mt-4 flex flex-wrap gap-3">
        <a href={`/api/results/${id}/pdf?lang=${lang}`} className="btn btn-primary !min-h-10 text-sm"><Download size={16} /> {tt("Download PDF report", "PDF тайлан татах")}</a>
        <Link href={`/certificate/${id}`} className="btn btn-ghost !min-h-10 text-sm"><Award size={16} /> {tt("Participation certificate", "Оролцооны гэрчилгээ")}</Link>
        {signedIn && <a href="/api/export" className="btn btn-ghost !min-h-10 text-sm"><FileSpreadsheet size={16} /> {tt("Export all results (CSV)", "Бүх үр дүн (CSV)")}</a>}
        {token ? (
          <button onClick={() => void toggle(false)} disabled={busy} className="btn btn-ghost !min-h-10 text-sm"><Link2Off size={16} /> {tt("Stop sharing", "Хуваалцахаа зогсоох")}</button>
        ) : (
          <button onClick={() => void toggle(true)} disabled={busy} className="btn btn-ghost !min-h-10 text-sm"><Link2 size={16} /> {tt("Create share link", "Хуваалцах холбоос үүсгэх")}</button>
        )}
      </div>
      {token && (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-deep p-3 text-sm">
          <input readOnly value={url} aria-label={tt("Share link", "Хуваалцах холбоос")} className="input !min-h-9 flex-1 font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
          <button onClick={() => void copy()} className="btn btn-ghost !min-h-9 text-sm">{copied ? <Check size={16} /> : <Copy size={16} />} {copied ? tt("Copied", "Хуулсан") : tt("Copy", "Хуулах")}</button>
        </div>
      )}
      <p className="mt-3 text-xs text-muted">{tt("A share link shows only scores and domain results: no name, email or answers. You can revoke it at any time.", "Хуваалцах холбоос зөвхөн оноо, чадварын үр дүнг харуулна: нэр, имэйл, хариултгүй. Хэзээ ч цуцалж болно.")}</p>
      {err && <p role="alert" className="mt-2 text-sm text-rose-700 dark:text-rose-300">{err}</p>}
    </section>
  );
}
