import { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Divider, Icon, Text, useTheme } from 'react-native-paper';

import { openGroupFrom } from '@/components/expand-transition';
import { PlayerBadges, RankDelta } from '@/components/player-badges';
import { UserAvatar } from '@/components/user-avatar';
import type { GroupWithCount, LeaderboardRow } from '@/lib/api';
import { formatSteps } from '@/lib/dates';

const MEDALS = ['#E3B341', '#A8B0B8', '#C3834C'];
const TOP = 3;

type Props = { group: GroupWithCount; rows: LeaderboardRow[]; userId: string };

export function GroupPreview({ group, rows, userId }: Props) {
  const theme = useTheme();
  const myIndex = rows.findIndex((r) => r.user_id === userId);
  const showMe = myIndex >= TOP;
  const cardRef = useRef<View>(null);

  return (
    <View ref={cardRef} collapsable={false}>
    <Card
      mode="contained"
      style={{ backgroundColor: theme.colors.elevation.level1 }}
      onPress={() => openGroupFrom(cardRef.current, group.id)}>
      <Card.Title
        title={group.name}
        titleVariant="titleMedium"
        subtitle={`Today · ${group.member_count} member${group.member_count === 1 ? '' : 's'}`}
        subtitleStyle={{ color: theme.colors.onSurfaceVariant }}
        right={() => (
          <View style={styles.chevron}>
            <Icon source="chevron-right" size={24} color={theme.colors.onSurfaceVariant} />
          </View>
        )}
      />
      <Card.Content style={styles.content}>
        {rows.slice(0, TOP).map((row) => (
          <Row key={row.user_id} row={row} isMe={row.user_id === userId} />
        ))}
        {showMe ? (
          <>
            <Divider style={styles.divider} />
            <Row row={rows[myIndex]!} isMe />
          </>
        ) : null}
      </Card.Content>
    </Card>
    </View>
  );
}

function Row({ row, isMe }: { row: LeaderboardRow; isMe: boolean }) {
  const theme = useTheme();
  const rank = row.rank;
  return (
    <View
      style={[
        styles.row,
        isMe && { backgroundColor: theme.colors.primaryContainer, borderRadius: 12 },
      ]}>
      <Text
        variant="titleSmall"
        style={[styles.rank, { color: MEDALS[rank - 1] ?? theme.colors.onSurfaceVariant }]}>
        {rank}
      </Text>
      <UserAvatar name={row.display_name} color={row.avatar_color} size={32} />
      <View style={styles.name}>
        <Text
          variant="bodyLarge"
          numberOfLines={1}
          style={isMe ? { color: theme.colors.onPrimaryContainer } : undefined}>
          {isMe ? 'You' : row.display_name}
        </Text>
        <PlayerBadges row={row} />
      </View>
      <View style={styles.right}>
        <Text variant="titleSmall" style={isMe ? { color: theme.colors.onPrimaryContainer } : undefined}>
          {formatSteps(row.total_steps)}
        </Text>
        <RankDelta rank={row.rank} prevRank={row.prev_rank} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chevron: { paddingRight: 12 },
  content: { gap: 4, paddingBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6, paddingHorizontal: 8 },
  rank: { width: 18, textAlign: 'center', fontWeight: '700' },
  name: { flex: 1 },
  right: { alignItems: 'flex-end' },
  divider: { marginVertical: 4 },
});
