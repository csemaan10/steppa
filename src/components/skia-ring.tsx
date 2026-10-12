// The styled progress rings (all but Classic), drawn with Skia: one circle path trimmed to the
// progress, so the stroke style, dashes, gradient or glow come straight from Skia; for the trail
// styles, a ring of prints or shapes (paws, hoofprints, stars, hearts); or the race track with its
// car, and the lantern ring that charges up green.

import {
  BlurMask,
  Canvas,
  Circle,
  DashPathEffect,
  Group,
  interpolateColors,
  Path,
  Picture,
  Skia,
  SweepGradient,
  vec,
  type SkCanvas,
  type SkPaint,
  type SkPath,
} from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

import { CAT_COATS, shade } from '@/components/character/scene-common';
import type { RingCat, RingStyle } from '@/lib/ring-style';

type Props = {
  style: Exclude<RingStyle, 'classic'>;
  /** First lap and overflow lap, each 0 → 1. */
  lap1: SharedValue<number>;
  lap2: SharedValue<number>;
  size: number;
  stroke: number;
  color: string;
  overflowColor: string;
  trackColor: string;
  /** The cat on the Cat paws ring. */
  cat: RingCat;
};

type Trail = 'cat' | 'dog' | 'horse' | 'stars' | 'hearts';
const TRAILS: readonly string[] = ['cat', 'dog', 'horse', 'stars', 'hearts'] satisfies Trail[];

/** Trail styles with a face walking at the front. */
type Pet = 'cat' | 'dog' | 'horse';

export function SkiaRing(props: Props) {
  const { style, ...rest } = props;
  if (style === 'racecar') return <RaceRing {...rest} />;
  if (style === 'lantern') return <LanternRing {...rest} />;
  return TRAILS.includes(style) ? <TrailRing kind={style as Trail} {...rest} /> : <StrokeRing {...props} />;
}

/** A circle of radius `r` about (c, c), starting at 3 o'clock (a group turns it to start at the top). */
function useCircle(c: number, r: number) {
  return useMemo(() => {
    const p = Skia.Path.Make();
    p.addArc(Skia.XYWHRect(c - r, c - r, r * 2, r * 2), 0, 359.9);
    return p;
  }, [c, r]);
}

const TURN = [{ rotate: -Math.PI / 2 }];

const RACE = { asphalt: '#3A3D42', kerbRed: '#E53935', kerbWhite: '#FFFFFF', dark: '#1E1E1E', helmet: '#FDD835' };

/**
 * A race track (asphalt between red and white kerbs, a chequered start line at the top) with a
 * top-down race car going round it clockwise as the steps add up, its racing line behind it. Past
 * the goal the car and the line take the accent colour for the second lap.
 */
