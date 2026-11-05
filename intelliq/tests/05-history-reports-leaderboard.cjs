const fs = require("fs");
const SD = require("path").join(__dirname, "out"); // screenshots and generated files
const L = require("./lib.cjs");
const { db, ok, client, post, play, register, done } = L;

(async () => {
  const a = client();
  const emailA = await register(a, "Alpha Smithson");
  const ridA1 = await play(a, "full-battery", 28, (i) => i % 3 !== 0);
  const ridA2 = await play(a, "full-battery", 28, () => true);
  const userA = await db.user.findUnique({ where: { email: emailA } });

  console.log("history page");
  let r = await a("/history");
  ok(r.status === 200 && /History &amp; progress|History & progress/.test(r.text), "history renders");
  ok(/Your attempts/.test(r.text) && /Full Cognitive Battery/.test(r.text), "lists attempts of the most-taken assessment");
  ok((await client()("/history")).status === 307, "history redirects anonymous users");
  const b0 = client(); await register(b0, "Empty Person");
  r = await b0("/history"); ok(/No attempts yet/.test(r.text), "empty state for new user");

  console.log("PDF report");
  for (const lang of ["en", "mn"]) {
    r = await fetch(`${L.B}/api/results/${ridA2}/pdf?lang=${lang}`, { headers: { cookie: (await a("/api/auth/me")).cookie() } });
    const buf = Buffer.from(await r.arrayBuffer());
    fs.writeFileSync(`${SD}/report-${lang}.pdf`, buf);
    ok(r.status === 200 && r.headers.get("content-type") === "application/pdf", `${lang}: 200 application/pdf`);
    ok(buf.slice(0, 5).toString() === "%PDF-" && buf.slice(-6).toString().includes("%%EOF"), `${lang}: valid PDF header/trailer (${buf.length} bytes)`);
    const pages = (buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
    ok(pages >= 2 && pages <= 4, `${lang}: ${pages} pages`);
    ok(/attachment; filename="INTELLIQ-report-IQ-/.test(r.headers.get("content-disposition") ?? ""), `${lang}: download filename has report id`);
  }
  r = await client()(`/api/results/${ridA2}/pdf`); ok(r.status === 404, "PDF: anonymous cannot download");
  const other = client(); await register(other, "Other Person");
  r = await other(`/api/results/${ridA2}/pdf`); ok(r.status === 404, "PDF: another user cannot download");
  ok((await db.report.count({ where: { resultId: ridA2 } })) === 1, "Report row recorded");

  console.log("share link");
  r = await post(a, `/api/results/${ridA2}/share`, { enable: true }, { Origin: "https://evil.example" }); ok(r.status === 403, "share: cross-site blocked");
  r = await post(other, `/api/results/${ridA2}/share`, { enable: true }); ok(r.status === 404, "share: non-owner cannot enable");
  r = await post(a, `/api/results/${ridA2}/share`, { enable: true });
  const token = r.json.shareToken; ok(r.status === 200 && token && token.length >= 20, "share: token created");
  r = await post(a, `/api/results/${ridA2}/share`, { enable: true }); ok(r.json.shareToken === token, "share: enabling twice keeps the same link");
  const pub = await client()(`/r/${token}`);
  ok(pub.status === 200 && /Shared INTELLIQ result/.test(pub.text), "public page opens without login");
  ok(!pub.text.includes(emailA) && !/Alpha|Smithson/.test(pub.text), "public page exposes no name or email");
  ok(!/IQ-\d{8}-/.test(pub.text), "public page hides the report id");
  ok((await client()("/r/short")).status === 404 && (await client()("/r/" + "x".repeat(24))).status === 404, "unknown tokens 404");
  r = await post(a, `/api/results/${ridA2}/share`, { enable: false }); ok(r.json.shareToken === null, "share: revoked");
  ok((await client()(`/r/${token}`)).status === 404, "revoked link stops working");

  console.log("certificate");
  r = await a(`/certificate/${ridA2}`);
  ok(r.status === 200 && /Certificate of Participation/.test(r.text) && /Alpha Smithson/.test(r.text), "certificate shows the owner's name");
  ok(/not an IQ certification/.test(r.text), "certificate is clearly a participation certificate");
  ok((await other(`/certificate/${ridA2}`)).status === 404 && (await client()(`/certificate/${ridA2}`)).status === 404, "certificate: others get 404");

  console.log("CSV export");
  r = await a("/api/export");
  const lines = r.text.trim().split("\n");
  ok(r.status === 200 && /text\/csv/.test(r.headers.get("content-type")) && lines.length === 3, `CSV has header + 2 rows (${lines.length} lines)`);
  ok(lines[0].startsWith("report_id,date,assessment") && lines[2].includes("100"), "CSV columns and perfect run present");
  ok((await client()("/api/export")).status === 401, "export requires sign-in");

  console.log("leaderboard & profiles");
  const bobEmail = await register(client(), "Bobby Longname"); // never plays; sanity for user creation
  const c = client(); const emailC = await register(c, "Carla Zzyzx");
  await play(c, "full-battery", 28, (i) => i % 2 === 0);
  const h = client(); const emailH = await register(h, "Hidden Champion");
  await play(h, "full-battery", 28, () => true);
  await db.user.updateMany({ where: { email: { in: [emailA, emailC] } }, data: { showOnLeaderboard: true } });
  // Hidden Champion has the top score but did not opt in
  r = await client()("/leaderboard?a=full-battery");
  ok(r.status === 200, "leaderboard is public");
  ok(/Alpha/.test(r.text) && /Carla/.test(r.text), "opted-in players are listed by first name");
  ok(!/Hidden/.test(r.text), "player who has not opted in is not listed even with the best score");
  ok(!r.text.includes(emailA) && !/Smithson|Zzyzx/.test(r.text), "no emails or surnames exposed");
  ok(r.text.indexOf("Alpha") < r.text.indexOf("Carla"), "ranked by score (Alpha 100 before Carla)");
  r = await client()("/leaderboard?a=full-battery&scope=weekly"); ok(r.status === 200 && /Alpha/.test(r.text), "weekly scope");
  r = await client()("/leaderboard?a=full-battery&scope=monthly&c=logical"); ok(r.status === 200, "category board renders");
  r = await client()("/leaderboard?a=quick-check"); ok(r.status === 200 && /No ranked results yet/.test(r.text), "empty state when nobody is ranked");
  r = await client()("/leaderboard?a=nope&scope=bad&c=%3Cscript%3Ealert(1)%3C%2Fscript%3E"); ok(r.status === 200 && !r.text.includes("<script>alert") && !r.text.includes("003cscript003ealert"), "bad params are handled safely");
  r = await h("/leaderboard?a=full-battery"); ok(/not ranked/.test(r.text), "signed-in non-opted user is told how to opt in");
  await db.assessmentResult.updateMany({ where: { userId: userA.id }, data: { scoringVersion: 0 } });
  r = await client()("/leaderboard?a=full-battery"); ok(!/Alpha/.test(r.text) && /Carla/.test(r.text), "results with another scoring version are not ranked");
  await db.assessmentResult.updateMany({ where: { userId: userA.id }, data: { scoringVersion: 1 } });
  await db.user.update({ where: { id: userA.id }, data: { disabledAt: new Date() } });
  r = await client()("/leaderboard?a=full-battery"); ok(!/Alpha/.test(r.text), "disabled accounts are removed from rankings");
  await db.user.update({ where: { id: userA.id }, data: { disabledAt: null } });

  const idC = (await db.user.findUnique({ where: { email: emailC } })).id;
  ok((await client()(`/u/${idC}`)).status === 404, "profile hidden by default (404)");
  await db.user.update({ where: { id: idC }, data: { publicProfile: true } });
  r = await client()(`/u/${idC}`);
  ok(r.status === 200 && /Carla/.test(r.text) && !/Zzyzx/.test(r.text) && !r.text.includes(emailC), "public profile shows first name only");
  ok(/Achievement showcase/.test(r.text) && /First Assessment/.test(r.text), "profile shows badges");
  ok((await client()("/u/doesnotexist")).status === 404, "unknown profile 404");
  r = await client()("/leaderboard?a=full-battery"); ok(new RegExp(`/u/${idC}`).test(r.text), "leaderboard links to opted-in public profiles");

  await db.assessmentSession.deleteMany({});
  await db.user.deleteMany({ where: { email: { in: [emailA, bobEmail, emailC, emailH] } } });
  await db.user.deleteMany({ where: { name: { in: ["Empty Person", "Other Person"] } } });
  await done();
})().catch((e) => { console.error("SCRIPT ERROR", e); process.exit(2); });
