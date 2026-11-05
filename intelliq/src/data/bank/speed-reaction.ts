import { L, type QDef } from "./types";

/**
 * Choice-reaction items. The server picks a random delay per serve (see reactionDelayMs); after it the correct
 * pad lights up. A press before that is a false start; a correct press must come within limitMs.
 * Timing is measured on the server from the moment the question was served, so it includes network latency:
 * the limits are deliberately generous and the result is a practice measure, not a lab reaction time.
 */
const react = (diff: QDef["diff"], minMs: number, maxMs: number, limitMs: number, rightIndex: number): QDef => ({
  cat: "speed",
  diff,
  prompt: "Wait until one pad lights up, then press it as fast as you can. Pressing before it lights up is a false start.",
  stem: { k: "reaction", minMs, maxMs, limitMs },
  timeLimitSec: Math.ceil((maxMs + limitMs) / 1000) + 4,
  fixedOrder: true,
  rightIndex,
  right: L(String(rightIndex + 1)),
  wrong: [0, 1, 2, 3].filter((i) => i !== rightIndex).map((i) => L(String(i + 1))),
  explanation: `Pad ${rightIndex + 1} lit up after a random delay. A correct answer presses that pad after it lights up, within ${limitMs} ms.`,
  mn: {
    prompt: "Нэг тэмдэг асахыг хүлээгээд аль болох хурдан дарна уу. Асахаас өмнө дарах нь буруу эхлэл болно.",
    explanation: `${rightIndex + 1}-р тэмдэг санамсаргүй хугацааны дараа асав. Зөв хариулт нь тэр тэмдгийг асмагц ${limitMs} мс-ийн дотор дарах явдал.`,
  },
});

export const reaction: QDef[] = [
  react(1, 1200, 2800, 2200, 2),
  react(2, 1200, 3200, 1800, 0),
  react(3, 1000, 3400, 1500, 3),
  react(4, 1000, 3600, 1200, 1),
  react(5, 800, 4000, 1000, 2),
];
