// Journey scenes: an illustrated place for each stop (a city skyline, a forest, a beach...) at the
// time of day it is for you. Pure geometry, no React: drawScene() returns the sky's gradient and a
// back-to-front list of filled SVG paths in a 360 × 200 box. The ground the character stands on
// runs along the bottom, with its top edge around y = 166; landmarks sit on y = 160, mostly to the
// right, leaving the left third clear for the character.

export type Ground = 'grass' | 'sand' | 'stone' | 'path' | 'desert' | 'candy' | 'cloud' | 'seabed' | 'moon' | 'rock';

export type Feature =
  // Backdrops
  | 'hills'
  | 'crags'
  | 'mountains'
  | 'farshore'
  | 'sea'
  | 'lake'
  | 'river'
  | 'volcano'
  // Landmarks
  | 'skyline'
  | 'needle'
  | 'parliament'
  | 'bridge'
  | 'oldtown'
  | 'dome'
  | 'spires'
  | 'campanile'
  | 'colosseum'
  | 'ruins'
  | 'wall'
  | 'castle'
  | 'pines'
  | 'trees'
  | 'vines'
  | 'houses'
  | 'falls'
  | 'cliffs'
  | 'lighthouse'
  | 'boat'
  | 'gondola'
  | 'cross'
  // Group routes
  | 'greatwall'
  | 'pagoda'
  | 'mesas'
  | 'cactus'
  | 'wheat'
  | 'elevator'
  | 'arch'
  | 'pier'
  | 'balloons'
  | 'cadillacs'
  | 'canyon'
  | 'diner'
  // Fantasy lands, for the pet's adventures
  | 'candyhills'
  | 'gumdrops'
  | 'lollipops'
  | 'candycanes'
  | 'chocriver'
  | 'cupcakecastle'
  | 'dragonnest'
  | 'crystals'
  | 'wizardtower'
  | 'skycastle'
  | 'rainbow'
  | 'floatisles'
  | 'coral'
  | 'kelp'
  | 'wreck'
  | 'shellpalace'
  | 'bubbles'
  | 'craters'
  | 'rocket'
  | 'planet'
  | 'mushrooms'
  | 'fairylights'
  | 'well'
  | 'unicorn';

/** A stop's place: what the character stands on, then what's around them, drawn back to front. */
export type Scene = readonly [Ground, ...Feature[]];

export type TimeOfDay = 'dawn' | 'day' | 'dusk' | 'night';

/** A filled path; `lift` moves it up by that much (the place behind a group photo, see drawScene). */
export type Shape = { d: string; fill: string; opacity?: number; lift?: number };

export type SceneArt = { sky: readonly [string, string]; shapes: Shape[] };

export const SCENE_WIDTH = 360;
export const SCENE_HEIGHT = 200;
const W = SCENE_WIDTH;
const BASE = 160;

/** The time of day on this phone: night before 5 and from 9 pm, dawn until 8, dusk from 6 pm. */
export function timeOfDay(date: Date = new Date()): TimeOfDay {
  const h = date.getHours();
  if (h < 5 || h >= 21) return 'night';
  if (h < 8) return 'dawn';
  if (h < 18) return 'day';
  return 'dusk';
}

export const SKY: Record<TimeOfDay, readonly [string, string]> = {
  dawn: ['#7194DA', '#FFC79C'],
  day: ['#4EA6F2', '#C4E5FF'],
  dusk: ['#3D3A88', '#F49364'],
  night: ['#0A1230', '#27366C'],
};

/** The sea floor and the moon have their own skies whatever the hour; candy land is pink by day. */
const OTHER_SKY: Partial<Record<Ground, readonly [string, string]>> = {
  seabed: ['#46C3E0', '#0F4F8A'],
  moon: ['#05081C', '#232B5C'],
};

function skyFor(kind: Ground, time: TimeOfDay): readonly [string, string] {
  if (kind === 'candy' && time === 'day') return ['#FF9FD2', '#FFE4F2'];
  return OTHER_SKY[kind] ?? SKY[time];
}

/**
 * Mixed into every colour of the place (not the sky, the sun or moon, or lights), so the whole scene
 * takes on the hour's colour. Mixing rather than laying a dark sheet over it keeps the moon and
 * stars bright behind the hills.
 */
export const TINT: Record<TimeOfDay, { color: string; amount: number } | null> = {
  dawn: { color: '#FF9C6B', amount: 0.12 },
  day: null,
  dusk: { color: '#4B2F86', amount: 0.24 },
  night: { color: '#0B1638', amount: 0.52 },
};

/** Blends one `#RRGGBB` colour toward another by `amount` (0–1). */
export function mix(color: string, toward: string, amount: number): string {
  const a = parseInt(color.slice(1), 16);
  const b = parseInt(toward.slice(1), 16);
  const channel = (shift: number) => Math.round(((a >> shift) & 255) * (1 - amount) + ((b >> shift) & 255) * amount);
  return `#${((channel(16) << 16) | (channel(8) << 8) | channel(0)).toString(16).padStart(6, '0')}`;
}

// ---------- Geometry helpers ----------

export const n = (v: number) => Math.round(v * 10) / 10;

export function rect(x: number, y: number, w: number, h: number): string {
  return `M${n(x)} ${n(y)}h${n(w)}v${n(h)}h${n(-w)}Z`;
}

export function ellipse(cx: number, cy: number, rx: number, ry: number): string {
  return `M${n(cx - rx)} ${n(cy)}a${n(rx)} ${n(ry)} 0 1 0 ${n(2 * rx)} 0a${n(rx)} ${n(ry)} 0 1 0 ${n(-2 * rx)} 0Z`;
}

export const circle = (cx: number, cy: number, r: number) => ellipse(cx, cy, r, r);

/** A ring `w` thick: the inner circle winds the other way, so it's cut out of the fill. */
export function ring(cx: number, cy: number, r: number, w: number): string {
  const inner = r - w;
  return (
    `M${n(cx - r)} ${n(cy)}a${n(r)} ${n(r)} 0 1 0 ${n(2 * r)} 0a${n(r)} ${n(r)} 0 1 0 ${n(-2 * r)} 0Z` +
    `M${n(cx - inner)} ${n(cy)}a${n(inner)} ${n(inner)} 0 1 1 ${n(2 * inner)} 0a${n(inner)} ${n(inner)} 0 1 1 ${n(-2 * inner)} 0Z`
  );
}

export function poly(...pts: number[]): string {
  let d = '';
  for (let i = 0; i < pts.length; i += 2) d += `${i ? 'L' : 'M'}${n(pts[i]!)} ${n(pts[i + 1]!)}`;
  return `${d}Z`;
}

/** A window with a round top, like a church or a palazzo. */
export function arch(x: number, y: number, w: number, h: number): string {
  const r = w / 2;
  return `M${n(x)} ${n(y + h)}V${n(y + r)}a${n(r)} ${n(r)} 0 0 1 ${n(w)} 0V${n(y + h)}Z`;
}

export function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Deterministic, so a stop always looks the same (mulberry32). */
export function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- Painter ----------

class Painter {
  readonly shapes: Shape[] = [];
  readonly lights: Shape[] = [];
  readonly time: TimeOfDay;
  readonly night: boolean;
  readonly dusk: boolean;
  rand: () => number;
  /** Set once the sky is done, so only the place takes on the hour's colour. */
  tint: { color: string; amount: number } | null = null;
  private windows: string[] = [];
  private litWindows: string[] = [];

  constructor(time: TimeOfDay, rand: () => number) {
    this.time = time;
    this.night = time === 'night';
    this.dusk = time === 'dusk';
    this.rand = rand;
  }

  fill(d: string, fill: string, opacity?: number) {
    const color = this.tint ? mix(fill, this.tint.color, this.tint.amount) : fill;
    this.shapes.push(opacity === undefined ? { d, fill: color } : { d, fill: color, opacity });
  }

  /** Something that glows after dark, drawn above the night tint. */
  light(d: string, fill: string, opacity?: number) {
    this.lights.push(opacity === undefined ? { d, fill } : { d, fill, opacity });
  }

  between(min: number, max: number) {
    return min + this.rand() * (max - min);
  }

  /**
   * A window: glassy by day; after dark most are lit, the rest stay dark. It always draws a random
   * number, so the buildings after it come out the same whatever the time of day.
   */
  window(d: string) {
    const r = this.rand();
    const lit = this.night ? r < 0.7 : this.dusk ? r < 0.35 : false;
    (lit ? this.litWindows : this.windows).push(d);
  }

  /** Called after each feature, so its windows sit on its own walls and under whatever comes next. */
  flushWindows(dayColor: string) {
    if (this.windows.length) {
      this.fill(this.windows.join(''), this.night || this.dusk ? '#3B3A4A' : dayColor, this.night ? 0.9 : 0.75);
    }
    if (this.litWindows.length) this.light(this.litWindows.join(''), '#FFD36E');
    this.windows = [];
    this.litWindows = [];
  }
}

// ---------- Sky ----------

