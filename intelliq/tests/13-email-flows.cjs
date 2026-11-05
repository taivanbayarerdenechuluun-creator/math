// Email flows against a running server that delivers through SMTP to 127.0.0.1:2526. This suite hosts that SMTP
// server itself, so it can also simulate an outage and a slow server. Start the app with:
//   MAIL_PROVIDER=smtp SMTP_HOST=127.0.0.1 SMTP_PORT=2526 MAIL_FROM="INTELLIQ <no-reply@intelliq.test>" APP_URL=http://localhost:3100
const { createHash } = require("node:crypto");
const { SMTPServer } = require("smtp-server");
const { simpleParser } = require("mailparser");
const L = require("./lib.cjs");
const { db, B, ok, client, post, register, done } = L;

const PORT = Number(process.env.MAIL_PORT || 2526);
const PW = "Str0ngPassw0rd";
const inbox = [];
let delayMs = 0;
let server = null;

function startSmtp() {
  server = new SMTPServer({
    authOptional: true,
    disabledCommands: ["STARTTLS"],
    onConnect(_s, cb) { delayMs ? setTimeout(cb, delayMs) : cb(); },
    onData(stream, session, cb) {
      simpleParser(stream).then((m) => { inbox.push({ to: session.envelope.rcptTo.map((r) => r.address), from: m.from?.value[0], subject: m.subject, text: m.text, html: m.html, at: Date.now() }); cb(); }, cb);
    },
  });
  server.on("error", (e) => console.error("smtp error", e.message));
  return new Promise((res, rej) => { server.once("error", rej); server.listen(PORT, "127.0.0.1", res); });
}
const stopSmtp = () => new Promise((r) => server.close(r));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function mailTo(email, since = 0, wait = 8000, subject = null) {
  const t0 = Date.now();
  while (Date.now() - t0 < wait) {
    const m = inbox.filter((x) => x.to.includes(email) && x.at >= since && (!subject || subject.test(x.subject)));
    if (m.length) return m[m.length - 1];
    await sleep(100);
  }
  return null;
}
const linkIn = (m, re) => (m.text.match(re) || [])[0];
const sha = (s) => createHash("sha256").update(s).digest("hex");

