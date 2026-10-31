// An icon for each trick: a little pet in silhouette, mid-trick, on a 48 × 48 grid. Pure geometry
// like the rest of the art; src/components/trick-icon.tsx draws it in one colour (the trick colour,
// or faint while it's locked). Fills are the pet; strokes are legs, tails and arrows, with round
// ends; `faint` parts (motion lines, the ground) are drawn lighter.

import { arc, arrowhead, circle, cross, ellipse, line, poly, type IconPart } from '@/lib/icon-art';
import type { TrickId } from '@/lib/world/tricks';

export type { IconPart };

const LEG = 3.4;

/** Two pointed ears on a head of radius `r` at (cx, cy), turned `deg` (180 for upside down). */
function ears(cx: number, cy: number, r: number, deg = 0): string {
  const a = (deg * Math.PI) / 180;
  const turn = ([x, y]: readonly [number, number]) => [
    cx + (x * Math.cos(a) - y * Math.sin(a)) * r,
    cy + (x * Math.sin(a) + y * Math.cos(a)) * r,
  ];
  const left = ([[-0.9, -0.3], [-0.6, -1.4], [-0.05, -0.85]] as const).flatMap(turn);
  const right = ([[0.05, -0.85], [0.6, -1.4], [0.9, -0.3]] as const).flatMap(turn);
  return poly(...left) + poly(...right);
}

/** A paw at the end of a leg. */
const paw = (x: number, y: number) => circle(x, y, 2.3);
/** Two eyes, `apart` either side of (cx, cy), to cut out of a face. */
const eyes = (cx: number, cy: number, apart: number, r: number) => circle(cx - apart, cy, r) + circle(cx + apart, cy, r);

export const TRICK_ICONS: Record<TrickId, IconPart[]> = {
  // Sitting up nicely, tail curled round.
  sit: [
    { d: 'M13 41C12 31 17 24 25 22.5C28.5 22 31.5 24 32 27.5L33.5 41Z' },
    { d: ellipse(33.5, 40.2, 4.2, 2.4) },
    { d: circle(30, 15.5, 7.2) },
    { d: ears(30, 15.5, 7.2) },
    { d: 'M14 40C7 41 5 34 9.5 30.5', stroke: 3.2 },
  ],
  // Its face, with a circle of arrow going all the way round it.
  spin: [
    { d: circle(24, 27, 9) + eyes(24, 26.4, 3.4, 1.7), holes: true },
    { d: ears(24, 27, 9) },
    { d: arc(24, 27, 19, -150, 145), stroke: 3.2 },
    { d: arrowhead(24, 27, 19, -150, 145) },
  ],
  // On its back mid-roll, paws up and eyes open, with an arrow over the top.
  rollover: [
    { d: ellipse(27, 34, 12, 6.5) },
    { d: circle(11.5, 33, 6.5) + eyes(11.5, 33.5, 2.6, 1.3), holes: true },
    { d: ears(11.5, 33, 6.5, 270) },
    { d: line(20, 29.5, 17.5, 23) + line(24.5, 28.5, 23.5, 22) + line(30.5, 28.5, 31.5, 22) + line(35, 29.5, 37.5, 23), stroke: LEG },
    { d: 'M39 34.5C43 35 45 32 44 28.5', stroke: 3 },
    { d: arc(25, 33, 21, -165, -25), stroke: 3 },
    { d: arrowhead(25, 33, 21, -165, -25, 5) },
  ],
  // Flat on its back, legs stiff in the air, a cross for an eye.
  playdead: [
    { d: line(3, 42.5, 45, 42.5), stroke: 2.2, faint: true },
    { d: ellipse(27, 34.5, 13, 6.2) },
    { d: circle(11, 34, 6.5) + cross(10.4, 34.6, 4.2, 1.4), holes: true },
    { d: ears(11, 34, 6.5, 260) },
    { d: line(18.5, 30, 17, 18) + line(23, 29.5, 22.5, 17.5) + line(31.5, 29.5, 32, 17.5) + line(36, 30, 37.5, 18), stroke: LEG },
    { d: paw(17, 18) + paw(22.5, 17.5) + paw(32, 17.5) + paw(37.5, 18) },
    { d: 'M39.5 35C43 35 45 37 45.5 39.5', stroke: 3 },
  ],
  // Up on its back legs, paws in the air, to a tune.
  dance: [
    { d: circle(20, 13, 6.5) },
    { d: ears(20, 13, 6.5) },
    { d: ellipse(20, 28.5, 7, 9.5) },
    { d: line(14.5, 23, 8.5, 15) + line(25.5, 23, 31, 15.5), stroke: LEG },
    { d: line(17, 36, 15, 44) + line(23, 36, 28, 42), stroke: LEG },
    { d: ellipse(37, 29, 3.3, 2.5) + 'M38.6 29.2V17.5H40.6V29.2Z' + 'M40.6 17.5C43.5 18.5 45.5 20.5 44.5 24.5C43.6 22.5 42.2 21.5 40.6 21.4Z' },
    { d: ellipse(41, 10, 2.4, 1.8) + 'M42.2 10.2V2.5H43.8V10.2Z', faint: true },
  ],
  // Standing ready, with the way it flips: up, over its head and back down behind.
  backflip: [
    { d: arc(24, 25, 17, 40, -220), stroke: 3.2 },
    { d: arrowhead(24, 25, 17, 40, -220) },
    { d: ellipse(22.5, 34, 8.5, 4.6) },
    { d: circle(31, 29, 4.8) },
    { d: ears(31, 29, 4.8, 10) },
    { d: line(17, 37, 16, 43.5) + line(20.5, 37.5, 20.5, 44) + line(25, 37.5, 25.5, 44) + line(28.5, 37, 29.5, 43.5), stroke: 2.8 },
    { d: 'M14.5 33C11 32 10 28.5 11.5 26.5', stroke: 2.6 },
  ],
  // Flat out at full tilt, legs stretched, speed lines behind.
  zoomies: [
    { d: line(1, 22, 6, 22) + line(1, 27, 6.5, 27) + line(1, 32, 6, 32), stroke: 2.2, faint: true },
    { d: 'M14.5 23C10.5 19 9 21.5 6.5 17', stroke: 3 },
    { d: ellipse(24, 25.5, 11, 5.8) },
    { d: circle(36.5, 20, 6) },
    { d: ears(36.5, 20, 6, 15) },
    { d: line(31, 28.5, 40.5, 32) + line(28.5, 29.5, 33.5, 37) + line(17, 28.5, 9, 33) + line(19.5, 29.5, 14, 37.5), stroke: LEG },
  ],
  // Up on its front paws, face at the bottom, back legs and tail in the air.
  handstand: [
    { d: line(5, 45, 43, 45), stroke: 2.2, faint: true },
    { d: line(18.5, 29, 16.5, 44) + line(29.5, 29, 31.5, 44), stroke: LEG },
    { d: circle(24, 36.5, 6.2) + eyes(24, 37.5, 2.5, 1.35), holes: true },
    { d: ears(24, 36.5, 6.2, 180) },
    { d: ellipse(24, 21.5, 7, 9.5) },
    { d: 'M21 13.5C19.5 9 18.5 6 19.5 2.5' + 'M27 13.5C28.5 9 29.5 6 28.5 2.5', stroke: LEG },
    { d: 'M28 17C33 16 36 12 34 8', stroke: 2.8 },
  ],
};
