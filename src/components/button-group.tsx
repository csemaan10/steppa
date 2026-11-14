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
import { glass } from '@/theme';
import { motion } from '@/theme/motion';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export type ButtonGroupOption<T extends string> = { value: T; label: string; icon?: IconName };

type Props<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  options: ButtonGroupOption<T>[];
};

const HEIGHT = 44;
const PADDING = 4;
const PILL = HEIGHT - PADDING * 2;

/**
 * A segmented control in the bottom tab bar's design: one frosted capsule with the options side by
 * side, and a single primary pill under the chosen one. On a new choice the pill slides over like the
 * tab bar's, its front edge leading and its back edge following, so it stretches mid-flight and
 * settles to size as it lands. Each label turns to the pill's colour by how much of the pill is under
 * it. Quick taps retarget from wherever the pill is. With reduced motion it fades in at the new
 * choice instead of sliding.
 */
export function ButtonGroup<T extends string>({ value, onChange, options }: Props<T>) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  // The options share the capsule's inside equally; known once it's laid out.
  const [rowWidth, setRowWidth] = useState(0);
  const segment = rowWidth / options.length;
  const targetX = index * segment;

  // The pill's two edges, in points from the inside left of the capsule.
  const left = useSharedValue(targetX);
  const right = useSharedValue(targetX + segment);
  const fade = useSharedValue(1);
  const placed = useRef(false);
  useEffect(() => {
    if (!segment) return;
    // Its first place, or any with reduced motion: straight there (fading in, if it moved).
    if (!placed.current || reduceMotion) {
      const moved = placed.current && left.get() !== targetX;
      left.set(targetX);
      right.set(targetX + segment);
      if (moved) {
        fade.set(0);
        fade.set(withTiming(1, motion.fade));
      }
      placed.current = true;
      return;
    }
    const forward = targetX > left.get();
    left.set(withSpring(targetX, forward ? motion.trailing : motion.spatial));
    right.set(withSpring(targetX + segment, forward ? motion.spatial : motion.trailing));
  }, [left, right, fade, targetX, segment, reduceMotion]);

  // Width rather than a scale, as in the tab bar, so the round ends stay round while it stretches. The
  // pill is absolutely placed with nothing laid out around it, so this lays out only the pill itself.
  const pill = useAnimatedStyle(() => ({
    opacity: segment ? fade.value : 0,
    width: Math.max(PILL, right.value - left.value),
    transform: [{ translateX: left.value }],
  }));

  return (
    <View
      accessibilityRole="radiogroup"
      style={[styles.track, glass(theme, 'small')]}
      onLayout={(e: LayoutChangeEvent) => setRowWidth(e.nativeEvent.layout.width - PADDING * 2 - StyleSheet.hairlineWidth * 2)}>
      <Animated.View pointerEvents="none" style={[styles.pill, { backgroundColor: theme.colors.primary }, pill]} />
      {options.map((option, i) => (
        <Segment
          key={option.value}
          option={option}
          x={i * segment}
          width={segment}
          left={left}
          right={right}
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
  /** Where this option sits in the capsule, and how wide it is. */
  x: number;
  width: number;
  left: SharedValue<number>;
  right: SharedValue<number>;
  fade: SharedValue<number>;
  selected: boolean;
  onPress: () => void;
};

function Segment<T extends string>({ option, x, width, left, right, fade, selected, onPress }: SegmentProps<T>) {
  const theme = useTheme();
  // The label dips the moment a finger lands, so a tap shows before the pill moves.
  const { pressed, onPressIn, onPressOut } = usePressed();
  const dip = useAnimatedStyle(() => ({ transform: [{ scale: 1 - pressed.value * 0.06 }] }));
  // How much of this option the pill covers, 0 to 1: its label takes the pill's colour by that much.
  const onPill = useAnimatedStyle(() => {
    const covered = width ? Math.max(0, Math.min(right.value, x + width) - Math.max(left.value, x)) / width : 0;
    return { opacity: Math.min(1, covered) * fade.value };
  });

  const content = (color: string) => (
    <>
      {option.icon ? <MaterialCommunityIcons name={option.icon} size={18} color={color} /> : null}
      {/* Shrinks slightly rather than truncating when four or more options share the width. */}
      <Text
        variant="labelLarge"
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        style={{ color, flexShrink: 1 }}>
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
        {content(theme.colors.onSurfaceVariant)}
        {/* The same label in the pill's colour, laid over and shown as the pill passes under it. */}
        <Animated.View
          pointerEvents="none"
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
          style={[StyleSheet.absoluteFill, styles.segment, onPill]}>
          {content(theme.colors.onPrimary)}
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
  track: { flexDirection: 'row', height: HEIGHT, padding: PADDING, borderRadius: HEIGHT / 2 },
  pill: { position: 'absolute', top: PADDING, left: PADDING, height: PILL, borderRadius: PILL / 2 },
  flex: { flex: 1 },
  segment: {
    height: PILL,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
  },
});
