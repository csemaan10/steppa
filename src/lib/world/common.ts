// Worlds: a pet of your own, in its yard, that grows with every step you take after adopting it.
// This file holds the milestone ladder, the types a world is described with, a painter, and the
// outdoor sky and ground, kept apart from the pet so other kinds of world could join it one day.
//
// Like the journey scenes (src/lib/scene-art.ts), a world is pure geometry, no React: a draw function
// returns the sky's gradient and back-to-front layers of filled SVG paths in a 360 × 270 box. Most of
// it holds still in one layer; the few things that move (clouds, fish, a pet breathing) get layers of
// their own, which src/components/world-scene.tsx animates on the UI thread.
//
// Style: soft, rounded, flat shapes with no outlines; depth comes from a slightly darker shade on the
// shadow side and a lighter sheen on top. Colours are bright but gentle (pastels, warm wood, fresh
// greens). Shapes of one colour are joined into one path, so even a fully grown world stays cheap to draw.

import {
  arch,
  circle,
  ellipse,
  hash,
  mix,
  n,
  poly,
  rect,
  ring,
  seeded,
  SKY,
  TINT,
  type Shape,
  type TimeOfDay,
} from '@/lib/scene-art';
import { baseOf, itemColour, recolour, type ColourBase } from '@/lib/world/colours';
import type { Mood } from '@/lib/world/mood';

export { arch, circle, ellipse, hash, mix, n, poly, rect, ring, seeded, type Shape, type TimeOfDay };

export const WORLD_WIDTH = 360;
export const WORLD_HEIGHT = 270;
const W = WORLD_WIDTH;
const H = WORLD_HEIGHT;
/** Where the far ground meets the sky in the outdoor worlds. */
export const HORIZON = 168;

// ---------- Milestones ----------

/** Lifetime steps for each level; every one unlocks something. */
export const LEVELS = [
  0, 10_000, 25_000, 50_000, 100_000, 175_000, 250_000, 375_000, 500_000, 750_000, 1_000_000, 1_500_000,
  2_000_000, 3_000_000, 4_000_000, 5_000_000, 7_500_000, 10_000_000,
] as const;
export const MAX_LEVEL = LEVELS.length - 1;
/** The levels where a world grows into its next stage (six stages, 0–5). */
export const STAGE_LEVELS = [0, 3, 6, 10, 13, 17] as const;

/** The level reached with this many steps. */
export function levelOf(steps: number): number {
  let level = 0;
  while (level < MAX_LEVEL && steps >= LEVELS[level + 1]!) level++;
  return level;
}

/** The growth stage (0–5) at a level. */
export function stageOf(level: number): number {
  let stage = 0;
  while (stage < STAGE_LEVELS.length - 1 && level >= STAGE_LEVELS[stage + 1]!) stage++;
  return stage;
}

// ---------- Describing a world ----------

export const WORLD_KINDS = ['pet'] as const;
export type WorldKind = (typeof WORLD_KINDS)[number];

/**
 * One option for a slot. `level` unlocks it later than its slot (a golden tree at 5M). A `shop` one is
 * bought with treats (src/lib/shop.ts) and can be chosen once it's yours, whatever the level.
 */
export type Choice = { id: string; label: string; emoji?: string; color?: string; level?: number; shop?: boolean };

/**
 * Something to customise, unlocked at a level: a colour, a decoration, a new fish. Its first choice
 * is the default, so the world gains it the moment it unlocks. Decorations end with a 'none' choice.
 * A `shop` slot only holds things from the shop (the seasonal ones), so it shows once you own one.
 */
export type Slot = { id: string; title: string; level: number; choices: Choice[]; shop?: boolean };

/** Chosen option id for each unlocked slot. Draw functions only ever see complete, valid picks. */
export type Picks = Record<string, string>;

/**
 * Something brought home from a trip rather than unlocked by walking: a choice for `slot`, earned
 * by first visiting `from` (a destination in src/lib/pet-adventures.ts), or, if `full`, by filling
 * its passport page (the server hands those out: stamp_passport, migration 022). Usable at any level.
 */
