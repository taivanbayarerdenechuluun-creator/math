// Real-browser checks of what the earlier suites did not cover (run against a PRODUCTION server):
//  - the Mongolian interface: no English text left behind (visible text, aria-labels, titles, placeholders), no overflow
//  - phone / tablet / desktop widths in both languages
//  - an internal-link crawler (guest and signed-in)
//  - a smoke test that presses every safe button and watches for script errors
//  - axe (WCAG 2 A/AA) on the daily challenge, 3D and reaction questions, in both languages
const fs = require("fs");
const bcrypt = require("bcryptjs");
const puppeteer = require("puppeteer-core");
const L = require("./lib.cjs");
const { db, B, ok, client, post, play, done } = L;
const SD = require("path").join(__dirname, "out");
const AXE = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PW = "Str0ngPassw0rd";
const errors = [];

let checks = 0, failed = 0;
/** Counts silently and prints only failures, so a hundred page/width combinations stay readable. */
const q = (cond, msg) => { checks++; if (!cond) { failed++; console.log("  FAIL:", msg); } return cond; };
const flush = (name) => { console.log(`  ${checks - failed >= 0 ? "ok" : ""}: ${name} (${checks} checks, ${failed} failed)`); ok(failed === 0, name); checks = 0; failed = 0; };

async function mkUser(email, name) {
  const role = await db.role.upsert({ where: { name: "USER" }, update: {}, create: { name: "USER" } });
  return db.user.create({ data: { email, name, passwordHash: await bcrypt.hash(PW, 10), roleId: role.id, emailVerifiedAt: new Date(), publicProfile: true, showOnLeaderboard: true, preferences: { create: {} }, streak: { create: {} } } });
}

async function newPage(ctx, lang, w = 1280, h = 900) {
  const p = await ctx.newPage();
  await p.setViewport({ width: w, height: h });
  await p.evaluateOnNewDocument((l) => { try { localStorage.setItem("iq-lang", l); localStorage.setItem("iq-theme", "dark"); } catch {} }, lang);
  p.on("console", (m) => { if (m.type() === "error" && !(p.url().endsWith("/does-not-exist") && /status of 404/.test(m.text()))) errors.push(`[console] ${p.url().replace(B, "")} ${m.text().slice(0, 200)}`); });
  p.on("pageerror", (e) => errors.push(`[pageerror] ${p.url().replace(B, "")} ${e.message.slice(0, 200)}`));
  p.on("response", (r) => { if (r.status() >= 500) errors.push(`[5xx] ${r.url().replace(B, "")} ${r.status()}`); });
  return p;
}

async function login(p, email) {
  await p.goto(B + "/login", { waitUntil: "networkidle0" });
  await p.type("#email", email);
  await p.type("#password", PW);
  await Promise.all([p.waitForNavigation({ waitUntil: "networkidle0" }), p.click("button.btn-primary")]);
}

const open = async (p, path) => { // the page fade lasts 180 ms
  try { await p.goto(B + path, { waitUntil: "networkidle0" }); } catch (e) { e.message += ` (while opening ${path} at ${p.viewport()?.width}px)`; throw e; }
  await sleep(450);
};

// ---------- English left behind in the Mongolian interface ----------
const ALLOW = ["INTELLIQ", "IQ", "PDF", "CSV", "XP", "AI", "FAQ", "PNG", "JPEG", "WebP", "GIF", "KB", "MB", "Ulzii Browser", "Ulzii", "WCAG", "A/AA"];
const PHRASE = /[A-Za-z]{3,}[\s,.:;()\-–/]+[A-Za-z]{2,}/;
function leaks(strings) {
  const out = new Set();
  for (const s of strings) for (const raw of String(s).split("\n")) {
    let line = raw.replace(/https?:\S+|[\w.+-]+@[\w.-]+/g, " ");
    for (const a of ALLOW) line = line.split(a).join(" ");
    if (PHRASE.test(line)) out.add(raw.trim().slice(0, 110));
  }
  return [...out];
}
const collect = (p) => p.evaluate(() => ({
  text: document.body.innerText,
  attrs: [...document.querySelectorAll("[aria-label],[title],[placeholder],img[alt]")].flatMap((e) => ["aria-label", "title", "placeholder", "alt"].map((a) => e.getAttribute(a)).filter(Boolean)),
  title: document.title,
  lang: document.documentElement.lang,
}));
const overflowAt = (p) => p.evaluate(() => {
  const w = document.documentElement.clientWidth;
  const bad = [...document.querySelectorAll("body *")].find((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > w + 1 && getComputedStyle(e).position !== "fixed" && !e.closest(".sr-only,[aria-hidden='true']"); });
  return { over: document.documentElement.scrollWidth - w, el: bad ? `${bad.tagName.toLowerCase()}.${String(bad.className).slice(0, 50)}` : "" };
});

