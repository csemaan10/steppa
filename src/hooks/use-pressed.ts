import { useSharedValue, withSpring } from 'react-native-reanimated';

import { motion } from '@/theme/motion';

/**
 * Press state for Expressive feedback: 0 at rest, 1 while held. Spread `onPressIn`/`onPressOut` onto
 * a Pressable and drive animated styles from `pressed`. Both fire on touch-down and lift-off, before
 * `onPress`, so the feedback never waits on the action.
 */
export function usePressed() {
  const pressed = useSharedValue(0);
  return {
    pressed,
    onPressIn: () => pressed.set(withSpring(1, motion.press)),
    onPressOut: () => pressed.set(withSpring(0, motion.release)),
  };
}
