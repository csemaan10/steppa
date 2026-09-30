import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';

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
  const background = selected ? theme.colors.primary : theme.colors.secondaryContainer;
  const foreground = selected ? theme.colors.onPrimary : theme.colors.onSecondaryContainer;

  const animated = useAnimatedStyle(() => ({
    borderTopLeftRadius: withTiming(left, { duration: 180 }),
    borderBottomLeftRadius: withTiming(left, { duration: 180 }),
    borderTopRightRadius: withTiming(right, { duration: 180 }),
    borderBottomRightRadius: withTiming(right, { duration: 180 }),
    backgroundColor: withTiming(background, { duration: 180 }),
  }));

  const icon = option.icon;

  return (
    <Pressable
      style={styles.flex}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={option.label}>
      <Animated.View style={[styles.button, animated]}>
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
});
