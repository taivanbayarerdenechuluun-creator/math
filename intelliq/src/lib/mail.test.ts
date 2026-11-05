import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import type { AddressInfo } from "node:net";
import { SMTPServer, type SMTPServerOptions } from "smtp-server";
import { simpleParser, type ParsedMail } from "mailparser";
import { configuredProvider, deliver } from "./mail-transport";
import { mailLang, resetMail, verificationMail } from "./mail-templates";

// ---------- helpers: a real SMTP server and a mock Resend endpoint, both on random local ports ----------

async function smtpServer(opts: SMTPServerOptions = {}) {
  const got: ParsedMail[] = [];
  const envelopes: { from: string | false; to: string[] }[] = [];
  const server = new SMTPServer({
    authOptional: true,
    disabledCommands: ["STARTTLS"],
    allowInsecureAuth: true,
    onData(stream, session, cb) {
      simpleParser(stream).then((m) => { got.push(m); envelopes.push({ from: session.envelope.mailFrom && session.envelope.mailFrom.address, to: session.envelope.rcptTo.map((r) => r.address) }); cb(); }, cb);
    },
    ...opts,
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  return { got, envelopes, port: (server.server.address() as AddressInfo).port, close: () => new Promise<void>((r) => server.close(() => r())) };
}

async function resendServer(status = 200, body: unknown = { id: "re_123" }) {
  const seen: { auth?: string; type?: string; url?: string; json?: Record<string, unknown> }[] = [];
  const server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      seen.push({ auth: req.headers.authorization, type: req.headers["content-type"], url: req.url, json: raw ? JSON.parse(raw) : undefined });
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(typeof body === "string" ? body : JSON.stringify(body));
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  return { seen, url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, close: () => new Promise<void>((r) => server.close(() => r())) };
}

const FROM = "INTELLIQ <no-reply@intelliq.test>";
const smtpEnv = (port: number, extra: Record<string, string> = {}) => ({ MAIL_PROVIDER: "smtp", SMTP_HOST: "127.0.0.1", SMTP_PORT: String(port), MAIL_FROM: FROM, ...extra });
const mn = verificationMail("mn", { name: "Бат-Эрдэнэ", url: "https://intelliq.test/api/auth/verify?token=abc123&x=1" });

// ---------- provider selection ----------

test("provider selection: console while developing, explicit in production, unknown values refused", () => {
  assert.equal(configuredProvider({}), "console");
  assert.equal(configuredProvider({ NODE_ENV: "development" }), "console");
  assert.equal(configuredProvider({ NODE_ENV: "production" }), null, "production must not silently fall back to the console");
  assert.equal(configuredProvider({ NODE_ENV: "production", MAIL_PROVIDER: "SMTP" }), "smtp");
  assert.equal(configuredProvider({ MAIL_PROVIDER: " resend " }), "resend");
  assert.equal(configuredProvider({ MAIL_PROVIDER: "sendgrid" }), null);
});

test("with no provider the result says why instead of pretending to send", async () => {
  const r = await deliver({ to: "a@b.co", subject: "s", text: "t" }, { NODE_ENV: "production" });
  assert.equal(r.ok, false);
  assert.match((r as { error: string }).error, /MAIL_PROVIDER/);
});

// ---------- SMTP ----------

test("SMTP: a Mongolian message arrives intact with both text and HTML parts", async () => {
  const s = await smtpServer();
  try {
    const r = await deliver({ to: "user@example.com", ...mn }, smtpEnv(s.port));
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(s.got.length, 1);
    const m = s.got[0];
    assert.equal(m.subject, mn.subject);
    assert.equal(m.text?.trim(), mn.text.trim());
    assert.equal(m.html && m.html.includes("Имэйлээ баталгаажуулах"), true);
    assert.equal(m.from?.value[0].address, "no-reply@intelliq.test");
    assert.equal(m.from?.value[0].name, "INTELLIQ");
    assert.deepEqual(s.envelopes[0].to, ["user@example.com"]);
  } finally { await s.close(); }
});

test("SMTP: authentication is used when configured, and a wrong password is reported, not thrown", async () => {
  const s = await smtpServer({ authOptional: false, onAuth(auth, _session, cb) { if (auth.username === "mailer" && auth.password === "s3cret") cb(null, { user: "mailer" }); else cb(new Error("Invalid login")); } });
  try {
    const good = await deliver({ to: "user@example.com", subject: "hi", text: "x" }, smtpEnv(s.port, { SMTP_USER: "mailer", SMTP_PASS: "s3cret" }));
    assert.equal(good.ok, true, JSON.stringify(good));
    const bad = await deliver({ to: "user@example.com", subject: "hi", text: "x" }, smtpEnv(s.port, { SMTP_USER: "mailer", SMTP_PASS: "wrong" }));
    assert.equal(bad.ok, false);
    assert.match((bad as { error: string }).error, /login|auth|535/i);
    const noPass = await deliver({ to: "user@example.com", subject: "hi", text: "x" }, smtpEnv(s.port, { SMTP_USER: "mailer" }));
    assert.equal(noPass.ok, false);
    assert.match((noPass as { error: string }).error, /SMTP_PASS/);
    assert.equal(s.got.length, 1, "only the authenticated message was accepted");
  } finally { await s.close(); }
});

test("SMTP: a refused recipient and an unreachable server are both reported as failures", async () => {
  const s = await smtpServer({ onRcptTo(_a, _s, cb) { cb(new Error("550 no such user")); } });
  try {
    const r = await deliver({ to: "nobody@example.com", subject: "hi", text: "x" }, smtpEnv(s.port));
    assert.equal(r.ok, false);
  } finally { await s.close(); }
  const free = await new Promise<number>((res) => { const t = net.createServer(); t.listen(0, "127.0.0.1", () => { const p = (t.address() as AddressInfo).port; t.close(() => res(p)); }); });
  const t0 = Date.now();
  const down = await deliver({ to: "user@example.com", subject: "hi", text: "x" }, smtpEnv(free));
  assert.equal(down.ok, false);
  assert.ok(Date.now() - t0 < 5000, "a closed port must fail fast");
});

test("SMTP: configuration problems are explained", async () => {
  const msg = { to: "user@example.com", subject: "hi", text: "x" };
  assert.match(((await deliver(msg, { MAIL_PROVIDER: "smtp", MAIL_FROM: FROM })) as { error: string }).error, /SMTP_HOST/);
  assert.match(((await deliver(msg, { MAIL_PROVIDER: "smtp", SMTP_HOST: "127.0.0.1" })) as { error: string }).error, /MAIL_FROM/);
  assert.match(((await deliver(msg, { MAIL_PROVIDER: "resend", MAIL_FROM: FROM })) as { error: string }).error, /RESEND_API_KEY/);
});

test("recipients that could inject headers or add more addresses are refused before any connection", async () => {
  const s = await smtpServer();
  try {
    for (const to of ["a@b.co, c@d.co", "a@b.co\r\nBcc: evil@x.co", "A <a@b.co>", "no-at-sign", "a@b.co;c@d.co", ""]) {
      const r = await deliver({ to, subject: "hi", text: "x" }, smtpEnv(s.port));
      assert.equal(r.ok, false, JSON.stringify(to));
      assert.match((r as { error: string }).error, /recipient/i);
    }
    assert.equal(s.got.length, 0);
  } finally { await s.close(); }
});

// ---------- Resend ----------

test("Resend: the request has the right shape and the id is returned", async () => {
  const s = await resendServer();
  try {
    const r = await deliver({ to: "user@example.com", ...mn }, { MAIL_PROVIDER: "resend", RESEND_API_KEY: "re_key", RESEND_API_URL: s.url + "/", MAIL_FROM: FROM });
    assert.deepEqual(r, { ok: true, provider: "resend", id: "re_123" });
    assert.equal(s.seen.length, 1);
    const q = s.seen[0];
    assert.equal(q.url, "/emails");
    assert.equal(q.auth, "Bearer re_key");
    assert.equal(q.type, "application/json");
    assert.deepEqual(q.json, { from: FROM, to: ["user@example.com"], subject: mn.subject, text: mn.text, html: mn.html });
  } finally { await s.close(); }
});

test("Resend: an error status is reported with its details", async () => {
  const s = await resendServer(422, { message: "The from domain is not verified" });
  try {
    const r = await deliver({ to: "user@example.com", subject: "hi", text: "x" }, { MAIL_PROVIDER: "resend", RESEND_API_KEY: "re_key", RESEND_API_URL: s.url, MAIL_FROM: FROM });
    assert.equal(r.ok, false);
    assert.match((r as { error: string }).error, /422.*not verified/);
  } finally { await s.close(); }
});

// ---------- templates ----------

test("templates: both languages, the link is present as text and as a button, and everything is escaped", () => {
  const url = "https://intelliq.test/reset-password?token=abc&next=%2Fdashboard";
  const hostile = '<script>alert("x")</script> & Co';
  for (const lang of ["en", "mn"] as const) {
    for (const m of [verificationMail(lang, { name: hostile, url }), resetMail(lang, { name: hostile, url, validMinutes: 60 })]) {
      assert.ok(m.text.includes(url), `${lang}: the plain-text part carries the link`);
      assert.ok(m.html.includes(`href="${url.replace(/&/g, "&amp;")}"`), `${lang}: the button links to the escaped URL`);
      assert.ok(!m.html.includes("<script>"), `${lang}: a hostile name must not become markup`);
      assert.ok(m.html.includes("&lt;script&gt;"), lang);
      assert.ok(m.html.startsWith("<!doctype html>") && m.html.includes(`<html lang="${lang}">`), lang);
      assert.ok(m.subject.length > 10 && !/[\r\n]/.test(m.subject), `${lang}: a one-line subject`);
    }
  }
  assert.match(resetMail("en", { name: "A", url, validMinutes: 45 }).text, /45 minutes/);
  assert.match(resetMail("mn", { name: "A", url, validMinutes: 45 }).text, /45 минут/);
});

test("templates: the Mongolian emails are fully Mongolian", () => {
  const url = "https://intelliq.test/x?token=abc";
  for (const m of [verificationMail("mn", { name: "Бат", url }), resetMail("mn", { name: "Бат", url, validMinutes: 60 })]) {
    const prose = (m.subject + "\n" + m.text).replace(url, "");
    assert.ok(/[Ѐ-ӿ]/.test(prose), "contains Cyrillic");
    assert.ok(!/[a-z]{2,}/.test(prose), `untranslated English left in: ${prose.match(/[a-z]{2,}/)}`);
  }
  assert.equal(mailLang("mn", "en"), "mn", "the language in use wins over the saved one");
  assert.equal(mailLang(undefined, "mn"), "mn");
  assert.equal(mailLang("xx", "en"), "en");
  assert.equal(mailLang(undefined, undefined), "en");
  assert.equal(mailLang(null, "xx"), "en");
});
