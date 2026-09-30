import { useFocusEffect } from 'expo-router';
import { useCallback, useId } from 'react';
import Animated, {
  useAnimatedProps,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Gradient bottom → top for one flame layer. */
type Stops = readonly [string, string];

export type FlameTier = {
  /** Size of the fire inside its box, 0–1. */
  scale: number;
  /** How lively it moves; 0 holds still. */
  amp: number;
  /** Halo opacity; 0 for none. */
  glow: number;
  sparks: number;
  outer: Stops;
  middle: Stops;
  inner: Stops;
};

const ORANGE = {
  outer: ['#FF3D00', '#FF9100'],
  middle: ['#FF9100', '#FFC400'],
  inner: ['#FFEA00', '#FFF8E1'],
} as const;

/** The fire grows, gets livelier and hotter the longer the streak runs; blue at 30+ days. */
export function flameTier(streak: number): FlameTier {
  if (streak <= 0) {
    return {
      scale: 0.6,
      amp: 0,
      glow: 0,
      sparks: 0,
      outer: ['#9E9E9E', '#BDBDBD'],
      middle: ['#BDBDBD', '#D6D6D6'],
      inner: ['#E0E0E0', '#F5F5F5'],
    };
  }
  if (streak < 3) return { scale: 0.66, amp: 0.7, glow: 0, sparks: 0, ...ORANGE };
  if (streak < 7) return { scale: 0.76, amp: 0.85, glow: 0.25, sparks: 0, ...ORANGE };
  if (streak < 14) return { scale: 0.86, amp: 1, glow: 0.4, sparks: 2, ...ORANGE };
  if (streak < 30) {
    return {
      scale: 0.95,
      amp: 1.1,
      glow: 0.55,
      sparks: 3,
      outer: ['#DD2C00', '#FF6D00'],
      middle: ['#FF6D00', '#FFD600'],
      inner: ['#FFFF00', '#FFFDE7'],
    };
  }
  // Blue flames burn hottest.
  return {
    scale: 1,
    amp: 1.15,
    glow: 0.6,
    sparks: 4,
    outer: ['#2962FF', '#448AFF'],
    middle: ['#00B0FF', '#80D8FF'],
    inner: ['#E1F5FE', '#FFFFFF'],
  };
}

// Drawing space is 100 × 120; the fire stands on (CX, BY).
const CX = 50;
const BY = 114;
const TAU = Math.PI * 2;
/** Flame layers: [name, base radius, height, phase]. */
const LAYERS = [
  ['outer', 32, 104, 0],
  ['middle', 22, 76, 0.37],
  ['inner', 13, 48, 0.71],
] as const;

/**
 * Teardrop flame: round base of radius r, tip `s` off-centre at height h. `lick` pushes the
 * upper sides in opposite directions for an uneven edge.
 */
function flamePath(r: number, h: number, s: number, lick: number): string {
  'worklet';
  const k = (h - r) * 0.35;
  const f = (n: number) => n.toFixed(2);
  return (
    `M${f(CX - r)} ${f(BY - r)}A${f(r)} ${f(r)} 0 0 0 ${f(CX + r)} ${f(BY - r)}` +
    `C${f(CX + r)} ${f(BY - r - k)} ${f(CX + r * 0.3 + s * 0.5 + lick)} ${f(BY - h * 0.7)} ${f(CX + s)} ${f(BY - h)}` +
    `C${f(CX - r * 0.3 + s * 0.5 - lick)} ${f(BY - h * 0.7)} ${f(CX - r)} ${f(BY - r - k)} ${f(CX - r)} ${f(BY - r)}Z`
  );
}

type Props = { streak: number; width?: number };

/** Animated streak fire: three flickering flame layers, a halo, and rising sparks on longer streaks. */
export function StreakFlame({ streak, width = 56 }: Props) {
  const tier = flameTier(streak);
  const id = useId().replace(/:/g, '');
  const reduceMotion = useReducedMotion();
  const time = useSharedValue(0);
  const animate = tier.amp > 0 && !reduceMotion;

  const clock = useFrameCallback((frame) => {
    time.value = frame.timeSinceFirstFrame / 1000;
  }, false);

  // Only run the clock while this screen is focused (Home and Profile stay mounted in the tabs).
  useFocusEffect(
    useCallback(() => {
      clock.setActive(animate);
      return () => clock.setActive(false);
    }, [clock, animate])
  );

  const height = (width * 120) / 100;
  const grad = (name: string, [bottom, top]: Stops) => (
    <LinearGradient id={`${id}-${name}`} x1="0" y1="1" x2="0" y2="0">
      <Stop offset="0" stopColor={bottom} />
      <Stop offset="1" stopColor={top} />
    </LinearGradient>
  );

  return (
    <Svg
      width={width}
      height={height}
      viewBox="0 0 100 120"
      accessibilityLabel={`Streak flame, ${streak} day${streak === 1 ? '' : 's'}`}>
      <Defs>
        {grad('outer', tier.outer)}
        {grad('middle', tier.middle)}
        {grad('inner', tier.inner)}
        <RadialGradient id={`${id}-glow`}>
          <Stop offset="0" stopColor={tier.outer[1]} stopOpacity={0.9} />
          <Stop offset="1" stopColor={tier.outer[1]} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      {tier.glow > 0 ? <Glow time={time} tier={tier} fill={`url(#${id}-glow)`} /> : null}
      {LAYERS.map(([name, r, h, phase]) => (
        <Layer key={name} time={time} tier={tier} r={r} h={h} phase={phase} fill={`url(#${id}-${name})`} />
      ))}
      {Array.from({ length: tier.sparks }, (_, i) => (
        <Spark key={i} time={time} tier={tier} index={i} />
      ))}
    </Svg>
  );
}

type Anim = { time: SharedValue<number>; tier: FlameTier };

function Layer({ time, tier, r, h, phase, fill }: Anim & { r: number; h: number; phase: number; fill: string }) {
  const { amp: a, scale: k } = tier;
  const animatedProps = useAnimatedProps(() => {
    const t = time.value;
    const p = phase;
    const s = a * (r * 0.25 * Math.sin(TAU * (0.9 * t + p)) + r * 0.12 * Math.sin(TAU * (2.3 * t + p * 1.7)));
    const hh = h * (1 + a * (0.06 * Math.sin(TAU * (1.7 * t + p)) + 0.03 * Math.sin(TAU * (3.1 * t + p))));
    const rr = r * (1 + a * 0.03 * Math.sin(TAU * (1.3 * t + p + 0.3)));
    const lick = a * r * 0.15 * Math.sin(TAU * (2.7 * t + p * 2));
    // Scale about the base so smaller fires still stand on the same spot.
    return { d: flamePath(rr * k, hh * k, s * k, lick * k) };
  });
  return <AnimatedPath animatedProps={animatedProps} fill={fill} />;
}

function Glow({ time, tier, fill }: Anim & { fill: string }) {
  const animatedProps = useAnimatedProps(() => ({
    opacity: tier.glow * (0.8 + 0.2 * Math.sin(TAU * 1.1 * time.value)),
  }));
  const k = tier.scale;
  return (
    <AnimatedEllipse
      animatedProps={animatedProps}
      cx={CX}
      cy={BY - 44 * k}
      rx={50 * k}
      ry={58 * k}
      fill={fill}
    />
  );
}

/** A spark rises off the fire, drifts, shrinks and fades, then starts again. */
function Spark({ time, tier, index }: Anim & { index: number }) {
  const n = tier.sparks;
  const k = tier.scale;
  const side = index % 2 ? 1 : -1;
  const animatedProps = useAnimatedProps(() => {
    const q = (time.value / 1.3 + index / n) % 1;
    return {
      cx: CX + (side * (6 + q * 14) + Math.sin(q * 7 + index) * 4) * k,
      cy: BY - (40 + q * 78) * k,
      r: (2.6 * (1 - q) + 0.4) * k,
      opacity: Math.sin(Math.PI * q),
    };
  });
  return <AnimatedCircle animatedProps={animatedProps} fill={tier.inner[0]} />;
}
