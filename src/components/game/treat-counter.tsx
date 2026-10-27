import { useEffect, useRef, useState, type Ref } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { TREAT } from '@/components/game/colors';
import { gameMotion } from '@/components/game/game-motion';
import { STEPS_PER_TREAT } from '@/lib/api';
import { formatSteps } from '@/lib/dates';
import { glass, useAppTheme, withAlpha } from '@/theme';

/** Counts from where it was to `target`, easing out, so a change rolls rather than jumps. */
export function useRollingNumber(target: number, duration = 450): number {
  const [shown, setShown] = useState(target);
  const from = useRef(target);

  useEffect(() => {
    const start = from.current;
    if (start === target) return;
    let frame = 0;
    let began: number | null = null;
    const tick = (now: number) => {
      began ??= now;
      const t = Math.min(1, (now - began) / duration);
      const value = Math.round(start + (target - start) * (1 - Math.pow(1 - t, 3)));
      from.current = value;
      setShown(value);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return shown;
}

type Props = {
  count: number;
  /** Steps until walking earns the next one: a countdown under the count, and a ring round the cookie. */
  toNext?: number;
  onPress?: () => void;
  /** On the cookie, so treats can fly to (or from) it. */
  targetRef?: Ref<View>;
};

const RING = 34;
const RING_WIDTH = 3;

/**
 * Your treats, in a pill: a cookie and a count that rolls and bumps whenever it changes. Given the
 * steps to the next treat, a ring fills round the cookie as you walk and the steps left count down
 * under the count.
 */
export function TreatCounter({ count, toNext, onPress, targetRef }: Props) {
  const theme = useAppTheme();
  const shown = useRollingNumber(count);
  // Counts down as you walk.
  const left = useRollingNumber(toNext ?? 0);
  const bump = useSharedValue(1);
  const last = useRef(count);

  useEffect(() => {
    if (count === last.current) return;
    last.current = count;
    bump.set(withSequence(withTiming(1.22, { duration: 90, easing: Easing.out(Easing.quad) }), withTiming(1, gameMotion.settle)));
  }, [count, bump]);

  const cookie = useAnimatedStyle(() => ({ transform: [{ scale: bump.value }] }));
  const circumference = Math.PI * (RING - RING_WIDTH);
  // How far along to the next treat, never quite empty so the ring always shows where it starts.
  const walked = toNext === undefined ? 0 : Math.min(1, Math.max(0.04, 1 - toNext / STEPS_PER_TREAT));

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={`${count} ${count === 1 ? 'treat' : 'treats'}${
        toNext === undefined ? '' : `, another in ${formatSteps(toNext)} steps`
      }`}
      style={[glass(theme, 'small'), styles.pill, toNext !== undefined && styles.tight]}>
      {toNext === undefined ? (
        <Animated.View ref={targetRef} collapsable={false} style={[styles.cookie, cookie]}>
          <Text style={styles.emoji}>🍪</Text>
        </Animated.View>
      ) : (
        <View style={styles.ring}>
          <Svg width={RING} height={RING} style={StyleSheet.absoluteFill}>
            <Circle
              cx={RING / 2}
              cy={RING / 2}
              r={(RING - RING_WIDTH) / 2}
              stroke={withAlpha(TREAT.deep, 0.18)}
              strokeWidth={RING_WIDTH}
              fill="none"
            />
            <Circle
              cx={RING / 2}
              cy={RING / 2}
              r={(RING - RING_WIDTH) / 2}
              stroke={TREAT.deep}
              strokeWidth={RING_WIDTH}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${circumference} ${circumference}`}
              strokeDashoffset={circumference * (1 - walked)}
              // From twelve o'clock, clockwise.
              transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
            />
          </Svg>
          <Animated.View ref={targetRef} collapsable={false} style={[styles.cookie, styles.small, cookie]}>
            <Text style={styles.smallEmoji}>🍪</Text>
          </Animated.View>
        </View>
      )}
      <View>
        <Text style={[styles.count, toNext !== undefined && styles.countTight, { color: theme.colors.onSurface }]}>
          {shown}
        </Text>
        {toNext !== undefined ? (
          <View style={styles.countdown}>
            <Icon source="shoe-print" size={10} color={theme.colors.onSurfaceVariant} />
            <Text style={[styles.next, { color: theme.colors.onSurfaceVariant }]}>{formatSteps(left)}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingLeft: 3,
    paddingRight: 12,
    borderRadius: 18,
    marginRight: 4,
  },
  cookie: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: TREAT.face,
    borderBottomWidth: 2,
    borderBottomColor: TREAT.deep,
  },
  emoji: { fontSize: 16, lineHeight: 20 },
  count: { fontSize: 16, fontWeight: '900', fontVariant: ['tabular-nums'], minWidth: 18 },
  // With the steps to the next treat: the ring takes the pill's full height, the text two lines.
  tight: { paddingLeft: 1, gap: 5 },
  ring: { width: RING, height: RING, alignItems: 'center', justifyContent: 'center' },
  small: { width: 24, height: 24, borderRadius: 12, borderBottomWidth: 1.5 },
  smallEmoji: { fontSize: 13, lineHeight: 16 },
  countTight: { fontSize: 15, lineHeight: 17 },
  countdown: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  next: { fontSize: 10, lineHeight: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
