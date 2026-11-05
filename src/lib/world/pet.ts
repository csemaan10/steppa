// Pet world: a little animal of your own in a cosy yard, from a baby to a legend. It faces you, chibi
// style (a big head on a small body), breathes, blinks and wags its tail, and collects a bed, toys,
// hats, outfits and friends as the steps add up. A fish lives in a bowl on a stool instead.

import {
  Art,
  circle,
  darker,
  drawBalloon,
  drawHills,
  drawKites,
  drawLawn,
  drawRainbow,
  drawSky,
  ellipse,
  heart,
  HORIZON,
  lighter,
  mix,
  n,
  poly,
  puff,
  rect,
  ring,
  roundRect,
  SKY_CHOICES,
  type Choice,
  stageOf,
  star,
  type Guest,
  type PetSpot,
  type Picks,
  type Shape,
  type TimeOfDay,
  type WorldArt,
  type WorldDef,
} from '@/lib/world/common';
import { slotColourKey } from '@/lib/world/colours';
import type { Mood } from '@/lib/world/mood';

const SPECIES = ['cat', 'dog', 'bunny', 'fox', 'bear', 'dragon', 'lion', 'tiger', 'cheetah', 'horse', 'fish'] as const;
type Species = (typeof SPECIES)[number];

/** Where the pet stands: the middle of its feet, a little lower each stage so a big one still fits. */
const PET_X = 150;
const FEET = [238, 240, 244, 248, 252, 256];
/**
 * The pet's size at each stage: it grows steadily, then shoots up from Grown on until a legend stands
 * nearly as tall as the scene. A young one's head is a little bigger for its size.
 */
const SIZE = [0.76, 0.9, 1.05, 1.3, 1.55, 1.8];
const HEAD = [1.14, 1.1, 1.06, 1.02, 1, 1];

const INK = '#2F2A36';
const BLUSH = '#FF8FA3';
/** Black markings: a tiger's stripes, a cheetah's spots. */
const WILD_INK = '#2E2724';

const SOUNDS: Record<Species, readonly string[]> = {
  cat: ['Purr!', 'Mrrp?', 'Meow!'],
  dog: ['Woof!', 'Arf!', 'Yip yip!'],
  bunny: ['Squeak!', 'Eep!'],
  fox: ['Yip!', 'Ring-ding!'],
  bear: ['Grr!', 'Hmm-hmm!'],
  dragon: ['Rawr!', 'Puff!'],
  lion: ['Roar!', 'Mrrr!'],
  tiger: ['Grrr!', 'Chuff!'],
  cheetah: ['Chirp!', 'Purr!'],
  horse: ['Neigh!', 'Whinny!'],
  fish: ['Blub!', 'Bloop!'],
};

const TREATS: Record<Species, string> = {
  cat: '🐟',
  dog: '🦴',
  bunny: '🥕',
  fox: '🫐',
  bear: '🍯',
  dragon: '🌶️',
  lion: '🍖',
  tiger: '🍖',
  cheetah: '🍖',
  horse: '🍎',
  fish: '🦐',
};

// ---------- Placing shapes ----------

const PARAMS: Record<string, number> = { m: 2, l: 2, t: 2, h: 1, v: 1, c: 6, s: 4, q: 4, a: 7, z: 0 };

/**
 * Moves and scales a path drawn around (0, 0) into place: x → ox + x·kx, y → oy + y·ky. A negative kx
 * mirrors it (arcs then sweep the other way).
 */
function place(d: string, ox: number, oy: number, kx: number, ky = Math.abs(kx)): string {
  const tokens = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)/g) ?? [];
  const k = Math.abs(kx);
  let out = '';
  let cmd = '';
  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i]!;
    if (/[a-zA-Z]/.test(token)) {
      cmd = token;
      out += token;
      i++;
      continue;
    }
    const lower = cmd.toLowerCase();
    const rel = cmd === lower;
    const p = tokens.slice(i, i + PARAMS[lower]!).map(Number);
    i += PARAMS[lower]!;
    const x = (v: number) => (rel ? v * kx : ox + v * kx);
    const y = (v: number) => (rel ? v * ky : oy + v * ky);
    let values: number[];
    if (lower === 'h') values = [x(p[0]!)];
    else if (lower === 'v') values = [y(p[0]!)];
    else if (lower === 'a') {
      values = [p[0]! * k, p[1]! * k, p[2]!, p[3]!, kx * ky < 0 ? 1 - p[4]! : p[4]!, x(p[5]!), y(p[6]!)];
    } else values = p.map((v, j) => (j % 2 ? y(v) : x(v)));
    out += `${values.map(n).join(' ')} `;
  }
  return out;
}

/** A shape and its mirror image across x = 0. */
const both = (d: string) => d + place(d, 0, 0, -1);

/** Paints shapes drawn around (0, 0), moved to (ox, oy) and scaled by k. */
class Pen {
  readonly art: Art;
  readonly ox: number;
  readonly oy: number;
  readonly k: number;

  constructor(art: Art, ox: number, oy: number, k: number) {
    this.art = art;
    this.ox = ox;
    this.oy = oy;
    this.k = k;
  }

  fill(d: string, color: string, opacity?: number) {
    this.art.fill(place(d, this.ox, this.oy, this.k), color, opacity);
  }

  light(d: string, color: string, opacity?: number) {
    this.art.light(place(d, this.ox, this.oy, this.k), color, opacity);
  }

  /** A point in scene units. */
  at(x: number, y: number): [number, number] {
    return [this.ox + x * this.k, this.oy + y * this.k];
  }
}

/**
 * Stripes across a tail: a short band at the middle of every other step along its centre line,
 * `width` across and `thick` along.
 */
function bands(centre: readonly (readonly [number, number])[], width: number, thick: number, from = 0): string {
  let d = '';
  for (let i = from; i < centre.length - 1; i += 2) {
    const [x0, y0] = centre[i]!;
    const [x1, y1] = centre[i + 1]!;
    const len = Math.hypot(x1 - x0, y1 - y0);
    const [dx, dy] = [(x1 - x0) / len, (y1 - y0) / len];
    const [nx, ny] = [-dy, dx];
    const [cx, cy] = [(x0 + x1) / 2, (y0 + y1) / 2];
    const [w, t] = [width / 2, thick / 2];
    d += poly(
      cx + nx * w - dx * t, cy + ny * w - dy * t,
      cx + nx * w + dx * t, cy + ny * w + dy * t,
      cx - nx * w + dx * t, cy - ny * w + dy * t,
      cx - nx * w - dx * t, cy - ny * w - dy * t
    );
  }
  return d;
}

function luminance(color: string): number {
  const v = parseInt(color.slice(1), 16);
  const c = (shift: number) => ((v >> shift) & 255) / 255;
  return 0.2126 * c(16) + 0.7152 * c(8) + 0.0722 * c(0);
}

// ---------- Colours and markings ----------

type Coat = {
  main: string;
  belly: string;
  /** Inside the ears (a dragon's horns). */
  inner: string;
  /** Ear tips, a dog's ears, a fox's socks, a dragon's wings, a fish's fins, a horse's hooves. */
  tips: string;
  /** Stripes, spots and the like. */
  mark: string;
  /** A lion's mane, a horse's mane and tail. */
  mane: string;
  /** A dark coat, whose eyes need a pale ring to show. */
  dark: boolean;
  specks?: 'galaxy' | 'golden';
};

type Natural = { main: string; belly: string; inner: string; tips: string };

const NATURAL: Record<Species, Natural> = {
  cat: { main: '#F6A660', belly: '#FFF1E2', inner: '#FFB8C6', tips: '#E3894A' },
  dog: { main: '#EDC797', belly: '#FFF6E8', inner: '#FFB8C6', tips: '#C8925C' },
  bunny: { main: '#F4E8DD', belly: '#FFFFFF', inner: '#FFB8C6', tips: '#E4D0BE' },
  fox: { main: '#F48A3E', belly: '#FFF7EE', inner: '#FFE3CC', tips: '#5C4036' },
  bear: { main: '#BC8559', belly: '#EECDA8', inner: '#EECDA8', tips: '#9C6B45' },
  dragon: { main: '#8AD6A5', belly: '#FFF1B5', inner: '#FFF4D6', tips: '#5FC0A0' },
  lion: { main: '#F5C86C', belly: '#FFF3D8', inner: '#E8A75A', tips: '#C9772F' },
  tiger: { main: '#F5973A', belly: '#FFF8F0', inner: '#FFF8F0', tips: WILD_INK },
  cheetah: { main: '#EDBF76', belly: '#FFF6E4', inner: '#F8DDB0', tips: WILD_INK },
  horse: { main: '#D69C6C', belly: '#F9E4CC', inner: '#F4B9AA', tips: '#5E4A42' },
  fish: { main: '#FF9645', belly: '#FFD9A8', inner: '#FFC07A', tips: '#FFB878' },
};

const COATS: Record<string, { main: string; belly: string; specks?: Coat['specks'] }> = {
  grey: { main: '#B1B6C1', belly: '#EEF0F4' },
  snow: { main: '#FBF7F2', belly: '#FFFFFF' },
  cream: { main: '#F5E2C3', belly: '#FFF9EE' },
  cocoa: { main: '#8E5E3F', belly: '#DDB894' },
  black: { main: '#3F3B44', belly: '#57525D' },
  peach: { main: '#FFC4AA', belly: '#FFF2EA' },
  golden: { main: '#F7C64A', belly: '#FFF2BA', specks: 'golden' },
  galaxy: { main: '#6152BC', belly: '#ACA0F2', specks: 'galaxy' },
};

/** A pony's mane and tail: dark brown on its own coat, cream on a palomino, lilac on a galaxy pony. */
function horseMane(id: string | undefined, main: string): string {
  if (!id || !COATS[id]) return '#6E4632';
  if (id === 'golden') return '#FFF1D2';
  if (id === 'galaxy') return '#C8B8FF';
  if (id === 'snow') return '#D3D8E2';
  if (id === 'grey') return darker(main, 0.35);
  return mix(main, '#5A3828', 0.6);
}

function coatFor(species: Species, id: string | undefined): Coat {
  const natural = NATURAL[species];
  const coat = id ? COATS[id] : undefined;
  const main = coat?.main ?? natural.main;
  const dark = luminance(main) < 0.3;
  const wild = species === 'tiger' || species === 'cheetah';
  let inner = natural.inner;
  let tips = natural.tips;
  if (coat) {
    // Pink ears and cream horns suit every coat; the bits that match the fur follow it.
    if (species === 'bear' || species === 'lion' || species === 'cheetah' || species === 'fish') inner = lighter(main, 0.4);
    if (species === 'fox' || species === 'tiger') inner = coat.belly;
    if (!wild) tips = species === 'fish' ? lighter(main, 0.3) : darker(main, species === 'fox' ? 0.45 : species === 'horse' ? 0.5 : 0.16);
  }
  return {
    main,
    belly: coat?.belly ?? natural.belly,
    inner,
    tips,
    mark: dark ? lighter(main, 0.2) : wild ? WILD_INK : species === 'cat' && !coat ? natural.tips : darker(main, 0.3),
    mane: species === 'horse' ? horseMane(id, main) : coat ? mix(main, '#8A4B1E', 0.38) : '#DD8838',
    dark,
    ...(coat?.specks ? { specks: coat.specks } : {}),
  };
}

/** The markings to draw: the species' own for 'natural' ('cat' is a ginger cat's light stripes). */
type Marks = 'none' | 'cat' | 'stripes' | 'spots' | 'patches' | 'socks' | 'dog' | 'fox' | 'blaze';

function marksFor(species: Species, pattern: string | undefined): Marks {
  if (pattern === 'tabby') return 'stripes';
  if (pattern === 'spots' || pattern === 'patches' || pattern === 'socks') return pattern;
  return ({ cat: 'cat', dog: 'dog', fox: 'fox', tiger: 'stripes', cheetah: 'spots', horse: 'blaze' } as Partial<Record<Species, Marks>>)[species] ?? 'none';
}

/** Patch colours: ginger and dark grey on a pale coat (a calico), white on anything darker. */
function patchColors(coat: Coat): readonly [string, string] {
  return luminance(coat.main) > 0.75 ? ['#EE9B55', '#4A4248'] : ['#FFFDF8', '#FFFDF8'];
}

const SOCK = '#FFFDF8';

const IRIS: Record<string, string> = { brown: '#7A4A2E', blue: '#4C8FDB', green: '#4FA35F', amber: '#DE9A2E' };

// ---------- The pet ----------

type Look = {
  species: Species;
  coat: Coat;
  marks: Marks;
  eyes: string;
  stage: number;
  /** Eyes closed, fast asleep. */
  sleepy?: boolean;
  collar?: string;
  hat?: string;
  glasses?: string;
  outfit?: string;
  kicks?: string;
  /** The colour chosen for each thing it wears (an ITEM_COLOURS id), if not its own. */
  colours?: Partial<Record<WornSlot, string>>;
};

/** The slots for things it wears that can be worn in another colour. */
type WornSlot = 'collar' | 'hat' | 'glasses' | 'outfit' | 'kicks';
const WORN_SLOTS: readonly WornSlot[] = ['collar', 'hat', 'glasses', 'outfit', 'kicks'];

/**
 * Draws one thing it wears in the colour chosen for it, if any. `pen` is what it's drawn with (its
 * place keeps two pets' things apart); `base` is the thing's main colour, if known.
 */
function wearing(pen: Pen, look: Look, slot: WornSlot, draw: () => void, base?: string) {
  pen.art.colouring(look.colours?.[slot], `${n(pen.ox)}:${n(pen.oy)}:${slot}`, draw, base);
}

/** Its body (feet at 0, 0) and its head, which is a little bigger on a young pet. */
function pens(art: Art, x: number, feet: number, s: number, hb: number) {
  return { body: new Pen(art, x, feet, s), head: new Pen(art, x, feet + s * 36 * (hb - 1), s * hb) };
}

/** A fish's head is its whole body, floating in its bowl (centre 62 up) at about 70% size. */
function fishPen(art: Art, x: number, feet: number, s: number, hb: number) {
  const k = 0.7 * s * hb;
  return new Pen(art, x, feet - 62 * s + 58 * k, k);
}

/** The colour of the fur under each eye, which the blink and happy faces cover it with. */
function eyeSkin(look: Look): readonly [string, string] {
  const { main } = look.coat;
  // A fish's patches and stripes keep clear of its eyes.
  if (look.species === 'fish') return [main, main];
  if (look.marks === 'dog') return [main, darker(main, 0.12)];
  if (look.marks === 'patches') return [main, patchColors(look.coat)[0]];
  return [main, main];
}

/** How far a lion's mane reaches from the middle of its face at each stage (0: just a tuft). */
const MANE = [0, 37, 42, 46, 49, 52];

// Tails, drawn around the base of the tail at (12, -10): the outline, a centre line for stripes and
// spots, and the tip.
const CAT_TAIL = 'M10 -10C26 -8 36 -18 33 -38C32 -45 38 -49 41 -43C46 -24 36 -2 12 -3Z';
const CAT_TIP = 'M33.6 -36C33 -40 33 -43 34 -45L40.6 -44.2C42.4 -40 42.8 -37 42.8 -34Z';
const CAT_LINE = [[11, -6.5], [17.5, -7.7], [24, -8.6], [29.5, -11.5], [33.5, -16], [36, -21.5], [37.3, -27], [37.6, -33]] as const;

const TAILS: Partial<Record<Species, { d: string; tip?: string; line: readonly (readonly [number, number])[]; width: number }>> = {
  cat: { d: CAT_TAIL, tip: CAT_TIP, line: CAT_LINE, width: 7.6 },
  tiger: { d: CAT_TAIL, tip: CAT_TIP, line: CAT_LINE, width: 7.6 },
  cheetah: { d: CAT_TAIL, tip: CAT_TIP, line: CAT_LINE, width: 7.6 },
  dog: {
    d: 'M13 -13C23 -15 29 -25 28 -36C28 -41 33.5 -41 34 -36C35 -22 28 -10 14 -7Z',
    tip: 'M28.1 -35.4C28.2 -41 33.6 -41.2 34 -36C34.1 -34.6 34.1 -33.4 34 -32Z',
    line: [[13.5, -10], [20, -12.5], [25, -17], [28.5, -23], [30.5, -29], [31, -35]],
    width: 5,
  },
  fox: {
    d: 'M8 -7C28 -1 48 -14 47 -39C46 -48 40 -54 35 -52C41 -38 32 -20 11 -17Z',
    line: [[10, -12], [20, -12], [30, -16], [37, -23], [41, -31], [42, -39]],
    width: 9,
  },
  dragon: {
    d: 'M10 -6C26 2 42 0 49 -12C50 -15 54 -14 53 -10C48 4 28 8 9 1Z',
    line: [[10, -2.5], [18, 0.5], [27, 2], [36, 1], [43, -2.5], [49, -8]],
    width: 5.4,
  },
  horse: {
    d: 'M11 -15C20 -22 34 -24 40 -15C45 -7 45 3 39 7C40 1 38 -4 33 -7C35 -1 33 4 28 6C29 0 27 -5 21 -8C17 -9 14 -9 11 -9Z',
    line: [],
    width: 0,
  },
  lion: {
    d: 'M11 -8C24 -6 33 -14 35 -28C35.6 -32 38.6 -32 38.4 -28C37 -12 26 -3 11 -4Z',
    line: [[12, -6], [19, -6.5], [26, -9], [31, -13.5], [34.5, -19.5], [36.6, -25]],
    width: 3,
  },
};

function tail(body: Pen, look: Look) {
  const shape = TAILS[look.species];
  if (!shape) return;
  if (look.species === 'horse') {
    // A flowing tail in the mane's colour, with a lighter strand.
    body.fill(shape.d, look.coat.mane);
    body.fill('M16 -15C25 -19 34 -18 37 -11C38.6 -7 38.4 -3 37 0C36 -5 33 -10 27 -12C23 -13 19 -13 16 -13Z', lighter(look.coat.mane, 0.18), 0.8);
    return;
  }
  const { main, belly, tips, mark, mane } = look.coat;
  body.fill(shape.d, main);
  const { line, width } = shape;
  if (look.marks === 'stripes') body.fill(bands(line, width * 0.95, 2.4, 1), mark);
  if (look.marks === 'spots') {
    const spots = line.slice(1).filter((_, i) => i % 2 === 0).map(([x, y], i) => circle(x + (i % 2 ? 1 : -1), y, width * 0.17));
    body.fill(spots.join(''), mark);
  }
  if (look.species === 'cheetah' && look.marks === 'spots') body.fill(bands(line.slice(-4), width * 0.95, 2.2), mark);
  // The tip: white socks, a tiger's black tip, a ginger cat's darker one, a fox's white brush.
  const tipColor =
    look.marks === 'socks' || look.species === 'cheetah'
      ? SOCK
      : look.marks === 'stripes'
        ? mark
        : look.marks === 'cat'
          ? tips
          : null;
  if (look.species === 'fox') body.fill('M35 -52C40 -54 46 -48 47 -39C46.6 -36 46 -34 45 -32C43 -38 40 -43 35.5 -45Z', belly);
  else if (look.species === 'lion') body.fill(circle(37, -31, 4.4) + circle(39.5, -34, 3.6) + circle(35, -35, 3.4), tipColor ?? mane);
  else if (look.species === 'dragon') body.fill(poly(47.5, -11, 52, -25, 60.5, -13, 54, -8), tipColor ?? tips);
  else if (shape.tip && tipColor) body.fill(shape.tip, tipColor);
}

function backEars(head: Pen, look: Look) {
  const { main, inner, tips } = look.coat;
  switch (look.species) {
    case 'cat':
      head.fill(both('M-29 -68L-26 -97Q-25 -100 -22 -98.5L-7 -82Z'), main);
      head.fill(both('M-25.5 -73L-23.6 -92L-12 -82Z'), inner);
      break;
    case 'fox':
      head.fill(both('M-31 -64L-28 -102Q-27 -105 -24 -103.5L-5 -81Z'), main);
      head.fill(both('M-27 -70L-25.6 -93L-11 -81Z'), inner);
      head.fill(both('M-28.5 -90L-28 -102Q-27 -105 -24 -103.5L-19 -96Z'), tips);
      break;
    case 'bunny':
      head.fill('M-18 -78C-31 -101 -30 -131 -19 -134C-8 -136 -5 -108 -6 -80Z' + place('M-18 -78C-28 -100 -24 -128 -13 -132C-2 -135 -3 -106 -6 -80Z', 0, 0, -1), main);
      head.fill('M-15.5 -85C-24 -104 -24 -125 -18.5 -127.5C-12 -129 -9.5 -108 -9.5 -87Z' + place('M-15 -85C-21 -103 -19 -122 -13 -125.5C-6.5 -128 -8 -106 -9.5 -87Z', 0, 0, -1), inner);
      break;
    case 'bear':
      head.fill(circle(-23, -80, 9.5) + circle(23, -80, 9.5), main);
      head.fill(circle(-23, -79.5, 5.2) + circle(23, -79.5, 5.2), inner);
      break;
    case 'lion':
      head.fill(circle(-21, -80, 7.6) + circle(21, -80, 7.6), main);
      head.fill(circle(-21, -79.6, 4.2) + circle(21, -79.6, 4.2), inner);
      break;
    case 'tiger':
      head.fill(both('M-29 -72C-31 -84 -24 -91 -17 -87C-14 -85 -12 -82 -11 -79Z'), main);
      head.fill(both('M-26.4 -75C-27.4 -83 -23 -87.5 -18.5 -85C-16.6 -83.6 -15.4 -82 -14.6 -79.6Z'), inner);
      head.fill(both('M-27.6 -84.6C-26 -89 -21.6 -90.4 -17.4 -87.6C-21 -87.4 -24 -86.4 -26 -84Z'), WILD_INK, 0.85);
      break;
    case 'cheetah':
      head.fill(circle(-22, -79, 7.2) + circle(22, -79, 7.2), main);
      head.fill(circle(-22, -78.4, 3.8) + circle(22, -78.4, 3.8), inner);
      break;
    case 'horse':
      head.fill(both('M-23 -76C-28 -88 -25 -99 -19.5 -103C-15.5 -97 -13 -88 -13.5 -79Z'), main);
      head.fill(both('M-21.3 -79C-24.6 -88 -23 -95 -19.6 -98.4C-17.4 -94 -16 -88 -16.4 -81Z'), inner);
      break;
    case 'dragon':
      head.fill(both('M-14 -80C-17 -91 -15 -99 -9 -104C-10.5 -97 -9.5 -88 -5.5 -82Z'), inner);
      head.fill(poly(-4.5, -82, 0, -93, 4.5, -82) + both(poly(-30, -66, -40, -62, -30, -55)), tips);
      break;
    default:
      break;
  }
}

/** A lion's mane, behind its ears: a tuft for a cub, then a scalloped ring that grows each stage. */
function maneBack(head: Pen, look: Look) {
  const reach = MANE[look.stage]!;
  if (!reach) return;
  const r = 7 + look.stage * 0.9;
  const ring = reach - r;
  const outer: string[] = [];
  const inner: string[] = [];
  // All the way round except under the chin, so the chest shows.
  for (let a = 128; a <= 412; a += 18) {
    const t = (a * Math.PI) / 180;
    outer.push(circle(Math.cos(t) * ring, -58 + Math.sin(t) * ring * 0.9, r));
    inner.push(circle(Math.cos(t) * (ring - 4), -58 + Math.sin(t) * (ring - 4) * 0.9, r * 0.75));
  }
  head.fill(outer.join(''), look.coat.mane);
  head.fill(inner.join(''), lighter(look.coat.mane, 0.14));
}

/** A pony's mane, flowing down behind its head (longer on the left), drawn before its ears. */
function horseManeBack(head: Pen, look: Look) {
  const { mane } = look.coat;
  head.fill(
    'M-2 -88C-26 -94 -42 -78 -40 -58C-39 -46 -43 -36 -37 -26C-33 -32 -31 -38 -30 -43C-28 -35 -24 -31 -19 -29C-23 -40 -25 -52 -23 -64Z' +
      'M2 -88C24 -94 40 -80 39 -62C38.5 -52 41 -44 36 -37C33 -42 30 -46 27 -50Z',
    mane
  );
  head.fill('M-8 -89C-26 -90 -36 -78 -35 -62C-34 -52 -37 -44 -34 -36C-32 -44 -31 -52 -31 -60C-31 -72 -24 -82 -8 -86Z', lighter(mane, 0.16), 0.8);
}

/** A pony's forelock: a fluffy tuft swept over its forehead. */
function forelock(head: Pen, look: Look) {
  const { mane } = look.coat;
  head.fill('M-13 -84C-15 -77 -11 -71 -5 -68C-6 -73 -3 -76 1 -76C0 -71 3 -68 8 -67C6 -73 10 -79 15 -81C9 -89 -7 -90 -13 -84Z', mane);
  head.fill('M-7 -84C-8 -79 -6 -75 -3 -73C-3 -77 -1 -80 3 -81C1 -83 -4 -85 -7 -84Z', lighter(mane, 0.2), 0.8);
}

/** The fluffy tuft on a lion's forehead (a cub's only bit of mane). */
function maneTuft(head: Pen, look: Look) {
  head.fill(circle(-4, -82.5, 4.4) + circle(3, -84, 5) + circle(-0.5, -87.5, 3.8) + circle(7.6, -81.6, 3.2), look.coat.mane);
  head.fill(circle(1.6, -85, 2.2), lighter(look.coat.mane, 0.2));
}

