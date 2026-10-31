// Icons for the journey places known for something local (a food, an animal, a craft, a landscape).

import { arc, at, circle, ellipse, line, n, poly, rect, roundRect, type IconPart } from '@/lib/icon-art';

/** A path drawn round (0, 0) in absolute M/L/C/Q points (no arcs), scaled by `k`, turned `deg` and moved to (x, y). */
function place(d: string, x: number, y: number, deg = 0, k = 1): string {
  const a = (deg * Math.PI) / 180;
  const [c, s] = [Math.cos(a) * k, Math.sin(a) * k];
  return d.replace(/(-?[\d.]+) (-?[\d.]+)/g, (_, px: string, py: string) => {
    const [u, v] = [Number(px), Number(py)];
    return `${n(x + u * c - v * s)} ${n(y + u * s + v * c)}`;
  });
}

/** A leaf, pointed at both ends, from (x0, y0) to (x1, y1) and `w` across at its widest. */
function leaf(x0: number, y0: number, x1: number, y1: number, w: number): string {
  const [dx, dy] = [x1 - x0, y1 - y0];
  const len = Math.hypot(dx, dy);
  // A cubic bulges 3/4 of the way to its handles, so handles at 2w/3 make it w/2 each side.
  const [nx, ny] = [((-dy / len) * 2 * w) / 3, ((dx / len) * 2 * w) / 3];
  const p = (t: number, side: number) => `${n(x0 + dx * t + nx * side)} ${n(y0 + dy * t + ny * side)}`;
  return `M${n(x0)} ${n(y0)}C${p(0.25, 1)} ${p(0.75, 1)} ${n(x1)} ${n(y1)}C${p(0.75, -1)} ${p(0.25, -1)} ${n(x0)} ${n(y0)}Z`;
}

/** A bar `w` thick from (x0, y0) to (x1, y1) with square ends: a slit to cut out of a shape. */
function bar(x0: number, y0: number, x1: number, y1: number, w: number): string {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const [nx, ny] = [(-(y1 - y0) / len) * (w / 2), ((x1 - x0) / len) * (w / 2)];
  return poly(x0 + nx, y0 + ny, x1 + nx, y1 + ny, x1 - nx, y1 - ny, x0 - nx, y0 - ny);
}

/** A book lying flat with its spine to us, turned `deg` about its middle, and two bands cut across the spine. */
function book(x: number, y: number, w: number, h: number, deg = 0): string {
  const [hw, hh] = [w / 2, h / 2];
  const box = (x0: number, y0: number, x1: number, y1: number) =>
    place(`M${x0} ${y0}L${x1} ${y0}L${x1} ${y1}L${x0} ${y1}Z`, x + hw, y + hh, deg);
  return box(-hw, -hh, hw, hh) + box(-hw + 3.5, -hh + 1.8, -hw + 5.7, hh - 1.8) + box(hw - 5.7, -hh + 1.8, hw - 3.5, hh - 1.8);
}

/** An ear of wheat heading `deg` (-90 is straight up) from (x, y): grains in pairs up the stalk, one at the tip. */
function ear(x: number, y: number, deg: number, pairs = 3): string {
  let d = '';
  for (let i = 0; i < pairs; i++) {
    const [px, py] = at(x, y, i * 4.3, deg);
    d += leaf(px, py, ...at(px, py, 6.5, deg - 32), 3.6) + leaf(px, py, ...at(px, py, 6.5, deg + 32), 3.6);
  }
  const [tx, ty] = at(x, y, (pairs - 1) * 4.3 + 1.5, deg);
  return d + leaf(tx, ty, ...at(tx, ty, 6.5, deg), 3.6);
}

const EIGHT = [0, 45, 90, 135, 180, 225, 270, 315];

/** A sun at (x, y) with eight short rays. */
const sun = (x: number, y: number): IconPart[] => [
  { d: circle(x, y, 4.6) },
  { d: EIGHT.map((deg) => line(...at(x, y, 7, deg), ...at(x, y, 9, deg))).join(''), stroke: 2.4 },
];

