import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer, type IncomingMessage } from "node:http";
import { buildAiPrompt, generateAiInsight, type AiInput } from "./ai";

const input: AiInput = {
  assessment: "Quick Check", performance: 68, accuracy: 70, total: 10, correct: 7, unanswered: 1, durationSec: 420,
  categories: [{ name: "logical reasoning", correct: 2, total: 2, performance: 100, hardestCorrect: 4 }, { name: "memory", correct: 0, total: 1, performance: 0, hardestCorrect: null }],
  feedback: { strengths: [{ en: "Strong logic.", mn: "x" }], improvements: [], observations: [] },
};

const message = (over: Record<string, unknown> = {}) => ({
  id: "msg_test", type: "message", role: "assistant", model: "claude-opus-5-5", stop_sequence: null,
  content: [{ type: "text", text: "Mock insight." }], stop_reason: "end_turn", usage: { input_tokens: 10, output_tokens: 5 }, ...over,
});

type Seen = { url?: string; headers?: IncomingMessage["headers"]; body?: Record<string, unknown> & { system: string; messages: { role: string; content: string }[] } };

async function withProvider<T>(reply: (n: number) => { status?: number; json: unknown }, run: (seen: Seen[]) => Promise<T>): Promise<T> {
  const seen: Seen[] = [];
  const srv = createServer((req, res) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      seen.push({ url: req.url, headers: req.headers, body: JSON.parse(data) });
      const r = reply(seen.length);
      res.statusCode = r.status ?? 200;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify(r.json));
    });
  });
  await new Promise<void>((r) => srv.listen(0, r));
  process.env.ANTHROPIC_API_KEY = "test-key";
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${(srv.address() as { port: number }).port}`;
  try {
    return await run(seen);
  } finally {
    srv.close();
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_BASE_URL;
    delete process.env.ANTHROPIC_MODEL;
  }
}

test("prompt contains only aggregate data and the requested language", () => {
  const p = buildAiPrompt(input, "mn");
  assert.match(p, /Mongolian/);
  assert.match(p, /logical reasoning: 2\/2 correct, performance 100%, hardest correct difficulty 4\/5/);
  assert.match(p, /performance 68\/100/);
  assert.doesNotMatch(p, /@|email|password/i);
});

test("official SDK request: model, fallbacks, effort, headroom for thinking, no deprecated params", async () => {
  await withProvider(() => ({ json: message() }), async (seen) => {
    assert.equal(await generateAiInsight(input, "en"), "Mock insight.");
    const s = seen[0];
    assert.match(s.url ?? "", /^\/v1\/messages/);
    assert.equal(s.headers?.authorization, "Bearer test-key"); // how the official SDK authenticates
    assert.match(String(s.headers?.["anthropic-version"]), /^\d{4}-\d{2}-\d{2}$/);
    assert.match(String(s.headers?.["anthropic-beta"]), /server-side-fallback-2026-07-01/);
    const b = s.body!;
    assert.equal(b.model, "claude-opus-5-5");
    assert.equal(b.fallbacks, "default");
    assert.deepEqual(b.output_config, { effort: "low" });
    assert.ok((b.max_tokens as number) >= 2048, "max_tokens must leave room for thinking tokens");
    for (const k of ["temperature", "top_p", "top_k", "thinking"]) assert.ok(!(k in b), `${k} must not be sent`);
    assert.match(b.system, /Never state, estimate or imply an IQ/);
    assert.equal(b.messages.length, 1);
    assert.equal(b.messages[0].role, "user");
    assert.doesNotMatch(JSON.stringify(b.messages), /@|password/i);
  });
});

test("ANTHROPIC_MODEL overrides the default model", async () => {
  await withProvider(() => ({ json: message() }), async (seen) => {
    process.env.ANTHROPIC_MODEL = "claude-sonnet-5-5";
    await generateAiInsight(input, "mn");
    assert.equal(seen[0].body!.model, "claude-sonnet-5-5");
    assert.match(seen[0].body!.messages[0].content, /Mongolian/);
  });
});

test("text is read from text blocks only (thinking blocks are ignored)", async () => {
  await withProvider(() => ({ json: message({ content: [{ type: "thinking", thinking: "", signature: "sig" }, { type: "text", text: "Part one." }, { type: "text", text: " Part two." }] }) }), async () => {
    assert.equal(await generateAiInsight(input, "en"), "Part one. Part two.");
  });
});

test("a refusal is surfaced as an error and a truncated reply is not treated as success", async () => {
  await withProvider(() => ({ json: message({ content: [], stop_reason: "refusal", stop_details: { type: "refusal", category: null, explanation: "x" } }) }), async () => {
    await assert.rejects(() => generateAiInsight(input, "en"), /declined/);
  });
  await withProvider(() => ({ json: message({ content: [{ type: "thinking", thinking: "", signature: "s" }], stop_reason: "max_tokens" }) }), async () => {
    await assert.rejects(() => generateAiInsight(input, "en"), /cut off/);
  });
});

test("provider errors and a missing key surface as errors", async () => {
  await assert.rejects(() => generateAiInsight(input, "en"), /not configured/);
  await withProvider(() => ({ status: 400, json: { type: "error", error: { type: "invalid_request_error", message: "bad" } } }), async () => {
    await assert.rejects(() => generateAiInsight(input, "en"), /provider error 400/);
  });
});
