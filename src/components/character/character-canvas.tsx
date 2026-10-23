// Draws a player's podium character with Skia. Each frame one worklet draws the whole scene
// (character, props, pets) into a single Skia picture shown by one <Picture>: cheap to mount and
// to update, so many characters can animate at once.
//
// Accessories (glasses, beards, chest patterns, watches, the parrot, the skateboard) are fixed
// shapes parsed once and drawn by moving the canvas to where the rig says they are this frame,
// so they cost almost nothing per frame.

import {
  Canvas,
  Picture,
  PaintStyle,
  ClipOp,
  PathOp,
  Skia,
  StrokeCap,
  StrokeJoin,
  type SkCanvas,
  type SkPaint,
  type SkPath,
} from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

import { BIRD_COATS, CAT_COATS, DOG_COATS, HORSE_COAT, MEDAL_COLORS, shade, useSceneClock } from '@/components/character/scene-common';
import {
  CAT_X,
  DOG_X,
  HORSE_BODY,
  HORSE_X,
  YARN_BALL,
  ballRadius,
  sceneFrame,
  type Frame,
  type Motion,
  type RigLook,
} from '@/components/character/rig';
import { CATS, DOGS, isBird, isSmallPet, type CharacterLook, type Pet } from '@/lib/character';

/**
 * Paints are shared by every character: drawing only ever changes a paint's alpha for a moment and
 * puts it back, so a new look or move (e.g. entrance → cheer → idle) only makes paints it hasn't
 * seen yet. Never change a paint from here after making it.
 */
const paintCache = new Map<string, SkPaint>();

/** A fill paint, or a stroke paint of the given width (round caps unless given). */
function makePaint(color: string, stroke?: number, alpha = 1, cap: StrokeCap = StrokeCap.Round): SkPaint {
  const key = `${color}|${stroke ?? 0}|${alpha}|${cap}`;
  const cached = paintCache.get(key);
  if (cached) return cached;
  const p = Skia.Paint();
  p.setAntiAlias(true);
  p.setColor(Skia.Color(color));
  p.setAlphaf(alpha);
  if (stroke) {
    p.setStyle(PaintStyle.Stroke);
    p.setStrokeWidth(stroke);
    p.setStrokeCap(cap);
    p.setStrokeJoin(StrokeJoin.Round);
  }
  paintCache.set(key, p);
  return p;
}

function parse(d: string): SkPath {
  return Skia.Path.MakeFromSVGString(d) ?? Skia.Path.Make();
}

function circle(x: number, y: number, r: number): string {
  return `M${x - r} ${y}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0`;
}

function starPath(r: number): string {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    d += `${i ? 'L' : 'M'}${(Math.cos(a) * rr).toFixed(2)} ${(Math.sin(a) * rr).toFixed(2)}`;
  }
  return d + 'Z';
}

/** Both lenses of a pair: `side` is -1 (left) or 1 (right). */
function pair(lens: (side: number) => string): string {
  return lens(-1) + lens(1);
}

const GLASSES_ARMS = 'M-0.9 0.2Q0 -0.3 0.9 0.2M-5.3 -0.1L-8.3 -0.6M5.3 -0.1L8.3 -0.6';

// Fixed shapes, parsed once.
const STATIC = {
  catBody: 'M-4.6 0Q-6.3 -7.5 0 -10.4Q6.3 -7.5 4.6 0Z',
  catEarL: 'M-4.1 -14.1L-3.6 -19.4L-0.9 -16.3Z',
  catEarR: 'M4.1 -14.1L3.6 -19.4L0.9 -16.3Z',
  catInnerL: 'M-3.5 -15L-3.3 -17.9L-1.8 -16.3Z',
  catInnerR: 'M3.5 -15L3.3 -17.9L1.8 -16.3Z',
  catNose: 'M-0.55 -11.9L0.55 -11.9L0 -11.3Z',
  catStripes: 'M-1.2 -17.1L-0.9 -15.6M0 -17.4L0 -15.8M1.2 -17.1L0.9 -15.6M-4 -6L-2.3 -6.3M-4.3 -3.6L-2.6 -3.8M4 -6L2.3 -6.3M4.3 -3.6L2.6 -3.8',
  dogBody: 'M-5.2 0Q-7.2 -8.5 0 -12.2Q7.2 -8.5 5.2 0Z',
  dogBlaze: 'M-0.9 -20.4Q0 -21 0.9 -20.4L1.5 -15.2L-1.5 -15.2Z',
  horseBody: HORSE_BODY,
  horseFarLegs: 'M-4 -9.6L-3.9 -0.7M6.4 -9.6L6.6 -0.7',
  horseNearBackLeg: 'M4.6 -9.6L4.8 -0.7',
  yarnLines: `M${YARN_BALL.x - 2.2} ${YARN_BALL.y - 1}Q${YARN_BALL.x} ${YARN_BALL.y + 0.8} ${YARN_BALL.x + 2.2} ${YARN_BALL.y - 1}M${YARN_BALL.x - 1.2} ${YARN_BALL.y - 2.3}Q${YARN_BALL.x + 0.6} ${YARN_BALL.y} ${YARN_BALL.x + 0.4} ${YARN_BALL.y + 2.6}`,
  // Face extras, in the head's frame: origin at its centre, eyes at (±3, 0.6), mouth at y ≈ 3.9.
  glassesRound: `${circle(-3, 0.6, 2.1)}${circle(3, 0.6, 2.1)}M-0.9 0.3Q0 -0.3 0.9 0.3M-5.1 0.2L-8.3 -0.5M5.1 0.2L8.3 -0.5`,
  shadesLenses: 'M-5.5 -0.7H-0.8Q-0.8 2.7 -3.15 2.7Q-5.5 2.7 -5.5 -0.7ZM0.8 -0.7H5.5Q5.5 2.7 3.15 2.7Q0.8 2.7 0.8 -0.7Z',
  shadesFrame: 'M-0.8 -0.4H0.8M-5.5 -0.5L-8.3 -0.9M5.5 -0.5L8.3 -0.9',
  shadesShine: 'M-4.6 0.1L-3.6 -0.3M1.7 0.1L2.7 -0.3',
  glassesSquare: pair((s) => `M${s * 0.9} -1.3H${s * 5.4}V2.3H${s * 0.9}Z`) + GLASSES_ARMS,
  glassesCateye:
    pair((s) => `M${s * 0.9} -0.6Q${s * 3} -0.9 ${s * 5.4} -1.2L${s * 6.3} -2.1Q${s * 5.9} 0.2 ${s * 5.2} 1.4Q${s * 3.6} 2.8 ${s * 2} 2.4Q${s * 0.8} 1.8 ${s * 0.9} -0.6Z`) +
    GLASSES_ARMS,
  aviatorLenses: pair((s) => `M${s * 0.8} -0.9H${s * 5.4}Q${s * 5.7} 2.6 ${s * 3.4} 3Q${s * 1} 2.9 ${s * 0.8} -0.9Z`),
  aviatorFrame: 'M-5.4 -0.9H5.4' + GLASSES_ARMS,
  heartLenses: pair(
    (s) =>
      `M${s * 3} 2.6C${s * 3 - 2.9} 0.8 ${s * 3 - 2.3} -1.6 ${s * 3 - 1} -1.6C${s * 3 - 0.3} -1.6 ${s * 3} -1.1 ${s * 3} -0.8C${s * 3} -1.1 ${s * 3 + 0.3} -1.6 ${s * 3 + 1} -1.6C${s * 3 + 2.3} -1.6 ${s * 3 + 2.9} 0.8 ${s * 3} 2.6Z`
  ),
  heartFrame: GLASSES_ARMS,
  // The beard runs from the sideburns round the jaw and up over the top lip, around the mouth.
  beard: 'M-8 0.4Q-8.3 8.6 0 9.6Q8.3 8.6 8 0.4Q7.6 3.9 4.6 3Q2.2 2.2 0 2.6Q-2.2 2.2 -4.6 3Q-7.6 3.9 -8 0.4Z',
  // Bare skin around the mouth inside a beard, so the mouth shows even on a black beard.
  mouthPatch: 'M-3.3 4.1Q-3.2 3.2 0 3.3Q3.2 3.2 3.3 4.1Q3.2 6.9 0 7.1Q-3.2 6.9 -3.3 4.1Z',
  // Sits on the top lip, just touching the mouth.
  moustache: 'M-3.2 3.1Q-1.6 1.9 0 2.8Q1.6 1.9 3.2 3.1Q1.6 4 0 3.5Q-1.6 4 -3.2 3.1Z',
  // Moustache joined down both sides of the mouth to the chin.
  goatee: 'M-3.4 2.7Q-1.6 1.5 0 2.3Q1.6 1.5 3.4 2.7Q3.7 6.1 2.4 8.1Q0 9.5 -2.4 8.1Q-3.7 6.1 -3.4 2.7Z',
  // A separate tuft on the chin, under the mouth (worn with the moustache).
  chinTuft: 'M-2.76 6.85Q0 6.09 2.76 6.85Q2.5 8.15 0 8.5Q-2.5 8.15 -2.76 6.85Z',
  freckles: [[-5, 2.2], [-4, 2.8], [-5.3, 3.4], [5, 2.2], [4, 2.8], [5.3, 3.4]].map(([x, y]) => circle(x!, y!, 0.3)).join(''),
  oh: circle(0, 4.7, 1.1),
  // Chest patterns, centred on the chest.
  stripes: 'M-5 -2H5M-5 1.4H5',
  heart: 'M0 2.2C-3.6 -0.2 -2.8 -3 -1.2 -3C-0.4 -3 0 -2.4 0 -2C0 -2.4 0.4 -3 1.2 -3C2.8 -3 3.6 -0.2 0 2.2Z',
  bolt: 'M0.8 -3.4L-2 0.4H-0.2L-1 3.4L2 -0.6H0.2Z',
  star: starPath(2.6),
  // Watch, in the wrist's frame: x along the forearm, y across it.
  watchStrap: 'M-0.9 -2.1H0.9V2.1H-0.9Z',
  watchCase: 'M-1.5 -1.4H1.5V1.4H-1.5Z',
  watchScreen: 'M-1.1 -1H1.1V1H-1.1Z',
  watchHands: 'M0 0L0 -0.9M0 0L0.6 0',
  watchPill: 'M-0.6 -1.2H0.6V1.2H-0.6Z',
  // Skateboard, centred on the deck.
  boardDeck: 'M-9 -0.6H9Q10 -0.6 10.4 -1.6L10.8 -1.4Q10.4 0.6 9 0.6H-9Q-10.4 0.6 -10.8 -1.4L-10.4 -1.6Q-10 -0.6 -9 -0.6Z',
  boardTrucks: 'M-5.6 0.6V1.4M5.6 0.6V1.4',
  boardWheels: circle(-5.6, 2, 1.05) + circle(5.6, 2, 1.05),
  // Parrot, standing on the shoulder at the origin.
  birdTail: 'M0.6 -0.8L2.6 3L3.4 2.4L1.6 -1Z',
  birdBeak: 'M-2.1 -7Q-3.4 -6.4 -2.4 -5.4L-1.7 -6.2Z',
  birdFeet: 'M-0.6 0L-0.4 -0.9M0.6 0L0.4 -0.9',
  birdCrest: 'M-0.8 -8.1Q-1.2 -11.4 1 -12Q0 -10.2 0.6 -8.2Z',
  // Card throw: a playing card with a diamond, centred.
  card: 'M-1.1 -1.6H1.1V1.6H-1.1Z',
  cardMark: 'M0 -0.9L0.6 0L0 0.9L-0.6 0Z',
  // Power construct: a hammer held out from the fist along +x.
  hammerHandle: 'M1 -0.7H17.5V0.7H1Z',
  hammerHead: 'M17 -4.2H25V4.2H17Z',
  hammerShine: 'M18.2 -3.2H23.8V-1.6H18.2ZM2 -0.4H16.5V0H2Z',
  // Power ring: a finger out of the fist along +x, with the band and gem on it.
  finger: 'M0.6 -0.6H3.1Q3.7 -0.6 3.7 0Q3.7 0.6 3.1 0.6H0.6Z',
  ringBand: 'M1.7 -0.78H2.5V0.78H1.7Z',
  // Thunder hammer: a short handle out of the fist along +x, then a block head.
  thunderHandle: 'M0 -0.45H6V0.45H0Z',
  thunderHead: 'M5.2 -2.6H9.4V2.6H5.2Z',
  // Dumbbell held level in a fist: a bar through the hand, a plate at each end.
  dumbbellBar: 'M-3.4 -0.4H3.4V0.4H-3.4Z',
  dumbbellPlates: 'M-4.4 -1.7H-3V1.7H-4.4ZM3 -1.7H4.4V1.7H3Z',
  // Claws: three blades out of the fist along +x.
  claws: 'M1.6 -0.9L8.6 -1.3M1.6 0L9.2 0M1.6 0.9L8.6 1.3',
  // Spell circle marks, centred: twelve ticks between the rings and a star inside.
  spellTicks: Array.from({ length: 12 }, (_, i) => {
    const a = (i * Math.PI) / 6;
    const p = (r: number) => `${(Math.cos(a) * r).toFixed(2)} ${(Math.sin(a) * r).toFixed(2)}`;
    return `M${p(6.9)}L${p(8.4)}`;
  }).join(''),
  spellStar: starPath(5.2),
};