export type Souvenir = { from: string; slot: string; choice: Choice; full?: boolean };

export type WorldDef = {
  kind: WorldKind;
  /** "Pet", "City"... */
  title: string;
  emoji: string;
  /** One line for the picker. */
  blurb: string;
  /** What it's called at each stage, smallest first. */
  stages: readonly [string, string, string, string, string, string];
  slots: Slot[];
  /** Kept apart from the slots' own choices, so milestones never list them. */
  souvenirs?: Souvenir[];
  /**
   * `steps` lets a world keep growing between milestones (the city adds buildings as you walk);
   * `mood` is how the pet feels today (a calm, wide-awake pet without one); `guest` is a friend's pet
   * over for a playdate.
   */
  draw(level: number, picks: Picks, time: TimeOfDay, steps: number, mood?: Mood, guest?: Guest): WorldArt;
};

/** A group mate's pet visiting for the day: how grown it is and what it wears. */
export type Guest = { level: number; picks: Picks };

// ---------- Art ----------

/** How a layer moves; lengths are in scene units, periods in ms. Everything eases gently, no bounce. */
export type Motion =
  /** Sways side to side by ±dx and back (clouds, a boat at anchor). */
  | { type: 'drift'; dx: number; period: number }
  /** Floats up and down by ±dy (a balloon, a fish hovering). */
  | { type: 'bob'; dy: number; period: number }
  /** Glides dx at a steady pace, then starts over; `phase` (0–1) is where it starts. It must begin
   *  and end out of view, or outside its clip (fish crossing a tank, a tram crossing town). */
  | { type: 'cross'; dx: number; period: number; phase?: number }
  /** Floats up dy, fading out at the top, then starts over (bubbles, chimney smoke). */
  | { type: 'rise'; dy: number; period: number; phase?: number }
  /** Rocks ±deg about (x, y) (a swing, a flower, a wagging tail). */
  | { type: 'sway'; deg: number; x: number; y: number; period: number }
  /** Grows taller by `amount` (0.03 = 3%) about (x, y) and back (a pet breathing). */
  | { type: 'breathe'; amount: number; x: number; y: number; period: number }
  /** Fades between `min` and full (fireflies, string lights). */
  | { type: 'twinkle'; min: number; period: number };

export type Layer = {
  shapes: Shape[];
  motion?: Motion;
  /** ms before it starts, so similar things don't move in step. */
  delay?: number;
  /** Only the part inside this box shows: [x, y, width, height] (fish inside their tank). */
  clip?: readonly [number, number, number, number];
  /** Drawn over the layer for a moment every few seconds, moving with it (a pet's closed eyes). */
  blink?: Shape[];
  /** Part of the pet: it moves with the pet when you play with it (hops, wiggles, turns, squishes). */
  pet?: boolean;
  /** Drawn over the layer while the pet is enjoying itself (happy closed eyes, a bigger blush). */
  happy?: Shape[];
  /** A little buddy that joins in: it hops along, lower, whenever the pet hops. */
  follow?: boolean;
  /** Part of a friend's pet over for the day: it moves when you play with that pet instead. */
  guest?: boolean;
};

/** Where the pet is, for playing with it. */
export type PetSpot = {
  /** The box to tap or hold, at the pet's current size. */
  box: readonly [number, number, number, number];
  /** The top of its head: hearts float up from here. */
  head: readonly [number, number];
  /** Its mouth: treats and the fetch ball end up here. */
  mouth: readonly [number, number];
  /** What it says, taken in turn ("Purr!", "Mrrp?"...). */
  sounds: readonly string[];
  /** Its favourite treat, as an emoji (🐟 for a cat, 🦴 for a dog). */
  treat: string;
  /** It lives in a bowl, so its tricks stay small enough to keep it inside. */
  bowl?: boolean;
};

/** `guest` is where a friend's pet stands, when one's in the picture, so it can be played with too. */
export type WorldArt = { sky: readonly [string, string]; layers: Layer[]; pet?: PetSpot; guest?: PetSpot };

