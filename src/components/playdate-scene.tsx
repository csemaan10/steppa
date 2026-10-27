import { useEffect, useEffectEvent, useRef, useState, type RefObject } from 'react';
import { StyleSheet, Text as NativeText, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { SparkleBurst } from '@/components/game/game-fx';
import { PHOTO_FEET, PHOTO_SIZE } from '@/components/pet-adventures';
import { drawScene, SCENE_HEIGHT, SCENE_WIDTH, type Shape, type TimeOfDay } from '@/lib/scene-art';
import { drawPetPhoto, levelOf, stageOf, type KindPicks } from '@/lib/world';

const UP = Easing.out(Easing.quad);
const DOWN = Easing.in(Easing.quad);
const SWING = Easing.inOut(Easing.sin);

/** Where each pet stands in the park: yours on the left, your friend's on the right. */
const MINE_X = 112;
const THEIRS_X = 250;
const ARRIVE_MS = 1100;
/** A pass in a game of keepy-up, head to head. */
const PASS_MS = 620;
const PASSES = 4;
const ROUTINES = ['volley', 'chase', 'twirl'] as const;

type Moves = {
  slide: SharedValue<number>;
  hop: SharedValue<number>;
  tilt: SharedValue<number>;
  turn: SharedValue<number>;
};

/** Hearts and treats drawn over the park, at scene coordinates. */
type Float = { id: number; kind: 'heart' | 'treat' | 'sparkles'; x: number; y: number };

export type Playdate = ReturnType<typeof usePlaydate>;

function useMoves(): Moves {
  return { slide: useSharedValue(0), hop: useSharedValue(0), tilt: useSharedValue(0), turn: useSharedValue(1) };
}

/**
 * Two pets playing in the park. `play` takes turns between a game of keepy-up (a ball bounced head to
 * head), a chase, and a twirl together; `treat` drops a treat on your friend's pet, which gobbles it
 * up happily. While nothing's going on they take turns doing little hops.
 */
export function usePlaydate() {
  const mine = useMoves();
  const theirs = useMoves();
  /** -1 with no ball in play; otherwise how many passes along it is. */
  const ball = useSharedValue(-1);
  const [floats, setFloats] = useState<Float[]>([]);
  const nextId = useRef(0);
  const played = useRef(0);
  const busyUntil = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
    },
    []
  );

  function later(ms: number, run: () => void) {
    const timer = setTimeout(() => {
      timers.current = timers.current.filter((t) => t !== timer);
      run();
    }, ms);
    timers.current.push(timer);
  }

  function float(kind: Float['kind'], x: number, y: number) {
    const id = nextId.current++;
    setFloats((all) => [...all.slice(-12), { id, kind, x, y }]);
  }

  function hearts(count: number, x = (MINE_X + THEIRS_X) / 2) {
    for (let i = 0; i < count; i++) later(i * 160, () => float('heart', x + (i % 2 ? 10 : -10) * (1 + i / 2), 110));
  }

  function jump(pet: Moves, height: number) {
    pet.hop.set(
      withSequence(withTiming(height, { duration: 170, easing: UP }), withTiming(0, { duration: 210, easing: DOWN }))
    );
  }

  /** Little hops in turn, when nothing else is going on. */
  function fidget(turn: number) {
    if (Date.now() < busyUntil.current) return;
    jump(turn % 2 ? theirs : mine, 8);
  }

  function play() {
    const routine = ROUTINES[played.current++ % ROUTINES.length]!;
    if (routine === 'volley') {
      // Keepy-up: the ball goes head to head, each pet hopping to bump it back.
      busyUntil.current = Date.now() + PASSES * PASS_MS + 1200;
      ball.set(0);
      ball.set(withTiming(PASSES, { duration: PASSES * PASS_MS, easing: Easing.linear }, () => ball.set(-1)));
      for (let i = 0; i < PASSES; i++) later((i + 1) * PASS_MS - 170, () => jump(i % 2 ? mine : theirs, 16));
      later(PASSES * PASS_MS, () => {
        float('sparkles', MINE_X, 120);
        hearts(3);
      });
      return;
    }
    if (routine === 'chase') {
      // Your friend's pet dashes off, yours gives chase, and they come back together.
      busyUntil.current = Date.now() + 2200;
      const run = { easing: SWING };
      theirs.slide.set(withSequence(withTiming(64, { duration: 420, ...run }), withDelay(300, withTiming(0, { duration: 700, ...run }))));
      mine.slide.set(
        withDelay(180, withSequence(withTiming(110, { duration: 560, ...run }), withDelay(160, withTiming(0, { duration: 760, ...run }))))
      );
      theirs.tilt.set(withSequence(withTiming(8, { duration: 200 }), withDelay(520, withTiming(-8, { duration: 200 })), withDelay(500, withTiming(0, { duration: 200 }))));
      mine.tilt.set(withSequence(withDelay(180, withTiming(8, { duration: 200 })), withDelay(520, withTiming(-8, { duration: 200 })), withDelay(560, withTiming(0, { duration: 200 }))));
      for (let t = 0; t < 1700; t += 170) {
        later(t, () => jump(theirs, 6));
        later(t + 90, () => jump(mine, 6));
      }
      later(1800, () => hearts(2));
      return;
    }
    // A twirl together: both spin round, jump, and land in a shower of hearts.
    busyUntil.current = Date.now() + 1600;
    for (const pet of [mine, theirs]) {
      pet.turn.set(
        withSequence(
          ...[-1, 1, -1, 1].map((to) => withTiming(to, { duration: 130, easing: SWING }))
        )
      );
    }
    later(300, () => {
      jump(mine, 22);
      jump(theirs, 22);
    });
    later(700, () => hearts(4));
  }

  /** A treat drops onto your friend's pet; it hops up to catch it and is delighted. */
  function treat(mouthY: number) {
    busyUntil.current = Date.now() + 1800;
    float('treat', THEIRS_X, mouthY);
    later(520, () => {
      jump(theirs, 12);
      hearts(3, THEIRS_X);
    });
    later(900, () => float('sparkles', THEIRS_X, mouthY));
  }

  function remove(id: number) {
    setFloats((all) => all.filter((f) => f.id !== id));
  }

  return { mine, theirs, ball, floats, remove, play, treat, fidget };
}