type Props = {
  look: CharacterLook;
  seed: number;
  /** Rendered width in points; height is half. The character is as tall as the height. */
  width?: number;
  animate?: boolean;
  fps?: number;
  /** Plays this move instead of the player's chosen idle (e.g. 'sad' off the podium). */
  motion?: Motion;
  /** Hangs a medal on the chest: 0 gold, 1 silver, 2 bronze. */
  medal?: number;
  /** Drives the pose from this clock (seconds) instead of the running one, e.g. for entrances. */
  clock?: SharedValue<number>;
};

/** A player's animated character, ball or other move props, and pets, drawn with Skia as one picture per frame. */
export function CharacterCanvas({ look, seed, width = 88, animate = true, fps = 60, motion, medal, clock }: Props) {
  const own = useSceneClock(animate && !clock, fps);
  const time = clock ?? own;
  const idle = motion ?? look.idle;
  // Pets wait until the entrance is over, then join in.
  const entering = idle.startsWith('e-');
  const shown = useMemo(() => (entering ? { ...look, pets: [] } : look), [look, entering]);
  const rigLook = useMemo<RigLook>(
    () => ({
      hair: look.hair,
      top: look.top,
      bottom: look.bottom,
      topFit: look.topFit,
      bottomFit: look.bottomFit,
      expression: look.expression,
      idle,
      pets: entering ? [] : look.pets,
    }),
    [look.hair, look.top, look.bottom, look.topFit, look.bottomFit, look.expression, idle, look.pets, entering]
  );

  const kit = useMemo(() => makeKit(shown, idle, medal), [shown, idle, medal]);

  const scale = width / 120;
  const picture = useDerivedValue(() => {
    const F = sceneFrame(rigLook, time.value, seed);
    const recorder = Skia.PictureRecorder();
    const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, width, width / 2));
    // Map the rig's 120 × 60 box (x from -30) onto the canvas.
    canvas.translate(30 * scale, 0);
    canvas.scale(scale, scale);
    drawScene(canvas, F, kit);
    return recorder.finishRecordingAsPicture();
  });

  return (
    <Canvas style={{ width, height: width / 2 }}>
      <Picture picture={picture} />
    </Canvas>
  );
}

/** Relative brightness of a #RRGGBB colour, 0 (black) to 1 (white). */
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

type CatPaints = { base: SkPaint; tail: SkPaint; light: SkPaint; chest: SkPaint; inner: SkPaint; eye: SkPaint; pupil: SkPaint; nose: SkPaint; stripes: SkPaint | null };
type SmallPet =
  | { kind: 'cat'; cat: CatPaints }
  | { kind: 'bunny' | 'hamster'; base: SkPaint; light: SkPaint; inner: SkPaint; eye: SkPaint; nose: SkPaint };

