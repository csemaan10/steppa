import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Card, Icon, Modal, Portal, Text } from 'react-native-paper';
import Animated, { BounceIn, FadeInDown, ZoomIn } from 'react-native-reanimated';

import { GroupAvatar } from '@/components/group-avatar';
import { CEREMONY_END, MEDAL_COLORS, MedalCeremony } from '@/components/medal-ceremony';
import { UserAvatar } from '@/components/user-avatar';
import type { LeaderboardRow } from '@/lib/api';
import { formatSteps } from '@/lib/dates';
import { useRecap, type Recap } from '@/providers/recap-provider';
import { surfaceCard, useAppTheme } from '@/theme';

const MEDALS = [
  { emoji: '🥇', name: 'gold' },
  { emoji: '🥈', name: 'silver' },
  { emoji: '🥉', name: 'bronze' },
];

function formatDay(day: string, weekday: 'long' | 'short' = 'long') {
  return new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday, month: 'short', day: 'numeric' });
}

type ModalProps = { recaps: Recap[]; day: string | null; userId: string; onClose: () => void };

/** Yesterday's medal ceremony, one group at a time. Hidden while `recaps` is empty. */
export function RecapModal({ recaps, day, userId, onClose }: ModalProps) {
  const [index, setIndex] = useState(0);
  // Start from the first group each time a new set opens.
  const [shown, setShown] = useState(recaps);
  if (shown !== recaps) {
    setShown(recaps);
    setIndex(0);
  }

  const recap = recaps[index];
  const isLast = index >= recaps.length - 1;

  function go(pathname: '/group/[id]' | '/user/[id]', id: string) {
    onClose();
    router.push({ pathname, params: { id } });
  }

  return (
    <Portal>
      <Modal visible={!!recap} onDismiss={onClose} contentContainerStyle={styles.wrapper}>
        {recap ? (
          <RecapCard
            // Remount per group so the ceremony replays.
            key={recap.group.id}
            recap={recap}
            day={day}
            userId={userId}
            step={recaps.length > 1 ? `${index + 1} of ${recaps.length}` : null}
            nextLabel={isLast ? 'Done' : 'Next group'}
            onNext={() => (isLast ? onClose() : setIndex(index + 1))}
            onOpenGroup={() => go('/group/[id]', recap.group.id)}
            onPressUser={(id) => go('/user/[id]', id)}
          />
        ) : null}
      </Modal>
    </Portal>
  );
}

type CardProps = {
  recap: Recap;
  day: string | null;
  userId: string;
  step: string | null;
  nextLabel: string;
  onNext: () => void;
  onOpenGroup: () => void;
  onPressUser: (userId: string) => void;
};

function RecapCard({ recap, day, userId, step, nextLabel, onNext, onOpenGroup, onPressUser }: CardProps) {
  const theme = useAppTheme();
  const { group, podium, rows } = recap;
  const me = rows.find((r) => r.user_id === userId);
  const myPlace = podium.findIndex((r) => r.user_id === userId);

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
      <View style={styles.header}>
        <Text variant="titleLarge" style={styles.title}>
          Medal ceremony
        </Text>
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
          {group.name}
          {day ? ` · ${formatDay(day)}` : ''}
          {step ? ` · ${step}` : ''}
        </Text>
      </View>

      <MedalCeremony podium={podium} userId={userId} onPressUser={onPressUser} />

      {myPlace >= 0 ? (
        <Animated.View
          entering={ZoomIn.delay(CEREMONY_END).springify()}
          style={[styles.mine, { backgroundColor: theme.colors.primaryContainer }]}>
          <Text variant="titleMedium" style={{ color: theme.colors.onPrimaryContainer }}>
            {MEDALS[podium[myPlace]!.rank - 1]?.emoji} You took {MEDALS[podium[myPlace]!.rank - 1]?.name}!
          </Text>
        </Animated.View>
      ) : me ? (
        <MyPosition me={me} total={rows.length} podium={podium} />
      ) : null}

      <View style={styles.actions}>
        <Button onPress={onOpenGroup}>View group</Button>
        <Button mode="contained" onPress={onNext}>
          {nextLabel}
        </Button>
      </View>
    </View>
  );
}