// ---------- axe ----------
async function axe(p, label) {
  await p.evaluate(AXE);
  const res = await p.evaluate(async () => (await window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa"] })).violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, sample: v.nodes[0].html.slice(0, 110), target: v.nodes[0].target.join(" ") })));
  const bad = res.filter((v) => v.impact === "serious" || v.impact === "critical");
  q(bad.length === 0, `axe ${label}: ${JSON.stringify(bad)}`);
}

// ---------- link crawler ----------
async function crawl(c, label, limit = 160) {
  const seen = new Map(), queue = ["/"], broken = [];
  while (queue.length && seen.size < limit) {
    const url = queue.shift();
    if (seen.has(url)) continue;
    const r = await c(url);
    seen.set(url, r.status);
    if (r.status >= 300 && r.status < 400 && r.location) { queue.push(new URL(r.location, B).pathname + new URL(r.location, B).search); continue; }
    if (r.status !== 200) { broken.push(`${url} -> ${r.status}`); continue; }
    if (!/text\/html/.test(r.headers.get("content-type") || "")) continue;
    for (const m of r.text.matchAll(/href="([^"#]+)"/g)) {
      const h = m[1].replace(/&amp;/g, "&");
      if (h.startsWith("/") && !h.startsWith("//") && !h.startsWith("/_next/")) queue.push(h);
    }
  }
  console.log(`  ${label}: visited ${seen.size} URLs`);
  q(seen.size >= 10, `${label}: the crawl found too few pages (${seen.size})`);
  q(broken.length === 0, `${label}: broken internal links: ${broken.join(", ")}`);
  flush(`${label}: every internal link resolves`);
}

// ---------- button smoke test ----------
const SKIP = /delete|remove|log ?out|sign ?out|erase|reset|upload|save|submit|устг|гарах|хадгал|хасах|цэвэрл|шинэчл/i;
async function smoke(p, path) {
  await open(p, path);
  const sel = "main button, header button, nav button";
  const n = await p.evaluate((s) => document.querySelectorAll(s).length, sel);
  let pressed = 0;
  for (let i = 0; i < n; i++) {
    const info = await p.evaluate((s, i) => { const b = [...document.querySelectorAll(s)][i]; return b ? { t: (b.innerText || b.getAttribute("aria-label") || "").trim(), off: b.disabled, vis: b.offsetParent !== null, sub: !!b.closest("form") && b.type === "submit" } : null; }, sel, i);
    if (!info || info.off || !info.vis || info.sub || SKIP.test(info.t)) continue;
    await p.evaluate((s, i) => { const b = [...document.querySelectorAll(s)][i]; if (b) b.click(); }, sel, i);
    pressed++;
    await sleep(180);
    await p.keyboard.press("Escape");
    if (!p.url().startsWith(B + path.split("?")[0])) await open(p, path); // a button navigated away: come back
  }
  return pressed;
}

(async () => {
  const stamp = Date.now();
  const email = `mnui${stamp}@example.com`;
  const user = await mkUser(email, "Ulzii Browser");
  const api = client();
  await post(api, "/api/auth/login", { email, password: PW });
  const rid = await play(api, "full-battery", 28, (i) => i % 3 !== 0);
  const ridQ = await play(api, "quick-check", 10);
  const token = (await post(api, `/api/results/${ridQ}/share`, { enable: true })).json.shareToken;

  const browser = await puppeteer.launch({ executablePath: process.env.BROWSER_PATH || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true, args: ["--no-sandbox"], protocolTimeout: 120000 });
  const gCtx = await browser.createBrowserContext(), uCtx = await browser.createBrowserContext();
  const gMn = await newPage(gCtx, "mn"), uMn = await newPage(uCtx, "mn");
  await login(uMn, email);

  const GUEST = ["/", "/assessments", "/assessments/quick-check", "/login", "/register", "/forgot-password", "/daily", "/leaderboard", "/does-not-exist", `/r/${token}`, `/u/${user.id}`];
  const USER = ["/dashboard", "/history", "/achievements", "/settings", `/results/${rid}`, `/results/${ridQ}`, `/certificate/${rid}`];

  // sessions for the test runner: a 3D question and a reaction question (as the signed-in user, through the browser's own cookie)
  const mkSession = async (p, slug, where) => {
    const sid = await p.evaluate(async (slug) => (await (await fetch("/api/sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug }) })).json()).sessionId, slug);
    if (!sid) throw new Error("could not create a " + slug + " session");
    const qu = await db.question.findFirst({ where });
    await db.userAnswer.updateMany({ where: { sessionId: sid }, data: { questionId: qu.id, difficulty: qu.difficulty, servedAt: new Date() } });
    return sid;
  };
  const sidQuick = await uMn.evaluate(async () => (await (await fetch("/api/sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: "quick-check" }) })).json()).sessionId);
  const sidIso = await mkSession(uMn, "spatial-focus", { origin: "bank", figure: { contains: '"k":"iso"' } });
  const sidReact = await mkSession(uMn, "speed-focus", { kind: "reaction" });
  const TESTS = [`/test/${sidQuick}`, `/test/${sidIso}`, `/test/${sidReact}`];

  console.log("Mongolian interface: no English left behind");
  for (const [who, p, pages] of [["guest", gMn, GUEST], ["user", uMn, [...USER, ...TESTS]]]) {
    for (const path of pages) {
      await open(p, path);
      const c = await collect(p);
      q(c.lang === "mn", `${path}: <html lang> is "${c.lang}", expected mn`);
      const found = leaks([c.text, ...c.attrs, c.title]);
      q(found.length === 0, `${who} ${path}: English text in the Mongolian UI: ${JSON.stringify(found.slice(0, 6))}`);
    }
  }
  flush("no English phrases in visible text, labels, titles or placeholders");

  console.log("overflow at phone, tablet and desktop widths");
  const pe = await newPage(uCtx, "en");
  for (const [lang, p, widths] of [["mn", gMn, [390, 768, 1280]], ["mn", uMn, [390, 768, 1280]], ["en", pe, [768, 1024]]]) {
    const pages = p === gMn ? GUEST : [...USER, ...TESTS];
    for (const path of pages) {
      for (const w of widths) {
        await p.setViewport({ width: w, height: w < 600 ? 800 : 900 });
        await open(p, path);
        const o = await overflowAt(p);
        q(o.over <= 0, `${lang} ${path} @${w}px overflows by ${o.over}px (${o.el})`);
      }
      await p.setViewport({ width: 1280, height: 900 });
    }
  }
  flush("no horizontal overflow in Mongolian (390/768/1280) or English (768/1024)");

  console.log("screenshots for review (Mongolian)");
  for (const [name, p, path, w] of [["mn-landing-390", gMn, "/", 390], ["mn-daily-390", gMn, "/daily", 390], ["mn-assessment-768", gMn, "/assessments/quick-check", 768], ["mn-dashboard-1280", uMn, "/dashboard", 1280], ["mn-iso-390", uMn, TESTS[1], 390], ["mn-reaction-390", uMn, TESTS[2], 390], ["mn-results-390", uMn, `/results/${rid}`, 390]]) {
    await p.setViewport({ width: w, height: 900 });
    await open(p, path);
    await sleep(1100); // charts animate for about a second
    await p.screenshot({ path: `${SD}/${name}.png` });
  }
  await uMn.setViewport({ width: 1280, height: 900 });
  await gMn.setViewport({ width: 1280, height: 900 });
  flush("screenshots written to tests/out");

  console.log("internal link crawler");
  await crawl(client(), "guest");
  const uc = client();
  await post(uc, "/api/auth/login", { email, password: PW });
  await crawl(uc, "signed-in user");

  console.log("button smoke test (Mongolian interface)");
  for (const [p, paths] of [[gMn, ["/", "/assessments", "/daily", "/leaderboard", "/login"]], [uMn, ["/dashboard", "/history", "/achievements", "/settings", `/results/${rid}`]]]) {
    for (const path of paths) {
      const before = errors.length;
      const n = await smoke(p, path);
      q(n >= 1, `${path}: expected at least one pressable control`);
      q(errors.length === before, `${path}: script errors while pressing buttons: ${errors.slice(before).join(" | ")}`);
    }
  }
  flush("pressing every safe button raises no script errors");

  console.log("accessibility of the new UI (axe, WCAG 2 A/AA)");
  for (const lang of ["mn", "en"]) {
    const p = await newPage(uCtx, lang);
    await open(p, "/daily");
    await axe(p, `${lang} daily intro`);
    await p.click("button.btn-primary"); // Start
    for (let i = 0; i < 5; i++) {
      await p.waitForSelector('[role="radiogroup"] [role="radio"]', { timeout: 15000 });
      await sleep(400);
      if (i === 1 || i === 2) await axe(p, `${lang} daily question ${i + 1}`);
      await p.evaluate(() => document.querySelector('[role="radiogroup"] [role="radio"]').click());
      await sleep(120);
      await p.evaluate(() => [...document.querySelectorAll("button.btn-primary")].pop().click());
      await sleep(250);
    }
    await sleep(1200);
    const finished = await p.evaluate(() => document.body.innerText);
    q(/Today's challenge complete|Өнөөдрийн сорилт дууссан/.test(finished), `${lang}: the daily challenge reached its result screen`);
    await axe(p, `${lang} daily result`);
    await db.challengeAttempt.deleteMany({ where: { userId: user.id } }); // allow the next language to play it again
    await p.close();
  }
  for (const [lang, path] of [["mn", TESTS[1]], ["mn", TESTS[2]], ["en", TESTS[1]], ["en", TESTS[2]], ["mn", `/results/${rid}`], ["en", `/results/${rid}`]]) {
    const p = await newPage(uCtx, lang);
    await open(p, path);
    await axe(p, `${lang} ${path.split("/")[1]}`);
    await p.close();
  }
  await open(gMn, "/");
  await axe(gMn, "mn landing");
  flush("no serious or critical WCAG 2 A/AA violations");

  console.log("no script or server errors during the whole run");
  q(errors.length === 0, errors.slice(0, 8).join(" | "));
  flush("clean console and no 5xx");

  await browser.close();
  await db.challengeAttempt.deleteMany({ where: { userId: user.id } });
  await db.assessmentSession.deleteMany({});
  await db.user.deleteMany({ where: { email } });
  await done();
})().catch((e) => { console.error("SCRIPT ERROR", e); process.exit(2); });