/** A lumpy stone about 9 × 6, for place(). */
const STONE = 'M-4.5 1C-4.8 -1.5 -2.5 -3 0.5 -3C3 -3 4.6 -1.8 4.5 0.5C4.4 2.5 2.5 3 0 3C-2.5 3 -4.3 2.6 -4.5 1Z';

// The stones of the Cruz de Ferro mound: x, y, turn and size of each.
const STONES: [number, number, number, number][] = [
  [9, 40.8, 8, 1.05], [19.3, 41, -4, 1.1], [29.6, 40.8, 5, 1.05], [39.3, 41.2, -8, 0.9],
  [14, 34.3, -6, 1], [23.8, 34, 3, 1.05], [33.6, 34.5, -3, 0.95],
  [18.7, 27.8, 6, 0.9], [28.8, 28, -7, 0.88],
];

/** A fork pointing up, its neck at (0, 0), for place(). */
const FORK =
  'M-4.6 -11L-2.6 -11L-2.6 -5L-1 -5L-1 -11L1 -11L1 -5L2.6 -5L2.6 -11L4.6 -11L4.6 -4' +
  'C4.6 -1.5 2.5 0 1.4 0.6L-1.4 0.6C-2.5 0 -4.6 -1.5 -4.6 -4Z';

/** A lemon lying along the x axis, for place(). */
const LEMON =
  'M-20.5 0C-19.5 -1.4 -18 -2.6 -15.5 -3.2C-14 -8.8 -7 -11.5 0 -11.5C7 -11.5 14 -8.8 15.5 -3.2C18 -2.6 19.5 -1.4 20.5 0' +
  'C19.5 1.4 18 2.6 15.5 3.2C14 8.8 7 11.5 0 11.5C-7 11.5 -14 8.8 -15.5 3.2C-18 2.6 -19.5 1.4 -20.5 0Z';

// The right half of a maple leaf pointing up, from its tip round to the stem; the left half mirrors it.
const MAPLE: [number, number][] = [
  [0, -21], [3, -14.5], [6.5, -16], [5, -6], [10, -10.5], [11.5, -7.5], [18, -9],
  [15.5, -2.5], [19, -1], [10.5, 6], [11.5, 9.5], [2, 8],
];
const MAPLE_LEAF = poly(...MAPLE.flatMap(([x, y]) => [x, y]), ...MAPLE.slice(1).reverse().flatMap(([x, y]) => [-x, y]));