function headMarks(head: Pen, look: Look) {
  const { mark } = look.coat;
  switch (look.marks) {
    case 'cat':
      head.fill(
        poly(-8.2, -83.2, -6, -76.5, -3.8, -83.6) + poly(-2.2, -84, 0, -75, 2.2, -84) + poly(3.8, -83.6, 6, -76.5, 8.2, -83.2) +
          both(poly(-30.6, -63, -23, -61.5, -30.9, -60) + poly(-30.9, -56, -24, -55.4, -30.4, -53)),
        mark
      );
      break;
    case 'stripes':
      // A tabby's M on the forehead, three stripes on each cheek.
      head.fill(
        poly(-2.6, -84.1, 0, -72.5, 2.6, -84.1) +
          both(
            poly(-9, -83, -6.4, -74, -3.8, -83.8) +
              poly(-16, -80.4, -11.4, -72.8, -10.4, -82.2) +
              poly(-30.7, -65, -22.4, -63.4, -30.95, -61.6) +
              poly(-31, -58.8, -23.4, -57.8, -30.9, -55.8) +
              poly(-30.2, -52.6, -24.6, -52.2, -29.4, -49.8)
          ),
        mark
      );
      break;
    case 'spots':
      head.fill(
        circle(-21, -71, 2.2) + circle(-26, -63.5, 1.7) + circle(-7.5, -79, 1.7) + circle(4, -80.5, 2) + circle(14.5, -76, 1.8) +
          circle(22, -69.5, 2.1) + circle(26.4, -61.5, 1.6) + circle(-14.5, -77, 1.5) + circle(-0.8, -74.5, 1.3),
        mark
      );
      break;
    case 'patches': {
      // The ginger patch round an eye (so the eye still shows), the dark one on top.
      const [a, b] = patchColors(look.coat);
      head.fill(ellipse(13, -59.5, 8.8, 8.2), a);
      head.fill(ellipse(-13, -74.5, 10, 5.6), b);
      break;
    }
    case 'dog':
      head.fill(ellipse(13, -59.5, 8.8, 8.2), darker(look.coat.main, 0.12));
      break;
    case 'blaze':
      head.fill('M-2.8 -84C-4.2 -74 -4.8 -64 -3.6 -50L3.6 -50C4.8 -64 4.2 -74 2.8 -84Z', SOCK);
      break;
    default:
      break;
  }
}

/** Stripes down the sides, drawn before the belly covers their inner ends. */
function bodyMarks(body: Pen, look: Look) {
  const { mark } = look.coat;
  if (look.marks === 'stripes') {
    body.fill(
      both(poly(-20.4, -31, -11.5, -28.6, -20.1, -26.8) + poly(-20.6, -23.5, -12, -21.8, -20.4, -19.5) + poly(-20, -15.8, -12.5, -14.6, -19.4, -12)),
      mark
    );
  }
}

/** Marks on the arms, drawn over them. */
function armMarks(body: Pen, look: Look) {
  if (look.marks === 'stripes') body.fill(both(ellipse(-17, -21.5, 5.3, 1.2) + ellipse(-17, -16.5, 5.9, 1.2)), look.coat.mark);
  if (look.marks === 'spots') body.fill(both(circle(-17.6, -20.5, 1.5) + circle(-16, -15, 1.2)), look.coat.mark);
  // White paws: the bottom of each arm.
  if (look.marks === 'socks') body.fill(both('M-21.9 -12A6 8.6 0 0 0 -12.1 -12Z'), SOCK);
}

function eyes(head: Pen, look: Look) {
  if (look.sleepy) {
    head.fill(both('M-17.5 -57Q-12.5 -51.5 -7.5 -57Q-12.5 -54.2 -17.5 -57Z'), INK);
    return;
  }
  const left = IRIS[look.eyes === 'odd' ? 'blue' : look.eyes] ?? IRIS.brown!;
  const right = look.eyes === 'odd' ? IRIS.green! : left;
  const pair = (draw: (x: number) => string, color: (iris: string) => string) => {
    if (left === right) head.fill(draw(-12.5) + draw(12.5), color(left));
    else {
      head.fill(draw(-12.5), color(left));
      head.fill(draw(12.5), color(right));
    }
  };
  if (look.coat.dark) head.fill(circle(-12.5, -57, 5.8) + circle(12.5, -57, 5.8), lighter(look.coat.main, 0.24));
  pair((x) => circle(x, -57, 4.8), (iris) => darker(iris, 0.6));
  pair((x) => circle(x, -57, 3.9), (iris) => iris);
  pair((x) => ellipse(x, -55.2, 2.7, 1.5), (iris) => lighter(iris, 0.38));
  head.fill(circle(-12.5, -57.4, 2.2) + circle(12.5, -57.4, 2.2), INK);
  head.fill(circle(-14.1, -58.9, 1.65) + circle(10.9, -58.9, 1.65), '#FFFFFF');
  head.fill(circle(-11.1, -55.4, 0.75) + circle(13.9, -55.4, 0.75), '#FFFFFF', 0.9);
}

/** Fur over each eye, the same shape for blinking and for a happy face. */
function coverEyes(head: Pen, look: Look) {
  const r = look.coat.dark ? 6 : 5.3;
  const [left, right] = eyeSkin(look);
  if (left === right) head.fill(circle(-12.5, -57, r) + circle(12.5, -57, r), left);
  else {
    head.fill(circle(-12.5, -57, r), left);
    head.fill(circle(12.5, -57, r), right);
  }
}

/** Closed eyes over open ones, shown for a moment when it blinks. */
function blinkEyes(head: Pen, look: Look) {
  coverEyes(head, look);
  head.fill(both('M-17.5 -57Q-12.5 -54 -7.5 -57Q-12.5 -55.6 -17.5 -57Z'), INK);
}

/** Happy eyes (^ ^) and a rosy blush, while it enjoys being played with. */
function happyFace(head: Pen, look: Look) {
  if (look.glasses !== 'shades' && look.glasses !== 'heart' && look.glasses !== 'iced') {
    coverEyes(head, look);
    head.fill(both('M-17.6 -55.2Q-12.5 -62.4 -7.4 -55.2Q-12.5 -59.6 -17.6 -55.2Z'), INK);
  }
  head.fill(ellipse(-21.5, -49.5, 6.4, 3.9) + ellipse(21.5, -49.5, 6.4, 3.9), BLUSH, 0.75);
}

function face(head: Pen, look: Look) {
  const { main, belly } = look.coat;
  const { species } = look;
  headMarks(head, look);
  if (species === 'fox') head.fill(ellipse(-13, -43.5, 15, 8) + ellipse(13, -43.5, 15, 8) + both(poly(-27, -50, -36.5, -44.5, -26, -40.5)), belly);
  if (species === 'tiger') {
    head.fill(ellipse(-13.5, -44.5, 12.5, 7.2) + ellipse(13.5, -44.5, 12.5, 7.2) + both(poly(-26, -50.5, -35, -45.5, -25, -41.5)), belly);
    head.fill(ellipse(-12, -67, 4.2, 2.4) + ellipse(12, -67, 4.2, 2.4), belly);
  }
  if (species === 'bunny') head.fill(circle(-3, -84, 3.4) + circle(2.6, -85, 3.8) + circle(0, -82, 3.6), main);
  if (species === 'lion') maneTuft(head, look);
  if (species === 'horse') forelock(head, look);

  eyes(head, look);
  head.fill(ellipse(-21.5, -49.5, 5, 3) + ellipse(21.5, -49.5, 5, 3), BLUSH, 0.45);

  if (species === 'horse') {
    // A soft muzzle with round nostrils and a little smile.
    head.fill(ellipse(0, -41.5, 16.5, 10), belly);
    head.fill(ellipse(-5.4, -43, 2, 2.7) + ellipse(5.4, -43, 2, 2.7), darker(belly, 0.38));
    head.fill('M-4.4 -36.6Q0 -33 4.4 -36.6Q0 -34.8 -4.4 -36.6Z', '#6B3440');
    return;
  }

  // Muzzle, nose and mouth.
  const bigMuzzle = species === 'dog' || species === 'bear' || species === 'lion';
  const pads = species === 'cat' || species === 'bunny' || species === 'tiger' || species === 'cheetah';
  if (bigMuzzle) head.fill(ellipse(0, -47.5, 10.5, 7.5), belly);
  if (species === 'dragon') head.fill(ellipse(0, -47, 12, 7.5), lighter(main, 0.35));
  if (pads) head.fill(circle(-3.4, -46.8, 3.6) + circle(3.4, -46.8, 3.6), belly);
  if (species === 'cheetah') head.fill(both('M-9.6 -51.6Q-9.6 -47 -6.4 -43.4L-5.3 -44.2Q-7.8 -47.4 -7.9 -51.4Z'), WILD_INK);
  if (pads) {
    const nose = species === 'tiger' ? '#E3897A' : species === 'cheetah' ? '#4A3A36' : '#F27E9A';
    head.fill('M-2.8 -51.8Q0 -52.8 2.8 -51.8Q1 -48.6 0 -48.5Q-1 -48.6 -2.8 -51.8Z', nose);
  } else if (species === 'dragon') {
    head.fill(circle(-2.8, -50.2, 1.05) + circle(2.8, -50.2, 1.05), darker(main, 0.35));
  } else {
    head.fill(ellipse(0, -51, 3.8, 2.7), species === 'lion' ? '#9A5A4A' : '#3B2F2F');
    head.fill(circle(-1.2, -51.9, 0.9), '#FFFFFF', 0.8);
  }
  if (pads || species === 'fox') {
    head.fill('M-5 -47.4Q-2.5 -43.6 0 -46.8Q2.5 -43.6 5 -47.4L4.5 -46Q2.5 -42.2 0 -45.2Q-2.5 -42.2 -4.5 -46Z', '#5A3A40');
  } else {
    head.fill('M-4.6 -46.6Q0 -45.6 4.6 -46.6Q4 -40.8 0 -40.4Q-4 -40.8 -4.6 -46.6Z', '#6B3440');
    head.fill(ellipse(0, -42.1, 2.6, 1.6), '#FF8FA3');
  }
}

function specks(body: Pen, head: Pen, coat: Coat, fish = false) {
  if (coat.specks === 'galaxy') {
    head.light(circle(-19, -71, 1.1) + circle(8, -77, 0.9) + circle(22, -66, 1.2) + circle(-25, -60, 0.8) + circle(4, -66, 0.7), '#FFFFFF', 0.9);
    head.light(star(17, -75, 2.6, 4, 0.3) + star(-6, -79, 1.8, 4, 0.3), '#FFE89A');
    if (!fish) {
      body.light(circle(-11, -26, 1) + circle(9, -9, 0.9) + circle(14, -27, 1.2), '#FFFFFF', 0.9);
      body.light(star(-7, -8, 2, 4, 0.3), '#FFE89A');
    }
  } else if (coat.specks === 'golden') {
    head.light(star(-17, -73, 3, 4, 0.28) + star(20, -66, 2.2, 4, 0.28), '#FFFFFF', 0.85);
    if (!fish) body.light(star(10, -24, 2.4, 4, 0.28), '#FFFFFF', 0.85);
  }
}

const HATS: Record<string, (head: Pen) => void> = {
  party(head) {
    const apex = [3, -114] as const;
    const left = [-9, -81] as const;
    const right = [15, -81] as const;
    const at = (t: number, [x, y]: readonly [number, number]) => [apex[0] + (x - apex[0]) * t, apex[1] + (y - apex[1]) * t];
    head.fill(poly(...left, ...right, ...apex), '#FF8FB8');
    const band = (t1: number, t2: number) => poly(...at(t1, left), ...at(t1, right), ...at(t2, right), ...at(t2, left));
    head.fill(band(0.3, 0.45) + band(0.66, 0.81), '#FFE08A');
    head.fill(ellipse(3, -81, 12.2, 2.4), darker('#FF8FB8', 0.12));
    head.fill(circle(3, -115, 4.6), '#FFFFFF');
  },
  beanie(head) {
    head.fill('M-27 -72C-27 -98 27 -98 27 -72Z', '#7EC4E6');
    head.fill(rect(-14, -91, 2.4, 18) + rect(-4, -94, 2.4, 21) + rect(6, -93, 2.4, 20) + rect(16, -89, 2.4, 16), darker('#7EC4E6', 0.08));
    head.fill(roundRect(-29, -76, 58, 9.5, 4.7), '#5FAED6');
    head.fill(circle(0, -98, 6.4), '#FFF4E6');
  },
  flowers(head) {
    const colors = ['#FF9EC4', '#FFE27A', '#FFFFFF', '#C9A8FF', '#FF9EC4', '#FFE27A', '#C9A8FF'];
    const leaves: string[] = [];
    const centres: string[] = [];
    const petals: Record<string, string[]> = {};
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * (1.12 + (0.76 * i) / 6);
      const x = Math.cos(a) * 28.5;
      const y = -58 + Math.sin(a) * 24;
      leaves.push(ellipse(Math.cos(a + 0.06) * 29.5, -58 + Math.sin(a + 0.06) * 25, 3.2, 1.8));
      (petals[colors[i]!] ??= []).push(circle(x - 2.6, y, 2.4) + circle(x + 2.6, y, 2.4) + circle(x, y - 2.6, 2.4) + circle(x, y + 2.6, 2.4));
      centres.push(circle(x, y, 1.6));
    }
    head.fill(leaves.join(''), '#6FBF73');
    for (const [color, d] of Object.entries(petals)) head.fill(d.join(''), color);
    head.fill(centres.join(''), '#FFB84D');
  },
  crown(head) {
    head.fill('M-15 -79L-17 -99L-8 -91L0 -104L8 -91L17 -99L15 -79Z', '#FFCF4A');
    head.fill('M-15 -79L-16 -88L15 -88L15 -79Z', '#F5B73A');
    head.fill(circle(-17, -100, 2.4) + circle(0, -105, 2.6) + circle(17, -100, 2.4), '#FFE58A');
    head.fill(circle(0, -83.5, 2.6), '#FF6B8A');
    head.fill(circle(-9, -83.5, 1.9) + circle(9, -83.5, 1.9), '#6FB8F2');
  },
  wizard(head) {
    head.fill(ellipse(2, -81, 27, 5.5), '#6A4FC8');
    head.fill('M-14 -82L18 -82L11 -108Q8 -120 -2 -124Q6 -114 2 -105Z', '#7B5CD6');
    head.fill(roundRect(-13.5, -88, 31, 5.5, 2), '#FFCF4A');
    head.fill(star(5, -100, 3.4) + star(-4, -112, 2.2) + star(10, -91, 1.6, 4), '#FFE58A');
  },
  tophat(head) {
    head.fill(ellipse(0, -80, 23, 4.8), '#2F2B3A');
    head.fill(roundRect(-14, -109, 28, 29, 3), '#3A3547');
    head.fill(rect(-14, -88, 28, 6), '#E5534B');
    head.fill(rect(-11, -106, 3, 15), '#FFFFFF', 0.12);
  },
  snapback(head) {
    head.fill('M-25 -73C-25 -100 25 -100 25 -73Z', '#F25F5C');
    head.fill('M-10 -97C-7 -88 -7 -80 -8 -73L8 -73C7 -80 7 -88 10 -97Q0 -100.5 -10 -97Z', lighter('#F25F5C', 0.12));
    head.fill(circle(0, -98.6, 2.6), darker('#F25F5C', 0.18));
    head.fill(star(0, -84, 4.8), '#FFFFFF');
    head.fill('M-26 -74Q0 -80 26 -74Q30 -68 22 -66Q0 -71 -22 -66Q-30 -68 -26 -74Z', '#3B4A6B');
    head.fill('M-22 -72.6Q0 -77.6 22 -72.6L21 -70.6Q0 -75.4 -21 -70.6Z', lighter('#3B4A6B', 0.2), 0.8);
  },
  'lenin-cap'(head) {
    // A flat cloth cap with a short peak.
    const cloth = '#3D3A45';
    head.fill('M-27 -75C-28 -92 -12 -98 0 -98C12 -98 28 -92 27 -75Q0 -80 -27 -75Z', cloth);
    head.fill(rect(-0.5, -97, 1, 19), darker(cloth, 0.25), 0.7);
    head.fill(circle(0, -97.4, 1.7), darker(cloth, 0.3));
    head.fill(ellipse(-10, -91, 9, 2.4), lighter(cloth, 0.18), 0.6);
    head.fill('M-24 -76Q0 -82 24 -76Q27 -71 20 -69.5Q0 -74 -20 -69.5Q-27 -71 -24 -76Z', darker(cloth, 0.22));
  },
  tiara(head) {
    // A silver tiara with a pink jewel.
    const silver = '#DDE3EC';
    head.fill('M-17 -79Q0 -86 17 -79L16.4 -76.6Q0 -83.4 -16.4 -76.6Z', silver);
    head.fill(poly(-11, -81.2, -7.4, -90, -4, -82.8) + poly(-4, -83.2, 0, -97, 4, -83.2) + poly(4, -82.8, 7.4, -90, 11, -81.2), silver);
    head.light(circle(0, -89, 2.3), '#FF6FA5');
    head.light(circle(-7.2, -86, 1.3) + circle(7.2, -86, 1.3), '#8FD3F4');
    head.fill(ellipse(-6, -82.4, 4, 0.9), '#FFFFFF', 0.7);
  },
  hairbow(head) {
    // A big polka-dot bow on one side.
    const red = '#FF5C8A';
    head.fill(place('M0 0L-13 -8Q-16 0 -13 8Z' + 'M0 0L13 -8Q16 0 13 8Z', 15, -82, 1.1), red);
    head.fill(place('M-2 0L-10 -4Q-11 0 -10 4Z' + 'M2 0L10 -4Q11 0 10 4Z', 15, -82, 1.1), darker(red, 0.15));
    head.fill(place(circle(-9, -3, 1.3) + circle(-7, 4, 1.1) + circle(9, -3, 1.3) + circle(8, 4, 1.1), 15, -82, 1.1), '#FFFFFF');
    head.fill(circle(15, -82, 3.8), darker(red, 0.06));
  },
  sunhat(head) {
    // A floppy straw sun hat with a pink ribbon and flowers.
    const straw = '#F2D58A';
    head.fill(ellipse(0, -77, 39, 7.5), straw);
    head.fill('M-18 -78C-18 -97 18 -97 18 -78Z', lighter(straw, 0.08));
    head.fill(rect(-18.2, -84, 36.4, 5), '#FF8FB8');
    head.fill('M-39 -77A39 7.5 0 0 0 39 -77L37 -75.6A37 6 0 0 1 -37 -75.6Z', darker(straw, 0.12));
    head.fill(circle(9, -84.5, 2) + circle(13, -84.5, 2) + circle(11, -86.5, 2) + circle(11, -82.5, 2), '#FFFFFF');
    head.fill(circle(11, -84.5, 1.4), '#FFB84D');
    head.fill(circle(4.6, -84.4, 2.4), '#FF6F91');
  },
  tricorn(head) {
    // A pirate's tricorn: black, gold-edged, with a skull and crossbones on the front.
    const felt = '#26222C';
    head.fill('M-33 -76Q-31 -97 -14 -92Q0 -108 14 -92Q31 -97 33 -76Q0 -84 -33 -76Z', felt);
    head.fill('M-33 -76Q0 -84 33 -76L32 -73.4Q0 -81.2 -32 -73.4Z', '#F2C14E');
    head.fill(bar(-5, -83, 5, -88.6, 1.4) + bar(5, -83, -5, -88.6, 1.4), '#F4F1EA');
    head.fill(circle(0, -91, 3.6) + roundRect(-2.2, -89.2, 4.4, 3.2, 1), '#F4F1EA');
    head.fill(circle(-1.3, -91.2, 1) + circle(1.3, -91.2, 1), felt);
  },
  bucket(head) {
    head.fill('M-19 -76C-19 -98 19 -98 19 -76Z', '#9ADCC8');
    head.fill(rect(-19.2, -82, 38.4, 5), '#6FC2AB');
    head.fill('M-31 -71Q0 -84 31 -71Q33 -65 27 -65Q0 -76 -27 -65Q-33 -65 -31 -71Z', '#86D3BC');
    head.fill(circle(9.5, -89, 1.9) + circle(12.5, -89, 1.9) + circle(11, -91.6, 1.9) + circle(11, -86.4, 1.9), '#FF9EC4');
    head.fill(circle(11, -89, 1.3), '#FFFFFF');
  },

  // Souvenirs, brought home from trips (see `souvenirs` below).
  guard(head) {
    // A royal guard's bearskin: tall, black and furry, with a red plume and a gold band.
    head.fill('M-19 -74C-22 -96 -16 -121 0 -122C16 -121 22 -96 19 -74Z', '#1F1B24');
    head.fill('M-11 -112C-13 -100 -12 -86 -10 -76L-6 -76C-8 -88 -8 -102 -6 -114Z', '#3A3443', 0.8);
    head.fill(ellipse(17.5, -97, 3.2, 9), '#E5484D');
    head.fill(roundRect(-19.5, -78, 39, 4, 2), '#F2C14E');
  },
  toque(head) {
    // A red toque with a maple leaf on its band.
    head.fill('M-27 -72C-27 -98 27 -98 27 -72Z', '#E5484D');
    head.fill(rect(-14, -91, 2.4, 18) + rect(-4, -94, 2.4, 21) + rect(6, -93, 2.4, 20) + rect(16, -89, 2.4, 16), darker('#E5484D', 0.1));
    head.fill(roundRect(-29, -76, 58, 9.5, 4.7), '#FFFFFF');
    head.fill(star(0, -71.8, 3.9, 5, 0.5) + rect(-0.4, -70, 0.8, 3), '#E5484D');
    head.fill(circle(0, -98, 6.4), '#FFFFFF');
  },
  rose(head) {
    // A flamenco rose tucked in on one side.
    head.fill(ellipse(-27, -75, 6, 2.6) + ellipse(-15, -76, 6, 2.6), '#3E8E4B');
    head.fill(circle(-21, -80, 8), '#D7263D');
    head.fill(circle(-21, -80, 5.2), '#B81D33');
    head.fill('M-24.5 -82Q-21 -87 -17 -81Q-21 -78.5 -24.5 -82Z', '#E9485F');
    head.fill(circle(-21.5, -80.5, 1.8), '#8E1426');
  },
  boater(head) {
    // A gondolier's straw boater with a red ribbon, its ends trailing.
    head.fill(ellipse(0, -77, 31, 5.5), '#E2B95A');
    head.fill(roundRect(-17, -94, 34, 18, 3), '#EDC96C');
    head.fill(rect(-15, -91, 30, 0.9) + rect(-15, -88, 30, 0.9), darker('#EDC96C', 0.12), 0.7);
    head.fill(ellipse(0, -94, 17, 3), '#F2D27E');
    head.fill(rect(-17, -84.5, 34, 5), '#D7263D');
    head.fill('M14 -82L22 -71.5L18.5 -70.5L12.5 -79Z', '#D7263D');
  },
  cowboy(head) {
    // A cowboy hat: a dented crown and a brim that curls up at the ends.
    head.fill('M-17 -78C-19 -94 -12 -101 -5 -97Q0 -93 5 -97C12 -101 19 -94 17 -78Z', '#C98B4E');
    head.fill(rect(-17.4, -84, 34.8, 4), '#6B4426');
    head.fill('M-38 -77Q-34 -70 -20 -73Q0 -77 20 -73Q34 -70 38 -77Q36 -82 26 -80Q0 -84 -26 -80Q-36 -82 -38 -77Z', '#B5793F');
  },
  panda(head) {
    // A headband with round panda ears.
    head.fill(circle(-21, -87, 9.5) + circle(21, -87, 9.5), '#2B2B30');
    head.fill(circle(-21, -87, 4.8) + circle(21, -87, 4.8), '#4A4A55');
    head.fill('M-28 -72C-26 -93 26 -93 28 -72L24 -72C22 -88 -22 -88 -24 -72Z', '#2B2B30');
  },
  cupcake(head) {
    // A cupcake: pleated wrapper, pink frosting, sprinkles and a cherry.
    head.fill(poly(-12, -76, 12, -76, 16, -90, -16, -90), '#F3A65A');
    head.fill(rect(-9, -88, 1.4, 11) + rect(-3.5, -88, 1.4, 12) + rect(2, -88, 1.4, 12) + rect(7.5, -88, 1.4, 11), '#D98A3E', 0.8);
    head.fill('M-19 -89C-19 -104 19 -104 19 -89Q0 -85 -19 -89Z', '#FF9ED2');
    head.fill('M-11 -99C-10 -110 10 -110 11 -99Z', '#FFB3DC');
    head.fill(rect(-10, -95, 3, 1.3) + rect(4, -97, 3, 1.3) + rect(-2, -101, 3, 1.3) + rect(9, -92, 3, 1.3), '#7FD8FF');
    head.fill(rect(-14, -92, 3, 1.3) + rect(0, -94, 3, 1.3), '#FFE27A');
    head.fill(circle(0, -110, 3.6), '#E5304B');
    head.fill(circle(-1, -111.2, 1), '#FFFFFF', 0.7);
  },
  horns(head) {
    // Little dragon horns on a purple headband.
    head.fill(both('M-12 -80C-16 -92 -22 -101 -30 -106C-26 -98 -23 -88 -21 -76Z'), '#A98BE3');
    head.fill(both('M-15.5 -86.5L-23.5 -88.5L-23 -86L-16 -84.6Z' + 'M-18.5 -94L-25.5 -97.5L-26 -95L-19.5 -92Z'), '#7E5CC4');
    head.fill('M-28 -72C-26 -92 26 -92 28 -72L24.5 -72C22.5 -87 -22.5 -87 -24.5 -72Z', '#7A4FA0');
  },
  halo(head) {
    // A golden ring floating overhead, softly glowing.
    head.light(ellipse(0, -100, 26, 9.5), '#FFF3B0', 0.35);
    head.fill('M-20 -100a20 6.6 0 1 0 40 0a20 6.6 0 1 0 -40 0Z' + 'M-13.5 -100a13.5 3.2 0 1 1 27 0a13.5 3.2 0 1 1 -27 0Z', '#FFC93C');
    head.fill('M-17.5 -101.8a17.5 5 0 0 1 35 0l-2 0.5a15.5 3.8 0 0 0 -31 0Z', '#FFF0A8', 0.85);
  },
  shells(head) {
    // A seashell tiara strung with pearls.
    head.fill('M-27 -73Q0 -88 27 -73L25.5 -70Q0 -84 -25.5 -70Z', '#F7D9E3');
    shell(head, -15, -79.5, 0.75);
    shell(head, 15, -79.5, 0.75);
    shell(head, 0, -84, 1);
    head.fill(circle(-8, -82.5, 1.8) + circle(8, -82.5, 1.8) + circle(-22, -76, 1.6) + circle(22, -76, 1.6), '#FFFFFF');
  },
  helmet(head) {
    // A space helmet: a glass bubble over the whole head, with a shine and a collar ring.
    head.fill(circle(0, -60, 42), '#CFEAFF', 0.18);
    head.fill(ring(0, -60, 42, 2.6), '#EAF6FF', 0.9);
    head.fill('M-27 -88Q-16 -98 -2 -100Q-14 -94 -22 -84Z', '#FFFFFF', 0.75);
    head.fill(roundRect(-26, -24, 52, 6, 3), '#D5DAE6');
  },
  mushroom(head) {
    // A red toadstool cap with white spots.
    head.fill(ellipse(0, -75, 25, 4), '#F4E8D0');
    head.fill('M-31 -74C-31 -106 31 -106 31 -74Q0 -81 -31 -74Z', '#E5484D');
    head.fill(circle(-15, -86, 4) + circle(3, -93, 4.8) + circle(18, -84, 3.6) + circle(-4, -80, 2.6) + circle(24, -77, 2), '#FFFFFF');
    head.fill(ellipse(-14, -96, 6, 2.4), '#FFFFFF', 0.25);
  },
};

