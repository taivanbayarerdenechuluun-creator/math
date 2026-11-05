// Email delivery. Kept free of Next/server-only imports so it can be exercised directly in unit tests against a real
// SMTP server and a mock Resend endpoint; src/lib/mailer.ts wraps it for the app.
import nodemailer, { type Transporter } from "nodemailer";

export type MailMessage = { to: string; subject: string; text: string; html?: string };
export type MailResult = { ok: true; provider: Provider; id?: string } | { ok: false; error: string };
export type Provider = "smtp" | "resend" | "console";
type Env = Record<string, string | undefined>;

/** `MAIL_PROVIDER` = smtp | resend | console. Unset: console while developing, nothing in production. */
export function configuredProvider(env: Env = process.env): Provider | null {
  const p = (env.MAIL_PROVIDER ?? "").trim().toLowerCase();
  if (p === "smtp" || p === "resend" || p === "console") return p;
  return p === "" && env.NODE_ENV !== "production" ? "console" : null;
}

const flag = (v: string | undefined, fallback: boolean) => (v === undefined || v.trim() === "" ? fallback : /^(1|true|yes|on)$/i.test(v.trim()));
// One address, no display name, no separators: the recipient is only ever an account's email.
const SAFE_ADDRESS = /^[^\s<>,;"'()\\]+@[^\s<>,;"'()\\]+$/;

const transports = new Map<string, Transporter>();
function smtpTransport(env: Env): Transporter {
  const host = env.SMTP_HOST?.trim();
  if (!host) throw new Error("SMTP_HOST is not set");
  const port = Number(env.SMTP_PORT || 587);
  const user = env.SMTP_USER?.trim() || undefined;
  if (user && !env.SMTP_PASS) throw new Error("SMTP_USER is set but SMTP_PASS is not");
  const options = {
    host, port,
    secure: flag(env.SMTP_SECURE, port === 465),
    auth: user ? { user, pass: env.SMTP_PASS } : undefined,
    requireTLS: flag(env.SMTP_REQUIRE_TLS, false),
    tls: { rejectUnauthorized: flag(env.SMTP_TLS_REJECT_UNAUTHORIZED, true) },
    connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000,
  };
  const key = JSON.stringify(options); // the whole configuration, so changing any setting (the password included) builds a new transport
  let t = transports.get(key);
  if (!t) transports.set(key, (t = nodemailer.createTransport(options)));
  return t;
}

export async function deliver(msg: MailMessage, env: Env = process.env): Promise<MailResult> {
  const provider = configuredProvider(env);
  if (!provider) return { ok: false, error: "No MAIL_PROVIDER configured (set it to smtp, resend or console)" };
  if (!SAFE_ADDRESS.test(msg.to)) return { ok: false, error: "Invalid recipient address" };
  try {
    if (provider === "console") {
      console.log(`\n[mailer:console] To: ${msg.to}\nSubject: ${msg.subject}\n${msg.text}\n`);
      return { ok: true, provider };
    }
    const from = env.MAIL_FROM?.trim();
    if (!from) return { ok: false, error: "MAIL_FROM is not set" };

    if (provider === "smtp") {
      const info = await smtpTransport(env).sendMail({ from, to: msg.to, subject: msg.subject, text: msg.text, html: msg.html });
      const rejected = [...(info.rejected ?? [])];
      if (rejected.length) return { ok: false, error: `SMTP server rejected the recipient: ${rejected.join(", ")}` };
      return { ok: true, provider, id: info.messageId };
    }

    const key = env.RESEND_API_KEY?.trim();
    if (!key) return { ok: false, error: "RESEND_API_KEY is not set" };
    const res = await fetch(`${(env.RESEND_API_URL || "https://api.resend.com").replace(/\/+$/, "")}/emails`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [msg.to], subject: msg.subject, text: msg.text, ...(msg.html ? { html: msg.html } : {}) }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return { ok: false, error: `Resend responded ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}` };
    const body = (await res.json().catch(() => ({}))) as { id?: string };
    return { ok: true, provider, id: body.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
