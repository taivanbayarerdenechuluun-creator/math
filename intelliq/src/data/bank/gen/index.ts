import { abstract as coreAbstract } from "../abstract";
import { logical as coreLogical } from "../logical";
import { memory as coreMemory } from "../memory";
import { numerical as coreNumerical } from "../numerical";
import { reaction as coreReaction } from "../speed-reaction";
import { spatial as coreSpatial } from "../spatial";
import { spatial3d as coreSpatial3d } from "../spatial3d";
import { speed as coreSpeed } from "../speed";
import { verbal as coreVerbal } from "../verbal";
import type { QDef } from "../types";
import { generateAbstract } from "./abstract";
import { generateLogical } from "./logical";
import { generateMemory } from "./memory";
import { generateNumerical } from "./numerical";
import { generateSpatial } from "./spatial";
import { generateSpeed } from "./speed";
import { generateVerbal } from "./verbal";
import { identity } from "./util";

/**
 * 120 generated questions in every category (24 per difficulty), 840 in all, appended after the hand-written bank.
 * No generated question repeats a hand-written one or another generated one.
 *
 * The order here is part of the bank's identity: a question's key (e.g. numerical-016) is its position within its
 * category, and the seed only fills in keys that are missing, so existing databases keep their questions. Never reorder
 * these, never change a generator's output for an existing seed, and add new questions only by appending new streams.
 */
const seen = new Set<string>(
  [coreLogical, coreAbstract, coreNumerical, coreVerbal, coreSpatial, coreMemory, coreSpeed, coreSpatial3d, coreReaction].flat().map(identity),
);

export const GENERATED: QDef[] = [
  ...generateLogical(seen), ...generateAbstract(seen), ...generateNumerical(seen), ...generateVerbal(seen),
  ...generateSpatial(seen), ...generateMemory(seen), ...generateSpeed(seen),
];
