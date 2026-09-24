import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, RefreshControl, Share, StyleSheet, View } from 'react-native';
import {
  Appbar,
  Card,
  Chip,
  Menu,
  SegmentedButtons,
  Text,
  useTheme,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';

import { useExpandTransition } from '@/components/expand-transition';
import { GroupChat } from '@/components/group-chat';
import { PlayerBadges, RankDelta } from '@/components/player-badges';
import { Podium } from '@/components/podium';
import { UserAvatar } from '@/components/user-avatar';
import { useLoader } from '@/hooks/use-loader';
import { deleteGroup, getGroup, getLeaderboard, leaveGroup, type Period } from '@/lib/api';
import { formatSteps } from '@/lib/dates';
import { useUserId } from '@/providers/auth-provider';
import { screenBackground, transparentHeader } from '@/theme';

type GroupView = 'board' | 'chat';

export default function GroupScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const userId = useUserId();
  const { id, oy, oh } = useLocalSearchParams<{ id: string; oy?: string; oh?: string }>();
  const { backdropStyle, containerStyle, contentStyle, close } = useExpandTransition(oy, oh);
  const [period, setPeriod] = useState<Period>('week');
  const [view, setView] = useState<GroupView>('board');
  const [menuOpen, setMenuOpen] = useState(false);

  const { data, loading, error, reload } = useLoader(async () => {
    const [group, leaderboard] = await Promise.all([getGroup(id), getLeaderboard(id, period)]);
    return { group, leaderboard };
  }, `${id}:${period}`);

  const isOwner = data?.group.owner_id === userId;
  const members = new Map((data?.leaderboard ?? []).map((r) => [r.user_id, r]));

  function openUser(memberId: string) {
    router.push({ pathname: '/user/[id]', params: { id: memberId } });
  }

  function shareInvite() {
    if (!data) return;
    Share.share({
      message: `Join my step group "${data.group.name}" on Steppa with code ${data.group.invite_code}`,
    });
  }

  function confirmLeave() {
    setMenuOpen(false);
    Alert.alert(
      isOwner ? 'Delete group?' : 'Leave group?',
      isOwner ? 'This removes the group for everyone.' : 'You can rejoin later with the invite code.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isOwner ? 'Delete' : 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              await (isOwner ? deleteGroup(id) : leaveGroup(id, userId));
              router.back();
            } catch (e) {
              Alert.alert('Error', e instanceof Error ? e.message : String(e));
            }
          },
        },
      ]
    );
  }

  return (
    <View style={styles.flex}>
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.scrim }, backdropStyle]}
      />
      <Animated.View style={[screenBackground(theme), containerStyle]}>
        <Animated.View style={contentStyle}>
      <Appbar.Header style={transparentHeader}>
        <Appbar.BackAction onPress={close} />
        <Appbar.Content title={data?.group.name ?? 'Group'} />
        <Appbar.Action icon="share-variant" onPress={shareInvite} disabled={!data} accessibilityLabel="Share invite" />
        <Menu
          visible={menuOpen}
          onDismiss={() => setMenuOpen(false)}
          anchor={<Appbar.Action icon="dots-vertical" onPress={() => setMenuOpen(true)} accessibilityLabel="More" />}>
          <Menu.Item
            leadingIcon={isOwner ? 'delete-outline' : 'exit-to-app'}
            title={isOwner ? 'Delete group' : 'Leave group'}
            onPress={confirmLeave}
          />
        </Menu>
      </Appbar.Header>

      <View style={styles.viewSwitch}>
        <SegmentedButtons
          value={view}
          onValueChange={(v) => setView(v as GroupView)}
          buttons={[
            { value: 'board', label: 'Leaderboard', icon: 'podium' },
            { value: 'chat', label: 'Chat', icon: 'chat-outline' },
          ]}
        />
      </View>

      {view === 'chat' ? (
        <GroupChat groupId={id} userId={userId} members={members} />
      ) : (
        <FlatList
          data={data?.leaderboard.slice(3) ?? []}
          keyExtractor={(row) => row.user_id}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 16 }]}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}
          ListHeaderComponent={
            <View style={styles.header}>
              {data?.group.description ? (
                <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                  {data.group.description}
                </Text>
              ) : null}
              {data ? (
                <Chip icon="ticket-confirmation-outline" onPress={shareInvite} style={styles.chip}>
                  Invite code: {data.group.invite_code}
                </Chip>
              ) : null}
              <SegmentedButtons
                value={period}
                onValueChange={(v) => setPeriod(v as Period)}
                buttons={[
                  { value: 'today', label: 'Today' },
                  { value: 'week', label: '7 days' },
                  { value: 'month', label: '30 days' },
                ]}
              />
              {error ? <Text style={{ color: theme.colors.error }}>{error}</Text> : null}
              {data?.leaderboard.length ? (
                <Podium
                  key={`${period}:${data.leaderboard.map((r) => r.user_id).join()}`}
                  rows={data.leaderboard}
                  userId={userId}
                  onPressUser={openUser}
                />
              ) : null}
            </View>
          }
          renderItem={({ item }) => {
            const isMe = item.user_id === userId;
            return (
              <Card
                mode="contained"
                style={{
                  backgroundColor: isMe ? theme.colors.primaryContainer : theme.colors.elevation.level1,
                }}
                onPress={isMe ? undefined : () => openUser(item.user_id)}>
                <View style={styles.row}>
                  <Text variant="titleMedium" style={styles.rank}>
                    {item.rank}
                  </Text>
                  <UserAvatar name={item.display_name} color={item.avatar_color} />
                  <View style={styles.nameColumn}>
                    <Text variant="titleSmall" numberOfLines={1}>
                      {isMe ? `${item.display_name} (you)` : item.display_name}
                    </Text>
                    <PlayerBadges row={item} />
                  </View>
                  <View style={styles.right}>
                    <Text variant="titleMedium">{formatSteps(item.total_steps)}</Text>
                    <RankDelta rank={item.rank} prevRank={item.prev_rank} />
                  </View>
                </View>
              </Card>
            );
          }}
        />
      )}
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  viewSwitch: { paddingHorizontal: 16, paddingBottom: 8 },
  content: { padding: 16, paddingTop: 8, gap: 10 },
  header: { gap: 12, marginBottom: 12 },
  chip: { alignSelf: 'flex-start' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  rank: { width: 24, textAlign: 'center', fontWeight: '700' },
  nameColumn: { flex: 1, gap: 2 },
  right: { alignItems: 'flex-end', gap: 2 },
});
