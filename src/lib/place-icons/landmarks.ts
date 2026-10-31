// Icons for the landmarks on the journey routes (castles, bridges, shells, volcanoes…), keyed by emoji.

import { arc, arrowhead, circle, ellipse, line, n, poly, rect, roundRect, type IconPart } from '@/lib/icon-art';

type Pt = readonly [number, number];
type Curve = readonly [Pt, Pt, Pt, Pt];

/** A round-topped opening, `w` wide and `h` tall from its top, to cut out as a door or window. */
function arch(x: number, y: number, w: number, h: number): string {
  const r = w / 2;
  return `M${n(x)} ${n(y + h)}V${n(y + r)}a${n(r)} ${n(r)} 0 0 1 ${n(w)} 0V${n(y + h)}Z`;
}

/** A pointed leaf from (x, y), `len` long and `wide` across, pointing `deg` clockwise from three o'clock. */
function leaf(x: number, y: number, len: number, wide: number, deg: number): string {
  const a = (deg * Math.PI) / 180;
  const [dx, dy] = [Math.cos(a), Math.sin(a)];
  const w = wide * 0.67;
  const p = (t: number, side: number) => `${n(x + dx * len * t - dy * side)} ${n(y + dy * len * t + dx * side)}`;
  return `M${p(0, 0)}C${p(0.15, w)} ${p(0.6, w)} ${p(1, 0)}C${p(0.6, -w)} ${p(0.15, -w)} ${p(0, 0)}Z`;
}

/** The point `t` of the way along a curve, and the unit normal on its right-hand side. */
function along([a, b, c, d]: Curve, t: number) {
  const u = 1 - t;
  const pick = (i: 0 | 1) => u * u * u * a[i] + 3 * u * u * t * b[i] + 3 * u * t * t * c[i] + t * t * t * d[i];
  const slope = (i: 0 | 1) => 3 * u * u * (b[i] - a[i]) + 6 * u * t * (c[i] - b[i]) + 3 * t * t * (d[i] - c[i]);
  const [dx, dy] = [slope(0), slope(1)];
  const len = Math.hypot(dx, dy) || 1;
  return { x: pick(0), y: pick(1), nx: -dy / len, ny: dx / len };
}

/** A sprig: a stem along `stem` with a pair of leaves at each [t, length, width], and one at the tip. */
function sprig(stem: Curve, pairs: [number, number, number][]): IconPart[] {
  const leaves = pairs.map(([t, len, wide]) => {
    const { x, y, nx, ny } = along(stem, t);
    const deg = (Math.atan2(-nx, ny) * 180) / Math.PI;
    return leaf(x, y, len, wide, deg - 50) + leaf(x, y, len, wide, deg + 50);
  });
  const [p0, p1, p2, p3] = stem;
  const tip = (Math.atan2(p3[1] - p2[1], p3[0] - p2[0]) * 180) / Math.PI;
  return [
    { d: `M${p0.join(' ')}C${p1.join(' ')} ${p2.join(' ')} ${p3.join(' ')}`, stroke: 2.8 },
    { d: leaves.join('') + leaf(p3[0], p3[1], 10, 5.5, tip) },
  ];
}

