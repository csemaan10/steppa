// Podium entrances: how a character gets up onto their block. Each entrance is a timeline in
// seconds; the same `t` drives the character's pose (in the rig), where the character is (here)
// and the effects round it (entrance-fx), so they always stay in step.
// Positions are in points, relative to where the character ends up standing on the block:
// x to the right, y down (so up is negative). `g` is the block's height, which is how far below
// the final spot the floor is; `H` is the character's height.

import type { Entrance } from '@/lib/character';

export type EntranceKind = Exclude<Entrance, 'rise'>;
/** Motions the rig has for entrances. */
export type EntrancePose =
  | 'e-jump' | 'e-fly' | 'e-lantern' | 'e-web' | 'e-cards' | 'e-cars' | 'e-pop' | 'e-jet' | 'e-chute' | 'e-horse'
  | 'e-carpet' | 'e-ufo' | 'e-zip';

export const ENTRANCE_SECONDS: Record<EntranceKind, number> = {
  bigjump: 1.5,
  superman: 1.5,
  lantern: 1.9,
  web: 1.8,
  cards: 2.0,
  cars: 2.6,
  teleport: 1.6,
  lightning: 1.7,
  jetpack: 2.2,
  parachute: 2.6,
  portal: 2.0,
  horseride: 2.6,
  carpet: 2.6,
  ufo: 2.6,
  zipline: 2.7,
};
export const ENTRANCE_POSE: Record<EntranceKind, EntrancePose> = {
  bigjump: 'e-jump',
  superman: 'e-fly',
  lantern: 'e-lantern',
  web: 'e-web',
  cards: 'e-cards',
  cars: 'e-cars',
  teleport: 'e-pop',
  lightning: 'e-pop',
  jetpack: 'e-jet',
  parachute: 'e-chute',
  portal: 'e-pop',
  horseride: 'e-horse',
  carpet: 'e-carpet',
  ufo: 'e-ufo',
  zipline: 'e-zip',
};

export type EntranceState = {
  x: number;
  y: number;
  /** Radians, about the middle of the character. */
  rot: number;
  /** Squash and stretch, about the feet. */
  sx: number;
  sy: number;
  /** 0 while the character isn't there yet. */
  o: number;
};

function clamp01(v: number): number {
  'worklet';
  return Math.min(1, Math.max(0, v));
}
function sm(v: number): number {
  'worklet';
  const k = clamp01(v);
  return k * k * (3 - 2 * k);
}
function lerp(a: number, b: number, k: number): number {
  'worklet';
  return a + (b - a) * k;
}
/** A half sine over [a, b]: 0 outside, 1 in the middle. */
function bump(t: number, a: number, b: number): number {
  'worklet';
  return t > a && t < b ? Math.sin((Math.PI * (t - a)) / (b - a)) : 0;
}
/** A jump arc from y0 to y1 with the given extra height, for s in 0 → 1. */
function arc(y0: number, y1: number, peak: number, s: number): number {
  'worklet';
  return lerp(y0, y1, s) - peak * 4 * s * (1 - s);
}

// Time windows: 'wind' crouches, 'air' is off the ground, 'land' absorbs the landing.
type Jumper = 'bigjump' | 'cards' | 'cars' | 'horseride' | 'carpet' | 'ufo' | 'zipline';
const JUMPERS: readonly string[] = ['bigjump', 'cards', 'cars', 'horseride', 'carpet', 'ufo', 'zipline'] satisfies Jumper[];

const SEGMENTS: Record<Jumper, [number, number, 'wind' | 'air' | 'land'][]> = {
  bigjump: [[0, 0.3, 'wind'], [0.3, 1.15, 'air'], [1.15, 1.5, 'land']],
  cards: [[0.7, 0.78, 'wind'], [0.78, 1.65, 'air'], [1.65, 2.0, 'land']],
  cars: [
    [0.55, 1.05, 'air'], [1.05, 1.2, 'land'], [1.2, 1.5, 'air'], [1.5, 1.62, 'wind'],
    [1.62, 2.35, 'air'], [2.35, 2.6, 'land'],
  ],
  horseride: [[1.42, 1.52, 'wind'], [1.52, 2.28, 'air'], [2.28, 2.58, 'land']],
  carpet: [[1.5, 1.6, 'wind'], [1.6, 1.95, 'air'], [1.95, 2.25, 'land']],
  ufo: [[1.9, 2.15, 'land']],
  zipline: [[1.8, 2.25, 'air'], [2.25, 2.55, 'land']],
};

