import { useCallback, useEffect, type ComponentProps, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { Appbar, Icon } from 'react-native-paper';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { usePressed } from '@/hooks/use-pressed';
import { glass, useAppTheme } from '@/theme';
import { motion } from '@/theme/motion';

const SIZE = 40;
const ROUND = SIZE / 2;
/** Pressed shape: the disc tightens toward a rounded square while held (M3 Expressive). */
const PRESSED_RADIUS = 13;

type ActionProps = ComponentProps<typeof Appbar.Action> & {
  /** Turns the icon while something it started is still going, like a sync. */
  spinning?: boolean;
};

/**
 * Top-bar buttons on a frosted glass disc, matching the cards. The disc is a view around Paper's
 * button, so the button's ripple clipping doesn't also clip the disc's shadow; the disc does the
 * press feedback (shape, dip and state layer) in place of the ripple.
 */
export function GlassAction({ spinning, ...props }: ActionProps) {
  const { pressed, onPressIn, onPressOut } = usePressed();
  const source = props.icon;
  // Paper crossfades the icon whenever its source changes identity, so the spinning icon is one
  // function for good and hears about starting and stopping through a shared value.
  const spin = useSharedValue(!!spinning);
  useEffect(() => spin.set(!!spinning), [spin, spinning]);
  const spinningIcon = useCallback(
    ({ size, color }: { size: number; color: string }) => <Spinner spin={spin} size={size} color={color} source={source} />,
    [spin, source]
  );
  return (
    <Disc pressed={pressed}>
      <Appbar.Action
        rippleColor="transparent"
        {...props}
        icon={spinning === undefined ? source : spinningIcon}
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

/**
 * One turn every 0.9 s while it spins. When it stops it carries its speed on to the next upright
 * position and settles there, rather than halting mid-turn.
 */
function Spinner({
  spin,
  size,
  color,
  source,
}: {
  spin: SharedValue<boolean>;
  size: number;
  color: string;
  source: ComponentProps<typeof Icon>['source'];
}) {
  const reduceMotion = useReducedMotion();
  const turn = useSharedValue(0);
  useAnimatedReaction(
    () => spin.get() && !reduceMotion,
    (on, was) => {
      if (on === was) return;
      if (on) {
        // From wherever it is, so stopping and starting again never jumps.
        const from = turn.get();
        turn.set(withRepeat(withTiming(from + 1, { duration: 900, easing: Easing.linear }), -1));
      } else if (was) {
        cancelAnimation(turn);
        // At least a tenth of a turn to slow down over, so it eases into place without swinging back.
        turn.set(withSpring(Math.ceil(turn.get() + 0.1), { ...motion.smooth, velocity: 1 / 0.9 }));
      }
    },
    [reduceMotion]
  );
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 360}deg` }] }));
  return (
    <Animated.View style={style}>
      <Icon source={source} size={size} color={color} />
    </Animated.View>
  );
}

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
