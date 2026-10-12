// The effects round a podium entrance (dust, speed lines, green light, the web, cards, the car,
// the horse, the magic carpet, the flying saucer, the zipline), drawn on a canvas that's bigger
// than the character and floats over its surroundings. All of it is a function of the entrance
// clock, like the character's own pose.

import {
  Canvas,
  ClipOp,
  PaintStyle,
  Picture,
  Skia,
  StrokeCap,
  type SkCanvas,
  type SkPaint,
} from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

import {
  CAR_HEIGHT,
  CAR_LENGTH,
  CARD_TARGET_X,
  CARPET,
  CARPET_LENGTH,
  HORSE_LEAP,
  HORSE_SEAT,
  HORSE_UNIT,
  UFO,
  WEB_ANCHOR_UP,
  ZIP,
  ZIP_HANDLE,
  carSquash,
  carpetPos,
  ENTRANCE_SECONDS,
  carX,
  fxSide,
  entranceState,
  gallopPhase,
  horseLeap,
  horseLeapProgress,
  horseLift,
  horseX,
  ufoBeam,
  ufoPos,
  zipX,
  zipY,
  type EntranceKind,
} from '@/components/character/entrance';
import { HORSE_BODY, HORSE_EYE, HORSE_HEAD_SHAPES, HORSE_NECK_PIVOT, HORSE_NOSTRIL } from '@/components/character/rig';
import { HORSE_COAT } from '@/components/character/scene-common';

/** The character sits half as tall as it is wide; its feet are this far down its box. */
const FOOT = 0.975;
/** How far the effects canvas reaches above the feet, and to each side, in character heights. */
const UP = 3.1;

type Props = {
  kind: EntranceKind;
  clock: SharedValue<number>;
  /** The character's width in points (its height is half). */
  width: number;
  /** The block's height: how far below the final spot the floor is. */
  ground: number;
};

function paint(color: string, alpha = 1, stroke?: number): SkPaint {
  const p = Skia.Paint();
  p.setAntiAlias(true);
  p.setColor(Skia.Color(color));
  p.setAlphaf(alpha);
  if (stroke) {
    p.setStyle(PaintStyle.Stroke);
    p.setStrokeWidth(stroke);
    p.setStrokeCap(StrokeCap.Round);
  }
  return p;
}

function sm(v: number): number {
  'worklet';
  const k = Math.min(1, Math.max(0, v));
  return k * k * (3 - 2 * k);
}
function hash(n: number): number {
  'worklet';
  const v = Math.sin(n * 12.9898) * 43758.5453;
  return v - Math.floor(v);
}

/** Draws `p` at `alpha` times its own opacity. */
function faded(p: SkPaint, alpha: number, draw: () => void) {
  'worklet';
  if (alpha <= 0.003) return;
  const base = p.getAlphaf();
  p.setAlphaf(base * Math.min(1, alpha));
  draw();
  p.setAlphaf(base);
}

/** Effects canvas for the entrance, positioned over the character's box. */
export function EntranceFx({ kind, clock, width, ground }: Props) {
  const H = width / 2;
  const up = UP * H;
  const w = fxSide(kind) * H * 2;
  const h = up + ground + 0.3 * H;
  const P = useMemo(() => makePaints(H), [H]);

  const picture = useDerivedValue(() => {
    const t = clock.value;
    const recorder = Skia.PictureRecorder();
    const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, w, h));
    // Origin at the final foot spot; y grows downward to the floor at `ground`.
    canvas.translate(w / 2, up);
    if (t >= 0) draw(canvas, P, kind, t, H, ground, width);
    return recorder.finishRecordingAsPicture();
  });

  return (
    <Canvas
      pointerEvents="none"
      style={{ position: 'absolute', left: width / 2 - w / 2, top: FOOT * H - up, width: w, height: h }}
    >
      <Picture picture={picture} />
    </Canvas>
  );
}

type Paints = ReturnType<typeof makePaints>;