/** For the jumping entrances: how airborne (0 or 1) and how crouched (0 → 1) the character is. */
export function jumpLimbs(kind: EntranceKind, t: number): { air: number; squat: number } {
  'worklet';
  if (!JUMPERS.includes(kind)) return { air: 0, squat: 0 };
  const segs = SEGMENTS[kind as Jumper];
  for (let i = 0; i < segs.length; i++) {
    const [a, b, type] = segs[i]!;
    if (t >= a && t < b) {
      if (type === 'air') return { air: 1, squat: 0 };
      if (type === 'wind') return { air: 0, squat: sm((t - a) / (b - a)) };
      return { air: 0, squat: 0.9 * Math.sin((Math.PI * (t - a)) / (b - a)) };
    }
  }
  return { air: 0, squat: 0 };
}

/** The car's size, relative to the character's height. */
export const CAR_LENGTH = 1.25;
export const CAR_HEIGHT = 0.46;
/** The spider web's anchor, above where the character ends up. */
export const WEB_ANCHOR_UP = 2.0;
/** The impact point of the thrown card, to the right of the character at floor level. */
export const CARD_TARGET_X = 0.5;

/** How squashed the car is by the character landing on it (0 → 1). */
export function carSquash(t: number): number {
  'worklet';
  return Math.min(1, Math.max(bump(t, 1.05, 1.2), bump(t, 1.5, 1.64) * 1.3));
}

// Horse ride: the horse gallops in sideways from the left with the character sitting on it (facing
// us), leaps under the spot and throws them up onto the block, then gallops off to the right.
// The horse is drawn in its own units (the pet horse's shapes, bigger): feet at y = 0, facing left.

/** Character heights per horse unit. */
export const HORSE_UNIT = 1 / 30;
/** Where the character sits on the horse's back, in horse units (x from its middle, height). */
export const HORSE_SEAT = { x: 1, y: 17 };
/** When the character leaves the horse's back, and lands on the block (as in SEGMENTS). */
export const HORSE_LAUNCH = 1.52;
const HORSE_TOUCHDOWN = 2.28;
/** The horse's leap under the spot: when it takes off, and how long it's in the air. */
export const HORSE_LEAP = { start: 1.35, length: 0.5 };
/** How far off to the side the horse starts and ends, in character heights: past the screen edge from any spot. */
const HORSE_AWAY = 7.6;
/** When the horse passes under the spot, and how long it takes to gallop off after. */
const HORSE_PASS = 1.6;
const HORSE_EXIT = 1.0;
/** Its speed under the spot, in character heights per second: an easy canter (it's much faster off screen). */
const HORSE_CANTER = 2;
/** How far the horse goes in one stride, in character heights. */
const HORSE_STRIDE = 0.75;

/**
 * The horse's seat, sideways from the spot, in points. Fast while it's off screen, slowing to a
 * canter as it nears the spot, then speeding up again as it goes off.
 */
export function horseX(t: number, H: number): number {
  'worklet';
  const d = t - HORSE_PASS;
  const span = d < 0 ? HORSE_PASS : HORSE_EXIT;
  // Steady canter plus a cubic that adds the rest of the distance far from the spot (and adds no
  // speed at the spot itself).
  const extra = HORSE_AWAY - HORSE_CANTER * span;
  return H * (HORSE_CANTER * d + Math.sign(d) * extra * Math.pow(Math.abs(d) / span, 3));
}