function sky(p: Painter, kind: Ground) {
  if (kind === 'moon') {
    // Space: lots of stars, and the Earth hanging where the moon would be.
    const stars: string[] = [];
    for (let i = 0; i < 70; i++) stars.push(circle(p.between(0, W), p.between(4, 130), p.between(0.4, 1.3)));
    p.fill(stars.join(''), '#FFFFFF', 0.9);
    p.fill(circle(300, 44, 32), '#7FB8FF', 0.15);
    p.fill(circle(300, 44, 18), '#3E7FD8');
    p.fill(ellipse(294, 38, 7, 5) + ellipse(306, 50, 6, 4) + ellipse(299, 52, 3, 2), '#5DBB63');
    p.fill(ellipse(296, 30, 8, 2), '#FFFFFF', 0.7);
    return;
  }
  if (kind === 'seabed') {
    // Sunlight slanting down through the water, and a few bubbles on their way up.
    p.fill(poly(40, 0, 70, 0, 150, 160, 110, 160) + poly(170, 0, 190, 0, 250, 160, 220, 160), '#FFFFFF', 0.1);
    p.fill(poly(280, 0, 300, 0, 340, 160, 316, 160), '#FFFFFF', 0.08);
    return;
  }
  if (p.time === 'night') {
    const stars: string[] = [];
    for (let i = 0; i < 46; i++) stars.push(circle(p.between(0, W), p.between(4, 120), p.between(0.4, 1.2)));
    p.fill(stars.join(''), '#FFFFFF', 0.85);
    // The moon, with a soft glow.
    p.fill(circle(292, 40, 24), '#F4F1DE', 0.12);
    p.fill(circle(292, 40, 13), '#F4F1DE');
    p.fill(circle(287, 36, 2.6) + circle(296, 45, 1.8) + circle(297, 34, 1.4), '#D9D4BC', 0.8);
    return;
  }
  const sun = {
    dawn: { x: 296, y: 116, r: 19, color: '#FFE0AE' },
    day: { x: 300, y: 42, r: 16, color: '#FFF6CF' },
    dusk: { x: 300, y: 112, r: 21, color: '#FFB27E' },
  }[p.time];
  p.fill(circle(sun.x, sun.y, sun.r * 1.9), sun.color, 0.28);
  p.fill(circle(sun.x, sun.y, sun.r), sun.color);
  const cloud = p.dusk ? '#F6C3C6' : p.time === 'dawn' ? '#FFE4D2' : '#FFFFFF';
  for (const [cx, cy, s] of [
    [p.between(40, 120), p.between(26, 50), p.between(0.8, 1.1)],
    [p.between(170, 230), p.between(18, 40), p.between(0.6, 0.9)],
  ] as const) {
    p.fill(
      ellipse(cx, cy, 22 * s, 7 * s) + circle(cx - 8 * s, cy - 5 * s, 8 * s) + circle(cx + 6 * s, cy - 7 * s, 10 * s),
      cloud,
      0.85
    );
  }
}

// ---------- Backdrops ----------

function hills(p: Painter) {
  p.fill('M0 136C60 116 120 130 180 122S300 108 360 124V200H0Z', '#A9D4A2');
  p.fill('M0 152C70 136 140 150 220 143S320 136 360 147V200H0Z', '#89C080');
}

function crags(p: Painter) {
  p.fill('M0 140C50 128 90 136 140 126S220 120 260 126V200H0Z', '#A6C79E');
  // The Whin Sill: a ridge with a cliff face to the north.
  p.fill(poly(120, 160, 150, 124, 200, 110, 240, 114, 280, 98, 330, 104, 360, 100, 360, 160), '#8DAA84');
  p.fill(poly(150, 124, 200, 110, 240, 114, 280, 98, 330, 104, 360, 100, 360, 122, 330, 124, 280, 120, 240, 134, 200, 130, 150, 140), '#6E7F67');
  p.fill('M0 154C80 140 160 154 240 148S330 142 360 150V200H0Z', '#86BD7D');
}

function mountains(p: Painter) {
  p.fill(poly(0, 132, 36, 104, 70, 118, 118, 64, 160, 108, 198, 88, 250, 42, 298, 94, 332, 78, 360, 98, 360, 200, 0, 200), '#A3B3D3');
  p.fill(poly(105, 79, 118, 64, 131, 80, 124, 77, 118, 83, 112, 77) + poly(235, 58, 250, 42, 266, 60, 258, 56, 251, 63, 243, 56), '#F4F7FF');
  p.fill(poly(0, 156, 44, 126, 92, 146, 150, 114, 206, 150, 262, 124, 318, 146, 360, 130, 360, 200, 0, 200), '#7F9C86');
}

function farshore(p: Painter) {
  p.fill('M0 146C50 136 110 141 170 137S290 131 360 140V150H0Z', '#7E9DB4');
}

function sea(p: Painter) {
  p.fill(rect(0, 146, W, 60), '#3E8FD0');
  p.fill(rect(0, 146, W, 5), '#8DC8EE', 0.6);
  const glints: string[] = [];
  for (let i = 0; i < 16; i++) glints.push(ellipse(p.between(0, W), p.between(152, 176), p.between(4, 10), 1.1));
  p.fill(glints.join(''), '#D5EEFC', 0.7);
}

function lake(p: Painter) {
  p.fill('M0 146C40 140 80 144 120 141S220 136 260 140S330 138 360 142V152H0Z', '#4E8C5D');
  p.fill(rect(0, 150, W, 24), '#5AA8D8');
  const glints: string[] = [];
  for (let i = 0; i < 10; i++) glints.push(ellipse(p.between(0, W), p.between(154, 166), p.between(5, 12), 0.9));
  p.fill(glints.join(''), '#E2F3FD', 0.65);
}

function river(p: Painter) {
  p.fill(rect(0, 138, W, 14), '#97C78E');
  p.fill('M0 150C90 148 180 154 270 150S340 148 360 150V172H0Z', '#5BA2D2');
  const glints: string[] = [];
  for (let i = 0; i < 8; i++) glints.push(ellipse(p.between(0, W), p.between(156, 166), p.between(5, 11), 0.9));
  p.fill(glints.join(''), '#E2F3FD', 0.6);
}

function volcano(p: Painter) {
  p.fill(poly(130, 156, 226, 76, 248, 70, 262, 74, 284, 70, 360, 128, 360, 160, 130, 160), '#9389A0');
  p.fill(poly(226, 76, 248, 70, 262, 74, 284, 70, 300, 84, 270, 82, 250, 88, 232, 86), '#7E7590');
  p.fill(circle(262, 60, 8) + circle(270, 48, 10) + circle(282, 36, 12), '#ECE8F1', 0.75);
}

// ---------- Landmarks ----------

const STONE_WINDOW = '#7C6A57';

function skyline(p: Painter) {
  const colors = ['#7F8FB0', '#6C7C9F', '#93A2C0', '#5F6F92'];
  let x = 168;
  while (x < W) {
    const w = p.between(18, 32);
    const h = p.between(40, 92);
    const top = BASE - h;
    p.fill(rect(x, top, w, h), colors[Math.floor(p.rand() * colors.length)]!);
    if (p.rand() < 0.3) p.fill(rect(x + w / 2 - 0.6, top - 10, 1.2, 10), '#5F6F92');
    for (let wy = top + 6; wy < BASE - 6; wy += 8) {
      for (let wx = x + 4; wx < x + w - 5; wx += 6) p.window(rect(wx, wy, 3, 4));
    }
    p.flushWindows('#D7E6F7');
    x += w + p.between(1, 4);
  }
}

/** The CN Tower. */
function needle(p: Painter) {
  p.fill(poly(227, BASE, 230.5, 34, 233.5, 34, 237, BASE), '#BCC5D6');
  p.fill(ellipse(232, 64, 10, 5.5), '#A3ADC2');
  p.fill(ellipse(232, 59, 7, 3), '#C9D1E0');
  p.fill(rect(231.4, 8, 1.2, 28), '#8C96AB');
  if (p.night) p.light(circle(232, 8, 1.6), '#FF5A5A');
}

/** Parliament's Peace Tower and its copper roofs. */
function parliament(p: Painter) {
  p.fill('M160 160C200 146 280 144 340 160Z', '#7DB57F');
  const stone = '#CDB892';
  const copper = '#5FA58F';
  p.fill(poly(198, 120, 302, 120, 296, 108, 204, 108), copper);
  p.fill(rect(200, 120, 100, 40), stone);
  p.fill(rect(241, 74, 18, 86), '#D3BF99');
  p.fill(poly(239, 74, 250, 50, 261, 74), copper);
  p.fill(rect(249.4, 40, 1.2, 12), '#6D6D6D');
  p.fill(poly(250.6, 40, 258, 43, 250.6, 46), '#D52B1E');
  p.fill(circle(250, 88, 4.2), '#F3EBD2');
  for (let x = 206; x < 296; x += 8) {
    if (x > 236 && x < 262) continue;
    p.window(arch(x, 128, 4, 10));
    p.window(arch(x, 143, 4, 10));
  }
  p.window(arch(247, 100, 6, 14));
  p.flushWindows(STONE_WINDOW);
}

/** A green through-arch bridge over the river, like the Tyne Bridge. */
function bridge(p: Painter) {
  const steel = '#3F7F66';
  p.fill(rect(136, 104, 16, 56) + rect(330, 104, 16, 56), '#AFA48F');
  p.fill(rect(136, 128, 210, 6), '#56606F');
  p.fill('M152 156Q241 50 330 156L322 156Q241 64 160 156Z', steel);
  // The arch's outer edge is a symmetric quadratic: x runs evenly with t, y = 156 − 212·t(1 − t).
  const hangers: string[] = [];
  for (let x = 178; x <= 304; x += 14) {
    const t = (x - 152) / 178;
    const y = 156 - 212 * t * (1 - t) + 4;
    if (y < 128) hangers.push(rect(x - 0.6, y, 1.2, 128 - y));
  }
  p.fill(hangers.join(''), steel);
  if (p.night) {
    const lamps: string[] = [];
    for (let x = 146; x < 340; x += 22) lamps.push(circle(x, 126, 1.6));
    p.light(lamps.join(''), '#FFD36E');
  }
}

