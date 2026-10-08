// The character rig: every animated shape of a podium scene, worked out for a moment in time.
// All functions are worklets so they run on the UI thread each frame. A scene is 120 × 60 units
// (viewBox "-30 0 120 60"): the character stands in x 0–60 on y = 58.5, pets use the sides.
// Ported one-to-one from the approved web preview.

import type { Bottom, Expression, HairStyle, Idle, Pet, Top } from '@/lib/character';

/**
 * A podium idle, 'walk' (the Today screen's walker), or a recap reaction: 'cheer' on the podium,
 * 'sad' off it.
 */
export type Motion = Idle | 'walk' | 'cheer' | 'sad';
/** `facing` turns the face toward where they're walking: -1 left, 0 ahead, 1 right. */
export type RigLook = {
  hair: HairStyle;
  top: Top;
  bottom: Bottom;
  expression: Expression;
  idle: Motion;
  pets: Pet[];
  facing?: number;
};
export type Frame = Record<string, number | string>;

const TAU = Math.PI * 2;
const HIP = { x: 30, y: 45 };
const NECK = { x: 30, y: 31 };
const HEAD = { x: 30, y: 23, r: 8.5 };
const SHOULDER_L = { x: 25.5, y: 33 };
const SHOULDER_R = { x: 34.5, y: 33 };
const HIP_L = { x: 27.5, y: 45 };
const HIP_R = { x: 32.5, y: 45 };
const UPPER = 6.5;
const FORE = 6;
const LEG = 12;
export const YARN_BALL = { x: 45.5, y: 55.9 };
/** Where each cat sits: first cat, second cat. */
export const CAT_X = [-7, -20];
export const DOG_X = 66;
export const HORSE_X = 76;
/** Where the web swing hangs from: above the top of the scene. */
const WEB_PIVOT = { x: 30, y: -20 };
/** Walk cycles per second (two steps each). */
export const WALK_HZ = 1;
/** Seconds per hop of the podium cheer. */
export const CHEER_HOP = 0.8;

type Pt = { x: number; y: number };
type Arm = { a: number; f: number };
type Ball = { kind: 'soccer' | 'volley' | 'basket' | 'tennis'; x: number; y: number; spin: number; opacity?: number };
type Pose = {
  angle: number;
  pivot?: Pt;
  lie?: boolean;
  bob: number;
  tilt: number;
  shadow?: number;
  armsFront?: boolean;
  armL: Arm;
  armR: Arm;
  legL: number;
  legR: number;
  kneeL?: number;
  kneeR?: number;
  liftL?: number;
  liftR?: number;
  eyes: number;
  mouth: { w: number; curve: number; open?: number };
  bicep?: number;
  zzz?: number;
  ball?: Ball;
  knit?: boolean;
  /** Archery: string pulled back (1) or released (0), how far the arrow has flown, its opacity. */
  bow?: { drawn: number; fly: number; arrowO: number };
  /** Guitar: progress of a music note floating up (0 → 1). */
  guitar?: number;
  /** Jump rope: the rope's angle around the body (radians). */
  rope?: number;
  /** Skateboard: how high the board has popped and its tilt (degrees). */
  board?: { lift: number; deg: number };
  /** Meditate: the aura's pulse (0 → 1). */
  aura?: number;
  /** Tennis: a racket in the right hand. */
  racket?: boolean;
  /** Web swing: how far the web has shot from the right hand toward its anchor (0 → 1), and its opacity. */
  web?: { reach: number; o: number };
  /** Card throw: the glowing card (in the hand until thrown) and its burst at the end. */
  card?: { spring: number; held: boolean; charge: number; x: number; y: number; deg: number; o: number; burstR: number; burstO: number };
  /** Hero pose: the cape's flutter time. */
  cape?: number;
  /** Power construct: the glowing hammer's angle and opacity, and the shockwave where it lands. */
  construct?: { deg: number; o: number; rise: number; rippleR: number; rippleO: number };
  /** Shield throw: where the shield is (in the hand when `held`), its spin, and whether it shows. */
  shield?: { held: boolean; x: number; y: number; spin: number };
  /** Thunder strike: the hammer in the raised hand, and the lightning bolt's flash (0 = none). */
  thunder?: { bolt: number; seed: number };
  /** Speedster: which crackle pattern of lightning to show this moment. */
  sparks?: number;
  /** How far the head hangs toward the chest. */
  headDrop?: number;
  /** Sad brows, plus a tear's progress down the cheek (0 → 1). */
  tear?: number;
};

function f(n: number): string {
  'worklet';
  return n.toFixed(2);
}

/** A repeatable pseudo-random number in [0, 1) for an integer (for flickering lightning). */
function hash01(n: number): number {
  'worklet';
  const v = Math.sin(n * 12.9898) * 43758.5453;
  return v - Math.floor(v);
}

function clamp01(v: number): number {
  'worklet';
  return Math.min(1, Math.max(0, v));
}

function mix(a: number, b: number, k: number): number {
  'worklet';
  return a + (b - a) * k;
}

function rot(p: Pt, c: Pt, a: number): Pt {
  'worklet';
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  return { x: c.x + (p.x - c.x) * cos - (p.y - c.y) * sin, y: c.y + (p.x - c.x) * sin + (p.y - c.y) * cos };
}

/** Limb angle convention: 0 = straight down, positive = outward from the body. */
function limb(from: Pt, side: number, angle: number, len: number): Pt {
  'worklet';
  return { x: from.x + side * Math.sin(angle) * len, y: from.y + Math.cos(angle) * len };
}

export function blink(t: number, seed: number): number {
  'worklet';
  const period = 3.4;
  const phase = ((t + seed * 1.7) % period) / period;
  const d = Math.abs(phase - 0.5) * period;
  return d < 0.08 ? Math.max(0.1, d / 0.08) : 1;
}

/** 0 → 1 → 0 over a 4 s cycle: closed smile, open into a toothy grin, hold, close. */
function grin(t: number, seed: number): number {
  'worklet';
  const u = ((t + seed * 2.3) % 4) / 4;
  const ease = (v: number) => v * v * (3 - 2 * v);
  if (u < 0.35) return 0;
  if (u < 0.45) return ease((u - 0.35) / 0.1);
  if (u < 0.85) return 1;
  if (u < 0.95) return ease(1 - (u - 0.85) / 0.1);
  return 0;
}

