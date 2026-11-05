"use client";
import { useState } from "react";
import { MailWarning } from "lucide-react";
import { useApp } from "../Providers";

type State = { kind: "idle" } | { kind: "busy" } | { kind: "sent" } | { kind: "already" } | { kind: "err"; text: string };

/** For a signed-in user whose email is not verified yet: asks the server to send a fresh link to their own address. */
export function VerifyNotice({ email, compact = false }: { email: string; compact?: boolean }) {
  const { tt, te, lang } = useApp();
  const [s, setS] = useState<State>({ kind: "idle" });

  async function resend() {
    setS({ kind: "busy" });
    try {
      const r = await fetch("/api/auth/resend-verification", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lang }) });
      const d = await r.json().catch(() => ({}));
      setS(r.ok ? { kind: d.already ? "already" : "sent" } : { kind: "err", text: te(d.error ?? "Something went wrong.") });
    } catch {
      setS({ kind: "err", text: te("Something went wrong.") });
    }
  }

  const status =
    s.kind === "sent" ? tt(`We sent a new link to ${email}. Check your inbox and spam folder.`, `${email} хаяг руу шинэ холбоос илгээлээ. Ирсэн болон спам хавтсаа шалгана уу.`)
    : s.kind === "already" ? tt("Your email is already verified.", "Таны имэйл аль хэдийн баталгаажсан байна.")
    : s.kind === "err" ? s.text
    : "";
  const button = (
    <button type="button" onClick={() => void resend()} disabled={s.kind === "busy" || s.kind === "sent"} className={compact ? "btn btn-ghost !min-h-9 text-xs disabled:opacity-60" : "btn btn-ghost !min-h-10 text-sm disabled:opacity-60"}>
      {s.kind === "busy" ? tt("Sending…", "Илгээж байна…") : tt("Resend verification email", "Баталгаажуулах имэйлийг дахин илгээх")}
    </button>
  );

  if (compact)
    return (
      <div className="mt-1 flex flex-wrap items-center gap-2">
        {button}
        <span role={s.kind === "err" ? "alert" : "status"} className={`text-xs ${s.kind === "err" ? "text-rose-700 dark:text-rose-300" : "text-muted"}`}>{status}</span>
      </div>
    );

  return (
    <section aria-label={tt("Email verification", "Имэйл баталгаажуулалт")} className="mb-6 flex flex-wrap items-center gap-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
      <MailWarning size={22} className="shrink-0 text-amber-700 dark:text-amber-400" aria-hidden="true" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold">{tt("Please verify your email address", "Имэйл хаягаа баталгаажуулна уу")}</p>
        <p className="text-muted">{tt(`We sent a link to ${email}. It keeps your account recoverable if you forget your password.`, `${email} хаяг руу холбоос илгээсэн. Нууц үгээ мартсан үед бүртгэлээ сэргээхэд тусална.`)}</p>
        <p role={s.kind === "err" ? "alert" : "status"} className={`mt-1 ${s.kind === "err" ? "text-rose-700 dark:text-rose-300" : "text-ink"}`}>{status}</p>
      </div>
      {button}
    </section>
  );
}