(async () => {
  await startSmtp();
  const stamp = Date.now();
  const user = (tag) => `mail-${tag}-${stamp}@example.com`;

  console.log("sign-up sends a verification email in the visitor's language");
  const mnClient = client();
  const mnEmail = user("mn");
  let t0 = Date.now();
  let r = await post(mnClient, "/api/auth/register", { name: "Бат-Эрдэнэ", email: mnEmail, password: PW, lang: "mn" });
  ok(r.status === 200, "registration succeeds");
  let m = await mailTo(mnEmail, t0);
  ok(!!m, "a message arrives at the recipient");
  ok(m && /^INTELLIQ: имэйл хаягаа баталгаажуулна уу$/.test(m.subject), `Mongolian subject (${m && m.subject})`);
  ok(m && m.from.address === "no-reply@intelliq.test" && m.from.name === "INTELLIQ", "sent from MAIL_FROM");
  let usr = await db.user.findUnique({ where: { email: mnEmail }, include: { preferences: true } });
  const link = m && linkIn(m, new RegExp(`${B.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/api/auth/verify\\?token=[0-9a-f]{48}`));
  ok(!!link && link.endsWith(usr.verifyToken), "the text part contains the verification link for this account's token");
  ok(m && m.html.includes(`href="${link}"`) && m.html.includes("Имэйлээ баталгаажуулах") && m.html.includes('<html lang="mn">'), "the HTML part has the button and is marked as Mongolian");
  ok(usr.preferences.language === "mn", "the visitor's language became the account language");
  ok(usr.emailVerifiedAt === null, "not verified yet");

  const enClient = client();
  const enEmail = user("en");
  t0 = Date.now();
  await post(enClient, "/api/auth/register", { name: "Eng User", email: enEmail, password: PW });
  const em = await mailTo(enEmail, t0);
  ok(em && em.subject === "Verify your INTELLIQ email" && /Hi Eng User,/.test(em.text), "without a language the email is English");
  ok((await db.userPreference.findFirst({ where: { user: { email: enEmail } } })).language === "en", "and the account language stays English");

  console.log("a name cannot inject markup into the email");
  const evilEmail = user("evil");
  t0 = Date.now();
  await post(client(), "/api/auth/register", { name: "<img src=x onerror=alert(1)>", email: evilEmail, password: PW });
  const ev = await mailTo(evilEmail, t0);
  ok(ev && !ev.html.includes("<img src=x") && ev.html.includes("&lt;img src=x"), "the HTML part escapes the name");

  console.log("the dashboard asks unverified users to verify");
  let page = await mnClient("/dashboard");
  ok(page.status === 200 && page.text.includes("Имэйл хаягаа баталгаажуулна уу") === false && page.text.includes("Please verify your email address"), "the notice is rendered on the server (default language) with the address");
  ok(page.text.includes(mnEmail) && page.text.includes("Resend verification email"), "…with the account's address and the resend button");

  console.log("following the link verifies, once");
  let v = await fetch(link, { redirect: "manual" });
  ok(v.status === 307 && v.headers.get("location").endsWith("/login?verified=1"), "the link redirects with verified=1");
  usr = await db.user.findUnique({ where: { email: mnEmail } });
  ok(usr.emailVerifiedAt !== null && usr.verifyToken === null, "the account is verified and the token is spent");
  v = await fetch(link, { redirect: "manual" });
  ok(v.headers.get("location").endsWith("/login?verified=0"), "using the same link again fails");
  page = await mnClient("/dashboard");
  ok(!page.text.includes("Please verify your email address"), "the notice is gone once verified");
  v = await fetch(`${B}/api/auth/verify?token=${"0".repeat(48)}`, { redirect: "manual" });
  ok(v.headers.get("location").endsWith("/login?verified=0"), "an unknown token fails");

  console.log("resending the verification email");
  ok((await post(client(), "/api/auth/resend-verification", {})).status === 401, "anonymous visitors cannot ask for one");
  ok((await post(enClient, "/api/auth/resend-verification", {}, { Origin: "https://evil.example" })).status === 403, "cross-site requests are blocked");
  const before = inbox.length;
  r = await post(mnClient, "/api/auth/resend-verification", {});
  await sleep(600);
  ok(r.status === 200 && r.json.already === true && inbox.length === before, "an already verified user gets 'already' and no email");

  const oldToken = (await db.user.findUnique({ where: { email: enEmail } })).verifyToken;
  t0 = Date.now();
  r = await post(enClient, "/api/auth/resend-verification", { lang: "mn" });
  ok(r.status === 200 && r.json.ok === true, "an unverified user can resend");
  m = await mailTo(enEmail, t0);
  const newToken = (await db.user.findUnique({ where: { email: enEmail } })).verifyToken;
  ok(m && /Баталгаажуулах|баталгаажуулна/.test(m.subject), "the email follows the language in use (Mongolian here, although the account is English)");
  ok(newToken !== oldToken && m && m.text.includes(newToken), "it carries a fresh token");
  v = await fetch(`${B}/api/auth/verify?token=${oldToken}`, { redirect: "manual" });
  ok(v.headers.get("location").endsWith("verified=0"), "the previous link no longer works");
  v = await fetch(`${B}/api/auth/verify?token=${newToken}`, { redirect: "manual" });
  ok(v.headers.get("location").endsWith("verified=1"), "the new link verifies the account");

  console.log("password reset");
  const resetEmail = user("reset");
  const rc = client();
  await post(rc, "/api/auth/register", { name: "Reset Me", email: resetEmail, password: PW });
  await db.userPreference.updateMany({ where: { user: { email: resetEmail } }, data: { language: "mn" } });
  await mailTo(resetEmail); // the sign-up email, so it cannot be mistaken for the reset email below
  t0 = Date.now();
  r = await post(client(), "/api/auth/forgot", { email: resetEmail });
  ok(r.status === 200 && r.json.ok === true, "forgot answers 200");
  m = await mailTo(resetEmail, t0, 8000, /сэргээх|Reset/);
  ok(m && /нууц үгээ сэргээх/.test(m.subject), "no language in the request: the saved account language (Mongolian) is used");
  const tok = m && (m.text.match(/reset-password\?token=([0-9a-f]{64})/) || [])[1];
  usr = await db.user.findUnique({ where: { email: resetEmail } });
  ok(!!tok && usr.resetTokenHash === sha(tok), "the link carries a token whose hash is what the database stores (the raw token is not stored)");
  ok(Math.abs(usr.resetTokenExpiry.getTime() - (Date.now() + 3600_000)) < 90_000, "valid for one hour");
  ok(m && /60 минут/.test(m.text), "and the email says so");
  t0 = Date.now();
  await post(client(), "/api/auth/forgot", { email: resetEmail, lang: "en" });
  m = await mailTo(resetEmail, t0, 8000, /Reset|сэргээх/);
  ok(m && m.subject === "Reset your INTELLIQ password", "the language in the request overrides the saved one");
  const tok2 = (m.text.match(/reset-password\?token=([0-9a-f]{64})/) || [])[1];
  ok(tok2 !== tok, "each request issues a new token");

  page = await client()(`/reset-password?token=${tok2}`);
  ok(page.status === 200, "the reset page opens");
  r = await post(client(), "/api/auth/reset", { token: tok, password: "An0therStrongPass" });
  ok(r.status === 400 && /invalid or has expired/.test(r.json.error), "the older token no longer works");
  r = await post(client(), "/api/auth/reset", { token: tok2, password: "An0therStrongPass" });
  ok(r.status === 200, "the newest token resets the password");
  ok((await post(client(), "/api/auth/login", { email: resetEmail, password: "An0therStrongPass" })).status === 200 && (await post(client(), "/api/auth/login", { email: resetEmail, password: PW })).status !== 200, "the new password works and the old one does not");
  r = await post(client(), "/api/auth/reset", { token: tok2, password: "Yet4notherStrong" });
  ok(r.status === 400, "a used token cannot be used again");

  console.log("forgot does not reveal whether an account exists");
  const count = inbox.length;
  const unknown = await post(client(), "/api/auth/forgot", { email: `nobody-${stamp}@example.com` });
  await sleep(1500);
  ok(unknown.status === 200 && JSON.stringify(unknown.json) === JSON.stringify({ ok: true }) && inbox.length === count, "an unknown address gets the same answer and no email");
  delayMs = 3000;
  const t1 = Date.now();
  r = await post(client(), "/api/auth/forgot", { email: resetEmail });
  const took = Date.now() - t1;
  ok(r.status === 200 && took < 2000, `a slow mail server does not slow the response, so timing cannot reveal the account (${took} ms with a 3 s SMTP greeting delay)`);
  delayMs = 0;
  t0 = Date.now();
  await sleep(100);
  ok(!!(await mailTo(resetEmail, t1, 12000, /Reset|сэргээх/)), "…and the email is still delivered afterwards");

  console.log("a mail outage does not break the flows");
  await stopSmtp();
  const downEmail = user("down");
  r = await post(client(), "/api/auth/register", { name: "Outage User", email: downEmail, password: PW });
  ok(r.status === 200 && !!(await db.user.findUnique({ where: { email: downEmail } })), "registration still succeeds");
  r = await post(client(), "/api/auth/forgot", { email: resetEmail });
  ok(r.status === 200, "forgot still answers 200");
  const outage = client();
  await post(outage, "/api/auth/login", { email: downEmail, password: PW });
  r = await post(outage, "/api/auth/resend-verification", {});
  ok(r.status === 502 && /could not send/.test(r.json.error), "resending tells the user honestly that the email could not be sent");

  console.log("cleanup");
  await db.user.deleteMany({ where: { email: { contains: `-${stamp}@example.com` } } });
  await done();
})().catch(async (e) => { console.error("SCRIPT ERROR", e); try { await stopSmtp(); } catch {} process.exit(2); });
