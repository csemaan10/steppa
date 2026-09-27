import { StyleSheet, View } from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';

import type { ProfileStats } from '@/lib/api';
import { surfaceCard } from '@/theme';

const MEDALS = [
  { key: 'gold', emoji: '🥇', label: 'Gold' },
  { key: 'silver', emoji: '🥈', label: 'Silver' },
  { key: 'bronze', emoji: '🥉', label: 'Bronze' },
] as const;

export function TrophyCase({ stats }: { stats: ProfileStats }) {
  const theme = useTheme();

  return (
    <Card mode="contained" style={surfaceCard(theme)}>
      <Card.Title title="Trophy case" titleVariant="titleMedium" style={styles.title} />
      <Card.Content style={styles.row}>
        {MEDALS.map((m) => (
          <View
            key={m.key}
            style={[styles.medal, { backgroundColor: theme.colors.surface, opacity: stats[m.key] ? 1 : 0.55 }]}>
            <Text style={styles.emoji}>{m.emoji}</Text>
            <Text variant="headlineSmall">{stats[m.key]}</Text>
            <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              {m.label}
            </Text>
          </View>
        ))}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { paddingTop: 12, minHeight: 56 },
  row: { flexDirection: 'row', gap: 8, paddingBottom: 16 },
  medal: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 16, gap: 2 },
  emoji: { fontSize: 32 },
});
