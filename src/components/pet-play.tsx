import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, Text as NativeText, StyleSheet, View } from 'react-native';
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

import { WORLD_WIDTH, type PetSpot } from '@/lib/world';

// Everything eases in and out, like the rest of the app's motion: a hop rises fast and falls under
// gravity, with no spring overshoot or bounce.
const UP = Easing.out(Easing.quad);
const DOWN = Easing.in(Easing.quad);
const SWING = Easing.inOut(Easing.sin);
const STANDARD = Easing.bezier(0.2, 0, 0, 1);
const HEART = '#FF6F91';

/** The tap reactions, taken in turn. */
const REACTIONS = ['hop', 'wiggle', 'turn'] as const;

type Effect =
  | { id: number; kind: 'heart'; dx: number }
  | { id: number; kind: 'bubble'; text: string }
  | { id: number; kind: 'treat'; emoji: string }
  | { id: number; kind: 'ball' }
  | { id: number; kind: 'sparkles' };
/** An effect before it has an id (each kind keeps its own fields). */
type NewEffect<E = Effect> = E extends Effect ? Omit<E, 'id'> : never;

export type PetPlay = ReturnType<typeof usePetPlay>;

/**
 * Playing with your pet: tap it (it hops, wiggles or turns around, in turn), hold it to stroke it
 * (it squishes happily and purrs while hearts float up), give it a treat, or toss it a ball. The
 * pet's own layers move with the shared values here; hearts, treats and speech bubbles are effects
 * drawn over the scene. Pass the result to WorldScene's `play` and call the actions from buttons.
 */