/** A scallop shell's ribs: wedges fanning up from the hinge, each ending in a rounded lobe. */
function scallopRibs(hx: number, hy: number, ribs: number, gap: number): string {
  // The rib ends sit on this circle.
  const [cx, cy, r] = [24, 21.5, 19.5];
  const hit = (deg: number): Pt => {
    const a = (deg * Math.PI) / 180;
    const [ux, uy] = [Math.cos(a), Math.sin(a)];
    const b = ux * (hx - cx) + uy * (hy - cy);
    const c = (hx - cx) ** 2 + (hy - cy) ** 2 - r * r;
    const t = -b + Math.sqrt(b * b - c);
    return [hx + ux * t, hy + uy * t];
  };
  const [from, to] = [-163, -17];
  const step = (to - from) / ribs;
  let d = '';
  for (let i = 0; i < ribs; i++) {
    const a0 = from + i * step + gap / 2;
    const a1 = from + (i + 1) * step - gap / 2;
    const [x0, y0] = hit(a0);
    const [x1, y1] = hit(a1);
    const [xm, ym] = hit((a0 + a1) / 2);
    const bulge = 2.6 / Math.hypot(xm - hx, ym - hy);
    const [qx, qy] = [xm + (xm - hx) * bulge, ym + (ym - hy) * bulge];
    d += `M${n(hx)} ${n(hy)}L${n(x0)} ${n(y0)}Q${n(qx)} ${n(qy)} ${n(x1)} ${n(y1)}Z`;
  }
  return d;
}

/** A line that waves side to side as it rises from (x, y0), `waves` half-waves `h` tall each. */
function wavy(x: number, y0: number, h: number, waves: number, amp: number): string {
  let d = `M${n(x)} ${n(y0)}C${n(x + amp)} ${n(y0 - h / 3)} ${n(x + amp)} ${n(y0 - (2 * h) / 3)} ${n(x)} ${n(y0 - h)}`;
  for (let i = 1; i < waves; i++) {
    const side = i % 2 ? -amp : amp;
    d += `S${n(x + side)} ${n(y0 - h * i - (2 * h) / 3)} ${n(x)} ${n(y0 - h * (i + 1))}`;
  }
  return d;
}

/** A beach umbrella leaning `deg`, its pole planted at (x, y): a dome with a scalloped hem, and the pole. */
function umbrella(x: number, y: number, deg: number) {
  const a = (deg * Math.PI) / 180;
  const p = (px: number, py: number) => `${n(x + px * Math.cos(a) - py * Math.sin(a))} ${n(y + px * Math.sin(a) + py * Math.cos(a))}`;
  // Drawn upright with the pole's foot at the origin: the dome's crown 36 up, its hem 12 lower.
  let hem = '';
  for (let i = 0; i < 4; i++) {
    const x0 = 17 - 8.5 * i;
    hem += `Q${p(x0 - 4.25, -21)} ${p(x0 - 8.5, -24)}`;
  }
  return {
    canopy: `M${p(-17, -24)}A18 18 0 0 1 ${p(17, -24)}${hem}Z`,
    pole: `M${p(0, -36)}L${p(0, 0)}`,
  };
}

const beach = umbrella(27, 41, -16);

/** A row of bricks `h` tall at `y`, each [from, to] across. */
const bricks = (y: number, h: number, spans: [number, number][]) =>
  spans.map(([a, b]) => roundRect(a, y, b - a, h, 0.8)).join('');

/** Little square windows, `size` across, at each [x, y] (their top-left corners). */
const windows = (size: number, at: [number, number][]) => at.map(([x, y]) => rect(x, y, size, size * 1.4)).join('');

/** A little house: walls from `x`, `w` wide, up to `wall`, with a roof peaking at `peak`; standing on y 43. */
const house = (x: number, w: number, wall: number, peak: number) =>
  poly(x, 43, x, wall, x + w / 2, peak, x + w, wall, x + w, 43);

/** Half the maple leaf off Canada's flag, from its top point down the right side to the stem. */
const MAPLE_RIGHT = [
  [24, 2.5], [26.8, 9], [31, 6.8], [29.3, 17.5], [33.8, 13.8], [35, 16.8], [42.8, 12.6], [40, 20.5], [44.8, 22.6],
  [35.4, 30.2], [37, 34.6], [26, 32.3], [25, 33], [25.6, 44],
] as const;