const WARM_WALLS = ['#F1D3A2', '#E9BF8C', '#F4E1BE', '#E7B48A', '#F0CBA0', '#EBC9A6'];

/** Southern European old town: warm walls and terracotta roofs, tightly packed. */
function oldtown(p: Painter) {
  let x = 160;
  while (x < W) {
    const w = p.between(16, 28);
    const h = p.between(22, 44);
    const top = BASE - h;
    p.fill(rect(x, top, w, h), WARM_WALLS[Math.floor(p.rand() * WARM_WALLS.length)]!);
    p.fill(poly(x - 2, top, x + w / 2, top - p.between(5, 9), x + w + 2, top), p.rand() < 0.5 ? '#C8643B' : '#B5532E');
    for (let wy = top + 6; wy < BASE - 7; wy += 10) {
      for (let wx = x + 4; wx < x + w - 5; wx += 7) p.window(rect(wx, wy, 3, 5));
    }
    p.flushWindows('#8A6A50');
    x += w - 1;
  }
}

/** Brunelleschi's dome, with the bell tower beside it. */
function dome(p: Painter) {
  const marble = '#EDE2CB';
  p.fill(rect(200, 128, 100, 32), marble);
  p.fill(rect(232, 112, 36, 18), marble);
  p.fill('M230 113Q230 78 250 74Q270 78 270 113Z', '#C8643B');
  p.fill('M249 75Q244 92 244 113H247Q247 92 250.5 75Z' + 'M240 82Q236 96 236 113H238.5Q238.5 96 242 82Z' + 'M258 82Q262 96 262 113H264.5Q264.5 96 260 82Z', '#F3E6CF', 0.8);
  p.fill(rect(246.5, 64, 7, 11), marble);
  p.fill(poly(245.5, 64, 250, 56, 254.5, 64), '#C8643B');
  p.fill(rect(300, 88, 14, 72), '#EFE3CC');
  p.fill(rect(298, 84, 18, 5), '#D8C9AE');
  for (let y = 96; y < 152; y += 14) p.window(arch(304.5, y, 5, 9));
  for (let x = 206; x < 296; x += 12) p.window(arch(x, 140, 5, 12));
  p.flushWindows(STONE_WINDOW);
}

/** A Gothic cathedral's twin spires and rose window. */
function spires(p: Painter) {
  const stone = '#D2C5AA';
  p.fill(rect(222, 104, 56, 56), stone);
  p.fill(rect(222, 70, 13, 38) + rect(265, 70, 13, 38), '#C6B89C');
  p.fill(poly(221, 70, 228.5, 28, 236, 70) + poly(264, 70, 271.5, 28, 279, 70), '#B6A88D');
  p.fill(poly(222, 104, 250, 86, 278, 104), '#C6B89C');
  // The rose window glows at night (León's "house of light").
  if (p.night || p.dusk) {
    p.light(circle(250, 116, 8), '#FFC86B');
    p.light(circle(250, 116, 14), '#FFC86B', 0.25);
  } else {
    p.fill(circle(250, 116, 8), '#8A7A64');
  }
  p.fill(arch(243, 140, 14, 20), '#5E5040');
  p.window(arch(226, 80, 5, 14));
  p.window(arch(269, 80, 5, 14));
  p.flushWindows(STONE_WINDOW);
}

/** A slim brick bell tower; a second one stands a little apart. */
function campanile(p: Painter, index: number) {
  const x = index === 0 ? 312 : 280;
  const top = index === 0 ? 62 : 74;
  p.fill(rect(x, top, 15, BASE - top), '#D49C74');
  p.fill(rect(x - 1.5, top + 14, 18, 3), '#C2855E');
  p.fill(arch(x + 3, top + 4, 3.5, 8) + arch(x + 8.5, top + 4, 3.5, 8), '#5E4636');
  p.fill(poly(x - 1.5, top, x + 7.5, top - 14, x + 16.5, top), '#B5532E');
}

function colosseum(p: Painter) {
  const travertine = '#DCC8A4';
  p.fill('M196 160V104Q268 88 342 104V160Z', travertine);
  // The broken top on the far side.
  p.fill('M196 104Q232 94 270 93L282 99L300 92L314 98L330 95L342 104V96Q300 82 268 84Q230 85 196 98Z', '#E6D5B5');
  const arches: string[] = [];
  for (let row = 0; row < 3; row++) {
    const y = 110 + row * 16;
    for (let x = 202; x < 336; x += 11) arches.push(arch(x, y, 6, 11));
  }
  p.fill(arches.join(''), '#9B8462');
}

/** A Roman fort's low walls and a few columns. */
function ruins(p: Painter) {
  const stone = '#B7A990';
  p.fill(poly(176, 160, 176, 138, 192, 138, 192, 144, 206, 144, 206, 160), stone);
  p.fill(poly(300, 160, 300, 142, 318, 142, 318, 136, 336, 136, 336, 160), stone);
  const blocks: string[] = [];
  for (let y = 142; y < 160; y += 6) blocks.push(rect(176, y, 30, 0.8), rect(300, y, 36, 0.8));
  p.fill(blocks.join(''), '#988A72', 0.7);
  for (const [x, h] of [[226, 50], [246, 38], [266, 50], [284, 22]] as const) {
    p.fill(rect(x, BASE - h, 8, h), '#E6DAC2');
    if (h > 30) p.fill(rect(x - 2, BASE - h - 3, 12, 4), '#D8CAB0');
  }
}

/** Hadrian's Wall snaking along the crest of the hills. */
function wall(p: Painter) {
  p.fill('M0 150C70 133 140 146 220 139S320 132 360 143V151C320 141 280 142 220 147C140 153 70 141 0 158Z', '#A69A86');
  const joints: string[] = [];
  for (let x = 6; x < W; x += 12) {
    const y = 150 - 14 * Math.sin((x / W) * Math.PI * 1.1) + (x > 220 ? 4 : 0);
    joints.push(rect(x, y - 2, 0.8, 4));
  }
  p.fill(joints.join(''), '#857A68', 0.7);
}

function castle(p: Painter) {
  p.fill('M170 160C200 142 300 140 340 160Z', '#7DB57F');
  const stone = '#ABA08C';
  p.fill(rect(216, 108, 92, 52), stone);
  p.fill(rect(204, 90, 24, 70) + rect(296, 90, 24, 70), '#A0947F');
  const merlons: string[] = [];
  for (let x = 216; x < 308; x += 8) merlons.push(rect(x, 103, 5, 5));
  for (const tx of [204, 296]) for (let x = tx; x < tx + 24; x += 7) merlons.push(rect(x, 85, 4.5, 5));
  p.fill(merlons.join(''), stone);
  p.fill(arch(254, 134, 16, 26), '#4D4436');
  p.fill(rect(307.4, 64, 1.2, 22), '#5A5A5A');
  p.fill(poly(308.6, 64, 322, 68, 308.6, 72), '#D64545');
  p.window(arch(212, 104, 5, 10));
  p.window(arch(304, 104, 5, 10));
  p.window(arch(236, 118, 5, 10));
  p.window(arch(282, 118, 5, 10));
  p.flushWindows('#4D4436');
}

function pine(p: Painter, x: number, base: number, h: number, color: string) {
  const w = h * 0.42;
  p.fill(rect(x - 1.5, base - 6, 3, 6), '#5B4636');
  p.fill(
    poly(x - w, base - 5, x, base - h * 0.55, x + w, base - 5) +
      poly(x - w * 0.8, base - h * 0.35, x, base - h * 0.8, x + w * 0.8, base - h * 0.35) +
      poly(x - w * 0.6, base - h * 0.62, x, base - h, x + w * 0.6, base - h * 0.62),
    color
  );
}

function pines(p: Painter) {
  const colors = ['#2F6B47', '#3A7D52', '#28603F'];
  // A far row, smaller and paler, then a near row of big ones, mostly to the right.
  for (let x = 4; x < W; x += p.between(10, 16)) pine(p, x, 152, p.between(18, 28), '#4E8A62');
  for (let x = 170; x < W + 10; x += p.between(16, 26)) pine(p, x, BASE + p.between(0, 4), p.between(36, 62), colors[Math.floor(p.rand() * 3)]!);
}

function trees(p: Painter) {
  const crowns = ['#5DA454', '#4F944A', '#6BB062'];
  for (let x = 176; x < W + 10; x += p.between(22, 34)) {
    const r = p.between(9, 15);
    const base = BASE + p.between(-2, 3);
    p.fill(rect(x - 1.5, base - r - 6, 3, r + 6), '#6B4F3A');
    const c = crowns[Math.floor(p.rand() * 3)]!;
    p.fill(circle(x, base - r - 8, r) + circle(x - r * 0.6, base - r - 4, r * 0.7) + circle(x + r * 0.6, base - r - 5, r * 0.75), c);
  }
}

/** Vineyard rows down the hillside, with a little farmhouse. */
function vines(p: Painter) {
  p.fill('M140 160C180 112 260 96 360 100V160Z', '#9CC77A');
  // Each row starts further right as it climbs, so they all stay on the hill.
  const rows: string[] = [];
  for (let r = 0; r < 5; r++) {
    for (let x = 168 + r * 12; x < W; x += 6) rows.push(ellipse(x, 158 - r * 7 - (x - 160) * 0.12, 2.6, 1.6));
  }
  p.fill(rows.join(''), '#4E7D31');
  p.fill(rect(300, 88, 24, 14), '#F0DEC0');
  p.fill(poly(298, 88, 312, 80, 326, 88), '#B5532E');
  p.window(rect(306, 92, 4, 5));
  p.window(rect(315, 92, 4, 5));
  p.flushWindows('#7A5A45');
}

