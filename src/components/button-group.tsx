import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { usePressed } from '@/hooks/use-pressed';
import { withAlpha } from '@/theme';
import { motion } from '@/theme/motion';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export type ButtonGroupOption<T extends string> = { value: T; label: string; icon?: IconName };

type Props<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  options: ButtonGroupOption<T>[];
};

const HEIGHT = 40;
const PADDING = 3;
const THUMB = HEIGHT - PADDING * 2;
const RADIUS = 12;

/**
 * A segmented control in the iOS style, so it reads as a filter rather than navigation and stays
 * distinct from the bottom tab bar (a glass capsule with a coloured pill that stretches as it
 * slides): a slightly recessed track with the options side by side, and a raised thumb under the
 * chosen one that glides over on a spring. The chosen label is in the full text colour and
 * semibold, crossfading as the thumb passes under it. Quick taps retarget from wherever the thumb
 * is. With reduced motion it fades in at the new choice instead of gliding.
 */
export function ButtonGroup<T extends string>({ value, onChange, options }: Props<T>) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  // The options share the track's inside equally; known once it's laid out.
  const [rowWidth, setRowWidth] = useState(0);
  const segment = rowWidth / options.length;
  const targetX = index * segment;

  // The thumb's left edge, in points from the inside left of the track.
  const x = useSharedValue(targetX);
  const fade = useSharedValue(1);
  const placed = useRef(false);
  useEffect(() => {
    if (!segment) return;
    // Its first place, or any with reduced motion: straight there (fading in, if it moved).
    if (!placed.current || reduceMotion) {
      const moved = placed.current && x.get() !== targetX;
      x.set(targetX);
      if (moved) {
        fade.set(0);
        fade.set(withTiming(1, motion.fade));
      }
      placed.current = true;
      return;
    }
    x.set(withSpring(targetX, motion.spatial));
  }, [x, fade, targetX, segment, reduceMotion]);

  const thumb = useAnimatedStyle(() => ({
    opacity: segment ? fade.value : 0,
    transform: [{ translateX: x.value }],
  }));

  return (
    <View
      accessibilityRole="radiogroup"
      style={[styles.track, { backgroundColor: withAlpha(theme.colors.onSurface, theme.dark ? 0.12 : 0.07) }]}
      onLayout={(e: LayoutChangeEvent) => setRowWidth(e.nativeEvent.layout.width - PADDING * 2)}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.thumb,
          {
            width: segment,
            backgroundColor: theme.dark ? withAlpha(theme.colors.onSurface, 0.16) : theme.colors.surface,
            boxShadow: theme.dark ? '0px 1px 3px rgba(0, 0, 0, 0.35)' : '0px 1px 2px rgba(0, 0, 0, 0.08), 0px 2px 8px rgba(0, 0, 0, 0.08)',
          },
          thumb,
        ]}
      />
      {options.map((option, i) => (
        <Segment
          key={option.value}
          option={option}
          x={i * segment}
          width={segment}
          thumbX={x}
          fade={fade}
          selected={i === index}
          onPress={() => onChange(option.value)}
        />
      ))}
    </View>
  );
}

type SegmentProps<T extends string> = {
  option: ButtonGroupOption<T>;
  /** Where this option sits in the track, and how wide it is (the thumb is as wide). */
  x: number;
  width: number;
  thumbX: SharedValue<number>;
  fade: SharedValue<number>;
  selected: boolean;
  onPress: () => void;
};

function Segment<T extends string>({ option, x, width, thumbX, fade, selected, onPress }: SegmentProps<T>) {
  const theme = useTheme();
  // The label dips the moment a finger lands, so a tap shows before the thumb moves.
  const { pressed, onPressIn, onPressOut } = usePressed();
  const dip = useAnimatedStyle(() => ({ transform: [{ scale: 1 - pressed.value * 0.06 }] }));
  // How much of this option the thumb covers, 0 to 1: its label turns chosen by that much.
  const onThumb = useAnimatedStyle(() => {
    const covered = width ? Math.max(0, 1 - Math.abs(thumbX.value - x) / width) : 0;
    return { opacity: covered * fade.value };
  });

  const content = (color: string, weight: '500' | '600') => (
    <>
      {option.icon ? <MaterialCommunityIcons name={option.icon} size={18} color={color} /> : null}
      {/* Shrinks slightly rather than truncating when four or more options share the width. */}
      <Text
        variant="labelLarge"
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        style={{ color, fontWeight: weight, flexShrink: 1 }}>
        {option.label}
      </Text>
    </>
  );

  return (
    <Pressable
      style={styles.flex}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={option.label}>
      <Animated.View style={[styles.segment, dip]}>
        {content(theme.colors.onSurfaceVariant, '500')}
        {/* The chosen look of the label, laid over and shown as the thumb passes under it. */}
        <Animated.View
          pointerEvents="none"
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
          style={[StyleSheet.absoluteFill, styles.segment, onThumb]}>
          {content(theme.colors.onSurface, '600')}
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

type Spot = { x: number; y: number };

/**
 * One selection marker shared by a picker's options (swatches, styles), gliding to whichever is
 * chosen rather than jumping from one to the next. Give each option `onLayout={place(i)}` and draw
 * the marker once, absolutely at the top left of the options' container, with `style`. With nothing
 * chosen (index -1) it fades away, and on the next pick it fades in where it's needed rather than
 * sliding in from its old spot. With reduced motion it always fades in at the new spot.
 */
export function useGlide(index: number) {
  const reduceMotion = useReducedMotion();
  const spots = useSharedValue<(Spot | null)[]>([]);
  const chosen = useSharedValue(index);
  useEffect(() => chosen.set(index), [chosen, index]);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const shown = useSharedValue(0);
  // Whether it has shown yet, and whether it's showing now.
  const ready = useSharedValue(false);
  const visible = useSharedValue(false);

  useAnimatedReaction(
    () => (chosen.value >= 0 ? (spots.value[chosen.value] ?? null) : null),
    (spot, previous) => {
      // Another option reporting its place changes nothing here.
      if (spot && previous && spot.x === previous.x && spot.y === previous.y) return;
      if (!spot) {
        if (visible.value) shown.set(withTiming(0, motion.fadeOut));
        visible.set(false);
        return;
      }
      if (!visible.value || reduceMotion) {
        x.set(spot.x);
        y.set(spot.y);
        // The first spot shows at once (the picker itself is only just showing); later ones fade in.
        if (!ready.value) shown.set(1);
        else {
          shown.set(0);
          shown.set(withTiming(1, motion.fade));
        }
        ready.set(true);
        visible.set(true);
        return;
      }
      x.set(withSpring(spot.x, motion.spatial));
      y.set(withSpring(spot.y, motion.spatial));
    },
    [reduceMotion]
  );

  const style = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateX: x.value }, { translateY: y.value }],
  }));

  const place = (i: number) => (e: LayoutChangeEvent) => {
    const { x: left, y: top } = e.nativeEvent.layout;
    spots.modify((list) => {
      'worklet';
      list[i] = { x: left, y: top };
      return list;
    });
  };

  return { place, style };
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', height: HEIGHT, padding: PADDING, borderRadius: RADIUS },
  thumb: { position: 'absolute', top: PADDING, left: PADDING, height: THUMB, borderRadius: RADIUS - PADDING },
  flex: { flex: 1 },
  segment: {
    height: THUMB,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
  },
});