/** Everything that doesn't change per frame: which parts exist, their paints, fixed shapes. */
function makeKit(look: CharacterLook, idle: Motion, medal?: number): Kit {
  const medalColors = medal === undefined ? null : MEDAL_COLORS[Math.min(Math.max(medal, 0), 2)]!;
  const { skin, topColor, pantsColor, hairColor } = look;
  const sleeveColor = look.sleeveColor ?? topColor;
  // Long-sleeved tops colour the whole arm; tees and jerseys get short sleeves.
  const longSleeves = look.top === 'hoodie' || look.top === 'longsleeve' || look.top === 'jacket';
  const armColor = longSleeves ? sleeveColor : skin;
  // Baggy clothes are cut wider: the same shapes drawn with fatter strokes.
  const baggyTop = look.topFit === 'baggy';
  // Shorts and skirts leave the legs bare.
  const legColor = look.bottom === 'trousers' ? pantsColor : skin;
  const lightTop = luminance(topColor) > 0.7;
  const contrast = lightTop ? shade(topColor, -0.45) : '#FFFFFF';
  const smalls: SmallPet[] = look.pets.filter(isSmallPet).map((kind): SmallPet => {
    if ((CATS as readonly Pet[]).includes(kind)) {
      const c = CAT_COATS[kind as (typeof CATS)[number]];
      return {
        kind: 'cat',
        cat: {
          base: makePaint(c.base),
          tail: makePaint(c.base, 1.8),
          light: makePaint(c.light),
          chest: makePaint(c.light, undefined, 0.55),
          inner: makePaint('#E8A0A8'),
          eye: makePaint(c.eye),
          pupil: makePaint('#111111'),
          nose: makePaint('#D98A94'),
          stripes: c.stripes ? makePaint(c.dark, 0.6) : null,
        },
      };
    }
    const bunny = kind === 'bunny';
    return {
      kind: bunny ? 'bunny' : 'hamster',
      base: makePaint(bunny ? '#E8E2DA' : '#E0A060'),
      light: makePaint(bunny ? '#FFFFFF' : '#F6DDB8'),
      inner: makePaint('#F2A7B5'),
      eye: makePaint('#222222'),
      nose: makePaint('#E88A9A'),
    };
  });
  const dog = look.pets.find((p): p is (typeof DOGS)[number] => (DOGS as readonly Pet[]).includes(p));
  const basket = idle === 'basket';
  const tennis = idle === 'tennis';
  return {
    idle,
    tee: look.top === 'tee' || look.top === 'jersey',
    baggyTop: look.topFit === 'baggy',
    baggyBottom: look.bottomFit === 'baggy' && look.bottom !== 'skirt',
    top: look.top,
    bottom: look.bottom,
    hoodie: look.top === 'hoodie',
    longHair: look.hair === 'long' || look.hair === 'longcurly' || look.hair === 'afro',
    bald: look.hair === 'bald',
    // Every move whose pose sets armsFront must be here, or its arms are never drawn.
    frontArms:
      idle === 'vbset' || idle === 'basket' || idle === 'yoga' || idle === 'boxing' ||
      idle === 'claws' || idle === 'spell' || idle === 'eyebeam' || idle === 'e-web' ||
      idle === 'p-peace' || idle === 'p-salute' || idle === 'p-crossed',
    ball: ballRadius(idle),
    horse: look.pets.includes('horse'),
    bird: (() => {
      const kind = look.pets.find(isBird);
      return kind ? BIRD_COATS[kind as keyof typeof BIRD_COATS] : null;
    })(),
    glasses: look.glasses,
    facialHair: look.facialHair,
    freckles: look.freckles,
    pattern: look.pattern,
    watch: look.watch,
    medal: medalColors
      ? {
          strapL: makePaint(medalColors.straps[0], 1.5),
          strapR: makePaint(medalColors.straps[1], 1.5),
          rim: makePaint(medalColors.rim),
          disc: makePaint(medalColors.disc),
          shine: makePaint('#FFFFFF', 0.5, 0.7),
        }
      : null,
    paint: {
      shadow: makePaint('#000000', undefined, 0.14),
      hood: makePaint(shade(topColor, -0.18)),
      hair: makePaint(hairColor),
      stubble: makePaint(hairColor, undefined, 0.35),
      legs: makePaint(legColor, 4.2),
      pants: makePaint(pantsColor),
      // Butt caps so the shorts end in a straight, squared-off hem.
      thighs: makePaint(pantsColor, 4.8, 1, StrokeCap.Butt),
      skirt: makePaint(pantsColor),
      stripe: makePaint(contrast, 1.5, 0.9),
      patternLine: makePaint(contrast, 1.3, 0.9),
      patternFill: makePaint(contrast, undefined, 0.92),
      zip: makePaint(shade(topColor, -0.35), 0.7),
      shoes: makePaint(look.shoeColor),
      torso: makePaint(topColor, 11),
      torsoFlow: makePaint(topColor),
      fold: makePaint(shade(topColor, -0.22), 0.5, 0.7),
      arms: makePaint(armColor, longSleeves && baggyTop ? 4.9 : 3.4),
      // A darker rim round arms posed across the body, so a sleeve the colour of the top still shows.
      armEdge: makePaint(shade(armColor, -0.28), (longSleeves && baggyTop ? 4.9 : 3.4) + 1.2),
      biceps: makePaint(armColor),
      sleeves: makePaint(sleeveColor, baggyTop ? 5.6 : 3.9),
      skin: makePaint(skin),
      cheeks: makePaint('#FF6F91', undefined, 0.35),
      freckles: makePaint('#A0522D', undefined, 0.65),
      eyes: makePaint(look.eyeColor),
      mouth: makePaint('#3B1F1F', 0.95),
      mouthFill: makePaint('#3B1F1F'),
      grinFill: makePaint('#FFFFFF'),
      glasses: makePaint('#263238', 0.5),
      shades: makePaint('#1B1B1B'),
      shadesFrame: makePaint('#1B1B1B', 0.5),
      shine: makePaint('#FFFFFF', 0.35, 0.6),
      squareFrame: makePaint('#212121', 0.6),
      cateyeFrame: makePaint('#AD1457', 0.6),
      aviatorTint: makePaint('#6D4C41', undefined, 0.55),
      aviatorFrame: makePaint('#C9A227', 0.4),
      heartLens: makePaint('#FF4D8D', undefined, 0.85),
      watchStrap: makePaint(look.watchColor),
      watchCase: makePaint(look.watch === 'classic' ? '#ECEFF1' : '#111111'),
      watchRim: makePaint('#9E9E9E', 0.35),
      watchScreen: makePaint('#4FC3F7', undefined, 0.9),
      watchHands: makePaint('#333333', 0.25),
      yarn: makePaint('#E5397E'),
      thread: makePaint('#E5397E', 0.5),
      yarnLines: makePaint('#B8205C', 0.45),
      needles: makePaint('#C9B79C', 0.8),
      zzz: makePaint('#7E8CE0', 1.1),
      brows: makePaint('#3B1F1F', 0.8),
      tear: makePaint('#5BB8F5'),
      ballFill: makePaint(tennis ? '#D4E157' : idle === 'soccer' ? '#FFFFFF' : basket ? '#E07A1F' : '#FFFFFF'),
      ballEdge: makePaint(tennis ? '#9E9D24' : idle === 'soccer' ? '#222222' : basket ? '#1A1A1A' : '#1E4FB8', 0.4),
      seams: makePaint(
        tennis ? '#FFFFFF' : idle === 'soccer' ? '#222222' : basket ? '#1A1A1A' : '#F2C200',
        tennis ? 0.4 : idle === 'soccer' ? 0.5 : basket ? 0.45 : 0.9
      ),
      seamsFill: makePaint('#222222'),
      bow: makePaint('#8D5A2B', 1.2),
      bowString: makePaint('#EEEEEE', 0.35),
      arrow: makePaint('#6D4C41', 0.6),
      arrowHead: makePaint('#9E9E9E'),
      fletch: makePaint('#E53935'),
      guitarEdge: makePaint('#9C5A1C', 1),
      guitarBody: makePaint('#E0892E'),
      guitarHole: makePaint('#3E2723'),
      guitarNeck: makePaint('#5D4037', 1.5),
      guitarHead: makePaint('#3E2723', 2.2),
      guitarStrings: makePaint('#ECEFF1', 0.25),
      note: makePaint('#7E57C2'),
      noteStem: makePaint('#7E57C2', 0.6),
      rope: makePaint('#E53935', 0.7),
      board: makePaint(shade(topColor, -0.15)),
      boardTrucks: makePaint('#90A4AE', 0.7),
      boardWheels: makePaint('#FFD54F'),
      dust: makePaint('#BCAAA4', undefined, 0.5),
      aura: makePaint('#B39DDB', undefined, 0.16),
      gloves: makePaint('#D32F2F'),
      gloveCuff: makePaint('#FFFFFF', 0.8),
      racketFrame: makePaint('#37474F', 0.6),
      racketStrings: makePaint('#FFFFFF', undefined, 0.35),
      racketHandle: makePaint('#212121', 0.9),
      ...(() => {
        const b = BIRD_COATS[(look.pets.find(isBird) ?? 'bird') as keyof typeof BIRD_COATS];
        return {
          birdBody: makePaint(b.body),
          birdWing: makePaint(b.wing),
          birdHead: makePaint(b.head),
          birdTail: makePaint(b.tail),
          birdBeak: makePaint(b.beak),
          birdCrest: makePaint(b.crest ?? b.head),
        };
      })(),
      birdEye: makePaint('#111111'),
      birdFeet: makePaint('#8D6E63', 0.4),
      web: makePaint('#90A4AE', 0.55),
      cardFace: makePaint('#FFFFFF'),
      cardEdge: makePaint('#E040FB', 0.35),
      cardMark: makePaint('#E53935'),
      cardGlow: makePaint('#FF4FD8', undefined, 0.35),
      burst: makePaint('#FF4FD8', 0.8),
      cape: makePaint('#D32F2F'),
      constructGlow: makePaint('#69F0AE', 2.4, 0.3),
      constructFill: makePaint('#00E676', undefined, 0.8),
      constructShine: makePaint('#B9F6CA', undefined, 0.6),
      constructEdge: makePaint('#00A844', 0.7),
      ripple: makePaint('#00E676', 0.7),
      ringBand: makePaint('#00C853'),
      ringGem: makePaint('#B9F6CA'),
      shieldRed: makePaint('#C62828'),
      shieldWhite: makePaint('#ECEFF1'),
      shieldBlue: makePaint('#1565C0'),
      claw: makePaint('#CFD8DC', 0.55),
      clawEdge: makePaint('#78909C', 0.9, 0.5),
      slashGlow: makePaint('#80D8FF', undefined, 0.4),
      slashCore: makePaint('#FFFFFF'),
      slashSpark: makePaint('#FFF59D', 0.55),
      eyeGlow: makePaint('#FF1744', undefined, 0.55),
      beamGlow: makePaint('#FF1744', 3.4, 0.45),
      beamCore: makePaint('#FFCDD2', 1.2),
      spellGlow: makePaint('#FFB74D', 2.6, 0.3),
      spellLine: makePaint('#FF9800', 0.5),
      dumbbellBar: makePaint('#B0BEC5'),
      dumbbellPlates: makePaint('#37474F'),
      thunderHandle: makePaint('#6D4C41'),
      thunderHead: makePaint('#90A4AE'),
      thunderEdge: makePaint('#546E7A', 0.4),
      bolt: makePaint('#FFFFFF', 0.6),
      boltGlow: makePaint('#FFF176', 2.4, 0.55),
      boltFlash: makePaint('#FFF59D', undefined, 0.45),
      sparks: makePaint('#FFD600', 0.6),
      ringGlow: makePaint('#69F0AE', undefined, 0.35),
    },
    smalls,
    dog: dog
      ? (() => {
          const d = DOG_COATS[dog];
          return {
            coat: makePaint(d.coat),
            tail: makePaint(d.coat, 2),
            light: makePaint(d.light),
            dark: makePaint(d.dark),
            tongue: makePaint('#E86A7A'),
            nose: makePaint('#222222'),
            eye: makePaint(d.eye),
            blaze: d.blaze,
          };
        })()
      : null,
    horsePaint: {
      coat: makePaint(HORSE_COAT.coat),
      leg: makePaint(HORSE_COAT.coat, 1.8),
      farLeg: makePaint(HORSE_COAT.farLeg, 1.8),
      mane: makePaint(HORSE_COAT.mane, 1.9),
      maneLine: makePaint(HORSE_COAT.mane, 1.5),
      forelock: makePaint(HORSE_COAT.mane, 1),
      hoof: makePaint(HORSE_COAT.hoof),
      eye: makePaint(HORSE_COAT.eye),
      nostril: makePaint(HORSE_COAT.nostril),
    },
    ...staticShapes(),
  };
}