export function usePetPlay(spot: PetSpot | undefined) {
  /** Scene units up. */
  const hop = useSharedValue(0);
  /** Degrees, about its feet. */
  const tilt = useSharedValue(0);
  /** 1 facing forward, -1 turned around. */
  const turn = useSharedValue(1);
  /** 0–1: squashed down while being stroked. */
  const squish = useSharedValue(0);
  /** 0–1: how much the happy face shows. */
  const joy = useSharedValue(0);
  const [effects, setEffects] = useState<Effect[]>([]);
  const nextId = useRef(0);
  const taps = useRef(0);
  const said = useRef(0);
  const stroking = useRef<ReturnType<typeof setInterval> | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      if (stroking.current) clearInterval(stroking.current);
    },
    []
  );

  function add(effect: NewEffect) {
    const id = nextId.current++;
    // One speech bubble at a time; a handful of hearts at most.
    setEffects((all) => [
      ...(effect.kind === 'bubble' ? all.filter((e) => e.kind !== 'bubble') : all).slice(-10),
      { ...effect, id } as Effect,
    ]);
  }

  /** Runs `run` after `ms`, unless the pet leaves the screen first. */
  function later(ms: number, run: () => void) {
    const timer = setTimeout(() => {
      timers.current = timers.current.filter((t) => t !== timer);
      run();
    }, ms);
    timers.current.push(timer);
  }

  function say(text?: string) {
    if (!spot) return;
    add({ kind: 'bubble', text: text ?? spot.sounds[said.current++ % spot.sounds.length]! });
  }

  function hearts(count: number) {
    for (let i = 0; i < count; i++) later(i * 140, () => add({ kind: 'heart', dx: (i % 2 ? 1 : -1) * (4 + i * 3) }));
  }

  /** The happy face, for `ms`. */
  function cheer(ms: number) {
    joy.set(withSequence(withTiming(1, { duration: 90 }), withDelay(ms, withTiming(0, { duration: 160 }))));
  }

  function jump(height: number) {
    hop.set(
      withSequence(withTiming(height, { duration: LEAP_UP, easing: UP }), withTiming(0, { duration: 210, easing: DOWN }))
    );
  }

  function tap() {
    if (!spot) return;
    const reaction = REACTIONS[taps.current++ % REACTIONS.length]!;
    const size = spot.box[3];
    if (reaction === 'hop') jump(size * 0.14);
    if (reaction === 'wiggle') {
      tilt.set(
        withSequence(
          withTiming(7, { duration: 110, easing: SWING }),
          withTiming(-7, { duration: 170, easing: SWING }),
          withTiming(5, { duration: 150, easing: SWING }),
          withTiming(0, { duration: 130, easing: SWING })
        )
      );
    }
    if (reaction === 'turn') {
      turn.set(
        withSequence(
          withTiming(-1, { duration: 260, easing: STANDARD }),
          withDelay(260, withTiming(1, { duration: 260, easing: STANDARD }))
        )
      );
    }
    cheer(700);
    say();
    hearts(2);
  }

  /** Starts stroking it: it settles down happily, purrs, and hearts keep floating up. */
  function holdStart() {
    if (!spot || stroking.current) return;
    squish.set(withTiming(1, { duration: 220, easing: STANDARD }));
    joy.set(withTiming(1, { duration: 120 }));
    say(spot.sounds[0]);
    hearts(1);
    stroking.current = setInterval(() => hearts(1), 420);
  }

  function holdEnd() {
    if (!stroking.current) return;
    clearInterval(stroking.current);
    stroking.current = null;
    squish.set(withTiming(0, { duration: 260, easing: STANDARD }));
    joy.set(withDelay(250, withTiming(0, { duration: 160 })));
  }

  /** A stroke from the Pet button: a moment of being held. */
  function stroke() {
    holdStart();
    later(1300, holdEnd);
  }

  /** A treat drops in from above, right into its mouth; it gobbles it up. */
  function treat() {
    if (!spot) return;
    add({ kind: 'treat', emoji: spot.treat });
    later(TREAT_FALL, () => {
      jump(spot.box[3] * 0.08);
      cheer(1100);
      say('Nom nom!');
      hearts(3);
    });
  }

  /**
   * Fetch: a ball is thrown in from the side and bounces twice on the way. The pet leans toward it,
   * crouches, and leaps to catch it at the top of its jump; the ball pops into sparkles.
   */
  function play() {
    if (!spot) return;
    const { dir } = fetchPath(spot);
    add({ kind: 'ball' });
    tilt.set(
      withSequence(
        withTiming(dir * 6, { duration: 350, easing: SWING }),
        withDelay(FETCH - 900, withTiming(0, { duration: 250, easing: SWING }))
      )
    );
    later(FETCH - LEAP_UP - 150, () =>
      squish.set(
        withSequence(withTiming(0.8, { duration: 150, easing: STANDARD }), withTiming(0, { duration: 110, easing: UP }))
      )
    );
    later(FETCH - LEAP_UP, () => jump(spot.box[3] * CATCH_LEAP));
    later(FETCH, () => {
      add({ kind: 'sparkles' });
      cheer(900);
      say('Got it!');
      hearts(2);
    });
  }

  function remove(id: number) {
    setEffects((all) => all.filter((e) => e.id !== id));
  }

  return { hop, tilt, turn, squish, joy, effects, remove, tap, holdStart, holdEnd, stroke, treat, play };
}

/** Wraps one of the pet's layers so it moves with the play: hops, wiggles, turns and squishes about its feet. */
export function PetBody({
  play,
  spot,
  scale,
  children,
}: {
  play: PetPlay;
  spot: PetSpot;
  scale: number;
  children: ReactNode;
}) {
  const [x, y, w, h] = spot.box;
  const feet = [(x + w / 2) * scale, (y + h) * scale, 0];
  const { hop, tilt, turn, squish } = play;
  const style = useAnimatedStyle(() => ({
    transformOrigin: feet,
    transform: [
      { translateY: -hop.get() * scale },
      { rotate: `${tilt.get()}deg` },
      { scaleX: turn.get() * (1 + squish.get() * 0.05) },
      { scaleY: 1 - squish.get() * 0.07 },
    ],
  }));
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      {children}
    </Animated.View>
  );
}