function pose(idle: Motion, t: number, seed: number): Pose {
  'worklet';
  const s = (hz: number, off = 0) => Math.sin(TAU * (hz * t + off + seed));
  if (idle === 'walk') {
    // Seen from the front: feet lift in turn, the body rocks over the planted foot, arms swing.
    const w = s(WALK_HZ);
    const up = Math.max(0, w);
    const down = Math.max(0, -w);
    return {
      angle: 0.035 * w, pivot: { x: 30, y: 57 }, bob: -0.8 * Math.abs(w), tilt: -0.04 * w,
      armL: { a: 0.2 + 0.22 * down, f: 0.25 + 0.5 * down },
      armR: { a: 0.2 + 0.22 * up, f: 0.25 + 0.5 * up },
      legL: 0.07 + 0.05 * up, legR: 0.07 + 0.05 * down, liftL: 3 * up, liftR: 3 * down,
      eyes: blink(t, seed), mouth: { w: 4.2, curve: 2.2 },
    };
  }
  if (idle === 'archery') {
    // Bow out to the left: draw the string back to the shoulder, aim, loose, reload.
    const u = ((t + seed * 2.4) % 2.4) / 2.4;
    const ease = (v: number) => v * v * (3 - 2 * v);
    // After the shot the drawing hand eases back to its starting spot.
    const pull = u < 0.35 ? ease(u / 0.35) : u < 0.6 ? 1 : u < 0.9 ? 1 - ease((u - 0.6) / 0.3) : 0;
    const flick = u >= 0.6 && u < 0.75 ? Math.sin((Math.PI * (u - 0.6)) / 0.15) : 0;
    // A faint tremble in the bow arm while aiming. Not on the head: shaking its tilt made long
    // hair (which turns with the head) twitch.
    const shake = u >= 0.35 && u < 0.6 ? 0.012 * Math.sin(t * 22) : 0;
    return {
      angle: 0, bob: 0, tilt: -0.08,
      armL: { a: 1.52 + shake, f: 1.55 + shake },
      armR: { a: mix(0.6, 1.6, pull) + 0.35 * flick, f: mix(-1.4, -1.6, pull) - 0.3 * flick },
      legL: 0.18, legR: 0.18, eyes: pull > 0.5 ? 0.45 : blink(t, seed), mouth: { w: 3.6, curve: pull > 0.5 ? 0.6 : 2 },
      bow: {
        drawn: u < 0.6 ? 1 : 0,
        fly: u < 0.6 ? 0 : ((u - 0.6) / 0.4) * 110,
        arrowO: u < 0.6 ? clamp01(u / 0.08) : 1 - clamp01((u - 0.75) / 0.1),
      },
    };
  }
  if (idle === 'guitar') {
    // Strumming across the body, nodding along, a note drifting up now and then. Both arms sit
    // behind the guitar; the strumming forearm and hand are drawn again in front of it.
    const strum = Math.sin(TAU * 2.2 * (t + seed));
    return {
      angle: 0, bob: 0.5 * Math.abs(s(1.1)), tilt: 0.08 * s(0.55),
      armL: { a: 1.0, f: 1.4 + 0.05 * s(0.55) },
      armR: { a: 0.35, f: -0.9 + 0.3 * strum },
      legL: 0.1, legR: 0.1, eyes: blink(t, seed), mouth: { w: 4.2, curve: 2.2 },
      guitar: ((t + seed) * 0.55) % 1,
    };
  }
  if (idle === 'jumprope') {
    // The rope swings over the head and under the feet; a hop as it passes underneath.
    const phi = TAU * 1.3 * (t + seed);
    const under = Math.max(0, Math.cos(phi));
    const hop = under * under;
    const turn = 0.12 * Math.sin(phi);
    return {
      angle: 0, bob: -3.6 * hop, tilt: 0, shadow: 1 - 0.3 * hop,
      armL: { a: 0.55 + turn, f: 0.25 + turn }, armR: { a: 0.55 - turn, f: 0.25 - turn },
      legL: 0.05, legR: 0.05, kneeL: 0.4 * hop, kneeR: 0.4 * hop,
      eyes: blink(t, seed), mouth: { w: 4.4, curve: 2.4 }, rope: phi,
    };
  }
  if (idle === 'yoga') {
    // Tree pose: one foot on the other leg, palms together in front of the chest, eyes closed,
    // a slow sway to keep balance.
    const breathe = s(0.2);
    return {
      angle: 0.03 * s(0.27), pivot: { x: 27.5, y: 57 }, bob: 0.2 * breathe, tilt: 0.02 * breathe, armsFront: true,
      armL: { a: 0.5 + 0.02 * breathe, f: -1.2 }, armR: { a: 0.5 + 0.02 * breathe, f: -1.2 },
      legL: 0.04, legR: 1.3, kneeR: -2.5, eyes: 0.12, mouth: { w: 3.2, curve: 1.4 },
    };
  }
  if (idle === 'run') {
    // Running on the spot: quick high steps, bent arms pumping, a bounce on every stride.
    const w = s(1.8);
    const up = Math.max(0, w);
    const down = Math.max(0, -w);
    return {
      angle: 0.03 * w, pivot: { x: 30, y: 57 }, bob: -1.4 * Math.abs(w), tilt: -0.05 * w,
      armL: { a: 0.3 + 0.35 * down, f: -1 + 0.6 * down }, armR: { a: 0.3 + 0.35 * up, f: -1 + 0.6 * up },
      legL: 0.06 + 0.08 * up, legR: 0.06 + 0.08 * down, liftL: 5 * up, liftR: 5 * down,
      eyes: blink(t, seed), mouth: { w: 4.6, curve: 2.4 },
    };
  }
  if (idle === 'skate') {
    // Riding a skateboard: arms out for balance, a gentle carve, and an ollie every few seconds.
    const u = ((t + seed * 3) % 3) / 3;
    const k = u > 0.72 ? (u - 0.72) / 0.28 : -1;
    const air = k >= 0 ? Math.sin(Math.PI * k) : 0;
    const pop = k >= 0 ? Math.sin(TAU * k) : 0;
    return {
      angle: 0.04 * s(0.33), pivot: { x: 30, y: 57 }, bob: -4.8 - 8 * air, tilt: -0.04 * s(0.33),
      armL: { a: 1.05 + 0.15 * s(0.5) + 0.4 * air, f: 1.3 + 0.3 * air },
      armR: { a: 1.05 - 0.15 * s(0.5) + 0.4 * air, f: 1.3 + 0.3 * air },
      legL: 0.16, legR: 0.16, shadow: 1.6 - 0.6 * air,
      eyes: blink(t, seed), mouth: { w: 4.8, curve: 2.6 }, board: { lift: 8 * air, deg: -16 * pop },
    };
  }
  if (idle === 'boxing') {
    // Bouncing in a guard, throwing a jab out to each side in turn.
    const u = ((t + seed) % 1.2) / 1.2;
    const jab = (v: number) => (v >= 0 && v < 0.2 ? Math.sin((Math.PI * v) / 0.2) : 0);
    const pl = jab(u);
    const pr = jab(u - 0.5);
    return {
      angle: 0, bob: -0.8 * Math.abs(s(1.7)), tilt: 0.06 * (pr - pl), armsFront: true,
      armL: { a: mix(0.35, 1.5, pl), f: mix(-2.3, 1.55, pl) }, armR: { a: mix(0.35, 1.5, pr), f: mix(-2.3, 1.55, pr) },
      legL: 0.2, legR: 0.2, eyes: blink(t, seed), mouth: { w: 3.8, curve: 1.2 },
    };
  }
  if (idle === 'tennis') {
    // A serve: toss with the left hand, racket cocked behind the head, swing through, hit.
    const u = ((t + seed * 2.6) % 2.6) / 2.6;
    const ease = (v: number) => v * v * (3 - 2 * v);
    // The racket arm and body at any point in the serve, so the ball can be aimed at the racket.
    const serve = (v: number) => {
      const cock = v < 0.45 ? ease(v / 0.45) : 1;
      const swing = ease(clamp01((v - 0.48) / 0.12));
      const back = ease(clamp01((v - 0.7) / 0.3));
      return {
        swing,
        back,
        bob: -1.2 * Math.sin(Math.PI * swing) * (1 - back),
        a: mix(mix(mix(0.4, 2.5, cock), 0.9, swing), 0.4, back),
        f: mix(mix(mix(0.6, Math.PI + 1, cock), 1.1, swing), 0.6, back),
      };
    };
    const now = serve(u);
    // Contact near the top of the swing: the ball meets the middle of the racket head.
    const HIT = 0.52;
    const at = serve(HIT);
    const hitElbow = limb(SHOULDER_R, 1, at.a, UPPER);
    const hitHand = limb(hitElbow, 1, at.f, FORE);
    const hit = {
      x: hitHand.x + ((hitHand.x - hitElbow.x) / FORE) * 7.4,
      y: hitHand.y + ((hitHand.y - hitElbow.y) / FORE) * 7.4 + at.bob,
    };
    const tossAt = (v: number) => (v < 0.3 ? ease(v / 0.3) : v < 0.55 ? 1 : 1 - ease(clamp01((v - 0.55) / 0.3)));
    const tossHand = (k: number) => limb(limb(SHOULDER_L, -1, mix(0.3, 2.8, k), UPPER), -1, mix(0.3, 2.9, k), FORE);
    const toss = tossAt(u);
    const handL = tossHand(toss);
    // Released from the hand where it is at the moment of the toss.
    const released = tossHand(tossAt(0.12));
    const start = { x: released.x, y: released.y - 1.5 };
    let ball: Ball;
    if (u < 0.12) ball = { kind: 'tennis', x: handL.x, y: handL.y - 1.5, spin: 0 };
    else if (u < HIT) {
      // Tossed up from the left hand, peaking above the contact point, dropping onto the strings.
      const k = (u - 0.12) / (HIT - 0.12);
      ball = { kind: 'tennis', x: mix(start.x, hit.x, k), y: mix(start.y, hit.y, k) - 20 * Math.sin(Math.PI * k), spin: t * 3 };
    } else {
      const k = clamp01((u - HIT) / 0.25);
      ball = { kind: 'tennis', x: mix(hit.x, 96, k), y: mix(hit.y, hit.y + 26, k), spin: t * 9, opacity: 1 - clamp01((k - 0.7) / 0.3) };
    }
    return {
      angle: 0, bob: now.bob, tilt: -0.1 * toss + 0.08 * now.swing * (1 - now.back),
      armL: { a: mix(0.3, 2.8, toss), f: mix(0.3, 2.9, toss) },
      armR: { a: now.a, f: now.f },
      legL: 0.14, legR: 0.14, eyes: blink(t, seed), mouth: { w: 4, curve: 1.8 }, ball, racket: true,
    };
  }
  if (idle === 'meditate') {
    // Floating cross-legged, hands on the knees, eyes closed, in a softly pulsing glow.
    const fl = s(0.25);
    return {
      angle: 0, bob: -5 + 1.2 * fl, tilt: 0.02 * s(0.2), shadow: 0.55 - 0.1 * fl,
      armL: { a: 0.62, f: 0.05 }, armR: { a: 0.62, f: 0.05 },
      legL: 1.35, legR: 1.35, kneeL: 2.7, kneeR: -2.7,
      eyes: 0.1, mouth: { w: 3.4, curve: 1.4 }, aura: (fl + 1) / 2,
    };
  }
  if (idle === 'webswing') {
    // Aim up, shoot a web to a point high above, jump and swing back and forth on it, land back
    // on the same spot, and let the web go.
    const u = ((t + seed * 4.2) % 4.2) / 4.2;
    const ease = (v: number) => v * v * (3 - 2 * v);
    const raise = ease(clamp01(u / 0.14)) * (1 - ease(clamp01((u - 0.9) / 0.1)));
    // A quick wrist flick as it fires.
    const flick = u > 0.14 && u < 0.22 ? Math.sin((Math.PI * (u - 0.14)) / 0.08) : 0;
    const reach = ease(clamp01((u - 0.15) / 0.1));
    // The swing: off the ground, the arc grows and dies away so it starts and lands at rest.
    const k = clamp01((u - 0.28) / 0.56);
    const lift = ease(clamp01(k / 0.12)) * (1 - ease(clamp01((k - 0.88) / 0.12)));
    const sw = Math.sin(TAU * 1.5 * k) * Math.sin(Math.PI * k);
    return {
      angle: 0.32 * sw, pivot: WEB_PIVOT, bob: -6 * lift, tilt: -0.15 * sw, shadow: 1 - 0.5 * lift,
      armL: { a: mix(0.3, 1.2 + 0.2 * sw, lift), f: mix(0.4, 1.6, lift) },
      armR: { a: mix(0.35, 2.75, raise), f: mix(0.4, 2.95 - 0.5 * flick, raise) },
      legL: mix(0.08, 0.25, lift), legR: mix(0.08, 0.1, lift), kneeL: 1.2 * lift, kneeR: 0.6 * lift,
      eyes: blink(t, seed), mouth: { w: 4.8, curve: 2.6 },
      web: { reach, o: 1 - clamp01((u - 0.86) / 0.06) },
    };
  }
  if (idle === 'cardthrow') {
    // Spring cards from the left hand to the right in an arc, charge one until it glows, flick it
    // out to the right, and it bursts at the edge.
    const u = ((t + seed * 2.4) % 2.4) / 2.4;
    const ease = (v: number) => v * v * (3 - 2 * v);
    // Hands spread wide while the cards spring across, then come in to charge, then the throw.
    const spread = u < 0.06 ? ease(u / 0.06) : u < 0.3 ? 1 : 1 - ease(clamp01((u - 0.3) / 0.1));
    const wind = u < 0.3 ? 0 : u < 0.42 ? ease((u - 0.3) / 0.12) : u < 0.52 ? 1 : 0;
    const thr = u < 0.42 ? 0 : u < 0.52 ? ease((u - 0.42) / 0.1) : 1 - ease(clamp01((u - 0.62) / 0.3));
    const fly = clamp01((u - 0.52) / 0.28);
    const burst = clamp01((u - 0.8) / 0.15);
    return {
      angle: 0, bob: 0, tilt: 0.06 * thr - 0.05 * wind,
      armL: { a: mix(0.45, 0.9, spread), f: mix(-1.3, 1, spread) },
      armR: {
        a: mix(mix(mix(0.35, 0.9, spread), 0.2, wind), 1.55, thr),
        f: mix(mix(mix(0.5, 1, spread), -1.9, wind), 1.6, thr),
      },
      legL: 0.18, legR: 0.18, eyes: blink(t, seed), mouth: { w: 4.2, curve: 1.6 },
      card: {
        // 0 → 1 while the cards stream across (before the throw); -1 otherwise.
        spring: u >= 0.05 && u < 0.3 ? (u - 0.05) / 0.25 : -1,
        held: u < 0.52,
        charge: u < 0.52 ? wind : 1,
        x: mix(46.8, 84, fly), y: mix(35, 30, fly), deg: fly * 900,
        o: u < 0.8 ? 1 : 0,
        burstR: 1 + 7 * burst, burstO: u >= 0.8 && u < 0.95 ? 1 - burst : 0,
      },
    };
  }
  if (idle === 'hero') {
    // Hands on hips, chest out, cape flying behind.
    const br = s(0.3);
    return {
      angle: 0, bob: 0.3 * br, tilt: 0.05 + 0.02 * s(0.25),
      armL: { a: 0.75, f: -0.9 }, armR: { a: 0.75, f: -0.9 },
      legL: 0.22, legR: 0.22, eyes: blink(t, seed), mouth: { w: 4.6, curve: 2.2 }, cape: t + seed * 5,
    };
  }
  if (idle === 'construct') {
    // Raise the ring hand; a solid green hammer rises out of the ground into it, slams down, sends
    // out a shockwave, and fades.
    const u = ((t + seed * 2.4) % 2.4) / 2.4;
    const ease = (v: number) => v * v * (3 - 2 * v);
    const raise = ease(clamp01(u / 0.2)) * (1 - ease(clamp01((u - 0.85) / 0.15)));
    const form = u >= 0.12 ? 1 : 0;
    // 1 while still underground, 0 once it's up in the hand.
    const rise = 1 - ease(clamp01((u - 0.12) / 0.26));
    const slam = ease(clamp01((u - 0.42) / 0.1));
    const fade = clamp01((u - 0.72) / 0.18);
    const ripple = clamp01((u - 0.52) / 0.3);
    return {
      angle: 0, bob: 0.8 * slam * (1 - fade), tilt: 0.08 * slam * (1 - fade),
      armL: { a: 0.3, f: 0.4 },
      armR: { a: mix(0.3, 1.5 - 0.25 * slam, raise), f: mix(0.4, 1.55 - 0.2 * slam, raise) },
      legL: 0.2, legR: 0.2, eyes: blink(t, seed), mouth: { w: 4.4, curve: 1.8 },
      construct: {
        deg: mix(-90, 48, slam), o: form * (1 - fade), rise,
        rippleR: 2 + 14 * ripple, rippleO: u >= 0.52 && u < 0.82 ? 1 - ripple : 0,
      },
    };
  }
  if (idle === 'flight') {
    // Hovering off the ground, one fist up, ready to take off, cape streaming below.
    const h = s(0.5);
    return {
      angle: 0, bob: -8 + 1.6 * h, tilt: 0.04 * s(0.3), shadow: 0.45 + 0.08 * h,
      armL: { a: 0.35, f: 0.3 }, armR: { a: 2.9, f: 3.05 },
      legL: 0.03, legR: 0.08, liftR: 1.5, eyes: blink(t, seed), mouth: { w: 4.6, curve: 2.4 }, cape: t * 1.6 + seed * 5,
    };
  }
  if (idle === 'shield') {
    // Wind up, hurl a round shield out to the right; it curves back and is caught.
    const u = ((t + seed * 2.4) % 2.4) / 2.4;
    const ease = (v: number) => v * v * (3 - 2 * v);
    const wind = u < 0.25 ? ease(u / 0.25) : u < 0.36 ? 1 : 0;
    const thr = u < 0.25 ? 0 : u < 0.36 ? ease((u - 0.25) / 0.11) : u < 0.78 ? 1 : 1 - ease(clamp01((u - 0.78) / 0.12));
    const k = clamp01((u - 0.34) / 0.46);
    // Out and back along an arc that rises in the middle; caught where it left the hand.
    const out = Math.sin(Math.PI * k);
    return {
      angle: 0, bob: 0, tilt: 0.06 * thr - 0.05 * wind,
      armL: { a: 0.3, f: 0.4 },
      armR: { a: mix(mix(0.35, 0.25, wind), 1.5, thr), f: mix(mix(0.5, -1.9, wind), 1.55, thr) },
      legL: 0.2, legR: 0.2, eyes: blink(t, seed), mouth: { w: 4.4, curve: 2 },
      shield: { held: u < 0.34 || u > 0.8, x: mix(47, 84, out), y: 34 - 9 * out, spin: t * 18 },
    };
  }
  if (idle === 'thunder') {
    // Raise a hammer to the sky; lightning strikes it in a few flickering flashes; lower it.
    const u = ((t + seed * 2.6) % 2.6) / 2.6;
    const ease = (v: number) => v * v * (3 - 2 * v);
    const raise = ease(clamp01(u / 0.25)) * (1 - ease(clamp01((u - 0.8) / 0.2)));
    const strike = u > 0.35 && u < 0.6 ? Math.floor(t * 18) % 3 !== 0 : false;
    return {
      angle: 0, bob: strike ? 0.4 : 0, tilt: -0.05 * raise,
      armL: { a: 0.45 + 0.2 * raise, f: 0.5 + 0.2 * raise }, armR: { a: mix(0.35, 2.85, raise), f: mix(0.4, 3.1, raise) },
      legL: 0.22, legR: 0.22, eyes: strike ? 0.6 : blink(t, seed), mouth: { w: 4.8, curve: strike ? 3 : 2 },
      thunder: { bolt: strike ? 1 : 0, seed: Math.floor(t * 18) },
    };
  }
  if (idle === 'weights') {
    // Alternating dumbbell curls: each forearm comes up to the shoulder in turn; a little effort
    // squint at the top of every rep.
    const u = ((t + seed * 2.4) % 2.4) / 2.4;
    const rep = (v: number) => (v >= 0 && v < 0.5 ? Math.sin((Math.PI * v) / 0.5) : 0);
    const cl = rep(u);
    const cr = rep(u - 0.5);
    const effort = Math.max(cl, cr);
    return {
      angle: 0, bob: 0.4 * effort, tilt: 0.04 * (cr - cl),
      armL: { a: 0.15, f: mix(0.15, Math.PI - 0.1, cl) }, armR: { a: 0.15, f: mix(0.15, Math.PI - 0.1, cr) },
      legL: 0.2, legR: 0.2, eyes: effort > 0.8 ? 0.45 : blink(t, seed), mouth: { w: 3.8, curve: effort > 0.8 ? 0.4 : 1.6 },
    };
  }
  if (idle === 'speedster') {
    // Running so fast it's a blur: quick strides, a forward lean, lightning crackling around.
    const w = s(3.4);
    const up = Math.max(0, w);
    const down = Math.max(0, -w);
    return {
      angle: 0.03 * w, pivot: { x: 30, y: 57 }, bob: -1.6 * Math.abs(w), tilt: -0.06 * w,
      armL: { a: 0.35 + 0.5 * down, f: -1.1 + 0.8 * down }, armR: { a: 0.35 + 0.5 * up, f: -1.1 + 0.8 * up },
      legL: 0.06 + 0.1 * up, legR: 0.06 + 0.1 * down, liftL: 6 * up, liftR: 6 * down,
      eyes: blink(t, seed), mouth: { w: 4.8, curve: 2.6 }, sparks: Math.floor(t * 12),
    };
  }
  if (idle === 'cheer') {
    // Jumping for joy: arms thrown up, pumping, a hop every beat.
    const u = ((t + seed * CHEER_HOP) % CHEER_HOP) / CHEER_HOP;
    const air = u < 0.55 ? Math.sin((Math.PI * u) / 0.55) : 0;
    const crouch = u >= 0.55 ? Math.sin((Math.PI * (u - 0.55)) / 0.45) : 0;
    const pump = 0.18 * Math.sin(TAU * u);
    return {
      angle: 0, bob: -6 * air + crouch, tilt: 0.08 * s(0.7), shadow: 1 - 0.4 * air,
      armL: { a: 2.55 + pump, f: 2.85 + pump }, armR: { a: 2.55 - pump, f: 2.85 - pump },
      legL: 0.08 + 0.12 * crouch, legR: 0.08 + 0.12 * crouch, kneeL: 0.8 * air, kneeR: 0.8 * air,
      eyes: blink(t, seed), mouth: { w: 5.6, curve: 2.8, open: 1 },
    };
  }
  if (idle === 'sad') {
    // Slumped and sniffling: head hangs, arms dangle, a tear rolls down now and then.
    const sigh = s(0.22);
    return {
      angle: 0, bob: 0.3 + 0.2 * sigh, tilt: 0.1 + 0.03 * s(0.15), headDrop: 1.4 + 0.3 * sigh,
      armL: { a: 0.06, f: 0.02 }, armR: { a: 0.06, f: 0.02 },
      legL: 0.05, legR: 0.05, eyes: 0.55 * blink(t, seed), mouth: { w: 3.6, curve: -1.4 },
      tear: ((t + seed * 2.6) % 2.6) / 2.6,
    };
  }
  if (idle === 'wave') {
    const w = s(1.6);
    return {
      angle: 0, bob: 0.3 * s(0.6), tilt: 0.12 + 0.04 * s(0.6),
      armL: { a: 0.18, f: 0.18 },
      armR: { a: 2.2, f: Math.PI - 0.55 + 0.4 * w },
      legL: 0.07, legR: 0.07, eyes: blink(t, seed), mouth: { w: 4.8, curve: 2.6 },
    };
  }
  if (idle === 'dance') {
    const p1 = (s(1.2) + 1) / 2;
    const p2 = 1 - p1;
    return {
      angle: 0.13 * s(0.6), pivot: { x: 30, y: 57 }, bob: -0.9 * Math.abs(s(1.2)), tilt: -0.1 * s(0.6),
      armL: { a: 0.5 + 1.6 * p1, f: 0.5 + 1.6 * p1 + 0.9 },
      armR: { a: 0.5 + 1.6 * p2, f: 0.5 + 1.6 * p2 + 0.9 },
      legL: 0.08 + 0.2 * p1, legR: 0.08 + 0.2 * p2, eyes: blink(t, seed), mouth: { w: 5, curve: 3 },
    };
  }
  if (idle === 'jump') {
    const u = ((t + seed * 1.1) % 1.1) / 1.1;
    const air = u < 0.45 ? Math.sin((Math.PI * u) / 0.45) : 0;
    const crouch = u >= 0.45 ? Math.sin((Math.PI * (u - 0.45)) / 0.55) : 0;
    return {
      angle: 0, bob: -9 * air + 1.2 * crouch, tilt: 0, shadow: 1 - 0.45 * air,
      armL: { a: 0.35 + 2.2 * air, f: 0.35 + 2.4 * air },
      armR: { a: 0.35 + 2.2 * air, f: 0.35 + 2.4 * air },
      legL: 0.06 + 0.18 * crouch, legR: 0.06 + 0.18 * crouch, eyes: blink(t, seed), mouth: { w: 5, curve: 2.8 },
    };
  }
  if (idle === 'sleep') {
    const breathe = s(0.25);
    return {
      angle: -1.45, lie: true, bob: 0.3 * breathe, tilt: -0.12,
      armL: { a: 1.13, f: Math.PI + 0.36 },
      armR: { a: 0.3 + 0.03 * breathe, f: 0.35 },
      legL: 0.05, legR: 0.14, eyes: 0.08, mouth: { w: 2, curve: 0.5 },
      zzz: (t * 0.45 + seed) % 1,
    };
  }
  if (idle === 'soccer') {
    // A ball drops onto the foot, two keepy-uppies, then a big kick.
    const T = 0.9;
    const ct = (t + seed * 3.6) % (4 * T);
    const beat = Math.floor(ct / T);
    const u = (ct % T) / T;
    const touch = u < 0.12 ? 1 - u / 0.12 : u > 0.88 ? (u - 0.88) / 0.12 : 0;
    let legR = 0.25 + 0.25 * touch;
    let liftR = 3.5 * touch;
    let ball: Ball;
    if (beat === 0) {
      ball = { kind: 'soccer', x: 37, y: -6 + 55.6 * u * u, spin: t * 3, opacity: clamp01(u * 4) };
    } else if (beat === 3) {
      const swing = Math.sin(Math.PI * clamp01(u / 0.45));
      legR = mix(0.5, 1.35, swing);
      liftR = 3.5 * (1 - clamp01(u / 0.12)) + 4 * swing;
      const k = clamp01(u / 0.45);
      ball = {
        kind: 'soccer', x: mix(37, 92, k), y: mix(49.6, 26, k) - 10 * Math.sin(Math.PI * k),
        spin: t * 14, opacity: 1 - clamp01((k - 0.6) / 0.4),
      };
    } else {
      ball = { kind: 'soccer', x: 37, y: 49.6 - 13 * 4 * u * (1 - u), spin: t * 6 };
    }
    return {
      angle: 0, bob: 0.3 * touch, tilt: 0.08,
      armL: { a: 0.55, f: 0.75 }, armR: { a: 0.55, f: 0.75 },
      legL: 0.06, legR, liftR, eyes: blink(t, seed), mouth: { w: 4.4, curve: 2.2 }, ball,
    };
  }
  if (idle === 'basket') {
    // Four dribbles, then a jump shot.
    const cyc = (t + seed * 3.6) % 3.6;
    if (cyc < 2.2) {
      const v = Math.abs(Math.sin((Math.PI * cyc) / 0.55));
      return {
        angle: 0, bob: 0.4 * (1 - v), tilt: 0.06,
        armL: { a: 0.2, f: 0.25 }, armR: { a: 0.42, f: 0.95 - 0.35 * v },
        legL: 0.12, legR: 0.12, eyes: blink(t, seed), mouth: { w: 4.4, curve: 2.2 },
        ball: { kind: 'basket', x: 42, y: 54.5 - 10.3 * v, spin: t * 4, opacity: clamp01(cyc / 0.3) },
      };
    }
    const u = (cyc - 2.2) / 1.4;
    const gather = clamp01(u / 0.2);
    const lift = clamp01((u - 0.2) / 0.2);
    const air = u > 0.25 && u < 0.75 ? Math.sin((Math.PI * (u - 0.25)) / 0.5) : 0;
    const release = clamp01((u - 0.45) / 0.35);
    const land = clamp01((u - 0.78) / 0.2);
    // 0 at both ends of the shot, so it blends out of and back into the dribble without a snap.
    const settle = gather * (1 - land);
    let ball: Ball;
    if (u < 0.45) {
      // Scooped up from the floor, where the last dribble left it.
      const cx = mix(42, 30, gather);
      const cy = mix(54.5, 36, gather);
      ball = { kind: 'basket', x: cx, y: mix(cy, 12, lift) - 6 * air, spin: t * 2 };
    } else {
      ball = {
        kind: 'basket', x: mix(30, 86, release), y: mix(6, 20, release) - 18 * Math.sin(Math.PI * release),
        spin: t * 5, opacity: 1 - clamp01((release - 0.7) / 0.3),
      };
    }
    const up = lift * (1 - land);
    return {
      angle: 0, bob: -6 * air + 0.4 * (1 - settle) + 1.2 * (1 - clamp01(u / 0.1)) * gather, tilt: 0.06 * (1 - settle),
      armsFront: up > 0.3,
      armL: { a: mix(mix(0.2, 0.28, settle), 2.85, up), f: mix(mix(0.25, -1.1, settle), Math.PI + 0.3 - 0.4 * release, up) },
      armR: { a: mix(mix(0.42, 0.28, settle), 2.85, up), f: mix(mix(0.95, -1.1, settle), Math.PI + 0.3 - 0.4 * release, up) },
      legL: mix(0.12, 0.1, settle), legR: mix(0.12, 0.1, settle), kneeL: 1.6 * air, kneeR: 1.6 * air,
      eyes: blink(t, seed), mouth: { w: 4.4, curve: 2.4 }, ball,
    };
  }
  if (idle === 'vbset') {
    // A ball drops into the hands, two straight sets, then a set out to the side.
    const T = 1.1;
    const ct = (t + seed * 4.4) % (4 * T);
    const touch = Math.floor(ct / T);
    const u = (ct % T) / T;
    const push = u < 0.15 ? 1 - u / 0.15 : u > 0.85 ? (u - 0.85) / 0.15 : 0;
    const side = touch === 3 ? (u < 0.2 ? 1 - u / 0.2 : 0) : touch === 2 && u > 0.85 ? (u - 0.85) / 0.15 : 0;
    let ball: Ball;
    if (touch === 0) {
      ball = { kind: 'volley', x: 30, y: -6 + 22 * u * u, spin: t * 2.5, opacity: clamp01(u * 4) };
    } else if (touch === 3) {
      ball = {
        kind: 'volley', x: 30 + 46 * u, y: 16 - 16 * Math.sin(Math.PI * u) + 10 * u * u,
        spin: t * 4, opacity: 1 - clamp01((u - 0.6) / 0.4),
      };
    } else {
      ball = { kind: 'volley', x: 30, y: 16 + 0.9 * push - 13 * 4 * u * (1 - u), spin: t * 2.5 };
    }
    return {
      angle: 0, bob: 0.9 * push, tilt: 0.12 * side, armsFront: true,
      armL: { a: 2.85 + 0.3 * side, f: Math.PI + 0.3 - 0.35 * push + 0.25 * side },
      armR: { a: 2.85 - 0.3 * side, f: Math.PI + 0.3 - 0.35 * push - 0.25 * side },
      legL: 0.1, legR: 0.1, eyes: blink(t, seed), mouth: { w: 3.6, curve: 1.6 }, ball,
    };
  }
  if (idle === 'vbbump') {
    // Two bumps, then a super-high one that leaves the top of the frame.
    const cyc = (t + seed * 4.8) % 4.8;
    const big = cyc >= 2.4;
    const u = big ? (cyc - 2.4) / 2.4 : (cyc % 1.2) / 1.2;
    const edge = big ? 0.06 : 0.12;
    const hit = u < edge ? 1 - u / edge : u > 1 - edge ? (u - (1 - edge)) / edge : 0;
    // A contact belongs to the bump it launches: the end of the second small bump already hits
    // big, and the big one ends on a small hit, so the switch never snaps.
    const nextBig = !big && cyc >= 1.2;
    const power = u < 0.5 ? (big ? 1 : 0) : nextBig ? 1 : 0;
    return {
      angle: 0, bob: (1.5 + 1.2 * power) * hit, tilt: 0,
      armL: { a: -0.05 + (0.2 + 0.5 * power) * hit, f: -0.55 + 0.2 * power * hit },
      armR: { a: -0.05 + (0.2 + 0.5 * power) * hit, f: -0.55 + 0.2 * power * hit },
      legL: 0.16, legR: 0.16, kneeL: 0.5 * power * hit, kneeR: 0.5 * power * hit,
      eyes: blink(t, seed), mouth: { w: 3.8 + power, curve: 1.8 + 0.8 * power },
      ball: { kind: 'volley', x: 30, y: 38 + 1.5 * hit - (big ? 90 : 30) * 4 * u * (1 - u), spin: t * (big ? 6 : 3) },
    };
  }
  if (idle === 'vbspike') {
    // Ball drops in, jump with a wind-up, left arm whips through and follows the ball down-left.
    const u = ((t + seed * 1.6) % 1.6) / 1.6;
    const air = u > 0.2 && u < 0.7 ? Math.sin((Math.PI * (u - 0.2)) / 0.5) : 0;
    const cock = clamp01((u - 0.12) / 0.22);
    const swing = clamp01((u - 0.4) / 0.12);
    const follow = clamp01((u - 0.5) / 0.14);
    const relax = clamp01((u - 0.75) / 0.2);
    let ball: Ball;
    if (u < 0.22) ball = { kind: 'volley', x: 13, y: -4, spin: 0, opacity: 0 };
    else if (u < 0.49) {
      const k = (u - 0.22) / 0.27;
      ball = { kind: 'volley', x: mix(13, 21.4, k), y: mix(-2, 12.3, k), spin: -t * 3, opacity: clamp01(k * 4) };
    } else {
      const k = clamp01((u - 0.49) / 0.16);
      ball = { kind: 'volley', x: mix(21.4, -10, k), y: mix(12.3, 44, k), spin: -t * 9, opacity: 1 - k };
    }
    return {
      angle: 0, bob: -8 * air, tilt: -0.05 * air,
      armL: {
        a: mix(mix(mix(mix(0.3, 2.45, cock), 2.2, swing), 0.95, follow), 0.3, relax),
        f: mix(mix(mix(mix(0.3, Math.PI + 1.35, cock), Math.PI + 0.25, swing), 1.25, follow), 0.3, relax),
      },
      armR: { a: mix(0.25, 2.3, air), f: mix(0.3, Math.PI - 0.25, air) },
      legL: 0.07 + 0.1 * air, legR: 0.07 + 0.1 * air, kneeL: 1.9 * air, kneeR: 1.7 * air,
      eyes: blink(t, seed), mouth: { w: 4.6, curve: 2.6 }, ball,
    };
  }
  if (idle === 'knit') {
    return {
      angle: 0, bob: 0.2 * s(0.4), tilt: 0.05 + 0.03 * s(0.3),
      armL: { a: 0.28, f: -1.25 + 0.12 * s(1.6) }, armR: { a: 0.28, f: -1.25 + 0.12 * s(1.6, 0.5) },
      legL: 0.07, legR: 0.07, eyes: blink(t, seed), mouth: { w: 3.4, curve: 1.6 }, knit: true,
    };
  }
  if (idle === 'flex') {
    const p = (s(0.9) + 1) / 2;
    return {
      angle: 0, bob: -0.9 * p, tilt: 0.06 * s(0.45),
      armL: { a: 1.5 + 0.1 * p, f: Math.PI - 0.35 + 0.45 * p },
      armR: { a: 1.5 + 0.1 * p, f: Math.PI - 0.35 + 0.45 * p },
      legL: 0.2, legR: 0.2, eyes: blink(t, seed), mouth: { w: 5.4, curve: 2.8 }, bicep: p,
    };
  }
  if (idle === 'lounge') {
    const kick = (s(0.5) + 1) / 2;
    return {
      angle: -1.3, lie: true, bob: 0.25 * s(0.35), tilt: -0.3 + 0.04 * s(0.35),
      armL: { a: 1.13, f: Math.PI + 0.36 },
      armR: { a: 0.32 + 0.04 * s(0.35), f: 0.4 },
      legL: 0.04, legR: 0.12 + 0.32 * kick, eyes: blink(t, seed), mouth: { w: 4, curve: 1.8 },
    };
  }
  // smile
  const g = grin(t, seed);
  return {
    angle: 0, bob: 0.5 * s(0.6), tilt: 0.09 * s(0.3),
    armL: { a: 0.2 + 0.05 * s(0.6), f: 0.2 + 0.05 * s(0.6) },
    armR: { a: 0.2 + 0.05 * s(0.6, 0.5), f: 0.2 + 0.05 * s(0.6, 0.5) },
    legL: 0.07, legR: 0.07, eyes: blink(t, seed), mouth: { w: 4.6 + 0.8 * g, curve: 2.4, open: g },
  };
}

