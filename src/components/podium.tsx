import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { PlayerBadges, RankDelta } from '@/components/player-badges';
import { UserAvatar } from '@/components/user-avatar';
import { useCountUp } from '@/hooks/use-count-up';
import { activeAverage, type LeaderboardRow } from '@/lib/api';
import { formatSteps } from '@/lib/dates';

const HEIGHTS = [112, 84, 64];
// 3rd rises first, then 2nd, then 1st.
const DELAYS = [50, 25, 0];

type Props = {
  rows: LeaderboardRow[];
  userId: string;
  /** Show the per-active-day average (off for a single day). */
  showAverage: boolean;
  onPressUser: (userId: string) => void;
};

/** Animated top-3 podium. Remount (via `key`) to replay the animation. */
export function Podium({ rows, userId, showAverage, onPressUser }: Props) {
  const top = rows.slice(0, 3);
  // Visual order: 2nd, 1st, 3rd.
  const order = [1, 0, 2].filter((i) => i < top.length);

  return (
    <View style={styles.podium}>
      {order.map((place) => (
        <PodiumSpot
          key={top[place]!.user_id}
          row={top[place]!}
          place={place}
          showAverage={showAverage}
          isMe={top[place]!.user_id === userId}
          onPress={() => onPressUser(top[place]!.user_id)}
        />
      ))}
    </View>
  );
}

type SpotProps = { row: LeaderboardRow; place: number; showAverage: boolean; isMe: boolean; onPress: () => void };

function PodiumSpot({ row, place, showAverage, isMe, onPress }: SpotProps) {
  const theme = useTheme();
  const height = useSharedValue(0);
  const reveal = useSharedValue(0);
  const delay = DELAYS[place]!;
  const steps = useCountUp(row.total_steps, 280, delay);

  useEffect(() => {
    height.set(withDelay(delay, withSpring(HEIGHTS[place]!, { damping: 26, stiffness: 600 })));
    reveal.set(withDelay(delay, withTiming(1, { duration: 120 })));
  }, [height, reveal, delay, place]);

  const blockStyle = useAnimatedStyle(() => ({ height: height.value }));
  const headStyle = useAnimatedStyle(() => ({
    opacity: reveal.value,
    transform: [{ translateY: (1 - reveal.value) * 12 }, { scale: 0.85 + reveal.value * 0.15 }],
  }));

  const blockColors = [
    [theme.colors.primaryContainer, theme.colors.onPrimaryContainer],
    [theme.colors.secondaryContainer, theme.colors.onSecondaryContainer],
    [theme.colors.tertiaryContainer, theme.colors.onTertiaryContainer],
  ][place]!;

  return (
    <Pressable
      style={styles.spot}
      onPress={isMe ? undefined : onPress}
      accessibilityLabel={`${place + 1}: ${row.display_name}, ${formatSteps(row.total_steps)} steps`}>
      <Animated.View style={[styles.head, headStyle]}>
        {place === 0 ? <MaterialCommunityIcons name="crown" size={28} color="#E3B341" /> : null}
        <View style={[styles.avatarRing, isMe && { borderColor: theme.colors.primary }]}>
          <UserAvatar
            name={row.display_name}
            color={row.avatar_color}
            icon={row.avatar_icon}
            size={place === 0 ? 56 : 44}
          />
        </View>
        <Text variant="labelLarge" numberOfLines={1} style={styles.name}>
          {isMe ? 'You' : row.display_name}
        </Text>
        <View style={styles.stepsRow}>
          <Text variant="titleSmall">{formatSteps(steps)}</Text>
          <RankDelta rank={row.rank} prevRank={row.prev_rank} />
        </View>
        {showAverage ? (
          <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
            avg {formatSteps(activeAverage(row.total_steps, row.active_days))}/day
          </Text>
        ) : null}
        <PlayerBadges row={row} center />
      </Animated.View>
      <Animated.View style={[styles.block, { backgroundColor: blockColors[0] }, blockStyle]}>
        <Text variant="headlineMedium" style={[styles.place, { color: blockColors[1] }]}>
          {place + 1}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  podium: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingTop: 8 },
  spot: { flex: 1, alignItems: 'center' },
  head: { alignItems: 'center', gap: 4, marginBottom: 8, width: '100%' },
  avatarRing: { borderWidth: 2, borderColor: 'transparent', borderRadius: 999, padding: 2 },
  name: { maxWidth: '100%' },
  stepsRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  block: {
    width: '100%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    alignItems: 'center',
    paddingTop: 8,
    overflow: 'hidden',
  },
  place: { fontWeight: '700' },
});
