import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, FlatList, Platform, RefreshControl, Share, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Appbar, Card, Chip, Menu, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { ButtonGroup } from '@/components/button-group';
import { useExpandTransition } from '@/components/expand-transition';
import { GlassAction, GlassBackAction } from '@/components/glass-action';
import { GroupAvatar } from '@/components/group-avatar';
import { UserAvatar } from '@/components/user-avatar';
import { GroupChat } from '@/components/group-chat';
import { GroupJourney } from '@/components/group-journey';
import { TrophyCabinet } from '@/components/trophy-cabinet';
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
  type LeaderboardRow,
  type Period,
} from '@/lib/api';
import { getLastRead } from '@/lib/chat-read';
import { formatSteps } from '@/lib/dates';
import { useUserId } from '@/providers/auth-provider';
import { liftedCard, screenBackground, transparentHeader, useAppTheme } from '@/theme';

type GroupView = 'board' | 'chat' | 'journey' | 'trophies';
/** The tabs in page order, left to right. */
const VIEWS: GroupView[] = ['board', 'chat', 'journey', 'trophies'];
const PAGE_MS = 240;

export default function GroupScreen() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const userId = useUserId();
  const { id, oy, oh } = useLocalSearchParams<{
    id: string;
    oy?: string;
    oh?: string;
  }>();
  const { backdropStyle, containerStyle, contentStyle, pointerEvents, close } = useExpandTransition(oy, oh);
  const [period, setPeriod] = useState<Period>('today');
  const [view, setView] = useState<GroupView>('board');
  // Tabs are built on first visit and then kept, only hidden, so switching back is instant.
  const [visited, setVisited] = useState<Set<GroupView>>(() => new Set<GroupView>(['board']));
  function markVisited(next: GroupView) {
    setVisited((prev) => (prev.has(next) ? prev : new Set(prev).add(next)));
  }
  // The page whose animations run. It follows `view` once the slide has landed, so a page's
  // characters and scenes don't start up on the UI thread while the pages are still moving.
  const [activeView, setActiveView] = useState<GroupView>('board');
  function openView(next: GroupView) {
    setView(next);
    markVisited(next);
    page.value = withTiming(VIEWS.indexOf(next), { duration: PAGE_MS });
  }
  // A swipe has started from page i: build the pages either side so they slide in with content.
  // Usually they're built already (see below); this covers a swipe before that.
  function prepareNeighbours(i: number) {
    if (VIEWS[i - 1]) markVisited(VIEWS[i - 1]);
    if (VIEWS[i + 1]) markVisited(VIEWS[i + 1]);
  }
  function settle(i: number) {
    setView(VIEWS[i]);
    markVisited(VIEWS[i]);
  }
  // Once the slide lands, the new page's animations start. A bit later (and, on open, once the
  // screen has expanded) the pages either side are built while nothing is moving, rather than
  // mid-swipe when building them drops frames.
  useEffect(() => {
    const landed = setTimeout(() => setActiveView(view), PAGE_MS);
    const i = VIEWS.indexOf(view);
    const timer = setTimeout(() => {
      setVisited((prev) => {
        const around = [VIEWS[i - 1], VIEWS[i + 1]].filter((v): v is GroupView => !!v && !prev.has(v));
        return around.length ? new Set([...prev, ...around]) : prev;
      });
    }, PAGE_MS + 400);
    return () => {
      clearTimeout(landed);
      clearTimeout(timer);
    };
  }, [view]);

  // Swipe between the tabs. `page` is the live page position (0 = Leaderboard, between two pages
  // mid-swipe); the pages and the tab indicator both follow it.
  const { width: pageWidth } = useWindowDimensions();
  const page = useSharedValue(0);
  const swipeStart = useSharedValue(0);
  const last = VIEWS.length - 1;
  let swipe = Gesture.Pan()
    // Horizontal drags only, so the lists still scroll and pull to refresh.
    .activeOffsetX([-16, 16])
    .failOffsetY([-12, 12])
    .onStart(() => {
      swipeStart.value = Math.round(page.value);
      scheduleOnRN(prepareNeighbours, swipeStart.value);
    })
    .onUpdate((e) => {
      const raw = swipeStart.value - e.translationX / pageWidth;
      // Past the first or last page it stretches a little, then springs back.
      page.value = raw < 0 ? raw * 0.25 : raw > last ? last + (raw - last) * 0.25 : raw;
    })
    .onEnd((e) => {
      // A flick turns the page even after a short drag; at most one page per swipe.
      let target = Math.abs(e.velocityX) > 500 ? swipeStart.value + (e.velocityX < 0 ? 1 : -1) : Math.round(page.value);
      target = Math.min(Math.max(target, swipeStart.value - 1, 0), swipeStart.value + 1, last);
      page.value = withTiming(target, { duration: PAGE_MS });
      scheduleOnRN(settle, target);
    });
  // Leave the screen's left edge to the iOS swipe-back gesture.
  if (Platform.OS === 'ios') swipe = swipe.hitSlop({ left: -24 });
  const pagesStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -page.value * pageWidth }],
  }));
  const [menuOpen, setMenuOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // The podium's characters pause once it's scrolled out of view (it's the bottom of the list header).
  const podiumBottom = useRef(Infinity);
  const [podiumInView, setPodiumInView] = useState(true);

  // The group and its newest chat message don't depend on the period, so switching doesn't refetch them.
  const {
    data: info,
    error: infoError,
    reload: reloadInfo,
  } = useLoader(async () => {
    const [group, latestMessageId] = await Promise.all([getGroup(id), getLatestMessageId(id, userId)]);
    return { group, latestMessageId };
  }, `${id}:${userId}`);

  // Each period's leaderboard is kept once loaded, so switching back shows it at once; it's still
  // refetched in the background every time, since today's steps keep coming in.
  const [boards, setBoards] = useState<Partial<Record<Period, LeaderboardRow[]>>>({});
  const {
    data: board,
    error: boardError,
    reload: reloadBoard,
  } = useLoader(async () => {
    const leaderboard = await getLeaderboard(id, period);
    setBoards((b) => ({ ...b, [period]: leaderboard }));
    return { period, leaderboard };
  }, `${id}:${period}`);

  // Yesterday is the likeliest next tap: fetch it once today is in.
  useEffect(() => {
    if (!boards.today || boards.yesterday) return;
    getLeaderboard(id, 'yesterday')
      .then((leaderboard) => setBoards((b) => ({ yesterday: leaderboard, ...b })))
      .catch(() => {});
  }, [id, boards.today, boards.yesterday]);

  // A period not loaded yet keeps showing the last one until it arrives.
  const cached = boards[period];
  const leaderboard = cached ?? board?.leaderboard;
  const data = info && leaderboard ? { ...info, leaderboard } : undefined;
  const error = infoError ?? boardError;

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
  const shownPeriod = cached ? period : (board?.period ?? period);
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
    await Promise.all([reloadInfo(), reloadBoard()]);
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
          <Appbar.Header mode="small" style={transparentHeader}>
            <GlassBackAction onPress={close} />
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
            <GlassAction
              icon="share-variant"
              onPress={shareInvite}
              disabled={!data}
              accessibilityLabel="Share invite"
              contentStyle={styles.shareIcon}
            />
            <Menu
              visible={menuOpen}
              onDismiss={() => setMenuOpen(false)}
              anchor={
                <GlassAction icon="dots-vertical" onPress={() => setMenuOpen(true)} accessibilityLabel="More" />
              }
            >
              {isOwner ? (
                <Menu.Item
                  leadingIcon="cog-outline"
                  title="Group settings"
                  onPress={() => {
                    setMenuOpen(false);
                    router.push({
                      pathname: '/group-settings/[id]',
                      params: { id },
                    });
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
              onChange={openView}
              position={page}
              tabs={[
                { value: 'board', label: 'Leaderboard', icon: 'podium' },
                {
                  value: 'chat',
                  label: 'Chat',
                  icon: 'chat-outline',
                  activeIcon: 'chat',
                  badge: unreadChat,
                },
                { value: 'journey', label: 'Journey', icon: 'map-marker-path' },
                {
                  value: 'trophies',
                  label: 'Trophies',
                  icon: 'trophy-outline',
                  activeIcon: 'trophy',
                },
              ]}
            />
          </View>

          <GestureDetector gesture={swipe}>
            <View style={styles.pager}>
              <Animated.View style={[styles.pages, { width: pageWidth * VIEWS.length }, pagesStyle]}>
                <View style={{ width: pageWidth }}>
                  <FlatList
                    data={data?.leaderboard.slice(3) ?? []}
                    keyExtractor={(row) => row.user_id}
                    contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 16 }]}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
                    onScroll={(e) => setPodiumInView(e.nativeEvent.contentOffset.y < podiumBottom.current)}
                    scrollEventThrottle={100}
                    ListHeaderComponent={
                      <View
                        style={styles.header}
                        onLayout={(e) => {
                          podiumBottom.current = e.nativeEvent.layout.y + e.nativeEvent.layout.height;
                        }}
                      >
                        {data?.group.description ? (
                          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                            {data.group.description}
                          </Text>
                        ) : null}
                        {data ? (
                          <Chip
                            icon="ticket-confirmation-outline"
                            onPress={() => Share.share({ message: data.group.invite_code })}
                            style={styles.chip}
                          >
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
                            replayKey={`${shownPeriod}:${data.leaderboard.map((r) => r.user_id).join()}`}
                            animate={activeView === 'board' && podiumInView}
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
                          style={[liftedCard(theme), isMe && { backgroundColor: theme.colors.primaryContainer }]}
                          onPress={() => openUser(item.user_id)}
                        >
                          <View style={styles.row}>
                            <Text variant="titleMedium" style={styles.rank}>
                              {item.rank}
                            </Text>
                            <UserAvatar name={item.display_name} color={item.avatar_color} icon={item.avatar_icon} />
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
                                <Text
                                  variant="labelSmall"
                                  style={{
                                    color: theme.colors.onSurfaceVariant,
                                  }}
                                >
                                  avg {formatSteps(activeAverage(item.total_steps, item.active_days))}
                                  /day
                                </Text>
                              ) : null}
                              <RankDelta rank={item.rank} prevRank={item.prev_rank} />
                            </View>
                          </View>
                        </Card>
                      );
                    }}
                  />
                </View>
                <View style={{ width: pageWidth }}>
                  {visited.has('chat') ? (
                    <GroupChat
                      groupId={id}
                      userId={userId}
                      members={members}
                      onRead={onChatRead}
                      active={activeView === 'chat'}
                    />
                  ) : null}
                </View>
                <View style={{ width: pageWidth }}>
                  {visited.has('journey') && data ? (
                    <GroupJourney
                      group={data.group}
                      userId={userId}
                      members={data.leaderboard}
                      active={activeView === 'journey'}
                    />
                  ) : null}
                </View>
                <View style={{ width: pageWidth }}>
                  {visited.has('trophies') ? (
                    <TrophyCabinet
                      rows={data?.leaderboard ?? []}
                      userId={userId}
                      onPressUser={openUser}
                      active={activeView === 'trophies'}
                    />
                  ) : null}
                </View>
              </Animated.View>
            </View>
          </GestureDetector>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  // The share glyph has two dots on the right and one on the left, so centred by its box it looks
  // pushed right inside the round button; this sets it where it looks centred.
  shareIcon: { transform: [{ translateX: -1.5 }] },
  // The pages sit side by side and slide along; the pager shows one at a time.
  pager: { flex: 1, overflow: 'hidden' },
  pages: { flex: 1, flexDirection: 'row' },
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
