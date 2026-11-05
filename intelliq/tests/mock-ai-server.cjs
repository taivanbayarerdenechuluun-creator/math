// A stand-in for the Anthropic Messages API, for suite 03 in `ai` mode. Every request is appended to a JSON file so the
// suite can check what the app sent (and that nothing personal was in it).
//   node tests/mock-ai-server.cjs tests/out/mock-ai-calls.json 4010        (leave running)
//   ANTHROPIC_API_KEY=test-key ANTHROPIC_BASE_URL=http://127.0.0.1:4010 npm run dev -- -p 3100
//   node tests/03-feedback-and-ai.cjs ai tests/out/mock-ai-calls.json
const http = require("node:http");
const fs = require("node:fs");

const out = process.argv[2] || "mock-ai-calls.json";
const port = Number(process.argv[3] || 4010);
const calls = [];
fs.writeFileSync(out, "[]");

http
  .createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const body = raw ? JSON.parse(raw) : {};
      calls.push({ url: req.url, authorization: req.headers.authorization, beta: req.headers["anthropic-beta"], version: req.headers["anthropic-version"], body });
      fs.writeFileSync(out, JSON.stringify(calls));
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({
        id: "msg_mock", type: "message", role: "assistant", model: body.model ?? "mock",
        content: [{ type: "text", text: "MOCK-AI-REPLY: you did well." }],
        stop_reason: "end_turn", stop_sequence: null, usage: { input_tokens: 10, output_tokens: 10 },
      }));
    });
  })
  .listen(port, "127.0.0.1", () => console.log(`mock Anthropic API on http://127.0.0.1:${port}, logging to ${out}`));
