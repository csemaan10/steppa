import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from 'react-native-paper';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { gameMotion } from '@/components/game/game-motion';
import { useAppTheme } from '@/theme';

// ---------- Ribbon ----------

const RIBBON_H = 44;
const RIBBON_TAIL = 26;
const RIBBON_DROP = 10;

/**
 * A banner ribbon with folded tails, for the big moments: "LEVEL UP!", "NEW TRICK!". It unfurls from
 * the middle out.
 */
export function Ribbon({
  text,
  width = 260,
  color,
  delay = 0,
}: {
  text: string;
  width?: number;
  color?: string;
  delay?: number;
}) {
  const theme = useAppTheme();
  const fill = color ?? theme.colors.primary;
  const unfurl = useSharedValue(0);
  useEffect(() => {
    unfurl.set(withDelay(delay, withTiming(1, gameMotion.enter)));
  }, [unfurl, delay]);
  const style = useAnimatedStyle(() => ({
    opacity: unfurl.value > 0.02 ? 1 : 0,
    transform: [{ scaleX: 0.15 + 0.85 * unfurl.value }, { scaleY: 0.6 + 0.4 * Math.min(unfurl.value, 1) }],
  }));

  const w = width;
  const inner = RIBBON_TAIL + 8;
  const tail = (left: boolean) => {
    const edge = left ? 0 : w;
    const at = left ? inner : w - inner;
    const notch = left ? RIBBON_TAIL * 0.5 : w - RIBBON_TAIL * 0.5;
    return `M${edge} ${RIBBON_DROP} H${at} V${RIBBON_H + RIBBON_DROP} H${edge} L${notch} ${RIBBON_DROP + RIBBON_H / 2} Z`;
  };
  const fold = (left: boolean) => {
    const a = left ? RIBBON_TAIL : w - RIBBON_TAIL;
    const b = left ? inner : w - inner;
    return `M${a} ${RIBBON_H} L${b} ${RIBBON_H} L${b} ${RIBBON_H + RIBBON_DROP} Z`;
  };

  return (
    <Animated.View style={[{ width: w, height: RIBBON_H + RIBBON_DROP }, style]} accessibilityRole="header">
      <Svg width={w} height={RIBBON_H + RIBBON_DROP}>
        {[true, false].map((left) => (
          <Path key={`t${left}`} d={tail(left)} fill={fill} />
        ))}
        {[true, false].map((left) => (
          <Path key={`s${left}`} d={tail(left)} fill="rgba(0,0,0,0.22)" />
        ))}
        {[true, false].map((left) => (
          <Path key={`f${left}`} d={fold(left)} fill="rgba(0,0,0,0.45)" />
        ))}
        <Rect x={RIBBON_TAIL} y={0} width={w - RIBBON_TAIL * 2} height={RIBBON_H} rx={5} fill={fill} />
        <Rect
          x={RIBBON_TAIL}
          y={0}
          width={w - RIBBON_TAIL * 2}
          height={RIBBON_H * 0.45}
          rx={5}
          fill="rgba(255,255,255,0.16)"
        />
      </Svg>
      <View style={[styles.ribbonText, { left: RIBBON_TAIL, right: RIBBON_TAIL }]}>
        <Text numberOfLines={1} adjustsFontSizeToFit style={styles.ribbonLabel}>
          {text}
        </Text>
      </View>
    </Animated.View>
  );
}

// ---------- Sunburst ----------