function RaceRing({ lap1, lap2, size, stroke, color, overflowColor }: Omit<Props, 'style'>) {
  const track = stroke * 1.6;
  const kerb = track * 0.13;
  const r = (size - track) / 2;
  const c = size / 2;
  const origin = vec(c, c);
  const middle = useCircle(c, r);
  const outerKerb = useCircle(c, r + track / 2 - kerb / 2);
  const innerKerb = useCircle(c, r - track / 2 + kerb / 2);
  // Red and white blocks about two kerb-widths long round each edge.
  const dashOuter = (2 * Math.PI * (r + track / 2)) / Math.max(8, Math.round((2 * Math.PI * (r + track / 2)) / (kerb * 4.4)));
  const dashInner = (2 * Math.PI * (r - track / 2)) / Math.max(8, Math.round((2 * Math.PI * (r - track / 2)) / (kerb * 4.4)));

  // The chequered start line across the track at the top: two columns of black and white squares.
  const start = useMemo(() => {
    const rows = 4;
    const q = (track - kerb * 2) / rows;
    const top = c - r - track / 2 + kerb;
    const white = Skia.Path.Make();
    const black = Skia.Path.Make();
    white.addRect(Skia.XYWHRect(c - q, top, q * 2, q * rows));
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < 2; col++) {
        if ((row + col) % 2) black.addRect(Skia.XYWHRect(c - q + col * q, top + row * q, q, q));
      }
    }
    return { white, black };
  }, [c, r, track, kerb]);

  // The car, pointing up (-y), a little narrower than the track: wings, wide tyres, a tapered body and the
  // driver's helmet in the cockpit.
  const car = useMemo(() => {
    const k = track * 0.85;
    const tyres = Skia.Path.Make();
    tyres.addRect(Skia.XYWHRect(-0.37 * k, -0.62 * k, 0.16 * k, 0.26 * k));
    tyres.addRect(Skia.XYWHRect(0.21 * k, -0.62 * k, 0.16 * k, 0.26 * k));
    tyres.addRect(Skia.XYWHRect(-0.41 * k, 0.38 * k, 0.2 * k, 0.32 * k));
    tyres.addRect(Skia.XYWHRect(0.21 * k, 0.38 * k, 0.2 * k, 0.32 * k));
    const wings = Skia.Path.Make();
    wings.addRect(Skia.XYWHRect(-0.34 * k, -0.95 * k, 0.68 * k, 0.1 * k));
    wings.addRect(Skia.XYWHRect(-0.32 * k, 0.78 * k, 0.64 * k, 0.14 * k));
    const body = Skia.Path.Make();
    body.moveTo(0, -0.9 * k);
    body.lineTo(0.07 * k, -0.5 * k);
    body.lineTo(0.16 * k, -0.1 * k);
    body.lineTo(0.2 * k, 0.15 * k);
    body.lineTo(0.14 * k, 0.6 * k);
    body.lineTo(0.1 * k, 0.84 * k);
    body.lineTo(-0.1 * k, 0.84 * k);
    body.lineTo(-0.14 * k, 0.6 * k);
    body.lineTo(-0.2 * k, 0.15 * k);
    body.lineTo(-0.16 * k, -0.1 * k);
    body.lineTo(-0.07 * k, -0.5 * k);
    body.close();
    // A white stripe down the nose and engine cover, like a livery.
    const stripe = Skia.Path.Make();
    stripe.addRect(Skia.XYWHRect(-0.025 * k, -0.8 * k, 0.05 * k, 1.55 * k));
    return { tyres, wings, body, stripe, outline: 0.06 * k, cockpit: 0.075 * k, helmet: 0.05 * k, cockpitY: 0.02 * k };
  }, [track]);

  // At the front of the racing line (the start line before any steps), facing clockwise round the track.
  const carAt = useDerivedValue(() => {
    const p = lap2.value > 0 ? lap2.value : lap1.value;
    const a = -Math.PI / 2 + p * 2 * Math.PI;
    return [{ translateX: c + r * Math.cos(a) }, { translateY: c + r * Math.sin(a) }, { rotate: a + Math.PI }];
  });
  const carColor = useDerivedValue(() => (lap2.value > 0 ? overflowColor : color));

  return (
    <Canvas style={{ width: size, height: size }}>
      <Group transform={TURN} origin={origin}>
        <Path path={middle} style="stroke" strokeWidth={track} color={RACE.asphalt} />
        <Path path={outerKerb} style="stroke" strokeWidth={kerb} color={RACE.kerbWhite} />
        <Path path={innerKerb} style="stroke" strokeWidth={kerb} color={RACE.kerbWhite} />
        <Path path={outerKerb} style="stroke" strokeWidth={kerb} color={RACE.kerbRed}>
          <DashPathEffect intervals={[dashOuter / 2, dashOuter / 2]} />
        </Path>
        <Path path={innerKerb} style="stroke" strokeWidth={kerb} color={RACE.kerbRed}>
          <DashPathEffect intervals={[dashInner / 2, dashInner / 2]} />
        </Path>
      </Group>
      <Path path={start.white} color={RACE.kerbWhite} />
      <Path path={start.black} color={RACE.dark} />
      <Group transform={TURN} origin={origin}>
        <Path path={middle} style="stroke" strokeWidth={track * 0.2} strokeCap="round" color={color} opacity={0.55} end={lap1} />
        <Path path={middle} style="stroke" strokeWidth={track * 0.2} strokeCap="round" color={overflowColor} opacity={0.7} end={lap2} />
      </Group>
      <Group transform={carAt}>
        <Path path={car.tyres} color={RACE.dark} />
        <Path path={car.wings} color={RACE.dark} />
        <Path path={car.body} style="stroke" strokeWidth={car.outline} strokeJoin="round" color={RACE.kerbWhite} />
        <Path path={car.body} color={carColor} />
        <Path path={car.stripe} color={RACE.kerbWhite} />
        <Circle cx={0} cy={car.cockpitY} r={car.cockpit} color={RACE.dark} />
        <Circle cx={0} cy={car.cockpitY} r={car.helmet} color={RACE.helmet} />
      </Group>
    </Canvas>
  );
}

