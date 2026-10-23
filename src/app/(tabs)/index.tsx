import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { AppState, Platform, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import {
  Appbar,
  Button,
  Card,
  Snackbar,
  Text,
} from 'react-native-paper';

import { TAB_BAR_OFFSET, useTabBarSpace } from '@/components/floating-tab-bar';
import { GroupPreview } from '@/components/group-preview';
import { GoalSegments, InsightTile } from '@/components/insight-tile';
import { JourneyPreview } from '@/components/journey-preview';
import { RecapSummaryCard } from '@/components/morning-recap';
import { StreakCard } from '@/components/profile-stats';
import { ProgressRing } from '@/components/progress-ring';
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
import { useUserId } from '@/providers/auth-provider';
import { screenBackground, surfaceCard, transparentHeader, useAppTheme } from '@/theme';

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

  // Syncs from the phone's health store on focus and on app resume, then reads from Supabase.
  const { data, loading, reload } = useLoader(async () => {
    const { health, syncError } = await connectAndSync(userId);
    await syncTimezone(userId);
    const [profile, history, groups, lifetime, journey] = await Promise.all([
      getProfile(userId),
      getStepHistory(userId, 7),
      getMyGroups(),
      getProfileStats(userId),
      // undefined (card hidden) rather than failing the whole screen, e.g. before migration 012.
      getCurrentJourney(userId).catch(() => undefined),
    ]);
    const previews = await Promise.all(
      groups.slice(0, 3).map(async (group) => {
        const [rows, latestMessageId] = await Promise.all([
          getLeaderboard(group.id, 'today'),
          getLatestMessageId(group.id, userId),
        ]);
        return { group, rows, latestMessageId };
      })
    );
    return { profile, history, previews, lifetime, journey, health, syncError };
  }, userId);

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
  const stats = data ? summarize(data.history) : null;
  const ratio = stats ? stats.today / goal : 0;
  const over = ratio > 1;
  const bestDay = data?.history.reduce<(typeof data.history)[number] | null>(
    (best, d) => (d.steps > 0 && (!best || d.steps > best.steps) ? d : best),
    null
  );
  const goalHits = data?.history.map((d) => d.steps >= goal) ?? [];

  return (
    <View style={[styles.flex, screenBackground(theme)]}>
      <Appbar.Header style={transparentHeader}>
        <Appbar.Content title="Today" />
        <Appbar.Action
          icon="sync"
          disabled={loading}
          onPress={reload}
          accessibilityLabel={`Sync with ${healthSourceName}`}
        />
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

        <View style={styles.hero}>
            {/* Sized so the streak card still fits on screen below the insight tiles. */}
            <ProgressRing
              progress={ratio}
              size={176}
              stroke={14}
              color={theme.colors.primary}
              overflowColor={theme.colors.accent}
              trackColor={theme.colors.surfaceVariant}>
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
                  ? `+${formatSteps((stats?.today ?? 0) - goal)} over goal 🎉`
                  : `${Math.round(ratio * 100)}% of ${formatSteps(goal)}`}
              </Text>
            </ProgressRing>
        </View>

        {data && stats ? (
          <View style={styles.grid}>
            {/* Every tile below covers the same window: today and the 6 days before it. */}
            <Text variant="titleMedium">Last 7 days</Text>
            <View style={styles.row}>
              <InsightTile
                label="Daily average"
                value={formatSteps(stats.average)}
                progress={stats.average / goal}
                supporting={`${Math.round((stats.average / goal) * 100)}% of goal`}
              />
              <InsightTile
                label="Total"
                value={formatSteps(stats.total)}
                progress={stats.total / (goal * 7)}
                supporting={`of ${formatSteps(goal * 7)}`}
              />
            </View>
            <View style={styles.row}>
              <InsightTile
                label="Best day"
                value={formatSteps(stats.best)}
                progress={stats.best / goal}
                supporting={
                  bestDay
                    ? new Date(`${bestDay.day}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long' })
                    : 'No steps yet'
                }
              />
              <InsightTile
                label="Goal met"
                value={`${goalHits.filter(Boolean).length} of 7 days`}
                supporting={`Goal: ${formatSteps(goal)} steps`}>
                <GoalSegments
                  hits={goalHits}
                  labels={data.history.map((d) => shortWeekday(new Date(`${d.day}T12:00:00`)))}
                />
              </InsightTile>
            </View>
          </View>
        ) : null}

        {data ? <StreakCard current={data.lifetime.current_streak} longest={data.lifetime.longest_streak} /> : null}

        {data ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text variant="titleMedium">Your groups</Text>
              {data.previews.length ? (
                <Button compact onPress={() => router.navigate('/groups')}>
                  See all
                </Button>
              ) : null}
            </View>
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
              <Card mode="contained" style={surfaceCard(theme)}>
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
            <Text variant="titleMedium">Your journey</Text>
            <JourneyPreview current={data.journey} profile={data.profile} />
          </View>
        ) : null}

        <RecapSummaryCard userId={userId} />
      </ScrollView>

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
  section: { gap: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  emptyGroups: { gap: 12, alignItems: 'flex-start', paddingVertical: 16 },
});
