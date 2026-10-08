import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

const CONFETTI_COLORS = ['#F5CD4B', '#E5484D', '#3B82F6', '#22A06B', '#A855F7', '#FB923C', '#EC4899'];
const PIECES = 14;

type Piece = { x: number; delay: number; duration: number; sway: number; spin: number; w: number; h: number; color: string };

/** Pseudo-random but stable per index, so pieces don't jump between renders. */
function rand(i: number, k: number): number {
  const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

type ConfettiProps = { width: number; height: number; /** Each time this turns true, a burst falls. */ play: boolean };

/** Confetti falling over the whole area; touches pass through. */
export function Confetti({ width, height, play }: ConfettiProps) {
  const reduceMotion = useReducedMotion();
  const pieces = useMemo<Piece[]>(
    () =>
      Array.from({ length: PIECES }, (_, i) => ({
        x: rand(i, 1) * width,
        delay: rand(i, 2) * 900,
        duration: 2200 + rand(i, 3) * 1600,
        sway: 10 + rand(i, 4) * 26,
        spin: (rand(i, 5) - 0.5) * 1440,
        w: 6 + rand(i, 6) * 5,
        h: 9 + rand(i, 7) * 7,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length]!,
      })),
    [width]
  );
  if (reduceMotion || width === 0) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p, i) => (
        <ConfettiPiece key={i} piece={p} height={height} play={play} />
      ))}
    </View>
  );
}

function ConfettiPiece({ piece, height, play }: { piece: Piece; height: number; play: boolean }) {
  const t = useSharedValue(0);

  useEffect(() => {
    if (!play) return;
    t.set(0);
    t.set(withDelay(piece.delay, withTiming(1, { duration: piece.duration, easing: Easing.in(Easing.quad) })));
  }, [play, piece, t]);

  const style = useAnimatedStyle(() => ({
    opacity: t.value === 0 || t.value === 1 ? 0 : t.value > 0.85 ? (1 - t.value) / 0.15 : 1,
    transform: [
      { translateX: piece.x + Math.sin(t.value * Math.PI * 4) * piece.sway },
      { translateY: -20 + t.value * (height + 40) },
      { rotate: `${t.value * piece.spin}deg` },
      // Tumbling: the piece flips edge-on and back.
      { scaleX: Math.cos(t.value * Math.PI * 6) },
    ],
  }));

  return <Animated.View style={[styles.piece, { width: piece.w, height: piece.h, backgroundColor: piece.color }, style]} />;
}

/** A grey cloud bobbing over someone's head, with rain falling from it. */
export function RainCloud({ size = 44, color }: { size?: number; color: string }) {
  const reduceMotion = useReducedMotion();
  const bob = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    bob.set(withRepeat(withSequence(withTiming(1, { duration: 1400 }), withTiming(0, { duration: 1400 })), -1));
  }, [bob, reduceMotion]);

  const cloudStyle = useAnimatedStyle(() => ({ transform: [{ translateY: bob.value * 3 }] }));

  return (
    <Animated.View style={[{ width: size, alignItems: 'center' }, cloudStyle]} pointerEvents="none">
      <MaterialCommunityIcons name="cloud" size={size} color={color} />
      <View style={[styles.rain, { width: size * 0.6, height: size * 0.45, marginTop: -size * 0.22 }]}>
        {[0, 1, 2, 3].map((i) => (
          <Drop key={i} index={i} span={size * 0.45} reduceMotion={reduceMotion} />
        ))}
      </View>
    </Animated.View>
  );
}

function Drop({ index, span, reduceMotion }: { index: number; span: number; reduceMotion: boolean }) {
  const t = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    t.set(withDelay(index * 230, withRepeat(withTiming(1, { duration: 900, easing: Easing.in(Easing.quad) }), -1)));
  }, [t, index, reduceMotion]);

  const style = useAnimatedStyle(() => fall(t));
  return <Animated.View style={[styles.drop, { left: (index / 3) * span }, style]} />;
}

function fall(t: SharedValue<number>) {
  'worklet';
  return { opacity: 1 - t.value, transform: [{ translateY: t.value * 14 }] };
}

const styles = StyleSheet.create({
  piece: { position: 'absolute', top: 0, left: 0, borderRadius: 2 },
  rain: { position: 'relative' },
  drop: { position: 'absolute', top: 0, width: 2.5, height: 7, borderRadius: 2, backgroundColor: '#5BB8F5' },
});
