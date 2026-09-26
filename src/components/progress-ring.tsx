import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

type Props = {
  /** Fraction of the goal; values above 1 draw a second, brighter lap. */
  progress: number;
  size?: number;
  stroke?: number;
  color: string;
  overflowColor: string;
  trackColor: string;
  children?: ReactNode;
};

/**
 * Circular progress built from two clipped half-rings (no SVG needed).
 * A left-half ring rotated θ inside a right-half clip reveals the arc 0..θ, and vice versa.
 */
export function ProgressRing({
  progress,
  size = 220,
  stroke = 18,
  color,
  overflowColor,
  trackColor,
  children,
}: Props) {
  const value = useSharedValue(0);

  useEffect(() => {
    value.set(withTiming(Math.min(progress, 2), { duration: 1100, easing: Easing.out(Easing.cubic) }));
  }, [value, progress]);

  const lap1 = useDerivedValue(() => Math.min(Math.max(value.value, 0), 1));
  const lap2 = useDerivedValue(() => Math.min(Math.max(value.value - 1, 0), 1));
  const over = progress > 1;

  return (
    <View
      style={[
        { width: size, height: size },
        // RN's boxShadow supports coloured glows on both platforms.
        over && { borderRadius: size / 2, boxShadow: `0 0 28px 2px ${overflowColor}88` },
      ]}>
      <View
        style={[
          StyleSheet.absoluteFill,
          { borderRadius: size / 2, borderWidth: stroke, borderColor: trackColor },
        ]}
      />
      <Lap progress={lap1} size={size} stroke={stroke} color={color} />
      <Lap progress={lap2} size={size} stroke={stroke} color={overflowColor} />
      <View style={[StyleSheet.absoluteFill, styles.center]}>{children}</View>
    </View>
  );
}

type LapProps = { progress: SharedValue<number>; size: number; stroke: number; color: string };

function Lap({ progress, size, stroke, color }: LapProps) {
  const half = size / 2;
  const radius = (size - stroke) / 2;

  const rightStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${Math.min(progress.value, 0.5) * 360}deg` }],
  }));
  const leftStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${Math.max(progress.value - 0.5, 0) * 360}deg` }],
  }));
  const capsStyle = useAnimatedStyle(() => ({ opacity: progress.value > 0 ? 1 : 0 }));
  const endCapStyle = useAnimatedStyle(() => {
    const angle = progress.value * 2 * Math.PI;
    return {
      transform: [
        { translateX: radius * Math.sin(angle) },
        { translateY: -radius * Math.cos(angle) },
      ],
    };
  });

  const ring = { width: size, height: size, borderRadius: half, borderWidth: stroke, borderColor: color };
  const cap = {
    position: 'absolute' as const,
    width: stroke,
    height: stroke,
    borderRadius: stroke / 2,
    backgroundColor: color,
    left: half - stroke / 2,
    top: half - stroke / 2,
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Right half: shows a rotated left-half ring. */}
      <View style={[styles.clip, { left: half, width: half, height: size }]}>
        <Animated.View style={[{ width: size, height: size, marginLeft: -half }, rightStyle]}>
          <View style={[styles.clip, { width: half, height: size }]}>
            <View style={ring} />
          </View>
        </Animated.View>
      </View>
      {/* Left half: shows a rotated right-half ring. */}
      <View style={[styles.clip, { left: 0, width: half, height: size }]}>
        <Animated.View style={[{ width: size, height: size }, leftStyle]}>
          <View style={[styles.clip, { left: half, width: half, height: size }]}>
            <View style={[ring, { marginLeft: -half }]} />
          </View>
        </Animated.View>
      </View>
      {/* Rounded caps at the start (top) and end of the arc. */}
      <Animated.View style={capsStyle} pointerEvents="none">
        <View style={[cap, { transform: [{ translateY: -radius }] }]} />
        <Animated.View style={[cap, endCapStyle]} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { position: 'absolute', top: 0, overflow: 'hidden' },
  center: { alignItems: 'center', justifyContent: 'center' },
});