function makePaints(H: number) {
  return {
    dust: paint('#E8DCC8', 0.55),
    white: paint('#FFFFFF', 0.7),
    whiteLine: paint('#FFFFFF', 0.7, Math.max(1.5, H * 0.03)),
    streak: paint('#E3F2FD', 0.6, Math.max(1.5, H * 0.04)),
    ring: paint('#BBDEFB', 0.7, Math.max(1.5, H * 0.03)),
    green: paint('#69F0AE', 0.1),
    greenCore: paint('#B9F6CA', 0.5),
    greenRing: paint('#69F0AE', 0.8, Math.max(1.5, H * 0.04)),
    web: paint('#FFFFFF', 0.85, Math.max(1.2, H * 0.025)),
    webThin: paint('#CFD8DC', 0.6, Math.max(0.8, H * 0.014)),
    cardGlow: paint('#FF4FD8', 0.3),
    cardFace: paint('#FFFFFF', 1),
    cardEdge: paint('#E040FB', 0.95, Math.max(1, H * 0.016)),
    cardMark: paint('#E53935', 1),
    cardPurple: paint('#B388FF', 0.8, Math.max(1.5, H * 0.03)),
    cardRing: paint('#FF4FD8', 0.9, Math.max(1.5, H * 0.04)),
    ember: paint('#FF80AB', 0.95),
    flash: paint('#FFB6F0', 0.7),
    carBody: paint('#E53935', 1),
    carDark: paint('#B71C1C', 1),
    carGlass: paint('#B3E5FC', 1),
    carTyre: paint('#212121', 1),
    carHub: paint('#CFD8DC', 1),
    carLight: paint('#FFF176', 1),
    puff: paint('#7E57C2', 0.7),
    puffDark: paint('#311B92', 0.6),
    spark: paint('#B388FF', 0.95),
    boltGlow: paint('#FFF59D', 0.45, Math.max(4, H * 0.12)),
    bolt: paint('#FFFFFF', 1, Math.max(1.5, H * 0.04)),
    zapLine: paint('#82B1FF', 0.9, Math.max(1, H * 0.02)),
    zapFlash: paint('#FFFFFF', 0.6),
    flame: paint('#FF9800', 0.9),
    flameCore: paint('#FFEB3B', 0.95),
    tank: paint('#90A4AE', 1),
    smoke: paint('#B0BEC5', 0.5),
    canopyRed: paint('#E53935', 1),
    canopyWhite: paint('#FFFFFF', 1),
    chuteLine: paint('#ECEFF1', 0.9, Math.max(0.8, H * 0.014)),
    portalGlow: paint('#FFB74D', 0.18),
    portalLine: paint('#FF9800', 0.95, Math.max(1.5, H * 0.04)),
    groundShadow: paint('#000000', 0.12),
    carpetTop: paint('#C62828', 1),
    carpetSide: paint('#8E0000', 1),
    carpetGold: paint('#FFC107', 1),
    carpetTrim: paint('#FFC107', 1, Math.max(1, H * 0.02)),
    tassel: paint('#FFC107', 1, Math.max(1, H * 0.018)),
    sparkle: paint('#FFE082', 0.9),
    ufoBody: paint('#B0BEC5', 1),
    ufoRim: paint('#78909C', 1),
    ufoBelly: paint('#546E7A', 1),
    ufoDome: paint('#B3E5FC', 0.55),
    ufoShine: paint('#FFFFFF', 0.6),
    alien: paint('#7CB342', 1),
    alienEye: paint('#1B1B1B', 1),
    ufoLights: [paint('#FFEB3B', 1), paint('#FF4081', 1), paint('#18FFFF', 1)],
    beam: paint('#EEFF41', 0.16),
    beamCore: paint('#F4FF81', 0.22),
    beamRing: paint('#EEFF41', 0.7, Math.max(1, H * 0.02)),
    zipLine: paint('#37474F', 1, Math.max(1, H * 0.018)),
    pulley: paint('#90A4AE', 1),
    pulleyHub: paint('#455A64', 1),
    zipRod: paint('#607D8B', 1, Math.max(1, H * 0.025)),
    zipBar: paint('#FFB300', 1, Math.max(1.5, H * 0.04)),
    // The ridden horse is drawn in its own units, so its line widths are in horse units too.
    horseCoat: paint(HORSE_COAT.coat),
    horseLeg: paint(HORSE_COAT.coat, 1, 1.9),
    horseFarLeg: paint(HORSE_COAT.farLeg, 1, 1.9),
    horseTail: paint(HORSE_COAT.mane, 1, 1.9),
    horseManeLine: paint(HORSE_COAT.mane, 1, 1.5),
    horseForelock: paint(HORSE_COAT.mane, 1, 1),
    horseHoof: paint(HORSE_COAT.hoof),
    horseEye: paint(HORSE_COAT.eye),
    horseNostril: paint(HORSE_COAT.nostril),
    horseShapes: {
      body: Skia.Path.MakeFromSVGString(HORSE_BODY)!,
      head: Skia.Path.MakeFromSVGString(HORSE_HEAD_SHAPES.head)!,
      mane: Skia.Path.MakeFromSVGString(HORSE_HEAD_SHAPES.mane)!,
      forelock: Skia.Path.MakeFromSVGString(HORSE_HEAD_SHAPES.forelock)!,
      ear: Skia.Path.MakeFromSVGString(HORSE_HEAD_SHAPES.ear)!,
    },
  };
}

/**
 * The ridden horse at time `t`, galloping along the floor (at y = g) with its seat at x = `hx`,
 * facing right: legs cycling through the gallop (tucked up for the leap), head nodding, tail
 * streaming behind.
 */
function drawRideHorse(canvas: SkCanvas, P: Paints, t: number, H: number, g: number, hx: number) {
  'worklet';
  const k = HORSE_UNIT * H;
  const leap = horseLeap(t);
  // How far into the leap (0 → 1), for the body pitching nose-up then nose-down.
  const ls = horseLeapProgress(t);
  const stride = gallopPhase(t);
  const pitch = 2.5 * Math.sin(stride + 1) * (1 - leap) + (ls > 0 && ls < 1 ? 12 * Math.sin(2 * Math.PI * ls) : 0);
  canvas.save();
  canvas.translate(hx, g - horseLift(t, H));
  // Mirrored to face right (its shapes face left), with the seat at the origin.
  canvas.scale(-k, k);
  canvas.translate(-HORSE_SEAT.x, 0);
  canvas.rotate(pitch, 0, -12);
  // A leg from the body down: thigh swinging with the stride, the lower leg folding back as it
  // comes forward; for the leap the front legs tuck up and the hind legs stretch back.
  const leg = (x: number, phase: number, front: boolean, p: SkPaint) => {
    const c = stride + phase;
    const swing = 0.5 * Math.sin(c);
    const fold = 1.1 * Math.max(0, -Math.cos(c));
    const a = swing + ((front ? -0.5 : 0.8) - swing) * leap;
    const b = a + fold + ((front ? 1.8 : 0.2) - fold) * leap;
    const kx = x + 4.6 * Math.sin(a);
    const ky = -9.6 + 4.6 * Math.cos(a);
    const fx = kx + 4.4 * Math.sin(b);
    const fy = ky + 4.4 * Math.cos(b);
    const path = Skia.Path.Make();
    path.moveTo(x, -9.6);
    path.lineTo(kx, ky);
    path.lineTo(fx, fy);
    canvas.drawPath(path, p);
    canvas.drawCircle(fx, fy, 1, P.horseHoof);
  };
  const tail = Skia.Path.Make();
  const flick = Math.sin(stride * 0.5);
  tail.moveTo(8.4, -15.4);
  tail.quadTo(12.5, -15.6 + 0.8 * flick, 15.6, -13.4 + 1.4 * flick);
  canvas.drawPath(tail, P.horseTail);
  leg(-4, 0.55 * 2 * Math.PI, true, P.horseFarLeg);
  leg(6.4, 0, false, P.horseFarLeg);
  leg(4.6, 0.25 * 2 * Math.PI, false, P.horseLeg);
  leg(-5.8, 0.8 * 2 * Math.PI, true, P.horseLeg);
  canvas.drawPath(P.horseShapes.body, P.horseCoat);
  // Head and neck nod with the stride, stretched forward over the leap.
  canvas.save();
  canvas.rotate(4 * Math.sin(stride + 0.6) * (1 - leap) - 8 * leap, HORSE_NECK_PIVOT.x, HORSE_NECK_PIVOT.y);
  canvas.drawPath(P.horseShapes.head, P.horseCoat);
  canvas.drawPath(P.horseShapes.mane, P.horseManeLine);
  canvas.drawPath(P.horseShapes.forelock, P.horseForelock);
  canvas.drawPath(P.horseShapes.ear, P.horseCoat);
  canvas.drawCircle(HORSE_EYE.x, HORSE_EYE.y, 0.55, P.horseEye);
  canvas.drawCircle(HORSE_NOSTRIL.x, HORSE_NOSTRIL.y, 0.32, P.horseNostril);
  canvas.restore();
  canvas.restore();
}

