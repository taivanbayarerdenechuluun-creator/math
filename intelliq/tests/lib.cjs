const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();
const B = process.env.B || "http://localhost:3100";
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log(c ? "  ok:" : "  FAIL:", m); };

function client() {
  let cookie = "";
  return async (path, opts = {}) => {
    const r = await fetch(B + path, { redirect: "manual", ...opts, headers: { "Content-Type": "application/json", cookie, ...(opts.headers || {}) } });
    for (const c of (r.headers.getSetCookie?.() ?? [])) {
      const kv = c.split(";")[0];
      const n = kv.split("=")[0];
      cookie = cookie.split("; ").filter((x) => x && !x.startsWith(n + "=")).concat(kv).join("; ");
    }
    const text = await r.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    return { status: r.status, json, text, headers: r.headers, cookie: () => cookie, location: r.headers.get("location") };
  };
}

// A reaction item only scores if the right pad is pressed after it lit. These suites answer instantly, so move
// the item's servedAt into the past as if the player had waited for the pad: elapsed = delay + 250 ms.
async function prime(sid, q) {
  if (q && q.reaction) await db.userAnswer.updateMany({ where: { sessionId: sid, questionId: q.id }, data: { servedAt: new Date(Date.now() - q.reaction.startsInMs - 250) } });
}

const opt = (q, good) => db.questionOption.findFirst({ where: { questionId: q, isCorrect: good } });
const post = (c, path, body, headers) => c(path, { method: "POST", body: JSON.stringify(body ?? {}), headers });

async function play(c, slug, n, goodFn = () => true) {
  const r = await post(c, "/api/sessions", { slug });
  const sid = r.json.sessionId;
  let q = (await c(`/api/sessions/${sid}`)).json.questions[0];
  for (let i = 0; i < n; i++) {
    await prime(sid, q);
    await post(c, `/api/sessions/${sid}/answer`, { questionId: q.id, optionId: (await opt(q.id, goodFn(i, q))).id });
    q = (await post(c, `/api/sessions/${sid}/next`, { fromQuestionId: q.id })).json.question;
  }
  return (await post(c, `/api/sessions/${sid}/submit`)).json.resultId;
}

async function register(c, name = "Tester") {
  const email = `t${Date.now()}${Math.floor(Math.random() * 1e4)}@example.com`;
  const r = await post(c, "/api/auth/register", { name, email, password: "Str0ngPassw0rd" });
  if (r.status !== 200) throw new Error("register failed: " + r.text);
  return email;
}

const done = async () => {
  console.log(`\n${pass} passed, ${fail} failed`);
  await db.$disconnect();
  process.exit(fail ? 1 : 0);
};

module.exports = { db, B, ok, client, opt, post, play, register, done, prime };