/** Where the horse is in its stride cycle (radians), from how far it has gone: the legs keep pace with the ground. */
export function gallopPhase(t: number): number {
  'worklet';
  return ((horseX(t, 1) / HORSE_STRIDE) * 2 * Math.PI) % (2 * Math.PI);
}

/** How far into its leap the horse is (0 → 1; 0 before and 1 after). */
export function horseLeapProgress(t: number): number {
  'worklet';
  return clamp01((t - HORSE_LEAP.start) / HORSE_LEAP.length);
}

/** How much the horse's leap under the spot is under way (0 → 1 → 0). */
export function horseLeap(t: number): number {
  'worklet';
  const s = horseLeapProgress(t);
  return 4 * s * (1 - s);
}

/** How high the horse's body is off its standing height, in points: the gallop's bounce plus the leap. */
export function horseLift(t: number, H: number): number {
  'worklet';
  const leap = horseLeap(t);
  return (1 - leap) * 0.8 * HORSE_UNIT * H * (0.5 + 0.5 * Math.sin(gallopPhase(t))) + 0.24 * H * leap;
}

/** Where the character's feet are while sitting on the horse (legs dangling down its side). */
function riderY(t: number, H: number, g: number): number {
  'worklet';
  // Seat height, less the hips' height above the feet (about 0.19 heights, sitting on the seat).
  return g - horseLift(t, H) - HORSE_SEAT.y * HORSE_UNIT * H + 0.19 * H;
}

// Magic carpet: swoops in from high on the left with the character sitting cross-legged on it,
// hovers over the block while they hop off onto it, then flies off up to the right.

/** Arrives over the block, they hop off (landing as in SEGMENTS), it flies off, and it's gone. */
export const CARPET = { arrive: 1.4, hop: 1.6, land: 1.95, leave: 1.75, gone: 2.6 };
/** How far the character's feet line is above the carpet sitting cross-legged on it, in character heights. */
const CARPET_SEAT = 0.135;
/** The carpet's length, in character heights. */
export const CARPET_LENGTH = 1.1;

/** The middle of the carpet's top, in points from the spot. */
export function carpetPos(t: number, H: number): { x: number; y: number } {
  'worklet';
  if (t < CARPET.arrive) {
    // A curve from off screen high on the left, swooping down to the block's height and easing up
    // into a hover just over it.
    const u = 1 - Math.pow(1 - clamp01(t / CARPET.arrive), 2);
    const a = (1 - u) * (1 - u);
    const b = 2 * u * (1 - u);
    const c = u * u;
    return { x: H * (a * -6.5 + b * -2.5), y: H * (a * -2.4 + b * 0.8 + c * -0.25) };
  }
  const y = H * (-0.25 + 0.03 * Math.sin((t - CARPET.arrive) * 5));
  if (t < CARPET.leave) return { x: 0, y };
  const k = Math.pow(clamp01((t - CARPET.leave) / (CARPET.gone - CARPET.leave)), 2);
  return { x: lerp(0, 6.5 * H, k), y: lerp(y, -2.6 * H, k) };
}

// UFO beam: a flying saucer comes in high from the right and hovers over the spot, its beam
// lowers the character down onto the block (coming out of it small), then it zips off.

/** Hovering, the beam on, the character appearing, touching down (as in SEGMENTS), beam off, gone. */
export const UFO = { hover: 0.7, beamOn: 0.7, appear: 0.85, touchdown: 1.9, beamOff: 2.0, gone: 2.6 };

/** The middle of the saucer's underside, in points from the spot. */
export function ufoPos(t: number, H: number): { x: number; y: number } {
  'worklet';
  if (t < UFO.hover) {
    const k = 1 - Math.pow(1 - clamp01(t / UFO.hover), 3);
    return { x: lerp(6 * H, 0, k), y: lerp(-2.7 * H, -2.3 * H, k) };
  }
  const y = -2.3 * H + 0.05 * H * Math.sin((t - UFO.hover) * 4);
  if (t < UFO.beamOff) return { x: 0, y };
  const k = Math.pow(clamp01((t - UFO.beamOff) / (UFO.gone - UFO.beamOff)), 2);
  return { x: lerp(0, -6 * H, k), y: lerp(y, -3 * H, k) };
}

