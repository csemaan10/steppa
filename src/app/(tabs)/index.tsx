import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform, RefreshControl, ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import {
  Appbar,
  Card,
  Snackbar,
  Text,
} from 'react-native-paper';

import { Button } from '@/components/button';
import { CharacterIntroCard, characterIntroSeen } from '@/components/character/character-intro-card';
import { TAB_BAR_OFFSET, useTabBarSpace } from '@/components/floating-tab-bar';
import { GlassAction } from '@/components/glass-action';
import { GroupPreview } from '@/components/group-preview';
import type { Rect } from '@/components/expanding-card';
import { GoalSegments, InsightTile } from '@/components/insight-tile';
import { JourneyIntroCard } from '@/components/journey-intro-card';
import { JourneyPreview } from '@/components/journey-preview';
import { PetIntroCard } from '@/components/pet-intro-card';
import { StreakCard } from '@/components/profile-stats';
import { ProgressRing } from '@/components/progress-ring';
import { RecapPreview } from '@/components/recap/recap-preview';
import { SectionHeader } from '@/components/section-header';
import { WeekDetail, type WeekDetailKind } from '@/components/week-detail';
import { useLoader } from '@/hooks/use-loader';
import { registerBackgroundSync } from '@/lib/background-sync';
import {
  getCurrentJourney,
  getLatestMessageId,
  getLeaderboard,
  getMyGroups,
  getProfile,
  getProfileStats,
  getStepHistory,
  hasWorld,
  summarize,
  syncSteps,
  syncTimezone,
} from '@/lib/api';
import { formatSteps, shortWeekday } from '@/lib/dates';
import {
  healthSourceName,
  isHealthAvailable,
  openHealthSettings,
  requestHealthPermission,
} from '@/lib/health';
import { loadRecap, markRecapSeen, recapUnseen } from '@/lib/recap';
import { useUserId } from '@/providers/auth-provider';
import { glassCard, ringTrack, screenBackground, transparentHeader, useAppTheme } from '@/theme';

/** How often the Today tab re-reads the health store while it's on screen. */
const RESYNC_MS = 60_000;

type HealthState = 'unavailable' | 'denied' | 'ready';

async function connectAndSync(userId: string): Promise<{ health: HealthState; syncError: string | null }> {
  try {
    if (!(await isHealthAvailable())) return { health: 'unavailable', syncError: null };
    if (!(await requestHealthPermission())) return { health: 'denied', syncError: null };
    // Before the sync, so a failed foreground sync doesn't also leave the background task unscheduled.
    registerBackgroundSync();
    await syncSteps(userId, 7);
    return { health: 'ready', syncError: null };
  } catch (e) {
    return { health: 'ready', syncError: e instanceof Error ? e.message : 'Sync failed' };
  }
}