// ---------- Shapes as point commands, drawn through a point transform ----------
// ['M', x, y] ['L', x, y] ['Q', x1, y1, x, y] ['C', x1, y1, x2, y2, x, y]
// ['A', rx, ry, x, y] (half an ellipse over the top, from the current point across its width)
// ['O', cx, cy, r] (a circle) ['Z']
type Cmd = (string | number)[];

function shapePath(cmds: Cmd[], T: (x: number, y: number) => Pt): string {
  'worklet';
  let d = '';
  // The current point before transforming, for arcs.
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < cmds.length; i++) {
    const c = cmds[i]!;
    const k = c[0] as string;
    if (k === 'M' || k === 'L') {
      const p = T(c[1] as number, c[2] as number);
      d += k + f(p.x) + ' ' + f(p.y);
      cx = c[1] as number;
      cy = c[2] as number;
    } else if (k === 'Q') {
      const a = T(c[1] as number, c[2] as number);
      const b = T(c[3] as number, c[4] as number);
      d += 'Q' + f(a.x) + ' ' + f(a.y) + ' ' + f(b.x) + ' ' + f(b.y);
      cx = c[3] as number;
      cy = c[4] as number;
    } else if (k === 'C') {
      const a = T(c[1] as number, c[2] as number);
      const b = T(c[3] as number, c[4] as number);
      const e = T(c[5] as number, c[6] as number);
      d += 'C' + f(a.x) + ' ' + f(a.y) + ' ' + f(b.x) + ' ' + f(b.y) + ' ' + f(e.x) + ' ' + f(e.y);
      cx = c[5] as number;
      cy = c[6] as number;
    } else if (k === 'A') {
      // Half an ellipse as two quarter curves through T, so it stays locked to the head. An SVG arc
      // between the ends of its diameter is ill-conditioned: rounding moved its centre each frame
      // and the hair twitched against the head.
      const rx = c[1] as number;
      const ry = c[2] as number;
      const mx = (cx + (c[3] as number)) / 2;
      const K = 0.5523; // Quarter-circle Bézier handle length.
      const q = (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) => {
        const a = T(x1, y1);
        const b = T(x2, y2);
        const e = T(x3, y3);
        return 'C' + f(a.x) + ' ' + f(a.y) + ' ' + f(b.x) + ' ' + f(b.y) + ' ' + f(e.x) + ' ' + f(e.y);
      };
      d += q(mx - rx, cy - K * ry, mx - K * rx, cy - ry, mx, cy - ry);
      d += q(mx + K * rx, cy - ry, mx + rx, cy - K * ry, mx + rx, cy);
      cx = c[3] as number;
      cy = c[4] as number;
    } else if (k === 'O') {
      // Clockwise like the hair caps, so overlapping pieces fill instead of cancelling.
      const p = T(c[1] as number, c[2] as number);
      const r = c[3] as number;
      d += 'M' + f(p.x - r) + ' ' + f(p.y) + 'a' + r + ' ' + r + ' 0 1 1 ' + f(r * 2) + ' 0a' + r + ' ' + r + ' 0 1 1 ' + f(-r * 2) + ' 0';
    } else if (k === 'Z') {
      d += 'Z';
    }
  }
  return d;
}