/** A scallop shell, fanned out from (x, y), `k` its size. */
function shell(pen: Pen, x: number, y: number, k: number) {
  pen.fill(place('M0 0L-8 -9Q0 -15 8 -9Z', x, y, k), '#FFB3C7');
  pen.fill(place('M0 0L-4 -11L-2.6 -11.6Z' + 'M0 0L0.7 -12.4L-0.7 -12.4Z' + 'M0 0L4 -11L2.6 -11.6Z', x, y, k), '#F28FAB');
  pen.fill(place('M-3 0.5Q0 -2 3 0.5Q0 2.5 -3 0.5Z', x, y, k), '#F28FAB');
}

/** How high each hat reaches (head units), for the tap box. */
const HAT_TOP: Record<string, number> = {
  party: -120, beanie: -105, flowers: -90, crown: -108, wizard: -124, tophat: -110, snapback: -101, bucket: -99,
  guard: -122, toque: -105, rose: -89, boater: -97, cowboy: -101, panda: -97, cupcake: -114, horns: -106, halo: -106,
  shells: -100, helmet: -102, mushroom: -100, 'lenin-cap': -98, tricorn: -104,
  tiara: -97, hairbow: -92, sunhat: -98,
};

/** How high each species' head reaches without a hat (ears and horns included). */
const HEAD_TOP: Record<Species, number> = {
  cat: -100, dog: -86, bunny: -135, fox: -105, bear: -90, dragon: -104, lion: -92, tiger: -91, cheetah: -87, horse: -104, fish: -96,
};

function bow(pen: Pen, x: number, y: number) {
  pen.fill(place('M0 0L-12 -7Q-14 -0.5 -12 7Z' + 'M0 0L12 -7Q14 -0.5 12 7Z', x, y, 1), '#FF8FB8');
  pen.fill(place('M-2 0L-9.5 -3.5Q-10.5 -0.5 -9.5 3Z' + 'M2 0L9.5 -3.5Q10.5 -0.5 9.5 3Z', x, y, 1), darker('#FF8FB8', 0.12));
  pen.fill(circle(x, y, 3.3), '#FF6FA5');
}

function collar(body: Pen, id: string) {
  if (id === 'red') {
    body.fill('M-15.5 -35Q0 -27 15.5 -35L15.5 -30.5Q0 -22.5 -15.5 -30.5Z', '#E5534B');
    body.fill(circle(0, -24.5, 3.3), '#FFCF4A');
    body.fill(circle(-1, -25.6, 1), '#FFFFFF', 0.8);
  } else if (id === 'bandana') {
    body.fill('M-17 -34Q0 -28.5 17 -34L2.2 -15Q0 -13.2 -2.2 -15Z', '#5B9BE6');
    body.fill(circle(-8, -29, 1.3) + circle(6, -28, 1.3) + circle(-1, -23, 1.3) + circle(1.5, -17.8, 1), '#FFFFFF', 0.9);
  } else if (id === 'bow') {
    bow(body, 0, -29);
  } else if (id === 'gold' || id === 'diamond') {
    chain(body, id === 'gold');
  } else if (id === 'pearls') {
    pearls(body);
  }
}

/** A string of pearls with a bigger one in the middle. */
function pearls(body: Pen) {
  const beads: string[] = [];
  const shine: string[] = [];
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    const x = -16 + 32 * t;
    const y = -34 * (1 - t) ** 2 - 46 * (1 - t) * t - 34 * t * t;
    const r = i === 7 ? 2.4 : 1.7;
    beads.push(circle(x, y + (i === 7 ? 0.8 : 0), r));
    shine.push(circle(x - r * 0.3, y - r * 0.35 + (i === 7 ? 0.8 : 0), r * 0.35));
  }
  body.fill(beads.join(''), '#F4EEE4');
  body.fill(shine.join(''), '#FFFFFF', 0.9);
}

/** A chain round the neck: gold links with a paw medallion, or sparkling stones with a heart. */
function chain(body: Pen, gold: boolean) {
  const links: string[] = [];
  const alt: string[] = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const x = -16 + 32 * t;
    const y = -34 * (1 - t) ** 2 - 48 * (1 - t) * t - 34 * t * t;
    (i % 2 ? alt : links).push(gold ? ellipse(x, y, 1.9, 1.3) : circle(x, y, 1.5));
  }
  if (gold) {
    body.fill(links.join(''), '#F2C14E');
    body.fill(alt.join(''), '#D9A23A');
    body.fill(circle(0, -22, 4.6), '#F7C64A');
    body.fill(circle(0, -22, 3.3), '#E9AE35');
    body.fill(circle(0, -21.2, 1.3) + circle(-1.6, -23.4, 0.65) + circle(0, -24, 0.65) + circle(1.6, -23.4, 0.65), '#FFE7A0');
  } else {
    // Stones catch the light, so they skip the night's tint.
    body.light(links.join(''), '#F2FAFF');
    body.light(alt.join(''), '#BFE6FF');
    body.light(heart(0, -21.5, 4.6), '#D6F0FF');
    body.light('M-2.6 -24.4L0 -20.6L2.6 -24.4Z', '#FFFFFF', 0.85);
  }
}

function glasses(head: Pen, id: string | undefined) {
  if (id === 'round') {
    head.fill(ring(-12.5, -57, 7.4, 1.6) + ring(12.5, -57, 7.4, 1.6) + rect(-5.4, -58.6, 10.8, 1.6) + both(rect(-28.5, -59, 8.6, 1.5)), '#3B3540');
  } else if (id === 'shades') {
    head.fill(both('M-20.5 -61.5H-5.5Q-5 -54 -9 -51.5Q-12.5 -50 -16.5 -51.5Q-21 -54 -20.5 -61.5Z') + rect(-6, -61, 12, 2) + both(rect(-29, -61.2, 9, 1.6)), '#2B2733');
    head.fill(both('M-18 -60H-14.5L-17.5 -53.5Q-18.8 -55.5 -18 -60Z'), '#FFFFFF', 0.35);
  } else if (id === 'heart') {
    head.fill(heart(-12.5, -57.5, 7.6) + heart(12.5, -57.5, 7.6), '#FF6FA5', 0.8);
    head.fill(rect(-5, -59, 10, 1.6) + both(rect(-29, -59.6, 9.4, 1.5)), '#E2508A');
  } else if (id === 'iced') {
    head.fill(both('M-20.5 -61.5H-5.5Q-5 -54 -9 -51.5Q-12.5 -50 -16.5 -51.5Q-21 -54 -20.5 -61.5Z') + rect(-6, -61, 12, 2) + both(rect(-29, -61.2, 9, 1.6)), '#2B2733');
    head.fill(both('M-18 -60H-14.5L-17.5 -53.5Q-18.8 -55.5 -18 -60Z'), '#B9A7FF', 0.5);
    // A row of little studs along the top of the frames.
    const studs: string[] = [];
    for (let x = -19.6; x <= -6.3; x += 2.2) studs.push(circle(x, -62.1, 0.8) + circle(-x, -62.1, 0.8));
    head.light(studs.join('') + circle(0, -60, 0.9), '#F4FBFF');
  }
}

const KICKS: Record<string, { shoe: string; sole: string; trim: string }> = {
  white: { shoe: '#FBFBFC', sole: '#E1E5EB', trim: '#7EC4E6' },
  red: { shoe: '#F25F5C', sole: '#FFFFFF', trim: '#FFFFFF' },
  gold: { shoe: '#F7C64A', sole: '#FFFFFF', trim: '#FFFFFF' },
};

/** Fresh sneakers in place of its paws (or hooves): uppers, a chunky sole, laces and a side stripe. */
function kicks(body: Pen, id: string) {
  const k = KICKS[id];
  if (!k) return;
  body.fill(both('M-19 -2.6C-19 -9.8 -14 -11.6 -9.6 -11.6C-5.2 -11.6 -0.4 -9.8 -0.4 -2.6Z'), k.shoe);
  body.fill(both(ellipse(-9.7, -4.6, 5.6, 2.6)), darker(k.shoe, 0.06));
  body.fill(both(rect(-12.2, -10.2, 5, 1) + rect(-12.2, -8.2, 5, 1)), id === 'white' ? '#C9D3DE' : '#FFFFFF');
  body.fill(both('M-18.2 -5.6Q-13.6 -4.2 -10.4 -7.8L-9.6 -6.9Q-13.4 -2.8 -18.4 -4.4Z'), k.trim);
  body.fill(both(roundRect(-19.8, -3.6, 20.2, 4.4, 2.2)), k.sole);
  body.fill(both(rect(-19, -0.6, 18.6, 1)), darker(k.sole, 0.12));
}

/** Tops it can wear, by colour (the cape is drawn on its own, behind it). */
const OUTFITS: Record<string, string> = {
  sweater: '#8BBDEB',
  hoodie: '#B5A4EE',
  puffer: '#4FC1B0',
  'lenin-suit': '#3A3A46',
  tuxedo: '#2B2733',
  raincoat: '#FFD23F',
  'pirate-coat': '#8E2C3A',
  tutu: '#FFB3C7',
  sundress: '#FFE38A',
  gown: '#F7A8D8',
  fairy: '#BDE8CF',
  cardigan: '#F7B7C8',
  overalls: '#5D86C5',
  jersey: '#E5534B',
};

/** Outfits with their own neckwear, which a collar would cover up (a necklace still goes over it). */
const NECKWEAR = ['lenin-suit', 'tuxedo', 'pirate-coat', 'jersey'];
/** Collars that are necklaces: worn over any outfit but a scarf. */
const NECKLACES = ['pearls', 'gold', 'diamond'];

/** Sleeves in another colour from the rest (a tee under dungarees). */
const SLEEVES: Record<string, string> = { overalls: '#FFD166' };

/** A skirt from the waist, flaring out to `flare` either side, its hem just above the feet. */
function skirt(body: Pen, color: string, flare: number) {
  body.fill(`M-19.6 -15L19.6 -15C${21 + flare * 0.05} -10 ${flare - 1} -6 ${flare} -3Q0 3 ${-flare} -3C${-flare + 1} -6 ${-21 - flare * 0.05} -10 -19.6 -15Z`, color);
  body.fill(`M${-flare} -3Q0 3 ${flare} -3L${flare - 0.4} -1Q0 5 ${-flare + 0.4} -1Z`, darker(color, 0.14));
  body.fill(rect(-9, -13, 1.2, 9) + rect(8, -13, 1.2, 9), darker(color, 0.08), 0.8);
}

/** Little white daisies with yellow middles, at these spots. */
function daisies(body: Pen, spots: readonly (readonly [number, number])[]) {
  body.fill(spots.map(([x, y]) => circle(x - 1.3, y, 1.2) + circle(x + 1.3, y, 1.2) + circle(x, y - 1.3, 1.2) + circle(x, y + 1.3, 1.2)).join(''), '#FFFFFF');
  body.fill(spots.map(([x, y]) => circle(x, y, 0.9)).join(''), '#FFB84D');
}

/** A sundress: daisies all over, and a pink ribbon at the waist. */
function sundress(body: Pen) {
  daisies(body, [[-11, -30], [6, -33], [13, -24], [-3, -24]]);
  body.fill(rect(-19.6, -17.2, 39.2, 2.6), '#FF8FB8');
  body.fill(poly(12, -16, 8.6, -19, 8.6, -13) + poly(12, -16, 15.4, -19, 15.4, -13), '#FF8FB8');
  body.fill(circle(12, -16, 1.2), darker('#FF8FB8', 0.15));
}

/** A princess gown's bodice: a gold-edged neckline with a jewel, and lacing. */
function gown(body: Pen) {
  body.fill('M-15 -35.5Q0 -28 15 -35.5L15 -33Q0 -25.5 -15 -33Z', '#F2C14E');
  body.light(circle(0, -29.4, 1.8), '#8FD3F4');
  body.fill(bar(-3, -26, 3, -21, 0.8) + bar(3, -26, -3, -21, 0.8) + bar(-3, -21, 3, -16.5, 0.8) + bar(3, -21, -3, -16.5, 0.8), '#FFFFFF', 0.8);
  body.fill(rect(-19.6, -17, 39.2, 2.2), '#F2C14E');
}

/** A fairy's wings, behind it: two pairs, see-through, with a shine. */
function fairyWings(body: Pen) {
  const wing = '#E3D7FF';
  body.fill(both('M-8 -30C-24 -54 -47 -52 -45 -37C-43 -27 -26 -25 -10 -26Z'), wing, 0.85);
  body.fill(both('M-8 -22C-22 -21 -37 -13 -33 -4C-29 2 -16 -6 -8 -16Z'), wing, 0.85);
  body.fill(both(ellipse(-32, -41, 6, 3)), '#FFFFFF', 0.55);
  body.fill(both('M-10 -27C-20 -38 -32 -44 -40 -40L-40 -39C-32 -42 -21 -37 -11 -26Z'), '#C9B8FF', 0.6);
}

/** A cardigan open over a white tee, with pearl buttons and pockets. */
function cardigan(body: Pen, top: string) {
  body.fill(poly(-7, -37, 7, -37, 3.4, -11, -3.4, -11), '#FFFFFF');
  body.fill(heart(0, -24, 2.6), '#FF8FB8');
  body.fill(circle(-5, -31, 1) + circle(-4.4, -24, 1) + circle(-3.9, -17, 1), '#FFF8EE');
  body.fill(roundRect(-16, -20, 7.5, 5.5, 1.6) + roundRect(8.5, -20, 7.5, 5.5, 1.6), darker(top, 0.1));
}

/** Denim dungarees over a yellow tee: a bib with a pocket, and straps with gold buttons. */
function overalls(body: Pen, top: string) {
  body.fill('M-19.6 -25C-19 -39 19 -39 19.6 -25L19.6 -20L-19.6 -20Z', '#FFD166');
  body.fill(roundRect(-10, -31, 20, 14, 2), top);
  body.fill(bar(-8, -30, -13.5, -37.4, 2.8) + bar(8, -30, 13.5, -37.4, 2.8), top);
  body.fill(circle(-8, -29.4, 1.3) + circle(8, -29.4, 1.3), '#F2C14E');
  body.fill(roundRect(-5, -26.5, 10, 6, 1.5), darker(top, 0.12));
  body.fill(rect(-0.4, -20, 0.8, 9), darker(top, 0.2), 0.7);
}

/** A football shirt: a white V collar and a big number 10. */
function jersey(body: Pen, top: string) {
  body.fill(poly(-6.5, -37, 6.5, -37, 0, -30), '#FFFFFF');
  body.fill(poly(-4.4, -37, 4.4, -37, 0, -32.4), top);
  body.fill(rect(-8.6, -27, 2.8, 12) + roundRect(-3.4, -27, 10, 12, 4.4), '#FFFFFF');
  body.fill(roundRect(-0.8, -24.4, 4.8, 6.8, 2.2), top);
}

/** The skirt for a dress, drawn over the top of the outfit (after its hem). */
function dressSkirt(body: Pen, outfit: string, top: string) {
  if (outfit === 'sundress') {
    skirt(body, top, 25);
    daisies(body, [[-16, -6], [-6, -9], [5, -5], [15, -8]]);
  } else if (outfit === 'gown') {
    skirt(body, top, 31);
    body.fill('M-8 -15L8 -15L14 -1Q0 2 -14 -1Z', lighter(top, 0.3));
    body.fill('M-31 -3Q0 3 31 -3L30.6 -1Q0 5 -30.6 -1Z', '#F2C14E');
    body.light(star(-18, -7, 1.8, 4, 0.3) + star(19, -9, 1.6, 4, 0.3) + star(4, -6, 1.4, 4, 0.3), '#FFFFFF', 0.9);
  } else if (outfit === 'fairy') {
    // A skirt of pointed petals.
    body.fill('M-19.6 -15L19.6 -15L27 -2L19 -6L13 1L6 -4L0 2L-6 -4L-13 1L-19 -6L-27 -2Z', top);
    body.fill('M-12 -15L12 -15L16 -6L8 -9L0 -3L-8 -9L-16 -6Z', lighter(top, 0.25));
    body.light(star(10, -10, 1.6, 4, 0.3) + star(-12, -9, 1.3, 4, 0.3), '#FFFFFF', 0.9);
  }
}

/** Outfits that come with a skirt. */
const DRESSES = ['sundress', 'gown', 'fairy'];

/** A dark three-piece suit with a white shirt and a red tie. */
function threePieceSuit(body: Pen, top: string) {
  const tie = '#D7263D';
  body.fill(poly(-6.5, -36.6, 6.5, -36.6, 0, -24), '#F4F1EA');
  body.fill(poly(-6.5, -36.6, -12.4, -33, -2.8, -21.6, 0, -24) + poly(6.5, -36.6, 12.4, -33, 2.8, -21.6, 0, -24), lighter(top, 0.12));
  body.fill(poly(-1.3, -32.8, 1.3, -32.8, 2.6, -24.4, 0, -21.4, -2.6, -24.4), tie);
  body.fill(poly(-1.9, -35.6, 1.9, -35.6, 1.3, -32.6, -1.3, -32.6), darker(tie, 0.18));
  body.fill(circle(0, -17.6, 1) + circle(0, -13.4, 1), darker(top, 0.35));
}

/** A tuxedo: satin lapels, a white shirt with studs, and a bow tie. */
function tuxedo(body: Pen, top: string) {
  body.fill(poly(-8, -37, 8, -37, 0, -19.6), '#FFFFFF');
  body.fill(poly(-8, -37, -13.4, -33.4, -3.4, -18.6, 0, -19.6) + poly(8, -37, 13.4, -33.4, 3.4, -18.6, 0, -19.6), lighter(top, 0.14));
  body.fill(circle(0, -29, 0.75) + circle(0, -25.4, 0.75), '#2B2733');
  body.fill(poly(0, -34.6, -6, -37.6, -6, -31.6) + poly(0, -34.6, 6, -37.6, 6, -31.6), '#1E1B22');
  body.fill(roundRect(-1.6, -36, 3.2, 2.8, 1), '#3A3547');
  body.fill(circle(0, -15.4, 1), darker(top, 0.4));
}

/** A yellow raincoat with toggles down the front (and its hood behind the head). */
function raincoat(body: Pen, top: string) {
  body.fill(rect(-0.6, -36, 1.2, 26), darker(top, 0.2));
  body.fill(roundRect(-3.6, -31.4, 7.2, 1.8, 0.9) + roundRect(-3.6, -24.4, 7.2, 1.8, 0.9) + roundRect(-3.6, -17.4, 7.2, 1.8, 0.9), '#6B4426');
  body.fill(rect(-15, -20, 7.6, 1.4) + rect(7.4, -20, 7.6, 1.4), darker(top, 0.18));
  body.fill(ellipse(-11, -31, 3.6, 1.4), '#FFFFFF', 0.35);
}

/** A pirate's coat: gold braid down the front, two rows of buttons, a frilly jabot and a belt. */
function pirateCoat(body: Pen, top: string) {
  body.fill(rect(-3.4, -36, 1.6, 25) + rect(1.8, -36, 1.6, 25), '#F2C14E');
  body.fill(both(circle(-7.4, -29.6, 1.2) + circle(-7.4, -23.6, 1.2)), '#F2C14E');
  body.fill(circle(0, -35.4, 2.6) + circle(-1.6, -32.2, 2.2) + circle(1.6, -32.2, 2.2) + circle(0, -29.2, 2), '#F4F1EA');
  body.fill(rect(-19.6, -17.6, 39.2, 3.4), '#2B2733');
  body.fill(roundRect(-3, -18.4, 6, 5, 1), '#F2C14E');
  body.fill(rect(-1.6, -17, 3.2, 2.2), '#2B2733');
}

/** A ballet tutu's net skirt, layered and scalloped, over the leotard. */
function tutuSkirt(body: Pen, top: string) {
  const net = lighter(top, 0.35);
  const frill = (y: number, rx: number) => {
    const bumps: string[] = [ellipse(0, y, rx, 4.4)];
    for (let x = -rx + 3; x <= rx - 3; x += 5.4) bumps.push(circle(x, y + 3.2 - Math.abs(x / rx) * 2.2, 3));
    return bumps.join('');
  };
  body.fill(frill(-10.6, 27), net);
  body.fill(frill(-12.2, 23), lighter(top, 0.15));
  body.fill(ellipse(0, -14.4, 20, 2), darker(top, 0.12));
}