const LANTERN = {
  dim: '#1F4A2E',
  charged: '#2E7D32',
  bright: '#00E676',
  core: '#CCFFE0',
  over: '#B9F6CA',
};

/**
 * A ring of green light that charges up with the steps: from a dim, nearly black band to a vivid
 * green one in a glow that grows brighter and wider, the bright arc and its white-hot core showing
 * the progress exactly. Past the goal it keeps intensifying. Always green, whatever the ring colour.
 */
function LanternRing({ lap1, lap2, size, stroke }: Omit<Props, 'style'>) {
  // The glow spreads well past the ring, so the canvas hangs over the edges.
  const bleed = Math.ceil(stroke * 2.6);
  const r = (size - stroke) / 2;
  const c = size / 2 + bleed;
  const origin = vec(c, c);
  const circle = useCircle(c, r);
  // How charged the ring is: 1 at the goal, up to 1.5 at twice the goal.
  const charge = useDerivedValue(() => lap1.value + 0.5 * lap2.value);
  const band = useDerivedValue(() => interpolateColors(Math.min(1, charge.value), [0, 1], [LANTERN.dim, LANTERN.charged]));
  const glow = useDerivedValue(() => interpolateColors(Math.min(1, charge.value), [0, 1], [LANTERN.charged, LANTERN.bright]));
  const glowOpacity = useDerivedValue(() => 0.1 + 0.55 * charge.value);
  const glowBlur = useDerivedValue(() => stroke * (0.3 + 0.9 * charge.value));

  return (
    <Canvas style={{ position: 'absolute', left: -bleed, top: -bleed, width: size + bleed * 2, height: size + bleed * 2 }}>
      <Group transform={TURN} origin={origin}>
        <Path path={circle} style="stroke" strokeWidth={stroke * 1.7} color={glow} opacity={glowOpacity}>
          <BlurMask blur={glowBlur} style="normal" />
        </Path>
        <Path path={circle} style="stroke" strokeWidth={stroke} color={band} />
        <Path path={circle} style="stroke" strokeWidth={stroke} strokeCap="round" color={LANTERN.bright} end={lap1} />
        <Path path={circle} style="stroke" strokeWidth={stroke * 0.3} strokeCap="round" color={LANTERN.core} end={lap1} />
        <Path path={circle} style="stroke" strokeWidth={stroke} strokeCap="round" color={LANTERN.over} end={lap2} />
        <Path path={circle} style="stroke" strokeWidth={stroke * 0.3} strokeCap="round" color="#FFFFFF" end={lap2} />
      </Group>
    </Canvas>
  );
}

// Back to red at the end, so the round cap at the start (which reaches back past 0°) isn't violet
// and a full lap joins up.
const RAINBOW = ['#E53935', '#FB8C00', '#FDD835', '#43A047', '#00ACC1', '#1E88E5', '#8E24AA', '#E53935'];

