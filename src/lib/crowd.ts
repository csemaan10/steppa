// Group photos: where each person stands when a whole group poses together in a journey scene.

import type { Motion } from '@/components/character/rig';
import { GROUND_TOP, SCENE_HEIGHT, SCENE_WIDTH } from '@/lib/scene-art';

/** A group photo's rows, front to back: smaller further back, and standing higher so faces show. */
const ROWS = [
  { scale: 1, lift: 0 },
  { scale: 0.86, lift: 0.3 },
  { scale: 0.74, lift: 0.56 },
];
/** Side by side in a row, as a share of the front row's character height (they overlap a little). */
const SPACING = 0.52;
/** How far a group shrinks (as a share of full size) to stay in fewer rows before taking another. */
const MIN_SCALE = 0.66;
/**
 * Where each row stands relative to the front row, in steps: the second row in the front row's
 * gaps (bricks), the third a quarter step over, so faces fall between the heads in front.
 */
const LATTICE = [0, 0.5, 0.25];

/** Two steady numbers in [0, 1) for someone, so their nudge out of line is the same every time. */
function jitter(id: string): [number, number] {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619) >>> 0;
  return [(h & 0xffff) / 0x10000, (h >>> 16) / 0x10000];
}

/** Where someone stands: `x` is the centre of their feet, or null for the lone spot 30% across. */
export type CrowdSpot<P> = { person: P; index: number; x: number | null; bottom: number; size: number };

/**
 * Lays a group out like a group photo. It takes the fewest rows that keep everyone a decent size
 * (shrinking a little to stay in one or two), with every row centred and the same distance between
 * neighbours, each row standing in the gaps of the one in front. You get the front row's middle
 * spot; everyone is nudged slightly out of line. A small group stands left of centre, clear of the
 * landmark; a big one spreads across. Anyone who can't fit even in three rows is counted in `hidden`.
 */
export function arrange<P extends { id: string }>(
  people: P[],
  you: string | undefined,
  width: number,
  frontSize: number,
  ground: number
): { spots: CrowdSpot<P>[]; hidden: number } {
  const n = people.length;
  const margin = frontSize * 0.25;
  const usable = width - margin * 2;

  let rows = 1;
  let size = frontSize;
  for (; rows <= ROWS.length; rows++) {
    // The widest row, plus half a step for the row behind sitting in its gaps.
    const span = SPACING * (Math.ceil(n / rows) - 1 + (rows > 1 ? 0.5 : 0));
    size = span > 0 ? Math.min(frontSize, usable / span) : frontSize;
    if (size >= frontSize * MIN_SCALE || rows === ROWS.length) break;
  }
  const step = size * SPACING;
  // The tolerance stops floating-point error losing a slot when the row fits exactly.
  const perRow = Math.floor(usable / step - (rows > 1 ? 0.5 : 0) + 1e-6) + 1;
  const shown = Math.min(n, perRow * rows);
  // Front rows take one more when it doesn't divide evenly (17 in two rows: 9 then 8).
  const counts = Array.from({ length: rows }, (_, r) => Math.floor(shown / rows) + (r < shown % rows ? 1 : 0));

  // You first, so you get the front row's middle spot; everyone else in order.
  const ordered = [...people].sort((a, b) => (a.id === you ? -1 : b.id === you ? 1 : 0)).slice(0, shown);
  const centre = width * (n <= 4 ? 0.34 : 0.5);
  // A row with an odd count is centred on whole steps, an even one on half steps.
  const lattice = (count: number) => (count % 2 ? 0 : 0.5);
  const byRow: CrowdSpot<P>[][] = [];
  for (let r = 0, next = 0; r < rows; next += counts[r]!, r++) {
    const count = counts[r]!;
    // Nudge the row onto its lattice (by at most half a step, alternating sides to stay balanced).
    let shift = (((lattice(counts[0]!) + LATTICE[r]! - lattice(count)) % 1) + 1) % 1;
    if (shift > 0.5 || (shift === 0.5 && r % 2 === 1)) shift -= 1;
    const slots = Array.from({ length: count }, (_, j) => j - (count - 1) / 2 + shift);
    const middleFirst = slots.map((_, j) => j).sort((a, b) => Math.abs(slots[a]!) - Math.abs(slots[b]!) || slots[a]! - slots[b]!);
    const rowSize = Math.round(size * ROWS[r]!.scale);
    byRow.push(
      ordered.slice(next, next + count).map((person, k) => {
        const [jx, jy] = jitter(person.id);
        return {
          person,
          index: people.indexOf(person),
          // Up to 8% of a step either side, and a little up or down for those behind the front row.
          x: centre + (slots[middleFirst[k]!]! + (jx - 0.5) * 0.16) * step,
          bottom: Math.round(ground + ROWS[r]!.lift * size + (r > 0 ? (jy - 0.5) * 0.06 * rowSize : 0)),
          size: rowSize,
        };
      })
    );
  }

  // Slide the whole group back on screen if it's off one side.
  const all = byRow.flat();
  const lo = Math.min(...all.map((s) => s.x!));
  const hi = Math.max(...all.map((s) => s.x!));
  const dx = lo < margin ? margin - lo : hi > width - margin ? width - margin - hi : 0;
  // Back rows first, so the rows in front draw over them.
  const spots = byRow.reverse().flatMap((row) => row.map((s) => ({ ...s, x: s.x! + dx })));
  return { spots, hidden: n - shown };
}

/**
 * How far (in scene units) the scene's ground has to rise for the group's highest row to stand on
 * it, rather than on the water or landscape behind: 0 for a single row. The scene is scaled to
 * cover the panel with its bottom edge kept, so a spot's distance up from the bottom converts by
 * that scale.
 */
export function groundRise(spots: CrowdSpot<unknown>[], width: number, height: number): number {
  if (!spots.length || width <= 0) return 0;
  const highest = Math.max(...spots.map((s) => s.bottom));
  const scale = Math.max(width / SCENE_WIDTH, height / SCENE_HEIGHT);
  // A few units of ground above the highest feet, so they're well inside it.
  return Math.max(0, Math.round(highest / scale + 6 - (SCENE_HEIGHT - GROUND_TOP)));
}

/** What people in a group scene might be doing, besides waving. */
const GROUP_POSES: readonly Motion[] = ['wave', 'p-peace', 'p-salute', 'p-crossed', 'p-hips', 'flex', 'cheer'];

/**
 * A pose for someone in a group scene: random-looking, so the group isn't all doing the same
 * thing, but steady for that person at that stop, and reshuffled when the group moves on.
 */
export function groupPose(id: string, stop: string): Motion {
  const [pick] = jitter(`${id}:${stop}`);
  return GROUP_POSES[Math.floor(pick * GROUP_POSES.length)]!;
}