/** Darker by `amount` (0–1). */
export const darker = (color: string, amount: number) => mix(color, '#000000', amount);
/** Lighter by `amount` (0–1). */
export const lighter = (color: string, amount: number) => mix(color, '#FFFFFF', amount);

export function roundRect(x: number, y: number, w: number, h: number, r: number): string {
  const q = Math.min(r, w / 2, h / 2);
  return (
    `M${n(x + q)} ${n(y)}h${n(w - 2 * q)}a${n(q)} ${n(q)} 0 0 1 ${n(q)} ${n(q)}v${n(h - 2 * q)}` +
    `a${n(q)} ${n(q)} 0 0 1 ${n(-q)} ${n(q)}h${n(-(w - 2 * q))}a${n(q)} ${n(q)} 0 0 1 ${n(-q)} ${n(-q)}` +
    `v${n(-(h - 2 * q))}a${n(q)} ${n(q)} 0 0 1 ${n(q)} ${n(-q)}Z`
  );
}

/** A star with `points` tips. */
export function star(cx: number, cy: number, r: number, points = 5, inner = 0.45): string {
  const pts: number[] = [];
  for (let i = 0; i < points * 2; i++) {
    const a = (Math.PI * i) / points - Math.PI / 2;
    const radius = i % 2 ? r * inner : r;
    pts.push(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius);
  }
  return poly(...pts);
}

export function heart(cx: number, cy: number, s: number): string {
  return (
    `M${n(cx)} ${n(cy + s * 0.9)}C${n(cx - s * 1.3)} ${n(cy + s * 0.1)} ${n(cx - s * 0.9)} ${n(cy - s * 0.95)} ` +
    `${n(cx)} ${n(cy - s * 0.35)}C${n(cx + s * 0.9)} ${n(cy - s * 0.95)} ${n(cx + s * 1.3)} ${n(cy + s * 0.1)} ${n(cx)} ${n(cy + s * 0.9)}Z`
  );
}

/** A puff of overlapping circles along a line (a bush, a cloud, a tree's crown). */
export function puff(cx: number, cy: number, w: number, h: number): string {
  return (
    ellipse(cx, cy + h * 0.15, w * 0.5, h * 0.35) +
    circle(cx - w * 0.22, cy, h * 0.36) +
    circle(cx + w * 0.05, cy - h * 0.18, h * 0.42) +
    circle(cx + w * 0.26, cy + h * 0.02, h * 0.32)
  );
}

/**
 * Collects a world's shapes, back to front. `fill` takes on the hour's colour (dusk purples, night
 * blues), as in the journey scenes; `light` doesn't, for anything that glows after dark. `move` draws
 * a moving piece into its own layer.
 */
export class Art {
  readonly time: TimeOfDay;
  readonly night: boolean;
  readonly dusk: boolean;
  /** Dusk or night: when windows and lanterns light up. */
  readonly dark: boolean;
  readonly rand: () => number;
  private tint: { color: string; amount: number } | null = null;
  private readonly layers: Layer[] = [{ shapes: [] }];
  private current: Shape[];

  constructor(time: TimeOfDay, seed: string) {
    this.time = time;
    this.night = time === 'night';
    this.dusk = time === 'dusk';
    this.dark = this.night || this.dusk;
    this.rand = seeded(hash(seed));
    this.current = this.layers[0]!.shapes;
  }

  /** From here on, colours take on the hour's tint (call once the sky is drawn). */
  startTint(amount = 1) {
    const t = TINT[this.time];
    this.tint = t ? { color: t.color, amount: t.amount * amount } : null;
  }

  /** The colour as it looks at this hour. */
  tinted(color: string): string {
    return this.tint ? mix(color, this.tint.color, this.tint.amount) : color;
  }

  /** While drawing something in a chosen colour, turns its paints to that colour (see `colouring`). */
  private recolouring: ((color: string) => string) | null = null;
  /** The main colour of each thing drawn in a chosen colour, by key, so its parts all match. */
  private readonly bases = new Map<string, ColourBase>();