/** How strong the beam is (0 → 1). */
export function ufoBeam(t: number): number {
  'worklet';
  return sm((t - UFO.beamOn) / 0.15) * (1 - sm((t - (UFO.beamOff - 0.05)) / 0.2));
}

// Zipline: a line from high on the left down to low on the right; the character hangs from a
// pulley's handle, slides down it, lets go over the block and drops on. The pulley runs on off.

/** The line's ends, in character heights from the spot; when they let go and land (as in SEGMENTS); when the line is gone. */
export const ZIP = { from: { x: -6, y: -2.6 }, to: { x: 6, y: -0.2 }, release: 1.8, land: 2.25, gone: 2.7 };
/** Where along the line (x, in character heights) they let go: just before the spot, so they carry on over it. */
const ZIP_RELEASE_X = -0.45;
/**
 * How far the handle bar hangs below the line, and the feet below the bar, in character heights.
 * Hands up only reach the sides of the head, so the bar hangs behind it, well clear of the hair.
 */
export const ZIP_HANDLE = 0.25;
const ZIP_HANG = ZIP_HANDLE + 0.625;

/** How far along the line the pulley is (x, in points from the spot): speeding up downhill, then running on. */
export function zipX(t: number, H: number): number {
  'worklet';
  const span = ZIP_RELEASE_X - ZIP.from.x;
  if (t < ZIP.release) return H * (ZIP.from.x + span * Math.pow(t / ZIP.release, 1.3));
  return H * (ZIP_RELEASE_X + ((span * 1.3) / ZIP.release) * (t - ZIP.release));
}

/** The line's height at `x` (both in points from the spot). */
export function zipY(x: number, H: number): number {
  'worklet';
  const k = (x / H - ZIP.from.x) / (ZIP.to.x - ZIP.from.x);
  return H * lerp(ZIP.from.y, ZIP.to.y, k);
}

/** How far the character leans and swings, hanging from the handle (radians). */
function zipSwing(t: number): number {
  'worklet';
  return 0.1 * sm(t / 0.6) + 0.05 * Math.sin(t * 6);
}

/**
 * How far each side of the character the effects reach, in character heights. The car and the
 * horse need room to come in from and go off past the edge of the screen, from any spot on the podium.
 */
export function fxSide(kind: EntranceKind): number {
  'worklet';
  if (kind === 'cars') return 7;
  if (kind === 'horseride') return HORSE_AWAY + 0.6;
  if (kind === 'carpet' || kind === 'zipline') return 7;
  if (kind === 'ufo') return 6.7;
  return 3.2;
}

/** How far the car is from where it stops under the character: it drives in, waits, drives off. */
export function carX(t: number, W: number): number {
  'worklet';
  // Far enough that the whole car is past the screen edge (W is the character's width, 2 heights).
  const away = (W / 2) * (6.2 + CAR_LENGTH / 2);
  if (t < 0.8) return -away * (1 - Math.pow(sm(t / 0.8), 0.6));
  if (t > 2.0) return away * Math.pow(sm((t - 2.0) / 0.6), 1.5);
  return 0;
}

/**
 * When an entrance's effects head off sideways across the neighbouring spots (seconds in): the
 * podium brings its spot to the front again then, so they pass over the other blocks.
 */
export const ENTRANCE_HEADS_OFF: Partial<Record<EntranceKind, number>> = {
  cars: 2.0,
  horseride: HORSE_LAUNCH,
  carpet: CARPET.leave,
  ufo: UFO.beamOff,
  zipline: ZIP.release,
};

