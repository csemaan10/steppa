import type { ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { interpolate, useAnimatedStyle } from 'react-native-reanimated';

import { usePressed } from '@/hooks/use-pressed';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  /** How far it dips while held. */
  pressedScale?: number;
};

/** Expressive press feedback for big tappable things like cards: dips on touch-down, springs back on release. */
export function PressableScale({ style, pressedScale = 0.98, onPressIn, onPressOut, children, ...rest }: Props) {
  const press = usePressed();
  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(press.pressed.value, [0, 1], [1, pressedScale]) }],
  }));

  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e) => {
        press.onPressIn();
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        press.onPressOut();
        onPressOut?.(e);
      }}
      style={[style, animated]}>
      {children}
    </AnimatedPressable>
  );
}
