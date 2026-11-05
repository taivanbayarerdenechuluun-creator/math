import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ERRORS_MN, localizeError } from "./server-errors";

// a complete double-quoted string literal (pairs quotes left to right, so text between two literals is never matched)
const STRING = /"((?:[^"\\\n]|\\.)*)"/g;

const root = path.join(__dirname, "..", "..");
const walk = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
const read = (f: string) => fs.readFileSync(f, "utf8");

// Everything an end user can be shown by the API: the non-admin routes plus the lib modules whose messages they relay.
const userFacing = [
  ...walk(path.join(root, "src/app/api")).filter((f) => f.endsWith(".ts") && !f.includes(`${path.sep}admin${path.sep}`)),
  ...["sessions.ts", "image-sniff.ts", "validation.ts"].map((f) => path.join(root, "src/lib", f)),
];

const literals = (src: string, re: RegExp) => [...src.matchAll(re)].map((m) => m[1]);

test("every user-facing API message has a Mongolian translation", () => {
  const found = new Set<string>();
  for (const f of userFacing) {
    const src = read(f);
    for (const m of literals(src, /\berror: "([^"\\]+)"/g)) found.add(m);
    // messages passed to zod validators, e.g. .min(10, "…") or a *_MSG constant
    if (f.endsWith("validation.ts")) for (const m of literals(src, STRING)) if (m.length >= 6) found.add(m);
  }
  assert.ok(found.size >= 25, `scanned too little (${found.size})`);
  const missing = [...found].filter((m) => localizeError(m, "mn") === m);
  assert.deepEqual(missing, [], "add these to ERRORS_MN in src/lib/server-errors.ts");
});

test("the dictionary has no stale or untranslated entries", () => {
  const everything = walk(path.join(root, "src")).filter((f) => /\.(ts|tsx)$/.test(f) && !f.endsWith("server-errors.ts") && !f.endsWith("server-errors.test.ts")).map(read).join("\n");
  for (const [en, mn] of Object.entries(ERRORS_MN)) {
    assert.ok(/[\u0400-\u04FF]/.test(mn), `no Cyrillic in the translation of "${en}"`);
    assert.ok(everything.includes(en), `"${en}" is not used anywhere any more`);
  }
});

test("localizeError", () => {
  assert.equal(localizeError("Invalid request.", "en"), "Invalid request.");
  assert.equal(localizeError("Invalid request.", "mn"), ERRORS_MN["Invalid request."]);
  assert.equal(localizeError("Something the server invented.", "mn"), "Something the server invented.", "unknown text is shown as is");
  assert.equal(localizeError("File too large (max 512 KB).", "mn"), "Файл хэт том байна (дээд тал нь 512 KB).");
  assert.equal(localizeError("Image too large (max 1024 KB).", "mn"), "Зураг хэт том байна (дээд тал нь 1024 KB).");
  assert.equal(localizeError("File too large (max 512 KB).", "en"), "File too large (max 512 KB).");
});
