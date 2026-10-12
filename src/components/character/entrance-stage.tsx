// A character making their entrance onto a podium block: the character itself flies, jumps or
// swings in, with the effects of the entrance round it. Everything follows one clock (seconds
// since the entrance started; negative means it hasn't started and nothing shows).

import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { entranceState, type EntranceKind } from '@/components/character/entrance';
import { EntranceFx } from '@/components/character/entrance-fx';

type Props = {
  kind: EntranceKind;
  clock: SharedValue<number>;
  /** The character's width in points (its height is half). */
  width: number;
  /** The block's height, which is how far below its final spot the character starts. */
  ground: number;
  /** Shows the effects canvas; turn it off once the entrance is over so it isn't kept on screen. */
  fx?: boolean;
  /** The character canvas. */
  children: ReactNode;
};

let front = 0;

/**
 * A zIndex above every spot brought to the front before. Podium spots are side by side, so an
 * entrance's effects (a car or horse going off, say) would otherwise pass under the spots after it.
 */
export function bringToFront(): number {
  return ++front;
}

export function EntranceStage({ kind, clock, width, ground, fx = true, children }: Props) {
  const H = width / 2;
  const mover = useAnimatedStyle(() => {
    const s = entranceState(kind, clock.value, H, ground);
    return {
      opacity: s.o,
      transform: [{ translateX: s.x }, { translateY: s.y }, { rotate: `${s.rot}rad` }],
    };
  });
  const squash = useAnimatedStyle(() => {
    const s = entranceState(kind, clock.value, H, ground);
    return { transform: [{ scaleX: s.sx }, { scaleY: s.sy }] };
  });

  return (
    <View style={{ width, height: H }}>
      {fx ? <EntranceFx kind={kind} clock={clock} width={width} ground={ground} /> : null}
      <Animated.View style={mover}>
        <Animated.View style={[styles.squash, squash]}>{children}</Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Squash and stretch from the feet.
  squash: { transformOrigin: 'center bottom' },
});