/** Draws the pet in front of you with its feet at (x, feet), `s` its size, `hb` a young one's bigger head. */
function drawPet(art: Art, x: number, feet: number, s: number, hb: number, look: Look) {
  const { body, head } = pens(art, x, feet, s, hb);
  const { main, belly, tips } = look.coat;

  if (look.outfit === 'cape') {
    wearing(body, look, 'outfit', () => body.fill('M-14 -37L14 -37C24 -25 30 -11 34 -1Q0 5 -34 -1C-30 -11 -24 -25 -14 -37Z', '#E5534B'));
  }
  if (look.outfit === 'fairy') wearing(body, look, 'outfit', () => fairyWings(body), OUTFITS.fairy);
  if (look.species === 'dragon') {
    body.fill(both('M-14 -30C-30 -50 -48 -44 -50 -30C-45 -32 -43 -26 -39 -24C-37 -28 -32 -27 -30 -21C-27 -25 -21 -24 -16 -20Z'), tips);
  }

  // Body, with a soft shadow under the chin.
  body.fill(ellipse(0, -19, 20, 19.5), main);
  bodyMarks(body, look);
  body.fill(ellipse(0, -35, 15, 4.5), darker(main, 0.14), 0.7);
  const top = look.outfit ? OUTFITS[look.outfit] : undefined;
  if (top) {
    wearing(body, look, 'outfit', () => {
      body.fill('M-19.6 -25C-19 -39 19 -39 19.6 -25L19.6 -11Q0 -4 -19.6 -11Z', top);
      if (look.outfit === 'sweater') {
        body.fill('M-19.8 -19L19.8 -19L19.8 -15.5L-19.8 -15.5Z', '#FFF4E6');
        body.fill(heart(0, -27, 3.6), '#FF8FB8');
      } else if (look.outfit === 'hoodie') {
        body.fill(roundRect(-10.5, -19, 21, 8.5, 3.5), darker(top, 0.1));
        body.fill(rect(-4.2, -33, 1.2, 9) + rect(3, -33, 1.2, 9) + circle(-3.6, -23.6, 1.2) + circle(3.6, -23.6, 1.2), '#FFFFFF');
      } else if (look.outfit === 'lenin-suit') {
        threePieceSuit(body, top);
      } else if (look.outfit === 'tuxedo') {
        tuxedo(body, top);
      } else if (look.outfit === 'raincoat') {
        raincoat(body, top);
      } else if (look.outfit === 'pirate-coat') {
        pirateCoat(body, top);
      } else if (look.outfit === 'tutu') {
        body.light(star(0, -28, 2.4, 4, 0.3), '#FFFFFF', 0.9);
      } else if (look.outfit === 'sundress') {
        sundress(body);
      } else if (look.outfit === 'gown') {
        gown(body);
      } else if (look.outfit === 'fairy') {
        body.light(star(0, -29, 2, 4, 0.3), '#FFFFFF', 0.9);
      } else if (look.outfit === 'cardigan') {
        cardigan(body, top);
      } else if (look.outfit === 'overalls') {
        overalls(body, top);
      } else if (look.outfit === 'jersey') {
        jersey(body, top);
      } else {
        // A puffer: quilted rows with a shine on each, and a zip.
        body.fill(rect(-19.6, -27.6, 39.2, 1.1) + rect(-19.6, -19.6, 39.2, 1.1), darker(top, 0.16));
        body.fill(both(ellipse(-10, -31.5, 5.5, 1.4) + ellipse(-11, -23.6, 5.5, 1.4) + ellipse(-11, -15.6, 5.5, 1.4)), lighter(top, 0.35), 0.7);
        body.fill(rect(-0.6, -35, 1.2, 26), darker(top, 0.22));
      }
      body.fill('M-19.6 -11Q0 -4 19.6 -11L19.4 -8Q0 -1 -19.4 -8Z', darker(top, 0.12));
      if (look.outfit === 'tutu') tutuSkirt(body, top);
      if (look.outfit && DRESSES.includes(look.outfit)) dressSkirt(body, look.outfit, top);
    }, top);
  } else {
    body.fill(ellipse(0, -15, 12.5, 12.5), belly);
    if (look.species === 'dragon') body.fill(rect(-9.5, -21, 19, 1.3) + rect(-11.5, -15, 23, 1.3) + rect(-10, -9, 20, 1.3), darker(belly, 0.12));
    if (look.marks === 'spots') body.fill(circle(-15, -28, 2) + circle(13.5, -25, 2.2) + circle(-16.5, -15, 1.8) + circle(16, -12.5, 1.7), look.coat.mark);
    if (look.marks === 'patches') body.fill(ellipse(-9.5, -24, 7.5, 6.5), patchColors(look.coat)[0]);
  }

  const shoes = look.kicks && KICKS[look.kicks] ? look.kicks : null;
  if (shoes) wearing(body, look, 'kicks', () => kicks(body, shoes));
  else {
    const paws = look.marks === 'socks' ? SOCK : look.marks === 'fox' ? tips : main;
    body.fill(ellipse(-9.5, -3.6, 8.5, 5.6) + ellipse(9.5, -3.6, 8.5, 5.6), paws);
    if (look.species === 'horse') body.fill(both('M-17.8 -3.4Q-9.5 -1 -1.2 -3.4Q-1.6 1.8 -9.5 2.1Q-17.4 1.8 -17.8 -3.4Z'), tips);
    else body.fill(rect(-12.2, -5.5, 0.9, 3.2) + rect(-8.2, -5.5, 0.9, 3.2) + rect(7.3, -5.5, 0.9, 3.2) + rect(11.3, -5.5, 0.9, 3.2), darker(paws, 0.2), 0.7);
  }
  if (top) {
    const puffy = look.outfit === 'puffer';
    wearing(body, look, 'outfit', () => {
      const sleeve = SLEEVES[look.outfit!] ?? top;
      body.fill(both(ellipse(-17, -18.5, puffy ? 7 : 6.2, puffy ? 8 : 7.4)), sleeve);
      if (puffy) body.fill(both(rect(-23.6, -19.2, 13.2, 1)), darker(top, 0.16));
      if (look.outfit === 'gown') body.fill(both(circle(-17, -24, 6.4)), lighter(top, 0.2));
      if (look.outfit === 'jersey') body.fill(both(rect(-23, -18.6, 12.2, 1.6)), '#FFFFFF');
    }, top);
    body.fill(circle(-17, -11.5, 4.8) + circle(17, -11.5, 4.8), look.marks === 'socks' ? SOCK : main);
  } else {
    body.fill(ellipse(-17, -17, 6, 8.6) + ellipse(17, -17, 6, 8.6), main);
    armMarks(body, look);
  }

  // Head (a hoodie's hood lies behind it).
  if (top && (look.outfit === 'hoodie' || look.outfit === 'raincoat')) {
    wearing(body, look, 'outfit', () => body.fill('M-22 -30C-29 -38 -23 -47 0 -47C23 -47 29 -38 22 -30Q0 -24 -22 -30Z', darker(top, 0.08)), top);
  }
  if (look.species === 'lion') maneBack(head, look);
  if (look.species === 'horse') horseManeBack(head, look);
  backEars(head, look);
  head.fill(look.species === 'horse' ? ellipse(0, -59.5, 30, 27.5) : ellipse(0, -58, 31, 26), main);
  if (look.species === 'dog') {
    head.fill(both('M-22 -79C-36 -80 -42 -62 -39 -47C-37.5 -40 -30 -41 -28.5 -48C-27 -57 -23 -66 -18 -75Z'), tips);
  }
  head.fill(ellipse(-12, -74, 9, 4.2), '#FFFFFF', 0.22);
  face(head, look);
  specks(body, head, look.coat);

  // Things to wear.
  // A collar stays off under a scarf, or an outfit with its own neckwear (a tie, a bow tie, a jabot);
  // a necklace goes over those outfits all the same.
  const hidden =
    look.outfit === 'scarf' ||
    (!!look.outfit && NECKWEAR.includes(look.outfit) && !NECKLACES.includes(look.collar ?? ''));
  const worn = look.collar && look.collar !== 'none' && !hidden ? look.collar : null;
  if (worn) wearing(body, look, 'collar', () => collar(body, worn));
  if (look.outfit === 'scarf') wearing(body, look, 'outfit', () => {
    body.fill('M-18 -37Q0 -27 18 -37L18 -30Q0 -20 -18 -30Z', '#FF9E7A');
    body.fill(roundRect(7, -31, 8.5, 21, 3.5), '#FF9E7A');
    body.fill(rect(-10, -33.5, 3, 7) + rect(-1.5, -31.5, 3, 7) + rect(7, -33, 3, 6.6) + rect(7, -22, 8.5, 2.8), '#FFF3E0');
    body.fill(rect(7.5, -10.4, 1.4, 3) + rect(10.5, -10.4, 1.4, 3) + rect(13.5, -10.4, 1.4, 3), '#FF9E7A');
  }, '#FF9E7A');
  wearing(head, look, 'glasses', () => glasses(head, look.glasses));
  const hat = look.hat && look.hat !== 'none' ? HATS[look.hat] : undefined;
  if (hat) wearing(head, look, 'hat', () => hat(head));
}

// ---------- A fish in a bowl ----------

/** Bowl geometry (body units): the centre, its radius, the rim and the water line. */
const BOWL = { y: -62, r: 37, rim: -94, water: -86 } as const;
const chord = (y: number) => Math.sqrt(BOWL.r ** 2 - (y - BOWL.y) ** 2);

/** The stool and the back of the bowl: glass, water, pebbles and weed. */
function bowlBack(body: Pen) {
  body.fill(roundRect(-21, -24, 5, 24, 2) + roundRect(16, -24, 5, 24, 2), '#B97F48');
  body.fill(rect(-18, -11, 36, 3), '#A9713E');
  body.fill(roundRect(-28, -28, 56, 7.5, 3.6), '#D9A066');
  body.fill(roundRect(-26, -27.4, 52, 2.4, 1.2), '#E9BC86');
  const rx = chord(BOWL.rim);
  body.fill(`M${-rx} ${BOWL.rim}A${BOWL.r} ${BOWL.r} 0 1 0 ${rx} ${BOWL.rim}Z`, '#E8F7FD', 0.35);
  const wx = chord(BOWL.water);
  body.fill(`M${-wx} ${BOWL.water}A${BOWL.r} ${BOWL.r} 0 1 0 ${wx} ${BOWL.water}Z`, '#86D0F0', 0.8);
  body.fill(ellipse(0, BOWL.water, wx, 3.2), '#BDE8F8');
  body.fill('M-22 -31C-27 -42 -19 -48 -23 -60C-19 -51 -16 -44 -18 -31Z' + 'M-15 -30C-18 -38 -13 -42 -15 -50C-12 -43 -10 -38 -11.5 -30Z', '#5DBF7A');
  body.fill('M20 -31C24 -40 18 -46 21 -55C17 -47 15 -41 16.5 -31Z', '#79D18F');
  body.fill(circle(-12, -30.6, 2.6) + circle(9, -30.2, 2.4), '#FFB3C8');
  body.fill(circle(-5, -29.4, 2.6) + circle(15, -31.5, 2.2), '#B9E4C9');
  body.fill(circle(2, -29.6, 2.5) + circle(-17.5, -32, 2), '#D4C2F2');
}

/** The rim and the shine on the glass, in front of the fish. */
function bowlFront(body: Pen) {
  const rx = chord(BOWL.rim);
  body.fill(ellipse(0, BOWL.rim, rx, 3.4) + ellipse(0, BOWL.rim, rx - 2.6, 1.8), '#D4F1FB', 0.9);
  const arc = (r: number, deg: number) => {
    const t = (deg * Math.PI) / 180;
    return [Math.cos(t) * r, BOWL.y + Math.sin(t) * r] as const;
  };
  const [ax, ay] = arc(33, 205);
  const [bx, by] = arc(33, 150);
  const [cx, cy] = arc(29.5, 150);
  const [dx, dy] = arc(29.5, 205);
  body.fill(`M${ax} ${ay}A33 33 0 0 0 ${bx} ${by}L${cx} ${cy}A29.5 29.5 0 0 1 ${dx} ${dy}Z`, '#FFFFFF', 0.5);
  body.fill(circle(23, -80, 2.4) + circle(27, -74, 1.2), '#FFFFFF', 0.6);
}

/** A round goldfish facing you: its body is its head, with fins at its sides and a flowing tail. */
function drawFish(head: Pen, look: Look) {
  const { main, belly, tips } = look.coat;
  const fins = look.marks === 'socks' ? SOCK : tips;
  // A flowing tail fanned out behind on the right, a fin on top and two little side fins.
  head.fill('M18 -60C28 -70 38 -82 48 -80C44 -72 42 -66 40 -60C42 -54 44 -48 48 -38C38 -38 28 -48 18 -54Z', fins, 0.95);
  head.fill('M30 -66C36 -72 41 -77 45 -78L44.4 -76C40 -74 36 -70 31 -64.6Z' + 'M31 -52C36 -48 40 -44 45 -40.6L44.2 -39C39 -42 35 -46 30.4 -50.4Z', lighter(fins, 0.3), 0.7);
  head.fill('M-10 -81C-8 -94 6 -97 12 -89C7 -86 2 -83 -2 -81Z', fins, 0.95);
  head.fill(both('M-25 -52C-33 -52 -37 -46 -35 -40C-31 -42 -28 -45 -24.4 -46Z'), fins, 0.95);
  head.fill(ellipse(0, -58, 28, 25), main);
  if (look.marks === 'stripes') {
    head.fill(both('M-27 -67Q-21.5 -58 -26.8 -48.5L-23.4 -46.6Q-17.6 -58 -24.2 -70Z') + 'M-5 -82.6Q0 -76 5 -82.6L3.4 -79Q0 -74.2 -3.4 -79Z', look.coat.mark);
  } else if (look.marks === 'spots') {
    head.fill(circle(-21, -70, 2.2) + circle(21, -69, 2) + circle(-24, -52, 1.8) + circle(24.5, -50.5, 1.6) + circle(-4, -77, 1.6) + circle(6, -79, 1.9), look.coat.mark);
  } else if (look.marks === 'patches') {
    const [a, b] = patchColors(look.coat);
    head.fill(ellipse(-2, -76.5, 12, 5.4), a);
    head.fill(ellipse(19.5, -46, 6.4, 5), b);
  }
  head.fill(ellipse(0, -44.5, 17, 9.5), belly);
  head.fill('M-12 -77Q-8 -73 -4 -77Q-8 -74.6 -12 -77Z' + 'M4 -79Q8 -75 12 -79Q8 -76.6 4 -79Z', lighter(main, 0.25), 0.8);
  head.fill(ellipse(-12, -73, 8, 3.6), '#FFFFFF', 0.25);
  eyes(head, look);
  head.fill(ellipse(-21, -49.5, 4.6, 2.8) + ellipse(21, -49.5, 4.6, 2.8), BLUSH, 0.5);
  head.fill(ellipse(0, -46.2, 3, 2.6), '#E2607A');
  head.fill(ellipse(0, -45.8, 1.5, 1.3), '#9E3550');
  specks(head, head, look.coat, true);
  // A fish's bow sits on its head, where a hair bow would go: just the one.
  if (look.collar === 'bow' && look.hat !== 'hairbow') wearing(head, look, 'collar', () => bow(head, 17, -78));
  wearing(head, look, 'glasses', () => glasses(head, look.glasses));
  const hat = look.hat && look.hat !== 'none' ? HATS[look.hat] : undefined;
  if (hat) wearing(head, look, 'hat', () => hat(head));
}

// ---------- The second pet (a little one, asleep in the bed) ----------

function drawChick(art: Art, x: number, feet: number, s: number) {
  const pen = new Pen(art, x, feet, s);
  pen.fill(ellipse(0, -20, 19, 19), '#FFE066');
  pen.fill(ellipse(0, -13, 12, 10), '#FFF2A8');
  pen.fill(both('M-17 -22C-25 -20 -24 -10 -16 -11Z'), '#F5CF45');
  pen.fill(both('M-2 -40C-4 -46 0 -48 1 -41Z'), '#F5CF45');
  pen.fill(both('M-11 -24.5Q-7.5 -21 -4 -24.5Q-7.5 -22.6 -11 -24.5Z'), INK);
  pen.fill('M-3.4 -20L3.4 -20L0 -15.6Z', '#FF9F43');
  pen.fill(ellipse(-12, -17, 3.6, 2.2) + ellipse(12, -17, 3.6, 2.2), BLUSH, 0.5);
}

function drawFriend(art: Art, id: string, [x, bedY, k]: Spot) {
  const feet = bedY - 7 * k;
  if (id === 'chick') {
    drawChick(art, x, feet, 0.5 * k);
    return;
  }
  const species: Species = id === 'puppy' ? 'dog' : id === 'bunny' ? 'bunny' : 'cat';
  const s = 0.36 * k;
  const look: Look = { species, coat: coatFor(species, undefined), marks: marksFor(species, 'natural'), eyes: 'brown', stage: 0, sleepy: true };
  tail(pens(art, x, feet, s, 1.16).body, look);
  drawPet(art, x, feet, s, 1.16, look);
  // Zz.
  const z = (zx: number, zy: number, k: number) => place('M0 0H7L1.8 6H7V7.6H-0.6L4.6 1.6H0Z', zx, zy, k);
  art.light(z(x + 14 * k, feet - 52 * k, 0.9 * k) + z(x + 23 * k, feet - 62 * k, 0.65 * k), '#FFFFFF', 0.85);
}

// ---------- The yard ----------

function backyard(art: Art) {
  drawHills(art);
  drawLawn(art);
  // A picket fence along the back.
  art.fill(rect(0, 151, 360, 3.6) + rect(0, 162, 360, 3.6), '#E7D5BA');
  const pickets: string[] = [];
  const shade: string[] = [];
  for (let x = -2; x < 362; x += 13) {
    pickets.push(poly(x, 172, x, 147, x + 4, 142.5, x + 8, 147, x + 8, 172));
    shade.push(rect(x + 6, 147.5, 2, 24.5));
  }
  art.fill(pickets.join(''), '#FFF5E4');
  art.fill(shade.join(''), '#EEDFC6');
  // String lights along the top, lit after dark.
  const bulbs: Record<string, string[]> = {};
  const glows: Record<string, string[]> = {};
  const colors = ['#FFD36E', '#FF9EC4', '#9FE3FF'];
  let wire = 'M0 144';
  let back = '';
  for (let x = 0; x < 360; x += 26) {
    wire += `Q${x + 13} 153 ${x + 26} 144`;
    back = `Q${x + 13} 154.2 ${x} 145.2` + back;
    const color = colors[(x / 26) % 3]!;
    (bulbs[color] ??= []).push(circle(x + 13, 150.6, 2));
    (glows[color] ??= []).push(circle(x + 13, 150.6, 5));
  }
  art.fill(`${wire}L360 145.2${back}Z`, '#6B5B4E', 0.7);
  for (const [color, d] of Object.entries(bulbs)) {
    if (art.dark) {
      art.light(glows[color]!.join(''), color, 0.25);
      art.light(d.join(''), color);
    } else art.fill(d.join(''), color, 0.9);
  }
  // Bushes in front of the fence, with a few flowers.
  art.fill(puff(28, 168, 54, 24) + puff(214, 167, 44, 19), '#6DB565');
  art.fill(circle(14, 166, 2.2) + circle(34, 160, 2.2) + circle(44, 170, 2.2) + circle(205, 162, 2) + circle(224, 167, 2), '#FF9EC4');
}

function beach(art: Art) {
  art.fill(rect(0, 124, 360, 60), '#5EC3E8');
  art.fill(rect(0, 124, 360, 7), '#93DAF3');
  art.fill(
    ellipse(60, 142, 10, 1.2) + ellipse(190, 136, 12, 1.2) + ellipse(300, 148, 9, 1.2) + ellipse(120, 156, 11, 1.2) + ellipse(250, 160, 10, 1.2),
    '#FFFFFF',
    0.7
  );
  // A sailboat far out.
  art.fill(poly(240, 122, 252, 122, 249, 126, 243, 126), '#E8E2D6');
  art.fill(poly(246, 121, 246, 106, 254, 121), '#FFFFFF');
  art.fill(`M0 170C80 160 200 172 360 162V270H0Z`, '#F6E0AE');
  art.fill(`M0 170C80 160 200 172 360 162V167C200 177 80 165 0 175Z`, '#E8CC90');
  art.fill(`M0 169C80 159 200 171 360 161V163C200 173 80 161 0 171Z`, '#FFFFFF', 0.8);
  // A palm tree leaning in from the right.
  const palm = (d: string) => place(d, 362, 0, -1, 1);
  art.fill(palm('M18 190C20 160 26 136 38 116L42 118C32 138 27 162 26 190Z'), '#B58457');
  art.fill(palm(rect(22, 170, 5, 1.6) + rect(25, 152, 5, 1.6) + rect(29, 136, 5, 1.6)), darker('#B58457', 0.15));
  art.fill(
    palm(
      'M40 116C30 104 14 104 4 112C16 108 28 110 38 118Z' +
        'M40 116C50 102 66 100 78 106C64 106 52 110 42 119Z' +
        'M40 116C36 100 40 90 50 84C44 94 42 104 43 116Z' +
        'M40 116C26 114 18 124 16 134C24 124 32 120 40 119Z' +
        'M40 116C54 112 66 120 70 132C60 122 50 120 41 119Z'
    ),
    '#59B26A'
  );
  art.fill(palm(circle(38, 120, 3.4) + circle(43.5, 121, 3.2)), '#7A5432');
  // Shells and a starfish.
  art.fill(star(108, 262, 6.5, 5, 0.5), '#FF9E7A');
  art.fill(ellipse(250, 266, 4, 2.6) + ellipse(28, 258, 3.4, 2.2), '#FFD6E0');
}

function snowy(art: Art) {
  drawHills(art, '#E9F0F8', '#D8E5F3');
  const pine = (x: number, base: number, h: number) => {
    art.fill(poly(x - h * 0.3, base, x, base - h, x + h * 0.3, base) + poly(x - h * 0.24, base - h * 0.4, x, base - h * 1.15, x + h * 0.24, base - h * 0.4), '#4E8C6E');
    art.fill(poly(x - h * 0.1, base - h * 0.78, x, base - h * 1.15, x + h * 0.1, base - h * 0.78) + poly(x - h * 0.13, base - h * 0.3, x, base - h * 0.62, x + h * 0.13, base - h * 0.3), '#FFFFFF');
  };
  pine(22, 148, 34);
  pine(48, 150, 26);
  pine(236, 146, 30);
  pine(258, 149, 22);
  pine(340, 150, 32);
  drawLawn(art, '#F4F8FC');
  // A snowman on the right.
  const snowman = new Pen(art, 294, 0, 1);
  snowman.fill(circle(36, 184, 13) + circle(36, 164, 9.5), '#FFFFFF');
  snowman.fill(ellipse(40, 186, 6, 9) + ellipse(39, 166, 4, 6.5), '#DCE7F3', 0.7);
  snowman.fill(circle(33, 162, 1.3) + circle(39, 162, 1.3) + circle(36, 180, 1.3) + circle(36, 186, 1.3), '#3A3A44');
  snowman.fill(poly(36, 165, 46, 167, 36, 168), '#FF8A3D');
  snowman.fill(roundRect(26, 170, 20, 4.5, 2) + rect(39, 172, 4.4, 10), '#E5534B');
  snowman.fill(roundRect(28, 149, 16, 7, 2) + rect(24, 155, 24, 2.6), '#3A3547');
  const flakes: string[] = [];
  for (let i = 0; i < 26; i++) flakes.push(circle(art.between(4, 356), art.between(8, 140), art.between(0.8, 1.7)));
  art.fill(flakes.join(''), '#FFFFFF', 0.85);
}

function meadow(art: Art) {
  drawHills(art, '#BFE3A8', '#9FD18E');
  art.fill(puff(64, 128, 34, 18) + puff(300, 124, 38, 20) + puff(330, 132, 26, 14), '#7FBF6E');
  drawLawn(art, '#86C774');
  const colors = ['#FF9EC4', '#FFE27A', '#FFFFFF', '#C9A8FF', '#FFB38A'];
  const petals: Record<string, string[]> = {};
  const centres: string[] = [];
  for (let i = 0; i < 46; i++) {
    const x = art.between(6, 354);
    const y = art.between(174, 266);
    const r = 1.5 + (y - 170) / 60;
    const color = colors[i % colors.length]!;
    (petals[color] ??= []).push(circle(x - r, y, r) + circle(x + r, y, r) + circle(x, y - r, r) + circle(x, y + r, r));
    centres.push(circle(x, y, r * 0.7));
  }
  for (const [color, d] of Object.entries(petals)) art.fill(d.join(''), color);
  art.fill(centres.join(''), '#FFB84D');
}

const YARDS: Record<string, (art: Art) => void> = { backyard, beach, snowy, meadow };

// ---------- Things around the pet ----------

/** Where something goes and how big: [x, y, scale]. */
type Spot = readonly [number, number, number];
type Layout = Record<
  'kennel' | 'bed' | 'bowl' | 'toy' | 'buddy' | 'butterfly' | 'fun' | 'balloon' | 'season' | 'keepsake' | 'guest' | 'flag' | 'fun2',
  Spot
> & {
  kites: readonly (readonly [number, number])[];
};

const SMALL: Layout = {
  kennel: [52, 196, 1],
  bed: [298, 251, 1],
  bowl: [216, 253, 1.15],
  toy: [66, 253, 1.2],
  buddy: [34, 234, 1.15],
  butterfly: [242, 128, 1],
  fun: [250, 195, 1],
  fun2: [66, 232, 0.72],
  balloon: [196, 66, 1],
  season: [334, 204, 0.9],
  keepsake: [100, 192, 0.85],
  guest: [252, 244, 0.9],
  flag: [318, 188, 1],
  kites: [[222, 214], [112, 178]],
};
const GROWN: Layout = {
  kennel: [44, 192, 0.86],
  bed: [300, 254, 0.92],
  bowl: [236, 258, 1.1],
  toy: [62, 258, 1.15],
  buddy: [26, 240, 1.08],
  butterfly: [262, 112, 1],
  fun: [272, 192, 0.86],
  fun2: [60, 236, 0.66],
  balloon: [306, 100, 1],
  season: [338, 206, 0.84],
  keepsake: [88, 188, 0.76],
  guest: [262, 248, 0.84],
  flag: [320, 188, 0.95],
  kites: [[226, 214], [104, 178]],
};
const BIG: Layout = {
  kennel: [36, 188, 0.76],
  bed: [308, 256, 0.84],
  bowl: [258, 264, 1],
  toy: [58, 262, 1.1],
  buddy: [22, 244, 1],
  butterfly: [278, 100, 1],
  fun: [290, 186, 0.74],
  fun2: [56, 238, 0.6],
  balloon: [306, 100, 1],
  season: [342, 208, 0.78],
  // At the pool's edge: anywhere nearer the middle, a legend's mane or wings would hide it.
  keepsake: [252, 194, 0.6],
  guest: [282, 252, 0.78],
  flag: [322, 186, 0.9],
  kites: [[230, 214], [100, 178]],
};
/** The yard's things move out to the edges and shrink a little as the pet shoots up. */
const LAYOUT: readonly Layout[] = [SMALL, SMALL, SMALL, GROWN, BIG, BIG];


const KENNELS: Record<string, string> = { red: '#EF7B73', blue: '#7FB2E5', pink: '#F7A8C4' };
const BOWLS: Record<string, string> = { red: '#F07167', blue: '#6FA8E8', yellow: '#FFD166' };

function kennel(art: Art, color: string, spot: Spot) {
  const pen = new Pen(art, ...spot);
  pen.fill(ellipse(0, 0, 36, 4), '#000000', 0.12);
  pen.fill(poly(-27, 0, -27, -34, 0, -56, 27, -34, 27, 0), color);
  pen.fill(rect(-27, -12, 54, 1.3) + rect(-27, -23, 54, 1.3), darker(color, 0.12));
  pen.fill(poly(9, 0, 9, -48, 27, -34, 27, 0), darker(color, 0.08), 0.6);
  pen.fill('M-36 -31L0 -64L36 -31L31 -27L0 -55L-31 -27Z', darker(color, 0.3));
  pen.fill('M-36 -31L0 -64L2 -62L-33 -29Z', lighter(color, 0.25), 0.6);
  pen.fill('M-12 0V-17A12 12 0 0 1 12 -17V0Z', '#4A3530');
  pen.fill(roundRect(-9, -45, 18, 7.5, 2.5), '#FFF4E0');
  pen.fill(heart(0, -41.2, 2.6), '#FF6F8E');
}

/** A window: sky-blue glass by day, warm light after dark. */
function pane(pen: Pen, d: string) {
  if (pen.art.dark) {
    pen.light(d, '#FFE29A');
  } else pen.fill(d, '#A9DDF7');
}