export const LOCAL_ICONS: Record<string, IconPart[]> = {
  // León: the cathedral's rose window, its glass cut out between the tracery.
  '✨': [
    {
      d:
        circle(24, 24, 21) +
        EIGHT.map((deg) => leaf(...at(24, 24, 6, deg), ...at(24, 24, 16.5, deg), 6.5)).join('') +
        EIGHT.map((deg) => circle(...at(24, 24, 17.2, deg + 22.5), 2)).join(''),
      holes: true,
    },
  ],
  // Cruz de Ferro: the iron cross on its pole, on the mound of stones pilgrims leave.
  '🪨': [
    { d: STONES.map(([x, y, deg, k]) => place(STONE, x, y, deg, k)).join('') },
    { d: line(24, 28, 24, 14), stroke: 3.6 },
    { d: rect(22, 3, 4, 16) + rect(16.5, 7.5, 15, 4) },
  ],
  // Sarria: a hiking boot, laced up, with a lugged sole.
  '🥾': [
    {
      d:
        'M8.5 37L9 9Q9 6 12 6H22Q24.5 6 24.5 8.5L25 19.5Q25.5 23 30 24.5L38 27Q43.5 29 43.5 34.5V37Z' +
        bar(17.5, 11.5, 23, 10.5, 2) + bar(17.5, 15.8, 23.2, 15, 2) + bar(18, 20.2, 24, 20, 2),
      holes: true,
    },
    {
      d:
        roundRect(6.5, 38.3, 38, 3.2, 1.2) +
        rect(7, 40.5, 10, 3.5) +
        rect(22, 40.5, 6, 3.5) +
        rect(31, 40.5, 6, 3.5) +
        rect(39, 40.5, 5, 3.5),
    },
  ],
  // Venice: a gondola with its toothed iron prow, the gondolier rowing at the back.
  '🛶': [
    { d: line(5, 42.5, 43, 42.5), stroke: 2.2, faint: true },
    { d: line(12, 17.5, 22.5, 41) + line(10.5, 19.5, 13.5, 21.5), stroke: 2.2 },
    { d: 'M3.5 22.5C6 33 14 37.5 24 37.5C33 37.5 38.5 33.5 40.5 26L38.5 27.5C34 31 29 32 24 32C16 32 9 30 5.5 22.5Z' },
    {
      d:
        'M38.5 28L40 15Q40.5 12 43.5 12L45 12.5L44.5 15L42.5 15L41.5 28Z' +
        rect(42, 18, 3, 1.8) +
        rect(42, 21.5, 3, 1.8) +
        rect(41.8, 25, 3, 1.8),
    },
    { d: poly(8, 30, 12, 30, 12.6, 17.5, 9, 17.5) },
    { d: circle(10.7, 14, 2.5) + ellipse(10.7, 11.6, 3.8, 1.1) },
  ],
  // Padua: a stack of books, for its old university.
  '📚': [
    { d: book(5, 35, 38, 8.5) + book(8, 25, 34, 8.5) + book(6, 15, 32, 8.5) + book(11, 5.5, 28, 8, -6), holes: true },
  ],
  // Bologna: a bowl of pasta with a fork stuck in it.
  '🍝': [
    { d: 'M4 28.5H44C44 37 36 42 24 42C12 42 4 37 4 28.5Z' },
    { d: roundRect(17, 40.5, 14, 3.5, 1.2) },
    { d: 'M7 26.5C6.5 22 9.5 20 13 21C14 16.5 19 14.5 23 16.5C26 13.5 31.5 15 32.5 19C36 19 41 21.5 41 26.5Z' },
    { d: place('M0 0L0 14', 34, 13, 28), stroke: 3 },
    { d: place(FORK, 34, 13, 28) },
  ],
  // Florence: a painter's palette with its blobs of paint, and a brush.
  '🎨': [
    {
      d:
        'M21 5C32 5 41 11.5 41 20C41 26 37 28.5 33 27.5C29.5 26.5 26.5 29 28 32.5' +
        'C29.5 36 27 40 21 40C11 40 3.5 33 3.5 22.5C3.5 12.5 11 5 21 5Z' +
        circle(18.5, 33, 2.8) + circle(12, 15.5, 3) + circle(21, 11.5, 3) + circle(30.5, 13.5, 3) + circle(10.5, 25.5, 3),
      holes: true,
    },
    { d: place('M0 0L0 -8', 43, 43, -45), stroke: 3 },
    { d: place('M-2.2 -8L2.2 -8L2.2 -12L-2.2 -12Z', 43, 43, -45) },
    { d: place('M-2.2 -13C-3 -15.5 -1.5 -18 0 -20C1.5 -18 3 -15.5 2.2 -13Z', 43, 43, -45) },
  ],
  // Naples: a slice of pizza, crust at the top and pepperoni on it.
  '🍕': [
    { d: 'M7 11.5Q24 6 41 11.5', stroke: 6 },
    {
      d: 'M8.5 16Q24 11 39.5 16L25.5 43Q24 45 22.5 43Z' + circle(18, 22, 3.2) + circle(29.5, 23, 3.2) + circle(24, 32.5, 3),
      holes: true,
    },
  ],
  // Amalfi: a lemon with a leaf.
  '🍋': [
    { d: place(LEMON, 22.5, 27.5, -20) },
    { d: leaf(41, 17.5, 31.5, 5, 7.5) + leaf(39.4, 15.3, 33.5, 7.6, 1.3), holes: true },
  ],
  // Montreal: a sesame bagel, its side showing below.
  '🥯': [
    { d: ellipse(24, 27, 20, 13.5) + ellipse(24, 26.5, 5.5, 3.2), holes: true, faint: true },
    {
      d:
        ellipse(24, 22, 20, 13.5) +
        ellipse(24, 21.5, 5.5, 3.2) +
        [10, 50, 90, 130, 170, 210, 250, 290, 330]
          .map((deg) => {
            // Seeds in a ring halfway between the hole and the rim, each at a slant.
            const [x, y] = at(24, 22, 1, deg);
            const [sx, sy] = [24 + (x - 24) * 12.8, 22 + (y - 22) * 8.4];
            return leaf(...at(sx, sy, 1.4, deg + 60), ...at(sx, sy, 1.4, deg + 240), 1.8);
          })
          .join(''),
      holes: true,
    },
  ],
  // Wawa: a Canada goose, standing, with its white chinstrap.
  '🪿': [
    {
      d:
        'M4.5 23.5C9 21.5 13 19.5 19 19.5C24 19.5 27.5 20.5 29.5 22C30 17 30 13 30.5 10L36 10.5' +
        'C35 15 34.5 19 36.5 23C39.5 28 37.5 34 30.5 35.5C23 37 13 35.5 9 30.5C7 28.5 5.5 26 4.5 23.5Z' +
        leaf(12, 24.5, 30, 26.5, 1.6),
      holes: true,
    },
    { d: ellipse(33.5, 9, 4.6, 4) + leaf(31.2, 11.2, 33.8, 8.2, 2), holes: true },
    { d: poly(37, 7.2, 42.5, 9.5, 37, 11.5) },
    {
      d: line(19.5, 35.5, 18.5, 42.5) + line(25, 36, 26, 42.5) + line(15.5, 43.5, 20.5, 43.5) + line(24, 43.5, 29.5, 43.5),
      stroke: 2.6,
    },
  ],
  // Winnipeg: a bison, big shaggy shoulders and a low head.
  '🦬': [
    {
      d:
        'M12 14C15 7.5 22 4.5 28 7C33 9 38 11.5 41.5 14C44.5 16.5 45 22 44 27C43.5 30 42.5 31.5 41 32L25 32' +
        'C22.5 32 22 35.5 20 36L13 36C11.5 38.5 9 38.5 8.5 36C6.5 34 5 33 4.5 30.5C3.5 26 4 20 6.5 17C8 14.5 10 14 12 14Z' +
        circle(8.3, 21.5, 1.3),
      holes: true,
    },
    { d: 'M10.5 16C7.5 15.5 5.5 13 7 9.5', stroke: 2.4 },
    { d: line(14.5, 35, 14, 43.5) + line(19.5, 35, 20, 43.5) + line(36, 31, 35.5, 43.5) + line(41, 30, 41.5, 43.5), stroke: 3.4 },
  ],
  // Regina: ears of wheat.
  '🌾': [
    { d: 'M24 44V21' + 'M24 44Q22 33 15 25.5' + 'M24 44Q26 33 33 25.5', stroke: 2.6 },
    { d: ear(24, 20, -90) + ear(15, 25, -112) + ear(33, 25, -68) },
  ],
  // Calgary: a cowboy hat, for the Stampede.
  '🤠': [
    { d: 'M3 20.5C5 30.5 12 37 24 37C36 37 43 30.5 45 20.5C42 26.5 36 30.5 30 31L18 31C12 30.5 6 26.5 3 20.5Z' },
    {
      d:
        'M14.5 31.5C14 25.5 14.5 19.5 16 15.5C17 12.5 19 11 21 13C22.2 14.2 22.8 15 24 15C25.2 15 25.8 14.2 27 13' +
        'C29 11 31 12.5 32 15.5C33.5 19.5 34 25.5 33.5 31.5Z' +
        rect(15.3, 25.5, 17.4, 2.8),
      holes: true,
    },
  ],
  // Banff: snow-capped peaks.
  '🏔️': [
    { d: poly(34, 14, 45, 42, 22, 42), faint: true },
    { d: poly(34, 14, 37.1, 22, 35.5, 24, 34, 22, 32.2, 24.5, 30.6, 22) },
    { d: poly(18, 5, 23.05, 16, 21, 19.5, 18.5, 16.5, 16, 19.5, 13.54, 16) },
    { d: poly(3, 42, 12.3, 19, 16, 22.5, 18.5, 19.5, 21, 22.5, 24.4, 19, 35, 42) },
  ],
  // Rogers Pass: a fir tree.
  '🌲': [
    { d: rect(21, 32, 6, 12) },
    { d: 'M24 3L33 15Q24 12.5 15 15Z' + 'M24 9L37.5 25Q24 21.5 10.5 25Z' + 'M24 17L42 36Q24 31.5 6 36Z' },
  ],
  // Springfield: Lincoln's tall top hat.
  '🎩': [
    { d: 'M13 5H35C34 14 34 26 34.5 35H13.5C14 26 14 14 13 5Z' + rect(15.2, 27.5, 17.6, 4), holes: true },
    { d: 'M4 33C6 35.5 9 36.5 14 36.5H34C39 36.5 42 35.5 44 33C44.5 38 40 41.5 34 41.5H14C8 41.5 3.5 38 4 33Z' },
  ],
  // Tulsa: an oil drum, with a drop of oil on it.
  '🛢️': [
    { d: roundRect(9.5, 3.5, 29, 3.4, 1.7) + roundRect(9.5, 41.1, 29, 3.4, 1.7) },
    {
      d:
        'M11 8.5H37C38.6 18 38.6 30 37 39.5H11C9.4 30 9.4 18 11 8.5Z' +
        rect(11.6, 12, 24.8, 2.2) +
        rect(11.6, 34, 24.8, 2.2) +
        'M24 16.5C26.3 20.3 29.5 23.3 29.5 26.5C29.5 29.5 27 31.8 24 31.8C21 31.8 18.5 29.5 18.5 26.5C18.5 23.3 21.7 20.3 24 16.5Z',
      holes: true,
    },
  ],
  // Amarillo: a car on Route 66.
  '🚙': [
    {
      d:
        'M3.5 31V25Q3.5 22.5 6 22.2L8.5 22L10 13.5Q10.5 11.5 12.5 11.5H31Q33 11.5 34.5 13L41 21.5Q44.5 22.5 44.5 26V31' +
        'Q44.5 33 42.5 33H41.8A6.8 6.8 0 0 0 28.2 33H19.8A6.8 6.8 0 0 0 6.2 33H5.5Q3.5 33 3.5 31Z' +
        poly(12.5, 14.5, 21, 14.5, 21, 20.5, 11.5, 20.5) +
        poly(23.5, 14.5, 32, 14.5, 37, 20.5, 23.5, 20.5),
      holes: true,
    },
    { d: circle(13, 33, 5.3) + circle(13, 33, 2) + circle(35, 33, 5.3) + circle(35, 33, 2), holes: true },
  ],
  // Holbrook: a log of petrified wood, its rings showing at the cut end.
  '🪵': [
    {
      d: 'M8 15H33.2A8.5 12 0 0 0 33.2 39H8A4 12 0 0 1 8 15Z' + leaf(8.5, 21.5, 22.5, 21, 1.8) + leaf(12, 32.5, 24, 33, 1.8),
      holes: true,
    },
    {
      d: ellipse(35, 27, 8.5, 12) + ellipse(35.4, 27, 6, 8.8) + ellipse(35.7, 27, 3.8, 5.6) + ellipse(35.9, 27, 1.8, 2.6),
      holes: true,
    },
  ],
  // Williams: a canyon at sunset, terraced cliffs either side of a river.
  '🏞️': [
    ...sun(24, 12),
    { d: 'M22 30.5H26.5C26 34 28 37 31 44H17C21 39 23 35 22 30.5Z', faint: true },
    { d: 'M3 44V12H8L9.5 17H12.5L14 22.5H17L18.5 28L22 30.5C23 35 21 39 17 44Z' },
    { d: 'M45 44V16H40L38.5 21H35.5L34 25.5H31.5L30 29.5L26.5 30.5C26 34 28 37 31 44Z' },
  ],
  // Barstow: a saguaro cactus.
  '🌵': [
    { d: line(5, 44, 43, 44), stroke: 2.2, faint: true },
    { d: 'M19.5 42V8.5C19.5 2.5 28.5 2.5 28.5 8.5V42Z' },
    { d: 'M28 26H33Q36.5 26 36.5 22.5V13.5', stroke: 6.5 },
    { d: 'M20 32H15Q11.5 32 11.5 28.5V19.5', stroke: 6.5 },
  ],
  // Santa Monica: the ferris wheel on the pier.
  '🎡': [
    { d: line(24, 21, 13.5, 43.5) + line(24, 21, 34.5, 43.5) + line(9, 44, 39, 44), stroke: 3 },
    { d: circle(24, 21, 15), stroke: 2.6 },
    { d: EIGHT.map((deg) => line(24, 21, ...at(24, 21, 15, deg))).join(''), stroke: 1.8 },
    { d: circle(24, 21, 3.2) + EIGHT.map((deg) => circle(...at(24, 21, 15, deg), 2.8)).join('') },
  ],
  // Mutianyu: a fallen maple leaf, for the autumn colours on the Wall.
  '🍂': [
    { d: place('M0 6L0 19', 24, 23, -18), stroke: 2.6 },
    {
      d: place(MAPLE_LEAF + leaf(0, 5, 0, -14, 1.6) + leaf(0, 3, 12, -6, 1.4) + leaf(0, 3, -12, -6, 1.4), 24, 23, -18),
      holes: true,
    },
  ],
  // Datong: the great carved Buddha of the Yungang Grottoes, eyes half closed.
  '🗿': [
    { d: arc(24, 19, 17.5, 145, 395), stroke: 2.6, faint: true },
    { d: 'M4 45C4 39 9 36 16 35L19 32H29L32 35C39 36 44 39 44 45Z' },
    { d: ellipse(13.6, 24.5, 2.2, 7.5) + ellipse(34.4, 24.5, 2.2, 7.5) },
    { d: circle(24, 8.5, 5) },
    {
      d:
        ellipse(24, 21, 10.5, 12.5) +
        'M15 15Q24 7 33 15Q24 11 15 15Z' +
        leaf(16.5, 21, 22, 21, 2.2) +
        leaf(26, 21, 31.5, 21, 2.2) +
        circle(24, 17, 1.4) +
        leaf(21, 28.5, 27, 28.5, 1.8),
      holes: true,
    },
  ],
  // Yulin: sand dunes under the sun, the big one's slip face in shade.
  '🏜️': [
    ...sun(34.5, 12.5),
    { d: 'M3 30C5.5 29 8 27.5 10 25.5C11.5 28 14 30 18 31V40H3Z', faint: true },
    { d: 'M3 44V40C10 38 16 33 21 25C24 30 30 34 38 36C41 36.8 43 37 45 37V44Z', faint: true },
    { d: 'M3 44V40C10 38 16 33 21 25C21.5 33 25 39 31 44Z' },
  ],
  // Yinchuan: a tall two-handled amphora.
  '🏺': [
    { d: 'M19.2 9.5C13 9 11 12.5 13.5 18' + 'M28.8 9.5C35 9 37 12.5 34.5 18', stroke: 2.8 },
    {
      d:
        'M17 4.5H31V7.5H29C28.5 10 28.5 12 29.5 14C35 16.5 38 21 38 26C38 32 33 37 29 40L29.5 42H31V44H17V42H18.5L19 40' +
        'C15 37 10 32 10 26C10 21 13 16.5 18.5 14C19.5 12 19.5 10 19 7.5H17Z' +
        rect(11.5, 23, 25, 2.2) +
        rect(12.5, 29, 23, 2.2),
      holes: true,
    },
  ],
};