let shapes: Pick<Kit, 'paths' | 'stubble'> | null = null;

/** The fixed shapes, the same for everyone: parsed once and shared (they're only ever drawn). */
function staticShapes(): Pick<Kit, 'paths' | 'stubble'> {
  shapes ??= {
    paths: Object.fromEntries(Object.entries(STATIC).map(([k, d]) => [k, parse(d)])) as Record<keyof typeof STATIC, SkPath>,
    // Stubble is the beard's shape trimmed to the face, so it never hangs below the chin.
    stubble:
      Skia.Path.MakeFromOp(parse(STATIC.beard), parse(circle(0, 0, 8.4)), PathOp.Intersect) ?? parse(STATIC.beard),
  };
  return shapes;
}

/** Per-character drawing kit: which parts exist, their paints, and the fixed shapes. */
type Kit = {
  idle: Motion;
  tee: boolean;
  baggyTop: boolean;
  baggyBottom: boolean;
  top: CharacterLook['top'];
  bottom: CharacterLook['bottom'];
  hoodie: boolean;
  longHair: boolean;
  bald: boolean;
  frontArms: boolean;
  ball: number;
  horse: boolean;
  /** The shoulder bird's colours, or null for none. */
  bird: (typeof BIRD_COATS)[keyof typeof BIRD_COATS] | null;
  glasses: CharacterLook['glasses'];
  facialHair: CharacterLook['facialHair'];
  freckles: boolean;
  pattern: CharacterLook['pattern'];
  watch: CharacterLook['watch'];
  medal: { strapL: SkPaint; strapR: SkPaint; rim: SkPaint; disc: SkPaint; shine: SkPaint } | null;
  paint: Record<string, SkPaint>;
  smalls: SmallPet[];
  dog: { coat: SkPaint; tail: SkPaint; light: SkPaint; dark: SkPaint; tongue: SkPaint; nose: SkPaint; eye: SkPaint; blaze: boolean } | null;
  horsePaint: Record<string, SkPaint>;
  paths: Record<keyof typeof STATIC, SkPath>;
  stubble: SkPath;
};

// The pet and accessory drawers must come before drawScene: the worklet plugin turns these
// functions into variables, and drawScene captures them when it is defined (later ones would be
// undefined).
function drawCat(canvas: SkCanvas, F: Frame, kit: Kit, slot: number, c: CatPaints) {
  'worklet';
  const S = kit.paths;
  const oval = (cx: number, cy: number, rx: number, ry: number, paint: SkPaint) => {
    canvas.drawOval(Skia.XYWHRect(cx - rx, cy - ry, rx * 2, ry * 2), paint);
  };
  canvas.save();
  canvas.translate(CAT_X[slot]!, 58.5);
  oval(0, 0.1, 5.6, 1, kit.paint.shadow!);
  const tail = Skia.Path.MakeFromSVGString(F['catTail' + slot] as string);
  if (tail) canvas.drawPath(tail, c.tail);
  canvas.drawPath(S.catBody, c.base);
  oval(0, -5.2, 2.1, 3.2, c.chest);
  oval(-1.8, -0.5, 1.35, 0.9, c.light);
  oval(1.8, -0.5, 1.35, 0.9, c.light);
  canvas.drawPath(S.catEarL, c.base);
  canvas.drawPath(S.catEarR, c.base);
  canvas.drawPath(S.catInnerL, c.inner);
  canvas.drawPath(S.catInnerR, c.inner);
  canvas.drawCircle(0, -13, 4.5, c.base);
  const eye = F['catEye' + slot] as number;
  const pupil = F['catPupil' + slot] as number;
  oval(-1.65, -13.3, 1.05, eye, c.eye);
  oval(1.65, -13.3, 1.05, eye, c.eye);
  oval(-1.65, -13.3, 0.32, pupil, c.pupil);
  oval(1.65, -13.3, 0.32, pupil, c.pupil);
  canvas.drawPath(S.catNose, c.nose);
  if (c.stripes) canvas.drawPath(S.catStripes, c.stripes);
  canvas.restore();
}