/** Slowly turning rays behind a reveal, with a soft glow in the middle. */
export function Sunburst({
  size,
  color = '#FFFFFF',
  rays = 14,
  spinMs = 26000,
}: {
  size: number;
  color?: string;
  rays?: number;
  spinMs?: number;
}) {
  const turn = useSharedValue(0);
  const shown = useSharedValue(0);
  useEffect(() => {
    turn.set(withRepeat(withTiming(360, { duration: spinMs, easing: Easing.linear }), -1, false));
    shown.set(withTiming(1, { duration: 500 }));
    // Stopped when it goes: in a Modal that has closed, a spin left running would keep updating
    // views that are gone, every frame.
    return () => cancelAnimation(turn);
  }, [turn, shown, spinMs]);
  const style = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ rotate: `${turn.value}deg` }, { scale: 0.7 + 0.3 * shown.value }],
  }));

  const c = size / 2;
  const half = Math.PI / rays / 2;
  const d = Array.from({ length: rays }, (_, i) => {
    const a = (i / rays) * Math.PI * 2;
    const p1 = [c + c * Math.cos(a - half), c + c * Math.sin(a - half)];
    const p2 = [c + c * Math.cos(a + half), c + c * Math.sin(a + half)];
    return `M${c} ${c} L${p1[0]!.toFixed(1)} ${p1[1]!.toFixed(1)} L${p2[0]!.toFixed(1)} ${p2[1]!.toFixed(1)} Z`;
  }).join(' ');

  return (
    <Animated.View pointerEvents="none" style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={0.55} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Path d={d} fill={color} opacity={0.14} />
        <Circle cx={c} cy={c} r={c * 0.62} fill="url(#glow)" />
      </Svg>
    </Animated.View>
  );
}

// ---------- Sparkle burst ----------

const SPARKLE_COLORS = ['#FFD54A', '#FF8FA3', '#7FD8FF', '#B9F18C', '#FFFFFF'];

/** A one-off pop of little diamonds flying outward and fading; give it a new `key` to fire it again. */
export function SparkleBurst({
  count = 10,
  radius = 46,
  delay = 0,
  style,
}: {
  count?: number;
  radius?: number;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View pointerEvents="none" style={[styles.burst, style]}>
      {Array.from({ length: count }, (_, i) => (
        <Sparkle key={i} index={i} count={count} radius={radius} delay={delay} />
      ))}
    </View>
  );
}

function Sparkle({ index, count, radius, delay }: { index: number; count: number; radius: number; delay: number }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.set(withDelay(delay + (index % 3) * 30, withTiming(1, { duration: 560, easing: Easing.out(Easing.cubic) })));
  }, [p, index, delay]);
  const angle = (index / count) * Math.PI * 2 + (index % 2) * 0.3;
  const reach = radius * (0.75 + (index % 3) * 0.15);
  const size = 5 + (index % 3) * 2;
  const style = useAnimatedStyle(() => ({
    opacity: p.value === 0 ? 0 : p.value < 0.7 ? 1 : (1 - p.value) / 0.3,
    transform: [
      { translateX: Math.cos(angle) * reach * p.value },
      { translateY: Math.sin(angle) * reach * p.value },
      { rotate: '45deg' },
      { scale: 1.2 - p.value * 0.8 },
    ],
  }));
  return (
    <Animated.View
      style={[
        styles.sparkle,
        { width: size, height: size, backgroundColor: SPARKLE_COLORS[index % SPARKLE_COLORS.length] },
        style,
      ]}
    />
  );
}

// ---------- Magic poof ----------

const PUFFS = [
  { x: 0, y: 0, r: 1 },
  { x: -0.55, y: 0.15, r: 0.7 },
  { x: 0.55, y: 0.1, r: 0.72 },
  { x: -0.3, y: -0.45, r: 0.6 },
  { x: 0.35, y: -0.4, r: 0.62 },
  { x: 0, y: 0.45, r: 0.66 },
];

/**
 * A puff of cloud that bursts over the pet as it changes into a new look, hiding the swap, then
 * clears with a scatter of sparkles. Centred on (x, y); give it a new `key` to play it again.
 */
export function MagicPoof({ x, y, size }: { x: number; y: number; size: number }) {
  return (
    <View pointerEvents="none" style={[styles.poof, { left: x, top: y }]}>
      {PUFFS.map((puff, i) => (
        <Puff key={i} index={i} dx={puff.x * size * 0.5} dy={puff.y * size * 0.5} radius={puff.r * size * 0.36} />
      ))}
      <SparkleBurst count={12} radius={size * 0.7} delay={160} />
    </View>
  );
}