/** A stroked ring: thin, segmented, gradient, rainbow, glowing or dotted. */
function StrokeRing({ style, lap1, lap2, size, stroke: baseStroke, color, overflowColor, trackColor }: Props) {
  const stroke = style === 'thin' ? Math.max(3, baseStroke * 0.4) : style === 'dots' ? baseStroke * 0.8 : baseStroke;
  // The glow spreads past the ring, so its canvas is bigger than the ring and hangs over the edges
  // (otherwise the blur is clipped into a hard outline).
  const bleed = style === 'glow' ? Math.ceil(stroke * 2.4) : 0;
  const r = (size - stroke) / 2;
  const c = size / 2 + bleed;
  // A circle starting at 3 o'clock; the group turns it so it starts at the top.
  const circle = useCircle(c, r);
  const circumference = 2 * Math.PI * r;
  const segments = 30;
  const dash =
    style === 'segments'
      ? [circumference / segments - stroke * 0.45, stroke * 0.45]
      : style === 'dots'
        ? [0.01, circumference / 40]
        : null;
  const cap = style === 'segments' ? 'butt' : 'round';
  const effect = dash ? <DashPathEffect intervals={dash} /> : null;
  const origin = vec(c, c);

  return (
    <Canvas
      style={[
        { width: size + bleed * 2, height: size + bleed * 2 },
        bleed > 0 && { position: 'absolute', left: -bleed, top: -bleed },
      ]}>
      <Group transform={TURN} origin={origin}>
        <Path path={circle} style="stroke" strokeWidth={stroke} strokeCap={cap} color={trackColor}>
          {effect}
        </Path>
        {style === 'glow' ? (
          <Path path={circle} style="stroke" strokeWidth={stroke * 1.6} strokeCap="round" color={color} opacity={0.55} end={lap1}>
            <BlurMask blur={stroke * 0.7} style="normal" />
          </Path>
        ) : null}
        <Path path={circle} style="stroke" strokeWidth={stroke} strokeCap={cap} color={color} end={lap1}>
          {style === 'gradient' ? <SweepGradient c={origin} colors={gradientColors(color, overflowColor)} /> : null}
          {style === 'rainbow' ? <SweepGradient c={origin} colors={RAINBOW} /> : null}
          {effect}
        </Path>
        <Path path={circle} style="stroke" strokeWidth={stroke} strokeCap={cap} color={overflowColor} end={lap2}>
          {effect}
        </Path>
      </Group>
    </Canvas>
  );
}

/**
 * Dark shade of the ring colour, the colour, a light tint, then the accent: a clear sweep even when
 * the colour and accent are close. Falls back to colour → accent if the colour isn't #RRGGBB.
 */
function gradientColors(color: string, accent: string): string[] {
  if (!/^#[0-9A-Fa-f]{6}$/.test(color)) return [color, accent];
  return [shade(color, -0.35), color, shade(color, 0.45), accent];
}

function fillPaint(color: string): SkPaint {
  const p = Skia.Paint();
  p.setAntiAlias(true);
  p.setColor(Skia.Color(color));
  return p;
}

/** One paw print centred at the origin, toes pointing up (-y), `k` wide. */
function drawPaw(canvas: SkCanvas, k: number, paint: SkPaint) {
  'worklet';
  canvas.drawOval(Skia.XYWHRect(-0.42 * k, -0.11 * k, 0.84 * k, 0.72 * k), paint);
  canvas.drawCircle(-0.42 * k, -0.28 * k, 0.16 * k, paint);
  canvas.drawCircle(-0.15 * k, -0.48 * k, 0.17 * k, paint);
  canvas.drawCircle(0.15 * k, -0.48 * k, 0.17 * k, paint);
  canvas.drawCircle(0.42 * k, -0.28 * k, 0.16 * k, paint);
}

/** A hoofprint centred at the origin, toe up (-y), `k` wide: a horseshoe open at the heel. */
function hoofPath(k: number): SkPath {
  const p = Skia.Path.Make();
  // Outer edge round the toe, across the open heel, and back along the inner edge.
  p.arcToOval(Skia.XYWHRect(-0.45 * k, -0.52 * k, 0.9 * k, 1.0 * k), 125, 290, true);
  p.arcToOval(Skia.XYWHRect(-0.27 * k, -0.34 * k, 0.54 * k, 0.64 * k), 55, -290, false);
  p.close();
  return p;
}

/** A five-point star centred at the origin, `k` wide. */
function starPath(k: number): SkPath {
  const p = Skia.Path.Make();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = (i % 2 ? 0.24 : 0.56) * k;
    if (i === 0) p.moveTo(r * Math.cos(a), r * Math.sin(a));
    else p.lineTo(r * Math.cos(a), r * Math.sin(a));
  }
  p.close();
  return p;
}

/** A heart centred at the origin, point down (+y), `k` wide. */
function heartPath(k: number): SkPath {
  const p = Skia.Path.Make();
  p.moveTo(0, -0.2 * k);
  p.cubicTo(0.1 * k, -0.45 * k, 0.5 * k, -0.45 * k, 0.5 * k, -0.12 * k);
  p.cubicTo(0.5 * k, 0.12 * k, 0.2 * k, 0.28 * k, 0, 0.45 * k);
  p.cubicTo(-0.2 * k, 0.28 * k, -0.5 * k, 0.12 * k, -0.5 * k, -0.12 * k);
  p.cubicTo(-0.5 * k, -0.45 * k, -0.1 * k, -0.45 * k, 0, -0.2 * k);
  p.close();
  return p;
}