  /**
   * Draws whatever `draw` paints with its main colour family in `colour` (an ITEM_COLOURS id; as it
   * is without one). `key` names the thing, so parts drawn at different times match; `base` is its
   * main colour if known, else the first colourful paint decides.
   */
  colouring(colour: string | undefined, key: string, draw: () => void, base?: string) {
    const target = itemColour(colour);
    if (!target) {
      draw();
      return;
    }
    if (base && !this.bases.has(key)) {
      const known = baseOf(base);
      if (known) this.bases.set(key, known);
    }
    const before = this.recolouring;
    this.recolouring = (color) => {
      let found = this.bases.get(key);
      if (!found) {
        const first = baseOf(color);
        if (!first) return color;
        this.bases.set(key, first);
        found = first;
      }
      return recolour(color, target, found);
    };
    try {
      draw();
    } finally {
      this.recolouring = before;
    }
  }

  fill(d: string, color: string, opacity?: number) {
    if (!d) return;
    const fill = this.tinted(this.recolouring ? this.recolouring(color) : color);
    this.current.push(opacity === undefined ? { d, fill } : { d, fill, opacity });
  }

  /** Something that glows after dark, so it skips the tint. */
  light(d: string, color: string, opacity?: number) {
    if (!d) return;
    if (this.recolouring) color = this.recolouring(color);
    this.current.push(opacity === undefined ? { d, fill: color } : { d, fill: color, opacity });
  }

  /** Shapes already coloured for the hour (a journey place behind the pet), as they are. */
  raw(shapes: readonly Shape[]) {
    this.current.push(...shapes);
  }

  /**
   * Draws whatever `draw` paints into a moving layer of its own, then carries on in a still one.
   * `blink` and `happy` paint the layer's closed-eye and happy overlays; `pet` makes it hop on a tap,
   * `follow` makes it hop along after the pet, and `guest` makes it part of a visiting friend's pet.
   */
  move(
    motion: Motion,
    draw: () => void,
    options: {
      delay?: number;
      clip?: Layer['clip'];
      blink?: () => void;
      happy?: () => void;
      pet?: boolean;
      follow?: boolean;
      guest?: boolean;
    } = {}
  ) {
    const layer: Layer = { shapes: [], motion };
    if (options.delay) layer.delay = options.delay;
    if (options.clip) layer.clip = options.clip;
    if (options.pet) layer.pet = true;
    if (options.follow) layer.follow = true;
    if (options.guest) layer.guest = true;
    this.layers.push(layer);
    this.current = layer.shapes;
    draw();
    if (options.blink) {
      layer.blink = [];
      this.current = layer.blink;
      options.blink();
    }
    if (options.happy) {
      layer.happy = [];
      this.current = layer.happy;
      options.happy();
    }
    const still: Layer = { shapes: [] };
    this.layers.push(still);
    this.current = still.shapes;
  }

  between(min: number, max: number) {
    return min + this.rand() * (max - min);
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.rand() * items.length)]!;
  }

  /** Where the pet stands, so it can be tapped. */
  pet?: PetSpot;
  /** Where a friend's pet over for the day stands, so it can be tapped too. */
  guest?: PetSpot;

  done(sky: readonly [string, string] = SKY[this.time]): WorldArt {
    const art: WorldArt = { sky, layers: this.layers.filter((l) => l.shapes.length) };
    if (this.pet) art.pet = this.pet;
    if (this.guest) art.guest = this.guest;
    return art;
  }
}

// ---------- Outdoors ----------

/**
 * Sun or moon and stars, then two clouds drifting (not at night). Starts the tint once done. The sky
 * has its own random numbers, so whatever comes after it looks the same at every hour.
 */
