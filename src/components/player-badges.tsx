import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

import { MedalIcon, StreakIcon } from '@/components/award-icons';
import type { LeaderboardRow } from '@/lib/api';

type BadgeRow = Pick<LeaderboardRow, 'streak' | 'gold' | 'silver' | 'bronze'>;

const BADGE_ICON = 16;

/** Streak and gold, silver and bronze medal counts; renders nothing when there's nothing to show. */
export function PlayerBadges({ row, center }: { row: BadgeRow; center?: boolean }) {
  const theme = useTheme();
  const items: { key: string; icon: ReactNode; count: number; label: string }[] = [];
  if (row.streak > 0) {
    const icon = <StreakIcon streak={row.streak} size={BADGE_ICON} />;
    items.push({ key: 'streak', icon, count: row.streak, label: `${row.streak}-day streak` });
  }
  (['gold', 'silver', 'bronze'] as const).forEach((medal, place) => {
    if (row[medal] > 0) {
      const icon = <MedalIcon place={place} size={BADGE_ICON} />;
      items.push({ key: medal, icon, count: row[medal], label: `${row[medal]} ${medal}` });
    }
  });
  if (!items.length) return null;

  return (
    <View style={[styles.badges, center && styles.center]}>
      {items.map((item) => (
        <View key={item.key} style={styles.badge} accessible accessibilityLabel={item.label}>
          {item.icon}
          <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            {item.count}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** ▲/▼ change in rank since yesterday. */
export function RankDelta({ rank, prevRank }: { rank: number; prevRank: number }) {
  const theme = useTheme();
  const delta = prevRank - rank;
  if (delta === 0) {
    return <MaterialCommunityIcons name="minus" size={14} color={theme.colors.outline} />;
  }
  const up = delta > 0;
  const color = up ? theme.colors.primary : theme.colors.error;
  return (
    <View
      style={styles.delta}
      accessibilityLabel={`${up ? 'Up' : 'Down'} ${Math.abs(delta)} since yesterday`}>
      <MaterialCommunityIcons name={up ? 'arrow-up-bold' : 'arrow-down-bold'} size={14} color={color} />
      <Text variant="labelSmall" style={{ color }}>
        {Math.abs(delta)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  center: { justifyContent: 'center' },
  delta: { flexDirection: 'row', alignItems: 'center' },
});