/** A northern village: pale clapboard and stone, steep roofs, and a church steeple. */
function houses(p: Painter) {
  const walls = ['#F4EDE1', '#E9DCC8', '#D7C2A3', '#EFE6D6'];
  const roofs = ['#7D5A4A', '#5F6F82', '#6E4C3D'];
  let x = 172;
  while (x < W) {
    if (x > 250 && x < 290) {
      p.fill(rect(262, 104, 18, 56), '#EEE7DB');
      p.fill(poly(260, 104, 271, 66, 282, 104), '#5F6F82');
      p.window(arch(268, 116, 6, 12));
      p.flushWindows('#6B6B78');
      x = 290;
      continue;
    }
    const w = p.between(20, 30);
    const h = p.between(16, 24);
    const top = BASE - h;
    p.fill(rect(x, top, w, h), walls[Math.floor(p.rand() * walls.length)]!);
    p.fill(poly(x - 2, top, x + w / 2, top - w * 0.45, x + w + 2, top), roofs[Math.floor(p.rand() * roofs.length)]!);
    p.fill(rect(x + w * 0.7, top - w * 0.4, 3, 7), '#8A6A58');
    p.window(rect(x + 4, top + 5, 4, 5));
    p.window(rect(x + w - 8, top + 5, 4, 5));
    p.flushWindows('#6B6B78');
    x += w + p.between(4, 9);
  }
}

/** Jones Falls: water spilling over a stone arch dam into a pool. */
function falls(p: Painter) {
  p.fill(poly(196, 160, 204, 108, 330, 104, 340, 160), '#9A8F80');
  const blocks: string[] = [];
  for (let y = 112; y < 160; y += 8) blocks.push(rect(204, y, 130, 0.8));
  p.fill(blocks.join(''), '#7F7466', 0.7);
  p.fill(rect(250, 105, 34, 55), '#CFEAF8');
  p.fill(rect(256, 105, 3, 55) + rect(266, 105, 2, 55) + rect(276, 105, 3, 55), '#9FD0EE');
  p.fill(ellipse(267, 160, 30, 5), '#FFFFFF', 0.75);
}

/** Amalfi: a rock face falling to the sea, terraced, with pastel houses in tiers and lemon trees. */
function cliffs(p: Painter) {
  p.fill(poly(176, 160, 186, 130, 204, 112, 226, 96, 250, 70, 286, 52, 330, 44, 360, 40, 360, 160), '#B99C7C');
  p.fill(poly(204, 112, 226, 96, 250, 70, 286, 52, 330, 44, 360, 40, 360, 54, 324, 58, 290, 70, 258, 92, 232, 114, 212, 128), '#A2856A', 0.85);
  p.fill(poly(196, 130, 236, 104, 262, 84, 300, 66, 360, 58, 360, 66, 302, 76, 266, 94, 240, 114, 204, 138), '#6E9A4E', 0.85);
  // Houses in tiers, each row starting where the rock is low enough for it.
  const colors = ['#F6E3B4', '#F2C6A0', '#FFFFFF', '#E9A99C', '#F4D9A8', '#F7CFC2'];
  for (let row = 0; row < 5; row++) {
    const y = 144 - row * 16;
    for (let x = 200 + row * 22; x < 352; x += p.between(13, 18)) {
      p.fill(rect(x, y, 12, 10), colors[Math.floor(p.rand() * colors.length)]!);
      p.window(rect(x + 2.5, y + 3, 2.5, 3.5));
      p.window(rect(x + 7, y + 3, 2.5, 3.5));
    }
  }
  p.flushWindows('#6E5B4A');
  const lemons: string[] = [];
  for (let x = 196; x < 360; x += 18) {
    p.fill(circle(x, 154, 8), '#4F8F3A');
    lemons.push(circle(x - 3, 152, 1.6), circle(x + 3, 156, 1.6), circle(x + 1, 150, 1.4));
  }
  p.fill(lemons.join(''), '#F4D03F');
}

/** A white lighthouse at the end of a pier, like Cobourg's; its lamp shines after dark. */
function lighthouse(p: Painter) {
  p.fill(rect(232, 148, 128, 6), '#8C8478');
  p.fill(poly(318, 150, 322, 106, 334, 106, 338, 150), '#F4F1EA');
  p.fill(poly(319.6, 132, 320.6, 120, 335.4, 120, 336.4, 132), '#D64545');
  p.fill(rect(321, 98, 14, 8), '#3B3B44');
  p.fill(poly(319, 98, 328, 89, 337, 98), '#D64545');
  if (p.night || p.dusk) {
    p.light(rect(323, 100, 10, 5), '#FFE08A');
    p.light(circle(328, 102, 18), '#FFE08A', 0.22);
  }
}

/** A small sailing boat out on the water. */
function boat(p: Painter) {
  p.fill(poly(232, 152, 274, 152, 267, 160, 238, 160), '#7A4E35');
  p.fill(rect(251, 112, 1.6, 40), '#5B4636');
  p.fill(poly(253.6, 114, 253.6, 149, 274, 149), '#FFFFFF');
  p.fill(poly(250, 120, 250, 149, 235, 149), '#F2EEE4');
}

function gondola(p: Painter) {
  p.fill('M200 156Q250 165 300 153L297 158Q250 170 204 161Z', '#1E1E26');
  p.fill(poly(296, 153, 303, 146, 301, 155), '#1E1E26');
  // The gondolier and his oar.
  p.fill(rect(283, 140, 4, 13), '#1E1E26');
  p.fill(circle(285, 137, 3), '#E8C3A0');
  p.fill(rect(284, 133.5, 2, 1.2) + rect(282, 134.5, 6, 1), '#C8643B');
  p.fill(poly(279, 132, 281, 132, 272, 166, 270, 166), '#6B4F3A');
}

/** Cruz de Ferro: a tall pole with an iron cross on a mound of pilgrims' stones. */
function cross(p: Painter) {
  p.fill(ellipse(258, 160, 34, 12), '#9B9285');
  const stones: string[] = [];
  for (let i = 0; i < 26; i++) stones.push(ellipse(p.between(230, 286), p.between(150, 160), p.between(2, 4), p.between(1.4, 2.6)));
  p.fill(stones.join(''), '#B8AFA2');
  p.fill(rect(256, 64, 4, 90), '#6B5B4B');
  p.fill(rect(250, 56, 16, 3.2) + rect(256.4, 47, 3.2, 20), '#3B3B3B');
}

// ---------- Group routes: Canada's prairies, Route 66, the Great Wall ----------

/** Where the near mountain range's crest is at x (the ridge `mountains` draws in front). */
function nearRidge(x: number): number {
  const pts = [0, 156, 44, 126, 92, 146, 150, 114, 206, 150, 262, 124, 318, 146, 360, 130];
  for (let i = 0; i < pts.length - 2; i += 2) {
    const [x0, y0, x1, y1] = [pts[i]!, pts[i + 1]!, pts[i + 2]!, pts[i + 3]!];
    if (x <= x1) return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
  }
  return pts[pts.length - 1]!;
}

/** The Great Wall riding the crest of the mountains, with watchtowers on the peaks. */
function greatwall(p: Painter) {
  const top: number[] = [];
  const bottom: number[] = [];
  for (let x = 0; x <= W; x += 4) {
    const y = nearRidge(x);
    top.push(x, y - 6);
    bottom.unshift(x, y + 2);
  }
  p.fill(poly(...top, ...bottom), '#B9A98C');
  const merlons: string[] = [];
  for (let x = 2; x < W; x += 6) merlons.push(rect(x, nearRidge(x) - 8.5, 3, 3));
  p.fill(merlons.join(''), '#A8987B');
  for (const x of [44, 150, 262]) {
    const y = nearRidge(x);
    p.fill(rect(x - 8, y - 24, 16, 20), '#AE9E80');
    const crenels: string[] = [];
    for (let cx = x - 8; cx < x + 8; cx += 4) crenels.push(rect(cx, y - 27, 2.4, 3));
    p.fill(crenels.join(''), '#AE9E80');
    p.window(arch(x - 2, y - 18, 4, 7));
  }
  p.flushWindows('#5E5040');
}

/** A Chinese gate tower: a stone base with an arched gate, red halls and upturned roofs. */
function pagoda(p: Painter) {
  p.fill(rect(226, 128, 108, 32), '#A99C86');
  p.fill(arch(270, 138, 20, 22), '#4D4436');
  p.fill(rect(244, 104, 72, 24), '#B23A2E');
  p.fill(rect(256, 80, 48, 18), '#B23A2E');
  const roof = '#3D4D49';
  p.fill('M228 109Q236 104 242 97H318Q324 104 332 109Q280 103 228 109Z', roof);
  p.fill('M246 84Q252 80 258 73H302Q308 80 314 84Q280 79 246 84Z', roof);
  p.fill(rect(262, 70, 36, 3), roof);
  for (let x = 250; x < 314; x += 10) p.window(rect(x, 110, 5, 12));
  for (let x = 262; x < 300; x += 10) p.window(rect(x, 86, 5, 9));
  p.flushWindows('#5A2420');
}