/** The pet itself, to tap or hold; a little bigger than it looks, so it's easy to hit. */
export function PetTarget({ play, spot, scale }: { play: PetPlay; spot: PetSpot; scale: number }) {
  const [x, y, w, h] = spot.box;
  const pad = 8;
  return (
    <Pressable
      onPress={play.tap}
      onLongPress={play.holdStart}
      onPressOut={play.holdEnd}
      delayLongPress={280}
      accessibilityRole="button"
      accessibilityLabel="Your pet"
      accessibilityHint="Tap to play, or hold to pet it"
      style={{
        position: 'absolute',
        left: (x - pad) * scale,
        top: (y - pad) * scale,
        width: (w + pad * 2) * scale,
        height: (h + pad * 2) * scale,
      }}
    />
  );
}

/** Hearts, speech bubbles, treats and balls, drawn over the scene. */
export function PetEffects({ play, spot, scale }: { play: PetPlay; spot: PetSpot; scale: number }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {play.effects.map((effect) => {
        const done = () => play.remove(effect.id);
        switch (effect.kind) {
          case 'heart':
            return <FloatingHeart key={effect.id} spot={spot} dx={effect.dx} scale={scale} onDone={done} />;
          case 'bubble':
            return <SpeechBubble key={effect.id} spot={spot} text={effect.text} scale={scale} onDone={done} />;
          case 'treat':
            return <FallingTreat key={effect.id} spot={spot} emoji={effect.emoji} scale={scale} onDone={done} />;
          case 'ball':
            return <FetchBall key={effect.id} spot={spot} scale={scale} onDone={done} />;
          case 'sparkles':
            return <CatchSparkles key={effect.id} spot={spot} scale={scale} onDone={done} />;
        }
      })}
    </View>
  );
}