/**
 * The magic carpet with the middle of its top at (cx, cy), seen a little from above: a red top
 * rippling in waves that grow toward the ends, a darker front edge, gold trim and diamonds, and
 * tassels fluttering at both ends.
 */
function drawCarpet(canvas: SkCanvas, P: Paints, t: number, H: number, cx: number, cy: number) {
  'worklet';
  const half = (CARPET_LENGTH * H) / 2;
  const wave = (u: number) => 0.035 * H * Math.sin(u * Math.PI * 1.2 - t * 9) * (0.35 + 0.65 * Math.abs(u));
  const back = (u: number) => cy - 0.1 * H + wave(u);
  const front = (u: number) => cy + 0.04 * H + wave(u);
  const thick = 0.03 * H;
  const n = 14;
  const top = Skia.Path.Make();
  const side = Skia.Path.Make();
  const frontTrim = Skia.Path.Make();
  const backTrim = Skia.Path.Make();
  for (let i = 0; i <= n; i++) {
    const u = -1 + (2 * i) / n;
    const x = cx + u * half;
    if (i === 0) {
      top.moveTo(x, back(u));
      backTrim.moveTo(x, back(u));
      frontTrim.moveTo(x, front(u));
    } else {
      top.lineTo(x, back(u));
      backTrim.lineTo(x, back(u));
      frontTrim.lineTo(x, front(u));
    }
  }
  for (let i = n; i >= 0; i--) {
    const u = -1 + (2 * i) / n;
    top.lineTo(cx + u * half, front(u));
    if (i === n) side.moveTo(cx + u * half, front(u));
    else side.lineTo(cx + u * half, front(u));
  }
  for (let i = 0; i <= n; i++) {
    const u = -1 + (2 * i) / n;
    side.lineTo(cx + u * half, front(u) + thick);
  }
  top.close();
  side.close();
  canvas.drawPath(side, P.carpetSide);
  canvas.drawPath(top, P.carpetTop);
  canvas.drawPath(backTrim, P.carpetTrim);
  canvas.drawPath(frontTrim, P.carpetTrim);
  // Gold diamonds out toward the ends (the middle is under the rider).
  for (const u of [-0.6, 0.6]) {
    const x = cx + u * half;
    const y = cy - 0.03 * H + wave(u);
    const d = Skia.Path.Make();
    d.moveTo(x - 0.06 * H, y);
    d.lineTo(x, y - 0.025 * H);
    d.lineTo(x + 0.06 * H, y);
    d.lineTo(x, y + 0.025 * H);
    d.close();
    canvas.drawPath(d, P.carpetGold);
  }
  for (const end of [-1, 1]) {
    const x = cx + end * half;
    for (let j = 0; j < 3; j++) {
      const y = back(end) + ((front(end) - back(end)) * (j + 0.5)) / 3 + thick * 0.5;
      canvas.drawLine(x, y, x + end * 0.06 * H, y + 0.012 * H * Math.sin(t * 14 + j * 1.7), P.tassel);
    }
  }
}

/**
 * The flying saucer with the middle of its underside at (ux, uy): the beam below it (at
 * `beam` strength) with rings running down it, a little alien under the glass dome, and blinking
 * lights round the rim. It tilts into its moves on and off.
 */
