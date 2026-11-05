// Real-browser end-to-end test of phases 4-7 against a PRODUCTION server (CSP active) + axe accessibility audit.
const fs = require("fs");
const bcrypt = require("bcryptjs");
const puppeteer = require("puppeteer-core");
const L = require("./lib.cjs");
const { db, B, ok, client, post, play } = L;
const SD = require("path").join(__dirname, "out"); // screenshots and generated files
const AXE = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PW = "Str0ngPassw0rd";
const errors = [];
const a11y = [];

async function mkUser(email, name, admin) {
  const role = await db.role.upsert({ where: { name: admin ? "ADMIN" : "USER" }, update: {}, create: { name: admin ? "ADMIN" : "USER" } });
  return db.user.create({ data: { email, name, passwordHash: await bcrypt.hash(PW, 10), roleId: role.id, emailVerifiedAt: new Date(), preferences: { create: {} }, streak: { create: {} } } });
}

async function page(ctx, w = 1280, h = 900) {
  const p = await ctx.newPage();
  await p.setViewport({ width: w, height: h });
  await p.evaluateOnNewDocument(() => { try { localStorage.setItem("iq-lang", "en"); localStorage.setItem("iq-theme", "dark"); } catch {} });
  p.on("console", (m) => { if (m.type() === "error") errors.push(`[console] ${p.url().replace(B, "")} ${m.text().slice(0, 160)}`); });
  p.on("pageerror", (e) => errors.push(`[pageerror] ${p.url().replace(B, "")} ${e.message.slice(0, 160)}`));
  p.on("response", (r) => { if (r.status() >= 500) errors.push(`[5xx] ${r.url().replace(B, "")} ${r.status()}`); });
  return p;
}

async function login(p, email) {
  await p.goto(B + "/login", { waitUntil: "networkidle0" });
  await p.type("#email", email);
  await p.type("#password", PW);
  await Promise.all([p.waitForNavigation({ waitUntil: "networkidle0" }), p.click("button.btn-primary")]);
}

