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

import { withAlpha } from '@/theme';
import { motion } from '@/theme/motion';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export type ButtonGroupOption<T extends string> = { value: T; label: string; icon?: IconName };

type Props<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  options: ButtonGroupOption<T>[];
  /**
   * Floating over the screen (the group page's period switch, at the bottom): taller for the thumb,
   * on frosted glass with a shadow so it stands off the content scrolling under it.
   */
  floating?: boolean;
};

const HEIGHT = 40;
const PADDING = 3;
/** The floating version's height, for the room a list leaves under it. */
export const FLOATING_HEIGHT = 48;
const FLOATING_PADDING = 4;

/**
 * A segmented control in the iOS 26 manner, in the app's tonal colours: a capsule track faintly
 * tinted with the theme colour, and a glass thumb in the tonal container colour (as on tonal
 * buttons) under the chosen option. A finger landing lifts the thumb off the track; on a new choice
 * it glides over, stretched and a little see-through while it travels, and settles back down on
 * arrival. The chosen label crossfades in as the thumb passes under it. Quieter than the tab bar's
 * solid pill, so it reads as a filter rather than navigation. Quick taps retarget from wherever the
 * thumb is. With reduced motion it neither lifts nor glides: it fades in at the new choice.
 */
export function ButtonGroup<T extends string>({ value, onChange, options, floating = false }: Props<T>) {
  const theme = useTheme();
  const height = floating ? FLOATING_HEIGHT : HEIGHT;
  const pad = floating ? FLOATING_PADDING : PADDING;
  const thumbHeight = height - pad * 2;
  const rim = floating ? StyleSheet.hairlineWidth : 0;
  const reduceMotion = useReducedMotion();
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  // The options share the track's inside equally; known once it's laid out.
  const [rowWidth, setRowWidth] = useState(0);
  const segment = rowWidth / options.length;
  const targetX = index * segment;

  // Where the thumb is and where it's going (points from the inside left of the track), the option
  // width, whether a finger is down, and how far it's lifted (0 resting, 1 up).
  const x = useSharedValue(targetX);
  const goal = useSharedValue(targetX);
  const width = useSharedValue(segment);
  const held = useSharedValue(false);
  const lift = useSharedValue(0);
  const fade = useSharedValue(1);
  const placed = useRef(false);
  useEffect(() => {
    if (!segment) return;
    width.set(segment);
    goal.set(targetX);
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
    x.set(withSpring(targetX, motion.glide));
  }, [x, goal, width, fade, targetX, segment, reduceMotion]);

  // Up while a finger is down or it's still well short of where it's going; down as it arrives.
  useAnimatedReaction(
    () => !reduceMotion && (held.value || Math.abs(x.value - goal.value) > width.value * 0.15),
    (up, wasUp) => {
      if (up !== wasUp) lift.set(withSpring(up ? 1 : 0, motion.lift));
    },
    [reduceMotion]
  );

  const thumb = useAnimatedStyle(() => {
    // Stretched along the way it's going, by how far it still has to travel, while it's up.
    const away = width.value ? Math.min(1, Math.abs(x.value - goal.value) / width.value) : 0;
    const stretch = 0.22 * away * lift.value;
    return {
      opacity: (width.value ? fade.value : 0) * (1 - 0.35 * lift.value),
      transform: [
        { translateX: x.value },
        { scaleX: 1 + 0.08 * lift.value + stretch },
        { scaleY: 1 + 0.12 * lift.value - stretch * 0.25 },
      ],
    };
  });

  const tint = withAlpha(theme.colors.primary, theme.dark ? 0.1 : 0.08);
  // Floating, the tint sits on frosted glass (nearly opaque, as content scrolls under it) with a rim
  // and a soft drop shadow; inline, it's the tint alone.
  const frost = theme.dark ? withAlpha(theme.colors.background, 0.8) : 'rgba(255, 255, 255, 0.8)';
  const track = floating
    ? {
        backgroundColor: 'transparent',
        experimental_backgroundImage: `linear-gradient(${tint}, ${tint}), linear-gradient(${frost}, ${frost})`,
        borderWidth: rim,
        borderColor: theme.colors.outlineVariant,
        boxShadow: theme.dark
          ? '0px 8px 24px rgba(0, 0, 0, 0.4), 0px 1px 3px rgba(0, 0, 0, 0.3)'
          : '0px 8px 24px rgba(0, 0, 0, 0.14), 0px 1px 3px rgba(0, 0, 0, 0.08)',
      }
    : { backgroundColor: tint };

  return (
    <View
      accessibilityRole="radiogroup"
      style={[styles.track, { height, padding: pad, borderRadius: height / 2 }, track]}
      onLayout={(e: LayoutChangeEvent) => setRowWidth(e.nativeEvent.layout.width - pad * 2 - rim * 2)}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.thumb,
          {
            top: pad,
            left: pad,
            height: thumbHeight,
            borderRadius: thumbHeight / 2,
            width: segment,
            backgroundColor: theme.colors.secondaryContainer,
            borderColor: withAlpha('#FFFFFF', theme.dark ? 0.12 : 0.5),
            boxShadow: theme.dark ? '0px 1px 3px rgba(0, 0, 0, 0.35)' : '0px 1px 2px rgba(0, 0, 0, 0.06), 0px 3px 10px rgba(0, 0, 0, 0.1)',
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
          height={thumbHeight}
          thumbX={x}
          fade={fade}
          held={held}
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
  height: number;
  thumbX: SharedValue<number>;
  fade: SharedValue<number>;
  /** Set while a finger is down on any option, which lifts the thumb. */
  held: SharedValue<boolean>;
  selected: boolean;
  onPress: () => void;
};

function Segment<T extends string>({ option, x, width, height, thumbX, fade, held, selected, onPress }: SegmentProps<T>) {
  const theme = useTheme();
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
      // The thumb lifts the moment a finger lands, so the touch shows before anything moves.
      onPressIn={() => held.set(true)}
      onPressOut={() => held.set(false)}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={option.label}>
      <View style={[styles.segment, { height }]}>
        {content(theme.colors.onSurfaceVariant, '500')}
        {/* The chosen look of the label, laid over and shown as the thumb passes under it. */}
        <Animated.View
          pointerEvents="none"
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
          style={[StyleSheet.absoluteFill, styles.segment, { height }, onThumb]}>
          {content(theme.colors.onSecondaryContainer, '600')}
        </Animated.View>
      </View>
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
  // Height, padding and corners depend on whether it floats (see ButtonGroup).
  track: { flexDirection: 'row' },
  thumb: { position: 'absolute', borderWidth: StyleSheet.hairlineWidth },
  flex: { flex: 1 },
  segment: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
  },
});