/** A pet's look and how grown it is. */
type Pet = { steps: number; picks: KindPicks | undefined };

/**
 * The park: a grassy scene with balloons, your pet on the left and your friend's on the right, both
 * hopping in from their side. `mouthRef` is placed at your friend's pet's mouth, for treats to fly to.
 */
export function PlaydateScene({
  date,
  mine,
  theirs,
  width,
  time,
  mouthRef,
}: {
  date: Playdate;
  mine: Pet;
  theirs: Pet;
  width: number;
  time: TimeOfDay;
  mouthRef: RefObject<View | null>;
}) {
  const height = Math.round((width * SCENE_HEIGHT) / SCENE_WIDTH);
  const scale = width / SCENE_WIDTH;
  const park = drawScene(['grass', 'hills', 'balloons'], time, 'Playdate park');
  const sizeOf = (pet: Pet) => PHOTO_SIZE[stageOf(levelOf(pet.steps))]!;
  const mineShapes = drawPetPhoto(mine.steps, mine.picks, time, MINE_X, PHOTO_FEET, sizeOf(mine));
  const theirShapes = drawPetPhoto(theirs.steps, theirs.picks, time, THEIRS_X, PHOTO_FEET, sizeOf(theirs));
  // Roughly where each one's mouth and head are, for treats and the ball.
  const theirMouth = PHOTO_FEET - 47 * sizeOf(theirs);
  const heads = [PHOTO_FEET - 100 * sizeOf(mine), PHOTO_FEET - 100 * sizeOf(theirs)] as const;

  const enter = useSharedValue(0);
  useEffect(() => {
    enter.set(withTiming(1, { duration: ARRIVE_MS, easing: Easing.linear }));
  }, [enter]);

  // Taking turns at little hops while nothing else is going on.
  const fidgets = useRef(0);
  const fidget = useEffectEvent(() => date.fidget(fidgets.current++));
  useEffect(() => {
    const timer = setInterval(fidget, 2600);
    return () => clearInterval(timer);
  }, []);

  return (
    <View
      style={[styles.park, { width, height, experimental_backgroundImage: `linear-gradient(180deg, ${park.sky[0]}, ${park.sky[1]})` }]}
      accessible
      accessibilityLabel="Your pets playing together in the park">
      <Picture shapes={park.shapes} />
      <PetLayer shapes={mineShapes} moves={date.mine} enter={enter} from={-1} x={MINE_X} scale={scale} />
      <PetLayer shapes={theirShapes} moves={date.theirs} enter={enter} from={1} x={THEIRS_X} scale={scale} />
      <VolleyBall ball={date.ball} heads={heads} scale={scale} />
      <View
        ref={mouthRef}
        collapsable={false}
        pointerEvents="none"
        style={[styles.spot, { left: THEIRS_X * scale - 2, top: theirMouth * scale - 2 }]}
      />
      {date.floats.map((f) =>
        f.kind === 'sparkles' ? (
          <View key={f.id} pointerEvents="none" style={[styles.spot, { left: f.x * scale, top: f.y * scale }]}>
            <SparkleBurst count={10} radius={40 * scale} />
          </View>
        ) : (
          <Floaty key={f.id} float={f} scale={scale} onDone={() => date.remove(f.id)} />
        )
      )}
    </View>
  );
}

