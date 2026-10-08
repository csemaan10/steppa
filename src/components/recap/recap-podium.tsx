import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { CharacterCanvas } from '@/components/character/character-canvas';
import { CHEER_HOP } from '@/components/character/rig';
import { MEDAL_COLORS } from '@/components/character/scene-common';
import { useCountUp } from '@/hooks/use-count-up';
import type { LeaderboardRow } from '@/lib/api';
import { hashString, normalizeLook } from '@/lib/character';
import { formatSteps } from '@/lib/dates';

const SIZES = {
  full: { heights: [112, 86, 66], character: 136, gap: 8 },
  compact: { heights: [50, 38, 30], character: 92, gap: 4 },
};
/** Bronze rises first, then silver, then gold. */
const RISE = [500, 250, 0];
const RISE_MS = 550;
/** How long they cheer once they're up, before going back to their own move. */
const CHEER_MS = CHEER_HOP * 4 * 1000;
const ease = Easing.out(Easing.cubic);

type Props = {
  /** Up to three players with steps, best first. */
  podium: LeaderboardRow[];
  userId: string;
  compact?: boolean;
  /** Plays the rise when true (and replays each time it turns true). */
  play: boolean;
};

/** The day's final podium: blocks rise, the medalled characters cheer, then do their own move. */
export function RecapPodium({ podium, userId, compact = false, play }: Props) {
  const size = SIZES[compact ? 'compact' : 'full'];
  // Visual order: 2nd, 1st, 3rd.
  const order = [1, 0, 2].filter((i) => i < podium.length);
  return (
    <View style={[styles.podium, { gap: size.gap }]}>
      {order.map((slot) => (
        <Spot
          key={podium[slot]!.user_id}
          row={podium[slot]!}
          slot={slot}
          isMe={podium[slot]!.user_id === userId}
          compact={compact}
          play={play}
        />
      ))}
    </View>
  );
}

type SpotProps = { row: LeaderboardRow; slot: number; isMe: boolean; compact: boolean; play: boolean };

function Spot({ row, slot, isMe, compact, play }: SpotProps) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const size = SIZES[compact ? 'compact' : 'full'];
  // Ties share a rank, so the medal follows the rank, not the slot.
  const place = Math.min(row.rank, 3) - 1;
  const delay = RISE[slot]!;
  const rise = useSharedValue(reduceMotion ? 1 : 0);
  const steps = useCountUp(play ? row.total_steps : 0, 900, delay + 200);
  const [cheering, setCheering] = useState(!reduceMotion);

  // A smooth rise (no bounce), then a few cheering hops before their own idle move.
  useEffect(() => {
    if (!play || reduceMotion) return;
    rise.set(0);
    rise.set(withDelay(delay, withTiming(1, { duration: RISE_MS, easing: ease })));
    // On a replay they cheer again, starting as their block starts to rise.
    const start = setTimeout(() => setCheering(true), delay);
    const stop = setTimeout(() => setCheering(false), delay + RISE_MS + CHEER_MS);
    return () => {
      clearTimeout(start);
      clearTimeout(stop);
    };
  }, [play, reduceMotion, delay, rise]);

  const height = size.heights[slot]!;
  const blockStyle = useAnimatedStyle(() => ({ height: rise.value * height }));
  const headStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, rise.value * 2) }));

  const look = useMemo(() => normalizeLook(row.podium_character, row.user_id), [row.podium_character, row.user_id]);
  const seed = (hashString(row.user_id) % 1000) / 1000;
  const [block, onBlock] = [
    [theme.colors.primaryContainer, theme.colors.onPrimaryContainer],
    [theme.colors.secondaryContainer, theme.colors.onSecondaryContainer],
    [theme.colors.tertiaryContainer, theme.colors.onTertiaryContainer],
  ][place]!;

  return (
    <View
      style={styles.spot}
      accessible
      accessibilityLabel={`${place + 1}: ${isMe ? 'You' : row.display_name}, ${formatSteps(row.total_steps)} steps`}>
      <Animated.View style={[styles.head, headStyle]}>
        {/* First, so it sits behind the name and the character; the block covers its lower half. */}
        <Glow place={place} size={size.character / 2} play={play} delay={delay + RISE_MS} />
        {place === 0 && !compact ? <MaterialCommunityIcons name="crown" size={26} color="#E3B341" /> : null}
        <Text
          variant={compact ? 'labelMedium' : 'labelLarge'}
          numberOfLines={1}
          style={[styles.name, isMe && { color: theme.colors.primary, fontWeight: '700' }]}>
          {isMe ? 'You' : row.display_name}
        </Text>
        {compact ? null : (
          <Text variant="titleSmall" style={styles.steps}>
            {formatSteps(steps)}
          </Text>
        )}
        {/* Can be wider than the spot so the character stays big; the stage's sides are mostly empty. */}
        <View style={[styles.character, { width: size.character, height: size.character / 2 }]}>
          <CharacterCanvas
            look={look}
            seed={seed}
            width={size.character}
            animate={play}
            motion={cheering ? 'cheer' : undefined}
            medal={place}
          />
        </View>
      </Animated.View>
      <Animated.View style={[styles.block, { backgroundColor: block }, blockStyle]}>
        <Text variant={compact ? 'titleMedium' : 'headlineMedium'} style={[styles.place, { color: onBlock }]}>
          {place + 1}
        </Text>
      </Animated.View>
    </View>
  );
}

/** A soft medal-coloured halo behind the character that slowly breathes once the block is up. */
function Glow({ place, size, play, delay }: { place: number; size: number; play: boolean; delay: number }) {
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(reduceMotion ? 1 : 0);
  const color = MEDAL_COLORS[place]!.glow;

  useEffect(() => {
    if (!play || reduceMotion) return;
    pulse.set(0);
    pulse.set(
      withDelay(
        delay,
        withSequence(
          withTiming(1, { duration: 500, easing: ease }),
          withRepeat(withSequence(withTiming(0.7, { duration: 1400 }), withTiming(1, { duration: 1400 })), -1)
        )
      )
    );
  }, [play, reduceMotion, delay, pulse]);

  const style = useAnimatedStyle(() => ({
    opacity: pulse.value,
    transform: [{ scale: 0.9 + 0.1 * pulse.value }],
  }));

  // Centred on the body (a little below the middle of the stage), and wide enough that it fades
  // out well past the character.
  const box = size * 2.6;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.glow,
        {
          width: box,
          height: box,
          bottom: size * 0.42 - box / 2,
          marginLeft: -box / 2,
          experimental_backgroundImage: `radial-gradient(circle, ${color}AA 0%, ${color}66 18%, ${color}2E 38%, ${color}10 55%, ${color}00 70%)`,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  podium: { flexDirection: 'row', alignItems: 'flex-end' },
  spot: { flex: 1, alignItems: 'center' },
  head: { alignItems: 'center', width: '100%', gap: 2 },
  name: { maxWidth: '100%' },
  steps: { fontVariant: ['tabular-nums'], fontWeight: '700' },
  // The character stands right on the block.
  character: { marginTop: 2, marginBottom: -3 },
  glow: { position: 'absolute', left: '50%' },
  block: {
    width: '100%',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    alignItems: 'center',
    paddingTop: 6,
    overflow: 'hidden',
  },
  place: { fontWeight: '700' },
});
