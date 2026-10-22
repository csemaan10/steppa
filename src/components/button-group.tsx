import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, type ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

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

/** Material 3 connected button group: the selected option becomes a full pill. */
export function ButtonGroup<T extends string>({ value, onChange, options }: Props<T>) {
  return (
    <View style={styles.group} accessibilityRole="radiogroup">
      {options.map((option, i) => (
        <GroupButton
          key={option.value}
          option={option}
          selected={option.value === value}
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
  selected: boolean;
  first: boolean;
  last: boolean;
  onPress: () => void;
};

function GroupButton<T extends string>({ option, selected, first, last, onPress }: ButtonProps<T>) {
  const theme = useTheme();
  const left = selected || first ? OUTER : INNER;
  const right = selected || last ? OUTER : INNER;
  const foreground = selected ? theme.colors.onPrimary : theme.colors.onSurface;

  // Unselected options are frosted glass, so they stand off the screen's glows; the selected one
  // fills with primary. Corners and fill spring to the new selection; while held, the corners also
  // tighten and the button dips (M3 Expressive), so a tap shows before the selection changes.
  const { pressed, onPressIn, onPressOut } = usePressed();
  const leftRadius = useSharedValue(left);
  const rightRadius = useSharedValue(right);
  const on = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    leftRadius.set(withSpring(left, motion.spatial));
    rightRadius.set(withSpring(right, motion.spatial));
    on.set(withSpring(selected ? 1 : 0, motion.effects));
  }, [left, right, selected, leftRadius, rightRadius, on]);

  const shape = useAnimatedStyle(() => {
    const squeeze = 1 - pressed.value * 0.4;
    return {
      borderTopLeftRadius: leftRadius.value * squeeze,
      borderBottomLeftRadius: leftRadius.value * squeeze,
      borderTopRightRadius: rightRadius.value * squeeze,
      borderBottomRightRadius: rightRadius.value * squeeze,
    };
  });
  const dip = useAnimatedStyle(() => ({ transform: [{ scale: 1 - pressed.value * 0.03 }] }));
  const fill = useAnimatedStyle(() => ({ opacity: on.value }));

  const icon = option.icon;

  return (
    <Pressable
      style={styles.flex}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={option.label}>
      <Animated.View style={[styles.button, glass(theme, 'small'), shape, dip]}>
        {/* Shaped like the button rather than clipped by it, and over the rim, so no edge shows round it. */}
        <Animated.View
          pointerEvents="none"
          style={[styles.fill, { backgroundColor: theme.colors.primary }, shape, fill]}
        />
        {icon ? <MaterialCommunityIcons name={icon} size={18} color={foreground} /> : null}
        {/* Shrink slightly rather than truncate when four or more options share the width. */}
        <Text
          variant="labelLarge"
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
          style={{ color: foreground, flexShrink: 1 }}>
          {option.label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: { flexDirection: 'row', gap: 2 },
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
  fill: {
    position: 'absolute',
    top: -StyleSheet.hairlineWidth * 2,
    left: -StyleSheet.hairlineWidth * 2,
    right: -StyleSheet.hairlineWidth * 2,
    bottom: -StyleSheet.hairlineWidth * 2,
  },
});
