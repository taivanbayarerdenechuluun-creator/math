import type { Fig, Glyph, Shape, Fill } from "../../lib/figures";
import type { QDef } from "./types";

const g = (shape: Shape, rot = 0, fill: Fill = "solid", n = 1): Glyph => ({ k: "glyph", shape, rot, fill, n });
const arrow = (rot: number, n = 1, fill: Fill = "solid") => g("arrow", rot, fill, n);

const make = (diff: QDef["diff"], items: Fig[], right: Fig, wrong: Fig[], explanation: string): QDef => ({
  cat: "abstract",
  diff,
  prompt: "Which figure completes the sequence?",
  stem: { k: "seq", items: [...items, null] },
  right: { fig: right },
  wrong: wrong.map((fig) => ({ fig })),
  explanation,
});

export const abstract: QDef[] = [
  make(1, [arrow(0), arrow(90), arrow(180)], arrow(270), [arrow(0), arrow(90), arrow(180)], "The arrow turns 90° clockwise at each step, so after 180° comes 270°."),
  make(1, [g("circle", 0, "solid", 1), g("circle", 0, "solid", 2), g("circle", 0, "solid", 3)], g("circle", 0, "solid", 4), [g("circle", 0, "solid", 3), g("circle", 0, "solid", 5), g("circle", 0, "solid", 6)], "One more circle is added at each step: 1, 2, 3, then 4."),
  make(1, [g("square", 0, "solid"), g("square", 0, "outline"), g("square", 0, "solid")], g("square", 0, "outline"), [g("square", 0, "solid"), g("square", 0, "light"), g("circle", 0, "outline")], "The fill alternates between solid and outline, so an outline square comes next."),

  make(2, [g("square"), g("circle"), g("triangle"), g("square"), g("circle")], g("triangle"), [g("square"), g("circle"), g("diamond")], "The shapes repeat in a cycle of three: square, circle, triangle."),
  make(2, [arrow(0), arrow(45), arrow(90), arrow(135)], arrow(180), [arrow(225), arrow(90), arrow(270)], "The arrow turns 45° clockwise each step: 0°, 45°, 90°, 135°, 180°."),
  make(2, [g("square", 0, "solid", 5), g("square", 0, "solid", 4), g("square", 0, "solid", 3)], g("square", 0, "solid", 2), [g("square", 0, "solid", 1), g("square", 0, "solid", 3), g("square", 0, "solid", 4)], "One square is removed at each step: 5, 4, 3, then 2."),

  make(3, [g("triangle", 0, "solid"), g("triangle", 90, "outline"), g("triangle", 180, "solid")], g("triangle", 270, "outline"), [g("triangle", 270, "solid"), g("triangle", 180, "outline"), g("triangle", 0, "outline")], "Two rules run together: the triangle turns 90° each step and the fill alternates solid/outline."),
  make(3, [g("square"), g("circle"), g("square"), g("triangle"), g("square")], g("circle"), [g("triangle"), g("square", 0, "outline"), g("diamond")], "A square appears in every odd position; the even positions alternate circle, triangle, circle…"),
  make(3, [g("circle", 0, "solid", 1), g("square", 0, "solid", 2), g("circle", 0, "solid", 3)], g("square", 0, "solid", 4), [g("circle", 0, "solid", 4), g("square", 0, "solid", 3), g("square", 0, "solid", 5)], "The count rises by one each step while the shape alternates circle/square."),

  make(4, [arrow(0, 1), arrow(90, 2), arrow(180, 3)], arrow(270, 4), [arrow(180, 4), arrow(270, 3), arrow(90, 4)], "Both rules advance together: the arrow turns 90° and one more arrow is added each step."),
  make(4, [g("diamond", 0, "solid"), g("diamond", 0, "light"), g("diamond", 0, "outline"), g("diamond", 0, "solid"), g("diamond", 0, "light")], g("diamond", 0, "outline"), [g("diamond", 0, "solid"), g("diamond", 0, "light"), g("star", 0, "outline")], "The fill repeats in a cycle of three: solid, light, outline."),
  make(4, [arrow(270), arrow(180), arrow(90)], arrow(0), [arrow(90), arrow(180), arrow(45)], "The arrow turns 90° counter-clockwise each step: 270°, 180°, 90°, 0°."),

  make(5, [arrow(0), arrow(45), arrow(135), arrow(270)], arrow(90), [arrow(180), arrow(225), arrow(315)], "The turns grow by 45° each step: +45°, +90°, +135°, so the next is +180° → 270° + 180° = 450° = 90°."),
  make(5, [g("square", 0, "solid", 1), g("circle", 0, "outline", 2), g("triangle", 0, "solid", 3), g("square", 0, "outline", 4)], g("circle", 0, "solid", 5), [g("circle", 0, "outline", 5), g("circle", 0, "solid", 4), g("triangle", 0, "solid", 5)], "Three rules run together: shape cycles square→circle→triangle, fill alternates solid/outline, and the count rises by one."),
  make(5, [arrow(0), g("triangle", 90), arrow(180), g("triangle", 270)], arrow(0), [arrow(90), g("triangle", 0), arrow(180)], "The shape alternates arrow/triangle while the figure turns 90° each step; 270° + 90° = 360° = 0° on an arrow."),
];