/** A bunny (ears twitch) or hamster (cheeks puff), sitting where a cat would. */
function drawCritter(canvas: SkCanvas, F: Frame, kit: Kit, slot: number, p: Extract<SmallPet, { kind: 'bunny' | 'hamster' }>) {
  'worklet';
  const oval = (cx: number, cy: number, rx: number, ry: number, paint: SkPaint) => {
    canvas.drawOval(Skia.XYWHRect(cx - rx, cy - ry, rx * 2, ry * 2), paint);
  };
  const sway = F['petSway' + slot] as number;
  const eye = F['catEye' + slot] as number;
  canvas.save();
  canvas.translate(CAT_X[slot]!, 58.5);
  oval(0, 0.1, 5.2, 1, kit.paint.shadow!);
  if (p.kind === 'bunny') {
    canvas.drawCircle(3.9, -2.6, 1.5, p.light);
    oval(0, -4.2, 4.4, 4.2, p.base);
    oval(-2, -0.4, 1.6, 0.8, p.light);
    oval(2, -0.4, 1.6, 0.8, p.light);
    for (let side = -1; side <= 1; side += 2) {
      canvas.save();
      canvas.rotate(side * (10 + 6 * sway), side * 1.4, -13.4);
      oval(side * 1.4, -16.4, 1, 3.6, p.base);
      oval(side * 1.4, -16.2, 0.5, 2.7, p.inner);
      canvas.restore();
    }
    canvas.drawCircle(0, -10.6, 3.4, p.base);
    oval(-1.25, -11, 0.45, 0.55 * eye, p.eye);
    oval(1.25, -11, 0.45, 0.55 * eye, p.eye);
    canvas.drawCircle(0, -9.7, 0.45, p.nose);
  } else {
    canvas.drawCircle(-2.2, -10.1, 1.1, p.base);
    canvas.drawCircle(2.2, -10.1, 1.1, p.base);
    canvas.drawCircle(-2.2, -10.1, 0.6, p.inner);
    canvas.drawCircle(2.2, -10.1, 0.6, p.inner);
    oval(0, -3.6, 4.6, 3.8, p.base);
    canvas.drawCircle(0, -7.4, 3.2, p.base);
    oval(0, -2.8, 2.8, 2.4, p.light);
    const puff = 1.25 + 0.2 * sway;
    canvas.drawCircle(-2.4, -6.5, puff, p.light);
    canvas.drawCircle(2.4, -6.5, puff, p.light);
    oval(-1.1, -8, 0.45, 0.5 * eye, p.eye);
    oval(1.1, -8, 0.45, 0.5 * eye, p.eye);
    canvas.drawCircle(0, -7, 0.35, p.nose);
  }
  canvas.restore();
}

function drawDog(canvas: SkCanvas, F: Frame, kit: Kit) {
  'worklet';
  const d = kit.dog!;
  const S = kit.paths;
  const oval = (cx: number, cy: number, rx: number, ry: number, paint: SkPaint) => {
    canvas.drawOval(Skia.XYWHRect(cx - rx, cy - ry, rx * 2, ry * 2), paint);
  };
  canvas.save();
  canvas.translate(DOG_X, 58.5);
  oval(0, 0.1, 6.2, 1.1, kit.paint.shadow!);
  const tail = Skia.Path.MakeFromSVGString(F.dogTail as string);
  if (tail) canvas.drawPath(tail, d.tail);
  canvas.drawPath(S.dogBody, d.coat);
  oval(0, -5.8, 2.6, 3.8, d.light);
  oval(-2, -0.5, 1.5, 1, d.light);
  oval(2, -0.5, 1.5, 1, d.light);
  canvas.drawCircle(0, -15.8, 5, d.coat);
  canvas.save();
  canvas.rotate(18, -4.7, -15.4);
  oval(-4.7, -15.4, 1.7, 3.3, d.dark);
  canvas.restore();
  canvas.save();
  canvas.rotate(-18, 4.7, -15.4);
  oval(4.7, -15.4, 1.7, 3.3, d.dark);
  canvas.restore();
  if (d.blaze) canvas.drawPath(S.dogBlaze, d.light);
  oval(0, -13.8, 2.9, 2.1, d.light);
  oval(0.5, F.dogTongueCy as number, 0.85, F.dogTongueRy as number, d.tongue);
  oval(0, -14.8, 1, 0.75, d.nose);
  const eye = F.dogEye as number;
  oval(-1.9, -16.9, 0.75, eye, d.eye);
  oval(1.9, -16.9, 0.75, eye, d.eye);
  canvas.restore();
}

function drawHorse(canvas: SkCanvas, F: Frame, kit: Kit) {
  'worklet';
  const H = kit.horsePaint;
  const S = kit.paths;
  const draw = (key: string, paint: SkPaint) => {
    const p = Skia.Path.MakeFromSVGString(F[key] as string);
    if (p) canvas.drawPath(p, paint);
  };
  const hoof = (x: number, y: number) => {
    canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(x, y, 1.9, 1.05), 0.3, 0.3), H.hoof!);
  };
  canvas.save();
  canvas.translate(HORSE_X, 58.5);
  canvas.drawOval(Skia.XYWHRect(-10.5, 0.1 - 1.3, 21, 2.6), kit.paint.shadow!);
  draw('horseTail', H.mane!);
  canvas.drawPath(S.horseFarLegs, H.farLeg!);
  draw('horseFrontLeg', H.leg!);
  canvas.drawPath(S.horseNearBackLeg, H.leg!);
  hoof(-4.9, -1);
  hoof(5.7, -1);
  hoof(-6.9, F.horseFrontHoof as number);
  hoof(3.9, -1);
  canvas.drawPath(S.horseBody, H.coat!);
  draw('horseHead', H.coat!);
  draw('horseMane', H.maneLine!);
  draw('horseForelock', H.forelock!);
  draw('horseEar', H.coat!);
  canvas.drawCircle(F.horseEyeX as number, F.horseEyeY as number, 0.55, H.eye!);
  canvas.drawCircle(F.horseNostrilX as number, F.horseNostrilY as number, 0.32, H.nostril!);
  canvas.restore();
}

/**
 * The bird on the right shoulder, facing outward: it leans with the body, bobs, blinks and flaps.
 * Drawn over the head and hair.
 */
function drawBird(canvas: SkCanvas, F: Frame, kit: Kit) {
  'worklet';
  const P = kit.paint;
  const S = kit.paths;
  const oval = (cx: number, cy: number, rx: number, ry: number, paint: SkPaint) => {
    canvas.drawOval(Skia.XYWHRect(cx - rx, cy - ry, rx * 2, ry * 2), paint);
  };
  canvas.save();
  canvas.translate(F.birdX as number, F.birdY as number);
  canvas.rotate(F.bodyDeg as number, 0, 0);
  // The shapes face left; mirror them so it looks out to the side.
  canvas.scale(-1, 1);
  canvas.drawPath(S.birdFeet, P.birdFeet!);
  canvas.translate(0, F.birdBob as number);
  canvas.drawPath(S.birdTail, P.birdTail!);
  canvas.save();
  canvas.rotate(-15, 0, -3.4);
  oval(0, -3.4, 2.2, 3, P.birdBody!);
  canvas.restore();
  canvas.save();
  canvas.rotate(-15 + 35 * (F.birdFlap as number), 0.4, -4.8);
  oval(0.9, -3, 1.3, 2.3, P.birdWing!);
  canvas.restore();
  if (kit.bird!.crest) canvas.drawPath(S.birdCrest, P.birdCrest!);
  canvas.drawCircle(-0.5, -6.6, 1.8, P.birdHead!);
  canvas.drawPath(S.birdBeak, P.birdBeak!);
  oval(-0.9, -7, 0.38, 0.38 * (F.birdEye as number), P.birdEye!);
  canvas.restore();
}

/**
 * One claw swing: three parallel glowing marks following the claw tips along `pts` (x, y pairs),
 * thin at the tail and sharp at the head. `lam` is how far the strike has got (0 → 1) and `v` how
 * far through the whole swing, after which the marks catch up with the head and vanish.
 */