function drawUfo(canvas: SkCanvas, P: Paints, t: number, H: number, ux: number, uy: number, beam: number) {
  'worklet';
  const oval = (x: number, y: number, rx: number, ry: number, p: SkPaint) =>
    canvas.drawOval(Skia.XYWHRect(x - rx, y - ry, rx * 2, ry * 2), p);
  if (beam > 0.01) {
    // From the underside down to the top of the block.
    const cone = (top: number, bottom: number, p: SkPaint) => {
      const path = Skia.Path.Make();
      path.moveTo(ux - top * H, uy);
      path.lineTo(ux + top * H, uy);
      path.lineTo(ux + bottom * H, 0);
      path.lineTo(ux - bottom * H, 0);
      path.close();
      faded(p, beam, () => canvas.drawPath(path, p));
    };
    cone(0.16, 0.5, P.beam);
    cone(0.07, 0.28, P.beamCore);
    for (let i = 0; i < 3; i++) {
      const f = (t * 0.9 + i / 3) % 1;
      faded(P.beamRing, beam * (1 - f) * 0.8, () =>
        oval(ux, uy + (0 - uy) * f, (0.16 + 0.34 * f) * H, 0.035 * H, P.beamRing)
      );
    }
  }
  const tilt = -12 * (1 - Math.min(1, t / UFO.hover)) - 12 * sm((t - UFO.beamOff) / 0.25);
  canvas.save();
  canvas.rotate(tilt, ux, uy - 0.08 * H);
  // The alien, then the dome's glass over it, then the saucer over the dome's lower half.
  canvas.drawCircle(ux, uy - 0.2 * H, 0.075 * H, P.alien);
  oval(ux - 0.03 * H, uy - 0.21 * H, 0.018 * H, 0.028 * H, P.alienEye);
  oval(ux + 0.03 * H, uy - 0.21 * H, 0.018 * H, 0.028 * H, P.alienEye);
  oval(ux, uy - 0.17 * H, 0.2 * H, 0.17 * H, P.ufoDome);
  oval(ux - 0.08 * H, uy - 0.26 * H, 0.04 * H, 0.025 * H, P.ufoShine);
  oval(ux, uy - 0.03 * H, 0.3 * H, 0.05 * H, P.ufoBelly);
  if (beam > 0.01) faded(P.beamCore, beam * 2, () => oval(ux, uy - 0.02 * H, 0.12 * H, 0.04 * H, P.beamCore));
  oval(ux, uy - 0.09 * H, 0.55 * H, 0.09 * H, P.ufoBody);
  oval(ux, uy - 0.065 * H, 0.52 * H, 0.03 * H, P.ufoRim);
  for (let i = 0; i < 7; i++) {
    const a = Math.PI * (0.12 + (0.76 * i) / 6);
    const light = P.ufoLights[(i + Math.floor(t * 6)) % 3]!;
    canvas.drawCircle(ux + 0.47 * H * Math.cos(a), uy - 0.08 * H + 0.055 * H * Math.sin(a), 0.025 * H, light);
  }
  canvas.restore();
}

/**
 * The zipline, and the pulley with its handle at `t` (it runs on down the line once let go): a bar
 * held at both ends behind the head, on two straps up to the wheel.
 */
function drawZipline(canvas: SkCanvas, P: Paints, t: number, H: number) {
  'worklet';
  const alpha = 1 - sm((t - (ZIP.land + 0.05)) / 0.4);
  faded(P.zipLine, alpha, () =>
    canvas.drawLine(ZIP.from.x * H, ZIP.from.y * H, ZIP.to.x * H, ZIP.to.y * H, P.zipLine)
  );
  const px = zipX(t, H);
  if (px > ZIP.to.x * H) return;
  const py = zipY(px, H);
  const wheel = 0.045 * H;
  const bar = py + ZIP_HANDLE * H;
  const reach = 0.17 * H;
  faded(P.zipRod, alpha, () => {
    canvas.drawLine(px, py - wheel, px - reach, bar, P.zipRod);
    canvas.drawLine(px, py - wheel, px + reach, bar, P.zipRod);
  });
  faded(P.zipBar, alpha, () => canvas.drawLine(px - reach, bar, px + reach, bar, P.zipBar));
  faded(P.pulley, alpha, () => canvas.drawCircle(px, py - wheel, wheel, P.pulley));
  faded(P.pulleyHub, alpha, () => canvas.drawCircle(px, py - wheel, wheel * 0.4, P.pulleyHub));
}

