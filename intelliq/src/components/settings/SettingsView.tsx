"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Download, Trash2, Upload } from "lucide-react";
import { Navbar } from "../Navbar";
import { Footer } from "../Footer";
import { useApp } from "../Providers";
import { VerifyNotice } from "../auth/VerifyNotice";
import { useStatus } from "../SiteChrome";

type U = { id: string; name: string; email: string; verified: boolean; hasImage: boolean; showOnLeaderboard: boolean; publicProfile: boolean; theme: string; language: string; isAdmin: boolean };
type Msg = { kind: "ok" | "err"; text: string } | null;

async function send(method: string, url: string, body?: unknown) {
  const r = await fetch(url, { method, headers: body === undefined ? undefined : { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { ok: r.ok, data: await r.json().catch(() => ({})) as { error?: string } };
}

function Section({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) {
  return <section id={id} className="card p-5 sm:p-6"><h2 className="mb-4 font-display text-lg font-semibold">{title}</h2>{children}</section>;
}

function Toggle({ label, hint, on, onChange }: { label: string; hint: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div><p className="text-sm font-medium">{label}</p><p className="text-xs text-muted">{hint}</p></div>
      <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? "bg-violet" : "bg-line"}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${on ? "left-[22px]" : "left-0.5"}`} /></button>
    </div>
  );
}

export function SettingsView({ u }: { u: U }) {
  const { tt, te, theme, toggleTheme, lang, setLang } = useApp();
  const { refresh } = useStatus();
  const router = useRouter();
  const [name, setName] = useState(u.name);
  const [flags, setFlags] = useState({ showOnLeaderboard: u.showOnLeaderboard, publicProfile: u.publicProfile });
  const [hasImage, setHasImage] = useState(u.hasImage);
  const [msg, setMsg] = useState<Msg>(null);
  const [pw, setPw] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const flash = (kind: "ok" | "err", text: string) => setMsg({ kind, text });

  async function save(body: object, ok: string) {
    const r = await send("PATCH", "/api/account", body);
    flash(r.ok ? "ok" : "err", r.ok ? ok : te(r.data.error ?? "Failed."));
    if (r.ok) { refresh(); router.refresh(); }
    return r.ok;
  }

  async function avatar(f: File | undefined) {
    if (!f) return;
    const form = new FormData();
    form.append("file", f);
    const r = await fetch("/api/account/avatar", { method: "POST", body: form });
    const d = await r.json().catch(() => ({}));
    if (r.ok) { setHasImage(true); flash("ok", tt("Photo updated.", "Зураг шинэчлэгдлээ.")); refresh(); } else flash("err", te(d.error ?? "Upload failed."));
    if (file.current) file.current.value = "";
  }

  async function removeAvatar() {
    const r = await send("DELETE", "/api/account/avatar");
    if (r.ok) { setHasImage(false); flash("ok", tt("Photo removed.", "Зураг устгагдлаа.")); refresh(); }
  }

  async function deleteAccount() {
    const r = await send("DELETE", "/api/account", { password: pw });
    if (r.ok) window.location.href = "/";
    else flash("err", te(r.data.error ?? "Failed."));
  }

  return (
    <>
      <Navbar />
      <main id="main" className="mx-auto max-w-2xl px-4 pb-20 pt-28 sm:px-6">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{tt("Settings", "Тохиргоо")}</h1>
        <div role="status" aria-live="polite" className="mt-3 min-h-6 text-sm">{msg && <span className={msg.kind === "ok" ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-300"}>{msg.text}</span>}</div>

        <div className="space-y-5">
          <Section title={tt("Profile", "Профайл")}>
            <div className="flex flex-wrap items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {hasImage ? <img src={`/api/avatar/${u.id}?v=${hasImage}`} alt={tt("Your photo", "Таны зураг")} width={72} height={72} className="h-18 w-18 rounded-full object-cover" style={{ width: 72, height: 72 }} /> : <div className="grid h-[72px] w-[72px] place-items-center rounded-full bg-gradient-to-br from-violet to-cyan font-display text-3xl font-bold text-white" aria-hidden="true">{name.charAt(0).toUpperCase()}</div>}
              <div className="flex flex-wrap gap-2">
                <input ref={file} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" id="avatar" onChange={(e) => void avatar(e.target.files?.[0])} />
                <label htmlFor="avatar" className="btn btn-ghost !min-h-10 cursor-pointer text-sm"><Upload size={16} /> {tt("Upload photo", "Зураг оруулах")}</label>
                {hasImage && <button onClick={() => void removeAvatar()} className="btn btn-ghost !min-h-10 text-sm">{tt("Remove", "Устгах")}</button>}
              </div>
              <p className="w-full text-xs text-muted">{tt("PNG, JPEG, WebP or GIF up to 1 MB. It is only shown publicly if you enable your public profile.", "1 MB хүртэлх PNG, JPEG, WebP эсвэл GIF. Олон нийтийн профайлаа идэвхжүүлсэн тохиолдолд л олон нийтэд харагдана.")}</p>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div><label htmlFor="name" className="mb-1.5 block text-sm text-muted">{tt("Display name", "Нэр")}</label><input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className="input" /></div>
              <div><label htmlFor="email" className="mb-1.5 block text-sm text-muted">{tt("Email", "Имэйл")}</label><input id="email" value={u.email} readOnly className="input opacity-70" />{u.verified ? <p className="mt-1 text-xs text-muted">{tt("Verified", "Баталгаажсан")}</p> : <><p className="mt-1 text-xs text-muted">{tt("Not verified yet", "Баталгаажаагүй")}</p><VerifyNotice email={u.email} compact /></>}</div>
            </div>
            <button onClick={() => void save({ name }, tt("Profile saved.", "Профайл хадгалагдлаа."))} disabled={name.trim() === u.name || name.trim().length < 2} className="btn btn-primary mt-4 !min-h-10 text-sm disabled:opacity-50">{tt("Save profile", "Профайл хадгалах")}</button>
          </Section>

          <Section title={tt("Preferences", "Тохируулга")}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><p className="mb-1.5 text-sm text-muted">{tt("Theme", "Загвар")}</p><div className="flex gap-2">{(["dark", "light"] as const).map((t) => <button key={t} aria-pressed={theme === t} onClick={() => { if (theme !== t) toggleTheme(); void save({ theme: t }, tt("Preference saved.", "Тохируулга хадгалагдлаа.")); }} className={`btn !min-h-10 text-sm ${theme === t ? "btn-primary" : "btn-ghost"}`}>{t === "dark" ? tt("Dark", "Харанхуй") : tt("Light", "Гэгээтэй")}</button>)}</div></div>
              <div><p className="mb-1.5 text-sm text-muted">{tt("Language", "Хэл")}</p><div className="flex gap-2">{(["en", "mn"] as const).map((l) => <button key={l} aria-pressed={lang === l} onClick={() => { setLang(l); void save({ language: l }, tt("Preference saved.", "Тохируулга хадгалагдлаа.")); }} className={`btn !min-h-10 text-sm ${lang === l ? "btn-primary" : "btn-ghost"}`}>{l === "en" ? "English" : "Монгол"}</button>)}</div></div>
            </div>
          </Section>

          <Section title={tt("Privacy", "Нууцлал")}>
            <div className="divide-y divide-line">
              <Toggle label={tt("Appear on leaderboards", "Тэргүүлэгчдийн жагсаалтад орох")} hint={tt("Shows your first name, level and score. Off by default.", "Таны нэр (эхний үг), түвшин, оноог харуулна. Анхдагчаар унтраастай.")} on={flags.showOnLeaderboard} onChange={(v) => { setFlags((f) => ({ ...f, showOnLeaderboard: v })); void save({ showOnLeaderboard: v }, tt("Privacy updated.", "Нууцлал шинэчлэгдлээ.")); }} />
              <Toggle label={tt("Public profile card", "Олон нийтийн профайл")} hint={tt("Anyone with the link sees your first name, level and badges. Off by default.", "Холбоос бүхий хүн таны нэр (эхний үг), түвшин, тэмдгийг харна. Анхдагчаар унтраастай.")} on={flags.publicProfile} onChange={(v) => { setFlags((f) => ({ ...f, publicProfile: v })); void save({ publicProfile: v }, tt("Privacy updated.", "Нууцлал шинэчлэгдлээ.")); }} />
            </div>
            {flags.publicProfile && <p className="mt-2 text-sm"><Link href={`/u/${u.id}`} className="text-violet-fg underline underline-offset-2 hover:no-underline">{tt("View your public card", "Олон нийтийн картаа харах")}</Link></p>}
            <p className="mt-3 text-xs text-muted">{tt("Your email and full name are never shown publicly.", "Таны имэйл, бүтэн нэр хэзээ ч олон нийтэд харагдахгүй.")}</p>
          </Section>

          <Section title={tt("Your data", "Таны өгөгдөл")}>
            <a href="/api/export" className="btn btn-ghost !min-h-10 text-sm"><Download size={16} /> {tt("Export my results (CSV)", "Үр дүнгээ экспортлох (CSV)")}</a>
          </Section>

          <Section title={tt("Delete account", "Бүртгэл устгах")} id="delete">
            <p className="text-sm text-muted">{tt("This permanently deletes your account, results, reports, XP, badges and photo. It cannot be undone.", "Энэ нь таны бүртгэл, үр дүн, тайлан, XP, тэмдэг, зургийг бүрмөсөн устгана. Буцаах боломжгүй.")}</p>
            {!confirmDel ? (
              <button onClick={() => setConfirmDel(true)} className="btn btn-ghost mt-4 !min-h-10 text-sm text-rose-700 dark:text-rose-400"><Trash2 size={16} /> {tt("Delete my account…", "Бүртгэлээ устгах…")}</button>
            ) : (
              <div className="mt-4 space-y-3 rounded-xl border border-rose-400/40 bg-rose-400/5 p-4">
                <label htmlFor="pw" className="block text-sm">{tt("Confirm with your password", "Нууц үгээрээ баталгаажуулна уу")}</label>
                <input id="pw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" className="input" />
                <div className="flex gap-2"><button onClick={() => void deleteAccount()} disabled={!pw} className="btn !min-h-10 bg-rose-500 text-sm text-white disabled:opacity-50">{tt("Permanently delete", "Бүрмөсөн устгах")}</button><button onClick={() => { setConfirmDel(false); setPw(""); }} className="btn btn-ghost !min-h-10 text-sm">{tt("Cancel", "Цуцлах")}</button></div>
              </div>
            )}
            {u.isAdmin && <p className="mt-3 text-xs text-muted">{tt("Administrators must keep at least one other active administrator before deleting their account.", "Админ өөрийн бүртгэлийг устгахаас өмнө өөр нэг идэвхтэй админтай байх ёстой.")}</p>}
          </Section>
        </div>
      </main>
      <Footer />
    </>
  );
}