function drawSlash(canvas: SkCanvas, P: Kit['paint'], pts: number[], lam: number, v: number, scale: number) {
  'worklet';
  const n = pts.length / 2 - 1;
  const head = lam;
  const gone = Math.min(1, Math.max(0, (v - 0.62) / 0.25));
  const tail = head - 0.6 > 0 ? head - 0.6 : 0;
  const from = tail + (head - tail) * gone;
  const fade = 1 - 0.7 * gone;
  if (head - from < 0.02) return;
  // The tip path at s (0 → 1), and the way it's heading there.
  const at = (s: number, out: number[]) => {
    const x = Math.min(n - 0.001, Math.max(0, s * n));
    const i = Math.floor(x);
    const k = x - i;
    out[0] = pts[2 * i] + (pts[2 * i + 2] - pts[2 * i]) * k;
    out[1] = pts[2 * i + 1] + (pts[2 * i + 3] - pts[2 * i + 1]) * k;
    out[2] = pts[2 * i + 2] - pts[2 * i];
    out[3] = pts[2 * i + 3] - pts[2 * i + 1];
  };
  const q = [0, 0, 0, 0];
  const N = 14;
  for (let lane = -1; lane <= 1; lane++) {
    const off = lane * 2.6 * scale;
    for (const [paint, wide] of [
      [P.slashGlow!, 1.9],
      [P.slashCore!, 0.85],
    ] as const) {
      const left: number[] = [];
      const right: number[] = [];
      for (let i = 0; i <= N; i++) {
        const u = i / N;
        at(from + (head - from) * u, q);
        const len = Math.hypot(q[2], q[3]) || 1;
        const nx = -q[3] / len;
        const ny = q[2] / len;
        const w = 0.9 * scale * wide * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.75)), 0.9);
        left.push(q[0] + nx * (off + w), q[1] + ny * (off + w));
        right.push(q[0] + nx * (off - w), q[1] + ny * (off - w));
      }
      const path = Skia.Path.Make();
      path.moveTo(left[0], left[1]);
      for (let i = 2; i < left.length; i += 2) path.lineTo(left[i], left[i + 1]);
      for (let i = right.length - 2; i >= 0; i -= 2) path.lineTo(right[i], right[i + 1]);
      path.close();
      const base = paint.getAlphaf();
      paint.setAlphaf(base * fade);
      canvas.drawPath(path, paint);
      paint.setAlphaf(base);
    }
  }
}

/** Short bright rays bursting out from (x, y); `u` runs 0 → 1 as they fly out and fade. */
function drawBurst(canvas: SkCanvas, P: Kit['paint'], x: number, y: number, u: number, rays: number, reach: number, turn: number) {
  'worklet';
  const out = 1 - (1 - u) * (1 - u);
  const paint = P.slashSpark!;
  const base = paint.getAlphaf();
  paint.setAlphaf(base * (1 - u));
  for (let i = 0; i < rays; i++) {
    const a = turn + (i / rays) * 2 * Math.PI;
    const r0 = reach * (0.25 + 0.55 * out);
    const r1 = reach * (0.45 + 0.75 * out);
    canvas.drawLine(x + r0 * Math.cos(a), y + r0 * Math.sin(a), x + r1 * Math.cos(a), y + r1 * Math.sin(a), paint);
  }
  paint.setAlphaf(base);
}