export function drawSky(art: Art) {
  const rand = seeded(hash('sky'));
  const between = (min: number, max: number) => min + rand() * (max - min);
  if (art.night) {
    const stars: string[] = [];
    for (let i = 0; i < 40; i++) stars.push(circle(between(0, W), between(4, 130), between(0.4, 1.2)));
    art.fill(stars.join(''), '#FFFFFF', 0.85);
    art.fill(circle(300, 44, 26), '#F4F1DE', 0.12);
    art.fill(circle(300, 44, 14), '#F4F1DE');
    art.fill(circle(295, 40, 2.8) + circle(304, 49, 2) + circle(305, 38, 1.5), '#D9D4BC', 0.8);
  } else {
    const sun = {
      dawn: { x: 296, y: 128, r: 20, color: '#FFE0AE' },
      day: { x: 302, y: 46, r: 17, color: '#FFF6CF' },
      dusk: { x: 300, y: 124, r: 22, color: '#FFB27E' },
    }[art.time as 'dawn' | 'day' | 'dusk'];
    art.fill(circle(sun.x, sun.y, sun.r * 1.9), sun.color, 0.28);
    art.fill(circle(sun.x, sun.y, sun.r), sun.color);
    const color = art.dusk ? '#F6C3C6' : art.time === 'dawn' ? '#FFE4D2' : '#FFFFFF';
    const clouds = [
      [between(40, 110), between(30, 52), between(0.85, 1.1)],
      [between(170, 230), between(20, 40), between(0.6, 0.85)],
    ] as const;
    clouds.forEach(([cx, cy, s], i) => {
      art.move(
        { type: 'drift', dx: 10 + i * 4, period: 26000 + i * 7000 },
        () => art.fill(cloud(cx, cy, s), color, 0.88),
        { delay: i * 3000 }
      );
    });
  }
  art.startTint();
}

export function cloud(cx: number, cy: number, s: number): string {
  return ellipse(cx, cy, 24 * s, 8 * s) + circle(cx - 9 * s, cy - 5 * s, 9 * s) + circle(cx + 7 * s, cy - 8 * s, 11 * s);
}

/** Two rows of soft rolling hills down to the horizon. */
export function drawHills(art: Art, far = '#B5DCA9', near = '#94C98A') {
  art.fill(`M0 ${HORIZON - 30}C60 ${HORIZON - 52} 130 ${HORIZON - 34} 190 ${HORIZON - 42}S310 ${HORIZON - 58} 360 ${HORIZON - 36}V${H}H0Z`, far);
  art.fill(`M0 ${HORIZON - 8}C80 ${HORIZON - 26} 150 ${HORIZON - 10} 230 ${HORIZON - 18}S330 ${HORIZON - 24} 360 ${HORIZON - 12}V${H}H0Z`, near);
}

/** The lawn from the horizon down, with a lighter strip of light across it and a few tufts. */
export function drawLawn(art: Art, color = '#7DBE6E') {
  art.fill(`M0 ${HORIZON}C90 ${HORIZON - 6} 250 ${HORIZON + 4} 360 ${HORIZON - 2}V${H}H0Z`, color);
  art.fill(`M0 ${HORIZON + 34}C110 ${HORIZON + 22} 250 ${HORIZON + 40} 360 ${HORIZON + 28}V${HORIZON + 46}C240 ${HORIZON + 56} 120 ${HORIZON + 38} 0 ${HORIZON + 50}Z`, lighter(color, 0.12));
  const tufts: string[] = [];
  for (let i = 0; i < 14; i++) {
    const x = art.between(6, W - 6);
    const y = art.between(HORIZON + 12, H - 6);
    tufts.push(poly(x - 3, y, x - 1, y - 6, x, y - 1, x + 2, y - 7, x + 3, y));
  }
  art.fill(tufts.join(''), darker(color, 0.12));
}

// ---------- In the sky (shared by every outdoor world's "In the sky" slot) ----------

export const SKY_CHOICES: Choice[] = [
  { id: 'rainbow', label: 'Rainbow', emoji: '🌈' },
  { id: 'balloon', label: 'Hot-air balloon', emoji: '🎈' },
  { id: 'kites', label: 'Kites', emoji: '🪁' },
  { id: 'none', label: 'None' },
];

