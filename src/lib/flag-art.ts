// Flags for the journeys' countries, drawn flat in their own colours rather than as emoji, and the
// fantasy lands' made-up flags: each land's sky with its emblem on it. On the icon grid (see
// src/lib/icon-art.ts), every flag is the same 3:2 card; src/components/flag-icon.tsx draws them.

import { FANTASY_LANDS } from '@/lib/fantasy-lands';
import { line, poly, rect, roundRect, star, type ColorPart } from '@/lib/icon-art';
import type { Sky } from '@/lib/journeys';

/** Where a flag sits on the 48 × 48 grid: 42 × 28, centred. */
export const FLAG = { x: 3, y: 10, w: 42, h: 28, r: 3.5 };
export const FLAG_OUTLINE = roundRect(FLAG.x, FLAG.y, FLAG.w, FLAG.h, FLAG.r);

const RED = '#D6313A';
const BLUE = '#26408B';
const WHITE = '#FFFFFF';
const YELLOW = '#F7C531';
const GREEN = '#1E9A5B';

const field = (color: string): ColorPart => ({ d: rect(FLAG.x, FLAG.y, FLAG.w, FLAG.h), color });

/** The maple leaf, `s` tall, centred on (cx, cy): three lobes up top, two small ones, and a stem. */
function mapleLeaf(cx: number, cy: number, s: number): string {
  const right = [
    [0, -0.5], [0.09, -0.33], [0.18, -0.37], [0.14, -0.12], [0.3, -0.27], [0.33, -0.18], [0.48, -0.21],
    [0.4, -0.04], [0.45, 0.02], [0.24, 0.17], [0.27, 0.27], [0.04, 0.23], [0.04, 0.5],
  ];
  const left = right.slice(1).reverse().map(([x, y]) => [-x!, y!]);
  return poly(...[...right, ...left].flatMap(([x, y]) => [cx + x! * s, cy + y! * s]));
}

/** Each country's flag, keyed by its flag emoji. Clipped to the flag's rounded card when drawn. */
export const COUNTRY_FLAGS: Record<string, ColorPart[]> = {
  // Union Jack: the saltires (simplified, not counterchanged) under St George's cross.
  '🇬🇧': [
    field(BLUE),
    { d: `${line(3, 10, 45, 38)}${line(45, 10, 3, 38)}`, stroke: 6, color: WHITE },
    { d: `${line(3, 10, 45, 38)}${line(45, 10, 3, 38)}`, stroke: 2.2, color: RED },
    { d: `${line(24, 8, 24, 40)}${line(1, 24, 47, 24)}`, stroke: 8.5, color: WHITE },
    { d: `${line(24, 8, 24, 40)}${line(1, 24, 47, 24)}`, stroke: 5, color: RED },
  ],
  // Red bars either side of a white square with the maple leaf.
  '🇨🇦': [
    field(WHITE),
    { d: rect(3, 10, 10.5, 28) + rect(34.5, 10, 10.5, 28), color: RED },
    { d: mapleLeaf(24, 24.2, 17), color: RED },
  ],
  // Red, a wide yellow band, red.
  '🇪🇸': [field(RED), { d: rect(3, 17, 42, 14), color: YELLOW }],
  // Green, white, red.
  '🇮🇹': [field(WHITE), { d: rect(3, 10, 14, 28), color: GREEN }, { d: rect(31, 10, 14, 28), color: RED }],
  // Stripes (seven, so they stay stripes when small) and a blue canton with a few stars.
  '🇺🇸': [
    field(WHITE),
    { d: [10, 18, 26, 34].map((y) => rect(3, y, 42, 4)).join(''), color: RED },
    { d: rect(3, 10, 19, 16), color: BLUE },
    {
      d: [7, 12.5, 18].flatMap((x) => [14.5, 21.5].map((y) => star(x, y, 2.2))).join(''),
      color: WHITE,
    },
  ],
  // Red, with a big yellow star and four small ones around it.
  '🇨🇳': [
    field(RED),
    { d: star(11, 18, 5.6), color: YELLOW },
    { d: [[18, 12.5], [21, 16], [21, 20.5], [18, 24]].map(([x, y]) => star(x!, y!, 1.8)).join(''), color: YELLOW },
  ],
};

/** Each fantasy land's sky (its flag's colours), keyed by the land's flag emoji, which is also its emblem. */
export const LAND_SKIES: Record<string, Sky> = Object.fromEntries(
  FANTASY_LANDS.map((land) => [land.flag, land.stops[0]!.sky])
);