function Puff({ index, dx, dy, radius }: { index: number; dx: number; dy: number; radius: number }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.set(withDelay(index * 25, withTiming(1, { duration: 620, easing: Easing.out(Easing.quad) })));
  }, [p, index]);
  // Swells fast and fades as it drifts out a little; gone by the time the new look has faded in.
  const style = useAnimatedStyle(() => ({
    opacity: p.value === 0 ? 0 : p.value < 0.35 ? 0.95 : 0.95 * (1 - (p.value - 0.35) / 0.65),
    transform: [
      { translateX: dx * (0.6 + p.value * 0.6) - radius },
      { translateY: dy * (0.6 + p.value * 0.6) - radius },
      { scale: 0.2 + Math.min(1, p.value * 2.6) * 0.9 },
    ],
  }));
  return <Animated.View style={[styles.puff, { width: radius * 2, height: radius * 2, borderRadius: radius }, style]} />;
}

// ---------- NEW badge ----------

/** A hot little "NEW" tag with a light sweeping across it every couple of seconds. */
export function NewBadge({ style }: { style?: StyleProp<ViewStyle> }) {
  const sweep = useSharedValue(0);
  useEffect(() => {
    sweep.set(
      withRepeat(
        withSequence(
          withTiming(1, { duration: 650, easing: Easing.inOut(Easing.quad) }),
          withDelay(1500, withTiming(0, { duration: 0 }))
        ),
        -1
      )
    );
    return () => cancelAnimation(sweep);
  }, [sweep]);
  const shine = useAnimatedStyle(() => ({ transform: [{ translateX: -30 + sweep.value * 80 }, { rotate: '20deg' }] }));
  return (
    <View style={[styles.newBadge, style]}>
      <Animated.View style={[styles.newShine, shine]} />
      <Text style={styles.newText}>NEW</Text>
    </View>
  );
}

// ---------- Ink stamp ----------

/** A rubber stamp that slams down and inks in: "LEARNED", "BON VOYAGE". */
export function InkStamp({
  text,
  color,
  delay = 0,
  rotate = -12,
  size = 18,
}: {
  text: string;
  color: string;
  delay?: number;
  rotate?: number;
  size?: number;
}) {
  const hit = useSharedValue(0);
  useEffect(() => {
    hit.set(withDelay(delay, withTiming(1, gameMotion.slam)));
  }, [hit, delay]);
  const style = useAnimatedStyle(() => ({
    opacity: Math.min(1, hit.value * 3) * 0.92,
    transform: [{ scale: 2.3 - 1.3 * hit.value }, { rotate: `${rotate}deg` }],
  }));
  return (
    <Animated.View pointerEvents="none" style={[styles.stamp, { borderColor: color }, style]}>
      <View style={[styles.stampInner, { borderColor: color }]}>
        <Text style={[styles.stampText, { color, fontSize: size }]}>{text}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  ribbonText: { position: 'absolute', top: 0, height: RIBBON_H, alignItems: 'center', justifyContent: 'center' },
  ribbonLabel: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 1.5,
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 0,
  },
  burst: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 0,
    height: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sparkle: { position: 'absolute', borderRadius: 1.5 },
  poof: { position: 'absolute', width: 0, height: 0 },
  puff: { position: 'absolute', backgroundColor: '#FFFFFF', boxShadow: '0 2px 8px rgba(120, 120, 160, 0.35)' },
  newBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 7,
    backgroundColor: '#FF4D6D',
    borderBottomWidth: 2,
    borderBottomColor: '#C2253F',
    overflow: 'hidden',
  },
  newShine: { position: 'absolute', top: -6, bottom: -6, width: 10, backgroundColor: 'rgba(255,255,255,0.55)' },
  newText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  stamp: { borderWidth: 3, borderRadius: 10, padding: 3 },
  stampInner: { borderWidth: 1.5, borderRadius: 7, paddingHorizontal: 12, paddingVertical: 4 },
  stampText: { fontWeight: '900', letterSpacing: 2 },
});
