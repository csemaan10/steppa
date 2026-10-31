// The app's own icons, drawn rather than emoji: trick poses, places, flags, medals. Pure geometry like
// the rest of the art, on a 48 × 48 grid, in the flat style of the scenes: solid shapes, rounded
// strokes, no outlines or gradients. src/components/glyph.tsx draws an icon from its parts.
// This file holds the parts' type and the shared shape helpers.

import { circle, ellipse, n, poly, rect } from '@/lib/scene-art';
import { heart, roundRect, star } from '@/lib/world/common';

export { circle, ellipse, heart, n, poly, rect, roundRect, star };

/** One shape of a one-colour icon. */
export type IconPart = {
  d: string;
  /** Drawn as a line this wide rather than filled, with round ends and joins. */
  stroke?: number;
  /** Lighter (45%): motion lines, the ground, a shadow side. */
  faint?: boolean;
  /** Filled even-odd, so shapes inside it (eyes, windows) are cut out. */
  holes?: boolean;
};

/** One shape of a coloured icon (flags, medals): an icon part with its own colour. */
export type ColorPart = IconPart & { color: string };

export const line = (x1: number, y1: number, x2: number, y2: number) => `M${n(x1)} ${n(y1)}L${n(x2)} ${n(y2)}`;

/** A point on a circle, `deg` clockwise from three o'clock (the screen's y runs down). */
export const at = (cx: number, cy: number, r: number, deg: number): [number, number] => {
  const a = (deg * Math.PI) / 180;
  return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
};

/** Part of a circle, from `from` to `to` degrees, clockwise if `to` is bigger. */
export function arc(cx: number, cy: number, r: number, from: number, to: number): string {
  const [x0, y0] = at(cx, cy, r, from);
  const [x1, y1] = at(cx, cy, r, to);
  const large = Math.abs(to - from) > 180 ? 1 : 0;
  const sweep = to > from ? 1 : 0;
  return `M${n(x0)} ${n(y0)}A${n(r)} ${n(r)} 0 ${large} ${sweep} ${n(x1)} ${n(y1)}`;
}

/** An arrowhead at the end of an arc, pointing the way it was going. */
export function arrowhead(cx: number, cy: number, r: number, from: number, to: number, size = 5.5): string {
  const [x, y] = at(cx, cy, r, to);
  // The way along the circle, toward where it was heading.
  const heading = ((to + (to > from ? 90 : -90)) * Math.PI) / 180;
  const [dx, dy] = [Math.cos(heading), Math.sin(heading)];
  const [nx, ny] = [-dy, dx];
  return poly(
    x + dx * size * 0.9,
    y + dy * size * 0.9,
    x - dx * size * 0.4 + nx * size * 0.75,
    y - dy * size * 0.4 + ny * size * 0.75,
    x - dx * size * 0.4 - nx * size * 0.75,
    y - dy * size * 0.4 - ny * size * 0.75
  );
}

/** A cross `size` across with arms `thick` wide, turned 45° (an X). */
export function cross(cx: number, cy: number, size: number, thick: number): string {
  const s = size / 2;
  const t = thick / 2;
  const pts = [
    [-s, -s + t], [-s + t, -s], [0, -t], [s - t, -s], [s, -s + t], [t, 0],
    [s, s - t], [s - t, s], [0, t], [-s + t, s], [-s, s - t], [-t, 0],
  ];
  return poly(...pts.flatMap(([x, y]) => [cx + x!, cy + y!]));
}