/** Flat-topped desert buttes in bands of red, orange and cream (the Painted Desert, Zhangye). */
function mesas(p: Painter) {
  p.fill('M0 150C60 140 120 146 180 140S300 132 360 140V200H0Z', '#E3B693');
  const shapes: [number, number, number, number][] = [
    [150, 112, 82, 160],
    [250, 100, 96, 160],
    [40, 130, 60, 156],
  ];
  for (const [x, top, w, base] of shapes) {
    p.fill(poly(x, base, x + 8, top, x + w - 8, top, x + w, base), '#C66A48');
    p.fill(poly(x + 3.5, top + 14, x + w - 3.5, top + 14, x + w - 2, top + 22, x + 2, top + 22), '#E4A06A');
    p.fill(poly(x + 1.5, top + 30, x + w - 1.5, top + 30, x + w - 0.5, top + 36, x + 0.5, top + 36), '#F1D2A5');
    p.fill(poly(x + 8, top, x + w - 8, top, x + w - 9, top + 4, x + 9, top + 4), '#A9512F');
  }
}

/** Saguaro cacti standing up out of the desert. */
function cactus(p: Painter) {
  for (const [x, h] of [[188, 46], [256, 34], [338, 54]] as const) {
    const green = '#4C8A4A';
    p.fill(rect(x - 3, BASE - h, 6, h + 4) + circle(x, BASE - h, 3), green);
    p.fill(rect(x - 11, BASE - h * 0.62, 5, h * 0.3) + rect(x - 11, BASE - h * 0.38, 9, 4) + circle(x - 8.5, BASE - h * 0.62, 2.5), green);
    p.fill(rect(x + 6, BASE - h * 0.75, 5, h * 0.32) + rect(x + 2, BASE - h * 0.48, 9, 4) + circle(x + 8.5, BASE - h * 0.75, 2.5), green);
  }
}

/** Golden wheat fields in rows, out to the horizon. */
function wheat(p: Painter) {
  p.fill('M0 138C90 132 180 138 270 133S340 130 360 134V200H0Z', '#E9CA6B');
  p.fill('M0 150C90 144 200 152 280 146S340 144 360 148V200H0Z', '#DDB24E');
  const rows: string[] = [];
  for (let y = 140; y < 166; y += 4) rows.push(rect(0, y, W, 0.8));
  p.fill(rows.join(''), '#C99A3A', 0.45);
}

/** A red wooden prairie grain elevator, with its annex. */
function elevator(p: Painter) {
  p.fill(rect(304, 112, 28, 48), '#9E3A28');
  p.fill(rect(270, 70, 34, 90), '#B5452F');
  p.fill(poly(268, 70, 287, 54, 306, 70), '#7E2F22');
  p.fill(rect(282, 44, 10, 12), '#B5452F');
  p.fill(poly(280, 44, 287, 38, 294, 44), '#7E2F22');
  p.fill(rect(273, 80, 28, 6), '#F3EBD8');
  p.window(rect(284, 96, 6, 8));
  p.flushWindows('#5B2419');
}

/** The Gateway Arch over St. Louis: a stainless-steel arch as wide as it is tall. */
function gatewayArch(p: Painter) {
  p.fill('M204 160Q270 -112 336 160L327 160Q270 -90 213 160Z', '#C9D2DC');
  p.fill('M210 160Q270 -104 330 160L328 160Q270 -98 212 160Z', '#EEF3F8', 0.7);
}

/** Santa Monica Pier: the deck on its pilings and the Ferris wheel, lit up after dark. */
function pier(p: Painter) {
  const pilings: string[] = [];
  for (let x = 176; x < W; x += 12) pilings.push(rect(x, 150, 2, 14));
  p.fill(pilings.join(''), '#6E5A48');
  p.fill(rect(170, 146, 190, 5), '#8C7560');
  const cx = 300;
  const cy = 100;
  const r = 34;
  p.fill(poly(cx - 3, cy, cx + 3, cy, cx + 14, 146, cx - 14, 146), '#D9D3C7');
  p.fill(ring(cx, cy, r, 2.4), '#ECE6DA');
  const spokes: string[] = [];
  const cars: string[] = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const [dx, dy] = [Math.cos(a), Math.sin(a)];
    spokes.push(poly(cx - dy * 0.5, cy + dx * 0.5, cx + dx * r - dy * 0.5, cy + dy * r + dx * 0.5, cx + dx * r + dy * 0.5, cy + dy * r - dx * 0.5, cx + dy * 0.5, cy - dx * 0.5));
    cars.push(circle(cx + dx * r, cy + dy * r + 3, 2.6));
  }
  p.fill(spokes.join(''), '#ECE6DA', 0.9);
  p.fill(cars.join(''), '#E8505B');
  if (p.night || p.dusk) p.light(ring(cx, cy, r, 1.6), '#FF6FB5');
}

/** A sky full of hot air balloons. */
function balloons(p: Painter) {
  const colors = [
    ['#E8505B', '#F9D56E'],
    ['#4F9DE8', '#FFFFFF'],
    ['#8F6BD8', '#F3A35C'],
    ['#14B1AB', '#F9D56E'],
    ['#F3A35C', '#E8505B'],
  ];
  for (let i = 0; i < 5; i++) {
    const x = 150 + i * 44 + p.between(-10, 10);
    const y = p.between(28, 96);
    const r = p.between(8, 15);
    const [a, b] = colors[i]!;
    p.fill(circle(x, y, r) + poly(x - r * 0.95, y + r * 0.3, x + r * 0.95, y + r * 0.3, x + r * 0.25, y + r * 1.45, x - r * 0.25, y + r * 1.45), a);
    p.fill(rect(x - r * 0.28, y - r, r * 0.56, r * 2.3), b, 0.9);
    p.fill(rect(x - r * 0.22, y + r * 1.6, r * 0.44, r * 0.32), '#7A5636');
  }
}

/** Cadillac Ranch: old cars buried nose-first in a field, sprayed every colour. */
function cadillacs(p: Painter) {
  const colors = ['#E8505B', '#F9D56E', '#14B1AB', '#F3ECC2', '#8F6BD8', '#4F9DE8'];
  for (let i = 0; i < 6; i++) {
    const x = 172 + i * 30;
    p.fill(poly(x, BASE + 2, x + 13, BASE + 2, x + 22, BASE - 26, x + 9, BASE - 28), colors[i]!);
    p.fill(poly(x + 9, BASE - 28, x + 11, BASE - 34, x + 13, BASE - 27.5) + poly(x + 22, BASE - 26, x + 24, BASE - 32, x + 20, BASE - 26.5), colors[i]!);
    p.fill(poly(x + 3, BASE - 6, x + 15, BASE - 6, x + 18, BASE - 16, x + 6, BASE - 17), '#2E3440', 0.55);
  }
}

/** The Grand Canyon from its rim: banded cliffs stepping down to a thread of river. */
function canyon(p: Painter) {
  p.fill(rect(0, 100, W, 22), '#E7B98A');
  p.fill(poly(0, 122, 360, 122, 360, 132, 300, 136, 250, 128, 200, 138, 140, 130, 80, 140, 0, 134), '#D98C5F');
  p.fill(poly(0, 134, 80, 140, 140, 130, 200, 138, 250, 128, 300, 136, 360, 132, 360, 150, 290, 146, 230, 156, 170, 146, 110, 156, 0, 150), '#C7704A');
  p.fill(poly(0, 150, 110, 156, 170, 146, 230, 156, 290, 146, 360, 150, 360, 170, 0, 170), '#9E5238');
  p.fill('M0 162C80 158 160 164 240 160S330 157 360 160V164C300 162 240 166 160 168C80 166 40 166 0 166Z', '#5BA2D2');
}

/** A chrome roadside diner with a neon sign that glows after dark. */
function diner(p: Painter) {
  p.fill(rect(200, 130, 108, 30) + circle(200, 145, 15) + circle(308, 145, 15), '#D3D9DF');
  p.fill(rect(192, 147, 124, 4), '#D64545');
  for (let x = 206; x < 304; x += 14) p.window(rect(x, 135, 9, 9));
  p.flushWindows('#5D6A78');
  p.fill(rect(330, 92, 4, 68), '#5A5A64');
  p.fill(rect(310, 76, 44, 18), '#2B2B33');
  if (p.night || p.dusk) {
    p.light(ring(332, 85, 6, 1.4) + rect(314, 79, 36, 1.4) + rect(314, 91, 36, 1.4), '#FF4F8B');
    p.light(circle(332, 85, 18), '#FF4F8B', 0.2);
  } else {
    p.fill(rect(314, 80, 36, 10), '#D64545');
  }
}

// ---------- Fantasy lands ----------
// For the pet's adventures: candy, dragons, clouds, the sea floor, the moon and an enchanted forest.

/** A gumdrop-ish mound on `base`, `r` across each way and about `h` tall. */
function mound(cx: number, base: number, r: number, h: number): string {
  const c = base - h * 1.33;
  return `M${n(cx - r)} ${n(base)}C${n(cx - r)} ${n(c)} ${n(cx + r)} ${n(c)} ${n(cx + r)} ${n(base)}Z`;
}

/** The top half of a ring: a band between radius `inner` and `outer`, standing on `cy`. */
function halfRing(cx: number, cy: number, outer: number, inner: number): string {
  return (
    `M${n(cx - outer)} ${n(cy)}A${n(outer)} ${n(outer)} 0 0 1 ${n(cx + outer)} ${n(cy)}` +
    `H${n(cx + inner)}A${n(inner)} ${n(inner)} 0 0 0 ${n(cx - inner)} ${n(cy)}Z`
  );
}