export default function TodayScreen() {
  const theme = useAppTheme();
  const userId = useUserId();
  const tabBarSpace = useTabBarSpace();
  const [dismissedError, setDismissedError] = useState<string | null>(null);
  // The pet invite waits for the character card to be dealt with (made, dismissed or opened).
  const [characterIntroDone, setCharacterIntroDone] = useState(characterIntroSeen);

  // Syncs from the phone's health store on focus and on app resume, then reads from Supabase.
  const { data, loading, reload } = useLoader(async () => {
    const { health, syncError } = await connectAndSync(userId);
    await syncTimezone(userId);
    const [profile, history, groups, lifetime, journey, hasPet] = await Promise.all([
      getProfile(userId),
      // Two weeks: the tiles show the last 7 days, and the detail card compares them with the 7 before.
      getStepHistory(userId, 14),
      getMyGroups(),
      getProfileStats(userId),
      // undefined (card hidden) rather than failing the whole screen, e.g. before migration 012.
      getCurrentJourney(userId).catch(() => undefined),
      // Likewise: if it can't tell, it doesn't invite them to adopt one.
      hasWorld(userId).catch(() => true),
    ]);
    const [previews, recap] = await Promise.all([
      Promise.all(
        groups.slice(0, 3).map(async (group) => {
          const [rows, latestMessageId] = await Promise.all([
            getLeaderboard(group.id, 'today'),
            getLatestMessageId(group.id, userId),
          ]);
          return { group, rows, latestMessageId };
        })
      ),
      // Extra: if the recap fails to load, the rest of the screen still shows.
      loadRecap(userId, groups).catch(() => null),
    ]);
    return { profile, history, previews, groupCount: groups.length, lifetime, journey, hasPet, recap, health, syncError };
  }, userId);

  // The morning recap pops up once a day, the first time Today loads after 5 am.
  const recap = data?.recap;
  useEffect(() => {
    if (!recap?.groups.length || !recapUnseen(recap.day)) return;
    markRecapSeen(recap.day);
    router.push('/recap');
  }, [recap]);

  // Keep today's count live while this tab is on screen: re-sync on app resume (focus doesn't
  // change then) and every minute in the foreground, so we don't fall behind the health app.
  useFocusEffect(
    useCallback(() => {
      const timer = setInterval(() => {
        if (AppState.currentState === 'active') reload();
      }, RESYNC_MS);
      const sub = AppState.addEventListener('change', (state) => {
        if (state === 'active') reload();
      });
      return () => {
        clearInterval(timer);
        sub.remove();
      };
    }, [reload])
  );

  // Only a pull shows the spinner; background re-syncs update quietly.
  const [refreshing, setRefreshing] = useState(false);
  async function pullToRefresh() {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }

  const health = data?.health;
  const snack = data?.syncError && data.syncError !== dismissedError ? data.syncError : null;

  const goal = data?.profile.daily_goal ?? 10000;
  const week = data?.history.slice(-7) ?? [];
  const stats = data ? summarize(week) : null;
  const ratio = stats ? stats.today / goal : 0;
  const over = ratio > 1;
  const bestDay = week.reduce<(typeof week)[number] | null>(
    (best, d) => (d.steps > 0 && (!best || d.steps > best.steps) ? d : best),
    null
  );
  const goalHits = week.map((d) => d.steps >= goal);
  const shortDate = (day: string) =>
    new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const weekRange = week.length ? `${shortDate(week[0].day)} – ${shortDate(week[week.length - 1].day)}` : undefined;

  // Each tile opens its own detail card, grown out of that tile.
  const [detail, setDetail] = useState<{ kind: WeekDetailKind; origin: Rect } | null>(null);
  const open = (kind: WeekDetailKind) => (origin: Rect) => setDetail({ kind, origin });

  // All four tiles match the tallest (Goal met, with its weekday letters), across both rows.
  const [tileHeight, setTileHeight] = useState(0);
  const tileSize = {
    minHeight: tileHeight || undefined,
    onLayout: (e: LayoutChangeEvent) => {
      const height = e.nativeEvent.layout.height;
      // Only a real difference counts. Snapped to the screen's pixels, a tile can measure a hair over
      // its minimum; growing to that (or rounding up) each time stretched the tiles a little more on
      // every layout, without end.
      setTileHeight((t) => (height > t + 1 ? height : t));
    },
  };

  return (
    <View style={[styles.flex, screenBackground(theme)]}>
      <Appbar.Header mode="small" style={transparentHeader}>
        <Appbar.Content title="Today" />
        <GlassAction
          icon="sync"
          disabled={loading}
          onPress={reload}
          accessibilityLabel={`Sync with ${healthSourceName}`}
        />
        <GlassAction icon="cog-outline" onPress={() => router.push('/settings')} accessibilityLabel="Settings" />
      </Appbar.Header>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: tabBarSpace }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={pullToRefresh} />}>
        {health === 'unavailable' || health === 'denied' ? (
          <Card mode="contained" style={{ backgroundColor: theme.colors.errorContainer }}>
            <Card.Title
              title={health === 'unavailable' ? `${healthSourceName} unavailable` : 'Permission needed'}
              titleStyle={{ color: theme.colors.onErrorContainer }}
            />
            <Card.Content>
              <Text style={{ color: theme.colors.onErrorContainer }}>
                {health === 'unavailable'
                  ? Platform.OS === 'android'
                    ? 'Install or update Health Connect from the Play Store to sync your steps.'
                    : 'Step syncing requires the iOS or Android app.'
                  : `Allow Steppa to read steps in ${healthSourceName}.`}
              </Text>
            </Card.Content>
            {Platform.OS !== 'web' ? (
              <Card.Actions>
                <Button onPress={openHealthSettings}>Open settings</Button>
                <Button mode="contained" onPress={reload}>
                  Try again
                </Button>
              </Card.Actions>
            ) : null}
          </Card>
        ) : null}

        {data ? <CharacterIntroCard profile={data.profile} onDone={() => setCharacterIntroDone(true)} /> : null}
        {/* Only while there's no journey (null); undefined means journeys couldn't load. */}
        {data && data.journey === null ? <JourneyIntroCard profile={data.profile} /> : null}
        {/* One thing at a time: the pet invite waits until they've made their character or set it aside. */}
        {data && !data.hasPet && (data.profile.podium_character || characterIntroDone) ? (
          <PetIntroCard profile={data.profile} />
        ) : null}

        <View style={styles.hero}>
            {/* Sized so the streak card still fits on screen below the insight tiles. */}
            <ProgressRing
              progress={ratio}
              size={176}
              stroke={14}
              color={theme.colors.primary}
              overflowColor={theme.colors.accent}
              trackColor={ringTrack(theme)}>
              <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>
                Steps today
              </Text>
              <Text
                variant="displaySmall"
                numberOfLines={1}
                adjustsFontSizeToFit
                style={{ color: over ? theme.colors.accentText : theme.colors.primary, fontWeight: '700' }}>
                {formatSteps(stats?.today ?? 0)}
              </Text>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                {over
                  ? `+${formatSteps((stats?.today ?? 0) - goal)} over goal`
                  : `${Math.round(ratio * 100)}% of ${formatSteps(goal)}`}
              </Text>
            </ProgressRing>
        </View>

        {data && stats ? (
          <View style={styles.grid}>
            {/* Every tile below covers the same window: today and the 6 days before it. */}
            <SectionHeader title="Last 7 days" note={weekRange} />
            <View style={styles.row}>
              <InsightTile
                {...tileSize}
                label="Daily average"
                value={formatSteps(stats.average)}
                progress={stats.average / goal}
                supporting={`${Math.round((stats.average / goal) * 100)}% of goal`}
                onPress={open('average')}
              />
              <InsightTile
                {...tileSize}
                label="Total"
                value={formatSteps(stats.total)}
                progress={stats.total / (goal * 7)}
                supporting={`of ${formatSteps(goal * 7)}`}
                onPress={open('total')}
              />
            </View>
            <View style={styles.row}>
              <InsightTile
                {...tileSize}
                label="Best day"
                value={formatSteps(stats.best)}
                progress={stats.best / goal}
                supporting={
                  bestDay
                    ? new Date(`${bestDay.day}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long' })
                    : 'No steps yet'
                }
                onPress={open('best')}
              />
              <InsightTile
                {...tileSize}
                label="Goal met"
                value={`${goalHits.filter(Boolean).length} of 7 days`}
                supporting={`Goal: ${formatSteps(goal)} steps`}
                onPress={open('goal')}>
                <GoalSegments
                  hits={goalHits}
                  labels={week.map((d) => shortWeekday(new Date(`${d.day}T12:00:00`)))}
                />
              </InsightTile>
            </View>
          </View>
        ) : null}

        {data ? <StreakCard current={data.lifetime.current_streak} longest={data.lifetime.longest_streak} /> : null}

        {data ? (
          <View style={styles.section}>
            <SectionHeader
              title="Your groups"
              note={data.groupCount ? `${data.groupCount} ${data.groupCount === 1 ? 'group' : 'groups'}` : undefined}
              onPress={data.groupCount ? () => router.navigate('/groups') : undefined}
            />
            {/* Yesterday's podium leads the section, above today's group cards. */}
            {recap?.groups.length ? <RecapPreview recap={recap} /> : null}
            {data.previews.length ? (
              data.previews.map(({ group, rows, latestMessageId }) => (
                <GroupPreview
                  key={group.id}
                  group={group}
                  rows={rows}
                  userId={userId}
                  latestMessageId={latestMessageId}
                />
              ))
            ) : (
              <Card mode="contained" style={glassCard(theme)}>
                <Card.Content style={styles.emptyGroups}>
                  <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                    Compete with friends by creating or joining a group.
                  </Text>
                  <Button mode="contained-tonal" icon="account-group" onPress={() => router.navigate('/groups')}>
                    Go to groups
                  </Button>
                </Card.Content>
              </Card>
            )}
          </View>
        ) : null}

        {data && data.journey !== undefined ? (
          <View style={styles.section}>
            <SectionHeader title="Your journey" />
            <JourneyPreview current={data.journey} profile={data.profile} />
          </View>
        ) : null}
      </ScrollView>

      {data && detail ? (
        <WeekDetail
          kind={detail.kind}
          origin={detail.origin}
          history={data.history}
          goal={goal}
          streak={data.lifetime.current_streak}
          onClose={() => setDetail(null)}
        />
      ) : null}

      <Snackbar
        visible={!!snack}
        onDismiss={() => setDismissedError(snack)}
        duration={4000}
        wrapperStyle={{ bottom: TAB_BAR_OFFSET }}>
        {snack}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 16 },
  hero: { alignItems: 'center', paddingVertical: 8 },
  row: { flexDirection: 'row', gap: 12 },
  grid: { gap: 12 },
  section: { gap: 12 },
  emptyGroups: { gap: 12, alignItems: 'flex-start', paddingVertical: 16 },
});
