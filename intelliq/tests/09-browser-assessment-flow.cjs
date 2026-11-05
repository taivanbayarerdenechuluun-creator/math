const puppeteer = require("puppeteer-core");
const SD = require("path").join(__dirname, "out"); // screenshots and generated files
const B = process.env.B || "http://localhost:3100";
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log(c ? "  ok:" : "  FAIL:", m); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.BROWSER_PATH || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true, args: ["--no-sandbox"] });
  const errors = [];
  async function newPage(w, h) {
    const p = await browser.newPage();
    await p.setViewport({ width: w, height: h });
    await p.evaluateOnNewDocument(() => { try { localStorage.setItem("iq-lang", "en"); } catch {} });
    p.on("console", (m) => { if (m.type() === "error") errors.push(`[console] ${p.url()} ${m.text()}`); });
    p.on("pageerror", (e) => errors.push(`[pageerror] ${p.url()} ${e.message}`));
    p.on("requestfailed", (r) => errors.push(`[reqfail] ${r.url()} ${r.failure()?.errorText}`));
    p.on("response", (r) => { if (r.status() >= 500) errors.push(`[5xx] ${r.url()} ${r.status()}`); });
    return p;
  }
  const overflow = (p) => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

  console.log("public pages: desktop + mobile");
  for (const [w, h, tag] of [[1280, 900, "desk"], [390, 844, "mob"]]) {
    const p = await newPage(w, h);
    for (const [path, name] of [["/", "landing"], ["/assessments", "assessments"], ["/assessments/quick-check", "overview"], ["/login", "login"], ["/register", "register"]]) {
      const r = await p.goto(B + path, { waitUntil: "networkidle0" });
      ok(r.status() === 200 || r.status() === 304, `${tag} ${path} ${r.status()} (200, or 304 on a cached revisit)`);
      const o = await overflow(p);
      ok(o <= 1, `${tag} ${path} no horizontal overflow (${o}px)`);
      await p.screenshot({ path: `${SD}/${tag}-${name}.png`, fullPage: name === "landing" ? false : false });
    }
    await p.close();
  }

  console.log("theme + language switchers");
  {
    const p = await newPage(1280, 900);
    await p.goto(B + "/", { waitUntil: "networkidle0" });
    ok((await p.evaluate(() => document.documentElement.dataset.theme)) === "dark", "default dark");
    await p.click('button[aria-label="Toggle theme"]');
    ok((await p.evaluate(() => document.documentElement.dataset.theme)) === "light", "toggled to light");
    await p.screenshot({ path: `${SD}/desk-landing-light.png` });
    await p.reload({ waitUntil: "networkidle0" });
    ok((await p.evaluate(() => document.documentElement.dataset.theme)) === "light", "light persisted after reload");
    const h1 = () => p.$eval("h1", (e) => e.textContent);
    ok(/Discover the Power of/.test(await h1()), "english hero");
    await p.click('button[aria-label="Language"]');
    await sleep(300);
    ok(/Оюун ухаанаа|нээгээрэй/.test(await h1()), "mongolian hero after switch");
    await p.screenshot({ path: `${SD}/desk-landing-mn.png` });
    await p.close();
  }

  console.log("sample question widget");
  {
    const p = await newPage(1280, 900);
    await p.goto(B + "/#top", { waitUntil: "networkidle0" });
    const radios = await p.$$('[role="radiogroup"] [role="radio"]');
    ok(radios.length === 4, "4 sample options");
    await radios[1].click();
    await sleep(200);
    ok(await p.$eval('[role="status"]', (e) => /Correct|Зөв/.test(e.textContent)), "162 is accepted as correct");
    await p.close();
  }

  console.log("take Full Battery via the real UI (keyboard + clicks)");
  const p = await newPage(1280, 900);
  await p.goto(B + "/assessments/full-battery", { waitUntil: "networkidle0" });
  await p.click("button.btn-primary");
  await p.waitForSelector('[role="radiogroup"]', { timeout: 15000 });
  ok(/\/test\//.test(p.url()), "navigated to /test/[id]");
  let seen = [];
  let hitMemory = false, hitSpeed = false, hitFigure = false;
  for (let i = 0; i < 28; i++) {
    await p.waitForSelector('[role="radiogroup"] [role="radio"]', { timeout: 10000 });
    const info = await p.evaluate(() => ({
      prompt: document.querySelector("h1")?.textContent,
      counter: document.querySelector("main span")?.textContent,
      memory: !!document.body.innerText.match(/Memorize this|Hidden: answer from memory/i),
      timed: !!document.body.innerText.match(/Time left/),
      figure: document.querySelectorAll('[role="radiogroup"] svg').length > 0,
      n: document.querySelectorAll('[role="radiogroup"] [role="radio"]').length,
    }));
    seen.push(info.prompt);
    hitMemory ||= info.memory; hitSpeed ||= info.timed; hitFigure ||= info.figure;
    if (i === 0) await p.screenshot({ path: `${SD}/test-first.png` });
    if (info.memory && !seen.shot1) { seen.shot1 = 1; await p.screenshot({ path: `${SD}/test-memory.png` }); }
    if (info.figure && !seen.shot2) { seen.shot2 = 1; await p.screenshot({ path: `${SD}/test-figure.png` }); }
    // Answer with keyboard key 1..n (varies) then advance with Enter.
    await p.keyboard.press(String((i % info.n) + 1));
    await sleep(120);
    if (i === 3) { await p.keyboard.press("m"); await sleep(120); ok(await p.evaluate(() => [...document.querySelectorAll("button")].some((b) => b.getAttribute("aria-pressed") === "true")), "mark-for-review toggled via M"); }
    if (i === 5) { await p.keyboard.press("ArrowLeft"); await sleep(250); const c = await p.evaluate(() => document.querySelector("main span")?.textContent ?? "MISSING: " + document.body.innerText.replace(/s+/g, " ").slice(0, 300)); ok(/Question 5 of/.test(c), "ArrowLeft goes back (" + c + ")"); await p.keyboard.press("ArrowRight"); await sleep(250); }
    await p.keyboard.press("Enter");
    await sleep(350);
  }
  ok(new Set(seen.filter(Boolean)).size >= 15, `served many distinct questions (${new Set(seen.filter(Boolean)).size})`);
  ok(hitMemory, "memory item rendered (stimulus or hidden placeholder)");
  ok(hitSpeed, "timed item showed a countdown");
  ok(hitFigure, "figure options rendered as SVG");
  await p.waitForSelector('[role="dialog"]', { timeout: 10000 });
  await p.screenshot({ path: `${SD}/test-review-modal.png` });
  ok(true, "review/submit dialog opened after last question");
  const stats = await p.evaluate(() => document.querySelector('[role="dialog"]').innerText.replace(/\s+/g, " "));
  console.log("   dialog:", stats.slice(0, 120));
  await p.evaluate(() => [...document.querySelectorAll('[role="dialog"] button')].find((b) => /Submit now/.test(b.textContent)).click());
  await p.waitForFunction(() => location.pathname.startsWith("/results/"), { timeout: 20000 });
  await sleep(2500);
  ok(true, "redirected to results");
  const hasRadar = await p.evaluate(() => !!document.querySelector(".recharts-radar-polygon, .recharts-polar-grid"));
  ok(hasRadar, "recharts radar rendered on results page");
  ok(await p.evaluate(() => /Personalised feedback/.test(document.body.innerText)), "feedback section present");
  ok(await p.evaluate(() => /not an IQ/.test(document.body.innerText)), "summary states it is not an IQ");
  ok(await p.evaluate(() => !/\bIQ score of\b|\byour IQ is\b/i.test(document.body.innerText)), "no IQ claim on page");
  const o = await overflow(p);
  ok(o <= 1, `results no horizontal overflow (${o}px)`);
  await p.screenshot({ path: `${SD}/results-top.png` });
  await p.screenshot({ path: `${SD}/results-full.png`, fullPage: true });
  await p.evaluate(() => [...document.querySelectorAll("button")].find((b) => /Show answers/.test(b.textContent)).click());
  await sleep(600);
  ok(await p.evaluate(() => document.querySelectorAll("ol > li").length >= 28 && /Explanation/.test(document.body.innerText)), "answer review lists 28 items with explanations");
  await p.hover(".recharts-radar-polygon").catch(() => {});

  // Mobile results
  const mp = await newPage(390, 844);
  await mp.setCookie(...(await p.cookies()));
  await mp.goto(p.url(), { waitUntil: "networkidle0" });
  await sleep(1500);
  ok((await overflow(mp)) <= 1, "mobile results no horizontal overflow");
  await mp.screenshot({ path: `${SD}/results-mobile.png`, fullPage: true });

  // Resume: start, answer 2, leave, come back
  console.log("resume after leaving");
  const r = await newPage(1280, 900);
  await r.goto(B + "/assessments/logical-focus", { waitUntil: "networkidle0" });
  await r.click("button.btn-primary");
  await r.waitForSelector('[role="radio"]');
  const url = r.url();
  await r.keyboard.press("1"); await sleep(300); await r.keyboard.press("Enter"); await sleep(500);
  await r.keyboard.press("2"); await sleep(400);
  await r.goto(B + "/assessments/logical-focus", { waitUntil: "networkidle0" });
  ok(await r.evaluate(() => /Resume assessment/.test(document.body.innerText)), "overview offers Resume");
  await r.click("button.btn-primary");
  await r.waitForSelector('[role="radio"]');
  ok(r.url() === url, "resumed the same session");
  ok(await r.evaluate(() => /Question 2 of 8/.test(document.body.innerText)), "resumed at question 2");
  ok(await r.evaluate(() => document.querySelector('[role="radio"][aria-checked="true"]') !== null), "previous selection restored");

  // 404 page
  const nf = await newPage(1280, 800);
  const nr = await nf.goto(B + "/definitely-missing", { waitUntil: "networkidle0" });
  ok(nr.status() === 404 && (await nf.evaluate(() => /404/.test(document.body.innerText))), "custom 404 page");

  console.log("\nbrowser errors:", errors.length);
  errors.splice(0, errors.length, ...errors.filter((e) => !e.includes("definitely-missing") && !(e.includes("_rsc=") && e.includes("ERR_ABORTED"))));
  errors.slice(0, 15).forEach((e) => console.log("   ", e.slice(0, 200)));
  ok(errors.length === 0, "no console/page/network errors");
  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("SCRIPT ERROR", e); process.exit(2); });
