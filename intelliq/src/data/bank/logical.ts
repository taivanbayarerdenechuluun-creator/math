import { L, Ls, type QDef } from "./types";

const q = (diff: QDef["diff"], prompt: string, right: string, wrong: string[], explanation: string): QDef => ({
  cat: "logical", diff, prompt, right: L(right), wrong: Ls(...wrong), explanation,
});

export const logical: QDef[] = [
  q(1, "All cats are animals. Tom is a cat. Which conclusion follows?", "Tom is an animal", ["Tom is not an animal", "All animals are cats", "Tom is a dog"], "Tom belongs to the group of cats, and every cat is an animal."),
  q(1, "Which one does not belong?  Triangle, Square, Circle, Pentagon", "Circle", ["Triangle", "Square", "Pentagon"], "The other three are polygons with straight sides and corners; a circle has neither."),
  q(1, "If today is Wednesday, what day was it three days ago?", "Sunday", ["Monday", "Saturday", "Tuesday"], "Counting back from Wednesday: Tuesday, Monday, Sunday."),
  q(2, "What comes next?  A, C, E, G, ?", "I", ["H", "J", "K"], "The letters skip one each time (A, C, E, G, I)."),
  q(2, "If it rains, the ground gets wet. The ground is wet. What can be concluded?", "Nothing certain about whether it rained", ["It rained", "It did not rain", "The ground is always wet"], "The ground could be wet for other reasons (a sprinkler, a spill), so the wet ground does not prove rain."),
  q(2, "Ann is taller than Ben. Ben is taller than Cara. Who is the shortest?", "Cara", ["Ann", "Ben", "Ann and Cara are equal"], "Ann > Ben > Cara, so Cara is shortest."),
  q(3, "What comes next?  Z, X, V, T, ?", "R", ["S", "Q", "P"], "The letters step back two places each time (Z, X, V, T, R)."),
  q(3, "Some doctors are musicians. All musicians are readers. Which statement must be true?", "Some doctors are readers", ["All doctors are readers", "All readers are musicians", "No doctors are readers"], "The doctors who are musicians are also readers, so at least some doctors are readers. The others do not have to follow."),
  q(3, "Eve stands right of Dan and left of Fay. Gus stands right of Fay. Hal stands left of Dan. All five stand in a row. Who is in the middle?", "Eve", ["Dan", "Fay", "Hal"], "The order from left to right is Hal, Dan, Eve, Fay, Gus, so Eve is third of five."),
  q(4, "What comes next?  1, 2, 4, 7, 11, 16, ?", "22", ["21", "23", "24"], "The differences are 1, 2, 3, 4, 5, so the next is 6: 16 + 6 = 22."),
  q(4, "Either the vault is locked or the alarm is on. The alarm is off. Which conclusion follows?", "The vault is locked", ["The vault is open", "The alarm is broken", "Nothing can be concluded"], "At least one of the two statements is true. The alarm is off, so the vault must be locked."),
  q(4, "In a code, A = 1, B = 2, C = 3 and so on, and numbers are written one after another. CAT is written 3120. How is DOG written?", "4157", ["41507", "4715", "4167"], "D = 4, O = 15, G = 7, so DOG is 4 15 7 → 4157."),
  q(5, "A bat and a ball cost $1.10 together. The bat costs $1.00 more than the ball. How much does the ball cost?", "5 cents", ["10 cents", "15 cents", "1 cent"], "If the ball is x, the bat is x + 1.00 and 2x + 1.00 = 1.10, so x = 0.05."),
  q(5, "Three boxes are labelled “Apples”, “Oranges” and “Mixed”, and every label is wrong. You take one fruit from the box labelled “Mixed” and it is an apple. What does the box labelled “Oranges” contain?", "Mixed fruit", ["Apples", "Oranges", "It cannot be determined"], "The “Mixed” box holds only apples. The “Oranges” box cannot hold oranges (label wrong) or apples (taken), so it holds the mixed fruit."),
  q(5, "Alice says “Bob is lying.” Bob says “Carol is lying.” Carol says “Alice and Bob are both lying.” Who is telling the truth?", "Only Bob", ["Only Alice", "Only Carol", "Alice and Carol"], "If Alice were truthful, Bob lies, so Carol is truthful, but Carol says Alice lies. That contradicts. So Alice lies, Bob is truthful, and Carol lies, which is consistent."),
];