/** Draws one frame of the scene, back to front. */
function drawScene(canvas: SkCanvas, F: Frame, kit: Kit) {
  'worklet';
  const P = kit.paint;
  const S = kit.paths;
  const path = (key: string) => Skia.Path.MakeFromSVGString(F[key] as string);
  const fill = (key: string, paint: SkPaint, alpha = 1) => {
    if (alpha <= 0) return;
    const p = path(key);
    if (!p) return;
    const base = paint.getAlphaf();
    if (alpha !== 1) paint.setAlphaf(base * alpha);
    canvas.drawPath(p, paint);
    if (alpha !== 1) paint.setAlphaf(base);
  };
  const oval = (cx: number, cy: number, rx: number, ry: number, paint: SkPaint) => {
    canvas.drawOval(Skia.XYWHRect(cx - rx, cy - ry, rx * 2, ry * 2), paint);
  };
  // Fixed shapes in the head's frame (glasses, beard, freckles, ...).
  const inHead = () => {
    canvas.save();
    canvas.translate(F.headX as number, F.headY as number);
    canvas.rotate(F.headDeg as number, 0, 0);
    canvas.translate(F.faceDx as number, 0);
  };
  // Draws `paint` at `alpha` times its own opacity.
  const faded = (paint: SkPaint, alpha: number, draw: () => void) => {
    if (alpha <= 0) return;
    const base = paint.getAlphaf();
    paint.setAlphaf(base * alpha);
    draw();
    paint.setAlphaf(base);
  };
  // The power ring on a finger poking out of the right fist, along the forearm.
  const ring = () => {
    if (kit.watch !== 'ring' && kit.idle !== 'construct' && kit.idle !== 'e-lantern') return;
    canvas.save();
    canvas.translate(F.handRX as number, F.handRY as number);
    canvas.rotate(F.handRDeg as number, 0, 0);
    faded(P.ringGlow!, F.ringGlow as number, () => canvas.drawCircle(2.1, 0, 1.9, P.ringGlow!));
    canvas.drawPath(S.finger, P.skin!);
    canvas.drawPath(S.ringBand, P.ringBand!);
    canvas.drawCircle(2.1, 0, 0.36, P.ringGem!);
    canvas.restore();
  };
  const watch = () => {
    if (kit.watch === 'none' || kit.watch === 'ring') return;
    canvas.save();
    canvas.translate(F.watchX as number, F.watchY as number);
    canvas.rotate(F.watchDeg as number, 0, 0);
    canvas.drawPath(S.watchStrap, P.watchStrap!);
    if (kit.watch === 'smart') {
      canvas.drawPath(S.watchCase, P.watchCase!);
      canvas.drawPath(S.watchScreen, P.watchScreen!);
    } else if (kit.watch === 'classic') {
      canvas.drawCircle(0, 0, 1.4, P.watchCase!);
      canvas.drawCircle(0, 0, 1.4, P.watchRim!);
      canvas.drawPath(S.watchHands, P.watchHands!);
    } else {
      canvas.drawPath(S.watchPill, P.watchCase!);
    }
    canvas.restore();
  };

  if (kit.horse) drawHorse(canvas, F, kit);
  if (kit.idle === 'meditate') {
    const o = F.auraO as number;
    const base = P.aura!.getAlphaf();
    P.aura!.setAlphaf(base * o);
    canvas.drawCircle(F.auraX as number, F.auraY as number, F.auraR as number, P.aura!);
    canvas.drawCircle(F.auraX as number, F.auraY as number, (F.auraR as number) * 0.72, P.aura!);
    P.aura!.setAlphaf(base);
  }

  oval(F.shadowX as number, 58.6, F.shadowRx as number, F.shadowRy as number, P.shadow!);
  if (kit.hoodie) canvas.drawCircle(F.hoodX as number, F.hoodY as number, 10.1, P.hood!);
  if (kit.longHair) fill('hairBack', P.hair!);
  if (kit.idle === 'jumprope' && !F.ropeFront) fill('rope', P.rope!);
  if (kit.idle === 'hero' || kit.idle === 'flight') fill('cape', P.cape!);
  if (kit.idle === 'skate') {
    const dust = F.dustO as number;
    if (dust > 0) {
      const base = P.dust!.getAlphaf();
      P.dust!.setAlphaf(base * dust);
      canvas.drawCircle(F.dustX as number, F.dustY as number, F.dustR as number, P.dust!);
      P.dust!.setAlphaf(base);
    }
    canvas.save();
    canvas.translate(F.boardX as number, F.boardY as number);
    canvas.rotate(F.boardDeg as number, 0, 0);
    canvas.drawPath(S.boardTrucks, P.boardTrucks!);
    canvas.drawPath(S.boardWheels, P.boardWheels!);
    canvas.drawPath(S.boardDeck, P.board!);
    canvas.restore();
  }

  fill('legs', P.legs!);
  if (kit.bottom === 'shorts') fill('thighs', P.thighs!);
  if (kit.baggyBottom) {
    fill('baggyPants', P.pants!);
    fill('baggyKnees', P.pants!);
  }
  fill('shoes', P.shoes!);
  // Tops go over the bottoms, so a skirt is drawn first and the shirt hangs over its waist. Sitting
  // cross-legged the shirt stops at the waist instead, with the skirt in front of the legs below it.
  const sitting = F.crossLegged === 1;
  if (kit.bottom === 'skirt' && !sitting) fill('skirt', P.skirt!);
  if (kit.baggyTop) {
    fill('torsoFlow', P.torsoFlow!);
    fill('folds', P.fold!);
  } else {
    fill('torso', P.torso!);
    // The torso's round end, squared off into a straight hem.
    fill('hem', P.torsoFlow!);
  }
  if (kit.bottom === 'skirt' && sitting) fill('skirt', P.skirt!);
  if (kit.top === 'jersey') fill('stripe', P.stripe!);
  if (kit.top === 'jacket') fill('zip', P.zip!);
  if (kit.idle === 'webswing') fill('web', P.web!, F.webO as number);
  if (kit.pattern !== 'none') {
    canvas.save();
    canvas.translate(F.chestX as number, F.chestY as number);
    canvas.rotate(F.bodyDeg as number, 0, 0);
    canvas.drawPath(S[kit.pattern], kit.pattern === 'stripes' ? P.patternLine! : P.patternFill!);
    canvas.restore();
  }
  const armSet = (alpha: number, back: boolean) => {
    if (alpha <= 0) return;
    if (!back && kit.idle.startsWith('p-')) fill('arms', P.armEdge!);
    fill('arms', P.arms!);
    if (back && kit.idle === 'flex') fill('biceps', P.biceps!);
    if (kit.tee) fill('sleeves', P.sleeves!);
    fill('hands', P.skin!);
    if (kit.idle === 'p-peace') fill('fingers', P.skin!);
    watch();
    ring();
  };
  armSet(F.armsBack as number, true);
  if (kit.idle === 'weights') {
    for (const [x, y] of [
      [F.handLX as number, F.handLY as number],
      [F.handRX as number, F.handRY as number],
    ] as const) {
      canvas.save();
      canvas.translate(x, y);
      canvas.drawPath(S.dumbbellBar, P.dumbbellBar!);
      canvas.drawPath(S.dumbbellPlates, P.dumbbellPlates!);
      canvas.restore();
    }
  }

  if (kit.medal) {
    const M = kit.medal;
    const mx = F.medalX as number;
    const my = F.medalY as number;
    fill('medalRibbonL', M.strapL);
    fill('medalRibbonR', M.strapR);
    canvas.drawCircle(mx, my, 3.3, M.rim);
    canvas.drawCircle(mx, my, 2.5, M.disc);
    const shine = Skia.Path.Make();
    shine.addArc(Skia.XYWHRect(mx - 1.7, my - 1.7, 3.4, 3.4), 200, 70);
    canvas.drawPath(shine, M.shine);
  }
  if (kit.idle === 'guitar') {
    fill('guitarHead', P.guitarHead!);
    fill('guitarNeck', P.guitarNeck!);
    fill('guitarBody', P.guitarEdge!);
    fill('guitarBody', P.guitarBody!);
    fill('guitarHole', P.guitarHole!);
    fill('guitarStrings', P.guitarStrings!);
    // The strumming forearm and hand in front of the strings.
    fill('strumArm', P.arms!);
    fill('strumHand', P.skin!);
  }
  if (kit.idle === 'tennis') {
    fill('racketHandle', P.racketHandle!);
    fill('racketHead', P.racketStrings!);
    fill('racketHead', P.racketFrame!);
  }

  fill('head', P.skin!);
  // No blush under a beard or stubble.
  if (kit.facialHair !== 'beard' && kit.facialHair !== 'stubble') fill('cheeks', P.cheeks!);
  if (kit.freckles || kit.facialHair !== 'none') {
    inHead();
    if (kit.freckles) canvas.drawPath(S.freckles, P.freckles!);
    const fh = kit.facialHair;
    if (fh === 'beard' || fh === 'stubble' || fh === 'goatee') {
      if (fh === 'stubble') canvas.drawPath(kit.stubble, P.stubble!);
      else canvas.drawPath(fh === 'goatee' ? S.goatee : S.beard, P.hair!);
      canvas.drawPath(S.mouthPatch, P.skin!);
    } else if (fh === 'disconnected') canvas.drawPath(S.chinTuft, P.hair!);
    canvas.restore();
  }
  fill('eyes', P.eyes!);
  fill('mouth', P.mouth!, F.mouthO as number);
  fill('grin', P.grinFill!, F.grinO as number);
  fill('grin', P.mouth!, F.grinO as number);
  const moustache = kit.facialHair === 'moustache' || kit.facialHair === 'disconnected';
  if (F.ohO || moustache) {
    inHead();
    if (F.ohO) canvas.drawPath(S.oh, P.mouthFill!);
    if (moustache) canvas.drawPath(S.moustache, P.hair!);
    canvas.restore();
  }
  if (!kit.bald) fill('hair', P.hair!);
  if (kit.glasses !== 'none') {
    inHead();
    if (kit.glasses === 'round') canvas.drawPath(S.glassesRound, P.glasses!);
    else if (kit.glasses === 'square') canvas.drawPath(S.glassesSquare, P.squareFrame!);
    else if (kit.glasses === 'cateye') canvas.drawPath(S.glassesCateye, P.cateyeFrame!);
    else if (kit.glasses === 'aviator') {
      canvas.drawPath(S.aviatorLenses, P.aviatorTint!);
      canvas.drawPath(S.aviatorLenses, P.aviatorFrame!);
      canvas.drawPath(S.aviatorFrame, P.aviatorFrame!);
    } else if (kit.glasses === 'heart') {
      canvas.drawPath(S.heartLenses, P.heartLens!);
      canvas.drawPath(S.heartFrame, P.shadesFrame!);
      canvas.drawPath(S.shadesShine, P.shine!);
    } else {
      canvas.drawPath(S.shadesLenses, P.shades!);
      canvas.drawPath(S.shadesFrame, P.shadesFrame!);
      canvas.drawPath(S.shadesShine, P.shine!);
    }
    canvas.restore();
  }
  if (kit.bird) drawBird(canvas, F, kit);
  if (kit.idle === 'sad' || F.angry) fill('brows', P.brows!);
  if (kit.idle === 'sad') fill('tear', P.tear!, F.tearO as number);
  if (kit.frontArms) armSet(F.armsFront as number, false);
  // In front of the hands, which circle behind it.
  if (kit.idle === 'spell') {
    const o = F.spellO as number;
    canvas.save();
    canvas.translate(F.spellX as number, F.spellY as number);
    faded(P.spellGlow!, o, () => canvas.drawCircle(0, 0, 7.6, P.spellGlow!));
    faded(P.spellLine!, o, () => {
      canvas.drawCircle(0, 0, 8.4, P.spellLine!);
      canvas.drawCircle(0, 0, 6.9, P.spellLine!);
      canvas.rotate(F.spellDeg as number, 0, 0);
      canvas.drawPath(S.spellTicks, P.spellLine!);
      canvas.rotate(-2 * (F.spellDeg as number), 0, 0);
      canvas.drawPath(S.spellStar, P.spellLine!);
    });
    canvas.restore();
  }
  if (kit.idle === 'boxing') {
    for (const [x, y] of [
      [F.handLX as number, F.handLY as number],
      [F.handRX as number, F.handRY as number],
    ] as const) {
      canvas.drawCircle(x, y, 2.7, P.gloves!);
      canvas.drawCircle(x, y, 2.7, P.gloveCuff!);
    }
  }
  if (kit.idle === 'construct') {
    const o = F.constructO as number;
    const rise = F.constructRise as number;
    // A glow on the ground where the hammer breaks through while it rises.
    faded(P.ripple!, F.emergeO as number, () => oval(F.constructX as number, 58.4, 6, 1.5, P.ripple!));
    if (o > 0) {
      canvas.save();
      // Still partly underground: only what's above the ground shows.
      if (rise > 0) canvas.clipRect(Skia.XYWHRect(-30, -10, 120, 68.5), ClipOp.Intersect, true);
      canvas.translate(F.constructX as number, (F.constructY as number) + rise);
      canvas.rotate(F.constructDeg as number, 0, 0);
      faded(P.constructGlow!, o, () => {
        canvas.drawPath(S.hammerHandle, P.constructGlow!);
        canvas.drawPath(S.hammerHead, P.constructGlow!);
      });
      faded(P.constructFill!, o, () => {
        canvas.drawPath(S.hammerHandle, P.constructFill!);
        canvas.drawPath(S.hammerHead, P.constructFill!);
      });
      faded(P.constructShine!, o, () => canvas.drawPath(S.hammerShine, P.constructShine!));
      faded(P.constructEdge!, o, () => {
        canvas.drawPath(S.hammerHandle, P.constructEdge!);
        canvas.drawPath(S.hammerHead, P.constructEdge!);
      });
      canvas.restore();
    }
    faded(P.ripple!, F.rippleO as number, () => oval(60, 58.4, F.rippleR as number, (F.rippleR as number) * 0.25, P.ripple!));
  }
  if (kit.idle === 'claws' && (F.clawExt as number) > 0.01) {
    for (const [x, y, deg] of [
      [F.handLX as number, F.handLY as number, F.handLDeg as number],
      [F.handRX as number, F.handRY as number, F.handRDeg as number],
    ] as const) {
      canvas.save();
      canvas.translate(x, y);
      canvas.rotate(deg, 0, 0);
      canvas.scale(F.clawExt as number, 1);
      canvas.drawPath(S.claws, P.clawEdge!);
      canvas.drawPath(S.claws, P.claw!);
      canvas.restore();
    }
  }
  if (kit.idle === 'claws') {
    const cx = F.cfxX as number;
    const cy = F.cfxY as number;
    // SNIKT: a bright flash and a ring of sparks at each fist as the blades fire out.
    const sn = F.cfxSnikt as number;
    if (sn >= 0) {
      for (const [x, y] of [
        [F.handLX as number, F.handLY as number],
        [F.handRX as number, F.handRY as number],
      ] as const) {
        faded(P.slashCore!, 1 - sn, () => canvas.drawCircle(x, y, 2.6 * (1 - sn) + 0.8, P.slashCore!));
        drawBurst(canvas, P, x, y, sn, 8, 6, 0.4);
      }
    }
    // Each swing's three marks along the claw tips, and a spark burst where it ends.
    const count = F.cfxN as number;
    const big = count > 1 && (F.cfxV0 as number) === (F.cfxV1 as number);
    for (let i = 0; i < count; i++) {
      const pts = (F['cfxP' + i] as string).trim().split(' ').map(Number);
      const v = F['cfxV' + i] as number;
      const lam = F['cfxL' + i] as number;
      drawSlash(canvas, P, pts, lam, v, big ? 1.25 : 1);
      if (lam > 0.98 && v < 0.9) {
        const k = (v - 0.55) / 0.35;
        drawBurst(canvas, P, pts[pts.length - 2], pts[pts.length - 1], Math.min(1, Math.max(0, k)), 6, 5, i * 0.5);
      }
    }
    // Both arms together cross in an X: a flash where the marks meet.
    if (big) {
      const v = F.cfxV0 as number;
      const k = (v - 0.45) / 0.45;
      if (k > 0 && k < 1) {
        faded(P.slashCore!, 1 - k, () => canvas.drawCircle(cx, cy, 3.4 * (1 - k) + 1, P.slashCore!));
        drawBurst(canvas, P, cx, cy, k, 10, 11, 0.15);
      }
    }
  }
  if (kit.idle === 'eyebeam') {
    faded(P.beamGlow!, F.beamO as number, () => fill('beam', P.beamGlow!));
    faded(P.beamCore!, F.beamO as number, () => fill('beam', P.beamCore!));
    // Both eyes glow red as it charges.
    const g = F.eyeGlow as number;
    if (g > 0.02) {
      inHead();
      faded(P.eyeGlow!, g, () => {
        canvas.drawCircle(-3, 0.6, 1.4 + 0.8 * g, P.eyeGlow!);
        canvas.drawCircle(3, 0.6, 1.4 + 0.8 * g, P.eyeGlow!);
      });
      canvas.restore();
    }
  }
  if (kit.idle === 'shield' || kit.idle === 'thunder' || kit.idle === 'speedster') {
    if (kit.idle === 'shield') {
      canvas.save();
      canvas.translate(F.shieldX as number, F.shieldY as number);
      canvas.scale(F.shieldScale as number, 1);
      canvas.drawCircle(0, 0, 3.8, P.shieldRed!);
      canvas.drawCircle(0, 0, 2.9, P.shieldWhite!);
      canvas.drawCircle(0, 0, 2.05, P.shieldRed!);
      canvas.drawCircle(0, 0, 1.35, P.shieldBlue!);
      canvas.scale(0.42, 0.42);
      canvas.drawPath(S.star, P.shieldWhite!);
      canvas.restore();
    } else if (kit.idle === 'thunder') {
      canvas.save();
      canvas.translate(F.handRX as number, F.handRY as number);
      canvas.rotate(F.handRDeg as number, 0, 0);
      canvas.drawPath(S.thunderHandle, P.thunderHandle!);
      canvas.drawPath(S.thunderHead, P.thunderHead!);
      canvas.drawPath(S.thunderHead, P.thunderEdge!);
      canvas.restore();
      if (F.thunderBolt) {
        fill('bolt', P.boltGlow!);
        fill('bolt', P.bolt!);
        canvas.drawCircle(F.boltX as number, F.boltY as number, 3.4, P.boltFlash!);
      }
    } else {
      fill('sparks', P.sparks!);
    }
  }
  if (kit.idle === 'cardthrow') {
    const card = (x: number, y: number, deg: number) => {
      canvas.save();
      canvas.translate(x, y);
      canvas.rotate(deg, 0, 0);
      canvas.drawPath(S.card, P.cardFace!);
      canvas.drawPath(S.card, P.cardEdge!);
      canvas.restore();
    };
    // The deck in the left hand (two cards, slightly offset, read as a stack).
    card((F.deckX as number) - 0.3, (F.deckY as number) + 0.3, -14);
    card(F.deckX as number, F.deckY as number, -8);
    // Cards springing across from the left hand to the right.
    for (let i = 0; i < 5; i++) {
      if (F['arcO' + i]) card(F['arcX' + i] as number, F['arcY' + i] as number, F['arcDeg' + i] as number);
    }
    const o = F.cardO as number;
    if (o > 0) {
      const x = F.cardX as number;
      const y = F.cardY as number;
      faded(P.cardGlow!, F.cardGlow as number, () => canvas.drawCircle(x, y, 2.4 + 1.6 * (F.cardGlow as number), P.cardGlow!));
      canvas.save();
      canvas.translate(x, y);
      canvas.rotate(F.cardDeg as number, 0, 0);
      canvas.drawPath(S.card, P.cardFace!);
      canvas.drawPath(S.card, P.cardEdge!);
      canvas.drawPath(S.cardMark, P.cardMark!);
      canvas.restore();
    }
    faded(P.burst!, F.burstO as number, () => {
      canvas.drawCircle(F.burstX as number, F.burstY as number, F.burstR as number, P.burst!);
      canvas.drawCircle(F.burstX as number, F.burstY as number, (F.burstR as number) * 0.55, P.burst!);
    });
  }
  if (kit.idle === 'archery') {
    fill('bow', P.bow!);
    fill('bowString', P.bowString!);
    const a = F.arrowO as number;
    fill('arrow', P.arrow!, a);
    fill('arrowHead', P.arrowHead!, a);
    fill('fletch', P.fletch!, a);
  }
  if (kit.idle === 'guitar') {
    const o = F.noteO as number;
    fill('noteHead', P.note!, o);
    fill('noteStem', P.noteStem!, o);
  }
  if (kit.idle === 'jumprope' && F.ropeFront) fill('rope', P.rope!);

  if (kit.idle === 'knit') {
    fill('thread', P.thread!);
    canvas.drawCircle(YARN_BALL.x, YARN_BALL.y, 2.7, P.yarn!);
    canvas.drawPath(kit.paths.yarnLines, P.yarnLines!);
    fill('swatch', P.yarn!);
    fill('needles', P.needles!);
  }

  if (kit.ball > 0) {
    const a = F.ballO as number;
    if (a > 0) {
      for (const pt of [P.ballFill!, P.ballEdge!]) {
        const base = pt.getAlphaf();
        pt.setAlphaf(base * a);
        canvas.drawCircle(F.ballX as number, F.ballY as number, kit.ball, pt);
        pt.setAlphaf(base);
      }
      if (kit.idle === 'soccer') fill('ballSeams', P.seamsFill!, a);
      fill('ballSeams', P.seams!, a);
    }
  }
  if (kit.idle === 'sleep') fill('zzz', P.zzz!, F.zzzO as number);

  for (let i = 0; i < kit.smalls.length; i++) {
    const s = kit.smalls[i]!;
    if (s.kind === 'cat') drawCat(canvas, F, kit, i, s.cat);
    else drawCritter(canvas, F, kit, i, s);
  }
  if (kit.dog) drawDog(canvas, F, kit);
}