async function axe(p, label) {
  await p.evaluate(AXE);
  const res = await p.evaluate(async () => (await window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa"] })).violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, help: v.help, sample: v.nodes[0].html.slice(0, 120), target: v.nodes[0].target.join(" ") })));
  const bad = res.filter((v) => v.impact === "serious" || v.impact === "critical");
  if (bad.length) a11y.push({ label, bad });
  return bad;
}

const overflow = (p) => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

(async () => {
  const stamp = Date.now();
  const uEmail = `uiuser${stamp}@example.com`, aEmail = `uiadmin${stamp}@example.com`;
  const user = await mkUser(uEmail, "Ulzii Browser", false);
  await mkUser(aEmail, "Ada Admin", true);

  // data for history/comparison via the API (same server)
  const api = client();
  await post(api, "/api/auth/login", { email: uEmail, password: PW });
  const rid1 = await play(api, "full-battery", 28, (i) => i % 3 !== 0);
  const rid2 = await play(api, "full-battery", 28, (i) => i % 5 !== 0);
  const ridQ = await play(api, "quick-check", 10);

  const browser = await puppeteer.launch({ executablePath: process.env.BROWSER_PATH || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true, args: ["--no-sandbox"], protocolTimeout: 120000 });
  // Separate cookie jars: pages in one browser context share cookies, which would blur user/admin/guest.
  const uCtx = await browser.createBrowserContext(), aCtx = await browser.createBrowserContext(), gCtx = await browser.createBrowserContext();
  const p = await page(uCtx);

  console.log("login & dashboard");
  await login(p, uEmail);
  ok(/\/dashboard$/.test(p.url()), "login form lands on /dashboard");
  await sleep(1500);
  const dash = await p.evaluate(() => document.body.innerText);
  ok(/Ulzii/.test(dash) && /Level/.test(dash) && /day streak/.test(dash), "welcome, level and streak shown");
  ok(/Latest assessment/.test(dash) && /Daily challenge/.test(dash) && /Achievements/.test(dash) && /Recommended next/.test(dash) && /Test history/.test(dash), "dashboard sections present");
  ok(await p.evaluate(() => !!document.querySelector(".recharts-radar-polygon, .recharts-polar-grid")), "dashboard radar chart rendered (CSP allows it)");
  await p.screenshot({ path: `${SD}/u-dashboard.png` });
  await axe(p, "dashboard");

  console.log("global search (Ctrl+K) & notifications");
  await p.keyboard.down("Control"); await p.keyboard.press("k"); await p.keyboard.up("Control");
  await p.waitForSelector('[role="dialog"] input');
  await p.type('[role="dialog"] input', "quick");
  await p.waitForFunction(() => document.querySelectorAll('[role="option"]').length >= 1, { timeout: 8000 });
  await p.screenshot({ path: `${SD}/u-search.png` });
  await axe(p, "search dialog");
  await p.keyboard.press("Enter");
  await p.waitForFunction(() => location.pathname.startsWith("/assessments/"), { timeout: 10000 });
  ok(/quick-check|assessments/.test(p.url()), `Enter navigates to the top hit (${p.url().replace(B, "")})`);
  await p.goto(B + "/dashboard", { waitUntil: "networkidle0" });
  const badge = await p.$('[data-testid="unread"]');
  ok(!!badge, "unread badge on the bell");
  await p.click('button[aria-label^="Notifications"]');
  await p.waitForSelector('[role="dialog"] ul li');
  ok(await p.evaluate(() => /Assessment complete|Achievement unlocked/.test(document.querySelector('[role="dialog"]').innerText)), "notification list shows real events");
  await p.screenshot({ path: `${SD}/u-notifications.png` });
  await p.keyboard.press("Escape");
  await p.reload({ waitUntil: "networkidle0" });
  ok(!(await p.$('[data-testid="unread"]')), "badge cleared after opening the list");

  console.log("achievements, history, comparison");
  await p.goto(B + "/achievements", { waitUntil: "networkidle0" });
  ok(await p.evaluate(() => document.querySelectorAll('[data-unlocked="true"]').length >= 2 && document.querySelectorAll('[data-unlocked="false"]').length >= 1), "achievements: unlocked and locked badges");
  await p.screenshot({ path: `${SD}/u-achievements.png` });
  await axe(p, "achievements");
  await p.goto(B + "/history", { waitUntil: "networkidle0" });
  await sleep(1500);
  ok(await p.evaluate(() => document.querySelectorAll(".recharts-line").length >= 2), "history: trend line charts rendered");
  ok(await p.evaluate(() => /strength|to practise/.test(document.body.innerText) || /Consistent strengths/.test(document.body.innerText)), "history: strengths & weaknesses panel");
  const boxes = await p.$$('input[type="checkbox"]');
  await boxes[0].click(); await boxes[1].click();
  await p.waitForFunction(() => /Comparison/.test(document.body.innerText), { timeout: 8000 });
  await sleep(1200);
  ok(await p.evaluate(() => !!document.querySelector("table") && document.querySelectorAll(".recharts-radar-polygon").length >= 2), "history: two-attempt comparison table + dual radar");
  await p.screenshot({ path: `${SD}/u-history.png`, fullPage: true });
  await axe(p, "history");

  console.log("daily challenge in the browser");
  await p.goto(B + "/daily", { waitUntil: "networkidle0" });
  await p.waitForFunction(() => /Start/.test(document.body.innerText), { timeout: 8000 });
  await p.evaluate(() => [...document.querySelectorAll("button")].find((b) => /^Start/.test(b.textContent.trim())).click());
  for (let i = 0; i < 5; i++) {
    await p.waitForSelector('[role="radio"]');
    await p.screenshot({ path: `${SD}/u-daily-${i}.png` }).catch(() => {});
    await p.click('[role="radio"]');
    await p.evaluate(() => [...document.querySelectorAll("button")].filter((b) => /^(Next|Finish)$/.test(b.textContent.trim())).pop().click());
    await sleep(500);
  }
  await p.waitForFunction(() => /challenge complete/i.test(document.body.innerText), { timeout: 15000 });
  ok(await p.evaluate(() => /Solutions/.test(document.body.innerText) && document.querySelectorAll("ol > li").length === 5 && /Explanation/.test(document.body.innerText)), "daily: result, XP and 5 solutions with explanations");
  await p.screenshot({ path: `${SD}/u-daily-done.png`, fullPage: true });
  await axe(p, "daily (completed)");
  await p.reload({ waitUntil: "networkidle0" });
  ok(await p.evaluate(() => /challenge complete/i.test(document.body.innerText)), "daily: completion persists on reload (once per day)");

  console.log("settings, privacy, leaderboard");
  await p.goto(B + "/settings", { waitUntil: "networkidle0" });
  await axe(p, "settings");
  await p.screenshot({ path: `${SD}/u-settings.png`, fullPage: true });
  await p.click("#name", { clickCount: 3 }); await p.type("#name", "Ulzii Renamed");
  await p.evaluate(() => [...document.querySelectorAll("button")].find((b) => /Save profile/.test(b.textContent)).click());
  await p.waitForFunction(() => /Profile saved/.test(document.body.innerText), { timeout: 8000 });
  ok(true, "profile name saved");
  await p.click('button[role="switch"][aria-label="Appear on leaderboards"]');
  await p.waitForFunction(() => /Privacy updated/.test(document.body.innerText), { timeout: 8000 });
  ok((await db.user.findUnique({ where: { id: user.id } })).showOnLeaderboard === true, "leaderboard opt-in saved to the account");
  await p.goto(B + "/leaderboard?a=full-battery", { waitUntil: "networkidle0" });
  ok(await p.evaluate(() => /Ulzii/.test(document.body.innerText) && !/Renamed|@example/.test(document.body.innerText)), "leaderboard shows first name only after opt-in");
  await p.screenshot({ path: `${SD}/u-leaderboard.png` });
  await axe(p, "leaderboard");

  console.log("results: share, PDF, certificate");
  await p.goto(`${B}/results/${rid2}`, { waitUntil: "networkidle0" });
  await sleep(1200);
  await p.evaluate(() => [...document.querySelectorAll("button")].find((b) => /Create share link/.test(b.textContent)).click());
  await p.waitForSelector('input[aria-label="Share link"]');
  const link = await p.$eval('input[aria-label="Share link"]', (e) => e.value);
  ok(/\/r\/[A-Za-z0-9_-]{20,}$/.test(link), "share link created in the UI");
  const sp = await page(gCtx); await sp.goto(link, { waitUntil: "networkidle0" }); await sleep(1000);
  ok(await sp.evaluate(() => /Shared INTELLIQ result/.test(document.body.innerText) && !/Ulzii/.test(document.body.innerText)), "anonymous visitor sees the shared result with no name");
  await sp.screenshot({ path: `${SD}/u-shared.png` });
  ok(await p.evaluate(() => { const a = [...document.querySelectorAll("a")].find((x) => /Download PDF/.test(x.textContent)); return a && /\/api\/results\/.+\/pdf\?lang=en/.test(a.getAttribute("href")); }), "PDF download link present");
  await axe(p, "results");
  await p.goto(`${B}/certificate/${rid2}`, { waitUntil: "networkidle0" });
  ok(await p.evaluate(() => /Certificate of Participation/.test(document.body.innerText) && /not an IQ certification/.test(document.body.innerText)), "participation certificate page");
  await p.screenshot({ path: `${SD}/u-certificate.png` });

  console.log("admin in the browser");
  const ap = await page(aCtx);
  await login(ap, aEmail);
  await ap.goto(B + "/admin", { waitUntil: "networkidle0" }); await sleep(1500);
  ok(await ap.evaluate(() => /Analytics/.test(document.body.innerText) && !!document.querySelector(".recharts-bar-rectangle, .recharts-bar")), "admin analytics with engagement chart");
  await ap.screenshot({ path: `${SD}/a-analytics.png`, fullPage: true });
  await axe(ap, "admin analytics");
  await ap.goto(B + "/admin/questions/new", { waitUntil: "networkidle0" });
  await ap.type("textarea:nth-of-type(1)", "Browser-made question: which is a fruit?");
  const areas = await ap.$$("textarea");
  await areas[1].type("Because an apple is a fruit.");
  const optInputs = await ap.$$('input[aria-label$="text"]');
  for (const [i, t] of ["Apple", "Chair", "Table", "Cloud"].entries()) await optInputs[i].type(t);
  await ap.screenshot({ path: `${SD}/a-editor.png`, fullPage: true });
  await axe(ap, "admin question editor");
  await ap.evaluate(() => [...document.querySelectorAll("button")].find((b) => /Create question/.test(b.textContent)).click());
  await ap.waitForFunction(() => /\/admin\/questions\/[a-z0-9]{20,}/.test(location.pathname), { timeout: 10000 });
  ok(true, "question created from the UI and editor opened");
  await ap.waitForFunction(() => /v1/.test(document.body.innerText), { timeout: 5000 });
  await ap.click("textarea"); await ap.keyboard.down("Control"); await ap.keyboard.press("a"); await ap.keyboard.up("Control"); await ap.type("textarea", "Browser-made question EDITED: which is a fruit?");
  await ap.evaluate(() => [...document.querySelectorAll("button")].find((b) => /Save changes/.test(b.textContent)).click());
  await ap.waitForFunction(() => /now version 2/.test(document.body.innerText), { timeout: 8000 });
  ok(true, "edit saved as version 2");
  await ap.waitForFunction(() => /Version history/.test(document.body.innerText), { timeout: 8000 });
  ap.on("dialog", (d) => d.accept());
  await ap.evaluate(() => [...document.querySelectorAll("button")].find((b) => /^Restore$/.test(b.textContent.trim())).click());
  await ap.waitForFunction(() => /Restored version 1/.test(document.body.innerText), { timeout: 8000 });
  ok(true, "version restore works from the UI");
  await ap.evaluate(() => [...document.querySelectorAll("button")].find((b) => /^Delete$/.test(b.textContent.trim())).click());
  await ap.waitForFunction(() => location.pathname === "/admin/questions", { timeout: 10000 });
  ok(true, "delete returns to the list");
  for (const path of ["/admin/questions", "/admin/users", "/admin/assessments", "/admin/system", "/admin/audit"]) { await ap.goto(B + path, { waitUntil: "networkidle0" }); await axe(ap, path); }
  await ap.goto(B + "/admin/system", { waitUntil: "networkidle0" });
  await ap.screenshot({ path: `${SD}/a-system.png`, fullPage: true });

  console.log("maintenance mode in the browser");
  await ap.click('button[role="switch"][aria-label="Maintenance mode"]');
  await ap.waitForFunction(() => /Maintenance mode: on/.test(document.body.innerText), { timeout: 8000 });
  const guest = await page(gCtx); await guest.goto(B + "/", { waitUntil: "networkidle0" }); await sleep(800);
  ok(await guest.evaluate(() => !!document.querySelector('[role="alertdialog"]') && /be right back/.test(document.body.innerText)), "visitors see the maintenance screen");
  await guest.screenshot({ path: `${SD}/u-maintenance.png` });
  await p.goto(B + "/dashboard", { waitUntil: "networkidle0" }); await sleep(800);
  ok(await p.evaluate(() => !!document.querySelector('[role="alertdialog"]')), "signed-in regular users are gated too");
  await ap.goto(B + "/", { waitUntil: "networkidle0" }); await sleep(800);
  ok(await ap.evaluate(() => !document.querySelector('[role="alertdialog"]')), "administrators are not blocked");
  await ap.goto(B + "/admin/system", { waitUntil: "networkidle0" });
  await ap.click('button[role="switch"][aria-label="Maintenance mode"]');
  await ap.waitForFunction(() => /Maintenance mode: off/.test(document.body.innerText), { timeout: 8000 });
  await guest.reload({ waitUntil: "networkidle0" }); await sleep(800);
  ok(await guest.evaluate(() => !document.querySelector('[role="alertdialog"]')), "maintenance screen disappears when switched off");

  console.log("responsive: no horizontal overflow on a 390px phone");
  const mp = await page(await browser.createBrowserContext(), 390, 844);
  await mp.setCookie(...(await p.cookies()));
  for (const path of ["/dashboard", "/achievements", "/daily", "/history", "/leaderboard?a=full-battery", "/settings", `/results/${rid2}`, "/assessments", "/assessments/full-battery"]) {
    await mp.goto(B + path, { waitUntil: "networkidle0" }); await sleep(900);
    const o = await overflow(mp);
    ok(o <= 1, `${path.split("?")[0].replace(rid2, ":id")} (${o}px)`);
    if (path === "/dashboard") await mp.screenshot({ path: `${SD}/m-dashboard.png`, fullPage: true });
  }
  const ap2 = await page(await browser.createBrowserContext(), 390, 844); await ap2.setCookie(...(await ap.cookies()));
  for (const path of ["/admin", "/admin/questions", "/admin/users", "/admin/system"]) { await ap2.goto(B + path, { waitUntil: "networkidle0" }); await sleep(700); const o = await overflow(ap2); ok(o <= 1, `${path} (${o}px)`); }
  await ap2.goto(B + "/admin", { waitUntil: "networkidle0" }); await ap2.screenshot({ path: `${SD}/m-admin.png`, fullPage: true });

  console.log("accessibility (axe, WCAG 2 A/AA): serious/critical violations");
  const lp = await page(gCtx);
  for (const path of ["/", "/login", "/register", "/assessments", "/assessments/full-battery", "/leaderboard"]) { await lp.goto(B + path, { waitUntil: "networkidle0" }); await sleep(600); await axe(lp, path); }
  await lp.evaluate(() => document.documentElement.dataset.theme = "light"); await sleep(300); await axe(lp, "/leaderboard (light)");
  await p.goto(`${B}/results/${rid2}`, { waitUntil: "networkidle0" }); await p.evaluate(() => (document.documentElement.dataset.theme = "light")); await sleep(500); await axe(p, "results (light)");
  await p.goto(B + "/dashboard", { waitUntil: "networkidle0" }); await p.evaluate(() => (document.documentElement.dataset.theme = "light")); await sleep(800); await axe(p, "dashboard (light)");
  ok(a11y.length === 0, `no serious/critical accessibility violations (${a11y.length} page(s) with issues)`);
  for (const pg of a11y) for (const v of pg.bad) console.log(`   A11Y ${pg.label}: [${v.impact}] ${v.id} x${v.n} - ${v.help}\n        ${v.target} :: ${v.sample}`);

  const real = errors.filter((e) => !/_rsc=|definitely-missing|Failed to load resource: the server responded with a status of (404|401|403|409|503)/.test(e));
  console.log("\nbrowser errors (excluding expected 4xx/prefetch):", real.length);
  real.slice(0, 12).forEach((e) => console.log("   ", e));
  ok(real.length === 0, "no unexpected console / page / 5xx errors under the production CSP");

  await browser.close();
  await db.assessmentSession.deleteMany({});
  await db.challengeAttempt.deleteMany({ where: { userId: user.id } });
  await db.user.deleteMany({ where: { email: { in: [uEmail, aEmail] } } });
  await db.setting.deleteMany({});
  await L.done();
})().catch(async (e) => { console.error("SCRIPT ERROR", e); try { await db.setting.deleteMany({}); } catch {} process.exit(2); });
