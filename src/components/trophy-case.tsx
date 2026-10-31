import { StyleSheet, View } from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';

import { MedalIcon } from '@/components/award-icons';
import type { ProfileStats } from '@/lib/api';
import { glassCard } from '@/theme';

const MEDALS = [
  { key: 'gold', label: 'Gold' },
  { key: 'silver', label: 'Silver' },
  { key: 'bronze', label: 'Bronze' },
] as const;

export function TrophyCase({ stats }: { stats: ProfileStats }) {
  const theme = useTheme();

  return (
    <Card mode="contained" style={glassCard(theme)}>
      <Card.Title title="Trophy case" titleVariant="titleMedium" style={styles.title} />
      <Card.Content style={styles.row}>
        {MEDALS.map((m, place) => (
          <View
            key={m.key}
            style={[styles.medal, { backgroundColor: theme.colors.surface, opacity: stats[m.key] ? 1 : 0.55 }]}>
            <MedalIcon place={place} size={40} />
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
});