function Picture({ shapes }: { shapes: Shape[] }) {
  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${SCENE_WIDTH} ${SCENE_HEIGHT}`} style={StyleSheet.absoluteFill}>
      {shapes.map((s, i) => (
        <Path key={i} d={s.d} fill={s.fill} opacity={s.opacity} />
      ))}
    </Svg>
  );
}

/** One pet: hops in from its side of the park, then moves with its play (about its feet). */
function PetLayer({
  shapes,
  moves,
  enter,
  from,
  x,
  scale,
}: {
  shapes: Shape[];
  moves: Moves;
  enter: SharedValue<number>;
  /** -1 from the left, 1 from the right. */
  from: number;
  x: number;
  scale: number;
}) {
  const style = useAnimatedStyle(() => {
    const p = enter.get();
    const along = 1 - (1 - p) * (1 - p);
    const hopIn = p < 1 ? Math.abs(Math.sin(p * Math.PI * 3)) * 14 : 0;
    return {
      transformOrigin: [x * scale, PHOTO_FEET * scale, 0],
      transform: [
        { translateX: (from * (1 - along) * 200 + moves.slide.get()) * scale },
        { translateY: -(hopIn + moves.hop.get()) * scale },
        { rotate: `${moves.tilt.get()}deg` },
        { scaleX: moves.turn.get() },
      ],
    };
  });
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <Picture shapes={shapes} />
    </Animated.View>
  );
}

const BALL = 9;

/** Keepy-up: the ball arcs from one pet's head to the other's and back, `ball` passes along. */
function VolleyBall({ ball, heads, scale }: { ball: SharedValue<number>; heads: readonly [number, number]; scale: number }) {
  const size = BALL * 2 * scale;
  const style = useAnimatedStyle(() => {
    const v = ball.get();
    if (v < 0) return { opacity: 0 };
    const pass = Math.min(Math.floor(v), PASSES - 1);
    const t = v - pass;
    const toTheirs = pass % 2 === 0;
    const [fx, tx] = toTheirs ? [MINE_X, THEIRS_X] : [THEIRS_X, MINE_X];
    const [fy, ty] = toTheirs ? heads : [heads[1], heads[0]];
    const x = fx + (tx - fx) * t;
    const y = fy + (ty - fy) * t - Math.sin(t * Math.PI) * 50;
    return {
      opacity: 1,
      transform: [
        { translateX: x * scale - size / 2 },
        { translateY: y * scale - size / 2 },
        { rotate: `${v * 300}deg` },
      ],
    };
  });
  return (
    <Animated.View pointerEvents="none" style={[styles.origin, { width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 20 20">
        <Path d="M10 0a10 10 0 1 1 0 20a10 10 0 1 1 0-20Z" fill="#FF6F61" />
        <Path d="M0.7 7.3C6 9.6 14 9.6 19.3 7.3L19.9 10.9C14 13.4 6 13.4 0.1 10.9Z" fill="#FFFFFF" />
      </Svg>
    </Animated.View>
  );
}

/** A heart rising and fading, or a treat dropping in from above to (x, y). */
function Floaty({ float, scale, onDone }: { float: Float; scale: number; onDone: () => void }) {
  const p = useSharedValue(0);
  const treat = float.kind === 'treat';
  useEffect(() => {
    p.set(
      withTiming(1, { duration: treat ? 720 : 1100, easing: treat ? Easing.linear : UP }, (finished) => {
        if (finished) scheduleOnRN(onDone);
      })
    );
    // Runs once: each float plays a single time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const size = (treat ? 22 : 14) * scale;
  const style = useAnimatedStyle(() => {
    const v = p.get();
    if (treat) {
      // Falls faster and faster, then is gobbled up.
      const land = 0.72;
      const fall = Math.min(1, v / land);
      const eaten = v > land ? (v - land) / (1 - land) : 0;
      return {
        opacity: 1 - eaten,
        transform: [{ translateY: -(1 - fall * fall) * (float.y + 20) * scale }, { scale: 1 - eaten * 0.7 }],
      };
    }
    return {
      opacity: v < 0.15 ? v / 0.15 : 1 - (v - 0.15) / 0.85,
      transform: [{ translateY: -v * 50 * scale }, { translateX: Math.sin(v * Math.PI * 2) * 4 * scale }],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.floaty, { left: float.x * scale - size, top: float.y * scale - size, width: size * 2, height: size * 2 }, style]}>
      <NativeText style={{ fontSize: size, lineHeight: size * 1.25 }}>{treat ? '🍪' : '💗'}</NativeText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  park: { borderRadius: 24, overflow: 'hidden' },
  spot: { position: 'absolute', width: 4, height: 4 },
  origin: { position: 'absolute', left: 0, top: 0 },
  floaty: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
});
