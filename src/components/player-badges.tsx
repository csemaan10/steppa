import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

import type { LeaderboardRow } from '@/lib/api';

type BadgeRow = Pick<LeaderboardRow, 'streak' | 'gold' | 'silver' | 'bronze'>;

/** 🔥 streak and 🥇🥈🥉 medal counts; renders nothing when there's nothing to show. */
export function PlayerBadges({ row, center }: { row: BadgeRow; center?: boolean }) {
  const theme = useTheme();
  const items: string[] = [];
  if (row.streak > 0) items.push(`🔥${row.streak}`);
  if (row.gold > 0) items.push(`🥇${row.gold}`);
  if (row.silver > 0) items.push(`🥈${row.silver}`);
  if (row.bronze > 0) items.push(`🥉${row.bronze}`);
  if (!items.length) return null;

  return (
    <View style={[styles.badges, center && styles.center]}>
      {items.map((item) => (
        <Text key={item} variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
          {item}
        </Text>
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
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  center: { justifyContent: 'center' },
  delta: { flexDirection: 'row', alignItems: 'center' },
});