/** A little cottage with a chimney, a round door and a window box. */
function cottage(art: Art, spot: Spot) {
  const pen = new Pen(art, ...spot);
  const wall = '#FFF1DA';
  const roof = '#E0795B';
  pen.fill(ellipse(0, 0, 38, 4), '#000000', 0.12);
  pen.fill(rect(13, -64, 8, 18) + rect(12, -67, 10, 3.4), '#C0705A');
  pen.fill(rect(-26, -36, 52, 36), wall);
  pen.fill(rect(12, -36, 14, 36), darker(wall, 0.05));
  pen.fill('M-33 -33L0 -62L33 -33L28 -30L0 -55L-28 -30Z', roof);
  pen.fill('M-28 -30L0 -55L28 -30Z', darker(wall, 0.06));
  pen.fill('M-33 -33L0 -62L2 -60L-30 -31Z', lighter(roof, 0.25), 0.7);
  pen.fill(rect(-26, -36, 52, 2.4), darker(wall, 0.12));
  pen.fill('M-8 0V-15A8 8 0 0 1 8 -15V0Z', '#8A5A3B');
  pen.fill(circle(4.6, -8, 1.1), '#F2C14E');
  pen.fill(roundRect(-23, -29, 12, 11, 2) + roundRect(12, -29, 12, 11, 2), '#FFFFFF');
  pane(pen, rect(-21.4, -27.4, 8.8, 7.8) + rect(13.6, -27.4, 8.8, 7.8));
  pen.fill(rect(-17.5, -27.4, 1, 7.8) + rect(17.5, -27.4, 1, 7.8), '#FFFFFF');
  pen.fill(rect(-24, -18.6, 14, 3.4), '#9A6B45');
  pen.fill(circle(-21, -19.6, 2) + circle(-17, -20.4, 2.2) + circle(-13, -19.6, 2), '#FF8FA3');
  pen.fill(ellipse(-0.5, -46, 4.8, 4.8), '#FFFFFF', 0.85);
  pen.fill(heart(-0.5, -45.6, 2.4), '#FF6F8E');
}

/** A treehouse: a little hut on a platform up a tree, with a ladder down the trunk. */
function treehouse(art: Art, spot: Spot) {
  const pen = new Pen(art, ...spot);
  const leaves = '#6DB565';
  const wood = '#B07A4F';
  pen.fill(ellipse(0, 0, 44, 4.6), '#000000', 0.12);
  pen.fill(puff(-2, -104, 96, 52) + circle(-36, -88, 16) + circle(34, -84, 15), leaves);
  pen.fill(circle(-18, -120, 14) + circle(12, -124, 13), lighter(leaves, 0.12));
  pen.fill('M-9 0C-6 -24 -6 -52 -8 -74H8C6 -52 6 -24 9 0Z' + 'M-9 0C-14 0 -18 2 -20 4L-6 3Z' + 'M9 0C14 0 18 2 20 4L6 3Z', '#9A6B45');
  pen.fill(rect(-32, -76, 64, 5), wood);
  pen.fill(rect(-32, -72, 64, 1.4), darker(wood, 0.2));
  pen.fill(rect(-31, -86, 1.6, 10) + rect(29.4, -86, 1.6, 10) + rect(-31, -86, 62, 1.6), darker(wood, 0.1));
  pen.fill(rect(-20, -104, 40, 28), '#E9C89B');
  pen.fill(rect(-20, -96, 40, 1) + rect(-20, -88, 40, 1) + rect(-20, -80, 40, 1), darker('#E9C89B', 0.12));
  pen.fill('M-26 -101L0 -122L26 -101L22 -98L0 -116L-22 -98Z', '#E5734F');
  pen.fill('M-22 -98L0 -116L22 -98V-104H-22Z', '#E9C89B');
  pane(pen, circle(0, -102, 5.6));
  pen.fill(ring(0, -102, 5.6, 1.4), '#FFFFFF');
  pane(pen, rect(-14, -91, 9, 9));
  pen.fill('M4 -76V-89A5 5 0 0 1 14 -89V-76Z', '#8A5A3B');
  // The ladder.
  const rungs: string[] = [rect(-6.4, -76, 1.6, 76), rect(4.8, -76, 1.6, 76)];
  for (let y = -68; y < 0; y += 9) rungs.push(rect(-6.4, y, 12.8, 1.6));
  pen.fill(rungs.join(''), '#7A5236');
}

/** A striped play tent with a pennant on top, its door tied open (lit up inside after dark). */
function tent(art: Art, spot: Spot) {
  const pen = new Pen(art, ...spot);
  const canvas = '#FFF1DA';
  const stripe = '#FF8FA3';
  pen.fill(ellipse(0, 0, 38, 4), '#000000', 0.12);
  // The poles, crossing where they poke out at the top.
  pen.fill(poly(-1.4, -56, -7.6, -66, -6, -67, 0.4, -57) + poly(1.4, -56, 7.6, -66, 6, -67, -0.4, -57), '#9A6B45');
  const wedges: Record<string, string[]> = { [canvas]: [], [stripe]: [] };
  for (let i = 0; i < 6; i++) wedges[i % 2 ? stripe : canvas]!.push(poly(-31 + i * 10.33, 0, 0, -58, -31 + (i + 1) * 10.33, 0));
  for (const [color, d] of Object.entries(wedges)) pen.fill(d.join(''), color);
  pen.fill(poly(0, -58, 31, 0, 9, 0), '#000000', 0.06);
  // The doorway, and its flaps tied back.
  const door = poly(-10, 0, 0, -27, 10, 0);
  if (art.dark) pen.light(door, '#FFD98A');
  else pen.fill(door, '#4A3530');
  pen.fill(poly(-10, 0, 0, -27, -15, -6) + poly(10, 0, 0, -27, 15, -6), lighter(stripe, 0.25));
  pen.fill(circle(-13, -6.4, 1.5) + circle(13, -6.4, 1.5), '#F2C14E');
  // A pennant flying from the top.
  pen.fill(rect(-0.6, -76, 1.2, 20), '#7A5236');
  pen.fill(poly(0.6, -76, 11, -72.6, 0.6, -69.4), '#FFD166');
}

/** A little castle: two towers with pointed pink roofs and pennants, battlements and an arched door. */
function castle(art: Art, spot: Spot) {
  const pen = new Pen(art, ...spot);
  const wall = '#F3E6EE';
  const roof = '#F28DB8';
  pen.fill(ellipse(0, 0, 42, 4.4), '#000000', 0.12);
  pen.fill(rect(-36, -58, 16, 58) + rect(20, -58, 16, 58), darker(wall, 0.05));
  pen.fill(poly(-39, -58, -28, -82, -17, -58) + poly(17, -58, 28, -82, 39, -58), roof);
  pen.fill(poly(-28, -82, -17, -58, -24, -58) + poly(28, -82, 39, -58, 32, -58), darker(roof, 0.12));
  pen.fill(rect(-28.5, -92, 1, 10) + rect(27.5, -92, 1, 10), '#8A5A3B');
  pen.fill(poly(-27.5, -92, -21, -89.5, -27.5, -87) + poly(28.5, -92, 35, -89.5, 28.5, -87), '#FFD166');
  pen.fill(rect(-20, -44, 40, 44), wall);
  pen.fill([-20, -12, -4, 4, 12].map((x) => rect(x, -49, 6, 5)).join(''), wall);
  pen.fill(rect(-20, -44, 40, 2), darker(wall, 0.08));
  pen.fill('M-8 0V-15A8 8 0 0 1 8 -15V0Z', '#8A5A3B');
  pen.fill(rect(-0.4, -22, 0.8, 22), darker('#8A5A3B', 0.25));
  pane(pen, 'M-30.5 -36V-42A2.5 2.5 0 0 1 -25.5 -42V-36Z' + 'M25.5 -36V-42A2.5 2.5 0 0 1 30.5 -42V-36Z' + 'M-3 -30V-35A3 3 0 0 1 3 -35V-30Z');
  pen.fill(heart(0, -38.6, 2.2), '#FF6F8E');
}

/** An igloo of snow blocks with a tunnel to crawl in (lit up inside after dark). */
function igloo(art: Art, spot: Spot) {
  const pen = new Pen(art, ...spot);
  const ice = '#F2F8FD';
  const joint = '#C9DDEB';
  pen.fill(ellipse(0, 0, 40, 4.4), '#000000', 0.12);
  pen.fill('M-36 0A36 40 0 0 1 36 0Z', ice);
  const lines: string[] = [];
  [-10, -20, -29].forEach((y, row) => {
    const half = 36 * Math.sqrt(1 - (y / 40) ** 2);
    lines.push(rect(-half, y, half * 2, 1));
    for (let x = -half + 8 + (row % 2) * 5; x < half - 4; x += 11) lines.push(rect(x, y, 1, 10));
  });
  pen.fill(lines.join(''), joint);
  pen.fill(ellipse(-14, -27, 8, 4), '#FFFFFF', 0.7);
  pen.fill('M-13 0V-12A13 13 0 0 1 13 -12V0Z', darker(ice, 0.04));
  pen.fill(rect(-13, -9, 26, 1) + rect(-13, -4, 26, 1), joint);
  const door = 'M-8 0V-9A8 8 0 0 1 8 -9V0Z';
  if (art.dark) pen.light(door, '#FFD98A');
  else pen.fill(door, '#3E5566');
}

const HOUSES: Record<string, (art: Art, spot: Spot) => void> = { cottage, treehouse, tent, castle, igloo };

/** A cloud to sleep on: lilac and white puffs. */
const CLOUD = { back: '#E9E6FF', puff: '#FFFFFF', shade: '#D8D3FA' } as const;
/** A lilac beanbag. */
const BEANBAG = '#A99BEA';
const HEART_BED = '#FF8FB3';

function bed(art: Art, id: string, spot: Spot) {
  const pen = new Pen(art, ...spot);
  pen.fill(ellipse(0, 2, 40, 6), '#000000', 0.1);
  if (id === 'cloudbed') {
    pen.fill(circle(-25, -14, 10) + circle(-8, -19, 12) + circle(11, -18, 11.5) + circle(28, -12, 9), CLOUD.back);
    pen.fill(ellipse(0, -8, 38, 13), CLOUD.back);
    pen.fill(ellipse(0, -8, 31, 8.6), CLOUD.shade);
  } else if (id === 'beanbag') {
    // Squashy and tall at the back, with a dip where you sink in.
    pen.fill(ellipse(-3, -16, 35, 18), BEANBAG);
    pen.fill(ellipse(-12, -26, 14, 5), lighter(BEANBAG, 0.25), 0.6);
    pen.fill(ellipse(2, -8, 28, 8.6), darker(BEANBAG, 0.14));
  } else if (id === 'heartbed') {
    pen.fill('M0 -4C-26 -8 -42 -22 -30 -32C-20 -40 -6 -34 0 -26C6 -34 20 -40 30 -32C42 -22 26 -8 0 -4Z', HEART_BED);
    pen.fill(ellipse(0, -8, 30, 8.4), lighter(HEART_BED, 0.45));
  } else if (id === 'basket') {
    pen.fill(ellipse(0, -8, 38, 13), '#B9824F');
    pen.fill(ellipse(0, -8, 31, 8.6), '#F3E1C4');
    pen.fill(ellipse(-8, -8, 14, 5.6) + ellipse(14, -9, 10, 4.4), '#FF9EB5', 0.55);
  } else {
    const color = id === 'blue' ? '#8EC5F0' : '#FFAFC8';
    pen.fill(ellipse(0, -8, 38, 13), darker(color, 0.06));
    pen.fill(ellipse(0, -8, 31, 8.6), lighter(color, 0.45));
  }
}

/** The front of the bed, drawn over whoever is curled up in it. */
function bedFront(art: Art, id: string, spot: Spot) {
  const pen = new Pen(art, ...spot);
  if (id === 'cloudbed') {
    pen.fill(ellipse(0, -1, 36, 6), CLOUD.shade);
    pen.fill(circle(-29, -5, 7.5) + circle(-15, -3, 9) + circle(1, -2.4, 9.5) + circle(17, -3, 9) + circle(31, -6, 7), CLOUD.puff);
    pen.fill(circle(-17, -6, 3.4) + circle(-1, -6, 3.6) + circle(15, -6, 3.4), '#FFFFFF', 0.9);
    return;
  }
  if (id === 'beanbag') {
    pen.fill('M-35 -9A35 11 0 0 0 35 -9L29 -8A29 8 0 0 1 -29 -8Z', BEANBAG);
    pen.fill('M-31 -3A35 11 0 0 0 31 -3L30 -5A33 9.6 0 0 1 -30 -5Z', lighter(BEANBAG, 0.3), 0.7);
    return;
  }
  const color = id === 'basket' ? '#B9824F' : id === 'blue' ? '#8EC5F0' : id === 'heartbed' ? HEART_BED : '#FFAFC8';
  pen.fill('M-38 -8A38 13 0 0 0 38 -8L31 -8A31 8.6 0 0 1 -31 -8Z', color);
  pen.fill('M-34 -2A38 13 0 0 0 34 -2L33 -4A36 11 0 0 1 -33 -4Z', lighter(color, 0.3), 0.7);
  if (id === 'basket') {
    const weave: string[] = [];
    for (let x = -32; x <= 32; x += 8) weave.push(rect(x - 0.7, -4 + Math.abs(x) * 0.12, 1.4, 8 - Math.abs(x) * 0.1));
    pen.fill(weave.join(''), darker(color, 0.2), 0.7);
  } else {
    pen.fill(heart(0, -1, 3.4), '#FFFFFF', 0.8);
  }
}

function foodBowl(art: Art, color: string, spot: Spot) {
  const pen = new Pen(art, ...spot);
  pen.fill(ellipse(0, 0.5, 17, 3), '#000000', 0.12);
  pen.fill('M-15 -10L15 -10C14 -3 11 0 7 0L-7 0C-11 0 -14 -3 -15 -10Z', color);
  pen.fill(ellipse(0, -10, 15, 3.4), darker(color, 0.18));
  pen.fill(ellipse(0, -10.6, 12, 2.4), '#B5763F');
  pen.fill(circle(-6, -11.6, 1.6) + circle(-1, -12.3, 1.6) + circle(4.5, -11.8, 1.6) + circle(8, -11, 1.3), '#9A5F2E');
  pen.fill(circle(0, -3.6, 2) + circle(-2.6, -6.4, 0.9) + circle(0, -7.4, 0.9) + circle(2.6, -6.4, 0.9), '#FFFFFF', 0.85);
  pen.fill(ellipse(-9, -6, 1.6, 3), '#FFFFFF', 0.3);
}

function toy(art: Art, id: string, spot: Spot) {
  const pen = new Pen(art, ...spot);
  pen.fill(ellipse(0, 0.5, 11, 2.6), '#000000', 0.12);
  if (id === 'ball') {
    pen.fill(circle(0, -9, 9), '#FF6B6B');
    pen.fill('M-9 -10Q0 -4 9 -10L9 -7.6Q0 -1.6 -9 -7.6Z', '#FFFFFF');
    pen.fill(circle(-3.5, -13, 2.2), '#FFFFFF', 0.6);
  } else if (id === 'yarn') {
    pen.fill('M7 -4C16 0 18 2 28 -1L28 0.4C18 3.4 16 1.4 7 -2.6Z', '#FF9EC4');
    pen.fill(circle(0, -9, 9), '#FF9EC4');
    pen.fill('M-7 -15Q0 -9 7 -15Q0 -7 -7 -15Z' + 'M-8.4 -6Q0 -12 8.4 -6Q0 -10 -8.4 -6Z' + 'M-3 -17.6Q4 -9 1 -0.2Q2 -9 -3 -17.6Z', darker('#FF9EC4', 0.18));
  } else if (id === 'bone') {
    pen.fill(roundRect(-10, -6.5, 20, 6, 3) + circle(-11, -7.5, 3.6) + circle(-11, -2.5, 3.6) + circle(11, -7.5, 3.6) + circle(11, -2.5, 3.6), '#FFF6E8');
    pen.fill(rect(-8, -2.6, 16, 1.4), '#EADCC6');
  } else if (id === 'carrot') {
    pen.fill('M-13 -3Q-1 -13 10 -10Q11 -3 5 -1Q-6 1 -13 -3Z', '#FF9A3D');
    pen.fill(poly(-6, -7.4, -4.8, -7.8, -3, -4.6, -4.2, -4.2) + poly(1, -9.4, 2.2, -9.8, 4, -5.6, 2.8, -5.2), '#E07A20');
    pen.fill('M9 -10C10 -18 14 -20 16 -19C14 -16 12 -13 10.6 -9.4Z' + 'M10 -9.6C14 -15 19 -15 21 -13C17 -12 14 -10 11 -8.4Z', '#6FBF73');
  } else if (id === 'frisbee') {
    const disc = '#5AB8F0';
    pen.fill(ellipse(0, -2.2, 12.5, 4.2), darker(disc, 0.22));
    pen.fill(ellipse(0, -3.6, 12.5, 4.2), disc);
    pen.fill(ellipse(0, -3.8, 8.6, 2.7), lighter(disc, 0.4));
    pen.fill(ellipse(0, -3.9, 7, 2.1), disc);
    pen.fill(ellipse(-5, -5.4, 3, 0.9), '#FFFFFF', 0.6);
  } else if (id === 'rope') {
    // A knotted tug rope lying in an S, striped where it twists.
    const along = (t: number): [number, number] => {
      const u = 1 - t;
      return [u ** 3 * -12 + 3 * u * u * t * -5 + 3 * u * t * t * 5 + t ** 3 * 12, u ** 3 * -4 + 3 * u * u * t * -10 + 3 * u * t * t * 2 + t ** 3 * -4];
    };
    pen.fill('M-12 -6.3C-5 -12.3 5 -0.3 12 -6.3L12 -1.7C5 4.3 -5 -7.7 -12 -1.7Z', '#F1E3C6');
    const twists: string[] = [];
    for (let i = 1; i < 8; i++) {
      const [x, y] = along(i / 8);
      twists.push(poly(x - 1.6, y - 2.4, x - 0.2, y - 2.4, x + 1.6, y + 2.4, x + 0.2, y + 2.4));
    }
    pen.fill(twists.join(''), '#E5534B');
    pen.fill(circle(-13, -4, 4.4) + circle(13, -4, 4.4), '#E5534B');
    pen.fill(circle(-14, -5.4, 1.5) + circle(12, -5.4, 1.5), '#FFFFFF', 0.4);
    pen.fill(
      poly(-17, -6, -22, -8, -21.6, -6.6, -17, -4.6) + poly(-17, -3, -22, -2, -21.4, -0.8, -17, -1.8) +
        poly(17, -6, 22, -8, 21.6, -6.6, 17, -4.6) + poly(17, -3, 22, -2, 21.4, -0.8, 17, -1.8),
      '#F1E3C6'
    );
  } else if (id === 'bubbles') {
    // A bottle of bubble mix with its wand, and bubbles drifting up from it.
    pen.fill(roundRect(-5, -15, 10, 15, 3), '#CDEBFF', 0.9);
    pen.fill(roundRect(-5, -9, 10, 9, 3), '#8FD3F4');
    pen.fill(roundRect(-3.6, -18.6, 7.2, 4, 1.4), '#FF8FB8');
    pen.fill(rect(-0.6, -30, 1.2, 13), '#FF8FB8');
    pen.fill(ring(0, -33, 3.8, 1.2), '#FF8FB8');
    pen.fill(ellipse(-2.6, -10, 0.9, 3), '#FFFFFF', 0.6);
    const [ox, oy, k] = spot;
    [
      [5, 4200, 0, 3.2],
      [-4, 5200, 0.45, 2.4],
      [9, 4700, 0.75, 2],
    ].forEach(([dx, period, phase, r]) => {
      art.move({ type: 'rise', dy: 70, period: period!, phase: phase! }, () => {
        const x = ox + dx! * k;
        const y = oy - 38 * k;
        art.fill(circle(x, y, r! * k), '#FFFFFF', 0.25);
        art.fill(ring(x, y, r! * k, 0.5 * k), '#FFFFFF', 0.85);
        art.fill(circle(x - r! * 0.35 * k, y - r! * 0.35 * k, r! * 0.25 * k), '#FFFFFF', 0.9);
      });
    });
  }
}

function buddy(art: Art, id: string, layout: Layout) {
  if (id === 'butterfly') {
    art.move({ type: 'bob', dy: 5, period: 3200 }, () => {
      const pen = new Pen(art, ...layout.butterfly);
      pen.fill(both('M-1 -1C-6 -12 -15 -11 -14 -4C-13 2 -6 2 -1 0Z'), '#FFB3D9');
      pen.fill(both('M-1 1C-5 3 -11 7 -9 11C-6 13 -2 8 -1 3Z'), '#C8A8FF');
      pen.fill(both(circle(-8, -5, 2.2)), '#FFFFFF', 0.6);
      pen.fill(ellipse(0, 1, 1.4, 6.4), '#4A3B4F');
      pen.fill(both('M-0.6 -5Q-3 -10 -4.6 -10.6L-4.4 -11.2Q-2.4 -10.6 0 -5.4Z'), '#4A3B4F');
    });
    return;
  }
  if (id === 'hedgehog') {
    // It breathes, and hops along whenever the pet does.
    const [x, y, k] = layout.buddy;
    art.fill(ellipse(x, y + 0.5 * k, 13 * k, 2.6 * k), '#000000', 0.12);
    art.move({ type: 'breathe', amount: 0.04, x, y, period: 2800 }, () => hedgehog(new Pen(art, x, y, k * 1.1)), { follow: true });
    return;
  }
  const pen = new Pen(art, ...layout.buddy);
  pen.fill(ellipse(0, 0.5, 11, 2.4), '#000000', 0.12);
  if (id === 'bird') {
    pen.fill(rect(-3, -5, 1.2, 5) + rect(1.6, -5, 1.2, 5), '#FF9F43');
    pen.fill(poly(-8, -10, -16, -14, -14, -8), '#5FA8D8');
    pen.fill(ellipse(0, -10, 9, 7.5) + circle(5, -17, 6), '#7EC8F2');
    pen.fill(ellipse(1, -7, 5.6, 4), '#E8F6FF');
    pen.fill(ellipse(-2.5, -11, 4.6, 3.4), '#5FA8D8');
    pen.fill(poly(10.6, -18, 15, -16.4, 10.6, -15), '#FFB84D');
    pen.fill(circle(7, -18.5, 1.3), INK);
    pen.fill(ellipse(7.4, -14.6, 1.8, 1.1), BLUSH, 0.6);
  } else if (id === 'duckling') {
    pen.fill(ellipse(-2.5, -1, 2.6, 1.2) + ellipse(2.5, -1, 2.6, 1.2), '#FF9F43');
    pen.fill(ellipse(0, -8, 9.5, 7.5) + circle(4, -17, 6.4), '#FFE066');
    pen.fill(ellipse(-3, -9, 4.6, 3.4), '#F5CF45');
    pen.fill('M3 -23C2 -27 5 -28 6 -24Z', '#F5CF45');
    pen.fill(ellipse(11, -16, 3.8, 1.8), '#FF9F43');
    pen.fill(circle(6.4, -18.6, 1.3), INK);
    pen.fill(ellipse(5.6, -14.6, 1.8, 1.1), BLUSH, 0.6);
  }
}

/** A hedgehog facing right: spines over its back, a pointed cream face, a button nose. */
function hedgehog(pen: Pen) {
  const spines: number[] = [];
  for (let i = 0; i <= 16; i++) {
    const a = Math.PI * (0.98 + (i / 16) * 0.86);
    const r = i % 2 ? 1 : 1.32;
    spines.push(-2 + Math.cos(a) * 12 * r, -8 + Math.sin(a) * 9.5 * r);
  }
  spines.push(9, -4, -12, -1);
  pen.fill(poly(...spines), '#7E5E4A');
  pen.fill(ellipse(-2, -7.4, 12, 7.4), '#9C7A63');
  pen.fill(ellipse(-4, -10.6, 6, 2.2), '#B89A84', 0.6);
  pen.fill(ellipse(-6, -0.8, 3, 1.6) + ellipse(4, -0.8, 3, 1.6), '#6E5442');
  pen.fill('M5 -12C9 -13 13 -10 18 -6.6C18.6 -5.6 18 -4.6 16.8 -4.4C12 -3 7 -2 4 -4Z', '#F3DCC0');
  pen.fill(circle(17.6, -6, 1.5), INK);
  pen.fill(circle(10.4, -8.6, 1.2), INK);
  pen.fill(circle(10, -9, 0.4), '#FFFFFF');
  pen.fill(circle(7.4, -12, 1.7), '#B89A84');
  pen.fill(ellipse(11, -5.6, 1.8, 1), BLUSH, 0.6);
}