/** Where the character is at time `t` of the entrance. */
export function entranceState(kind: EntranceKind, t: number, H: number, g: number): EntranceState {
  'worklet';
  const s: EntranceState = { x: 0, y: 0, rot: 0, sx: 1, sy: 1, o: t < 0 ? 0 : 1 };
  if (t < 0) {
    s.y = g;
    return s;
  }
  if (kind === 'bigjump') {
    if (t < 0.3) s.y = g;
    else if (t < 1.15) {
      const k = (t - 0.3) / 0.85;
      s.y = arc(g, 0, 0.55 * g + 0.5 * H, k);
    }
  } else if (kind === 'superman') {
    // A fast climb up and across from the lower left, overshooting a little, then settling down.
    const run = sm(t / 1.05);
    if (t < 1.05) s.y = lerp(g, -0.25 * H, run);
    else s.y = lerp(-0.25 * H, 0, sm((t - 1.05) / 0.45));
    s.x = -0.5 * H * (1 - sm(t / 1.3));
    s.rot = 0.4 * (1 - sm(t / 1.3));
  } else if (kind === 'lantern') {
    // A slow, steady glide up on a column of green light, a gentle bob, a soft landing.
    const e = sm(t / 1.5);
    s.y = lerp(g, 0, e) - 0.16 * H * Math.sin(Math.PI * e) + 0.03 * H * Math.sin(t * 7) * (1 - e);
  } else if (kind === 'web') {
    const ax = 0;
    const ay = -WEB_ANCHOR_UP * H;
    const x0 = -0.9 * H;
    if (t < 0.35) {
      s.x = x0;
      s.y = g;
    } else {
      const e = sm((t - 0.35) / 1.15);
      const vx = x0 - ax;
      const vy = g - ay;
      const a0 = Math.atan2(vx, vy);
      const r0 = Math.hypot(vx, vy);
      const r = lerp(r0, WEB_ANCHOR_UP * H, e);
      const ang = lerp(a0, 0, e);
      s.x = ax + r * Math.sin(ang);
      s.y = ay + r * Math.cos(ang) - 0.28 * H * bump(t, 1.2, 1.7);
      s.rot = ang * 0.9;
    }
  } else if (kind === 'cards') {
    if (t < 0.75) s.y = g;
    else if (t < 1.65) {
      const k = (t - 0.75) / 0.9;
      s.y = arc(g, 0, 0.5 * g + 0.6 * H, k);
    }
  } else if (kind === 'teleport') {
    // Gone, then a puff of smoke and they pop into place with a little overshoot.
    s.o = t < 0.5 ? 0 : 1;
    const sc = lerp(0.2, 1, sm((t - 0.5) / 0.3)) + 0.12 * bump(t, 0.5, 0.9);
    s.sx = sc;
    s.sy = sc;
  } else if (kind === 'lightning') {
    // A bolt hits the block; they appear in the flash, flickering and buzzing, then steady.
    const zap = t > 0.38 && t < 0.85;
    s.o = t < 0.38 ? 0 : zap && Math.floor(t * 30) % 3 === 0 ? 0.35 : 1;
    s.x = zap ? Math.sin(t * 90) * 0.02 * H : 0;
  } else if (kind === 'jetpack') {
    // Lights the engines on the floor, climbs wobbling on the thrust, and eases down onto the block.
    if (t < 0.4) s.y = g;
    else if (t < 1.8) {
      const e = sm((t - 0.4) / 1.4);
      s.y = lerp(g, -0.18 * H, e) + 0.02 * H * Math.sin(t * 12) * e;
      s.x = 0.04 * H * Math.sin(t * 5) * e;
      s.rot = 0.06 * Math.sin(t * 6) * e;
    } else if (t < 2.2) s.y = lerp(-0.18 * H, 0, sm((t - 1.8) / 0.4));
  } else if (kind === 'parachute') {
    // Floats down from above, swaying, and touches down with a small squat.
    if (t < 2.0) {
      const k = t / 2.0;
      s.y = lerp(-2.4 * H, 0, 1 - Math.pow(1 - k, 1.35));
      s.x = 0.35 * H * Math.sin(k * 5) * (1 - k);
      s.rot = 0.12 * Math.cos(k * 5) * (1 - k);
    }
    s.sy = 1 - 0.1 * bump(t, 2.0, 2.3);
    s.sx = 1 + 0.06 * bump(t, 2.0, 2.3);
  } else if (kind === 'horseride') {
    // Riding in on the horse, then thrown from its back as it leaps, up and across onto the block.
    if (t < HORSE_LAUNCH) {
      s.x = horseX(t, H);
      s.y = riderY(t, H, g);
    } else if (t < HORSE_TOUCHDOWN) {
      const k = (t - HORSE_LAUNCH) / (HORSE_TOUCHDOWN - HORSE_LAUNCH);
      const y0 = riderY(HORSE_LAUNCH, H, g);
      s.x = lerp(horseX(HORSE_LAUNCH, H), 0, sm(k));
      s.y = arc(y0, 0, 0.35 * Math.max(0, y0) + 0.55 * H, k);
      s.rot = -0.25 * bump(t, HORSE_LAUNCH, HORSE_TOUCHDOWN);
    }
  } else if (kind === 'carpet') {
    // Sitting on the carpet as it flies in and hovers, then a hop up off it onto the block.
    if (t < CARPET.hop) {
      const c = carpetPos(t, H);
      s.x = c.x;
      s.y = c.y + CARPET_SEAT * H;
    } else if (t < CARPET.land) {
      const y0 = carpetPos(CARPET.hop, H).y + CARPET_SEAT * H;
      s.y = arc(y0, 0, 0.35 * H, (t - CARPET.hop) / (CARPET.land - CARPET.hop));
    }
  } else if (kind === 'ufo') {
    // Out of the saucer small (and faint), growing to full size, then drifting down the beam,
    // swaying, onto the block.
    s.o = clamp01((t - UFO.appear) / 0.15);
    if (t < UFO.touchdown) {
      const e = sm((t - UFO.appear) / (UFO.touchdown - UFO.appear));
      const sc = lerp(0.35, 1, sm((t - UFO.appear) / 0.4));
      s.y = lerp(ufoPos(t, H).y + 0.35 * H, 0, e);
      s.sx = sc;
      s.sy = sc;
      s.rot = 0.08 * Math.sin(t * 4.5) * (1 - e);
    }
  } else if (kind === 'zipline') {
    // Hanging from the handle sliding down the line, then letting go and dropping onto the block.
    if (t < ZIP.release) {
      s.x = zipX(t, H);
      s.y = zipY(s.x, H) + ZIP_HANG * H;
      s.rot = zipSwing(t);
    } else if (t < ZIP.land) {
      const k = (t - ZIP.release) / (ZIP.land - ZIP.release);
      const x0 = zipX(ZIP.release, H);
      s.x = lerp(x0, 0, sm(k));
      s.y = arc(zipY(x0, H) + ZIP_HANG * H, 0, 0.2 * H, k);
      s.rot = lerp(zipSwing(ZIP.release), 0, sm(k));
    }
  } else if (kind === 'portal') {
    // A ring opens on the block and they rise out of it, growing as they come through.
    const k = sm((t - 0.4) / 0.6);
    s.o = k;
    s.y = lerp(0.55 * H, 0, k);
    s.sx = lerp(0.6, 1, k);
    s.sy = s.sx;
  } else {
    // The roof dips as the car is landed on.
    const roof = g - (CAR_HEIGHT - 0.02) * H * (1 - 0.2 * carSquash(t));
    if (t < 0.55) s.o = 0;
    else if (t < 1.05) {
      const k = (t - 0.55) / 0.5;
      s.y = lerp(-1.9 * H, roof, k * k);
    } else if (t < 1.2) s.y = roof;
    else if (t < 1.5) s.y = arc(roof, roof, 0.45 * H, (t - 1.2) / 0.3);
    else if (t < 1.62) s.y = roof;
    else if (t < 2.35) {
      const k = (t - 1.62) / 0.73;
      s.y = arc(roof, 0, 0.3 * roof + 0.7 * H, k);
    }
  }
  // Squash while crouching or landing.
  if (JUMPERS.includes(kind)) {
    const q = jumpLimbs(kind, t).squat;
    s.sy *= 1 - 0.12 * q;
    s.sx *= 1 + 0.07 * q;
  }
  return s;
}