/** 0 → 1 over `duration` from when it appears, then `onDone`. */
function useProgress(duration: number, onDone: () => void, easing = Easing.linear): SharedValue<number> {
  const p = useSharedValue(0);
  useEffect(() => {
    p.set(
      withTiming(1, { duration, easing }, (finished) => {
        if (finished) scheduleOnRN(onDone);
      })
    );
    // Runs once: each effect plays a single time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return p;
}

const HEART_SIZE = 14;

function FloatingHeart({ spot, dx, scale, onDone }: { spot: PetSpot; dx: number; scale: number; onDone: () => void }) {
  const p = useProgress(1200, onDone, UP);
  const size = HEART_SIZE * scale;
  const style = useAnimatedStyle(() => {
    const v = p.get();
    return {
      opacity: v < 0.12 ? v / 0.12 : 1 - (v - 0.12) / 0.88,
      transform: [
        { translateX: Math.sin(v * Math.PI * 2) * 4 * scale },
        { translateY: -v * 48 * scale },
        { scale: 0.6 + 0.4 * Math.min(1, v * 4) },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        styles.effect,
        { left: (spot.head[0] + dx) * scale - size / 2, top: spot.head[1] * scale - size, width: size, height: size },
        style,
      ]}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path
          d="M12 21C5 15.4 2 12.2 2 8.4 2 5.4 4.3 3 7.2 3c1.9 0 3.6 1 4.8 2.6C13.2 4 14.9 3 16.8 3 19.7 3 22 5.4 22 8.4c0 3.8-3 7-10 12.6Z"
          fill={HEART}
        />
        <Path d="M6.4 6.2c-1.3.4-2 1.6-1.9 2.8.5-1 1.3-1.7 2.4-2.1Z" fill="#FFFFFF" opacity={0.7} />
      </Svg>
    </Animated.View>
  );
}

function SpeechBubble({
  spot,
  text,
  scale,
  onDone,
}: {
  spot: PetSpot;
  text: string;
  scale: number;
  onDone: () => void;
}) {
  const p = useProgress(1400, onDone);
  const style = useAnimatedStyle(() => {
    const v = p.get();
    return {
      opacity: v < 0.08 ? v / 0.08 : v > 0.8 ? (1 - v) / 0.2 : 1,
      transform: [{ translateY: -Math.min(1, v / 0.08) * 4 * scale }],
    };
  });
  // Just beside the pet at head height, on whichever side has more room (a big pet fills the middle).
  const [boxX, , boxW] = spot.box;
  const right = WORLD_WIDTH - (boxX + boxW) >= boxX;
  const x = (right ? boxX + boxW - 6 : boxX + 6) * scale;
  return (
    <Animated.View
      style={[
        styles.effect,
        styles.bubble,
        { top: (spot.head[1] - 14) * scale },
        right ? { left: x } : { right: WORLD_WIDTH * scale - x },
        style,
      ]}>
      <NativeText style={styles.bubbleText}>{text}</NativeText>
    </Animated.View>
  );
}

/** How long a treat takes to drop into the pet's mouth. */
const TREAT_FALL = 520;

function FallingTreat({
  spot,
  emoji,
  scale,
  onDone,
}: {
  spot: PetSpot;
  emoji: string;
  scale: number;
  onDone: () => void;
}) {
  const total = TREAT_FALL + 200;
  const p = useProgress(total, onDone);
  const land = TREAT_FALL / total;
  const size = 24 * scale;
  const style = useAnimatedStyle(() => {
    const v = p.get();
    const fall = Math.min(1, v / land);
    const eaten = v > land ? (v - land) / (1 - land) : 0;
    return {
      opacity: 1 - eaten,
      transform: [{ translateY: -(1 - fall * fall) * (spot.mouth[1] + 30) * scale }, { scale: 1 - eaten * 0.7 }],
    };
  });
  return (
    <Animated.View
      style={[
        styles.effect,
        styles.center,
        { left: spot.mouth[0] * scale - size, top: spot.mouth[1] * scale - size, width: size * 2, height: size * 2 },
        style,
      ]}>
      <NativeText style={{ fontSize: size }}>{emoji}</NativeText>
    </Animated.View>
  );
}

/** How long fetch takes, from the throw to the catch. */
const FETCH = 1400;
/** How long a leap takes to reach its top. */
const LEAP_UP = 170;
/** How high the pet leaps for the catch, as a share of its height. */
const CATCH_LEAP = 0.2;
const BALL_RADIUS = 9;
/** When the ball touches the ground, as shares of the flight. */
const FIRST_BOUNCE = 0.34;
const SECOND_BOUNCE = 0.62;

/**
 * Fetch's path in scene units: thrown in from the side with more room, at about head height, it
 * lands well out from the pet, bounces in closer, then bounces up into the pet's mouth at the top
 * of its leap.
 */
function fetchPath(spot: PetSpot) {
  const [x, y, w, h] = spot.box;
  const centre = x + w / 2;
  const dir = centre < WORLD_WIDTH / 2 ? 1 : -1;
  const clampX = (v: number) => Math.min(WORLD_WIDTH - 16, Math.max(16, v));
  return {
    dir,
    start: [dir > 0 ? WORLD_WIDTH + 20 : -20, Math.max(24, spot.head[1] - 30)] as const,
    bounces: [clampX(centre + dir * (w / 2 + 70)), clampX(centre + dir * (w / 2 + 26))] as const,
    ground: y + h - BALL_RADIUS,
    catch: [centre, spot.mouth[1] - h * CATCH_LEAP] as const,
  };
}

/** A red rubber ball with a white band, drawn rather than an emoji so it looks the same everywhere. */
function Ball({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <Path d="M10 0a10 10 0 1 1 0 20a10 10 0 1 1 0-20Z" fill="#FF6F61" />
      <Path d="M10 20a10 10 0 0 1-10-10h20a10 10 0 0 1-10 10Z" fill="#E85A4F" opacity={0.6} />
      <Path d="M0.7 7.3C6 9.6 14 9.6 19.3 7.3L19.9 10.9C14 13.4 6 13.4 0.1 10.9Z" fill="#FFFFFF" />
      <Path d="M5 5.5a2.2 1.5-35 1 1 3-2.2a2.2 1.5-35 1 1-3 2.2Z" fill="#FFFFFF" opacity={0.55} />
    </Svg>
  );
}

function FetchBall({ spot, scale, onDone }: { spot: PetSpot; scale: number; onDone: () => void }) {
  const total = FETCH + 120;
  const p = useProgress(total, onDone);
  const caught = FETCH / total;
  const size = BALL_RADIUS * 2 * scale;
  const {
    start: [sx, sy],
    bounces: [b1, b2],
    ground,
    catch: [cx, cy],
  } = fetchPath(spot);

  const style = useAnimatedStyle(() => {
    const v = p.get();
    let x = cx;
    let y = cy;
    if (v < FIRST_BOUNCE) {
      // Thrown flat, falling faster and faster to the first bounce.
      const t = v / FIRST_BOUNCE;
      x = sx + (b1 - sx) * t;
      y = sy + (ground - sy) * t * t;
    } else if (v < SECOND_BOUNCE) {
      const t = (v - FIRST_BOUNCE) / (SECOND_BOUNCE - FIRST_BOUNCE);
      x = b1 + (b2 - b1) * t;
      y = ground - 46 * 4 * t * (1 - t);
    } else if (v < caught) {
      // The last bounce arcs up and over into the catch.
      const t = (v - SECOND_BOUNCE) / (caught - SECOND_BOUNCE);
      x = b2 + (cx - b2) * t;
      y = ground + (cy - ground) * t - 34 * 4 * t * (1 - t);
    }
    // Squashed for a moment as it hits the ground, then gulped down.
    const hit = Math.max(0, 1 - Math.min(Math.abs(v - FIRST_BOUNCE), Math.abs(v - SECOND_BOUNCE)) / 0.035);
    const gone = v > caught ? (v - caught) / (1 - caught) : 0;
    return {
      opacity: 1 - gone,
      transform: [
        { translateX: x * scale - size / 2 },
        { translateY: y * scale - size / 2 },
        { scaleX: (1 + hit * 0.18) * (1 - gone * 0.6) },
        { scaleY: (1 - hit * 0.24) * (1 - gone * 0.6) },
        // Rolls as it travels.
        { rotate: `${((x - sx) / BALL_RADIUS) * (180 / Math.PI)}deg` },
      ],
    };
  });

  return (
    <Animated.View style={[styles.effect, styles.origin, { width: size, height: size }, style]}>
      <Ball size={size} />
    </Animated.View>
  );
}

/** A little burst of sparkles where the ball is caught. */
function CatchSparkles({ spot, scale, onDone }: { spot: PetSpot; scale: number; onDone: () => void }) {
  const p = useProgress(520, onDone, UP);
  const [cx, cy] = fetchPath(spot).catch;
  const size = 48 * scale;
  const style = useAnimatedStyle(() => {
    const v = p.get();
    return { opacity: 1 - v * v, transform: [{ scale: 0.4 + v }, { rotate: `${v * 40}deg` }] };
  });
  return (
    <Animated.View
      style={[styles.effect, { left: cx * scale - size / 2, top: cy * scale - size / 2, width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 48 48">
        {Array.from({ length: 6 }, (_, i) => {
          const a = (i * Math.PI) / 3;
          const x = 24 + Math.cos(a) * 15;
          const y = 24 + Math.sin(a) * 15;
          const r = i % 2 ? 3.2 : 4.4;
          return (
            <Path
              key={i}
              d={`M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}Z`}
              fill={i % 2 ? '#FFFFFF' : '#FFD54F'}
            />
          );
        })}
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  effect: { position: 'absolute' },
  /** Placed entirely by its transform. */
  origin: { left: 0, top: 0 },
  center: { alignItems: 'center', justifyContent: 'center' },
  bubble: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#FFFDF8',
    boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.15)',
  },
  bubbleText: { color: '#3A2F25', fontWeight: '800', fontSize: 14 },
});
