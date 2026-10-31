import { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { TRICK_COLOR } from '@/components/game/colors';
import { Ribbon, SparkleBurst } from '@/components/game/game-fx';
import { popIn } from '@/components/game/game-motion';
import { TrickIcon } from '@/components/trick-icon';
import type { Trick } from '@/lib/world';

const SHOWN_MS = 2300;

/**
 * Over the pet's scene when it learns a trick: the scene dims a touch, "NEW TRICK!" unfurls, the trick
 * pops up on a card with a burst of sparkles, and after a moment it all fades away by itself.
 */
export function NewTrick({ trick, onDone }: { trick: Trick; onDone: () => void }) {
  const shown = useSharedValue(1);
  const latest = useRef(onDone);
  useEffect(() => {
    latest.current = onDone;
  });

  useEffect(() => {
    function done() {
      latest.current();
    }
    shown.set(
      withDelay(
        SHOWN_MS,
        withTiming(0, { duration: 280 }, (finished) => {
          if (finished) scheduleOnRN(done);
        })
      )
    );
  }, [shown]);

  const style = useAnimatedStyle(() => ({ opacity: shown.value }));

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.wrap, style]}>
      <Animated.View entering={FadeIn.duration(200)} style={[StyleSheet.absoluteFill, styles.tint]} />
      <Ribbon text="NEW TRICK!" width={230} color={TRICK_COLOR} />
      <Animated.View entering={popIn(260)} style={styles.card}>
        <TrickIcon trick={trick.id} size={34} color={TRICK_COLOR} />
        <Text style={styles.name}>{trick.name}</Text>
      </Animated.View>
      <SparkleBurst count={12} radius={96} delay={260} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', gap: 8 },
  tint: { backgroundColor: 'rgba(20, 12, 40, 0.28)', borderRadius: 24 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 4,
    borderBottomColor: '#D7CCF7',
  },
  name: { color: '#2A1B55', fontSize: 18, fontWeight: '900' },
});