function draw(canvas: SkCanvas, P: Paints, kind: EntranceKind, t: number, H: number, g: number, W: number) {
  'worklet';
  const st = entranceState(kind, t, H, g);
  const circle = (x: number, y: number, r: number, p: SkPaint) => canvas.drawCircle(x, y, r, p);
  const oval = (x: number, y: number, rx: number, ry: number, p: SkPaint) =>
    canvas.drawOval(Skia.XYWHRect(x - rx, y - ry, rx * 2, ry * 2), p);
  // Puffs of dust off the floor at (x, y): `u` 0 → 1 as they spread and fade.
  const dustBurst = (x: number, y: number, u: number, size: number) => {
    for (let i = 0; i < 6; i++) {
      const dir = i < 3 ? -1 : 1;
      const k = (i % 3) + 1;
      faded(P.dust, 1 - u, () =>
        circle(
          x + dir * (0.12 + 0.2 * k * u) * size,
          y - (0.04 + 0.06 * k * u) * size,
          (0.05 + 0.06 * u) * size,
          P.dust
        )
      );
    }
  };

  if (kind === 'bigjump') {
    if (t > 0.28 && t < 0.9) dustBurst(0, g, (t - 0.28) / 0.62, H);
    if (t > 1.1 && t < 1.6) dustBurst(0, 0, (t - 1.1) / 0.5, H);
    // A shadow on the block's top that firms up as they come down.
    if (t > 0.3 && t < 1.2) {
      const k = sm((t - 0.3) / 0.85);
      faded(P.carTyre, 0.18 * k, () => oval(0, 0, 0.3 * H * (0.5 + 0.5 * k), 0.05 * H, P.carTyre));
    }
  } else if (kind === 'superman') {
    // A ring of force on the floor at take-off and a rush of streaks trailing the flight.
    if (t < 0.5) {
      const u = t / 0.5;
      faded(P.ring, 1 - u, () => oval(0, g, (0.3 + 1.2 * u) * H, (0.05 + 0.12 * u) * H, P.ring));
    }
    if (t < 1.3) {
      for (let i = 0; i < 9; i++) {
        const dx = (i - 4) * 0.11 * H + st.x * 0.4;
        const len = (0.3 + 0.5 * hash(i * 3.7)) * H;
        const y0 = st.y + 0.05 * H + (0.12 * hash(i + 11) + ((t * 3 + i * 0.37) % 1) * 0.2) * H;
        faded(P.streak, 1 - sm((t - 0.8) / 0.5), () => canvas.drawLine(dx, y0, dx - st.x * 0.15, y0 + len, P.streak));
      }
    }
    if (t > 1.05 && t < 1.5) {
      const u = (t - 1.05) / 0.45;
      faded(P.ring, 1 - u, () => oval(0, 0, (0.25 + 0.5 * u) * H, 0.06 * H, P.ring));
    }
  } else if (kind === 'lantern') {
    const lift = sm(t / 1.5);
    const body = st.y - 0.45 * H;
    // A column of light from the floor up to the feet, a halo round the body, rising sparkles.
    if (t < 1.7) {
      const fade = 1 - sm((t - 1.4) / 0.3);
      for (let i = 0; i < 4; i++) {
        const half = (0.34 - 0.07 * i) * H;
        faded(P.green, fade * (0.9 + 0.5 * i), () =>
          canvas.drawRect(Skia.XYWHRect(-half, st.y, half * 2, Math.max(0, g - st.y)), P.green)
        );
      }
      for (let i = 0; i < 5; i++) {
        faded(P.green, fade * (1.1 + 0.4 * i), () =>
          circle(0, body, (0.9 - 0.12 * i) * H * (0.9 + 0.1 * Math.sin(t * 8)), P.green)
        );
      }
      for (let i = 0; i < 12; i++) {
        const span = Math.max(1, g - st.y);
        const y = g - ((t * 0.9 + hash(i * 5.1)) % 1) * span;
        const x = (hash(i * 2.3) - 0.5) * 0.5 * H;
        faded(P.greenCore, fade, () => circle(x, y, 0.025 * H + 0.02 * H * hash(i), P.greenCore));
      }
    }
    if (t > 1.35) {
      const u = (t - 1.35) / 0.55;
      faded(P.greenRing, 1 - u, () => oval(0, 0, (0.25 + 0.9 * u) * H, (0.05 + 0.1 * u) * H, P.greenRing));
    }
    if (lift < 0.05) faded(P.greenRing, 1 - lift * 20, () => oval(0, g, 0.5 * H, 0.1 * H, P.greenRing));
  } else if (kind === 'web') {
    // The anchor point above, and the line from the right hand to it while they swing.
    const ax = 0;
    const ay = -WEB_ANCHOR_UP * H;
    const reach = sm((t - 0.15) / 0.2);
    const keep = 1 - sm((t - 1.3) / 0.2);
    if (reach > 0 && keep > 0) {
      // Their raised hand, from the middle of their box, turned with them.
      const cx = st.x;
      const cy = st.y - (FOOT - 0.5) * H;
      const hx = 0.157 * H;
      const hy = -0.14 * H;
      const c = Math.cos(st.rot);
      const s = Math.sin(st.rot);
      const handX = cx + hx * c - hy * s;
      const handY = cy + hx * s + hy * c;
      const endX = handX + (ax - handX) * reach;
      const endY = handY + (ay - handY) * reach;
      faded(P.web, keep, () => canvas.drawLine(handX, handY, endX, endY, P.web));
      faded(P.webThin, keep, () => {
        canvas.drawLine(handX + 1.5, handY, endX + 1.5, endY, P.webThin);
        canvas.drawLine(handX - 1.5, handY, endX - 1.5, endY, P.webThin);
      });
      if (reach > 0.95) {
        faded(P.whiteLine, keep, () => {
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2;
            canvas.drawLine(ax, ay, ax + Math.cos(a) * 0.14 * H, ay + Math.sin(a) * 0.14 * H, P.whiteLine);
          }
        });
      }
    }
    if (t > 1.4 && t < 1.9) dustBurst(0, 0, (t - 1.4) / 0.5, H * 0.8);
  } else if (kind === 'cards') {
    // Gambit: a fan of charged cards, flicked at the floor, goes off in a pink kinetic blast that
    // sends cards fountaining up and shoots the character skyward on a trail of cards.
    const hx = 0.18 * H;
    const hy = -0.6 * H;
    const tx = CARD_TARGET_X * H;
    const ty = g - 0.03 * H;
    const card = (x: number, y: number, deg: number, size: number, alpha: number) => {
      canvas.save();
      canvas.translate(x, y);
      canvas.rotate(deg, 0, 0);
      const r = Skia.RRectXY(Skia.XYWHRect(-size * 0.35, -size * 0.5, size * 0.7, size), size * 0.08, size * 0.08);
      faded(P.cardFace, alpha, () => canvas.drawRRect(r, P.cardFace));
      faded(P.cardEdge, alpha, () => canvas.drawRRect(r, P.cardEdge));
      faded(P.cardMark, alpha, () => circle(0, 0, size * 0.12, P.cardMark));
      canvas.restore();
    };
    if (t < 0.52) {
      // Three cards fanned in the raised hand, glowing harder as they charge, sparks orbiting.
      const charge = sm(t / 0.4);
      const gx = hx + st.x;
      const gy = hy + st.y - 0.12 * H;
      faded(P.cardGlow, charge, () => circle(gx, gy, 0.26 * H * (0.8 + 0.2 * Math.sin(t * 22)), P.cardGlow));
      faded(P.cardGlow, charge, () => circle(gx, gy, 0.4 * H * (0.8 + 0.2 * Math.sin(t * 17)), P.cardGlow));
      for (let i = 0; i < 3; i++) card(gx, gy, -28 + i * 28, 0.2 * H, 1);
      for (let i = 0; i < 6; i++) {
        const a = t * 9 + (i / 6) * Math.PI * 2;
        faded(P.ember, charge, () => circle(gx + Math.cos(a) * 0.3 * H, gy + Math.sin(a) * 0.3 * H, 0.02 * H, P.ember));
      }
    } else if (t < 0.74) {
      // The fan is thrown: one card to the spot, two either side, spinning, trailing glow.
      const k = sm((t - 0.52) / 0.22);
      for (let i = -1; i <= 1; i++) {
        const x = hx + st.x + (tx + i * 0.28 * H - hx - st.x) * k;
        const y = hy + st.y + (ty - hy - st.y) * k - 0.14 * H * Math.sin(Math.PI * k) * (1 + 0.4 * i);
        faded(P.cardGlow, 1, () => circle(x, y, 0.16 * H, P.cardGlow));
        card(x, y, k * 720 + i * 40, 0.2 * H, 1);
      }
    }
    if (t > 0.74 && t < 1.7) {
      const tau = t - 0.74;
      const flashU = sm(tau / 0.25);
      if (tau < 0.35) {
        faded(P.flash, 1 - flashU, () => circle(tx, ty, (0.2 + 0.9 * flashU) * H, P.flash));
        faded(P.cardGlow, 1 - flashU, () => circle(tx, ty, (0.4 + 1.6 * flashU) * H, P.cardGlow));
        // Kinetic rays and two rings of force.
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2;
          const r0 = (0.2 + 0.5 * flashU) * H;
          const r1 = r0 + (0.25 + 0.2 * hash(i)) * H * (1 - flashU);
          faded(P.cardEdge, 1 - flashU, () =>
            canvas.drawLine(
              tx + Math.cos(a) * r0,
              ty + Math.sin(a) * r0,
              tx + Math.cos(a) * r1,
              ty + Math.sin(a) * r1,
              P.cardEdge
            )
          );
        }
        faded(P.cardRing, 1 - flashU, () => circle(tx, ty, (0.2 + 1.1 * flashU) * H, P.cardRing));
        faded(P.cardPurple, 1 - flashU, () => circle(tx, ty, (0.1 + 1.6 * flashU) * H, P.cardPurple));
      }
      // A fountain of cards and glowing embers.
      for (let i = 0; i < 14; i++) {
        const a = -Math.PI / 2 + ((i / 14) * 2 - 1) * 1.3 * (0.5 + 0.5 * hash(i * 1.7));
        const sp = (1.2 + 1.8 * hash(i * 4.3 + 2)) * H;
        const x = tx + Math.cos(a) * sp * tau;
        const y = ty + Math.sin(a) * sp * tau + 1.7 * H * tau * tau;
        card(
          x,
          y,
          360 * tau * (1 + hash(i)) * (i % 2 ? 1 : -1) + hash(i + 40) * 90,
          (0.12 + 0.1 * hash(i + 70)) * H,
          1 - sm((tau - 0.55) / 0.4)
        );
      }
      for (let i = 0; i < 22; i++) {
        const a = hash(i * 5.3) * Math.PI * 2;
        const sp = (0.4 + 1.4 * hash(i * 2.1 + 9)) * H;
        faded(P.ember, 1 - tau / 0.9, () =>
          circle(tx + Math.cos(a) * sp * tau, ty + Math.sin(a) * sp * tau * 0.8 - 0.25 * H * tau, 0.02 * H, P.ember)
        );
      }
    }
    // While they're launched: a pink glow round them and a trail of cards left behind.
    if (t > 0.78 && t < 1.7) {
      const air = 1 - sm((t - 1.45) / 0.25);
      faded(P.cardGlow, air, () => circle(st.x, st.y - 0.45 * H, 0.55 * H, P.cardGlow));
      faded(P.cardGlow, air, () => circle(st.x, st.y - 0.45 * H, 0.8 * H, P.cardGlow));
      for (let i = 1; i <= 4; i++) {
        const te = t - i * 0.09;
        if (te < 0.78) continue;
        const past = entranceState(kind, te, H, g);
        card(past.x + (hash(i) - 0.5) * 0.2 * H, past.y - 0.4 * H, i * 38, 0.14 * H, (1 - i / 5) * air);
      }
    }
    if (t > 1.65 && t < 2) {
      const u = (t - 1.65) / 0.35;
      faded(P.cardRing, 1 - u, () => oval(0, 0, (0.2 + 1.0 * u) * H, (0.05 + 0.13 * u) * H, P.cardRing));
      dustBurst(0, 0, u, H * 0.8);
    }
  } else if (kind === 'teleport') {
    // Sparks rush in to a point, then a purple burst of smoke where they reappear.
    const cy = -0.45 * H;
    if (t < 0.5) {
      for (let i = 0; i < 14; i++) {
        const a = hash(i * 3.1) * Math.PI * 2;
        const r = (0.3 + 0.7 * hash(i + 9)) * 0.9 * H * (1 - sm(t / 0.5));
        faded(P.spark, 1, () => circle(Math.cos(a) * r, cy + Math.sin(a) * r, 0.025 * H, P.spark));
      }
    } else if (t < 1.35) {
      const u = (t - 0.5) / 0.85;
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 + hash(i) * 0.5;
        const d = (0.1 + 0.55 * (0.6 + 0.4 * hash(i + 4))) * u * H;
        const r = (0.16 + 0.22 * hash(i + 2)) * H * (0.5 + 0.7 * u);
        const p = i % 3 === 0 ? P.puffDark : P.puff;
        faded(p, 1 - u, () => circle(Math.cos(a) * d, cy + Math.sin(a) * d * 0.8, r, p));
      }
      faded(P.zapFlash, 1 - sm(u / 0.3), () => circle(0, cy, (0.2 + 0.6 * u) * H, P.zapFlash));
    }
  } else if (kind === 'lightning') {
    // A jagged bolt from the sky to the block, a white flash, a shockwave and crackling sparks.
    const seed = Math.floor(t * 40);
    if (t > 0.3 && t < 0.52) {
      const path = Skia.Path.Make();
      path.moveTo(0, -3 * H);
      for (let i = 1; i <= 9; i++) {
        const x = i === 9 ? 0 : (hash(seed * 7 + i) - 0.5) * 0.3 * H;
        path.lineTo(x, -3 * H + (i / 9) * 2.9 * H);
      }
      canvas.drawPath(path, P.boltGlow);
      canvas.drawPath(path, P.bolt);
    }
    if (t > 0.34 && t < 0.62) {
      const u = (t - 0.34) / 0.28;
      faded(P.zapFlash, 1 - u, () => circle(0, -0.4 * H, (0.5 + 1.6 * u) * H, P.zapFlash));
    }
    if (t > 0.38 && t < 1.0) {
      const u = (t - 0.38) / 0.62;
      faded(P.zapLine, 1 - u, () => oval(0, 0, (0.2 + 1.0 * u) * H, (0.04 + 0.12 * u) * H, P.zapLine));
    }
    if (t > 0.38 && t < 1.1) {
      for (let i = 0; i < 8; i++) {
        const a = hash(Math.floor(t * 22) + i * 5) * Math.PI * 2;
        const r0 = (0.3 + 0.2 * hash(i)) * H;
        const r1 = r0 + 0.14 * H;
        faded(P.zapLine, 1 - (t - 0.38) / 0.72, () =>
          canvas.drawLine(
            Math.cos(a) * r0,
            -0.4 * H + Math.sin(a) * r0,
            Math.cos(a) * r1,
            -0.4 * H + Math.sin(a) * r1,
            P.zapLine
          )
        );
      }
    }
  } else if (kind === 'jetpack') {
    // Two small tanks on their back, flames from them, a trail of smoke along the climb.
    const burn = t > 0.2 && t < 2.15 ? 1 - sm((t - 1.85) / 0.3) : 0;
    if (burn > 0) {
      for (let i = 0; i < 14; i++) {
        const te = t - i * 0.07;
        if (te < 0.25) continue;
        const past = entranceState(kind, te, H, g);
        const age = (t - te) / 1.0;
        faded(P.smoke, 1 - age, () =>
          circle(past.x + (hash(i) - 0.5) * 0.1 * H, past.y - 0.25 * H, (0.06 + 0.1 * age) * H, P.smoke)
        );
      }
      for (const sx of [-1, 1]) {
        const fx = st.x + sx * 0.1 * H;
        const top = st.y - 0.32 * H;
        const len = (0.22 + 0.1 * hash(Math.floor(t * 30) + sx)) * H * burn;
        const flame = Skia.Path.Make();
        flame.moveTo(fx - 0.04 * H, top);
        flame.lineTo(fx + 0.04 * H, top);
        flame.lineTo(fx, top + len);
        flame.close();
        canvas.drawPath(flame, P.flame);
        const core = Skia.Path.Make();
        core.moveTo(fx - 0.02 * H, top);
        core.lineTo(fx + 0.02 * H, top);
        core.lineTo(fx, top + len * 0.6);
        core.close();
        canvas.drawPath(core, P.flameCore);
      }
    }
    for (const sx of [-1, 1]) {
      const tank = Skia.XYWHRect(st.x + sx * 0.1 * H - 0.035 * H, st.y - 0.62 * H, 0.07 * H, 0.3 * H);
      canvas.drawRRect(Skia.RRectXY(tank, 0.03 * H, 0.03 * H), P.tank);
    }
    if (t < 0.5) dustBurst(0, g, t / 0.5, H);
  } else if (kind === 'parachute') {
    // A striped canopy on lines to their hands; once they land it drifts down and fades.
    const gone = sm((t - 2.0) / 0.5);
    if (gone < 1) {
      const cx = st.x - 0.5 * H * gone;
      const cy = st.y - 1.45 * H + 1.1 * H * gone;
      const rx = 0.78 * H;
      const ry = 0.48 * H * (1 - 0.4 * gone);
      const dome = Skia.Path.Make();
      dome.addArc(Skia.XYWHRect(cx - rx, cy - ry, rx * 2, ry * 2), 180, 180);
      dome.close();
      canvas.save();
      canvas.clipPath(dome, ClipOp.Intersect, true);
      faded(P.canopyRed, 1 - gone, () => canvas.drawRect(Skia.XYWHRect(cx - rx, cy - ry, rx * 2, ry), P.canopyRed));
      for (let i = 0; i < 3; i++) {
        faded(P.canopyWhite, 1 - gone, () =>
          canvas.drawRect(Skia.XYWHRect(cx - rx + rx * (0.4 + i * 0.66), cy - ry, rx * 0.34, ry), P.canopyWhite)
        );
      }
      canvas.restore();
      // Lines from the canopy's edges and middle down to each hand.
      for (const hx of [-0.14 * H, 0.14 * H]) {
        for (const ex of [-rx, 0, rx]) {
          faded(P.chuteLine, 1 - gone, () => canvas.drawLine(cx + ex, cy, st.x + hx, st.y - 0.62 * H, P.chuteLine));
        }
      }
    }
  } else if (kind === 'portal') {
    // A glowing ring turning on the block, sparkles rising from it, closing as they step out.
    const open = sm(t / 0.4) * (1 - sm((t - 1.6) / 0.35));
    if (open > 0) {
      const rx = 0.5 * H * open;
      const ry = 0.13 * H * open;
      oval(0, 0, rx * 1.35, ry * 1.6, P.portalGlow);
      oval(0, 0, rx * 1.15, ry * 1.3, P.portalGlow);
      canvas.drawOval(Skia.XYWHRect(-rx, -ry, rx * 2, ry * 2), P.portalLine);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + t * 2.2;
        canvas.drawLine(
          Math.cos(a) * rx * 0.82,
          Math.sin(a) * ry * 0.82,
          Math.cos(a) * rx * 1.12,
          Math.sin(a) * ry * 1.12,
          P.portalLine
        );
      }
      for (let i = 0; i < 14; i++) {
        const life = (t * 0.8 + hash(i * 2.9)) % 1;
        const a = hash(i * 1.3) * Math.PI * 2;
        faded(P.flameCore, open * (1 - life), () =>
          circle(Math.cos(a) * rx * 0.8, Math.sin(a) * ry * 0.8 - life * 0.9 * H, 0.025 * H, P.flameCore)
        );
      }
    }
  } else if (kind === 'horseride') {
    // Gone once the entrance is over (it has galloped off screen).
    if (t >= ENTRANCE_SECONDS.horseride - 0.001) return;
    const hx = horseX(t, H);
    const k = HORSE_UNIT * H;
    const leap = horseLeap(t);
    // Its shadow on the floor, shrinking while it's in the air.
    oval(hx, g, 11 * k * (1 - 0.3 * leap), 1.4 * k, P.groundShadow);
    // Dust kicked up behind the hind hooves: each puff stays where it was kicked up, then spreads and fades.
    for (let i = 0; i < 6; i++) {
      const life = (t * 3 + i / 6) % 1;
      const born = t - life / 3;
      if (born < 0 || horseLeap(born) > 0.2) continue;
      const bx = horseX(born, H) - 4.5 * k;
      faded(P.dust, 1 - life, () => circle(bx - life * 0.15 * H, g - (0.03 + 0.08 * life) * H, (0.04 + 0.08 * life) * H, P.dust));
    }
    drawRideHorse(canvas, P, t, H, g, hx);
    // Dust where the horse lands from its leap, and where the character lands on the block.
    const down = HORSE_LEAP.start + HORSE_LEAP.length;
    if (t > down && t < down + 0.3) dustBurst(horseX(down, H), g, (t - down) / 0.3, H);
    if (t > 2.28 && t < 2.53) dustBurst(0, 0, (t - 2.28) / 0.25, H * 0.8);
  } else if (kind === 'carpet') {
    if (t >= CARPET.gone) return;
    const c = carpetPos(t, H);
    // Glitter shed by the carpet as it goes, flickering about its underside.
    for (let i = 0; i < 8; i++) {
      const seed = i * 7.3 + Math.floor(t * 20);
      const fade = 1 - i / 8;
      faded(P.sparkle, fade, () =>
        circle(
          c.x + (hash(seed) - 0.5) * CARPET_LENGTH * H,
          c.y + (0.06 + 0.08 * hash(seed + 1.7)) * H,
          0.02 * H * fade,
          P.sparkle
        )
      );
    }
    drawCarpet(canvas, P, t, H, c.x, c.y);
    if (t > CARPET.land && t < CARPET.land + 0.25) dustBurst(0, 0, (t - CARPET.land) / 0.25, H * 0.7);
  } else if (kind === 'ufo') {
    if (t >= UFO.gone) return;
    const u = ufoPos(t, H);
    drawUfo(canvas, P, t, H, u.x, u.y, ufoBeam(t));
    if (t > UFO.touchdown && t < UFO.touchdown + 0.3) dustBurst(0, 0, (t - UFO.touchdown) / 0.3, H * 0.6);
  } else if (kind === 'zipline') {
    if (t >= ZIP.gone) return;
    drawZipline(canvas, P, t, H);
    if (t > ZIP.land && t < ZIP.land + 0.25) dustBurst(0, 0, (t - ZIP.land) / 0.25, H * 0.8);
  } else {
    // Gone once the entrance is over (it has driven off screen).
    if (t >= ENTRANCE_SECONDS.cars - 0.001) return;
    // The car pulls in under the spot, takes the bounces, then drives off. Its suspension is
    // exaggerated: it hops and rocks on the road, and sags hard when landed on.
    const cx = carX(t, W);
    const squash = carSquash(t);
    const speed = Math.abs(carX(t + 0.03, W) - carX(t - 0.03, W)) / 0.06;
    const amp = Math.min(1, speed / (0.5 * W));
    const L = CAR_LENGTH * H;
    const top = CAR_HEIGHT * H * (1 - 0.2 * squash);
    const wheel = 0.1 * H;
    const hop = (phase: number) => amp * 0.06 * H * Math.abs(Math.sin(t * 22 + phase));
    canvas.save();
    canvas.translate(cx, g);
    // The body bounces and rocks over the wheels.
    canvas.translate(0, -hop(0.6) - 0.01 * H);
    canvas.rotate(amp * 3 * Math.sin(t * 17), 0, -top * 0.4);
    const body = Skia.RRectXY(Skia.XYWHRect(-L / 2, -top * 0.62, L, top * 0.46), 0.1 * H, 0.1 * H);
    canvas.drawRRect(body, P.carBody);
    const cabin = Skia.Path.Make();
    cabin.moveTo(-L * 0.3, -top * 0.6);
    cabin.lineTo(-L * 0.2, -top);
    cabin.lineTo(L * 0.2, -top);
    cabin.lineTo(L * 0.34, -top * 0.6);
    cabin.close();
    canvas.drawPath(cabin, P.carBody);
    const glass = Skia.Path.Make();
    glass.moveTo(-L * 0.25, -top * 0.64);
    glass.lineTo(-L * 0.17, -top * 0.94);
    glass.lineTo(L * 0.17, -top * 0.94);
    glass.lineTo(L * 0.29, -top * 0.64);
    glass.close();
    canvas.drawPath(glass, P.carGlass);
    canvas.drawRect(Skia.XYWHRect(-L / 2, -top * 0.28, L, top * 0.1), P.carDark);
    circle(L * 0.46, -top * 0.42, 0.04 * H, P.carLight);
    canvas.restore();
    // Wheels hop on their own (front and back out of step) and squash flat under a landing.
    canvas.save();
    canvas.translate(cx, g);
    for (const [wx, ph] of [
      [-L * 0.3, 0],
      [L * 0.3, 1.4],
    ] as const) {
      const lift = hop(ph);
      const rx = wheel * (1 + 0.25 * squash);
      const ry = wheel * (1 - 0.3 * squash);
      const wy = -ry - lift;
      oval(wx, wy, rx, ry, P.carTyre);
      oval(wx, wy, rx * 0.5, ry * 0.5, P.carHub);
      const a = cx / wheel;
      canvas.drawLine(
        wx - Math.cos(a) * rx * 0.5,
        wy - Math.sin(a) * ry * 0.5,
        wx + Math.cos(a) * rx * 0.5,
        wy + Math.sin(a) * ry * 0.5,
        P.carTyre
      );
    }
    canvas.restore();
    if (t > 2.35 && t < 2.6) dustBurst(0, 0, (t - 2.35) / 0.25, H * 0.8);
  }
}
