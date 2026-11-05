import { test } from "node:test";
import assert from "node:assert/strict";
import { sniffImage } from "./image-sniff";

const bytes = (...n: number[]) => Uint8Array.from(n);
const pad = (b: number[], len = 32) => Uint8Array.from([...b, ...Array(Math.max(0, len - b.length)).fill(0)]);

test("recognises the supported formats by magic bytes", () => {
  assert.equal(sniffImage(pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "png");
  assert.equal(sniffImage(pad([0xff, 0xd8, 0xff, 0xe0])), "jpg");
  assert.equal(sniffImage(pad([...Buffer.from("GIF89a")])), "gif");
  assert.equal(sniffImage(pad([...Buffer.from("GIF87a")])), "gif");
  assert.equal(sniffImage(pad([...Buffer.from("RIFF"), 1, 2, 3, 4, ...Buffer.from("WEBP")])), "webp");
});

test("rejects SVG, HTML, scripts, truncated and empty input", () => {
  for (const s of ['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', "<html><body>x</body></html>", "<?xml version='1.0'?><svg/>", "GIF90a", "#!/bin/sh\nrm -rf /"]) {
    assert.equal(sniffImage(Buffer.from(s)), null, s.slice(0, 20));
  }
  assert.equal(sniffImage(bytes()), null);
  assert.equal(sniffImage(bytes(0x89, 0x50)), null, "truncated PNG header");
  assert.equal(sniffImage(pad([...Buffer.from("RIFF"), 1, 2, 3, 4, ...Buffer.from("WAVE")])), null, "RIFF but not WebP");
});