function fun(art: Art, id: string, spot: Spot) {
  const pen = new Pen(art, ...spot);
  if (id === 'pool') {
    pen.fill(ellipse(0, 0, 45, 13.5), '#FF9EB5');
    pen.fill(ellipse(0, 3, 45, 10.5), darker('#FF9EB5', 0.1));
    pen.fill(ellipse(0, -1, 38, 9), '#8FD3F4');
    pen.fill(ellipse(-12, -2.5, 10, 1.4) + ellipse(14, 1, 8, 1.2), '#FFFFFF', 0.7);
    // A rubber duck.
    pen.fill(ellipse(16, -4, 5.6, 3.6) + circle(19, -9, 3.2), '#FFE066');
    pen.fill(poly(21.6, -9.6, 25, -8.4, 21.6, -7.6), '#FF9F43');
    pen.fill(circle(19.8, -10, 0.8), INK);
  } else if (id === 'sandpit') {
    pen.fill(poly(-42, -12, 42, -12, 48, 10, -48, 10), '#C98F5A');
    pen.fill(poly(-37, -9, 37, -9, 41, 6, -41, 6), '#F6DFA0');
    pen.fill(ellipse(-14, -2, 8, 3) + ellipse(8, 2, 6, 2.2), '#EAC983');
    pen.fill(poly(-48, 10, 48, 10, 48, 13, -48, 13), darker('#C98F5A', 0.2));
    // A bucket and spade.
    pen.fill('M14 -12L26 -12L24 0L16 0Z', '#5B9BE6');
    pen.fill(ellipse(20, -12, 6, 1.6), darker('#5B9BE6', 0.2));
    pen.fill(rect(-26, -20, 1.6, 14) + roundRect(-28.5, -8, 6.6, 7, 2), '#FF6B6B');
  } else if (id === 'pond') {
    // A pond ringed with stones, lily pads, a frog and some bulrushes.
    pen.fill(rect(-38, -26, 1.4, 24) + rect(-33, -30, 1.4, 28) + rect(-29, -22, 1.4, 20), '#6E9A55');
    pen.fill(roundRect(-38.8, -30, 3, 9, 1.5) + roundRect(-33.8, -34, 3, 9, 1.5) + roundRect(-29.8, -26, 3, 8, 1.5), '#8A5A3B');
    pen.fill(ellipse(0, 0, 47, 13.5), '#A7AE9C');
    const stones: string[] = [];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      stones.push(ellipse(Math.cos(a) * 43, Math.sin(a) * 11.5, 5.4, 3));
    }
    pen.fill(stones.join(''), '#BFC5B4');
    pen.fill(ellipse(0, -0.5, 40, 9.5), '#4FA8D0');
    pen.fill(ellipse(0, -2.6, 36, 6.4), '#6CC0E2');
    pen.fill(ellipse(-20, -1, 8, 1) + ellipse(6, 3, 7, 0.9), '#FFFFFF', 0.6);
    const pad = (x: number, y: number, r: number) => `M${n(x)} ${n(y)}L${n(x + r)} ${n(y - r * 0.12)}A${n(r)} ${n(r * 0.38)} 0 1 1 ${n(x + r * 0.9)} ${n(y + r * 0.2)}Z`;
    pen.fill(pad(-14, -2, 7) + pad(18, 0.5, 6) + pad(2, -5, 4.6), '#5FAF5B');
    pen.fill(circle(-15, -3.4, 1.6) + circle(-12.6, -3.2, 1.4), '#FF9EC4');
    // The frog, on the right-hand pad.
    pen.fill(ellipse(18, -2.4, 5.4, 3.4), '#7CCB5B');
    pen.fill(circle(15.6, -5.4, 1.9) + circle(20.4, -5.4, 1.9), '#7CCB5B');
    pen.fill(circle(15.6, -5.6, 0.8) + circle(20.4, -5.6, 0.8), INK);
    pen.fill(ellipse(18, -1.6, 3, 1.2), '#C6EDA6');
  } else if (id === 'flowerbed') {
    // A raised wooden bed of roses and daisies.
    const wood = '#B9824F';
    pen.fill(poly(-40, -10, 40, -10, 42, 4, -42, 4), wood);
    pen.fill(rect(-42, -1, 84, 1.2) + rect(-14, -10, 1.2, 14) + rect(13, -10, 1.2, 14), darker(wood, 0.18));
    pen.fill(ellipse(0, -10, 40, 3.4), '#7A5236');
    const colors = ['#FF8FA3', '#FFFFFF', '#FFD166', '#E5534B', '#C9A8FF'];
    const blooms: Record<string, string[]> = {};
    const leaves: string[] = [];
    for (let i = 0; i < 9; i++) {
      const x = -34 + i * 8.5;
      const y = -16 - (i % 2) * 5;
      leaves.push(rect(x - 0.5, y, 1, -10 - y) + ellipse(x - 2.4, y + 5, 2.4, 1.2) + ellipse(x + 2.4, y + 7, 2.4, 1.2));
      (blooms[colors[i % colors.length]!] ??= []).push(circle(x - 2, y, 2.2) + circle(x + 2, y, 2.2) + circle(x, y - 2, 2.2) + circle(x, y + 2, 2.2));
    }
    pen.fill(leaves.join(''), '#5FAF5B');
    for (const [color, d] of Object.entries(blooms)) pen.fill(d.join(''), color);
    pen.fill(Array.from({ length: 9 }, (_, i) => circle(-34 + i * 8.5, -16 - (i % 2) * 5, 1.3)).join(''), '#FFB84D');
  } else if (id === 'trampoline') {
    // A round trampoline on short legs, its padded rim in blue.
    const pad = '#5B9BE6';
    pen.fill(ellipse(0, 3, 42, 5), '#000000', 0.12);
    pen.fill(rect(-31, -11, 2.6, 14) + rect(28.4, -11, 2.6, 14) + rect(-12, -8, 2.6, 12) + rect(9.4, -8, 2.6, 12), '#3A3A44');
    pen.fill(ellipse(0, -15, 41, 11), pad);
    pen.fill('M-41 -15A41 11 0 0 0 41 -15L41 -12A41 11 0 0 1 -41 -12Z', darker(pad, 0.2));
    pen.fill(ellipse(0, -15.5, 33, 7.6), '#2F2A36');
    pen.fill(ellipse(-9, -17.5, 13, 2.2), '#FFFFFF', 0.12);
    pen.fill('M-38 -18A41 11 0 0 1 38 -18L35 -17A36 9 0 0 0 -35 -17Z', lighter(pad, 0.3), 0.7);
  } else if (id === 'swing') {
    // A swing set, the seat swinging gently.
    const post = '#E5734F';
    pen.fill(ellipse(0, 2, 44, 4.4), '#000000', 0.1);
    pen.fill(bar(-40, 0, -31, -62, 3.4) + bar(-22, 0, -31, -62, 3.4) + bar(40, 0, 31, -62, 3.4) + bar(22, 0, 31, -62, 3.4), post);
    pen.fill(roundRect(-35, -65, 70, 4.4, 2), darker(post, 0.1));
    const [px, py] = pen.at(0, -61);
    art.move({ type: 'sway', deg: 9, x: px, y: py, period: 3200 }, () => {
      pen.fill(rect(-9, -61, 1, 44) + rect(8, -61, 1, 44), '#8A8F99');
      pen.fill(roundRect(-11, -18, 22, 3.6, 1.6), '#FFD166');
    });
  } else if (id === 'picnic') {
    // A gingham blanket with a basket and a slice of watermelon.
    const at = (u: number, v: number) => [-44 + 80 * u + 8 * v, -4 - 6 * u + 14 * v];
    const band = (u0: number, u1: number, v0: number, v1: number) => poly(...at(u0, v0), ...at(u1, v0), ...at(u1, v1), ...at(u0, v1));
    pen.fill(ellipse(0, 6, 46, 5), '#000000', 0.08);
    pen.fill(band(0, 1, 0, 1), '#FFFFFF');
    const checks: string[] = [];
    for (let i = 0; i < 6; i++) checks.push(band(i / 6 + 0.02, i / 6 + 0.1, 0, 1), band(0, 1, i / 6 + 0.02, i / 6 + 0.1));
    pen.fill(checks.join(''), '#E5534B', 0.55);
    pen.fill(roundRect(12, -20, 20, 12, 2.4), '#C98F5A');
    pen.fill(arcBand(22, -19, 8, 1.8, 180, 360), '#A9713E');
    pen.fill(rect(13, -16, 18, 1) + rect(13, -12.4, 18, 1), darker('#C98F5A', 0.2), 0.7);
    pen.fill(poly(13, -20, 31, -20, 26, -23, 18, -23), '#E5534B');
    pen.fill('M-27 -1A10 10 0 0 0 -7 -1Z', '#5FAF5B');
    pen.fill('M-25.4 -1A8.4 8.4 0 0 0 -8.6 -1Z', '#FF6B6B');
    pen.fill(ellipse(-21, 2, 0.7, 1.1) + ellipse(-17, 3.4, 0.7, 1.1) + ellipse(-13, 2, 0.7, 1.1), '#2F2A36');
  } else if (id === 'fountain') {
    // A stone fountain: water spilling from a bowl into a round basin, glinting.
    const stone = '#C9CED6';
    const water = '#8FD3F4';
    pen.fill(ellipse(0, 3, 44, 5), '#000000', 0.1);
    pen.fill(ellipse(0, -8, 40, 9), stone);
    pen.fill(ellipse(0, -8, 34, 6.4), water);
    pen.fill(rect(-4, -34, 8, 26), darker(stone, 0.05));
    pen.fill('M-12 -34Q-22 -30 -24 -10L-21.6 -10Q-20 -28 -11 -32Z' + 'M12 -34Q22 -30 24 -10L21.6 -10Q20 -28 11 -32Z', water, 0.75);
    pen.fill('M-15 -34A15 4 0 0 0 15 -34Q8 -28 0 -28Q-8 -28 -15 -34Z', darker(stone, 0.1));
    pen.fill(ellipse(0, -34, 15, 4), stone);
    pen.fill(ellipse(0, -34.4, 12, 2.6), water);
    pen.fill(rect(-1.2, -44, 2.4, 10), stone);
    pen.fill(ellipse(0, -46, 2.6, 3.6), water, 0.85);
    pen.fill('M-40 -8A40 9 0 0 0 40 -8L40 -2A40 9 0 0 1 -40 -2Z', darker(stone, 0.12));
    art.move({ type: 'twinkle', min: 0.15, period: 1500 }, () => {
      pen.light(circle(-16, -9, 1) + circle(12, -6.6, 1.2) + circle(0, -48, 0.9) + circle(-5, -35, 0.8), '#FFFFFF', 0.95);
    });
  } else if (id === 'ballpit') {
    // A paddling pool full of coloured balls.
    const wall = '#7FB2E5';
    pen.fill(ellipse(0, 3, 44, 5), '#000000', 0.1);
    pen.fill(ellipse(0, -14, 40, 9), darker(wall, 0.18));
    const balls: Record<string, string[]> = {};
    const colors = ['#FF6B6B', '#FFD166', '#5FB36B', '#4C8FE0', '#C9A8FF'];
    for (let i = 0; i < 26; i++) {
      const x = -33 + ((i * 7.3) % 66);
      const y = -20 + ((i * 3.7) % 9);
      (balls[colors[i % colors.length]!] ??= []).push(circle(x, y, 4));
    }
    for (const [color, d] of Object.entries(balls)) pen.fill(d.join(''), color);
    pen.fill('M-40 -14A40 9 0 0 0 40 -14L40 -3A40 9 0 0 1 -40 -3Z', wall);
    pen.fill('M-40 -14A40 9 0 0 0 40 -14L39.4 -11.6A39.4 8 0 0 1 -39.4 -11.6Z', lighter(wall, 0.3));
  }
}

// ---------- Seasonal things (from the shop, on sale a few months a year) ----------

function pumpkins(art: Art, pen: Pen) {
  const pumpkin = (cx: number, r: number, face: boolean) => {
    pen.fill(ellipse(cx, -r * 0.82, r * 1.25, r * 0.82), '#F28C28');
    pen.fill(ellipse(cx - r * 0.55, -r * 0.82, r * 0.5, r * 0.78) + ellipse(cx + r * 0.55, -r * 0.82, r * 0.5, r * 0.78), '#E07A1F');
    pen.fill(ellipse(cx, -r * 0.84, r * 0.42, r * 0.8), '#F79A3A');
    pen.fill(roundRect(cx - 1.2, -r * 1.8, 2.4, r * 0.4 + 2, 1), '#6D8B3C');
    if (!face) return;
    const d =
      poly(cx - r * 0.6, -r * 0.92, cx - r * 0.3, -r * 0.92, cx - r * 0.45, -r * 1.2) +
      poly(cx + r * 0.3, -r * 0.92, cx + r * 0.6, -r * 0.92, cx + r * 0.45, -r * 1.2) +
      poly(cx - r * 0.65, -r * 0.6, cx - r * 0.4, -r * 0.42, cx - r * 0.2, -r * 0.56, cx, -r * 0.4, cx + r * 0.2, -r * 0.56, cx + r * 0.4, -r * 0.42, cx + r * 0.65, -r * 0.6, cx, -r * 0.24);
    // Lit from inside after dark.
    if (art.dark) {
      pen.light(circle(cx, -r * 0.8, r * 2), '#FFB347', 0.18);
      pen.light(d, '#FFD36E');
    } else pen.fill(d, '#8A4A12');
  };
  pen.fill(ellipse(0, 0.5, 26, 3.4), '#000000', 0.12);
  pumpkin(-15, 7, false);
  pumpkin(15, 6.4, false);
  pumpkin(0, 11, true);
}

function festiveTree(art: Art, pen: Pen) {
  const green = '#3F8F5A';
  pen.fill(ellipse(0, 0.5, 26, 3.4), '#000000', 0.12);
  pen.fill(rect(-3, -9, 6, 9), '#8A5A3B');
  pen.fill(poly(-24, -8, 0, -36, 24, -8) + poly(-19, -26, 0, -52, 19, -26) + poly(-14, -42, 0, -66, 14, -42), green);
  pen.fill(poly(0, -36, 24, -8, 6, -8) + poly(0, -52, 19, -26, 5, -26) + poly(0, -66, 14, -42, 4, -42), darker(green, 0.12));
  // Baubles by day, fairy lights after dark.
  const spots = [[-12, -14], [8, -17], [-4, -24], [12, -31], [-9, -35], [3, -42], [-6, -50], [6, -55]] as const;
  const colors = ['#FF6B6B', '#FFD166', '#7FC8F8', '#FF9EC4'];
  spots.forEach(([x, y], i) => {
    const color = colors[i % colors.length]!;
    if (art.dark) {
      pen.light(circle(x, y, 4.2), color, 0.3);
      pen.light(circle(x, y, 1.9), color);
    } else pen.fill(circle(x, y, 2.4), color);
  });
  if (art.dark) pen.light(star(0, -68, 9, 5), '#FFE08A', 0.3);
  pen.light(star(0, -68, 5.4, 5), art.dark ? '#FFE9A8' : '#FFD54F');
  // Presents underneath.
  pen.fill(roundRect(-26, -9, 11, 9, 1.4), '#E5534B');
  pen.fill(roundRect(14, -7, 9, 7, 1.4), '#5B9BE6');
  pen.fill(rect(-21.2, -9, 1.6, 9) + rect(18, -7, 1.4, 7), '#FFFFFF');
  pen.fill(rect(-26, -5.2, 11, 1.4) + rect(14, -4, 9, 1.2), '#FFFFFF');
}

function tulips(pen: Pen) {
  const colors = ['#E5534B', '#FF9EC4', '#FFD166', '#C9A8FF', '#FF9A3D'];
  const leaves: string[] = [];
  const stems: string[] = [];
  const cups: Record<string, string[]> = {};
  [-16, -8, 0, 8, 16].forEach((x, i) => {
    const top = -22 - (i % 2 ? 6 : 0) - (i === 2 ? 4 : 0);
    stems.push(rect(x - 0.6, top + 2, 1.2, -top - 2));
    leaves.push(`M${x} 0C${x - 7} -5 ${x - 7} -12 ${x - 4} -16C${x - 3} -10 ${x - 1} -5 ${x} 0Z`);
    (cups[colors[i]!] ??= []).push(`M${x - 3.6} ${top - 7}L${x - 1.8} ${top - 4}L${x} ${top - 8}L${x + 1.8} ${top - 4}L${x + 3.6} ${top - 7}C${x + 4} ${top - 2} ${x + 2.4} ${top + 1} ${x} ${top + 1}C${x - 2.4} ${top + 1} ${x - 4} ${top - 2} ${x - 3.6} ${top - 7}Z`);
  });
  pen.fill(ellipse(0, 0.5, 24, 3), '#000000', 0.12);
  pen.fill(stems.join(''), '#4E9A4B');
  pen.fill(leaves.join(''), '#5FAF5B');
  for (const [color, d] of Object.entries(cups)) pen.fill(d.join(''), color);
}

function sunflowers(pen: Pen) {
  pen.fill(ellipse(0, 0.5, 22, 3), '#000000', 0.12);
  [
    [-11, 46, 7.5],
    [3, 62, 9],
    [14, 38, 6.5],
  ].forEach(([x, h, r]) => {
    pen.fill(rect(x! - 0.9, -h!, 1.8, h!), '#4E9A4B');
    pen.fill(`M${x} ${-h! * 0.45}C${x! - 8} ${-h! * 0.5} ${x! - 10} ${-h! * 0.35} ${x! - 11} ${-h! * 0.3}C${x! - 6} ${-h! * 0.28} ${x! - 2} ${-h! * 0.36} ${x} ${-h! * 0.4}Z`, '#5FAF5B');
    pen.fill(star(x!, -h!, r! * 1.6, 14, 0.62), '#FFC93C');
    pen.fill(circle(x!, -h!, r! * 0.8), '#7A4A26');
    pen.fill(circle(x! - r! * 0.25, -h! - r! * 0.25, r! * 0.3), '#9A6236', 0.8);
  });
}

function seasonal(art: Art, id: string, spot: Spot) {
  const pen = new Pen(art, ...spot);
  if (id === 'pumpkins') pumpkins(art, pen);
  else if (id === 'festive-tree') festiveTree(art, pen);
  else if (id === 'tulips') tulips(pen);
  else if (id === 'sunflowers') sunflowers(pen);
}

// ---------- Flags (from the shop), flying from a pole in the yard ----------

/** A straight bar from (x1, y1) to (x2, y2), `t` thick. */
function bar(x1: number, y1: number, x2: number, y2: number, t: number): string {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const nx = (-(y2 - y1) / len) * (t / 2);
  const ny = ((x2 - x1) / len) * (t / 2);
  return poly(x1 + nx, y1 + ny, x2 + nx, y2 + ny, x2 - nx, y2 - ny, x1 - nx, y1 - ny);
}

/** Part of a ring `t` thick, from angle a0 round to a1 (degrees, clockwise from 3 o'clock). */
function arcBand(cx: number, cy: number, r: number, t: number, a0: number, a1: number): string {
  const at = (rr: number, a: number) => `${n(cx + Math.cos((a * Math.PI) / 180) * rr)} ${n(cy + Math.sin((a * Math.PI) / 180) * rr)}`;
  const large = a1 - a0 > 180 ? 1 : 0;
  const ri = r - t;
  return `M${at(r, a0)}A${n(r)} ${n(r)} 0 ${large} 1 ${at(r, a1)}L${at(ri, a1)}A${n(ri)} ${n(ri)} 0 ${large} 0 ${at(ri, a0)}Z`;
}

/** A flag's size, its top left corner at the pole. */
const FLAG_W = 36;
const FLAG_H = 24;

/** A maple leaf about (0, 0), 1 unit from its middle to its top. */
const MAPLE = [
  [0, -1], [0.18, -0.62], [0.42, -0.72], [0.36, -0.3], [0.72, -0.44], [0.62, -0.14], [0.84, 0.02], [0.44, 0.32],
  [0.5, 0.5], [0.07, 0.42], [0.07, 0.82], [-0.07, 0.82], [-0.07, 0.42], [-0.5, 0.5], [-0.44, 0.32], [-0.84, 0.02],
  [-0.62, -0.14], [-0.72, -0.44], [-0.36, -0.3], [-0.42, -0.72], [-0.18, -0.62],
] as const;

/** A diagonal band corner to corner across the flag, cut off square at its edges. */
function diagonal(t: number, flip: boolean): string {
  const h = t / 2;
  const angle = Math.atan2(FLAG_H, FLAG_W);
  const a = h / Math.sin(angle);
  const b = h / Math.cos(angle);
  const W = FLAG_W;
  const H = FLAG_H;
  return flip
    ? poly(W, 0, W - a, 0, 0, H - b, 0, H, a, H, W, b)
    : poly(0, 0, a, 0, W, H - b, W, H, W - a, H, 0, b);
}

/** A flag's design, drawn with its top left corner at the pen's (0, 0). */
function flagFace(pen: Pen, id: string) {
  const W = FLAG_W;
  const H = FLAG_H;
  switch (id) {
    case 'flag-ussr': {
      const gold = '#F7C531';
      pen.fill(rect(0, 0, W, H), '#CC2229');
      // A gold-edged star over the hammer and sickle, in the top corner.
      pen.fill(star(8, 3, 2.1, 5, 0.42), gold);
      pen.fill(star(8, 3.1, 1.15, 5, 0.42), '#CC2229');
      // The sickle: a blade curling from its handle (bottom left) round under and up the right to
      // its tip (top left), around the hammer's head.
      pen.fill(arcBand(8, 10.4, 4.1, 1.4, -150, 112), gold);
      pen.fill(bar(6.6, 14.2, 4.2, 16.2, 1.5), gold);
      // The hammer, its handle crossing the blade, its head up in the sickle's curve.
      pen.fill(bar(12.6, 15.6, 6.6, 8.6, 1.2), gold);
      pen.fill(bar(5, 10.2, 8.4, 7.2, 2.2), gold);
      break;
    }
    case 'flag-pirate': {
      const bone = '#F4F1EA';
      pen.fill(rect(0, 0, W, H), '#1F1D24');
      pen.fill(bar(12, 14.6, 24, 21, 1.5) + bar(24, 14.6, 12, 21, 1.5), bone);
      pen.fill(circle(11.4, 13.8, 1.1) + circle(12.6, 15.2, 1.1) + circle(24.6, 13.8, 1.1) + circle(23.4, 15.2, 1.1), bone);
      pen.fill(circle(11.4, 21.8, 1.1) + circle(12.6, 20.4, 1.1) + circle(24.6, 21.8, 1.1) + circle(23.4, 20.4, 1.1), bone);
      pen.fill(circle(18, 9.6, 4.8) + roundRect(15.2, 12, 5.6, 4.2, 1.2), bone);
      pen.fill(circle(16.2, 9.6, 1.4) + circle(19.8, 9.6, 1.4) + poly(17.4, 12.4, 18.6, 12.4, 18, 11.2), '#1F1D24');
      break;
    }
    case 'flag-rainbow': {
      const bands = ['#E5484D', '#FF9A3D', '#FFD23F', '#4FB86B', '#4C7FD9', '#8E5BC9'];
      bands.forEach((color, i) => pen.fill(rect(0, (H / 6) * i, W, H / 6 + 0.2), color));
      break;
    }
    case 'flag-canada': {
      const red = '#D52B1E';
      pen.fill(rect(0, 0, W, H), '#FFFFFF');
      pen.fill(rect(0, 0, 9, H) + rect(27, 0, 9, H), red);
      pen.fill(poly(...MAPLE.flatMap(([x, y]) => [18 + x * 6.6, 12.4 + y * 6.6])), red);
      break;
    }
    case 'flag-uk': {
      pen.fill(rect(0, 0, W, H), '#1F3F8F');
      pen.fill(diagonal(4.6, false) + diagonal(4.6, true), '#FFFFFF');
      pen.fill(diagonal(1.6, false) + diagonal(1.6, true), '#D7263D');
      pen.fill(rect(0, H / 2 - 3.6, W, 7.2) + rect(W / 2 - 3.6, 0, 7.2, H), '#FFFFFF');
      pen.fill(rect(0, H / 2 - 2.1, W, 4.2) + rect(W / 2 - 2.1, 0, 4.2, H), '#D7263D');
      break;
    }
    case 'flag-usa': {
      pen.fill(rect(0, 0, W, H), '#FFFFFF');
      const stripe = H / 13;
      pen.fill(Array.from({ length: 7 }, (_, i) => rect(0, i * 2 * stripe, W, stripe)).join(''), '#C8313E');
      pen.fill(rect(0, 0, W * 0.42, stripe * 7), '#2B3F7E');
      const stars: string[] = [];
      for (let row = 0; row < 4; row++) for (let col = 0; col < 5; col++) stars.push(circle(1.9 + col * 2.75 + (row % 2) * 0.9, 1.7 + row * 3.1, 0.55));
      pen.fill(stars.join(''), '#FFFFFF');
      break;
    }
    case 'flag-italy': {
      pen.fill(rect(0, 0, W / 3 + 0.2, H), '#2E9E5B');
      pen.fill(rect(W / 3, 0, W / 3 + 0.2, H), '#FFFFFF');
      pen.fill(rect((W * 2) / 3, 0, W / 3, H), '#D7343E');
      break;
    }
    case 'flag-bulgaria': {
      pen.fill(rect(0, 0, W, H / 3 + 0.2), '#FFFFFF');
      pen.fill(rect(0, H / 3, W, H / 3 + 0.2), '#00966E');
      pen.fill(rect(0, (H * 2) / 3, W, H / 3), '#D62612');
      break;
    }
    case 'flag-lebanon': {
      // Red bands top and bottom, and a green cedar on the white between.
      pen.fill(rect(0, 0, W, H), '#FFFFFF');
      pen.fill(rect(0, 0, W, H / 4) + rect(0, (H * 3) / 4, W, H / 4), '#ED1C24');
      const cx = W / 2;
      pen.fill(rect(cx - 0.7, 14.6, 1.4, 3.2), '#00A651');
      pen.fill(poly(cx, 6.4, cx + 3, 9.4, cx - 3, 9.4) + poly(cx, 8, cx + 5, 12.2, cx - 5, 12.2) + poly(cx, 10.4, cx + 7.4, 15.2, cx - 7.4, 15.2), '#00A651');
      break;
    }
    case 'flag-japan': {
      pen.fill(rect(0, 0, W, H), '#FFFFFF');
      pen.fill(circle(W / 2, H / 2, H * 0.3), '#BC002D');
      break;
    }
    case 'flag-bangladesh': {
      pen.fill(rect(0, 0, W, H), '#006A4E');
      pen.fill(circle(W * 0.45, H / 2, H * 0.3), '#F42A41');
      break;
    }
    case 'flag-china': {
      pen.fill(rect(0, 0, W, H), '#DE2910');
      pen.fill(star(6.2, 6.2, 3.8, 5, 0.4), '#FFDE00');
      pen.fill(star(12.4, 2.4, 1.2, 5, 0.4) + star(14.6, 4.9, 1.2, 5, 0.4) + star(14.6, 8.4, 1.2, 5, 0.4) + star(12.4, 10.8, 1.2, 5, 0.4), '#FFDE00');
      break;
    }
  }
  // A little shade down the side at the pole.
  pen.fill(rect(0, 0, 1.4, H), '#000000', 0.12);
}

/** A flagpole with a gold ball on top, its flag swaying in the breeze. */
function flag(art: Art, id: string, spot: Spot) {
  const pen = new Pen(art, ...spot);
  pen.fill(ellipse(0, 0.5, 8, 2), '#000000', 0.14);
  pen.fill(rect(-1.1, -112, 2.2, 112), '#C9CED6');
  pen.fill(rect(-1.1, -112, 0.8, 112), '#FFFFFF', 0.4);
  pen.fill(circle(0, -113.6, 2.6), '#F2C14E');
  const [px, py] = pen.at(1.1, -110);
  // Flags keep their colours at dusk and after dark, rather than fading into the sky.
  art.move({ type: 'sway', deg: 2.5, x: px, y: py, period: 2400 }, () =>
    art.lightlyTinted(0.3, () => flagFace(new Pen(art, px, py, spot[2]), id))
  );
}