function hairShape(style: HairStyle): Cmd[] {
  'worklet';
  const x = HEAD.x;
  const y = HEAD.y;
  const r = HEAD.r;
  const w = r + 0.9;
  const capH = r + 2.2;
  const cap: Cmd[] = [['M', x - w, y + 1], ['A', w, capH, x + w, y + 1]];
  const fringe: Cmd[] = [['Q', x + r - 2.2, y - 3.4, x + 3, y - 3.8], ['Q', x - 1.5, y - 2.6, x - w, y + 1], ['Z']];
  if (style === 'short') return cap.concat(fringe);
  if (style === 'buzz') {
    return [['M', x - r - 0.4, y - 0.5], ['A', r + 0.4, r + 0.9, x + r + 0.4, y - 0.5], ['Q', x + 1, y - 6.2, x - r - 0.4, y - 0.5], ['Z']];
  }
  // Swept to one side from a part on the right.
  if (style === 'sidepart') return cap.concat([['Q', x + r - 1.4, y - 4.6, x - 1, y - 5.6], ['Q', x - 5.5, y - 4.6, x - w, y + 1], ['Z']]);
  if (style === 'quiff') {
    return cap.concat(fringe, [['O', x - 1.6, y - r - 2.1, 3.3], ['O', x + 2, y - r - 2.8, 3.1], ['O', x + 4.6, y - r - 1.4, 2.4]]);
  }
  // Shaved sides, a crest down the middle.
  if (style === 'mohawk') {
    return [['O', x, y - r + 0.6, 2.4], ['O', x, y - r - 1.8, 2.6], ['O', x + 0.4, y - r - 4.3, 2.3], ['O', x + 0.8, y - r - 6.4, 1.6]];
  }
  // Short afro: a hairline in front; the round mass is drawn behind the head (hairBackShape).
  if (style === 'afro') return [['M', x - w, y - 1], ['A', w, capH - 0.4, x + w, y - 1], ['Q', x, y - 7.4, x - w, y - 1], ['Z']];
  if (style === 'long') {
    return cap.concat([
      ['L', x + w + 0.4, y + 11], ['Q', x + r, y + 12.4, x + r - 1.3, y + 10.6], ['L', x + r - 1.1, y + 1.5],
      ['Q', x + r - 2.6, y - 3.4, x + 3, y - 3.8], ['Q', x - 1.5, y - 2.6, x - r + 1.1, y + 1.5],
      ['L', x - r + 1.3, y + 10.6], ['Q', x - r, y + 12.4, x - w - 0.4, y + 11], ['Z'],
    ]);
  }
  if (style === 'bun') return cap.concat(fringe, [['O', x, y - capH - 1.2, 3.5]]);
  if (style === 'curly' || style === 'longcurly') {
    const out: Cmd[] = [['M', x - w, y - 1.5], ['A', w, capH - 0.8, x + w, y - 1.5], ['Q', x, y - 11, x - w, y - 1.5], ['Z']];
    for (let i = 0; i <= 12; i++) {
      const ang = Math.PI + (i / 12) * Math.PI;
      out.push(['O', x + Math.cos(ang) * (r + 0.5), y - 2.2 + Math.sin(ang) * (r + 1.3), 2.3]);
    }
    const fringeY = style === 'curly' ? y - 5.6 : y - 4.6;
    const dxs = [-5.2, -2.6, 0, 2.6, 5.2];
    for (let i = 0; i < dxs.length; i++) out.push(['O', x + dxs[i]!, fringeY + 0.06 * dxs[i]! * dxs[i]!, 2]);
    if (style === 'longcurly') {
      for (let sd = -1; sd <= 1; sd += 2) {
        for (let j = 0; j < 6; j++) out.push(['O', x + sd * (r + 0.4 + (j % 2) * 0.9), y + 1.2 + j * 2.4, 2.2]);
      }
    }
    return out;
  }
  // Short curly curtains: a low, close layer of curls over the top, parted in the middle, the
  // fringe curls sweeping out to each side and stopping level with the eyes.
  if (style === 'curtains') {
    const out: Cmd[] = [['M', x - w, y - 1.5], ['A', w, capH - 1.8, x + w, y - 1.5], ['Q', x, y - 11, x - w, y - 1.5], ['Z']];
    for (let i = 1; i <= 11; i++) {
      const ang = Math.PI + (i / 12) * Math.PI;
      out.push(['O', x + Math.cos(ang) * (r + 0.3), y - 2.4 + Math.sin(ang) * (r - 0.1), 1.9]);
    }
    const fringe = [[1.5, -6.6, 1.8], [3.4, -5.8, 1.9], [5.2, -4.6, 1.9], [6.5, -3.3, 1.7], [7.4, -1.4, 1.7]];
    for (let sd = -1; sd <= 1; sd += 2) {
      for (let i = 0; i < fringe.length; i++) out.push(['O', x + sd * fringe[i]![0]!, y + fringe[i]![1]!, fringe[i]![2]!]);
    }
    return out;
  }
  if (style === 'spiky') {
    const pts: Pt[] = [];
    for (let i = 0; i <= 10; i++) {
      const ang = Math.PI * 0.96 + (i / 10) * Math.PI * 1.08;
      const rr = i % 2 ? r + 4 : r + 0.9;
      pts.push({ x: x + Math.cos(ang) * rr, y: y - 0.8 + Math.sin(ang) * rr });
    }
    const out: Cmd[] = [['M', pts[0]!.x, pts[0]!.y]];
    for (let i = 1; i < pts.length; i++) out.push(['L', pts[i]!.x, pts[i]!.y]);
    out.push(['Q', x, y - 3.4, pts[0]!.x, pts[0]!.y], ['Z']);
    return out;
  }
  return [];
}

