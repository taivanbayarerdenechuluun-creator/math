// Integration: previous-attempt comparison + AI endpoint. Usage: node tests/03-feedback-and-ai.cjs noai   (app without an API key)
//   or: node tests/03-feedback-and-ai.cjs ai <calls.json>  (app pointed at tests/mock-ai-server.cjs, which writes calls.json)
const http = require("http");
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient(); const B = process.env.B || "http://localhost:3100"; let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log(c ? "  ok:" : "  FAIL:", m); };
function client() { let cookie = ""; return async (path, opts = {}) => { const r = await fetch(B + path, { redirect: "manual", ...opts, headers: { "Content-Type": "application/json", cookie, ...(opts.headers || {}) } });
  for (const c of (r.headers.getSetCookie?.() ?? [])) { const kv = c.split(";")[0]; const n = kv.split("=")[0]; cookie = cookie.split("; ").filter((x) => x && !x.startsWith(n + "=")).concat(kv).join("; "); }
  const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch {} return { status: r.status, json, text }; }; }
// A reaction item only scores if the right pad is pressed after it lit; these suites answer instantly, so move
// servedAt into the past as if the player had waited (elapsed = delay + 250 ms).
async function prime(sid, q) {
  if (q && q.reaction) await db.userAnswer.updateMany({ where: { sessionId: sid, questionId: q.id }, data: { servedAt: new Date(Date.now() - q.reaction.startsInMs - 250) } });
}

const opt = (q, good) => db.questionOption.findFirst({ where: { questionId: q, isCorrect: good } });
async function play(c, slug, n, goodFn) {
  let r = await c("/api/sessions", { method: "POST", body: JSON.stringify({ slug }) }); const sid = r.json.sessionId;
  let q = (await c(`/api/sessions/${sid}`)).json.questions[0];
  for (let i = 0; i < n; i++) { await prime(sid, q); await c(`/api/sessions/${sid}/answer`, { method: "POST", body: JSON.stringify({ questionId: q.id, optionId: (await opt(q.id, goodFn(i))).id }) });
    q = (await c(`/api/sessions/${sid}/next`, { method: "POST", body: JSON.stringify({ fromQuestionId: q.id }) })).json.question; }
  return (await c(`/api/sessions/${sid}/submit`, { method: "POST" })).json.resultId;
}
(async () => {
  const mode = process.argv[2];
  const u = client(); const email = `p3${Date.now()}@example.com`;
  await u("/api/auth/register", { method: "POST", body: JSON.stringify({ name: "Phase Three", email, password: "Str0ngPassw0rd" }) });

  console.log("comparison with previous attempt (signed in, same assessment)");
  const first = await play(u, "reasoning-core", 18, (i) => i % 3 === 0);   // ~33% correct
  const second = await play(u, "reasoning-core", 18, () => true);          // 100% correct
  let r = await u(`/results/${first}`);
  ok(r.status === 200 && !/vs previous/.test(r.text) , "first attempt shows no comparison");
  r = await u(`/results/${second}`);
  ok(r.status === 200, "second result renders");
  ok(/vs previous/.test(r.text), "second attempt shows 'vs previous' delta");
  ok(/higher than your previous attempt/.test(r.text), "feedback states the real improvement");
  ok(/not a change in IQ/.test(r.text), "feedback carries the practice-progress caveat");
  const a = await db.assessmentResult.findUnique({ where: { id: first } }), b = await db.assessmentResult.findUnique({ where: { id: second } });
  const delta = Math.round((b.performanceScore - a.performanceScore) * 10) / 10;
  ok(r.text.includes(`${Math.round(delta)} points higher`) || r.text.includes(`${delta} points higher`), `delta in text matches DB (${a.performanceScore} -> ${b.performanceScore} = ${delta})`);
  // different assessment must not be used as "previous"
  const other = await play(u, "quick-check", 10, () => true);
  r = await u(`/results/${other}`); ok(!/vs previous/.test(r.text), "different assessment is not treated as previous attempt");
  // guest never gets comparison
  const g = client(); const gr = await play(g, "reasoning-core", 18, () => true); r = await g(`/results/${gr}`); ok(!/vs previous/.test(r.text), "guest has no previous-attempt comparison");

  console.log("AI endpoint, mode:", mode);
  const s2 = second;
  if (mode === "noai") {
    r = await u(`/api/results/${s2}/insights`, { method: "POST", body: JSON.stringify({ lang: "en" }) });
    ok(r.status === 501, "501 when no API key configured");
    ok(/AI explanations are not enabled/.test((await u(`/results/${s2}`)).text), "page says AI is not enabled and offers no button");
    ok(!/Explain my results with AI/.test((await u(`/results/${s2}`)).text), "no AI button shown when unconfigured");
  } else {
    r = await u(`/results/${s2}`); ok(/Explain my results with AI/.test(r.text), "AI button shown when configured");
    r = await u(`/api/results/${s2}/insights`, { method: "POST", body: JSON.stringify({ lang: "xx" }) }); ok(r.status === 400, "bad lang rejected");
    r = await client()(`/api/results/${s2}/insights`, { method: "POST", body: JSON.stringify({ lang: "en" }) }); ok(r.status === 404, "other browser cannot request AI for my result");
    r = await u(`/api/results/${s2}/insights`, { method: "POST", body: JSON.stringify({ lang: "en" }) });
    ok(r.status === 200 && /MOCK-AI-REPLY/.test(r.json.text) && r.json.cached === false, "AI text returned (mock provider)");
    r = await u(`/api/results/${s2}/insights`, { method: "POST", body: JSON.stringify({ lang: "en" }) });
    ok(r.status === 200 && r.json.cached === true, "second request served from cache (no second provider call)");
    ok(/MOCK-AI-REPLY/.test((await u(`/results/${s2}`)).text), "saved AI text shown on page reload");
    r = await u(`/api/results/${s2}/insights`, { method: "POST", body: JSON.stringify({ lang: "mn" }) }); ok(r.status === 200 && r.json.cached === false, "other language generated separately");
    const calls = JSON.parse(require("fs").readFileSync(process.argv[3], "utf8"));
    ok(calls.length === 2, `provider called exactly twice (en, mn): ${calls.length}`);
    const sent = JSON.stringify(calls[0]);
    ok(!sent.includes(email) && !sent.includes("Phase Three"), "provider request contains no name or email");
    ok(/Never state, estimate or imply an IQ/.test(calls[0].body.system), "system prompt forbids IQ/percentile claims");
    ok(/Mongolian/.test(calls[1].body.messages[0].content), "Mongolian requested for mn");
  }
  await db.assessmentSession.deleteMany({}); await db.user.deleteMany({ where: { email } });
  console.log(`\n${pass} passed, ${fail} failed`); await db.$disconnect(); process.exit(fail ? 1 : 0);
})();
