import type { ComponentProps, ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { Appbar } from 'react-native-paper';
import Animated, { interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { usePressed } from '@/hooks/use-pressed';
import { glass, useAppTheme } from '@/theme';

const SIZE = 40;
const ROUND = SIZE / 2;
/** Pressed shape: the disc tightens toward a rounded square while held (M3 Expressive). */
const PRESSED_RADIUS = 13;

/**
 * Top-bar buttons on a frosted glass disc, matching the cards. The disc is a view around Paper's
 * button, so the button's ripple clipping doesn't also clip the disc's shadow; the disc does the
 * press feedback (shape, dip and state layer) in place of the ripple.
 */
export function GlassAction(props: ComponentProps<typeof Appbar.Action>) {
  const { pressed, onPressIn, onPressOut } = usePressed();
  return (
    <Disc pressed={pressed}>
      <Appbar.Action
        rippleColor="transparent"
        {...props}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={[styles.button, props.style]}
      />
    </Disc>
  );
}

export function GlassBackAction(props: ComponentProps<typeof Appbar.BackAction>) {
  const { pressed, onPressIn, onPressOut } = usePressed();
  return (
    <Disc pressed={pressed}>
      <Appbar.BackAction
        rippleColor="transparent"
        {...props}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={[styles.button, props.style]}
      />
    </Disc>
  );
}

// Appbar finds its actions by display name, to colour them and to put the back button first.
GlassAction.displayName = 'Appbar.Action';
GlassBackAction.displayName = 'Appbar.BackAction';

function Disc({ pressed, children }: { pressed: SharedValue<number>; children: ReactNode }) {
  const theme = useAppTheme();
  const shape = useAnimatedStyle(() => ({
    borderRadius: interpolate(pressed.value, [0, 1], [ROUND, PRESSED_RADIUS]),
    transform: [{ scale: interpolate(pressed.value, [0, 1], [1, 0.92]) }],
  }));
  // Rounded like the disc rather than clipped by it, so the disc needs no overflow clipping.
  const stateLayer = useAnimatedStyle(() => ({
    borderRadius: interpolate(pressed.value, [0, 1], [ROUND, PRESSED_RADIUS]),
    opacity: pressed.value * 0.1,
  }));

  return (
    <Animated.View style={[styles.disc, glass(theme, 'small'), shape]}>
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.onSurface }, stateLayer]}
      />
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Paper's icon buttons are 40 across with a 6 margin all round; the disc takes over the margin.
  disc: { margin: 6 },
  button: { margin: 0 },
});