// ---------- Party things (from the shop), hung up over the yard ----------

const PARTY_COLORS = ['#FF6F91', '#FFD166', '#7FC8F8', '#A8E39A', '#C9A8FF'];

/**
 * Two swags of string across the top of the yard, each tied off above the picture: from the left
 * edge to the middle, and from the middle to the right edge. [x0, y0, control x, control y, x1, y1].
 */
const SWAGS = [
  [-4, 6, 90, 58, 180, -4],
  [180, -4, 270, 58, 364, 6],
] as const;

/** `count - 1` points evenly along each swag (its ends are off the edge or up above). */
function swagPoints(count: number): [number, number][] {
  const points: [number, number][] = [];
  for (const [x0, y0, cx, cy, x1, y1] of SWAGS) {
    for (let i = 1; i < count; i++) {
      const t = i / count;
      const u = 1 - t;
      points.push([u * u * x0 + 2 * u * t * cx + t * t * x1, u * u * y0 + 2 * u * t * cy + t * t * y1]);
    }
  }
  return points;
}

function swagStrings(thick: number): string {
  return SWAGS.map(
    ([x0, y0, cx, cy, x1, y1]) => `M${x0} ${y0}Q${cx} ${cy} ${x1} ${y1}L${x1} ${y1 + thick}Q${cx} ${cy + thick} ${x0} ${y0 + thick}Z`
  ).join('');
}

/** Triangle flags in party colours, swaying a little in the breeze. */
function bunting(art: Art) {
  art.move({ type: 'sway', deg: 1, x: 180, y: -4, period: 6200 }, () => {
    art.fill(swagStrings(0.9), '#FFFFFF', 0.85);
    const flags: Record<string, string[]> = {};
    swagPoints(10).forEach(([x, y], i) => {
      (flags[PARTY_COLORS[i % PARTY_COLORS.length]!] ??= []).push(poly(x - 5.4, y, x + 5.4, y, x, y + 11.5));
    });
    for (const [color, d] of Object.entries(flags)) art.fill(d.join(''), color);
    // A lighter edge along the top of each flag.
    art.fill(swagPoints(10).map(([x, y]) => poly(x - 5.4, y, x + 5.4, y, x + 4.4, y + 1.6, x - 4.4, y + 1.6)).join(''), '#FFFFFF', 0.35);
  });
}

/** A string of coloured bulbs: shiny by day, glowing and twinkling after dark. */
function fairyLights(art: Art) {
  art.fill(swagStrings(0.8), '#3A3A44', 0.7);
  const bulbs = swagPoints(13);
  const caps = bulbs.map(([x, y]) => rect(x - 1.1, y, 2.2, 1.8)).join('');
  const bulb = ([x, y]: readonly [number, number]) => ellipse(x, y + 4.2, 2.2, 3);
  const byColor = (group: number) => {
    const out: Record<string, string[]> = {};
    bulbs.forEach((b, i) => {
      if (i % 2 === group) (out[PARTY_COLORS[i % PARTY_COLORS.length]!] ??= []).push(bulb(b));
    });
    return out;
  };
  if (!art.dark) {
    for (const group of [0, 1]) for (const [color, d] of Object.entries(byColor(group))) art.fill(d.join(''), color);
    art.fill(bulbs.map(([x, y]) => circle(x - 0.7, y + 3.2, 0.7)).join(''), '#FFFFFF', 0.7);
    art.fill(caps, '#5A5A66');
    return;
  }
  // After dark, every other bulb dims while its neighbours brighten, and back.
  for (const group of [0, 1]) {
    art.move(
      { type: 'twinkle', min: 0.35, period: 2400 },
      () => {
        for (const [color, d] of Object.entries(byColor(group))) {
          art.light(d.join(''), color);
        }
        bulbs.forEach(([x, y], i) => {
          if (i % 2 === group) art.light(circle(x, y + 4.2, 6.5), PARTY_COLORS[i % PARTY_COLORS.length]!, 0.22);
        });
      },
      { delay: group * 1200 }
    );
  }
  art.fill(caps, '#5A5A66');
}

/** Where the disco ball hangs: clear of the sun, the kites, and even a legend's hat. */
const DISCO = { x: 214, y: 58, r: 12.5 } as const;

/**
 * A mirror ball on a string. Its facets glint by day as it turns; after dark it throws spots of
 * coloured light all over the yard, which come and go.
 */
function discoBall(art: Art) {
  const { x, y, r } = DISCO;
  if (art.dark) {
    // Spots spread evenly over the hills and lawn, in three colour groups that take turns.
    for (const group of [0, 1, 2]) {
      art.move(
        { type: 'twinkle', min: 0.15, period: 2100 },
        () => {
          for (let i = group; i < 24; i += 3) {
            const sx = 10 + ((i * 0.618034) % 1) * 340;
            const sy = 140 + ((i * 0.381966 + 0.2) % 1) * 124;
            const flat = sy > HORIZON ? 0.45 : 0.8;
            art.light(ellipse(sx, sy, 5.4, 5.4 * flat), PARTY_COLORS[(i + group) % PARTY_COLORS.length]!, 0.55);
          }
        },
        { delay: group * 700 }
      );
    }
    art.light(circle(x, y, r * 1.7), '#E8DFFF', 0.07);
  }
  art.fill(rect(x - 0.45, 0, 0.9, y - r - 2), '#6A6A76');
  art.fill(roundRect(x - 2.6, y - r - 3.4, 5.2, 4, 1), '#8C97A8');
  art.fill(circle(x, y, r), '#7D889A');
  // The mirror tiles, lighter toward the top left where the light catches them.
  const tiles: Record<'light' | 'mid' | 'dark', string[]> = { light: [], mid: [], dark: [] };
  const coloured: string[][] = PARTY_COLORS.map(() => []);
  let count = 0;
  for (let ty = -r + 1.6; ty < r - 1.6; ty += 3.3) {
    const half = Math.sqrt(r * r - (ty + 1.4) * (ty + 1.4)) - 0.6;
    for (let tx = -half; tx + 2.7 <= half; tx += 3.3) {
      const d = rect(x + tx, y + ty, 2.7, 2.7);
      if (art.dark && count % 4 === 1) coloured[count % PARTY_COLORS.length]!.push(d);
      else tiles[tx + ty < -7 ? 'light' : tx + ty > 5 ? 'dark' : 'mid'].push(d);
      count++;
    }
  }
  art.fill(tiles.light.join(''), '#EEF2F8');
  art.fill(tiles.mid.join(''), '#C3CCD8');
  art.fill(tiles.dark.join(''), '#A0AABA');
  coloured.forEach((d, i) => d.length && art.light(d.join(''), PARTY_COLORS[i]!, 0.9));
  art.fill(ellipse(x - r * 0.38, y - r * 0.42, r * 0.34, r * 0.22), '#FFFFFF', 0.55);
  // Glints that wink on and off as it turns.
  const glints = [
    [-5, -6, 3.4],
    [4, 3, 2.6],
    [-2, 7, 2.2],
    [7, -5, 2.4],
  ] as const;
  for (const group of [0, 1]) {
    art.move(
      { type: 'twinkle', min: 0, period: 1600 },
      () => {
        const d = glints
          .filter((_, i) => i % 2 === group)
          .map(([gx, gy, gs]) => star(x + gx, y + gy, gs, 4, 0.28))
          .join('');
        art.light(d, '#FFFFFF', 0.95);
      },
      { delay: group * 800 }
    );
  }
}

/** A star piñata on a string, swinging a little, with streamers at its points. */
function pinata(art: Art) {
  const { x, y } = DISCO;
  const r = 15;
  art.move({ type: 'sway', deg: 4, x, y: 0, period: 3400 }, () => {
    art.fill(rect(x - 0.45, 0, 0.9, y - r + 2), '#6A6A76');
    const colors = ['#FF6F91', '#FFD166', '#7FC8F8', '#A8E39A', '#C9A8FF'];
    const streamers: Record<string, string[]> = {};
    for (let i = 0; i < 5; i++) {
      const a = ((-90 + 72 * i) * Math.PI) / 180;
      const tx = x + Math.cos(a) * r;
      const ty = y + Math.sin(a) * r;
      (streamers[colors[i]!] ??= []).push(rect(tx - 2.4, ty, 1.2, 8) + rect(tx - 0.6, ty, 1.2, 10) + rect(tx + 1.2, ty, 1.2, 7));
    }
    for (const [color, d] of Object.entries(streamers)) art.fill(d.join(''), color);
    art.fill(star(x, y, r, 5, 0.5), '#FF6F91');
    art.fill(star(x, y, r * 0.72, 5, 0.5), '#FFD166');
    art.fill(star(x, y, r * 0.46, 5, 0.5), '#7FC8F8');
    art.fill(circle(x, y, r * 0.16), '#A8E39A');
  });
}

/** Round paper lanterns strung across the yard, glowing after dark. */
function paperLanterns(art: Art) {
  art.fill(swagStrings(0.8), '#3A3A44', 0.6);
  const colors = ['#FFB3C7', '#FFE08A', '#B9E6C9', '#C9B8FF', '#FFC9A3'];
  swagPoints(7).forEach(([x, y], i) => {
    const color = colors[i % colors.length]!;
    const cy = y + 9;
    art.fill(rect(x - 0.4, y, 0.8, 2.4), '#3A3A44');
    if (art.dark) art.light(circle(x, cy, 11), color, 0.25);
    const ball = ellipse(x, cy, 6, 6.6);
    if (art.dark) art.light(ball, lighter(color, 0.35));
    else art.fill(ball, color);
    art.fill(ellipse(x, cy, 2.4, 6.6), '#FFFFFF', 0.25);
    art.fill(rect(x - 3, cy - 7.4, 6, 1.6) + rect(x - 3, cy + 5.8, 6, 1.6), '#8A5A3B');
  });
}

function party(art: Art, id: string) {
  if (id === 'disco') discoBall(art);
  else if (id === 'bunting') bunting(art);
  else if (id === 'fairy-lights') fairyLights(art);
  else if (id === 'pinata') pinata(art);
  else if (id === 'paper-lanterns') paperLanterns(art);
}

// ---------- Keepsakes (one for each passport page you fill) ----------

/** A red telephone box, its windows lit after dark. */
function phoneBox(pen: Pen) {
  const red = '#D7262E';
  pen.fill(ellipse(0, 0.5, 16, 2.6), '#000000', 0.12);
  pen.fill(rect(-13, -3, 26, 3), darker(red, 0.2));
  pen.fill(rect(-11, -50, 22, 47), red);
  pen.fill('M-12.5 -49Q0 -57 12.5 -49Z', red);
  pen.fill(rect(-12.5, -50, 25, 2.2), darker(red, 0.15));
  pen.fill(rect(-8.6, -46.4, 17.2, 3.6), '#F4F1E8');
  pen.fill(rect(-7, -45.2, 14, 1.2), '#3A3A44', 0.6);
  pen.fill(circle(0, -54, 1.6), '#F2C14E');
  const panes: string[] = [];
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 3; col++) panes.push(rect(-7.6 + col * 5.4, -40 + row * 5.6, 4.4, 4.6));
  }
  pane(pen, panes.join(''));
  pen.fill(rect(-9.4, -41, 1, 31) + rect(8.4, -41, 1, 31), darker(red, 0.12));
  pen.fill(rect(7, -24, 1.4, 4), '#F2C14E');
}

/** An inukshuk: a stone figure with its arms out, standing guard. */
function inukshuk(pen: Pen) {
  const stone = '#A3ACB1';
  const shade = darker(stone, 0.14);
  pen.fill(ellipse(0, 0.5, 18, 2.6), '#000000', 0.12);
  pen.fill(roundRect(-11, -16, 7, 16, 2) + roundRect(4, -16, 7, 16, 2), stone);
  pen.fill(roundRect(-12, -24, 24, 8.4, 3), shade);
  pen.fill(roundRect(-8, -32, 16, 8.4, 3), stone);
  pen.fill(roundRect(-21, -39, 42, 7.4, 3), shade);
  pen.fill(roundRect(-6, -48, 12, 9.4, 3.6), stone);
  pen.fill(rect(-11, -16, 22, 1.4) + rect(-21, -33, 42, 1.2), darker(stone, 0.3), 0.4);
  pen.fill(ellipse(-15, -37.4, 4, 1) + ellipse(-2, -46, 2.6, 0.9), '#FFFFFF', 0.35);
}

/** A Camino waymarker: a stone post with the yellow scallop shell on a blue tile. */
function shellMarker(pen: Pen) {
  const post = '#D9D2C2';
  pen.fill(ellipse(0, 0.5, 13, 2.4), '#000000', 0.12);
  pen.fill('M-9 0L-8 -40Q0 -45 8 -40L9 0Z', post);
  pen.fill('M3 0L3.4 -41.4Q6 -41 8 -40L9 0Z', darker(post, 0.1));
  pen.fill(roundRect(-6.6, -37, 13.2, 13.2, 1.4), '#2F5DA8');
  // The shell's ribs fan out, up and to the right, from its hinge at the tile's bottom left.
  const rays: string[] = [];
  for (let i = 0; i < 7; i++) {
    const a = -1.45 + (i * 1.35) / 6;
    const [x, y] = [-4.6 + Math.cos(a) * 10, -25.4 + Math.sin(a) * 10];
    rays.push(poly(-4.6, -25.4, x - Math.sin(a) * 0.9, y + Math.cos(a) * 0.9, x + Math.sin(a) * 0.9, y - Math.cos(a) * 0.9));
  }
  pen.fill(rays.join(''), '#F5C518');
  pen.fill(rect(-6.6, -18, 13.2, 1.2) + rect(-6.6, -13, 13.2, 1.2), darker(post, 0.18), 0.6);
}

/** A gelato cart with a striped awning and three cones on the counter. */
function gelatoCart(pen: Pen) {
  const cart = '#FFF1D6';
  const pink = '#FF8FB1';
  pen.fill(ellipse(0, 0.5, 22, 2.8), '#000000', 0.12);
  pen.fill(rect(-17, -42, 1.4, 20) + rect(15.6, -42, 1.4, 20), '#B9824F');
  pen.fill('M-21 -42H21L18 -36H-18Z', pink);
  const stripes: string[] = [];
  for (let i = 0; i < 7; i++) stripes.push(poly(-21 + i * 6, -42, -18 + i * 6, -42, -15.4 + i * 5.2, -36, -18 + i * 5.2, -36));
  pen.fill(stripes.join(''), '#FFFFFF');
  pen.fill('M-18 -36Q-15 -32 -12 -36Q-9 -32 -6 -36Q-3 -32 0 -36Q3 -32 6 -36Q9 -32 12 -36Q15 -32 18 -36Z', pink);
  pen.fill(roundRect(-18, -22, 36, 15, 2.4), cart);
  pen.fill(rect(-18, -15, 36, 2.4), pink);
  pen.fill(rect(-19, -23, 38, 2), darker(cart, 0.12));
  pen.fill(circle(-11, -4, 4.4) + circle(11, -4, 4.4), '#5B4B44');
  pen.fill(circle(-11, -4, 1.6) + circle(11, -4, 1.6), '#C9BDB4');
  [
    [-8, '#FF9EC4'],
    [0, '#9EE3C5'],
    [8, '#8A5A3B'],
  ].forEach(([x, scoop]) => {
    const cx = x as number;
    pen.fill(poly(cx - 2.6, -26, cx + 2.6, -26, cx, -21), '#E3B26B');
    pen.fill(circle(cx, -27.6, 3), scoop as string);
  });
}

/** A Route 66 shield on a post: "66" in black on white, a black band across the top. */
function routeSign(pen: Pen) {
  pen.fill(ellipse(0, 0.5, 10, 2.2), '#000000', 0.12);
  pen.fill(rect(-1.4, -30, 2.8, 30), '#8A8F94');
  const shield = 'M-13 -54H13C13.6 -50 15 -48 15 -45C15 -36 8 -31 0 -27C-8 -31 -15 -36 -15 -45C-15 -48 -13.6 -50 -13 -54Z';
  pen.fill(shield, '#2B2B2B');
  pen.fill(place(shield, 0, -2.7, 0.86), '#FFFFFF');
  pen.fill(rect(-11.4, -50.6, 22.8, 4), '#2B2B2B');
  // "66": two sixes, each a ring with a hook up to the top.
  const six = (x: number) => ring(x, -36.8, 3.2, 1.6) + `M${n(x - 3.2)} -36.8C${n(x - 3.2)} -42 ${n(x - 1)} -44.4 ${n(x + 2.6)} -44.6L${n(x + 2.6)} -43C${n(x)} -42.8 ${n(x - 1.6)} -41 ${n(x - 1.6)} -36.8Z`;
  pen.fill(six(-4.2) + six(4.4), '#2B2B2B');
}

/** Red paper lanterns hanging from a little wooden arch; they glow after dark. */
function lanterns(art: Art, pen: Pen) {
  const wood = '#8A5A3B';
  pen.fill(ellipse(0, 0.5, 24, 2.8), '#000000', 0.12);
  pen.fill(rect(-20, -48, 3, 48) + rect(17, -48, 3, 48), wood);
  pen.fill('M-25 -50Q0 -56 25 -50L25 -46Q0 -51 -25 -46Z', '#C0392B');
  [-9, 0, 9].forEach((x, i) => {
    const y = -36 + (i === 1 ? 3 : 0);
    pen.fill(rect(x - 0.3, -48, 0.6, y - 5.6 + 48), '#3A3A44');
    if (art.dark) pen.light(circle(x, y, 9), '#FF8A65', 0.22);
    const body = ellipse(x, y, 4.6, 5.8);
    if (art.dark) pen.light(body, '#FF5A3C');
    else pen.fill(body, '#E5383B');
    pen.fill(rect(x - 2.6, y - 6.6, 5.2, 1.6) + rect(x - 2.6, y + 5, 5.2, 1.6), '#F2C14E');
    pen.fill(rect(x - 0.4, y + 6.6, 0.8, 4), '#F2C14E');
    pen.fill(ellipse(x, y, 1.6, 5.8), '#FFFFFF', 0.15);
  });
}

function keepsake(art: Art, id: string, spot: Spot) {
  const pen = new Pen(art, ...spot);
  if (id === 'phone-box') phoneBox(pen);
  else if (id === 'inukshuk') inukshuk(pen);
  else if (id === 'shell-marker') shellMarker(pen);
  else if (id === 'gelato-cart') gelatoCart(pen);
  else if (id === 'route-sign') routeSign(pen);
  else if (id === 'lanterns') lanterns(art, pen);
}

/** A legend's glow, around it but not as fast as it grows (so it stays inside the scene). */
const glowSize = (s: number) => 0.6 + 0.4 * s;

/** A glow behind the pet at its legendary stage: soft rings, with sunbeams for a golden one. */
function glow(art: Art, id: string, cx: number, cy: number, s: number) {
  const g = glowSize(s);
  if (id === 'rainbow') {
    const colors = ['#FF8A8A', '#FFC27A', '#FFE58A', '#A8E39A', '#8CC8F2', '#B9A2EE'];
    colors.forEach((color, i) => art.light(ring(cx, cy, (84 - i * 5) * g, 5 * g), color, 0.24));
    return;
  }
  const color = id === 'stars' ? '#FFFFFF' : '#FFE08A';
  if (id === 'golden') {
    const rays: string[] = [];
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6 + 0.13;
      const w = 0.09;
      const r = 150 * g;
      rays.push(poly(cx, cy, cx + Math.cos(a - w) * r, cy + Math.sin(a - w) * r, cx + Math.cos(a + w) * r, cy + Math.sin(a + w) * r));
    }
    art.light(rays.join(''), '#FFF1B8', 0.12);
  }
  art.light(circle(cx, cy, 86 * g), color, 0.14);
  art.light(circle(cx, cy, 68 * g), color, 0.16);
  art.light(circle(cx, cy, 50 * g), color, 0.18);
}

/**
 * Sparkles twinkling around a legendary pet, and glints on its bling (a chain, a crown, iced
 * shades, gold kicks). They belong to the pet, so they move with it when it plays.
 */
function sparkles(art: Art, id: string, cx: number, cy: number, s: number, look: Look, body: Pen, head: Pen) {
  const g = glowSize(s);
  const sparkle = id === 'rainbow' ? '#FFFFFF' : id === 'stars' ? '#FFF6C8' : '#FFE58A';
  const spots = [
    [-74, -30, 5],
    [70, -52, 6],
    [-56, -80, 4],
    [80, 8, 4],
    [-82, 22, 3.5],
    [38, -96, 3.5],
  ] as const;
  const around = spots.map(([dx, dy, r]) => star(cx + dx * g, cy + dy * g, r * g * (id === 'stars' ? 1.6 : 1.3), 4, 0.3));
  const glints: string[] = [];
  const glint = (p: Pen, x: number, y: number, r: number) => {
    const [px, py] = p.at(x, y);
    glints.push(star(px, py, r * p.k, 4, 0.22));
  };
  if (look.collar === 'gold' || look.collar === 'diamond') glint(body, 4, -25.5, 3.6);
  if (look.hat === 'crown') glint(head, 9, -102, 3.8);
  if (look.glasses === 'iced') glint(head, -21, -63, 3.2);
  if (look.kicks === 'gold') glint(body, -15, -9.5, 2.8);
  if (look.coat.specks === 'golden') glint(head, 19, -79, 3);
  art.move(
    { type: 'twinkle', min: 0.2, period: 2200 },
    () => {
      art.light(around.join(''), sparkle);
      if (glints.length) art.light(glints.join(''), '#FFFFFF');
    },
    { pet: true }
  );
}

// ---------- The world ----------

/** Where to tap the pet, the top of its head, what it says and what it likes to eat. */
function petSpot(art: Art, look: Look, x: number, feet: number, s: number, hb: number): PetSpot {
  const PET_X = x;
  const { body, head } =
    look.species === 'fish' ? { body: new Pen(art, PET_X, feet, s), head: fishPen(art, PET_X, feet, s, hb) } : pens(art, PET_X, feet, s, hb);
  const hatTop = look.hat && look.hat !== 'none' ? (HAT_TOP[look.hat] ?? -84) : 0;
  const reach = look.species === 'lion' ? MANE[look.stage]! : 0;
  const top = Math.min(
    head.at(0, Math.min(HEAD_TOP[look.species], hatTop, -58 - reach * 0.9))[1],
    look.species === 'fish' ? body.at(0, BOWL.rim - 3)[1] : feet
  );
  const half =
    look.species === 'fish'
      ? 40 * s
      : Math.max(36 * s * hb, look.species === 'dragon' ? 50 * s : 0, look.species === 'dog' || look.species === 'horse' ? 42 * s * hb : 0, reach * s * hb);
  const bottom = feet + 3;
  return {
    box: [n(PET_X - half), n(top - 2), n(half * 2), n(bottom - top + 2)],
    head: [PET_X, n(head.at(0, -84)[1])],
    // The pony's mouth is lower down its long muzzle.
    mouth: [PET_X, n(head.at(0, look.species === 'horse' ? -38 : -45)[1])],
    sounds: SOUNDS[look.species],
    treat: TREATS[look.species],
    ...(look.species === 'fish' ? { bowl: true } : {}),
  };
}

/** The slots that are the pet itself, wherever it goes; the rest are its yard and the things in it. */
export const LOOK_SLOTS = ['species', 'coat', 'pattern', 'eyes', 'collar', 'hat', 'glasses', 'outfit', 'kicks', 'aura'];

/** What it looks like at this stage with these choices. */
function lookFor(picks: Picks, stage: number): Look {
  const species = (SPECIES as readonly string[]).includes(picks.species ?? '') ? (picks.species as Species) : 'cat';
  const fish = species === 'fish';
  return {
    species,
    coat: coatFor(species, picks.coat),
    marks: marksFor(species, picks.pattern),
    eyes: picks.eyes ?? 'brown',
    stage,
    // A fish wears only what fits a fish: a bow on its head, glasses and hats.
    collar: fish && picks.collar !== 'bow' ? undefined : picks.collar,
    hat: picks.hat,
    glasses: picks.glasses,
    outfit: fish ? undefined : picks.outfit,
    kicks: fish ? undefined : picks.kicks,
    colours: Object.fromEntries(WORN_SLOTS.map((slot) => [slot, picks[slotColourKey(slot)]]).filter(([, c]) => c)),
  };
}

/**
 * How lively it is with each mood: `wag` scales its tail's swing (a fish's bobbing), `period` how
 * long each sway and breath takes, and `breath` how deeply it breathes. A sleepy pet breathes slow
 * and deep with its tail barely moving; an overjoyed one wags away.
 */
const PACE: Record<Mood, { wag: number; period: number; breath: number }> = {
  sleepy: { wag: 0.4, period: 1.6, breath: 0.04 },
  awake: { wag: 1, period: 1, breath: 0.025 },
  happy: { wag: 1.25, period: 0.75, breath: 0.025 },
  overjoyed: { wag: 1.5, period: 0.45, breath: 0.025 },
};

/**
 * Just the pet, smiling for a photo somewhere else (a postcard from an adventure): its feet at
 * (x, feet) in that picture, `s` its size, in the hour's light, wearing what it wears at home.
 */
export function petPhoto(level: number, picks: Picks, time: TimeOfDay, x: number, feet: number, s: number): Shape[] {
  const art = new Art(time, 'pet');
  art.startTint();
  const stage = stageOf(level);
  const hb = HEAD[stage]!;
  const look = lookFor(picks, stage);
  art.fill(ellipse(x, feet + 1, 30 * s, 5 * s), '#2E2A24', 0.2);
  if (look.species === 'fish') {
    const body = new Pen(art, x, feet, s);
    const head = fishPen(art, x, feet, s, hb);
    bowlBack(body);
    drawFish(head, look);
    happyFace(head, look);
    bowlFront(body);
  } else {
    const { body, head } = pens(art, x, feet, s, hb);
    tail(body, look);
    drawPet(art, x, feet, s, hb, look);
    happyFace(head, look);
  }
  return art.done().layers.flatMap((layer) => layer.shapes);
}