/** A five-pointed star (a starfish, a sparkle on a hat). */
function star(cx: number, cy: number, outer: number, inner: number): string {
  const pts: number[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? inner : outer;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  return poly(...pts);
}

function candyhills(p: Painter) {
  p.fill('M0 136C60 116 120 130 180 122S300 108 360 124V200H0Z', '#FFD1E6');
  p.fill('M0 152C70 136 140 150 220 143S320 136 360 147V200H0Z', '#C9F2D9');
}

function gumdrops(p: Painter) {
  const colors = ['#FF6B9A', '#7ED957', '#FFD54A', '#6EC6FF', '#B98CFF'];
  let x = 150;
  for (let i = 0; x < 340; i++) {
    const r = p.between(14, 22);
    const cx = x + r;
    p.fill(mound(cx, 162, r, r * 1.2), colors[i % colors.length]!);
    p.fill(ellipse(cx - r * 0.38, 162 - r * 0.85, r * 0.16, r * 0.26), '#FFFFFF', 0.55);
    x = cx + r + p.between(4, 12);
  }
}

function lollipops(p: Painter) {
  const pops: [number, number, number, string, string][] = [
    [214, 62, 18, '#FF5C8A', '#FFFFFF'],
    [278, 80, 22, '#6EC6FF', '#FFFFFF'],
    [334, 54, 15, '#FFD54A', '#FF8A3D'],
  ];
  for (const [x, h, r, a, b] of pops) {
    p.fill(rect(x - 2, BASE - h, 4, h), '#F4F1EA');
    const cy = BASE - h - r + 4;
    p.fill(circle(x, cy, r), a);
    p.fill(ring(x, cy, r * 0.74, r * 0.16) + ring(x, cy, r * 0.4, r * 0.15), b, 0.9);
    p.fill(ellipse(x - r * 0.4, cy - r * 0.45, r * 0.2, r * 0.13), '#FFFFFF', 0.5);
  }
}

function candycanes(p: Painter) {
  for (const [x, top, r] of [
    [180, 104, 9],
    [246, 92, 11],
    [318, 110, 8],
  ] as const) {
    const w = 7;
    const outer = r + w / 2;
    const inner = r - w / 2;
    // Up the stick, over the hook and down its end, back under the hook and down the stick.
    p.fill(
      `M${n(x - w / 2)} ${BASE}V${n(top)}A${n(outer)} ${n(outer)} 0 0 1 ${n(x - w / 2 + 2 * outer)} ${n(top)}` +
        `V${n(top + 9)}h${n(-w)}V${n(top)}A${n(inner)} ${n(inner)} 0 0 0 ${n(x + w / 2)} ${n(top)}V${BASE}Z`,
      '#FFFFFF'
    );
    const stripes: string[] = [];
    for (let y = top + 4; y < BASE - 2; y += 11) stripes.push(poly(x - w / 2, y + 4, x + w / 2, y, x + w / 2, y + 4, x - w / 2, y + 8));
    p.fill(stripes.join(''), '#E5304B');
  }
}

function chocriver(p: Painter) {
  p.fill(rect(0, 138, W, 14), '#FFC9E3');
  p.fill('M0 142C90 138 180 148 270 141S340 138 360 142V172H0Z', '#7B4A2B');
  p.fill('M0 150C90 146 180 156 270 149S340 146 360 150V153C340 149 270 152 180 159S90 149 0 153Z', '#9A6440', 0.8);
  const glints: string[] = [];
  for (let i = 0; i < 10; i++) glints.push(ellipse(p.between(0, W), p.between(155, 165), p.between(5, 11), 1));
  p.fill(glints.join(''), '#B07A4F', 0.75);
}

function cupcake(p: Painter, cx: number, w: number, h: number, frosting: string) {
  const top = BASE - h;
  p.fill(poly(cx - w / 2, top, cx + w / 2, top, cx + w * 0.4, BASE, cx - w * 0.4, BASE), '#F3A65A');
  const pleats: string[] = [];
  for (let x = cx - w * 0.36; x < cx + w * 0.36; x += 7) pleats.push(rect(x, top + 3, 1.6, h - 5));
  p.fill(pleats.join(''), '#D98A3E', 0.8);
  p.fill(mound(cx, top + 4, w * 0.58, h * 0.85), frosting);
  p.fill(mound(cx, top - h * 0.32, w * 0.38, h * 0.55), frosting);
  p.fill(ellipse(cx - w * 0.22, top - h * 0.3, w * 0.1, h * 0.1), '#FFFFFF', 0.45);
  p.fill(circle(cx, top - h * 0.86, Math.max(3, w * 0.08)), '#E5304B');
}

function cupcakecastle(p: Painter) {
  cupcake(p, 196, 40, 32, '#B9F18C');
  cupcake(p, 312, 40, 32, '#7FD8FF');
  cupcake(p, 254, 72, 48, '#FF9ED2');
  p.fill(arch(246, 136, 16, 24), '#7A4A2A');
  p.window(arch(226, 128, 7, 10));
  p.window(arch(276, 128, 7, 10));
}

function dragonnest(p: Painter) {
  p.fill(poly(184, BASE, 206, 130, 258, 118, 318, 124, 352, BASE), '#8C8197');
  p.fill(poly(206, 130, 258, 118, 318, 124, 300, 132, 250, 128), '#A49AAE');
  p.fill(ellipse(268, 120, 38, 11), '#8A5A33');
  const twigs: string[] = [];
  for (let i = 0; i < 9; i++) twigs.push(rect(234 + i * 8, 116 + (i % 3), 10, 1.6));
  p.fill(twigs.join(''), '#6B4426');
  const eggs: [number, number, number, string][] = [
    [254, 108, 9, '#9FD7A7'],
    [270, 105, 10, '#F6C76E'],
    [285, 109, 8, '#C79BF2'],
  ];
  for (const [x, y, r, c] of eggs) {
    p.fill(ellipse(x, y, r, r * 1.3), c);
    p.fill(circle(x - r * 0.3, y - r * 0.2, r * 0.18) + circle(x + r * 0.3, y + r * 0.35, r * 0.15), mix(c, '#000000', 0.25), 0.8);
  }
  p.fill(ellipse(268, 123, 38, 5), '#6B4426');
}

function crystals(p: Painter) {
  const shard = (x: number, w: number, h: number, tilt: number) =>
    poly(x - w / 2, BASE, x - w / 2 + tilt, BASE - h * 0.78, x + tilt, BASE - h, x + w / 2 + tilt, BASE - h * 0.78, x + w / 2, BASE);
  const facet = (x: number, w: number, h: number, tilt: number) =>
    poly(x - w / 2, BASE, x - w / 2 + tilt, BASE - h * 0.78, x + tilt, BASE - h, x + tilt * 0.4, BASE);
  const clusters: [number, string][] = [
    [204, '#A77BF3'],
    [282, '#6FE3F2'],
    [336, '#F07BD8'],
  ];
  for (const [cx, color] of clusters) {
    for (const [dx, w, h, tilt] of [
      [-12, 12, 34, -6],
      [0, 16, 56, 0],
      [12, 11, 30, 7],
    ] as const) {
      p.fill(shard(cx + dx, w, h, tilt), color);
      p.fill(facet(cx + dx, w, h, tilt), '#FFFFFF', 0.3);
    }
    // They glow after dark, and on the moon, where there's no daylight to speak of.
    if (p.night || p.dusk || !p.tint) p.light(circle(cx, BASE - 26, 30), color, 0.22);
  }
}

function wizardtower(p: Painter) {
  p.fill(rect(250, 70, 40, 90), '#9A92A8');
  const stones: string[] = [];
  for (let y = 78; y < BASE; y += 10) stones.push(rect(250, y, 40, 1));
  p.fill(stones.join(''), '#7F778F', 0.7);
  p.fill(rect(244, 66, 52, 8), '#857C95');
  p.fill(poly(242, 68, 270, 14, 298, 68), '#5B3FA0');
  p.fill(star(262, 46, 4, 1.8) + star(278, 32, 3, 1.3) + star(274, 58, 3.2, 1.4), '#FFE066');
  p.fill(poly(270, 14, 270, 4, 284, 8), '#FFD54A');
  p.window(arch(263, 86, 14, 18));
  p.window(arch(263, 118, 14, 18));
  p.fill(arch(262, 140, 16, 20), '#5A4232');
}

function skycastle(p: Painter) {
  p.fill(rect(212, 104, 96, 56), '#F4F1FA');
  p.fill(rect(202, 82, 24, 78) + rect(294, 82, 24, 78) + rect(248, 66, 24, 44), '#ECE8F5');
  p.fill(poly(198, 84, 214, 54, 230, 84) + poly(290, 84, 306, 54, 322, 84) + poly(244, 68, 260, 36, 276, 68), '#5B8DEF');
  p.fill(poly(214, 54, 214, 44, 224, 48) + poly(306, 54, 306, 44, 316, 48) + poly(260, 36, 260, 24, 272, 29), '#FFD54A');
  for (const x of [210, 302, 254]) p.window(arch(x, 96, 8, 12));
  p.fill(arch(250, 132, 20, 28), '#B9A9D9');
  // Cloud puffs round its foot.
  p.fill(circle(214, 160, 14) + circle(240, 162, 12) + circle(282, 162, 13) + circle(308, 160, 15), '#FFFFFF');
}

function rainbow(p: Painter) {
  const bands = ['#FF5C5C', '#FF9F43', '#FFD93D', '#6BCB77', '#4D96FF', '#9B5DE5'];
  bands.forEach((color, i) => p.fill(halfRing(250, 166, 118 - i * 8, 110 - i * 8), color, 0.85));
}

function floatisles(p: Painter) {
  const isles: [number, number, number][] = [
    [188, 92, 46],
    [268, 64, 58],
    [330, 104, 38],
  ];
  for (const [cx, y, w] of isles) {
    p.fill(poly(cx - w / 2, y, cx + w / 2, y, cx + w * 0.16, y + w * 0.55, cx - w * 0.08, y + w * 0.46), '#9C8C7A');
    p.fill(poly(cx - w / 2, y, cx - w * 0.1, y, cx - w * 0.08, y + w * 0.46), '#87786A');
    p.fill(ellipse(cx, y, w / 2, 5), '#7CCB6E');
    p.fill(rect(cx + w * 0.12, y - 14, 2.4, 12), '#6B4F3A');
    p.fill(circle(cx + w * 0.13, y - 17, 7), '#5DA454');
  }
  // A waterfall that falls off the edge and never lands.
  p.fill(rect(282, 68, 5, 70), '#BFE6FF', 0.8);
  p.fill(ellipse(284, 140, 10, 4), '#FFFFFF', 0.6);
}

function coral(p: Painter) {
  const reefs: [number, string, number][] = [
    [186, '#FF7A8A', 30],
    [234, '#FFB347', 40],
    [296, '#B784F7', 48],
    [344, '#5ED6C6', 32],
  ];
  for (const [x, color, h] of reefs) {
    const blobs: string[] = [rect(x - 3, BASE - h * 0.6, 6, h * 0.6)];
    for (let i = 0; i < 5; i++) {
      const bx = x + p.between(-h * 0.35, h * 0.35);
      const by = BASE - h * p.between(0.45, 1);
      blobs.push(rect(bx - 2, by, 4, BASE - by), circle(bx, by, p.between(4, 7)));
    }
    p.fill(blobs.join(''), color);
  }
}

function kelp(p: Painter) {
  for (const [x, h] of [
    [150, 110],
    [172, 86],
    [204, 128],
    [232, 74],
    [262, 116],
    [296, 92],
    [326, 120],
    [350, 96],
  ] as const) {
    p.fill(
      `M${x} 168C${x - 12} ${168 - h * 0.35} ${x + 12} ${168 - h * 0.65} ${x} ${168 - h}` +
        `L${x + 6} ${168 - h}C${x + 18} ${168 - h * 0.65} ${x - 6} ${168 - h * 0.35} ${x + 6} 168Z`,
      '#2E9E6B',
      0.9
    );
  }
}

function wreck(p: Painter) {
  p.fill(poly(200, BASE, 214, 128, 330, 118, 346, 150, 300, 166), '#7A5636');
  p.fill(poly(214, 128, 330, 118, 332, 124, 216, 134), '#5E4129');
  p.fill(poly(268, 124, 272, 124, 286, 58, 282, 58), '#6A4A2E');
  p.fill(poly(286, 64, 318, 80, 288, 96), '#E9E1CF', 0.8);
  for (const x of [236, 266, 296]) {
    p.fill(circle(x, 140 - (x - 236) * 0.08, 6), '#C9A86A');
    p.fill(circle(x, 140 - (x - 236) * 0.08, 4), '#2B2219');
  }
}

function shellpalace(p: Painter) {
  p.fill(rect(206, 124, 10, 36) + rect(308, 124, 10, 36), '#F4E6E0');
  p.fill('M212 160C212 82 312 82 312 160Z', '#F7B8C8');
  const ridges: string[] = [];
  for (let i = 1; i < 8; i++) {
    const a = Math.PI + (i * Math.PI) / 8;
    ridges.push(poly(262, 158, 262 + Math.cos(a) * 46 - 2, 160 + Math.sin(a) * 62, 262 + Math.cos(a) * 46 + 2, 160 + Math.sin(a) * 62));
  }
  p.fill(ridges.join(''), '#E896AE');
  p.fill(circle(262, 98, 9), '#FFF6F0');
  p.fill(circle(259, 95, 3), '#FFFFFF', 0.8);
  p.fill(arch(254, 136, 16, 24), '#B5677E');
}

function bubbles(p: Painter) {
  const rings: string[] = [];
  for (let i = 0; i < 16; i++) {
    const r = p.between(2, 5);
    rings.push(ring(p.between(140, W), p.between(20, 150), r, r * 0.3));
  }
  p.fill(rings.join(''), '#E6FAFF', 0.75);
}

function craters(p: Painter) {
  p.fill(ellipse(232, 154, 64, 10), '#A4A7B6');
  p.fill(ellipse(232, 152, 50, 6.5), '#8F92A3');
  p.fill(ellipse(334, 158, 30, 6), '#A4A7B6');
  p.fill(ellipse(334, 157, 22, 4), '#8F92A3');
  // Somebody got here first.
  p.fill(rect(292, 104, 2, 52), '#DADDE6');
  p.fill(rect(294, 104, 26, 16), '#E5484D');
  p.fill(circle(307, 112, 4.5), '#FFFFFF');
}

function unicorn(p: Painter) {
  const white = '#FFFFFF';
  // Facing right, mid-graze-break, with a rainbow mane and tail.
  p.fill(circle(246, 128, 5) + circle(242, 136, 4.5) + circle(243, 144, 4), '#B98CFF');
  p.fill(rect(252, 134, 5, 26) + rect(262, 138, 5, 22) + rect(278, 138, 5, 22) + rect(288, 134, 5, 26), white);
  p.fill(rect(252, 157, 5, 3) + rect(262, 157, 5, 3) + rect(278, 157, 5, 3) + rect(288, 157, 5, 3), '#D9C2F0');
  p.fill(ellipse(272, 132, 25, 12), white);
  p.fill(poly(284, 130, 294, 104, 306, 108, 296, 136), white);
  p.fill(ellipse(304, 106, 11, 7), white);
  p.fill(poly(298, 101, 301, 92, 304, 101), white);
  p.fill(poly(302, 100, 306, 100, 312, 80), '#FFD54A');
  p.fill(circle(290, 108, 4.5), '#FF8FB8');
  p.fill(circle(287, 116, 4.5), '#B98CFF');
  p.fill(circle(285, 124, 4.5), '#7FD8FF');
  p.fill(circle(307, 104, 1.4), '#3A2F25');
}

function rocket(p: Painter) {
  p.fill(rect(196, 152, 68, 8), '#6E7385');
  p.fill(poly(208, 152, 216, 120, 220, 152) + poly(252, 152, 244, 120, 240, 152), '#E5484D');
  p.fill(rect(218, 64, 24, 88), '#F2F2F7');
  p.fill(poly(218, 64, 230, 32, 242, 64), '#E5484D');
  p.fill(rect(218, 112, 24, 6), '#E5484D');
  p.fill(circle(230, 86, 7), '#B0B5C2');
  p.fill(circle(230, 86, 5), '#5BC0EB');
  p.fill(rect(226, 152, 8, 4), '#FF9F43');
}

function planet(p: Painter) {
  const cx = 214;
  const cy = 54;
  // The ring behind, the planet, then the near half of the ring over it.
  p.fill(
    `M${cx - 42} ${cy}a42 9 0 1 0 84 0a42 9 0 1 0 -84 0Z` + `M${cx - 32} ${cy}a32 6 0 1 1 64 0a32 6 0 1 1 -64 0Z`,
    '#F3D9A4',
    0.9
  );
  p.fill(circle(cx, cy, 22), '#E8B86A');
  p.fill(rect(cx - 22, cy - 8, 44, 4) + rect(cx - 21, cy + 4, 42, 3), '#D19A4C', 0.6);
  p.fill(`M${cx - 42} ${cy}A42 9 0 0 0 ${cx + 42} ${cy}L${cx + 32} ${cy}A32 6 0 0 1 ${cx - 32} ${cy}Z`, '#F3D9A4', 0.95);
}

function mushrooms(p: Painter) {
  const houses: [number, number, number][] = [
    [204, 46, 50],
    [272, 34, 38],
    [326, 26, 30],
  ];
  for (const [x, w, h] of houses) {
    p.fill(poly(x - w * 0.3, BASE, x - w * 0.24, BASE - h * 0.62, x + w * 0.24, BASE - h * 0.62, x + w * 0.3, BASE), '#F4E8D0');
    p.fill(mound(x, BASE - h * 0.58, w * 0.62, h * 0.55), '#E5484D');
    p.fill(
      circle(x - w * 0.28, BASE - h * 0.78, w * 0.08) + circle(x + w * 0.12, BASE - h * 0.95, w * 0.1) + circle(x + w * 0.36, BASE - h * 0.72, w * 0.06),
      '#FFFFFF'
    );
    p.fill(arch(x - w * 0.09, BASE - h * 0.34, w * 0.18, h * 0.34), '#8A5A33');
    p.window(circle(x + w * 0.17, BASE - h * 0.42, w * 0.07));
  }
}

function fairylights(p: Painter) {
  const colors = ['#FFD54A', '#FF8FA3', '#7FD8FF', '#B9F18C'];
  const lit = p.night || p.dusk;
  for (let i = 0; i < 22; i++) {
    const x = 150 + i * 10 + p.between(-3, 3);
    const y = 70 + Math.sin(i * 0.55) * 14 + p.between(-4, 4);
    const color = colors[i % colors.length]!;
    if (lit) {
      p.light(circle(x, y, 2.2), color);
      p.light(circle(x, y, 7), color, 0.25);
    } else p.fill(circle(x, y, 2), color);
  }
  const sparkles: string[] = [];
  for (let i = 0; i < 8; i++) sparkles.push(star(p.between(150, W), p.between(30, 140), 3, 1.1));
  if (lit) p.light(sparkles.join(''), '#FFF3B0');
  else p.fill(sparkles.join(''), '#FFFFFF', 0.85);
}

function well(p: Painter) {
  p.fill(rect(240, 130, 60, 30), '#A79C8F');
  const joints: string[] = [];
  for (let y = 136; y < BASE; y += 7) joints.push(rect(240, y, 60, 1));
  for (let y = 130; y < BASE; y += 7) for (let x = 244 + ((y / 7) % 2) * 6; x < 300; x += 12) joints.push(rect(x, y, 1, 7));
  p.fill(joints.join(''), '#8A7F72', 0.7);
  p.fill(ellipse(270, 130, 30, 4), '#4A4038');
  p.fill(rect(244, 94, 5, 36) + rect(291, 94, 5, 36), '#7A5636');
  p.fill(poly(232, 98, 270, 72, 308, 98), '#B5523B');
  p.fill(rect(269, 98, 2, 18), '#C9B48C');
  p.fill(rect(264, 116, 12, 9), '#8A5A33');
}

const FEATURES: Record<Feature, (p: Painter, index: number) => void> = {
  candyhills,
  gumdrops,
  lollipops,
  candycanes,
  chocriver,
  cupcakecastle,
  dragonnest,
  crystals,
  wizardtower,
  skycastle,
  rainbow,
  floatisles,
  coral,
  kelp,
  wreck,
  shellpalace,
  bubbles,
  craters,
  rocket,
  planet,
  mushrooms,
  fairylights,
  well,
  unicorn,
  greatwall,
  pagoda,
  mesas,
  cactus,
  wheat,
  elevator,
  arch: gatewayArch,
  pier,
  balloons,
  cadillacs,
  canyon,
  diner,
  hills,
  crags,
  mountains,
  farshore,
  sea,
  lake,
  river,
  volcano,
  skyline,
  needle,
  parliament,
  bridge,
  oldtown,
  dome,
  spires,
  campanile,
  colosseum,
  ruins,
  wall,
  castle,
  pines,
  trees,
  vines,
  houses,
  falls,
  cliffs,
  lighthouse,
  boat,
  gondola,
  cross,
};

// ---------- Ground ----------

/** About where the ground the characters stand on begins (its top edge, y). */
export const GROUND_TOP = 166;

const GROUND_COLOR: Record<Ground, string> = {
  grass: '#6FB062',
  path: '#6FB062',
  sand: '#EED7A1',
  desert: '#E8C58F',
  stone: '#CDBFA9',
  candy: '#FFC2DE',
  cloud: '#FFFFFF',
  seabed: '#E8D39A',
  moon: '#BFC2CE',
  rock: '#6E5F5A',
};

function ground(p: Painter, kind: Ground, rise: number) {
  const top = 'M0 168C80 160 160 172 240 166S330 160 360 166V200H0Z';
  const low = 'M0 186C90 180 200 190 360 182V200H0Z';
  // A group photo's back rows stand higher up, so the ground rises behind them to meet their feet,
  // filling in under the place (which drawScene lifts by the same). The usual ground draws over its foot.
  const edge = (y: number) => `M0 ${n(y + 4)}C90 ${n(y - 3)} 200 ${n(y + 3)} 270 ${n(y - 1)}S340 ${n(y)} 360 ${n(y + 2)}`;
  if (rise > 0) {
    const y = GROUND_TOP - rise;
    // Surf just above the raised sand's edge, which the sand then draws up to.
    if (kind === 'sand') p.fill(`${edge(y - 3)}V${n(y + 6)}H0Z`, '#FFFFFF', 0.55);
    p.fill(`${edge(y)}V200H0Z`, GROUND_COLOR[kind]);
  }
  if (kind === 'sand') {
    // The surf line sits where the sand meets the water: on the rise, if there is one.
    if (rise <= 0) p.fill('M0 164C80 158 160 168 240 163S330 158 360 163V170H0Z', '#FFFFFF', 0.55);
    p.fill(top, '#EED7A1');
    p.fill(low, '#E3C789');
    return;
  }
  if (kind === 'candy') {
    p.fill(top, '#FFC2DE');
    p.fill(low, '#F7A3CB');
    const colors = ['#FFD54A', '#7FD8FF', '#B9F18C', '#FFFFFF', '#B98CFF'];
    for (let i = 0; i < 30; i++) {
      p.fill(ellipse(p.between(0, W), p.between(172, 198), p.between(1.6, 2.6), 0.9), colors[i % colors.length]!);
    }
    return;
  }
  if (kind === 'cloud') {
    p.fill(top, '#FFFFFF');
    const puffs: string[] = [];
    for (let x = -10; x < W + 20; x += p.between(18, 28)) puffs.push(circle(x, 168, p.between(9, 15)));
    p.fill(puffs.join(''), '#FFFFFF');
    p.fill(low, '#E6F0FC');
    return;
  }
  if (kind === 'seabed') {
    p.fill(top, '#E8D39A');
    p.fill(low, '#D9BE7E');
    const pebbles: string[] = [];
    for (let i = 0; i < 12; i++) pebbles.push(ellipse(p.between(0, W), p.between(174, 198), p.between(1.5, 3), p.between(1, 1.8)));
    p.fill(pebbles.join(''), '#BFA06A', 0.7);
    p.fill(star(p.between(140, 200), p.between(180, 192), 6, 2.4) + star(p.between(300, 340), p.between(184, 194), 5, 2), '#FF8A5B');
    return;
  }
  if (kind === 'rock') {
    p.fill(top, '#6E5F5A');
    p.fill(low, '#5A4C48');
    const cracks: string[] = [];
    for (let i = 0; i < 6; i++) {
      const x = p.between(0, W);
      const y = p.between(174, 194);
      cracks.push(poly(x, y, x + 8, y - 2, x + 16, y + 1, x + 8, y + 0.8));
    }
    // Embers in the cracks, brighter after dark.
    if (p.night || p.dusk) p.light(cracks.join(''), '#FF8A3D', 0.9);
    else p.fill(cracks.join(''), '#D9682B', 0.8);
    const rocks: string[] = [];
    for (let i = 0; i < 8; i++) rocks.push(ellipse(p.between(0, W), p.between(172, 198), p.between(2, 4), p.between(1.2, 2)));
    p.fill(rocks.join(''), '#4A3E3A');
    return;
  }
  if (kind === 'moon') {
    p.fill(top, '#BFC2CE');
    p.fill(low, '#A9ACBA');
    for (let i = 0; i < 7; i++) {
      const x = p.between(0, W);
      const y = p.between(176, 196);
      const r = p.between(4, 9);
      p.fill(ellipse(x, y, r, r * 0.35), '#9A9DAD');
      p.fill(ellipse(x, y - r * 0.12, r * 0.8, r * 0.22), '#8A8D9D');
    }
    return;
  }
  if (kind === 'desert') {
    p.fill(top, '#E8C58F');
    p.fill(low, '#DDB47A');
    const stones: string[] = [];
    for (let i = 0; i < 14; i++) stones.push(ellipse(p.between(0, W), p.between(174, 198), p.between(1.5, 3), p.between(1, 1.8)));
    p.fill(stones.join(''), '#B98F5E', 0.7);
    return;
  }
  if (kind === 'stone') {
    p.fill(top, '#CDBFA9');
    const joints: string[] = [];
    for (let y = 174; y < 200; y += 7) joints.push(rect(0, y, W, 0.8));
    for (let y = 174; y < 200; y += 7) for (let x = (y % 14) * 2; x < W; x += 22) joints.push(rect(x, y, 0.8, 7));
    p.fill(joints.join(''), '#B3A48C', 0.6);
    // Street lamps, lit after dark.
    for (const x of [24, 336]) {
      p.fill(rect(x - 1, 140, 2, 34), '#4A4A52');
      p.fill(rect(x - 3, 136, 6, 5), '#4A4A52');
      if (p.night || p.dusk) {
        p.light(circle(x, 138, 3), '#FFD36E');
        p.light(circle(x, 140, 14), '#FFD36E', 0.2);
      }
    }
    return;
  }
  p.fill(top, '#6FB062');
  p.fill(low, '#5FA055');
  if (kind === 'path') {
    p.fill('M40 200C80 186 170 178 270 166L286 167C190 182 130 192 112 200Z', '#D8BF8E');
  }
  const tufts: string[] = [];
  for (let i = 0; i < 18; i++) {
    const x = p.between(0, W);
    const y = p.between(172, 198);
    tufts.push(poly(x - 2, y, x, y - 4, x + 2, y));
  }
  p.fill(tufts.join(''), '#4F8E47', 0.8);
}

/**
 * The scene for a place at a time of day. `name` seeds the variation, so each stop keeps its own
 * look. `rise` raises the ground behind a group photo by that much, so its back rows stand on it,
 * and lifts the place behind by the same, so nothing is buried.
 */
export function drawScene(scene: Scene, time: TimeOfDay, name: string, rise = 0): SceneArt {
  // The sky draws from its own random stream (night has stars, day has clouds), so the place itself
  // comes out the same at every hour.
  const [kind, ...features] = scene;
  const p = new Painter(time, seeded(hash(`${name}:sky`)));
  sky(p, kind);
  p.rand = seeded(hash(name));
  // Space looks the same at any hour.
  p.tint = kind === 'moon' ? null : TINT[time];
  const seen = new Map<Feature, number>();
  for (const f of features) {
    const index = seen.get(f) ?? 0;
    seen.set(f, index + 1);
    FEATURES[f](p, index);
    p.flushWindows(STONE_WINDOW);
  }
  // For a group photo the whole place moves up by the rise, so landmarks keep their full height
  // standing behind the raised ground rather than being buried by it.
  const lift = (shapes: Shape[]) => (rise > 0 ? shapes.map((shape) => ({ ...shape, lift: rise })) : shapes);
  const place = lift(p.shapes.splice(0));
  const placeLights = lift(p.lights.splice(0));
  ground(p, kind, rise);
  return { sky: skyFor(kind, time), shapes: [...place, ...p.shapes, ...placeLights, ...p.lights] };
}