function hairBackShape(style: HairStyle): Cmd[] {
  'worklet';
  const x = HEAD.x;
  const y = HEAD.y;
  const r = HEAD.r;
  if (style === 'longcurly') {
    const back: Cmd[] = [];
    for (let row = 0; row < 4; row++) {
      for (let i = -3; i <= 3; i++) back.push(['O', x + i * 2.9 + (row % 2) * 1.45, y + 3 + row * 3.2, 2.5]);
    }
    return back;
  }
  if (style === 'afro') return [['O', x, y - 3.2, r + 4]];
  if (style === 'long') {
    return [['M', x - r - 2, y], ['A', r + 2, r + 3, x + r + 2, y], ['L', x + r + 2.6, y + 14],
      ['Q', x, y + 16.5, x - r - 2.6, y + 14], ['Z']];
  }
  return [];
}

function circlePath(c: Pt, r: number): string {
  'worklet';
  if (r <= 0) return '';
  return 'M' + f(c.x - r) + ' ' + f(c.y) + 'a' + f(r) + ' ' + f(r) + ' 0 1 1 ' + f(r * 2) + ' 0a' + f(r) + ' ' + f(r) + ' 0 1 1 ' + f(-r * 2) + ' 0';
}

/** An ellipse as a path, rotated by angleDeg: for eyes that turn with the head. */
function ellipsePath(c: Pt, rx: number, ry: number, angleDeg: number): string {
  'worklet';
  const a = (angleDeg * Math.PI) / 180;
  const dx = Math.cos(a) * rx;
  const dy = Math.sin(a) * rx;
  const r2 = Math.max(0.05, ry);
  const p1 = f(c.x - dx) + ' ' + f(c.y - dy);
  const p2 = f(c.x + dx) + ' ' + f(c.y + dy);
  return 'M' + p1 + 'A' + rx + ' ' + f(r2) + ' ' + f(angleDeg) + ' 1 0 ' + p2 + 'A' + rx + ' ' + f(r2) + ' ' + f(angleDeg) + ' 1 0 ' + p1 + 'Z';
}

