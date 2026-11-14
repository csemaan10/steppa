import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { enter, layoutMove, leave } from '@/theme/motion';

type Props = {
  /** Its place in a group arriving together, for the stagger. */
  index?: number;
  /** Also animates out when it's removed (a dismissed card), rather than just vanishing. */
  exits?: boolean;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

/**
 * A block that rises into place when it first mounts and slides when what's above it changes
 * size, so nothing on the page pops or jumps. The entrance runs once per mount: re-renders and
 * reloads with the block already showing don't replay it.
 */
export function Appear({ index = 0, exits = false, style, children }: Props) {
  const reduceMotion = useReducedMotion();
  return (
    <Animated.View
      entering={enter(index, reduceMotion)}
      exiting={exits ? leave(reduceMotion) : undefined}
      layout={layoutMove}
      style={style}>
      {children}
    </Animated.View>
  );
}