/** A rainbow behind the hills: draw it straight after the sky. Faint after dark, like moonlight. */
export function drawRainbow(art: Art, cx = 110, cy = HORIZON - 6, r = 120) {
  const bands = ['#FF8A8A', '#FFC27A', '#FFE58A', '#A8E39A', '#8CC8F2', '#B9A2EE'];
  const opacity = art.night ? 0.22 : art.dusk ? 0.4 : 0.55;
  bands.forEach((color, i) => {
    const outer = r - i * 6;
    const inner = outer - 6;
    art.fill(
      `M${n(cx - outer)} ${n(cy)}A${n(outer)} ${n(outer)} 0 0 1 ${n(cx + outer)} ${n(cy)}H${n(cx + inner)}A${n(inner)} ${n(inner)} 0 0 0 ${n(cx - inner)} ${n(cy)}Z`,
      color,
      opacity
    );
  });
}

/** A striped hot-air balloon gently bobbing. */
export function drawBalloon(art: Art, x: number, y: number, s: number, colors: readonly [string, string] = ['#FF8FA3', '#FFE08A']) {
  art.move({ type: 'bob', dy: 4, period: 5200 }, () => {
    const r = 15 * s;
    art.fill(`M${n(x - r)} ${n(y)}A${n(r)} ${n(r)} 0 1 1 ${n(x + r)} ${n(y)}C${n(x + r)} ${n(y + r * 0.8)} ${n(x + r * 0.35)} ${n(y + r * 1.15)} ${n(x + r * 0.3)} ${n(y + r * 1.35)}H${n(x - r * 0.3)}C${n(x - r * 0.35)} ${n(y + r * 1.15)} ${n(x - r)} ${n(y + r * 0.8)} ${n(x - r)} ${n(y)}Z`, colors[0]);
    art.fill(`M${n(x - r * 0.3)} ${n(y - r)}C${n(x - r * 0.45)} ${n(y)} ${n(x - r * 0.25)} ${n(y + r)} ${n(x - r * 0.12)} ${n(y + r * 1.35)}H${n(x + r * 0.12)}C${n(x + r * 0.25)} ${n(y + r)} ${n(x + r * 0.45)} ${n(y)} ${n(x + r * 0.3)} ${n(y - r)}Z`, colors[1]);
    art.fill(rect(x - r * 0.28, y + r * 1.35, r * 0.06, r * 0.5) + rect(x + r * 0.22, y + r * 1.35, r * 0.06, r * 0.5), '#8D6E63');
    art.fill(roundRect(x - r * 0.32, y + r * 1.8, r * 0.64, r * 0.45, r * 0.08), '#B07A4F');
  });
}

/** Two kites on long strings, swaying. */
export function drawKites(art: Art, anchors: readonly (readonly [number, number])[] = [[60, 205], [250, 200]]) {
  const kites = [
    { dx: 30, dy: -150, color: '#FF8FA3', tail: '#FFD36E' },
    { dx: -26, dy: -128, color: '#7FC8F8', tail: '#FF9E7A' },
  ];
  anchors.slice(0, 2).forEach(([ax, ay], i) => {
    const k = kites[i]!;
    const x = ax + k.dx;
    const y = ay + k.dy;
    art.move(
      { type: 'sway', deg: 3, x: ax, y: ay, period: 4200 + i * 900 },
      () => {
        art.fill(`M${n(ax)} ${n(ay)}Q${n((ax + x) / 2 + 12)} ${n((ay + y) / 2)} ${n(x)} ${n(y + 13)}l0.6 0Q${n((ax + x) / 2 + 13)} ${n((ay + y) / 2)} ${n(ax + 0.6)} ${n(ay)}Z`, '#FFFFFF', 0.7);
        art.fill(poly(x, y - 12, x + 9, y, x, y + 13, x - 9, y), k.color);
        art.fill(poly(x, y - 12, x + 9, y, x, y), lighter(k.color, 0.3));
        art.fill(`M${n(x)} ${n(y + 13)}q-4 8 2 14q5 7 -1 14l1 0q6 -7 1 -14q-6 -6 -2 -14Z`, k.tail);
      },
      { delay: i * 700 }
    );
  });
}
