import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { SkiaRing } from '@/components/skia-ring';
import { THICKNESS_SCALE, useRingSettings, type RingSettings } from '@/lib/ring-style';

type Props = {
  /** Fraction of the goal; values above 1 draw a second, brighter lap. */
  progress: number;
  size?: number;
  stroke?: number;
  color: string;
  overflowColor: string;
  trackColor: string;
  /** Overrides the ring settings chosen in Settings (for the previews there). */
  settings?: Partial<RingSettings>;
  children?: ReactNode;
};

/**
 * Circular step progress in the style chosen in Settings. Classic is built from two clipped
 * half-rings (a left-half ring rotated θ inside a right-half clip reveals the arc 0..θ, and vice
 * versa); the other styles are drawn with Skia.
 */
export function ProgressRing({
  progress,
  size = 220,
  stroke: baseStroke = 18,
  color: themeColor,
  overflowColor,
  trackColor,
  settings,
  children,
}: Props) {
  const chosen = useRingSettings();
  const { style, color: chosenColor, thickness, cat } = { ...chosen, ...settings };
  const color = chosenColor ?? themeColor;
  const stroke = baseStroke * THICKNESS_SCALE[thickness];
  const value = useSharedValue(0);

  useEffect(() => {
    value.set(withTiming(Math.min(progress, 2), { duration: 1100, easing: Easing.out(Easing.cubic) }));
  }, [value, progress]);

  const lap1 = useDerivedValue(() => Math.min(Math.max(value.value, 0), 1));
  const lap2 = useDerivedValue(() => Math.min(Math.max(value.value - 1, 0), 1));
  // Past the goal the ring glows. It brightens as the arc sweeps past the goal mark, rather than
  // switching on before the ring gets there.
  const glow = useAnimatedStyle(() => ({ opacity: interpolate(value.value, [1, 1.08], [0, 1], 'clamp') }));

  return (
    <View style={{ width: size, height: size }}>
      {/* RN's boxShadow supports coloured glows on both platforms. */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { borderRadius: size / 2, boxShadow: `0 0 28px 2px ${overflowColor}88` }, glow]}
      />
      {style === 'classic' ? (
        <>
          <View
            style={[
              StyleSheet.absoluteFill,
              { borderRadius: size / 2, borderWidth: stroke, borderColor: trackColor },
            ]}
          />
          <Lap progress={lap1} size={size} stroke={stroke} color={color} />
          <Lap progress={lap2} size={size} stroke={stroke} color={overflowColor} />
        </>
      ) : (
        <SkiaRing
          style={style}
          lap1={lap1}
          lap2={lap2}
          size={size}
          stroke={stroke}
          color={color}
          overflowColor={overflowColor}
          trackColor={trackColor}
          cat={cat}
        />
      )}
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
