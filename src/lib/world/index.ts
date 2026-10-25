// Your pet's world: what unlocks at each milestone, and drawing it from someone's steps and saved
// choices. See common.ts for the shared pieces and the art style, pet.ts for the pet itself.

import {
  LEVELS,
  levelOf,
  MAX_LEVEL,
  STAGE_LEVELS,
  stageOf,
  WORLD_KINDS,
  type Choice,
  type Picks,
  type Slot,
  type TimeOfDay,
  type WorldArt,
  type WorldDef,
  type WorldKind,
} from '@/lib/world/common';
import { PET } from '@/lib/world/pet';

export {
  LEVELS,
  levelOf,
  MAX_LEVEL,
  stageOf,
  WORLD_KINDS,
  type Choice,
  type Picks,
  type Slot,
  type WorldArt,
  type WorldDef,
  type WorldKind,
};
export { WORLD_HEIGHT, WORLD_WIDTH, type Layer, type Motion, type PetSpot } from '@/lib/world/common';

/** Kinds of world by name: just the pet for now (the database has room for more). */
export const WORLDS: Record<WorldKind, WorldDef> = { pet: PET };

/** Choices as saved, by kind, each with a name. */
export type KindPicks = Record<string, string>;
export type SavedPicks = Partial<Record<WorldKind, KindPicks>>;

/** Longest name for a pet, a city... */
export const NAME_LENGTH = 20;

export function choiceLevel(slot: Slot, choice: Choice): number {
  return Math.max(slot.level, choice.level ?? slot.level);
}

/** Every unlocked slot's choice: the saved one if it's still valid and unlocked, else the default. */
export function resolvePicks(def: WorldDef, level: number, saved: KindPicks | undefined): Picks {
  const picks: Picks = {};
  for (const slot of def.slots) {
    if (slot.level > level) continue;
    const wanted = saved?.[slot.id];
    const choice = slot.choices.find((c) => c.id === wanted && choiceLevel(slot, c) <= level) ?? slot.choices[0]!;
    picks[slot.id] = choice.id;
  }
  return picks;
}

export function drawWorld(kind: WorldKind, steps: number, saved: KindPicks | undefined, time: TimeOfDay): WorldArt {
  const def = WORLDS[kind];
  const level = levelOf(steps);
  return def.draw(level, resolvePicks(def, level, saved), time, steps);
}

/** What one milestone brings: a new stage, new things to customise, new options for old ones. */
export type Unlock = {
  level: number;
  steps: number;
  /** The stage it grows into, if it grows. */
  grows: string | null;
  slots: Slot[];
  choices: { slot: Slot; choices: Choice[] }[];
};

export function unlockAt(def: WorldDef, level: number): Unlock {
  const stage = (STAGE_LEVELS as readonly number[]).indexOf(level);
  return {
    level,
    steps: LEVELS[level]!,
    grows: stage > 0 ? def.stages[stage]! : null,
    slots: def.slots.filter((s) => s.level === level),
    choices: def.slots.flatMap((slot) => {
      const later = slot.choices.filter((c) => c.level !== undefined && c.level > slot.level && c.level === level);
      return later.length ? [{ slot, choices: later }] : [];
    }),
  };
}

/** A few words for a milestone: "Grows into a cottage · Fence". */
export function describeUnlock(unlock: Unlock): string {
  const parts = [
    ...(unlock.grows ? [`Grows: ${unlock.grows}`] : []),
    ...unlock.slots.map((s) => s.title),
    ...unlock.choices.flatMap((c) => c.choices.map((choice) => choice.label)),
  ];
  return parts.join(' · ');
}

/** How far through the current level, 0–1 (1 at the top level). */
export function levelProgress(steps: number): number {
  const level = levelOf(steps);
  if (level >= MAX_LEVEL) return 1;
  const from = LEVELS[level]!;
  return (steps - from) / (LEVELS[level + 1]! - from);
}