/**
 * The pet itself, alive: a tail that wags, a body that breathes and blinks, at (x, feet). Both your
 * own pet and a friend's visiting one (`own` false) move when you play with them and smile; the
 * friend's breathes out of step with yours. A fish bobs about in its bowl instead.
 */
function livePet(art: Art, x: number, feet: number, s: number, hb: number, look: Look, mood: Mood, own: boolean) {
  const pace = PACE[mood];
  const fish = look.species === 'fish';
  const canBlink = !look.sleepy && (!look.glasses || look.glasses === 'none' || look.glasses === 'round');
  const { body, head } = fish ? { body: new Pen(art, x, feet, s), head: fishPen(art, x, feet, s, hb) } : pens(art, x, feet, s, hb);
  // Out of step with your pet's.
  const whose = own ? { pet: true } : { guest: true, delay: 900 };
  const options = {
    ...whose,
    happy: () => happyFace(head, look),
    ...(canBlink ? { blink: () => blinkEyes(head, look) } : {}),
  };
  if (fish) {
    // The stool and bowl stay put; the fish bobs about inside.
    bowlBack(body);
    art.move({ type: 'bob', dy: 2.5 * pace.wag, period: 3000 * pace.period }, () => drawFish(head, look), options);
    bowlFront(body);
  } else {
    if (TAILS[look.species]) {
      const [tx, ty] = body.at(12, -10);
      const deg = (look.species === 'dragon' ? 4 : 8) * pace.wag;
      art.move({ type: 'sway', deg, x: tx, y: ty, period: 2600 * pace.period }, () => tail(body, look), whose);
    }
    art.move({ type: 'breathe', amount: pace.breath, x, y: feet, period: 3600 * pace.period }, () => drawPet(art, x, feet, s, hb, look), options);
  }
  return { body, head };
}

/** A group mate's pet over for the day, a little smaller than it is at home so both fit, and playable too. */
function drawGuest(art: Art, guest: Guest, [x, feet, most]: Spot) {
  const stage = stageOf(guest.level);
  const s = Math.min(SIZE[stage]!, most);
  const hb = HEAD[stage]!;
  const look = lookFor(guest.picks, stage);
  art.fill(ellipse(x, feet + 1, 30 * s, 5 * s), '#2E4A2A', 0.18);
  livePet(art, x, feet, s, hb, look, 'happy', false);
  art.guest = petSpot(art, look, x, feet, s, hb);
}

/** How a journey place (360 × 200) fills the yard's 360 × 270: scaled up to its height, cropped at the sides. */
const AWAY_K = 270 / 200;
const AWAY_X = (360 - 360 * AWAY_K) / 2;
/** Where the pet stands there: where a character stands in a journey scene, at about postcard size. */
const AWAY_PET: Spot = [108 * AWAY_K + AWAY_X, 182 * AWAY_K, AWAY_K];
const AWAY_SIZE = [0.64, 0.68, 0.71, 0.74, 0.78, 0.82];
const AWAY_GUEST: Spot = [250, 182 * AWAY_K, 0.8];

/** A journey place's shapes moved into the yard's box, ready to draw behind the pet. */
export function awayBackdrop(shapes: readonly Shape[]): Shape[] {
  return shapes.map((shape) => ({ ...shape, d: place(shape.d, AWAY_X, 0, AWAY_K) }));
}

/**
 * Your pet off on an adventure: standing in one of the journey routes' places (its sky and shapes,
 * already moved into place with awayBackdrop), playable just as at home, with any friend visiting.
 */
export function petAway(
  level: number,
  picks: Picks,
  time: TimeOfDay,
  mood: Mood,
  backdrop: { sky: readonly [string, string]; shapes: readonly Shape[] },
  guest?: Guest
): WorldArt {
  const art = new Art(time, 'pet');
  art.raw(backdrop.shapes);
  art.startTint();
  const stage = stageOf(level);
  const [x, feet, k] = AWAY_PET;
  const s = AWAY_SIZE[stage]! * k;
  const hb = HEAD[stage]!;
  const look = lookFor(picks, stage);
  if (mood === 'sleepy') look.sleepy = true;
  if (guest) drawGuest(art, guest, AWAY_GUEST);
  art.fill(ellipse(x, feet + 1, 30 * s, 5 * s), '#2E2A24', 0.2);
  livePet(art, x, feet, s, hb, look, mood, true);
  art.pet = petSpot(art, look, x, feet, s, hb);
  return art.done(backdrop.sky);
}

/**
 * Fun things for the yard, for either of its two fun spots (the shop's are bought once and go in
 * either). The first non-shop choice is a slot's default, so the second spot leads with None.
 */
const FUN_CHOICES: Choice[] = [
  { id: 'pool', label: 'Paddling pool', emoji: '💦' },
  { id: 'sandpit', label: 'Sandpit', emoji: '🪣' },
  { id: 'pond', label: 'Pond', emoji: '🐸', shop: true },
  { id: 'flowerbed', label: 'Flower beds', emoji: '🌹', shop: true },
  { id: 'trampoline', label: 'Trampoline', emoji: '🤸', shop: true },
  { id: 'swing', label: 'Swing set', emoji: '🛝', shop: true },
  { id: 'picnic', label: 'Picnic', emoji: '🍉', shop: true },
  { id: 'fountain', label: 'Fountain', emoji: '⛲', shop: true },
  { id: 'ballpit', label: 'Ball pit', emoji: '🟣', shop: true },
];

export const PET: WorldDef = {
  kind: 'pet',
  title: 'Pet',
  emoji: '🐾',
  blurb: 'A little friend who grows from a baby to a legend as you walk.',
  stages: ['Baby', 'Little', 'Young', 'Grown', 'Big', 'Legendary'],
  slots: [
    {
      id: 'species',
      title: 'Species',
      level: 0,
      choices: [
        { id: 'cat', label: 'Cat', emoji: '🐱' },
        { id: 'dog', label: 'Dog', emoji: '🐶' },
        { id: 'bunny', label: 'Bunny', emoji: '🐰' },
        { id: 'fox', label: 'Fox', emoji: '🦊' },
        { id: 'bear', label: 'Bear', emoji: '🐻' },
        { id: 'dragon', label: 'Dragon', emoji: '🐲' },
        { id: 'lion', label: 'Lion', emoji: '🦁' },
        { id: 'tiger', label: 'Tiger', emoji: '🐯' },
        { id: 'cheetah', label: 'Cheetah', emoji: '🐆' },
        { id: 'horse', label: 'Pony', emoji: '🐴' },
        { id: 'fish', label: 'Fish', emoji: '🐠' },
      ],
    },
    {
      id: 'coat',
      title: 'Colour',
      level: 0,
      choices: [
        { id: 'natural', label: 'Natural', emoji: '🐾' },
        { id: 'grey', label: 'Grey', color: COATS.grey!.main },
        { id: 'snow', label: 'Snow', color: COATS.snow!.main },
        { id: 'cream', label: 'Cream', color: COATS.cream!.main },
        { id: 'cocoa', label: 'Cocoa', color: COATS.cocoa!.main },
        { id: 'black', label: 'Black', color: COATS.black!.main },
        { id: 'peach', label: 'Peach', color: COATS.peach!.main },
        { id: 'golden', label: 'Golden', color: COATS.golden!.main, level: 15 },
        { id: 'galaxy', label: 'Galaxy', color: COATS.galaxy!.main, level: 15 },
      ],
    },
    {
      id: 'pattern',
      title: 'Pattern',
      level: 0,
      choices: [
        { id: 'natural', label: 'Natural', emoji: '🐾' },
        { id: 'tabby', label: 'Tabby stripes', emoji: '🐅' },
        { id: 'spots', label: 'Spots', emoji: '🐆' },
        { id: 'patches', label: 'Patches', emoji: '🐄' },
        { id: 'socks', label: 'Socks', emoji: '🧦' },
      ],
    },
    {
      id: 'eyes',
      title: 'Eye colour',
      level: 1,
      choices: [
        { id: 'brown', label: 'Brown', color: IRIS.brown },
        { id: 'blue', label: 'Blue', color: IRIS.blue },
        { id: 'green', label: 'Green', color: IRIS.green },
        { id: 'amber', label: 'Amber', color: IRIS.amber },
        { id: 'odd', label: 'Odd eyes', emoji: '✨' },
      ],
    },
    {
      id: 'collar',
      title: 'Collar',
      level: 2,
      choices: [
        { id: 'red', label: 'Red collar', color: '#E5534B' },
        { id: 'bandana', label: 'Blue bandana', color: '#5B9BE6' },
        { id: 'bow', label: 'Pink bow', emoji: '🎀' },
        { id: 'gold', label: 'Gold chain', color: '#F2C14E', level: 12 },
        { id: 'diamond', label: 'Diamond chain', emoji: '💎', level: 16 },
        { id: 'pearls', label: 'Pearls', emoji: '🦪', shop: true },
        { id: 'none', label: 'None' },
      ],
    },
    {
      id: 'toy',
      title: 'Toy',
      level: 3,
      choices: [
        { id: 'ball', label: 'Ball', emoji: '🔴' },
        { id: 'yarn', label: 'Yarn', emoji: '🧶' },
        { id: 'bone', label: 'Bone', emoji: '🦴' },
        { id: 'carrot', label: 'Carrot', emoji: '🥕' },
        { id: 'frisbee', label: 'Frisbee', emoji: '🥏', shop: true },
        { id: 'rope', label: 'Tug rope', emoji: '🪢', shop: true },
        { id: 'bubbles', label: 'Bubbles', emoji: '🫧', shop: true },
      ],
    },
    {
      id: 'bed',
      title: 'Bed',
      level: 4,
      choices: [
        { id: 'pink', label: 'Pink cushion', color: '#FFAFC8' },
        { id: 'blue', label: 'Blue cushion', color: '#8EC5F0' },
        { id: 'basket', label: 'Wicker basket', emoji: '🧺' },
        { id: 'cloudbed', label: 'Cloud bed', emoji: '☁️', shop: true },
        { id: 'beanbag', label: 'Beanbag', emoji: '🛋️', shop: true },
        { id: 'heartbed', label: 'Heart bed', emoji: '💗', shop: true },
      ],
    },
    {
      id: 'bowl',
      title: 'Food bowl',
      level: 5,
      choices: [
        { id: 'red', label: 'Red', color: BOWLS.red },
        { id: 'blue', label: 'Blue', color: BOWLS.blue },
        { id: 'yellow', label: 'Yellow', color: BOWLS.yellow },
      ],
    },
    {
      id: 'hat',
      title: 'Hat',
      level: 6,
      choices: [
        { id: 'party', label: 'Party hat', emoji: '🥳' },
        { id: 'beanie', label: 'Beanie', emoji: '🧶' },
        { id: 'flowers', label: 'Flower crown', emoji: '🌸' },
        { id: 'snapback', label: 'Snapback', emoji: '🧢', level: 12 },
        { id: 'bucket', label: 'Bucket hat', emoji: '👒', level: 12 },
        { id: 'crown', label: 'Crown', emoji: '👑', level: 13 },
        { id: 'wizard', label: 'Wizard hat', emoji: '🧙', level: 13 },
        { id: 'tophat', label: 'Top hat', emoji: '🎩', level: 13 },
        { id: 'lenin-cap', label: 'Flat cap', emoji: '🧢', shop: true },
        { id: 'tricorn', label: 'Pirate hat', emoji: '🏴‍☠️', shop: true },
        { id: 'tiara', label: 'Tiara', emoji: '👸', shop: true },
        { id: 'hairbow', label: 'Hair bow', emoji: '🎀', shop: true },
        { id: 'sunhat', label: 'Sun hat', emoji: '🌺', shop: true },
        { id: 'none', label: 'None' },
      ],
    },
    {
      id: 'buddy',
      title: 'Little buddy',
      level: 7,
      choices: [
        { id: 'butterfly', label: 'Butterfly', emoji: '🦋' },
        { id: 'bird', label: 'Bird', emoji: '🐦' },
        { id: 'duckling', label: 'Duckling', emoji: '🐥' },
        { id: 'hedgehog', label: 'Hedgehog', emoji: '🦔', shop: true },
        { id: 'none', label: 'None' },
      ],
    },
    {
      id: 'house',
      title: 'Pet house',
      level: 8,
      choices: [
        { id: 'red', label: 'Red kennel', color: KENNELS.red },
        { id: 'blue', label: 'Blue kennel', color: KENNELS.blue },
        { id: 'pink', label: 'Pink kennel', color: KENNELS.pink },
        { id: 'cottage', label: 'Cottage', emoji: '🏠', shop: true },
        { id: 'treehouse', label: 'Treehouse', emoji: '🌳', shop: true },
        { id: 'tent', label: 'Play tent', emoji: '⛺', shop: true },
        { id: 'castle', label: 'Castle', emoji: '🏰', shop: true },
        { id: 'igloo', label: 'Igloo', emoji: '🧊', shop: true },
      ],
    },
    {
      id: 'yard',
      title: 'Yard',
      level: 9,
      choices: [
        { id: 'backyard', label: 'Backyard', emoji: '🏡' },
        { id: 'beach', label: 'Beach', emoji: '🏖️' },
        { id: 'snowy', label: 'Snowy', emoji: '❄️' },
        { id: 'meadow', label: 'Meadow', emoji: '🌼' },
      ],
    },
    {
      id: 'glasses',
      title: 'Glasses',
      level: 10,
      choices: [
        { id: 'round', label: 'Round', emoji: '👓' },
        { id: 'shades', label: 'Sunglasses', emoji: '🕶️' },
        { id: 'heart', label: 'Heart', emoji: '💗' },
        { id: 'iced', label: 'Iced-out shades', emoji: '💎', level: 15 },
        { id: 'none', label: 'None' },
      ],
    },
    {
      id: 'outfit',
      title: 'Outfit',
      level: 11,
      choices: [
        { id: 'cape', label: 'Hero cape', emoji: '🦸' },
        { id: 'scarf', label: 'Scarf', emoji: '🧣' },
        { id: 'sweater', label: 'Sweater', emoji: '🧶' },
        { id: 'hoodie', label: 'Hoodie', emoji: '💜', level: 13 },
        { id: 'puffer', label: 'Puffer jacket', emoji: '🧥', level: 13 },
        { id: 'lenin-suit', label: 'Three-piece suit', emoji: '👔', shop: true },
        { id: 'tuxedo', label: 'Tuxedo', emoji: '🤵', shop: true },
        { id: 'raincoat', label: 'Raincoat', emoji: '☔', shop: true },
        { id: 'pirate-coat', label: 'Pirate coat', emoji: '🏴‍☠️', shop: true },
        { id: 'tutu', label: 'Tutu', emoji: '🩰', shop: true },
        { id: 'sundress', label: 'Sundress', emoji: '🌼', shop: true },
        { id: 'gown', label: 'Princess gown', emoji: '👗', shop: true },
        { id: 'fairy', label: 'Fairy dress', emoji: '🧚', shop: true },
        { id: 'cardigan', label: 'Cardigan', emoji: '🩷', shop: true },
        { id: 'overalls', label: 'Dungarees', emoji: '👖', shop: true },
        { id: 'jersey', label: 'Football shirt', emoji: '⚽', shop: true },
        { id: 'none', label: 'None' },
      ],
    },
    {
      id: 'fun',
      title: 'Fun',
      level: 12,
      choices: [...FUN_CHOICES, { id: 'none', label: 'None' }],
    },
    // A second spot for something fun, on the other side of the yard: empty until you choose.
    { id: 'fun2', title: 'More fun', level: 12, choices: [{ id: 'none', label: 'None' }, ...FUN_CHOICES] },
    {
      id: 'friend',
      title: 'Second pet',
      level: 14,
      choices: [
        { id: 'kitten', label: 'Kitten', emoji: '🐱' },
        { id: 'puppy', label: 'Puppy', emoji: '🐶' },
        { id: 'bunny', label: 'Bunny', emoji: '🐰' },
        { id: 'chick', label: 'Chick', emoji: '🐥' },
        { id: 'none', label: 'None' },
      ],
    },
    {
      id: 'kicks',
      title: 'Kicks',
      level: 15,
      choices: [
        { id: 'white', label: 'Fresh whites', color: KICKS.white!.shoe },
        { id: 'red', label: 'Red', color: KICKS.red!.shoe },
        { id: 'gold', label: 'Gold', color: KICKS.gold!.shoe },
        { id: 'none', label: 'None' },
      ],
    },
    { id: 'sky', title: 'In the sky', level: 16, choices: SKY_CHOICES },
    // A full passport page's keepsake for the yard: its choices are souvenirs (below), not unlocks.
    { id: 'keepsake', title: 'Keepsake', level: 0, shop: true, choices: [{ id: 'none', label: 'None' }] },
    {
      id: 'flag',
      title: 'Flag',
      level: 0,
      shop: true,
      choices: [
        { id: 'flag-ussr', label: 'USSR', emoji: '☭', shop: true },
        { id: 'flag-pirate', label: 'Pirate', emoji: '🏴‍☠️', shop: true },
        { id: 'flag-rainbow', label: 'Rainbow', emoji: '🏳️‍🌈', shop: true },
        { id: 'flag-canada', label: 'Canada', emoji: '🇨🇦', shop: true },
        { id: 'flag-uk', label: 'United Kingdom', emoji: '🇬🇧', shop: true },
        { id: 'flag-usa', label: 'United States', emoji: '🇺🇸', shop: true },
        { id: 'flag-italy', label: 'Italy', emoji: '🇮🇹', shop: true },
        { id: 'flag-china', label: 'China', emoji: '🇨🇳', shop: true },
        { id: 'flag-bulgaria', label: 'Bulgaria', emoji: '🇧🇬', shop: true },
        { id: 'flag-lebanon', label: 'Lebanon', emoji: '🇱🇧', shop: true },
        { id: 'flag-japan', label: 'Japan', emoji: '🇯🇵', shop: true },
        { id: 'flag-bangladesh', label: 'Bangladesh', emoji: '🇧🇩', shop: true },
        { id: 'none', label: 'None' },
      ],
    },
    {
      id: 'party',
      title: 'Party',
      level: 0,
      shop: true,
      choices: [
        { id: 'disco', label: 'Disco ball', emoji: '🪩', shop: true },
        { id: 'bunting', label: 'Bunting', emoji: '🎏', shop: true },
        { id: 'fairy-lights', label: 'Fairy lights', emoji: '💡', shop: true },
        { id: 'pinata', label: 'Piñata', emoji: '🪅', shop: true },
        { id: 'paper-lanterns', label: 'Paper lanterns', emoji: '🏮', shop: true },
        { id: 'none', label: 'None' },
      ],
    },
    {
      id: 'season',
      title: 'Seasonal',
      level: 0,
      shop: true,
      choices: [
        { id: 'pumpkins', label: 'Pumpkins', emoji: '🎃', shop: true },
        { id: 'festive-tree', label: 'Festive tree', emoji: '🎄', shop: true },
        { id: 'tulips', label: 'Tulips', emoji: '🌷', shop: true },
        { id: 'sunflowers', label: 'Sunflowers', emoji: '🌻', shop: true },
        { id: 'none', label: 'None' },
      ],
    },
    {
      id: 'aura',
      title: 'Legendary glow',
      level: 17,
      choices: [
        { id: 'golden', label: 'Golden', emoji: '✨' },
        { id: 'rainbow', label: 'Rainbow', emoji: '🌈' },
        { id: 'stars', label: 'Stars', emoji: '⭐' },
      ],
    },
  ],

  // Brought home from trips (src/lib/pet-adventures.ts): the first visit to each country or fantasy
  // land earns its hat. Filling a country's passport page (src/lib/passport.ts) earns its keepsake
  // for the yard.
  souvenirs: [
    { from: 'united-kingdom', slot: 'hat', choice: { id: 'guard', label: "Guard's bearskin", emoji: '💂' } },
    { from: 'canada', slot: 'hat', choice: { id: 'toque', label: 'Maple toque', emoji: '🍁' } },
    { from: 'spain', slot: 'hat', choice: { id: 'rose', label: 'Flamenco rose', emoji: '🌹' } },
    { from: 'italy', slot: 'hat', choice: { id: 'boater', label: "Gondolier's boater", emoji: '🛶' } },
    { from: 'united-states', slot: 'hat', choice: { id: 'cowboy', label: 'Cowboy hat', emoji: '🤠' } },
    { from: 'china', slot: 'hat', choice: { id: 'panda', label: 'Panda ears', emoji: '🐼' } },
    { from: 'candy-kingdom', slot: 'hat', choice: { id: 'cupcake', label: 'Cupcake hat', emoji: '🧁' } },
    { from: 'dragon-peaks', slot: 'hat', choice: { id: 'horns', label: 'Dragon horns', emoji: '🐉' } },
    { from: 'cloud-kingdom', slot: 'hat', choice: { id: 'halo', label: 'Halo', emoji: '😇' } },
    { from: 'mermaid-lagoon', slot: 'hat', choice: { id: 'shells', label: 'Seashell tiara', emoji: '🐚' } },
    { from: 'moon-base', slot: 'hat', choice: { id: 'helmet', label: 'Space helmet', emoji: '🧑‍🚀' } },
    { from: 'enchanted-forest', slot: 'hat', choice: { id: 'mushroom', label: 'Toadstool cap', emoji: '🍄' } },
    { from: 'united-kingdom', slot: 'keepsake', full: true, choice: { id: 'phone-box', label: 'Phone box', emoji: '☎️' } },
    { from: 'canada', slot: 'keepsake', full: true, choice: { id: 'inukshuk', label: 'Inukshuk', emoji: '🪨' } },
    { from: 'spain', slot: 'keepsake', full: true, choice: { id: 'shell-marker', label: 'Camino marker', emoji: '🐚' } },
    { from: 'italy', slot: 'keepsake', full: true, choice: { id: 'gelato-cart', label: 'Gelato cart', emoji: '🍨' } },
    { from: 'united-states', slot: 'keepsake', full: true, choice: { id: 'route-sign', label: 'Route 66 sign', emoji: '🛣️' } },
    { from: 'china', slot: 'keepsake', full: true, choice: { id: 'lanterns', label: 'Lanterns', emoji: '🏮' } },
  ],

  draw(level, picks, time, _steps, mood = 'awake', guest) {
    const art = new Art(time, 'pet');
    const stage = stageOf(level);
    const s = SIZE[stage]!;
    const hb = HEAD[stage]!;
    const feet = FEET[stage]!;
    const layout = LAYOUT[stage]!;
    const look = lookFor(picks, stage);
    // Dozing until you've walked a bit, eyes closed.
    if (mood === 'sleepy') look.sleepy = true;
    // The middle of the pet, for its legendary glow.
    const centre = feet - (look.species === 'fish' ? 62 : 50) * s;

    drawSky(art);
    if (picks.sky === 'rainbow') drawRainbow(art);
    (YARDS[picks.yard ?? 'backyard'] ?? backyard)(art);
    if (picks.sky === 'balloon') drawBalloon(art, ...layout.balloon);
    if (picks.sky === 'kites') drawKites(art, layout.kites);
    // Things in the yard, each in the colour chosen for it.
    const paint = (slot: string, draw: () => void) => art.colouring(picks[slotColourKey(slot)], slot, draw);
    if (picks.party && picks.party !== 'none') paint('party', () => party(art, picks.party!));
    if (picks.flag && picks.flag !== 'none') flag(art, picks.flag, layout.flag);
    if (stage === 5) glow(art, picks.aura ?? 'golden', PET_X, centre, s);

    const { house, season, fun: fun_, fun2, keepsake: kept, bed: bed_ } = picks;
    if (house) {
      paint('house', () => {
        const drawHouse = HOUSES[house];
        if (drawHouse) drawHouse(art, layout.kennel);
        else kennel(art, KENNELS[house] ?? KENNELS.red!, layout.kennel);
      });
    }
    if (season && season !== 'none') paint('season', () => seasonal(art, season, layout.season));
    if (fun_ && fun_ !== 'none') paint('fun', () => fun(art, fun_, layout.fun));
    if (fun2 && fun2 !== 'none') paint('fun2', () => fun(art, fun2, layout.fun2));
    if (kept && kept !== 'none') paint('keepsake', () => keepsake(art, kept, layout.keepsake));
    if (bed_) {
      paint('bed', () => bed(art, bed_, layout.bed));
      if (picks.friend && picks.friend !== 'none') drawFriend(art, picks.friend, layout.bed);
      paint('bed', () => bedFront(art, bed_, layout.bed));
    }
    if (guest) drawGuest(art, guest, layout.guest);

    // A warm pool of light after dark and a soft shadow, which stay put while the pet moves.
    if (art.dark) art.light(ellipse(PET_X, feet - 4, 70 * s, 22 * s), '#FFE9B0', 0.08);
    art.fill(ellipse(PET_X, feet + 1, 30 * s, 5 * s), '#2E4A2A', 0.18);
    const { body, head } = livePet(art, PET_X, feet, s, hb, look, mood, true);

    const { bowl, toy: plaything, buddy: pal } = picks;
    if (bowl) paint('bowl', () => foodBowl(art, BOWLS[bowl] ?? BOWLS.red!, layout.bowl));
    if (plaything) paint('toy', () => toy(art, plaything, layout.toy));
    if (pal && pal !== 'none') paint('buddy', () => buddy(art, pal, layout));
    if (stage === 5) sparkles(art, picks.aura ?? 'golden', PET_X, centre, s, look, body, head);
    art.pet = petSpot(art, look, PET_X, feet, s, hb);
    return art.done();
  },
};
