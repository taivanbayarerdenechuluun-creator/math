# Adaptive difficulty algorithm

Implemented in `src/lib/engine.ts` (pure functions, unit-tested in `engine.test.ts`) and applied by
`src/lib/sessions.ts`.

## Difficulty scale
Every question has a difficulty 1 (easy) to 5 (hard). The bank has 24 generated questions per level in
each of the 7 categories, plus the 3 (5 in speed and spatial) hand-written ones: 27 or more per level. The difficulty actually served is recorded per answer (`UserAnswer.difficulty`).

## Staircase (per category)
Each category keeps its own state `{ d, s }` (current difficulty, consecutive-correct streak), starting at `d = 3, s = 0`.

| Event in that category                     | Effect                                   |
|--------------------------------------------|------------------------------------------|
| Correct answer, streak becomes 1           | `s = 1`, difficulty unchanged            |
| Correct answer, streak becomes 2           | `d = min(5, d + 1)`, `s = 0`             |
| Incorrect answer or skip                   | `d = max(1, d − 1)`, `s = 0`             |

So difficulty does **not** rise after every correct answer. A "2-up / 1-down" rule converges on the
difficulty where a person answers about 70.7% correctly (Levitt, 1971).

## Routing happens once
Only the **first** answer to a question (or skipping it) moves the staircase (`UserAnswer.resolved`).
Changing an answer later affects the score but not the routing, which prevents gaming the path by
revisiting earlier questions.

## Choosing the next question
1. **Category:** the category served the fewest times so far (ties at random), among categories that
   still have unused questions. Every selected category is sampled before any is repeated.
2. **Question:** among that category's unused active questions, the one whose difficulty is closest to the
   category's current `d` (ties at random). A question is never repeated within a session.
3. **Not twice across tests:** the questions the same person was served in their other tests (the signed-in user's
   last 1500 answers, or the guest's browser) are set aside while possible: an unseen question at the best
   difficulty distance is preferred, then an unseen one a single step further; a repeat is served only when
   everything near the target has been seen (`pickQuestion` in `engine.ts`, `seenElsewhere` in `sessions.ts`).

## Lazy serving and timers
The next question is created only when the user advances, so its server timestamp (`servedAt`) is when it is
first presented. Timed questions are checked against that timestamp on the server (3 s grace);
late answers are discarded. Memory material is delivered only inside its display window.

## Per-assessment configuration (Admin → Assessments)
- **Difficulty range** (`difficultyMin`..`difficultyMax`): the staircase target and the candidate questions are clamped to it, so a 4-5 assessment never serves an easy item, even after wrong answers.
- **Category shares** (`categoryWeights`, e.g. logical 3, memory 1): the next category is the one with the lowest served/weight ratio, so a 3:1 weighting gives about three logical items per memory item.
- **Curated pool** (`AssessmentQuestion`): when questions are picked, only those may be served. Saving is refused when fewer servable questions exist than the assessment needs, or when a weighted category has none.
- Changing the range, shares or pool bumps the assessment version (results of different versions are not compared on leaderboards); cosmetic edits and reordering do not.

## Item types
Besides text and figure items: 3D cube stacks (count the cubes; only stacks whose columns are all visible are used), memory items with a timed stimulus, and **reaction items**. For a reaction item the server picks the delay (deterministic per served question), the correct pad lights after it, and the answer counts only if it is the right pad pressed *after* it lit and within the limit, measured from the server's own `servedAt` (so network latency counts against the player; the limits are generous). A press before the pad lights is a false start. Reaction answers are final.

## Non-adaptive assessments
If `Assessment.adaptive = false`, the target stays at 3 for every question.