/** Print size (× the stroke), spacing (× the print) and in/out stagger (× the print) per trail. */
const TRAIL_LAYOUT: Record<Trail, { size: number; gap: number; stagger: number }> = {
  cat: { size: 1.05, gap: 1.15, stagger: 0.14 },
  dog: { size: 1.25, gap: 1.15, stagger: 0.14 },
  horse: { size: 1.15, gap: 1.2, stagger: 0.14 },
  stars: { size: 1.1, gap: 1.25, stagger: 0 },
  hearts: { size: 1.05, gap: 1.25, stagger: 0 },
};

/** The faces' colours; the cat's come from its coat (see faceColors). */
const FACE_COLORS: Record<Exclude<Pet, 'cat'>, { head: string; ear: string; nose: string }> = {
  dog: { head: '#D9A441', ear: '#9C6B22', nose: '#222222' },
  horse: { head: '#9A6235', ear: '#9A6235', nose: '#222222' },
};

function faceColors(pet: Pet | null, cat: RingCat) {
  if (pet !== 'cat') return { ...FACE_COLORS[pet ?? 'dog'], eye: '#222222', stripes: null };
  const coat = CAT_COATS[cat];
  return {
    head: coat.base,
    ear: coat.base,
    nose: '#D98A94',
    // Dark eyes, except on the black coat where they'd vanish: its own yellow eyes, as on the pet.
    eye: cat === 'blackcat' ? coat.eye : '#222222',
    stripes: coat.stripes ? coat.dark : null,
  };
}

type TrailProps = Omit<Props, 'style'> & { kind: Trail };

/**
 * A trail of prints round the ring that fill in with progress: paw or hoof prints stepping a little
 * in and out (left, right, left, ...), or a ring of stars or hearts. The pet trails also have the
 * pet's face walking at the front.
 */
