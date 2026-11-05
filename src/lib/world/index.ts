// Your pet's world: what unlocks at each milestone, and drawing it from someone's steps and saved
// choices. See common.ts for the shared pieces and the art style, pet.ts for the pet itself.

import type { Stop } from '@/lib/journeys';
import { drawScene, type Shape } from '@/lib/scene-art';
import {
  LEVELS,
  levelOf,
  MAX_LEVEL,
  STAGE_LEVELS,
  stageOf,
  WORLD_KINDS,
  type Choice,
  type Guest,
  type Picks,
  type Slot,
  type Souvenir,
  type TimeOfDay,
  type WorldArt,
  type WorldDef,
  type WorldKind,
} from '@/lib/world/common';
import { COLOURABLE_SLOTS, colourKey, itemColour, slotColourKey } from '@/lib/world/colours';
import type { Mood } from '@/lib/world/mood';
import { awayBackdrop, LOOK_SLOTS, PET, petAway, petPhoto } from '@/lib/world/pet';

export {
  LEVELS,
  levelOf,
  MAX_LEVEL,
  stageOf,
  WORLD_KINDS,
  type Choice,
  type Picks,
  type Slot,
  type Souvenir,
  type WorldArt,
  type WorldDef,
  type WorldKind,
};
export { WORLD_HEIGHT, WORLD_WIDTH, type Layer, type Motion, type PetSpot } from '@/lib/world/common';
export { COLOURABLE_SLOTS, colourKey, ITEM_COLOURS, slotColourKey, type ItemColour } from '@/lib/world/colours';
export { MOOD_SAYS, moodLine, moodOf, type Mood } from '@/lib/world/mood';
export { learnedTricks, training, TRICKS, type Trick, type TrickId } from '@/lib/world/tricks';

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

/**
 * Every unlocked slot's choice: the saved one if it's still valid and unlocked, else the default (its
 * first choice that isn't from the shop). A souvenir (brought home from a trip, or for a full passport
 * page) or something bought in the shop counts whatever the level, even in a slot not unlocked yet:
 * it was earned. A thing worn in a chosen colour brings it along as `colour.<slot>`.
 */
export function resolvePicks(def: WorldDef, level: number, saved: KindPicks | undefined): Picks {
  const picks: Picks = {};
  for (const slot of def.slots) {
    const wanted = saved?.[slot.id];
    const earned =
      def.souvenirs?.some((s) => s.slot === slot.id && s.choice.id === wanted) ||
      slot.choices.some((c) => c.shop && c.id === wanted);
    if (earned) {
      picks[slot.id] = wanted!;
      continue;
    }
    if (slot.level > level || slot.shop) continue;
    const choice =
      slot.choices.find((c) => c.id === wanted && !c.shop && choiceLevel(slot, c) <= level) ??
      slot.choices.find((c) => !c.shop)!;
    picks[slot.id] = choice.id;
  }
  for (const slot of COLOURABLE_SLOTS) {
    const worn = picks[slot];
    const colour = worn && worn !== 'none' ? saved?.[colourKey(slot, worn)] : undefined;
    if (itemColour(colour)) picks[slotColourKey(slot)] = colour!;
  }
  return picks;
}

/** A group mate's pet over for a playdate: its steps and choices as saved. */
export type Visitor = { steps: number; saved: KindPicks | undefined };

function guestOf(visitor: Visitor | undefined): Guest | undefined {
  if (!visitor) return undefined;
  const level = levelOf(visitor.steps);
  return { level, picks: resolvePicks(PET, level, visitor.saved) };
}

export function drawWorld(
  kind: WorldKind,
  steps: number,
  saved: KindPicks | undefined,
  time: TimeOfDay,
  mood?: Mood,
  visitor?: Visitor
): WorldArt {
  const def = WORLDS[kind];
  const level = levelOf(steps);
  return def.draw(level, resolvePicks(def, level, saved), time, steps, mood, guestOf(visitor));
}

/** The last few places drawn for a pet away, moved into the yard's box (it's redrawn on every render). */
const backdrops = new Map<string, { sky: readonly [string, string]; shapes: Shape[] }>();

/**
 * Your pet off on an adventure for the day: in the place (a stop on one of the journey routes) instead
 * of its yard, and playable there as at home.
 */
export function drawAway(
  stop: Stop,
  steps: number,
  saved: KindPicks | undefined,
  time: TimeOfDay,
  mood: Mood = 'awake',
  visitor?: Visitor
): WorldArt {
  const key = `${stop.name}:${time}`;
  let backdrop = backdrops.get(key);
  if (!backdrop) {
    const scene = drawScene(stop.scene, time, stop.name);
    backdrop = { sky: scene.sky, shapes: awayBackdrop(scene.shapes) };
    if (backdrops.size > 4) backdrops.delete(backdrops.keys().next().value!);
    backdrops.set(key, backdrop);
  }
  const level = levelOf(steps);
  return petAway(level, resolvePicks(PET, level, saved), time, mood, backdrop, guestOf(visitor));
}

/** A friend's pet that yours is round with today, and where it is if it's off on a trip. */
export type Host = Visitor & { away?: Stop };

/**
 * Your pet round at a friend's for the day: in their yard, with their things, standing where their
 * pet usually does and playable as at home, with theirs beside it. If their pet is off on a trip,
 * yours has gone to find it there.
 */
export function drawVisit(
  host: Host,
  steps: number,
  saved: KindPicks | undefined,
  time: TimeOfDay,
  mood: Mood = 'awake'
): WorldArt {
  if (host.away) return drawAway(host.away, steps, saved, time, mood, host);
  const level = levelOf(steps);
  const theirs = resolvePicks(PET, levelOf(host.steps), host.saved);
  const mine = resolvePicks(PET, level, saved);
  // A thing's colour (`colour.hat`) goes along with the thing.
  const isLook = (key: string) => LOOK_SLOTS.includes(key.replace(/^colour\./, ''));
  const yard = Object.entries(theirs).filter(([key]) => !isLook(key));
  const look = Object.entries(mine).filter(([key]) => isLook(key));
  const picks: Picks = Object.fromEntries([...yard, ...look]);
  return PET.draw(level, picks, time, steps, mood, guestOf(host));
}

/**
 * Your pet on its own, smiling for a postcard from somewhere else: feet at (x, feet) in that
 * picture, `size` its scale. Its shapes, back to front.
 */
export function drawPetPhoto(
  steps: number,
  saved: KindPicks | undefined,
  time: TimeOfDay,
  x: number,
  feet: number,
  size: number
): Shape[] {
  const level = levelOf(steps);
  return petPhoto(level, resolvePicks(PET, level, saved), time, x, feet, size);
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
    slots: def.slots.filter((s) => s.level === level && !s.shop),
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
