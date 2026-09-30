import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, RefreshControl, Share, StyleSheet, View } from 'react-native';
import {
  Appbar,
  Card,
  Chip,
  Menu,
  Text,
  useTheme,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';

import { ButtonGroup } from '@/components/button-group';
import { useExpandTransition } from '@/components/expand-transition';
import { GroupAvatar } from '@/components/group-avatar';
import { UserAvatar } from '@/components/user-avatar';
import { GroupChat } from '@/components/group-chat';
import { GroupRace } from '@/components/group-race';
import { PlayerBadges, RankDelta } from '@/components/player-badges';
import { Podium } from '@/components/podium';
import { PrimaryTabs } from '@/components/primary-tabs';
import { useLoader } from '@/hooks/use-loader';
import {
  activeAverage,
  deleteGroup,
  getGroup,
  getLatestMessageId,
  getLeaderboard,
  leaveGroup,
  subscribeToMessages,
  type Period,
} from '@/lib/api';
import { getLastRead } from '@/lib/chat-read';
import { formatSteps } from '@/lib/dates';
import { useUserId } from '@/providers/auth-provider';
import { screenBackground, transparentHeader } from '@/theme';

type GroupView = 'board' | 'chat' | 'race';

export default function GroupScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const userId = useUserId();
  const { id, oy, oh } = useLocalSearchParams<{ id: string; oy?: string; oh?: string }>();
  const { backdropStyle, containerStyle, contentStyle, pointerEvents, close } = useExpandTransition(oy, oh);
  const [period, setPeriod] = useState<Period>('today');
  const [view, setView] = useState<GroupView>('board');
  const [menuOpen, setMenuOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const { data, error, reload } = useLoader(async () => {
    const [group, leaderboard, latestMessageId] = await Promise.all([
      getGroup(id),
      getLeaderboard(id, period),
      getLatestMessageId(id, userId),
    ]);
    return { group, leaderboard, period, latestMessageId };
  }, `${id}:${period}`);

  // Unread dot on the Chat tab: someone else posted after the newest message seen on this device.
  const [lastRead, setLastRead] = useState(() => getLastRead(id));
  const [liveLatest, setLiveLatest] = useState(0);
  useEffect(
    () =>
      subscribeToMessages(id, (m) => {
        if (m.user_id !== userId) setLiveLatest((n) => Math.max(n, m.id));
      }),
    [id, userId]
  );
  const onChatRead = useCallback((messageId: number) => setLastRead((n) => Math.max(n, messageId)), []);
  const latestOther = Math.max(data?.latestMessageId ?? 0, liveLatest);
  const unreadChat = view !== 'chat' && latestOther > lastRead;
  // The period the shown data is for; `period` flips on tap, before the new data arrives.
  const shownPeriod = data?.period ?? period;
  // Per-day averages only make sense for multi-day periods.
  const singleDay = shownPeriod === 'today' || shownPeriod === 'yesterday';

  const isOwner = data?.group.owner_id === userId;
  const members = new Map((data?.leaderboard ?? []).map((r) => [r.user_id, r]));

  function openUser(memberId: string) {
    router.push({ pathname: '/user/[id]', params: { id: memberId } });
  }

  // Only pull-to-refresh shows the spinner; period switches reload quietly.
  async function refresh() {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
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
    <View style={styles.flex} pointerEvents={pointerEvents}>
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.scrim }, backdropStyle]}
      />
      <Animated.View style={[screenBackground(theme), containerStyle]}>
        <Animated.View style={contentStyle}>
      <Appbar.Header style={transparentHeader}>
        <Appbar.BackAction onPress={close} />
        <Appbar.Content
          title={
            data ? (
              <View style={styles.title}>
                <GroupAvatar name={data.group.name} color={data.group.color} icon={data.group.icon} size={34} />
                <Text variant="titleLarge" numberOfLines={1} style={styles.titleText}>
                  {data.group.name}
                </Text>
              </View>
            ) : (
              'Group'
            )
          }
        />
        <Appbar.Action icon="share-variant" onPress={shareInvite} disabled={!data} accessibilityLabel="Share invite" />
        <Menu
          visible={menuOpen}
          onDismiss={() => setMenuOpen(false)}
          anchor={<Appbar.Action icon="dots-vertical" onPress={() => setMenuOpen(true)} accessibilityLabel="More" />}>
          {isOwner ? (
            <Menu.Item
              leadingIcon="cog-outline"
              title="Group settings"
              onPress={() => {
                setMenuOpen(false);
                router.push({ pathname: '/group-settings/[id]', params: { id } });
              }}
            />
          ) : null}
          <Menu.Item
            leadingIcon={isOwner ? 'delete-outline' : 'exit-to-app'}
            title={isOwner ? 'Delete group' : 'Leave group'}
            onPress={confirmLeave}
          />
        </Menu>
      </Appbar.Header>

      <View style={styles.viewSwitch}>
        <PrimaryTabs
          value={view}
          onChange={setView}
          tabs={[
            { value: 'board', label: 'Leaderboard', icon: 'podium' },
            { value: 'chat', label: 'Chat', icon: 'chat-outline', activeIcon: 'chat', badge: unreadChat },
            { value: 'race', label: 'Race', icon: 'flag-checkered' },
          ]}
        />
      </View>

      {view === 'race' ? (
        <GroupRace groupId={id} userId={userId} />
      ) : view === 'chat' ? (
        <GroupChat groupId={id} userId={userId} members={members} onRead={onChatRead} />
      ) : (
        <FlatList
          data={data?.leaderboard.slice(3) ?? []}
          keyExtractor={(row) => row.user_id}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 16 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
          ListHeaderComponent={
            <View style={styles.header}>
              {data?.group.description ? (
                <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                  {data.group.description}
                </Text>
              ) : null}
              {data ? (
                <Chip
                  icon="ticket-confirmation-outline"
                  onPress={() => Share.share({ message: data.group.invite_code })}
                  style={styles.chip}>
                  Invite code: {data.group.invite_code}
                </Chip>
              ) : null}
              <ButtonGroup
                value={period}
                onChange={setPeriod}
                options={[
                  { value: 'today', label: 'Today' },
                  { value: 'yesterday', label: 'Yesterday' },
                  { value: 'week', label: '7 days' },
                  { value: 'month', label: '30 days' },
                ]}
              />
              {error ? <Text style={{ color: theme.colors.error }}>{error}</Text> : null}
              {data?.leaderboard.length ? (
                <Podium
                  key={`${shownPeriod}:${data.leaderboard.map((r) => r.user_id).join()}`}
                  rows={data.leaderboard}
                  userId={userId}
                  showAverage={!singleDay}
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
                  <UserAvatar
                    name={item.display_name}
                    color={item.avatar_color}
                    icon={item.avatar_icon}
                  />
                  <View style={styles.nameColumn}>
                    <View style={styles.nameLine}>
                      <Text variant="titleSmall" numberOfLines={1} style={styles.nameText}>
                        {isMe ? `${item.display_name} (you)` : item.display_name}
                      </Text>
                    </View>
                    <PlayerBadges row={item} />
                  </View>
                  <View style={styles.right}>
                    <Text variant="titleMedium">{formatSteps(item.total_steps)}</Text>
                    {!singleDay ? (
                      <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                        avg {formatSteps(activeAverage(item.total_steps, item.active_days))}/day
                      </Text>
                    ) : null}
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
  viewSwitch: {},
  title: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  titleText: { flexShrink: 1 },
  content: { padding: 16, paddingTop: 8, gap: 10 },
  header: { gap: 12, marginBottom: 12 },
  chip: { alignSelf: 'flex-start' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  rank: { width: 24, textAlign: 'center', fontWeight: '700' },
  nameColumn: { flex: 1, gap: 2 },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  nameText: { flexShrink: 1 },
  right: { alignItems: 'flex-end', gap: 2 },
});