function ballSeams(kind: Ball['kind'], b: Ball, r: number): string {
  'worklet';
  const P = (ux: number, uy: number) => {
    const q = rot({ x: ux, y: uy }, { x: 0, y: 0 }, b.spin);
    return f(b.x + q.x * r) + ' ' + f(b.y + q.y * r);
  };
  if (kind === 'soccer') {
    let d = '';
    const pent: Pt[] = [];
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * TAU) / 5;
      pent.push({ x: 0.42 * Math.cos(a), y: 0.42 * Math.sin(a) });
    }
    d += 'M' + P(pent[0]!.x, pent[0]!.y);
    for (let i = 1; i < 5; i++) d += 'L' + P(pent[i]!.x, pent[i]!.y);
    d += 'Z';
    for (let i = 0; i < 5; i++) d += 'M' + P(pent[i]!.x, pent[i]!.y) + 'L' + P(pent[i]!.x * 2.2, pent[i]!.y * 2.2);
    return d;
  }
  if (kind === 'tennis') return 'M' + P(-0.95, -0.35) + 'Q' + P(0, 0.4) + ' ' + P(0.95, -0.35);
  if (kind === 'volley') {
    return 'M' + P(-0.95, -0.3) + 'Q' + P(0, 0.2) + ' ' + P(0.6, 0.8)
      + 'M' + P(-0.2, -0.98) + 'Q' + P(0.3, -0.1) + ' ' + P(0.98, -0.2)
      + 'M' + P(-0.7, 0.7) + 'Q' + P(-0.1, 0.1) + ' ' + P(-0.1, -0.95);
  }
  return 'M' + P(0, -1) + 'L' + P(0, 1) + 'M' + P(-1, 0) + 'L' + P(1, 0)
    + 'M' + P(-0.7, -0.72) + 'Q' + P(-0.25, 0) + ' ' + P(-0.7, 0.72)
    + 'M' + P(0.7, -0.72) + 'Q' + P(0.25, 0) + ' ' + P(0.7, 0.72);
}

/** Ball radius for an idle move's prop (0 when there is no ball). */
export function ballRadius(idle: Motion): number {
  return idle === 'basket' ? 4 : idle === 'tennis' ? 1.7 : idle === 'soccer' || idle.startsWith('vb') ? 3.8 : 0;
}

// Horse neck + head (rotates for the grazing nod), in the horse's own coordinates.
const HORSE_NECK_HEAD: Cmd[] = [
  ['M', -2.6, -15.8], ['C', -6, -18, -8.2, -23.4, -9.8, -25.2], ['C', -11.8, -25.4, -14.6, -23.2, -15.6, -21.2],
  ['Q', -15.8, -19.4, -13.6, -19.1], ['Q', -11.8, -19.2, -10.4, -19.8], ['C', -9.2, -18.8, -8.5, -16.4, -8.2, -13.6],
  ['L', -4.5, -12.2], ['Z'],
];
const HORSE_MANE: Cmd[] = [['M', -3, -16.6], ['C', -6.2, -18.8, -8, -23, -9.4, -24.9]];
const HORSE_FORELOCK: Cmd[] = [['M', -9.7, -25.3], ['Q', -11, -25.6, -11.6, -24.4]];
const HORSE_EAR: Cmd[] = [['M', -9.5, -24.9], ['L', -9.1, -27.5], ['L', -8.2, -24.7], ['Z']];

/**
 * Everything animated in a scene at time t. Keys are read by the scene's shapes; values are
 * path strings or numbers. `seed` offsets the animations so players aren't in lockstep.
 */
