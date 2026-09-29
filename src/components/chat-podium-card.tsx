import { StyleSheet, View } from 'react-native';
import { Card, Icon, Text, useTheme } from 'react-native-paper';

import { FlairAvatar, FlairBadge } from '@/components/flair';
import type { LeaderboardRow } from '@/lib/api';
import { formatSteps } from '@/lib/dates';

const MEDALS = ['#E3B341', '#A8B0B8', '#C3834C'];

type Props = {
  /** Top rows for the day, already limited to people with steps. */
  rows: LeaderboardRow[];
  /** `YYYY-MM-DD` of the day summarised. */
  day: string;
  userId: string;
};

/** Small card shown in chat at the start of a day, summarising the previous day's top three. */
export function ChatPodiumCard({ rows, day, userId }: Props) {
  const theme = useTheme();
  const date = new Date(`${day}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  return (
    <Card
      mode="outlined"
      style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}
      accessibilityLabel={`Yesterday's podium: ${rows
        .map((r) => `${r.rank}. ${r.display_name}, ${formatSteps(r.total_steps)} steps`)
        .join('; ')}`}>
      <Card.Content style={styles.content}>
        <View style={styles.header}>
          <Icon source="trophy-outline" size={16} color={theme.colors.onSurfaceVariant} />
          <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>
            Yesterday&apos;s podium
          </Text>
          <Text variant="labelMedium" style={[styles.date, { color: theme.colors.onSurfaceVariant }]}>
            {date}
          </Text>
        </View>
        {rows.map((row) => {
          const me = row.user_id === userId;
          return (
            <View key={row.user_id} style={styles.row}>
              <View style={[styles.medal, { backgroundColor: MEDALS[row.rank - 1] ?? theme.colors.surfaceVariant }]}>
                <Text variant="labelSmall" style={styles.medalText}>
                  {row.rank}
                </Text>
              </View>
              <FlairAvatar
                name={row.display_name}
                color={row.avatar_color}
                icon={row.avatar_icon}
                size={24}
                flair_color={row.flair_color}
                flair_glow={row.flair_glow}
              />
              <View style={styles.nameLine}>
                <Text
                  variant="bodyMedium"
                  numberOfLines={1}
                  style={[styles.name, me && { fontWeight: '700', color: theme.colors.primary }]}>
                  {me ? 'You' : row.display_name}
                </Text>
                <FlairBadge
                  flair_icon={row.flair_icon}
                  flair_color={row.flair_color}
                  size={14}
                  fallbackColor={theme.colors.onSurfaceVariant}
                />
              </View>
              <Text variant="bodyMedium" style={styles.steps}>
                {formatSteps(row.total_steps)}
              </Text>
            </View>
          );
        })}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { alignSelf: 'center', width: '100%', maxWidth: 380, marginVertical: 8 },
  content: { gap: 8, paddingVertical: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  date: { marginLeft: 'auto' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  medal: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  medalText: { color: '#fff', fontWeight: '800' },
  nameLine: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  name: { flexShrink: 1 },
  steps: { fontVariant: ['tabular-nums'], fontWeight: '600' },
});