/** Your finish when you weren't on the podium: your character hops in with your place. */
function MyPosition({ me, total, podium }: { me: LeaderboardRow; total: number; podium: LeaderboardRow[] }) {
  const theme = useAppTheme();
  const noSteps = me.total_steps === 0;
  const bronze = podium.length === 3 ? podium[2]! : null;

  return (
    <Animated.View
      entering={FadeInDown.delay(CEREMONY_END).springify()}
      style={[styles.mine, styles.mineRow, { backgroundColor: theme.colors.surfaceVariant }]}
      accessibilityLabel={
        noSteps ? 'You had no steps yesterday' : `You finished ${me.rank} of ${total} with ${formatSteps(me.total_steps)} steps`
      }>
      <Text variant="headlineSmall" style={[styles.rank, { color: theme.colors.onSurfaceVariant }]}>
        {noSteps ? '–' : `#${me.rank}`}
      </Text>
      <Animated.View entering={BounceIn.delay(CEREMONY_END + 200)}>
        <UserAvatar name={me.display_name} color={me.avatar_color} icon={me.avatar_icon} size={44} />
      </Animated.View>
      <View style={styles.flex}>
        <Text variant="titleSmall">{noSteps ? 'No steps synced' : `You finished ${me.rank} of ${total}`}</Text>
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          {noSteps
            ? 'Open Steppa during the day to keep your count up to date.'
            : bronze
              ? `${formatSteps(me.total_steps)} steps · ${formatSteps(bronze.total_steps - me.total_steps)} from bronze`
              : `${formatSteps(me.total_steps)} steps`}
        </Text>
      </View>
    </Animated.View>
  );
}

/** Home screen card: yesterday's podium per group and your result. Tap a group to replay its ceremony. */
export function RecapSummaryCard({ userId }: { userId: string }) {
  const theme = useAppTheme();
  const { recaps, day, play } = useRecap();
  if (!recaps.length || !day) return null;

  return (
    <Card mode="contained" style={surfaceCard(theme)}>
      <Card.Content style={styles.summary}>
        <View style={styles.summaryHeader}>
          <Icon source="trophy-outline" size={18} color={theme.colors.onSurfaceVariant} />
          <Text variant="titleSmall" style={styles.flex}>
            Yesterday&apos;s results
          </Text>
          <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            {formatDay(day, 'short')}
          </Text>
        </View>
        {recaps.map(({ group, podium, rows }) => {
          const me = rows.find((r) => r.user_id === userId);
          const myMedal = podium.some((r) => r.user_id === userId) ? MEDALS[me!.rank - 1] : undefined;
          const result = myMedal ? myMedal.emoji : me && me.total_steps > 0 ? `#${me.rank}` : '–';
          return (
            <Pressable
              key={group.id}
              onPress={() => play(group.id)}
              style={styles.summaryRow}
              accessibilityRole="button"
              accessibilityLabel={`${group.name}: replay the medal ceremony. You finished ${myMedal?.name ?? result}.`}>
              <GroupAvatar name={group.name} color={group.color} icon={group.icon} size={32} />
              <Text variant="bodyMedium" numberOfLines={1} style={styles.flex}>
                {group.name}
              </Text>
              <View style={styles.stack}>
                {podium.map((row, i) => (
                  <View
                    key={row.user_id}
                    style={[
                      styles.stackItem,
                      { borderColor: MEDAL_COLORS[row.rank - 1] ?? theme.colors.outline, zIndex: 3 - i },
                      i > 0 && styles.overlap,
                    ]}>
                    <UserAvatar name={row.display_name} color={row.avatar_color} icon={row.avatar_icon} size={24} />
                  </View>
                ))}
              </View>
              <Text variant="titleSmall" style={[styles.result, { color: theme.colors.primary }]}>
                {result}
              </Text>
              <Icon source="play-circle-outline" size={20} color={theme.colors.onSurfaceVariant} />
            </Pressable>
          );
        })}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignSelf: 'center', width: '100%', maxWidth: 420, paddingHorizontal: 16 },
  card: { borderRadius: 28, padding: 20, gap: 16 },
  header: { alignItems: 'center', gap: 2 },
  title: { fontWeight: '700', textAlign: 'center' },
  mine: { borderRadius: 16, padding: 12, alignItems: 'center' },
  mineRow: { flexDirection: 'row', gap: 12 },
  rank: { fontWeight: '800', minWidth: 44, textAlign: 'center' },
  flex: { flex: 1 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  summary: { gap: 10 },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 2 },
  stack: { flexDirection: 'row' },
  stackItem: { borderWidth: 2, borderRadius: 999 },
  overlap: { marginLeft: -8 },
  result: { minWidth: 32, textAlign: 'right', fontWeight: '700' },
});