export function sceneFrame(look: RigLook, t: number, seed: number): Frame {
  'worklet';
  const P = pose(look.idle, t, seed);
  const F: Frame = {};
  // The chosen resting face, except in moves that have their own (eyes closed, crying, cheering).
  const idle = look.idle;
  const ownFace = idle === 'sleep' || idle === 'sad' || idle === 'yoga' || idle === 'meditate' || idle === 'cheer';
  const expr = ownFace ? 'happy' : look.expression;
  if (expr === 'grin') P.mouth = { w: P.mouth.w + 0.6, curve: P.mouth.curve, open: 1 };
  else if (expr === 'surprised') P.eyes *= 1.3;
  const pivot = P.pivot || HIP;
  const bodyRaw = (x: number, y: number) => rot({ x, y }, pivot, P.angle);

  // Arm joints first: lying poses need them to find the lowest point.
  const elbowL = limb(SHOULDER_L, -1, P.armL.a, UPPER);
  const handL = limb(elbowL, -1, P.armL.f, FORE);
  const elbowR = limb(SHOULDER_R, 1, P.armR.a, UPPER);
  const handR = limb(elbowR, 1, P.armR.f, FORE);

  let rest = 0;
  let restX = 0;
  if (P.lie) {
    // Rest the lowest point on the ground and centre the figure so nothing runs off the edge.
    const pts: number[][] = [
      [HEAD.x, HEAD.y, HEAD.r + 3], [30, 38, 5.5], [30, 57, 2.4], [HIP.x, HIP.y, 2],
      [elbowL.x, elbowL.y, 2], [handL.x, handL.y, 2], [elbowR.x, elbowR.y, 2], [handR.x, handR.y, 2],
    ];
    let low = -1e9;
    let minX = 1e9;
    let maxX = -1e9;
    for (let i = 0; i < pts.length; i++) {
      const q = bodyRaw(pts[i]![0]!, pts[i]![1]!);
      const m = pts[i]![2]!;
      low = Math.max(low, q.y + m);
      minX = Math.min(minX, q.x - m);
      maxX = Math.max(maxX, q.x + m);
    }
    rest = 59 - low;
    restX = 30 - (minX + maxX) / 2;
  }
  const B = (x: number, y: number): Pt => {
    const q = bodyRaw(x, y);
    return { x: q.x + restX, y: q.y + rest + P.bob };
  };
  const H = (x: number, y: number): Pt => {
    const q = rot({ x, y }, NECK, P.tilt);
    return B(q.x, q.y + (P.headDrop || 0));
  };
  const seg = (a: Pt, b: Pt, c?: Pt) =>
    'M' + f(a.x) + ' ' + f(a.y) + 'L' + f(b.x) + ' ' + f(b.y) + (c ? 'L' + f(c.x) + ' ' + f(c.y) : '');

  // Legs: thigh then shin; a knee fold swings both shins back the same way.
  const legs: [string, Pt, number, number][] = [
    ['L', HIP_L, -1, P.legL],
    ['R', HIP_R, 1, P.legR],
  ];
  // Same-colour parts share one shape (both legs, both shoes, ...): far fewer shapes to redraw.
  let legsD = '';
  let shoesD = '';
  // Shorts: the upper thighs, drawn in the bottoms colour over bare legs.
  let thighsD = '';
  for (let i = 0; i < 2; i++) {
    const side = legs[i]![0];
    const hip = legs[i]![1];
    const sg = legs[i]![2];
    const thighA = legs[i]![3];
    const knee = limb(hip, sg, thighA, LEG / 2);
    const fold = side === 'L' ? P.kneeL || 0 : P.kneeR || 0;
    const dir = rot({ x: sg * Math.sin(thighA), y: Math.cos(thighA) }, { x: 0, y: 0 }, -fold);
    const foot = { x: knee.x + dir.x * (LEG / 2), y: knee.y + dir.y * (LEG / 2) };
    foot.y -= (side === 'R' ? P.liftR : P.liftL) || 0;
    const b = B(foot.x, foot.y);
    legsD += seg(B(hip.x, hip.y), B(knee.x, knee.y), b);
    shoesD += circlePath({ x: b.x, y: b.y + 0.4 }, 2.3);
    thighsD += seg(B(hip.x, hip.y - 1), B(mix(hip.x, knee.x, 0.8), mix(hip.y, knee.y, 0.8)));
  }
  F.legs = legsD;
  F.shoes = shoesD;
  F.thighs = look.bottom === 'shorts' ? thighsD : 'M0 0';
  // Sitting cross-legged the skirt spreads over the lap toward the knees and ends at the legs
  // (drawn behind them), instead of hanging below them.
  F.skirt =
    look.bottom !== 'skirt'
      ? 'M0 0'
      : idle === 'meditate'
        ? shapePath([['M', 25.4, 41.5], ['L', 34.6, 41.5], ['L', 38.6, 46.4], ['Q', 30, 48.4, 21.4, 46.4], ['Z']], B)
        : shapePath([['M', 25.4, 41.5], ['L', 34.6, 41.5], ['L', 37.2, 50], ['Q', 30, 51.6, 22.8, 50], ['Z']], B);
  F.torso = seg(B(30, 35.5), B(30, 41));
  // Jersey stripe across the chest, jacket zip down the middle.
  F.stripe = look.top === 'jersey' ? seg(B(25.2, 37.6), B(34.8, 37.6)) : 'M0 0';
  F.zip = look.top === 'jacket' ? seg(B(30, 31.6), B(30, 46)) : 'M0 0';
  // Medal on the chest, its ribbon running up behind the head.
  const medal = B(30, 39.2);
  F.medalX = medal.x;
  F.medalY = medal.y;
  F.medalRibbonL = seg(B(26.4, 31.4), B(30, 37));
  F.medalRibbonR = seg(B(33.6, 31.4), B(30, 37));

  // Arms; the same shapes feed the behind-the-head set and the in-front set (only one shows).
  const arms: [string, Pt, number, Arm, Pt, Pt][] = [
    ['L', SHOULDER_L, -1, P.armL, elbowL, handL],
    ['R', SHOULDER_R, 1, P.armR, elbowR, handR],
  ]; // [side, shoulder, sign, angles, elbow, hand]
  const hands: Pt[] = [];
  let armsD = '';
  let sleevesD = '';
  let handsD = '';
  let bicepsD = '';
  for (let i = 0; i < 2; i++) {
    const sh = arms[i]![1];
    const sg = arms[i]![2];
    const arm = arms[i]![3];
    const elbow = arms[i]![4];
    const hand = arms[i]![5];
    const sleeveEnd = limb(sh, sg, arm.a, UPPER * 0.55);
    armsD += seg(B(sh.x, sh.y), B(elbow.x, elbow.y), B(hand.x, hand.y));
    sleevesD += seg(B(sh.x, sh.y), B(sleeveEnd.x, sleeveEnd.y));
    const h = B(hand.x, hand.y);
    hands.push(h);
    handsD += circlePath(h, 1.95);
    if (P.bicep !== undefined) {
      const mid = limb(sh, sg, arm.a, UPPER * 0.7);
      bicepsD += circlePath(B(mid.x, mid.y - 0.9 - 0.6 * P.bicep), 1.9 + 1.4 * P.bicep);
    }
  }
  F.arms = armsD;
  F.sleeves = sleevesD;
  F.hands = handsD;
  F.biceps = bicepsD || 'M0 0';
  F.armsBack = P.armsFront ? 0 : 1;
  F.armsFront = P.armsFront ? 1 : 0;
  F.handLX = hands[0]!.x;
  F.handLY = hands[0]!.y;
  F.handRX = hands[1]!.x;
  F.handRY = hands[1]!.y;
  // Right forearm direction, for things held in or worn on that hand (the ring, the hammer).
  const elbowRB = B(elbowR.x, elbowR.y);
  F.handRDeg = (Math.atan2(hands[1]!.y - elbowRB.y, hands[1]!.x - elbowRB.x) * 180) / Math.PI;
  // Watch on the left wrist, turned to lie across the forearm.
  const wrist = B(mix(elbowL.x, handL.x, 0.72), mix(elbowL.y, handL.y, 0.72));
  const elbowLB = B(elbowL.x, elbowL.y);
  F.watchX = wrist.x;
  F.watchY = wrist.y;
  F.watchDeg = (Math.atan2(hands[0]!.y - elbowLB.y, hands[0]!.x - elbowLB.x) * 180) / Math.PI;
  // Chest pattern centre and body angle; the parrot perches on the right shoulder.
  const chest = B(30, 37.8);
  F.chestX = chest.x;
  F.chestY = chest.y;
  F.bodyDeg = (P.angle * 180) / Math.PI;
  // On top of the right shoulder joint.
  const perch = B(35.9, 32.1);
  F.birdX = perch.x;
  F.birdY = perch.y;

  // Head, hood and face.
  const hc = H(HEAD.x, HEAD.y);
  F.head = circlePath(hc, HEAD.r);
  const hood = H(HEAD.x, HEAD.y + 0.8);
  F.hoodX = hood.x;
  F.hoodY = hood.y;
  const headDeg = ((P.angle + P.tilt) * 180) / Math.PI;
  // Features slide toward where they're looking, so a walker reads as turned that way.
  const fx = 1.6 * (look.facing || 0);
  const Fc = (x: number, y: number) => H(x + fx, y);
  // Wink: every few seconds the right eye squeezes shut and opens again; otherwise both blink.
  let eyeR = P.eyes;
  let wink = 0;
  if (expr === 'wink') {
    const u = ((t + seed * 3) % 3) / 3;
    const w = u > 0.7 && u < 0.9 ? Math.sin((Math.PI * (u - 0.7)) / 0.2) : 0;
    wink = Math.min(1, w * 1.6);
    eyeR = Math.min(P.eyes, 1 - 0.92 * wink);
  }
  F.eyes = ellipsePath(Fc(27, 23.6), 1.1, 1.25 * P.eyes, headDeg) + ellipsePath(Fc(33, 23.6), 1.1, 1.25 * eyeR, headDeg);
  // Face extras (glasses, beard, freckles, a surprised "o") are fixed shapes drawn in the head's
  // own frame: its centre, its angle, and how far the face has slid toward where it's looking.
  F.headX = hc.x;
  F.headY = hc.y;
  F.headDeg = headDeg;
  F.faceDx = fx;
  F.ohO = expr === 'surprised' ? 1 : 0;
  const cl = Fc(25.6, 26.3);
  const cr = Fc(34.4, 26.3);
  F.cheeks = circlePath(cl, 1.3) + circlePath(cr, 1.3);
  // Mouth: a smile line, or (when open) a white toothy grin.
  const m = P.mouth;
  const open = m.open || 0;
  // Mouth line height on the face.
  const my = 26.9;
  const m1 = Fc(30 - m.w / 2, my);
  // The winking side of the smile lifts.
  const m2 = Fc(30 + m.w / 2, my - 0.7 * wink);
  const lower = Fc(30, my + m.curve + open * 1.7);
  const upper = Fc(30, my + open * 0.2);
  const lowerD = 'M' + f(m1.x) + ' ' + f(m1.y) + 'Q' + f(lower.x) + ' ' + f(lower.y) + ' ' + f(m2.x) + ' ' + f(m2.y);
  F.mouth = lowerD;
  F.grin = lowerD + 'Q' + f(upper.x) + ' ' + f(upper.y) + ' ' + f(m1.x) + ' ' + f(m1.y) + 'Z';
  F.grinO = open > 0.05 && expr !== 'surprised' ? 1 : 0;
  F.mouthO = open > 0.05 || expr === 'surprised' ? 0 : 1;
  // Sad: brows slanting up toward the middle, and a tear that rolls down one cheek and fades.
  if (P.tear !== undefined) {
    F.brows = seg(Fc(25.4, 21.2), Fc(28.4, 19.9)) + seg(Fc(31.6, 19.9), Fc(34.6, 21.2));
    const q = clamp01(P.tear / 0.7);
    const tp = Fc(26.4, 25.2 + 5 * q * q);
    F.tear = circlePath(tp, 0.85) + 'M' + f(tp.x - 0.8) + ' ' + f(tp.y - 0.2) + 'L' + f(tp.x) + ' ' + f(tp.y - 1.9)
      + 'L' + f(tp.x + 0.8) + ' ' + f(tp.y - 0.2) + 'Z';
    F.tearO = P.tear < 0.7 ? Math.sin(Math.PI * q) : 0;
  } else {
    F.brows = 'M0 0';
    F.tear = 'M0 0';
    F.tearO = 0;
  }
  // Hair.
  F.hair = shapePath(hairShape(look.hair), H);
  F.hairBack = shapePath(hairBackShape(look.hair), H) || 'M0 0';
  if (!F.hair) F.hair = 'M0 0';

  // Ground shadow.
  const feetMid = B(30, 57);
  const sh = P.shadow === undefined ? 1 : P.shadow;
  F.shadowX = P.lie ? 30 : feetMid.x;
  F.shadowRx = (P.lie ? 19 : 9) * sh;
  F.shadowRy = 1.5 * sh;

  // Sleep: a "z" drifts up from the head and fades.
  if (P.zzz !== undefined) {
    const q = P.zzz;
    const zs = 3 + q * 2.6;
    const zx = hc.x + 6 + q * 8;
    const zy = hc.y - 12 - q * 12;
    F.zzz = 'M' + f(zx) + ' ' + f(zy) + 'L' + f(zx + zs) + ' ' + f(zy) + 'L' + f(zx) + ' ' + f(zy + zs) + 'L' + f(zx + zs) + ' ' + f(zy + zs);
    F.zzzO = Math.sin(Math.PI * q);
  } else {
    F.zzz = 'M0 0';
    F.zzzO = 0;
  }

  // Sports ball.
  if (P.ball) {
    const r = P.ball.kind === 'basket' ? 4 : P.ball.kind === 'tennis' ? 1.7 : 3.8;
    F.ballX = P.ball.x;
    F.ballY = P.ball.y;
    F.ballO = P.ball.opacity === undefined ? 1 : P.ball.opacity;
    F.ballSeams = ballSeams(P.ball.kind, P.ball, r);
  } else {
    F.ballX = 0;
    F.ballY = 0;
    F.ballO = 0;
    F.ballSeams = 'M0 0';
  }

  // Knitting: needles cross above the hands, a knitted piece below, thread to the yarn ball.
  if (P.knit) {
    const hl = hands[0]!;
    const hr = hands[1]!;
    const mx = (hl.x + hr.x) / 2;
    const my = (hl.y + hr.y) / 2;
    F.needles = 'M' + f(hl.x) + ' ' + f(hl.y) + 'L' + f(hl.x + 4.6) + ' ' + f(hl.y - 7)
      + 'M' + f(hr.x) + ' ' + f(hr.y) + 'L' + f(hr.x - 4.6) + ' ' + f(hr.y - 7);
    F.swatch = 'M' + f(mx - 2.6) + ' ' + f(my + 0.6) + 'L' + f(mx + 2.6) + ' ' + f(my + 0.6) + 'L' + f(mx + 2.2) + ' ' + f(my + 4.4)
      + 'Q' + f(mx) + ' ' + f(my + 5.2) + ' ' + f(mx - 2.2) + ' ' + f(my + 4.4) + 'Z';
    F.thread = 'M' + f(mx + 1.6) + ' ' + f(my + 4.6) + 'Q' + f(mx + 9) + ' ' + f(my + 14) + ' ' + f(YARN_BALL.x - 1) + ' ' + f(YARN_BALL.y - 2.2);
  } else {
    F.needles = 'M0 0';
    F.swatch = 'M0 0';
    F.thread = 'M0 0';
  }

  // The idle moves below set their keys only when they play; the scene draws them only then too.

  // Archery: the bow in the left hand, its string to the right hand while drawn, and the arrow.
  if (P.bow) {
    const hl = hands[0]!;
    const hr = hands[1]!;
    const top = { x: hl.x + 2.6, y: hl.y - 10 };
    const bottom = { x: hl.x + 2.6, y: hl.y + 10 };
    F.bow = 'M' + f(top.x) + ' ' + f(top.y) + 'Q' + f(hl.x - 5) + ' ' + f(hl.y) + ' ' + f(bottom.x) + ' ' + f(bottom.y);
    F.bowString = P.bow.drawn ? seg(top, hr, bottom) : seg(top, bottom);
    // Nocked on the string, pointing left past the bow; once loosed it flies off to the left.
    const tail = P.bow.drawn ? hr : { x: top.x, y: hl.y };
    const ax = tail.x - P.bow.fly;
    const tip = ax - 24;
    F.arrow = 'M' + f(ax) + ' ' + f(tail.y) + 'L' + f(tip) + ' ' + f(tail.y);
    F.arrowHead = 'M' + f(tip - 2.4) + ' ' + f(tail.y) + 'L' + f(tip + 0.4) + ' ' + f(tail.y - 1.3) + 'L' + f(tip + 0.4) + ' ' + f(tail.y + 1.3) + 'Z';
    F.fletch = 'M' + f(ax - 0.4) + ' ' + f(tail.y) + 'L' + f(ax - 3) + ' ' + f(tail.y - 1.4) + 'L' + f(ax - 2.4) + ' ' + f(tail.y)
      + 'L' + f(ax - 3) + ' ' + f(tail.y + 1.4) + 'Z';
    F.arrowO = P.bow.arrowO;
  }

  // Guitar across the body (it moves with them), neck up to the left hand, and a floating note.
  if (P.guitar !== undefined) {
    const cx = 34;
    const cy = 43;
    const dx = -0.957;
    const dy = -0.291;
    const at = (k: number) => B(cx + dx * k, cy + dy * k);
    F.guitarBody = circlePath(at(0), 4.6) + circlePath(at(4.3), 3.6);
    F.guitarHole = circlePath(at(2.2), 1.25);
    F.guitarNeck = seg(at(6.5), at(20.5));
    F.guitarHead = seg(at(20.5), at(23.5));
    F.guitarStrings = seg(at(-2.6), at(20.5));
    F.strumArm = seg(B(elbowR.x, elbowR.y), hands[1]!);
    F.strumHand = circlePath(hands[1]!, 1.95);
    const q = P.guitar;
    const nx = 44 + 5 * q;
    const ny = 32 - 16 * q;
    F.noteHead = circlePath({ x: nx, y: ny }, 1.2);
    F.noteStem = 'M' + f(nx + 1.1) + ' ' + f(ny) + 'L' + f(nx + 1.1) + ' ' + f(ny - 5) + 'Q' + f(nx + 3.4) + ' ' + f(ny - 4) + ' ' + f(nx + 3) + ' ' + f(ny - 2);
    F.noteO = Math.sin(Math.PI * q);
  }

  // Jump rope: a curve between the hands whose middle swings over the head and under the feet,
  // drawn in front of the body for half the turn and behind it for the other half.
  if (P.rope !== undefined) {
    const hl = hands[0]!;
    const hr = hands[1]!;
    const hy = (hl.y + hr.y) / 2;
    const c = Math.cos(P.rope);
    const midY = c >= 0 ? hy + 21 * c : hy + 36 * c;
    F.rope = 'M' + f(hl.x) + ' ' + f(hl.y) + 'Q' + f((hl.x + hr.x) / 2) + ' ' + f(2 * midY - hy) + ' ' + f(hr.x) + ' ' + f(hr.y);
    F.ropeFront = Math.sin(P.rope) > 0 ? 1 : 0;
  }

  // Skateboard: under the feet, popping up and tilting for the ollie (drawn as a fixed shape).
  if (P.board) {
    const boardX = B(30, 57).x;
    F.boardX = boardX;
    F.boardY = 55.45 - P.board.lift;
    F.boardDeg = P.board.deg;
    // A puff of dust off the back wheel, growing and fading as it drifts away.
    const q = (t * 1.6 + seed) % 1;
    F.dustX = boardX - 7 - 7 * q;
    F.dustY = 57.4 - 2 * q - P.board.lift;
    F.dustR = 0.8 + 1.8 * q;
    F.dustO = (1 - q) * (P.board.lift > 0.5 ? 0 : 1);
  }

  // Meditate: a soft glow behind the body.
  if (P.aura !== undefined) {
    const c = B(30, 38);
    F.auraX = c.x;
    F.auraY = c.y;
    F.auraR = 17 + 2 * P.aura;
    F.auraO = 0.5 + 0.5 * P.aura;
  }

  // Tennis: the racket carries on from the right forearm: a handle, then an oval head.
  if (P.racket) {
    const e = B(elbowR.x, elbowR.y);
    const h = hands[1]!;
    const len = Math.hypot(h.x - e.x, h.y - e.y) || 1;
    const dx = (h.x - e.x) / len;
    const dy = (h.y - e.y) / len;
    const grip = { x: h.x + dx * 3.4, y: h.y + dy * 3.4 };
    const head = { x: h.x + dx * 7.4, y: h.y + dy * 7.4 };
    const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
    F.racketHandle = seg(h, grip);
    F.racketHead = ellipsePath(head, 3.9, 2.7, deg);
  }

  // The power ring's glow (on the right hand, for the ring or the construct move).
  F.ringGlow = 0.5 + 0.5 * Math.sin(t * 3);

  // Web swing: the line from the hand up to where it's anchored.
  if (P.web) {
    const h = hands[1]!;
    const r = P.web.reach;
    F.webO = r > 0 ? P.web.o : 0;
    F.web = 'M' + f(h.x) + ' ' + f(h.y) + 'L' + f(mix(h.x, WEB_PIVOT.x, r)) + ' ' + f(mix(h.y, WEB_PIVOT.y, r));
  }

  // Card throw: the card rides in the hand until thrown; then it flies and bursts.
  if (P.card) {
    const c = P.card;
    F.cardX = c.held ? hands[1]!.x : c.x;
    F.cardY = c.held ? hands[1]!.y - 1.2 : c.y;
    F.cardDeg = c.held ? -20 : c.deg;
    F.cardGlow = c.charge;
    F.cardO = c.o;
    F.burstX = 84;
    F.burstY = 30;
    F.burstR = c.burstR;
    F.burstO = c.burstO;
    // The card spring: up to five cards in flight along an arc from the left hand to the right,
    // one after another. A card outside its stretch of the stream is hidden.
    const hl = hands[0]!;
    const hr = hands[1]!;
    const cx = (hl.x + hr.x) / 2;
    const cy = Math.min(hl.y, hr.y) - 17;
    for (let i = 0; i < 5; i++) {
      const k = c.spring < 0 ? -1 : c.spring * 1.8 - i * 0.2;
      const on = k > 0 && k < 1;
      const q = on ? k : 0;
      F['arcX' + i] = (1 - q) * (1 - q) * hl.x + 2 * (1 - q) * q * cx + q * q * hr.x;
      F['arcY' + i] = (1 - q) * (1 - q) * hl.y + 2 * (1 - q) * q * cy + q * q * hr.y;
      F['arcDeg' + i] = -60 + 120 * q;
      F['arcO' + i] = on ? 1 : 0;
    }
    F.deckX = hl.x;
    F.deckY = hl.y - 1.4;
  }

  // Hero pose: a cape from the shoulders, its hem fluttering to one side.
  if (P.cape !== undefined) {
    const a = Math.sin(P.cape * 3);
    const b = Math.sin(P.cape * 4.3 + 1);
    F.cape = shapePath(
      [
        ['M', 24.5, 31.8], ['L', 35.5, 31.8], ['Q', 39, 42, 39.5 + 2 * a, 55],
        ['Q', 34.5, 53 + b, 30 + a, 56.4 + b], ['Q', 25.5, 53 - b, 20.5 - 1.5 * a, 55], ['Q', 21, 42, 24.5, 31.8], ['Z'],
      ],
      B
    );
  }

  // Power construct: a hammer held out from the ring hand, and the shockwave where it hits.
  if (P.construct) {
    const c = P.construct;
    F.constructX = hands[1]!.x;
    F.constructY = hands[1]!.y;
    F.constructDeg = c.deg;
    F.constructO = c.o;
    // How far below its place it still is while rising out of the ground (drawn clipped at ground).
    F.constructRise = c.rise * 55;
    F.emergeO = c.o > 0 && c.rise > 0.02 ? c.rise : 0;
    F.rippleR = c.rippleR;
    F.rippleO = c.rippleO;
  }

  // Shield throw: in the hand, or out on its arc.
  if (P.shield) {
    const sh = P.shield;
    F.shieldX = sh.held ? hands[1]!.x + 1.5 : sh.x;
    F.shieldY = sh.held ? hands[1]!.y : sh.y;
    // Spinning flat in flight reads as squashing side to side; held, it faces front.
    F.shieldScale = sh.held ? 1 : 0.35 + 0.65 * Math.abs(Math.cos(sh.spin));
  }

  // Thunder strike: a jagged bolt from the sky down to the hammer head, new shape each flash.
  if (P.thunder) {
    const h = hands[1]!;
    const e = B(elbowR.x, elbowR.y);
    const len = Math.hypot(h.x - e.x, h.y - e.y) || 1;
    const top = { x: h.x + ((h.x - e.x) / len) * 8, y: h.y + ((h.y - e.y) / len) * 8 };
    F.thunderBolt = P.thunder.bolt;
    F.boltX = top.x;
    F.boltY = top.y;
    if (P.thunder.bolt) {
      let d = 'M' + f(top.x + 6) + ' -4';
      for (let i = 1; i < 6; i++) {
        const k = i / 6;
        d += 'L' + f(mix(top.x + 6, top.x, k) + (hash01(P.thunder.seed * 7 + i) - 0.5) * 6) + ' ' + f(mix(-4, top.y, k));
      }
      F.bolt = d + 'L' + f(top.x) + ' ' + f(top.y);
    }
  }

  // Speedster: three small zigzags of lightning around the body, jumping about every flash.
  if (P.sparks !== undefined) {
    let d = '';
    for (let i = 0; i < 3; i++) {
      const n = P.sparks * 3 + i;
      const x = 14 + 32 * hash01(n);
      const y = 20 + 34 * hash01(n + 101);
      d += 'M' + f(x) + ' ' + f(y) + 'l2 -2l-1 3l3 -2';
    }
    F.sparks = d;
  }

  // ---------- Pets (only the ones this player has) ----------
  const S = (hz: number, sd: number) => Math.sin(TAU * (hz * t + sd));
  let catCount = 0;
  let hasDog = false;
  let hasHorse = false;
  for (let i = 0; i < look.pets.length; i++) {
    const p = look.pets[i]!;
    if (p === 'horse') hasHorse = true;
    else if (p === 'browndog' || p === 'goldendog' || p === 'bwdog') hasDog = true;
    else if (p !== 'bird' && p !== 'bluebird' && p !== 'macaw' && p !== 'canary' && p !== 'cockatoo') catCount++;
  }
  // Shoulder bird (any pet left over): bobs on the shoulder, blinks, and now and then flaps its wing.
  if (catCount + (hasDog ? 1 : 0) + (hasHorse ? 1 : 0) < look.pets.length) {
    const sd = seed + 0.19;
    F.birdBob = 0.35 * S(1.1, sd);
    F.birdEye = blink(t, sd + 0.8);
    const u = ((t + sd * 4) % 4) / 4;
    F.birdFlap = u > 0.85 ? Math.abs(Math.sin(((u - 0.85) / 0.15) * Math.PI * 3)) : 0;
  }
  // Small pets (up to two slots): tail sway (a bunny's ears, a hamster's cheeks) and blink.
  for (let i = 0; i < catCount; i++) {
    const sd = seed + 0.37 * (i + 1);
    const sway = S(0.45, sd);
    F['petSway' + i] = sway;
    F['catTail' + i] = 'M3.8 -1.4Q9 -1.6 ' + f(8.6 + 1.6 * sway) + ' -7.2';
    const open = blink(t, sd + 0.4);
    F['catEye' + i] = 1.15 * open;
    F['catPupil' + i] = 0.95 * open;
  }
  // Dog: fast tail wag, panting tongue, blink.
  if (hasDog) {
    const sd = seed + 0.71;
    const wag = S(2.4, sd);
    F.dogTail = 'M4.4 -2Q8.6 -3 ' + f(8.8 + 2.2 * wag) + ' -8';
    const pant = (S(1.8, sd) + 1) / 2;
    F.dogTongueRy = 1 + 0.5 * pant;
    F.dogTongueCy = -12.2 + 0.4 * pant;
    F.dogEye = 0.8 * blink(t, sd + 1.3);
  }
  // Horse: tail swish, grazing nod about the base of the neck, occasional front-hoof lift.
  if (hasHorse) {
    const sd = seed + 0.53;
    const swish = S(0.7, sd);
    F.horseTail = 'M8.4 -15.4Q' + f(11.6 + 1.3 * swish) + ' -12 ' + f(10.6 + 1.8 * swish) + ' -5';
    const graze = (S(0.18, sd) + 1) / 2;
    const nod = ((-2 + 9 * graze * graze) * Math.PI) / 180;
    const neckPivot = { x: -5, y: -14 };
    const N = (x: number, y: number) => rot({ x, y }, neckPivot, nod);
    F.horseHead = shapePath(HORSE_NECK_HEAD, N);
    F.horseMane = shapePath(HORSE_MANE, N);
    F.horseForelock = shapePath(HORSE_FORELOCK, N);
    F.horseEar = shapePath(HORSE_EAR, N);
    const eye = N(-11.7, -23.1);
    const nostril = N(-14.8, -20.4);
    F.horseEyeX = eye.x;
    F.horseEyeY = eye.y;
    F.horseNostrilX = nostril.x;
    F.horseNostrilY = nostril.y;
    const u = ((t + sd * 5) % 5) / 5;
    const lift = u > 0.9 ? Math.sin(((u - 0.9) / 0.1) * Math.PI) * 1.6 : 0;
    F.horseFrontLeg = 'M-5.8 ' + f(-9.6 - lift) + 'L-6 ' + f(-0.7 - lift);
    F.horseFrontHoof = -1 - lift;
  }
  return F;
}
