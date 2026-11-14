import { BlurTargetView } from 'expo-blur';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Platform, RefreshControl, Share, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Appbar, Menu, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  LayoutAnimationConfig,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Appear } from '@/components/appear';
import { ButtonGroup, FLOATING_HEIGHT } from '@/components/button-group';
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
import { SwapText } from '@/components/swap-text';
import { TapCard } from '@/components/tap-card';
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
import { enter, layoutMove, leave, motion } from '@/theme/motion';

type GroupView = 'board' | 'chat' | 'journey' | 'trophies';
/** The tabs in page order, left to right. */
const VIEWS: GroupView[] = ['board', 'chat', 'journey', 'trophies'];
/** About when a page turn has landed (the `smooth` spring), for starting the new page's animations. */
const PAGE_MS = 300;
/** Dragged past the first or last page, the pages follow the finger at this fraction. */
const RUBBER_BAND = 0.25;
/** The group name crossfades in over the placeholder title once the group loads. */
const TITLE_IN = FadeIn.duration(motion.fade.duration!);

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
    // From wherever the pages are, so a tap mid-turn just changes where they're heading.
    page.set(withSpring(VIEWS.indexOf(next), motion.smooth));
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
  // Where the pages were when the drag took hold (exact, so catching them mid-turn doesn't jump),
  // the finger's offset at that moment, and the page the swipe counts from.
  const swipeFrom = useSharedValue(0);
  const swipeX = useSharedValue(0);
  const swipeHome = useSharedValue(0);
  const reduceMotion = useReducedMotion();
  const last = VIEWS.length - 1;
  let swipe = Gesture.Pan()
    // Horizontal drags only, so the lists still scroll and pull to refresh.
    .activeOffsetX([-16, 16])
    .failOffsetY([-12, 12])
    .onStart((e) => {
      const at = page.get();
      // Undo the rubber band, so a drag caught while springing back from an edge picks up where it is.
      swipeFrom.set(at < 0 ? at / RUBBER_BAND : at > last ? last + (at - last) / RUBBER_BAND : at);
      swipeX.set(e.translationX);
      swipeHome.set(Math.min(Math.max(Math.round(at), 0), last));
      scheduleOnRN(prepareNeighbours, swipeHome.get());
    })
    .onUpdate((e) => {
      const raw = swipeFrom.get() - (e.translationX - swipeX.get()) / pageWidth;
      // Past the first or last page it stretches a little, then springs back.
      page.set(raw < 0 ? raw * RUBBER_BAND : raw > last ? last + (raw - last) * RUBBER_BAND : raw);
    })
    .onEnd((e) => {
      const home = swipeHome.get();
      // A flick turns the page even after a short drag; at most one page per swipe.
      let target = Math.abs(e.velocityX) > 500 ? home + (e.velocityX < 0 ? 1 : -1) : Math.round(page.get());
      target = Math.min(Math.max(target, home - 1, 0), home + 1, last);
      // The finger's speed carries into the spring (in pages a second), so a flick lands without a hitch.
      // With reduced motion it still finishes the move the finger started, just without the fling.
      const velocity = reduceMotion ? 0 : -e.velocityX / pageWidth;
      page.set(withSpring(target, { ...motion.smooth, velocity, reduceMotion: ReduceMotion.Never }));
      scheduleOnRN(settle, target);
    });
  // Leave the screen's left edge to the iOS swipe-back gesture.
  if (Platform.OS === 'ios') swipe = swipe.hitSlop({ left: -24 });
  const pagesStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -page.value * pageWidth }],
  }));
  const blurTarget = useRef<View>(null);
  // The floating period switch: gone by halfway to the next page. With reduced motion it only fades.
  const floatStyle = useAnimatedStyle(() => {
    const away = Math.min(1, Math.abs(page.value) * 2);
    return { opacity: 1 - away, transform: [{ translateY: reduceMotion ? 0 : away * 80 }] };
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // Once the period has been switched, the leaderboard's rows stop staggering in.
  const [switched, setSwitched] = useState(false);
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
  // refetched in the background every time, since today's steps keep coming in. They're also kept for
  // the session (boardCache), so reopening a group shows its boards straight away.
  const [boards, setBoards] = useState<Partial<Record<Period, LeaderboardRow[]>>>(() => boardCache.get(id) ?? {});
  useEffect(() => {
    boardCache.set(id, boards);
  }, [id, boards]);
  const {
    data: board,
    error: boardError,
    reload: reloadBoard,
  } = useLoader(async () => {
    const leaderboard = await getLeaderboard(id, period);
    setBoards((b) => ({ ...b, [period]: leaderboard }));
    return { period, leaderboard };
  }, `${id}:${period}`);

  // The other periods load in the background once today is in, all at once, so a tap on any of them
  // shows straight away instead of waiting on the server (7 and 30 days took a noticeable beat). Each
  // is fetched fresh once per visit.
  const hasToday = !!boards.today;
  useEffect(() => {
    if (!hasToday) return;
    let cancelled = false;
    for (const other of ['yesterday', 'week', 'month'] as const) {
      getLeaderboard(id, other)
        .then((leaderboard) => {
          if (!cancelled) setBoards((b) => ({ ...b, [other]: leaderboard }));
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [id, hasToday]);

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
    // Closing the group shouldn't play every row's exit on the way out.
    <LayoutAnimationConfig skipExiting>
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
                    <Animated.View entering={TITLE_IN} style={styles.title}>
                      <GroupAvatar name={data.group.name} color={data.group.color} icon={data.group.icon} size={34} />
                      <Text variant="titleLarge" numberOfLines={1} style={styles.titleText}>
                        {data.group.name}
                      </Text>
                    </Animated.View>
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

            {/* Android blurs only what's inside a target: the pages, for the floating period switch over them. */}
            <BlurTargetView ref={blurTarget} style={styles.flex}>
              <GestureDetector gesture={swipe}>
                <View style={styles.pager}>
                  <Animated.View style={[styles.pages, { width: pageWidth * VIEWS.length }, pagesStyle]}>
                    <View style={{ width: pageWidth }}>
                      {/* Rows slide to their new places when the order changes (a period switch, someone
                          overtaking), and ones that join or leave the list rise in or fade out. The group's
                          list is short, so animating each row's layout stays cheap. */}
                      <Animated.FlatList
                        data={data?.leaderboard.slice(3) ?? []}
                        keyExtractor={(row) => row.user_id}
                        itemLayoutAnimation={layoutMove}
                        // Room at the end for the floating period switch, so the last row scrolls clear of it.
                        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + FLOAT_GAP + FLOATING_HEIGHT + 16 }]}
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
                            {/* The group's description rises in once it loads, and the podium below slides down
                                to make room rather than jumping. (The invite code is shared from the share
                                button in the top bar, and the period floats at the bottom of the screen.) */}
                            {data?.group.description ? (
                              <Appear>
                                <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                                  {data.group.description}
                                </Text>
                              </Appear>
                            ) : null}
                            {error ? (
                              <Appear exits>
                                <Text style={{ color: theme.colors.error }}>{error}</Text>
                              </Appear>
                            ) : null}
                            {data?.leaderboard.length ? (
                              <Animated.View layout={layoutMove}>
                                <Podium
                                  replayKey={`${shownPeriod}:${data.leaderboard.map((r) => r.user_id).join()}`}
                                  animate={activeView === 'board' && podiumInView}
                                  rows={data.leaderboard}
                                  userId={userId}
                                  showAverage={!singleDay}
                                  onPressUser={openUser}
                                />
                              </Animated.View>
                            ) : null}
                          </View>
                        }
                        renderItem={({ item, index }) => {
                          const isMe = item.user_id === userId;
                          return (
                            // The first load arrives in a quick stagger under the podium; after a period
                            // switch, rows new to the list just rise in.
                            <Animated.View
                              entering={enter(switched ? 0 : index + 1, reduceMotion)}
                              exiting={leave(reduceMotion)}
                            >
                              <TapCard
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
                                    <SwapText variant="titleMedium">{formatSteps(item.total_steps)}</SwapText>
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
                              </TapCard>
                            </Animated.View>
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
            </BlurTargetView>

            {/* The period floats at the bottom, under the thumb, where the tab bar sits on the main
                tabs (this screen covers them). It only applies to the leaderboard, so it slides away
                as the pages move off it, following the finger, and back as they return. */}
            <Animated.View
              pointerEvents={view === 'board' ? 'box-none' : 'none'}
              style={[styles.floating, { bottom: insets.bottom + FLOAT_GAP }, floatStyle]}>
              <View style={styles.floatingBar}>
                <ButtonGroup
                  floating
                  blurTarget={blurTarget}
                  value={period}
                  onChange={(next) => {
                    setSwitched(true);
                    setPeriod(next);
                  }}
                  options={PERIODS}
                />
              </View>
            </Animated.View>
          </Animated.View>
        </Animated.View>
      </View>
    </LayoutAnimationConfig>
  );
}

/** Each group's leaderboards by period, kept for the session so reopening a group shows them at once. */
const boardCache = new Map<string, Partial<Record<Period, LeaderboardRow[]>>>();

/** The leaderboard's periods, in the floating switch. */
const PERIODS: { value: Period; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'week', label: '7 days' },
  { value: 'month', label: '30 days' },
];
/** Space between the floating period switch and the bottom of the screen. */
const FLOAT_GAP = 12;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  floating: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  floatingBar: { width: '100%', maxWidth: 340 },
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  rank: { width: 24, textAlign: 'center', fontWeight: '700' },
  nameColumn: { flex: 1, gap: 2 },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  nameText: { flexShrink: 1 },
  right: { alignItems: 'flex-end', gap: 2 },
});
