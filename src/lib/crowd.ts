// Group photos: where each person stands when a whole group poses together in a journey scene.

/** A group photo's rows, front to back: smaller further back, and standing higher so heads show. */
const ROWS = [
  { scale: 1, lift: 0 },
  { scale: 0.84, lift: 0.3 },
  { scale: 0.7, lift: 0.56 },
];
/** Side by side in a row, as a share of the row's character height (they overlap a little). */
const SPACING = 0.52;

/** Where someone stands: `x` is the centre of their feet, or null for the lone spot 30% across. */
export type CrowdSpot<P> = { person: P; index: number; x: number | null; bottom: number; size: number };

/**
 * Lays a group out in rows, front first: just enough rows for everyone (shared out by how many
 * each row holds), you in the middle of the front row, and the rest in order outward. A small
 * group stands left of centre, clear of the landmark; a big one spreads across.
 */
export function arrange<P extends { id: string }>(
  people: P[],
  you: string | undefined,
  width: number,
  frontSize: number,
  ground: number
): { spots: CrowdSpot<P>[]; hidden: number } {
  const margin = frontSize * 0.3;
  const capacity = ROWS.map((r) => Math.max(1, Math.floor((width - margin * 2) / (frontSize * r.scale * SPACING)) + 1));
  let rowCount = 1;
  while (rowCount < ROWS.length && capacity.slice(0, rowCount).reduce((a, b) => a + b, 0) < people.length) rowCount++;
  const room = capacity.slice(0, rowCount).reduce((a, b) => a + b, 0);
  const shown = Math.min(people.length, room);

  // Everyone in order, with you first so you land front and centre.
  const ordered = [...people].sort((a, b) => (a.id === you ? -1 : b.id === you ? 1 : 0)).slice(0, shown);
  // Each row takes its share of the group by how many it holds; any left over go to the front.
  const counts = capacity.slice(0, rowCount).map((c) => Math.floor((shown * c) / room));
  for (let i = 0, left = shown - counts.reduce((a, b) => a + b, 0); left > 0; i = (i + 1) % rowCount, left--) counts[i]!++;
  const rows: P[][] = [];
  for (let r = 0, next = 0; r < rowCount; next += counts[r]!, r++) rows.push(ordered.slice(next, next + counts[r]!));

  const centre = width * (people.length <= 4 ? 0.34 : 0.5);
  const spots: CrowdSpot<P>[] = [];
  // Back rows first, so the rows in front draw over them.
  for (let r = rowCount - 1; r >= 0; r--) {
    const members = rows[r]!;
    const size = Math.round(frontSize * ROWS[r]!.scale);
    const step = Math.min(size * SPACING, members.length > 1 ? (width - margin * 2) / (members.length - 1) : 0);
    // Centre out: the first in the row (you, in the front row) in the middle, then alternating sides.
    const offsets = members.map((_, i) => (i === 0 ? 0 : (i % 2 ? 1 : -1) * Math.ceil(i / 2)));
    const lo = Math.min(...offsets);
    const hi = Math.max(...offsets);
    // Keep the row on screen if centring it would push it off one side.
    const shift = Math.min(Math.max(centre, margin - lo * step), width - margin - hi * step) - centre;
    members.forEach((person, i) => {
      spots.push({
        person,
        index: people.indexOf(person),
        x: centre + shift + offsets[i]! * step,
        bottom: Math.round(ground + ROWS[r]!.lift * frontSize),
        size,
      });
    });
  }
  return { spots, hidden: people.length - shown };
}
