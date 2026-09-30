import { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Icon, Text, useTheme } from 'react-native-paper';

import { openGroupFrom } from '@/components/expand-transition';
import { PlayerBadges, RankDelta } from '@/components/player-badges';
import { GroupAvatar } from '@/components/group-avatar';
import { UserAvatar } from '@/components/user-avatar';
import type { GroupWithCount, LeaderboardRow } from '@/lib/api';
import { getLastRead } from '@/lib/chat-read';
import { formatSteps } from '@/lib/dates';
import { surfaceCard, withAlpha } from '@/theme';

const MEDALS = ['#E3B341', '#A8B0B8', '#C3834C'];
const TOP = 3;

type Props = {
  group: GroupWithCount;
  rows: LeaderboardRow[];
  userId: string;
  /** Newest message someone else posted, for the unread dot on the chat icon. */
  latestMessageId?: number | null;
  showOwner?: boolean;
};

export function GroupPreview({ group, rows, userId, latestMessageId, showOwner }: Props) {
  const theme = useTheme();
  const myIndex = rows.findIndex((r) => r.user_id === userId);
  const showMe = myIndex >= TOP;
  const leader = Math.max(rows[0]?.total_steps ?? 0, 1);
  const cardRef = useRef<View>(null);
  // Same "last read" marker as the Chat tab's dot, so opening the chat clears both.
  const unreadChat = !!latestMessageId && latestMessageId > getLastRead(group.id);

  return (
    <View ref={cardRef} collapsable={false}>
      <Card mode="contained" style={surfaceCard(theme)} onPress={() => openGroupFrom(cardRef.current, group.id)}>
        <View style={styles.header}>
          <GroupAvatar name={group.name} color={group.color} icon={group.icon} />
          <View style={styles.headerText}>
            <View style={styles.titleRow}>
              <Text variant="titleMedium" numberOfLines={1} style={styles.title}>
                {group.name}
              </Text>
              {showOwner && group.owner_id === userId ? (
                <View style={[styles.badge, { backgroundColor: theme.colors.tertiaryContainer }]}>
                  <Text variant="labelSmall" style={{ color: theme.colors.onTertiaryContainer }}>
                    Owner
                  </Text>
                </View>
              ) : null}
            </View>
            <View style={styles.meta}>
              <Icon source="account-multiple" size={14} color={theme.colors.onSurfaceVariant} />
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                {group.member_count} · Today
              </Text>
              <View
                style={styles.chat}
                accessibilityLabel={unreadChat ? 'Unread chat messages' : 'Chat'}>
                <Icon source="chat-outline" size={14} color={theme.colors.onSurfaceVariant} />
                {unreadChat ? <View style={[styles.chatDot, { backgroundColor: theme.colors.error }]} /> : null}
              </View>
            </View>
          </View>
          <Icon source="chevron-right" size={24} color={theme.colors.onSurfaceVariant} />
        </View>

        <View style={styles.content}>
          {rows.length === 0 ? (
            <Text variant="bodyMedium" style={[styles.empty, { color: theme.colors.onSurfaceVariant }]}>
              No steps yet today
            </Text>
          ) : null}
          {rows.slice(0, TOP).map((row) => (
            <Row key={row.user_id} row={row} leader={leader} isMe={row.user_id === userId} />
          ))}
          {showMe ? (
            <>
              <View style={styles.gap}>
                {[0, 1, 2].map((i) => (
                  <View key={i} style={[styles.dot, { backgroundColor: theme.colors.outlineVariant }]} />
                ))}
              </View>
              <Row row={rows[myIndex]!} leader={leader} isMe />
            </>
          ) : null}
        </View>
      </Card>
    </View>
  );
}

function Row({ row, leader, isMe }: { row: LeaderboardRow; leader: number; isMe: boolean }) {
  const theme = useTheme();
  const medal = MEDALS[row.rank - 1];
  const progress = Math.min(row.total_steps / leader, 1);

  return (
    <View
      style={[
        styles.row,
        isMe && {
          backgroundColor: withAlpha(theme.colors.primary, theme.dark ? 0.16 : 0.1),
          borderColor: withAlpha(theme.colors.primary, 0.35),
        },
      ]}>
      <View
        style={[
          styles.rank,
          medal ? { backgroundColor: medal } : { backgroundColor: theme.colors.surfaceVariant },
        ]}>
        <Text
          variant="labelMedium"
          style={{ color: medal ? '#fff' : theme.colors.onSurfaceVariant, fontWeight: '800' }}>
          {row.rank}
        </Text>
      </View>
      <UserAvatar
        name={row.display_name}
        color={row.avatar_color}
        icon={row.avatar_icon}
        size={34}
      />
      <View style={styles.name}>
        <View style={styles.nameLine}>
          <Text variant="bodyLarge" numberOfLines={1} style={[styles.nameText, isMe && { fontWeight: '700' }]}>
            {isMe ? 'You' : row.display_name}
          </Text>
          <PlayerBadges row={row} />
        </View>
        <View style={[styles.track, { backgroundColor: withAlpha(theme.colors.onSurfaceVariant, 0.12) }]}>
          <View
            style={[
              styles.fill,
              { width: `${progress * 100}%`, backgroundColor: medal ?? theme.colors.primary },
            ]}
          />
        </View>
      </View>
      <View style={styles.right}>
        <Text variant="titleSmall" style={styles.steps}>
          {formatSteps(row.total_steps)}
        </Text>
        <RankDelta rank={row.rank} prevRank={row.prev_rank} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, paddingBottom: 12 },
  headerText: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flexShrink: 1 },
  chat: { marginLeft: 6 },
  chatDot: { position: 'absolute', top: -2, right: -3, width: 7, height: 7, borderRadius: 4 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  content: { gap: 4, paddingHorizontal: 8, paddingBottom: 12 },
  empty: { textAlign: 'center', paddingVertical: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  rank: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  name: { flex: 1, gap: 6 },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nameText: { flexShrink: 1 },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 2 },
  right: { alignItems: 'flex-end', minWidth: 56 },
  steps: { fontVariant: ['tabular-nums'], fontWeight: '700' },
  gap: { flexDirection: 'row', justifyContent: 'center', gap: 4, paddingVertical: 2 },
  dot: { width: 4, height: 4, borderRadius: 2 },
});
