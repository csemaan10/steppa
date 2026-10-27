import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { ActivityIndicator, Icon, Text } from 'react-native-paper';
import Animated, { interpolate, useAnimatedStyle } from 'react-native-reanimated';

import { usePressed } from '@/hooks/use-pressed';
import { useAppTheme, withAlpha } from '@/theme';

type Mode = 'text' | 'outlined' | 'contained' | 'contained-tonal';

type Props = {
  mode?: Mode;
  icon?: ComponentProps<typeof Icon>['source'];
  /** After the label, e.g. a dropdown's chevron. */
  trailingIcon?: ComponentProps<typeof Icon>['source'];
  onPress?: () => void;
  disabled?: boolean;
  /** Shows a spinner in place of the icon. */
  loading?: boolean;
  /** Tighter side padding, for buttons sharing a row. */
  compact?: boolean;
  textColor?: string;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  children: ReactNode;
};

const HEIGHT = 40;
const ROUND = HEIGHT / 2;
/** Pressed shape: the corners tighten toward square while held, the Expressive signature. */
const PRESSED_RADIUS = 10;
const ICON_SIZE = 18;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Material 3 Expressive button, standing in for Paper's with the same modes, sizes and colours. On
 * touch-down its corners tighten from round toward square, it dips a little and a state layer shows;
 * letting go springs it back. (Paper's button can't animate its shape, so this replaces it.)
 */
export function Button({
  mode = 'text',
  icon,
  trailingIcon,
  onPress,
  disabled,
  loading,
  compact,
  textColor,
  style,
  contentStyle,
  accessibilityLabel,
  children,
}: Props) {
  const theme = useAppTheme();
  const { pressed, onPressIn, onPressOut } = usePressed();
  const text = mode === 'text';
  const filled = mode === 'contained' || mode === 'contained-tonal';
  const faint = withAlpha(theme.colors.onSurface, 0.12);

  const color = disabled
    ? withAlpha(theme.colors.onSurface, 0.38)
    : (textColor ??
      (mode === 'contained'
        ? theme.colors.onPrimary
        : mode === 'contained-tonal'
          ? theme.colors.onSecondaryContainer
          : theme.colors.primary));
  const background = !filled
    ? 'transparent'
    : disabled
      ? faint
      : mode === 'contained'
        ? theme.colors.primary
        : theme.colors.secondaryContainer;

  // Paper's MD3 spacing: 24 each side (12 for text buttons), 16 beside an icon, 8 when compact.
  const leading = icon || loading;
  const paddingLeft = compact ? (leading && text ? 6 : 8) : leading ? (text ? 12 : 16) : text ? 12 : 24;
  const paddingRight = compact ? 8 : trailingIcon ? (text ? 12 : 16) : text ? (leading ? 16 : 12) : 24;

  const shape = useAnimatedStyle(() => ({
    borderRadius: interpolate(pressed.value, [0, 1], [ROUND, PRESSED_RADIUS]),
    transform: [{ scale: interpolate(pressed.value, [0, 1], [1, 0.97]) }],
  }));
  const stateLayer = useAnimatedStyle(() => ({ opacity: pressed.value * 0.1 }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      style={[
        styles.button,
        { backgroundColor: background },
        mode === 'outlined' && { borderWidth: 1, borderColor: disabled ? faint : theme.colors.outline },
        style,
        shape,
      ]}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: color }, stateLayer]} />
      <View style={[styles.content, { paddingLeft, paddingRight }, contentStyle]}>
        {loading ? (
          <ActivityIndicator size={ICON_SIZE} color={color} />
        ) : icon ? (
          <Icon source={icon} size={ICON_SIZE} color={color} />
        ) : null}
        <Text variant="labelLarge" numberOfLines={1} style={{ color }}>
          {children}
        </Text>
        {trailingIcon ? <Icon source={trailingIcon} size={ICON_SIZE} color={color} /> : null}
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: { minWidth: 64, overflow: 'hidden' },
  content: { minHeight: HEIGHT, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
});