export const LANDMARK_ICONS: Record<string, IconPart[]> = {
  // A castle: two crenellated towers, a lower crenellated wall between them with an arched gate.
  '🏰': [
    {
      d:
        'M4 43V7H8V11H12V7H16V21H18.5V17H22.5V21H25.5V17H29.5V21H32V7H36V11H40V7H44V43H28.5V34.5A4.5 4.5 0 0 0 19.5 34.5V43Z' +
        arch(8.2, 16, 3.6, 7) +
        arch(36.2, 16, 3.6, 7),
      holes: true,
    },
  ],
  // A wave curling over as it breaks.
  '🌊': [
    {
      d: 'M3 42H45V37C39 35 35 28 34 20C33 12 28 6 21 6C12 6 5 13 5 21C5 26 8 30 12 30.5C9.5 27 9.5 21.5 14 19.5C18.5 17.5 23 20 23 25C23 31 17 36 3 42Z',
    },
  ],
  // A classical temple: pediment, beam, four columns, two steps.
  '🏛️': [
    { d: poly(3, 12.5, 24, 2.5, 45, 12.5) },
    { d: rect(5, 14.5, 38, 4) },
    { d: rect(7.5, 20.5, 5, 14) + rect(16.8, 20.5, 5, 14) + rect(26.2, 20.5, 5, 14) + rect(35.5, 20.5, 5, 14) },
    { d: rect(5, 36.5, 38, 3) + rect(3, 41.5, 42, 3) },
  ],
  // A suspension bridge: two towers, the cables slung between them, the deck, the water.
  '🌉': [
    { d: line(3, 43.5, 45, 43.5), stroke: 2.2, faint: true },
    { d: line(19.1, 18.5, 19.1, 27) + line(24, 21.5, 24, 27) + line(28.9, 18.5, 28.9, 27), stroke: 2, faint: true },
    { d: rect(12, 7, 4.5, 33) + rect(31.5, 7, 4.5, 33) },
    { d: rect(2, 27, 44, 4) },
    { d: 'M3 26Q10 22 14.25 8Q24 34 33.75 8Q38 22 45 26', stroke: 2.6 },
  ],
  // A stretch of wall: battlements along the top, courses of bricks below.
  '🧱': [
    { d: 'M4 18V5H10.5V12H15.2V5H21.7V12H26.3V5H32.8V12H37.5V5H44V18Z' },
    {
      d:
        bricks(20, 6.3, [[4, 16], [18.2, 29.8], [32, 44]]) +
        bricks(28.3, 6.3, [[4, 8.7], [10.9, 22.9], [25.1, 37.1], [39.3, 44]]) +
        bricks(36.7, 6.3, [[4, 16], [18.2, 29.8], [32, 44]]),
    },
  ],
  // A leafy sprig: a curving stem with leaves in pairs and one at the tip.
  '🌿': sprig(
    [[13, 44], [12, 30], [19, 16], [30, 9]],
    [[0.3, 13, 6.5], [0.52, 12, 6], [0.74, 10, 5.5]]
  ),
  // A city skyline: towers of different heights with windows, and a needle tower.
  '🏙️': [
    { d: rect(3, 22, 8, 22) + windows(1.8, [[5.2, 25.5], [7.8, 25.5], [5.2, 31], [7.8, 31], [5.2, 36.5], [7.8, 36.5]]), holes: true },
    {
      d:
        rect(13, 10, 9, 34) +
        windows(1.8, [[15.3, 14], [18.6, 14], [15.3, 19.5], [18.6, 19.5], [15.3, 25], [18.6, 25], [15.3, 30.5], [18.6, 30.5], [15.3, 36], [18.6, 36]]),
      holes: true,
    },
    { d: line(17.5, 9, 17.5, 4) + line(27, 8, 27, 2.5), stroke: 2 },
    { d: rect(25.5, 8, 3, 36) },
    { d: ellipse(27, 17, 4, 2.6) },
    { d: rect(31, 19, 8, 25) + windows(1.8, [[33.2, 23], [35.8, 23], [33.2, 28.5], [35.8, 28.5], [33.2, 34], [35.8, 34]]), holes: true },
    { d: rect(40.5, 28, 4.5, 16) },
  ],
  // Two mountain peaks, the near one with a jagged band across its top.
  '⛰️': [
    { d: poly(29.7, 24.9, 34, 14, 45, 42, 37.5, 42) },
    { d: poly(19, 7, 25.2, 18, 22.5, 21, 20, 18.5, 17.5, 21, 14.8, 18) },
    { d: poly(13.6, 20.5, 17.5, 23.5, 20, 21, 22.5, 23.5, 26.4, 20.5, 35, 42, 3, 42) },
  ],
  // A scallop shell, the pilgrims' badge: ribs fanning up from the hinge, with its two little ears.
  '🐚': [
    { d: scallopRibs(24, 39, 7, 6) },
    { d: poly(15.5, 36, 32.5, 36, 28.5, 43.5, 19.5, 43.5) },
  ],
  // A horse at full gallop, mane and tail streaming.
  '🐎': [
    { d: 'M12 20.5C8 17 4.5 16 2.5 18C5 19 6.5 21 7.5 24C8.5 22.5 10 22 12 22.5Z' },
    { d: 'M11 22C11 19 14 17.5 19 17.5L29 17.5C33 17.5 35.5 19.5 35.5 23C35.5 27 33 29.5 29 29.5L17 29.5C13 29.5 11 26.5 11 22Z' },
    { d: 'M27 19C30 14 33 10 36.5 7L37.3 2.8L39.6 6.2L45.2 13C46 14.3 45.2 16.6 43.6 16.4L39.8 14C37.5 16 36 20 35.5 24Z' },
    { d: 'M36.5 6.5L30 8.5L32.5 10.5L27 13L29.5 14.3L24.5 17.5L28 19Z' },
    { d: 'M33 26L39 28L43.5 25M31 28.5L37 33L42 34M14 26.5L8 30L3 29M16 28.5L11 34L5.5 36', stroke: 3.2 },
  ],
  // A volcano, smoke puffing up out of its crater.
  '🌋': [
    { d: 'M3 44L16.5 21L20 24.5Q24 26 28 24.5L31.5 21L45 44Z' },
    { d: circle(24, 17.5, 2.6) + circle(21.5, 12, 3.7) + circle(27.5, 8, 5.2) + circle(19.5, 6.5, 3.9) + circle(35, 9.5, 3.6) },
  ],
  // An anchor: ring, stock, shank and the two curved arms with their flukes.
  '⚓': [
    { d: circle(24, 7.5, 3.6), stroke: 3 },
    { d: line(24, 11, 24, 41) + line(15, 17.5, 33, 17.5), stroke: 3.6 },
    { d: arc(24, 24, 17, 30, 150), stroke: 3.6 },
    { d: arrowhead(24, 24, 17, 90, 30, 6.5) + arrowhead(24, 24, 17, 90, 150, 6.5) },
  ],
  // A hot-air balloon: the envelope in three panels, the ropes, the basket.
  '🎈': [
    {
      d:
        'M19 33C12 28 10 24 10 17A14 14 0 0 1 38 17C38 24 36 28 29 33Z' +
        'M21.5 6Q12 18 21.5 31Q16 18 21.5 6Z' +
        'M26.5 6Q36 18 26.5 31Q32 18 26.5 6Z',
      holes: true,
    },
    { d: line(19.5, 34, 20.5, 38.5) + line(28.5, 34, 27.5, 38.5), stroke: 2 },
    { d: roundRect(19, 38, 10, 6.5, 1.5) },
  ],
  // A dragon's head: swept-back horns, open jaws, spines down its neck.
  '🐉': [
    {
      d:
        'M9 44C9 34 12 24 17 17C20 12 24 9.5 29 10.5L35 12.5L42 13.5C44.5 14 45 17.5 42.5 18L30 21L41 27C42.5 28 41.5 30.5 39.5 30L30 28.5C25 28 23 33 23 44Z' +
        circle(27.5, 15, 1.7),
      holes: true,
    },
    { d: 'M21 12C15 8 10 6 4.5 6.5C9 8 13 11 17.5 16Z' },
    { d: 'M24 10.5C20 5.5 15 3 9.5 2.5C14 4.5 17.5 8 20 12Z' },
    { d: poly(9.6, 39, 4, 37.5, 9.8, 34) + poly(10.4, 32, 4.5, 29.5, 11.2, 27.5) + poly(12, 25.5, 6.5, 22, 13.5, 21) },
  ],
  // A Chinese gate tower: two tiers of upswept roofs over a fortress wall with a gate.
  '🏯': [
    { d: 'M8 11Q12 13.5 17 13.5H31Q36 13.5 40 11Q34.5 10 30.5 5H17.5Q13.5 10 8 11Z' },
    { d: line(24, 5, 24, 2.5), stroke: 2.4 },
    { d: rect(16, 13, 16, 4) },
    { d: 'M2.5 20Q7.5 24 14 24H34Q40.5 24 45.5 20Q38 19 33 15.5H15Q10 19 2.5 20Z' },
    { d: rect(10, 23.5, 28, 7.5) + rect(14, 25.5, 3, 4) + rect(22.5, 25.5, 3, 4) + rect(31, 25.5, 3, 4), holes: true },
    { d: 'M5 44V33H43V44H29V39A5 5 0 0 0 19 39V44Z' },
  ],
  // A rainbow: three bands arching between two clouds.
  '🌈': [
    { d: arc(24, 33, 19, 180, 360) + arc(24, 33, 13.5, 180, 360) + arc(24, 33, 8, 180, 360), stroke: 3.6 },
    { d: circle(6.5, 36, 4) + circle(12, 33.5, 5.5) + circle(17, 37, 3.8) + circle(41.5, 36, 4) + circle(36, 33.5, 5.5) + circle(31, 37, 3.8) },
    { d: roundRect(3, 36, 17.5, 5, 2.5) + roundRect(27.5, 36, 17.5, 5, 2.5) },
  ],
  // Hot springs: three wisps of steam rising out of a bath.
  '♨️': [
    { d: 'M8 28.2A17 11 0 1 0 40 28.2', stroke: 3.4 },
    { d: wavy(15.5, 33, 7.5, 3, 4) + wavy(24, 34, 9.5, 3, 4) + wavy(32.5, 33, 7.5, 3, 4), stroke: 3 },
  ],
  // A beach umbrella stuck in the sand.
  '🏖️': [
    { d: 'M2 45C8 37 40 37 46 45Z' },
    { d: beach.pole, stroke: 2.8 },
    { d: beach.canopy },
  ],
  // A bunch of grapes on its stalk, with a leaf.
  '🍇': [
    {
      d: [
        [9.6, 15.5], [19.2, 15.5], [28.8, 15.5], [38.4, 15.5],
        [14.4, 23.8], [24, 23.8], [33.6, 23.8],
        [19.2, 32.1], [28.8, 32.1],
        [24, 40.4],
      ]
        .map(([x, y]) => circle(x!, y!, 3.9))
        .join(''),
    },
    { d: 'M24 11.5Q24 7 21 4', stroke: 2.6 },
    { d: leaf(24.5, 8, 13, 7, -15) },
  ],
  // A waterfall: the river pouring over the edge of a cliff into a splash.
  '💦': [
    { d: poly(3, 19, 16, 19, 17.5, 26, 16, 33, 18, 44, 3, 44) },
    { d: 'M4 15H15C19.5 15 21.5 17.5 21.5 22V35M4 10H15C24 10 26.5 14 26.5 21V35M4 5H15C28.5 5 31.5 11 31.5 20V35', stroke: 2.8 },
    { d: circle(21.5, 38.5, 3) + circle(26.5, 37.5, 3.4) + circle(31.5, 38.5, 3) },
    { d: line(21, 43.5, 44, 43.5), stroke: 2.2, faint: true },
  ],
  // Three little houses side by side, the middle one taller, with windows and a door.
  '🏘️': [
    { d: house(3, 12, 28, 20) + rect(7, 32, 4, 4), holes: true },
    { d: rect(26.5, 9.5, 3, 7) },
    { d: 'M17.5 43V20L24 9L30.5 20V43H26V35H22V43Z' + rect(22, 24, 4, 4), holes: true },
    { d: house(33, 12, 26, 18) + rect(37, 30, 4, 4), holes: true },
  ],
  // The maple leaf off Canada's flag.
  '🍁': [{ d: poly(...MAPLE_RIGHT.flat(), ...[...MAPLE_RIGHT].reverse().flatMap(([x, y]) => [48 - x, y])) }],
  // A backpack: carry loop, flap seam, front pocket and side pockets.
  '🎒': [
    { d: 'M19 10.5V8.5A5 5 0 0 1 29 8.5V10.5', stroke: 3 },
    { d: roundRect(5.5, 25, 5.5, 15, 2.2) + roundRect(37, 25, 5.5, 15, 2.2) },
    {
      d: roundRect(9, 10, 30, 34, 9) + roundRect(13.5, 17.5, 21, 2.2, 1.1) + roundRect(14, 26, 20, 13.5, 3.5) + roundRect(16.5, 28.5, 15, 8.5, 2),
      holes: true,
    },
  ],
  // A bull charging: head down, horns forward, hump up, tail flying.
  '🐂': [
    { d: 'M41.5 16C45.5 14.5 46 10 43.5 6.5', stroke: 2.4 },
    { d: ellipse(43.3, 6, 1.8, 2.4) },
    { d: 'M17 28L12 35L10.5 41.5M21.5 29.5L20.5 36L17.5 42M38 27.5L41 34.5L44.5 38.5M34 29.5L33.5 36L36 42', stroke: 3.4 },
    { d: 'M14 17C16 11 21 8 27 9.5C33 11 38 12.5 41 15C44 17.5 44 23 42.5 27C41.5 29.5 39 31 36 31L22 31C18 31 15.5 30 14 28.5Z' },
    { d: 'M16.5 15L9 17.5C7.5 18 6.5 19 6 20.5L3 28C2.5 29.8 3.5 31.5 5.5 31.5L8.5 31.5C11 31.5 13.5 30 15.5 28Z' },
    { d: 'M15.5 16.5C11.5 15.5 10 12 11.5 8C12.5 11 14 13 17 13.5Z' },
    { d: 'M12.5 18.5C7 19 3.5 15 4.5 9.5C6 13.5 8.5 15.5 13 15.5Z' },
  ],
  // A glass of red wine.
  '🍷': [
    { d: 'M13.5 5C13 18 17 25.5 24 25.5C31 25.5 35 18 34.5 5', stroke: 2.8 },
    { d: 'M14.5 14H33.5C33 21 29.5 25.5 24 25.5C18.5 25.5 15 21 14.5 14Z' },
    { d: line(24, 25.5, 24, 40), stroke: 3 },
    { d: ellipse(24, 41.5, 9, 2.6) },
  ],
  // A church: a tower with a spire and cross, and the nave with its door and round window.
  '⛪': [
    { d: line(12.5, 8, 12.5, 1.5) + line(9.5, 4, 15.5, 4), stroke: 2.6 },
    { d: poly(5, 20, 12.5, 7, 20, 20) },
    { d: rect(6, 19, 13, 25) + arch(10.5, 24, 4, 6.5), holes: true },
    { d: 'M18.5 44V27L31.5 17L44 27V44H35V38A3.5 3.5 0 0 0 28 38V44Z' + circle(31.5, 27, 2.6), holes: true },
  ],
};