function TrailRing({ kind, lap1, lap2, size, stroke, color, overflowColor, trackColor, cat }: TrailProps) {
  const layout = TRAIL_LAYOUT[kind];
  const paw = stroke * layout.size;
  const stagger = layout.stagger;
  // Prints (toes, the left/right stagger) and the pet's ears reach about 0.8 of a paw past the ring
  // line: bring the ring in a little and let the canvas hang over the edges for the rest.
  const bleed = Math.ceil(paw * 0.4);
  const r = size / 2 - paw * 0.7;
  const c = size / 2 + bleed;
  const count = Math.max(10, Math.floor((2 * Math.PI * r) / (paw * layout.gap)));
  // Paws are drawn piece by piece; the other prints are one path.
  const shape = useMemo(
    () => (kind === 'horse' ? hoofPath(paw) : kind === 'stars' ? starPath(paw) : kind === 'hearts' ? heartPath(paw) : null),
    [kind, paw]
  );
  const pet: Pet | null = kind === 'cat' || kind === 'dog' || kind === 'horse' ? kind : null;
  const kit = useMemo(() => {
    const face = faceColors(pet, cat);
    return {
      done: fillPaint(color),
      over: fillPaint(overflowColor),
      todo: fillPaint(trackColor),
      head: fillPaint(face.head),
      ear: fillPaint(face.ear),
      dark: fillPaint('#222222'),
      nose: fillPaint(face.nose),
      eye: fillPaint(face.eye),
      stripe: face.stripes ? fillPaint(face.stripes) : null,
      mane: fillPaint('#4A2C14'),
      muzzle: fillPaint('#C9A27A'),
      blaze: fillPaint('#FFFFFF'),
    };
  }, [color, overflowColor, trackColor, pet, cat]);

  const picture = useDerivedValue(() => {
    const recorder = Skia.PictureRecorder();
    const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, size + bleed * 2, size + bleed * 2));
    const p1 = lap1.value;
    const p2 = lap2.value;
    for (let i = 0; i < count; i++) {
      // Clockwise from the top, each print turned to face out from the ring, stepping a little in
      // and out like left and right feet.
      const a = -Math.PI / 2 + ((i + 0.5) / count) * 2 * Math.PI;
      const rr = r + (i % 2 ? -1 : 1) * paw * stagger;
      const at = (i + 0.5) / count;
      const paint = at <= p2 ? kit.over : at <= p1 ? kit.done : kit.todo;
      canvas.save();
      canvas.translate(c + rr * Math.cos(a), c + rr * Math.sin(a));
      canvas.rotate(((a + Math.PI / 2) * 180) / Math.PI, 0, 0);
      if (shape) canvas.drawPath(shape, paint);
      else drawPaw(canvas, paw, paint);
      canvas.restore();
    }
    // The pet's face at the front of the trail, once it has started.
    const tip = p2 > 0 ? p2 : p1;
    if (pet && tip > 0.001) {
      const a = -Math.PI / 2 + tip * 2 * Math.PI;
      const h = paw * 0.62;
      canvas.save();
      canvas.translate(c + r * Math.cos(a), c + r * Math.sin(a));
      if (pet === 'horse') {
        // A long face: pointed ears, forelock, white blaze and a pale muzzle with nostrils.
        const ear = Skia.Path.Make();
        ear.moveTo(-h * 0.62, -h * 0.55);
        ear.lineTo(-h * 0.52, -h * 1.28);
        ear.lineTo(-h * 0.18, -h * 0.78);
        ear.close();
        ear.moveTo(h * 0.62, -h * 0.55);
        ear.lineTo(h * 0.52, -h * 1.28);
        ear.lineTo(h * 0.18, -h * 0.78);
        ear.close();
        canvas.drawPath(ear, kit.ear);
        canvas.drawOval(Skia.XYWHRect(-h * 0.7, -h * 0.95, h * 1.4, h * 1.85), kit.head);
        canvas.drawOval(Skia.XYWHRect(-h * 0.26, -h * 1.05, h * 0.52, h * 0.45), kit.mane);
        canvas.drawOval(Skia.XYWHRect(-h * 0.1, -h * 0.55, h * 0.2, h * 0.75), kit.blaze);
        canvas.drawOval(Skia.XYWHRect(-h * 0.55, h * 0.3, h * 1.1, h * 0.62), kit.muzzle);
        canvas.drawOval(Skia.XYWHRect(-h * 0.32, h * 0.5, h * 0.16, h * 0.2), kit.dark);
        canvas.drawOval(Skia.XYWHRect(h * 0.16, h * 0.5, h * 0.16, h * 0.2), kit.dark);
        canvas.drawCircle(-h * 0.42, -h * 0.15, h * 0.12, kit.dark);
        canvas.drawCircle(h * 0.42, -h * 0.15, h * 0.12, kit.dark);
      } else {
        if (pet === 'cat') {
          const ear = Skia.Path.Make();
          ear.moveTo(-h * 0.95, -h * 0.25);
          ear.lineTo(-h * 0.7, -h * 1.25);
          ear.lineTo(-h * 0.15, -h * 0.8);
          ear.close();
          ear.moveTo(h * 0.95, -h * 0.25);
          ear.lineTo(h * 0.7, -h * 1.25);
          ear.lineTo(h * 0.15, -h * 0.8);
          ear.close();
          canvas.drawPath(ear, kit.ear);
        } else {
          canvas.drawOval(Skia.XYWHRect(-h * 1.25, -h * 0.75, h * 0.6, h * 1.3), kit.ear);
          canvas.drawOval(Skia.XYWHRect(h * 0.65, -h * 0.75, h * 0.6, h * 1.3), kit.ear);
        }
        canvas.drawCircle(0, 0, h, kit.head);
        // Tabby and ginger: three stripes on the forehead.
        if (kit.stripe) {
          for (const x of [-0.28, 0, 0.28]) {
            canvas.drawOval(Skia.XYWHRect(h * (x - 0.06), -h * 0.92, h * 0.12, h * 0.36), kit.stripe);
          }
        }
        canvas.drawCircle(-h * 0.38, -h * 0.12, h * 0.13, kit.eye);
        canvas.drawCircle(h * 0.38, -h * 0.12, h * 0.13, kit.eye);
        canvas.drawOval(Skia.XYWHRect(-h * 0.16, h * 0.18, h * 0.32, h * 0.22), kit.nose);
      }
      canvas.restore();
    }
    return recorder.finishRecordingAsPicture();
  });

  return (
    <Canvas style={{ position: 'absolute', left: -bleed, top: -bleed, width: size + bleed * 2, height: size + bleed * 2 }}>
      <Picture picture={picture} />
    </Canvas>
  );
}
