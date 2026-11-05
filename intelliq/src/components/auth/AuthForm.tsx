"use client";
import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useApp } from "../Providers";
import { AuthShell, Field, FormError } from "./AuthShell";

async function post(url: string, body: unknown) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  return { ok: r.ok, error: (d.error as string) ?? "Something went wrong." };
}

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const { t, tt, te, lang } = useApp();
  const params = useSearchParams();
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const isReg = mode === "register";
  const notice = params.get("verified") === "1" ? tt("Email verified. You can log in.", "Имэйл баталгаажлаа. Одоо нэвтэрч болно.") : params.get("verified") === "0" ? tt("Verification link invalid or expired.", "Баталгаажуулах холбоос буруу эсвэл хугацаа нь дууссан байна.") : "";

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    const f = new FormData(e.currentTarget);
    const res = await post(`/api/auth/${mode}`, {
      name: f.get("name"),
      email: f.get("email"),
      password: f.get("password"),
      ...(isReg ? { lang } : {}),
    });
    if (res.ok) window.location.href = "/dashboard";
    else {
      setErr(te(res.error));
      setBusy(false);
    }
  }

  return (
    <AuthShell title={isReg ? t("auth.signup") : t("auth.login")}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {notice && <p role="status" className="rounded-lg border border-cyan/40 bg-cyan/10 px-3 py-2 text-sm">{notice}</p>}
        {isReg && <Field id="name" label={t("auth.name")} autoComplete="name" required minLength={2} />}
        <Field id="email" type="email" label={t("auth.email")} autoComplete="email" required />
        <Field id="password" type="password" label={t("auth.password")} autoComplete={isReg ? "new-password" : "current-password"} required />
        {isReg && <p className="text-xs text-muted">{t("auth.hint")}</p>}
        <FormError msg={err} />
        <button className="btn btn-primary w-full" disabled={busy}>
          {busy ? t("common.loading") : isReg ? t("auth.submit.signup") : t("auth.submit.login")}
        </button>
      </form>
      <div className="mt-5 space-y-2 text-center text-sm text-muted">
        {!isReg && <p><Link href="/forgot-password" className="text-violet-fg underline underline-offset-2 hover:no-underline">{t("auth.forgot")}</Link></p>}
        <p>
          {isReg ? t("auth.hasacct") : t("auth.noacct")}{" "}
          <Link href={isReg ? "/login" : "/register"} className="text-violet-fg underline underline-offset-2 hover:no-underline">
            {isReg ? t("nav.login") : t("nav.signup")}
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}

export function ForgotForm() {
  const { t, te, lang } = useApp();
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = new FormData(e.currentTarget).get("email");
    const r = await post("/api/auth/forgot", { email, lang });
    if (r.ok) setSent(true);
    else setErr(te(r.error));
  }
  return (
    <AuthShell title={t("auth.forgot.title")}>
      {sent ? (
        <p role="status" className="text-sm text-muted">{t("auth.forgot.sent")}</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field id="email" type="email" label={t("auth.email")} required autoComplete="email" />
          <FormError msg={err} />
          <button className="btn btn-primary w-full">{t("auth.forgot.send")}</button>
        </form>
      )}
    </AuthShell>
  );
}

export function ResetForm() {
  const { t, te } = useApp();
  const token = useSearchParams().get("token") ?? "";
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const password = new FormData(e.currentTarget).get("password");
    const r = await post("/api/auth/reset", { token, password });
    if (r.ok) setDone(true);
    else setErr(te(r.error));
  }
  return (
    <AuthShell title={t("auth.reset.title")}>
      {done ? (
        <p role="status" className="text-sm">
          {t("auth.reset.done")} <Link href="/login" className="text-violet-fg underline underline-offset-2 hover:no-underline">{t("nav.login")}</Link>
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field id="password" type="password" label={t("auth.password")} required autoComplete="new-password" />
          <p className="text-xs text-muted">{t("auth.hint")}</p>
          <FormError msg={err} />
          <button className="btn btn-primary w-full">{t("auth.reset.submit")}</button>
        </form>
      )}
    </AuthShell>
  );
}
