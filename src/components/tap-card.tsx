import type { ComponentProps } from 'react';
import type { GestureResponderEvent } from 'react-native';
import { Card } from 'react-native-paper';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { usePressed } from '@/hooks/use-pressed';

type Props = ComponentProps<typeof Card> & { onPress: (e: GestureResponderEvent) => void };

/**
 * A Paper card you tap to open something: dips a little on touch-down and springs back on release,
 * like the group cards. The dip wraps the card, so its shadow and corners scale with it.
 */
export function TapCard({ onPressIn, onPressOut, ...props }: Props) {
  const press = usePressed();
  const dip = useAnimatedStyle(() => ({ transform: [{ scale: 1 - press.pressed.value * 0.02 }] }));
  return (
    <Animated.View style={dip}>
      <Card
        {...props}
        onPressIn={(e: GestureResponderEvent) => {
          press.onPressIn();
          onPressIn?.(e);
        }}
        onPressOut={(e: GestureResponderEvent) => {
          press.onPressOut();
          onPressOut?.(e);
        }}
      />
    </Animated.View>
  );
}
