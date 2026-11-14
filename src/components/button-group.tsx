import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, type ComponentProps } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
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
const OUTER = HEIGHT / 2;
const INNER = 8;
const GAP = 2;

/**
 * Material 3 connected button group: the selected option becomes a full pill. The pill glides from
 * the old choice to the new one (through any in between) on a spring, and each label turns to the
 * pill's colour as it passes under it, so the change reads as one thing moving.
 */
export function ButtonGroup<T extends string>({ value, onChange, options }: Props<T>) {
  const reduceMotion = useReducedMotion();
  const index = options.findIndex((o) => o.value === value);
  // Where the pill is, in options: 1.5 is halfway between the second and third.
  const at = useSharedValue(index);
  // With reduced motion the pill doesn't travel; it fades in at its new place instead.
  const fade = useSharedValue(1);
  useEffect(() => {
    if (reduceMotion) {
      if (at.get() === index) return;
      at.set(index);
      fade.set(0);
      fade.set(withTiming(1, motion.fade));
    } else {
      // Retargets from wherever it is, so quick taps never make it jump.
      at.set(withSpring(index, motion.spatial));
    }
  }, [at, fade, index, reduceMotion]);

  return (
    <View style={styles.group} accessibilityRole="radiogroup">
      {options.map((option, i) => (
        <GroupButton
          key={option.value}
          option={option}
          index={i}
          at={at}
          fade={fade}
          selected={i === index}
          first={i === 0}
          last={i === options.length - 1}
          onPress={() => onChange(option.value)}
        />
      ))}
    </View>
  );
}

type ButtonProps<T extends string> = {
  option: ButtonGroupOption<T>;
  index: number;
  at: SharedValue<number>;
  fade: SharedValue<number>;
  selected: boolean;
  first: boolean;
  last: boolean;
  onPress: () => void;
};

function GroupButton<T extends string>({ option, index, at, fade, selected, first, last, onPress }: ButtonProps<T>) {
  const theme = useTheme();
  const left = first ? OUTER : INNER;
  const right = last ? OUTER : INNER;

  // Unselected options are frosted glass, so they stand off the screen's glows; the pill is primary.
  // Each button holds its own slice of the pill, clipped to its shape and shifted by how far the pill
  // is from it, so the slices line up as one pill sliding along the row. While held, the corners
  // tighten and the button dips (M3 Expressive), so a tap shows before the selection changes.
  const { pressed, onPressIn, onPressOut } = usePressed();
  const width = useSharedValue(0);
  // 1 while the pill sits on this button, falling to 0 as it moves one place away.
  const on = useDerivedValue(() => Math.max(0, 1 - Math.abs(at.value - index)));

  const shape = useAnimatedStyle(() => {
    const squeeze = 1 - pressed.value * 0.4;
    const l = (left + (OUTER - left) * on.value) * squeeze;
    const r = (right + (OUTER - right) * on.value) * squeeze;
    return { borderTopLeftRadius: l, borderBottomLeftRadius: l, borderTopRightRadius: r, borderBottomRightRadius: r };
  });
  const dip = useAnimatedStyle(() => ({ transform: [{ scale: 1 - pressed.value * 0.03 }] }));
  const pill = useAnimatedStyle(() => ({
    // Tightens with the button while held, so its corners still fill the button's.
    borderRadius: OUTER * (1 - pressed.value * 0.4),
    // Only drawn while the pill overlaps this button (and so never before its width is known).
    opacity: Math.abs(at.value - index) < 1 ? fade.value : 0,
    transform: [{ translateX: (at.value - index) * (width.value + GAP) }],
  }));
  const onLabel = useAnimatedStyle(() => ({ opacity: on.value * fade.value }));

  const content = (color: string) => (
    <>
      {option.icon ? <MaterialCommunityIcons name={option.icon} size={18} color={color} /> : null}
      {/* Shrink slightly rather than truncate when four or more options share the width. */}
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
      onLayout={(e: LayoutChangeEvent) => width.set(e.nativeEvent.layout.width)}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={option.label}>
      <Animated.View style={[styles.button, glass(theme, 'small'), shape, dip]}>
        {/* Out over the glass rim, so no edge of it shows round the pill. A view of its own does the
            clipping, so the glass's shadow isn't clipped with it. */}
        <Animated.View pointerEvents="none" style={[styles.clip, shape]}>
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.primary }, pill]} />
        </Animated.View>
        {content(theme.colors.onSurface)}
        {/* The same label in the pill's colour, laid over and faded in as the pill arrives. */}
        <Animated.View
          pointerEvents="none"
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
          style={[StyleSheet.absoluteFill, styles.button, onLabel]}>
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
  group: { flexDirection: 'row', gap: GAP },
  flex: { flex: 1 },
  button: {
    height: HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
  },
  // Out to the glass rim's outer edge (glass() draws it at two hairlines).
  clip: {
    position: 'absolute',
    top: -StyleSheet.hairlineWidth * 2,
    left: -StyleSheet.hairlineWidth * 2,
    right: -StyleSheet.hairlineWidth * 2,
    bottom: -StyleSheet.hairlineWidth * 2,
    overflow: 'hidden',
  },
});
