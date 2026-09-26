import { BlurTargetView } from 'expo-blur';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Platform, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import {
  Appbar,
  Button,
  Card,
  Snackbar,
  Text,
} from 'react-native-paper';

import { TAB_BAR_OFFSET, useTabBarSpace } from '@/components/floating-tab-bar';
import { GlassCard } from '@/components/glass-card';
import { GroupPreview } from '@/components/group-preview';
import { GoalSegments, InsightTile } from '@/components/insight-tile';
import { ProgressRing } from '@/components/progress-ring';
import { WeekChart } from '@/components/week-chart';
import { useLoader } from '@/hooks/use-loader';
import {
  getLeaderboard,
  getMyGroups,
  getProfile,
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
import { screenBackground, tintedCard, transparentHeader, useAppTheme } from '@/theme';

type HealthState = 'unavailable' | 'denied' | 'ready';

async function connectAndSync(userId: string): Promise<{ health: HealthState; syncError: string | null }> {
  try {
    if (!(await isHealthAvailable())) return { health: 'unavailable', syncError: null };
    if (!(await requestHealthPermission())) return { health: 'denied', syncError: null };
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
  const backgroundRef = useRef<View>(null);
  const [dismissedError, setDismissedError] = useState<string | null>(null);

  // Syncs from the phone's health store every time this tab is focused, then reads from Supabase.
  const { data, loading, reload } = useLoader(async () => {
    const { health, syncError } = await connectAndSync(userId);
    await syncTimezone(userId);
    const [profile, history, groups] = await Promise.all([
      getProfile(userId),
      getStepHistory(userId, 7),
      getMyGroups(),
    ]);
    const previews = await Promise.all(
      groups.slice(0, 3).map(async (group) => ({ group, rows: await getLeaderboard(group.id, 'today') }))
    );
    return { profile, history, previews, health, syncError };
  }, userId);

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
    <View style={styles.flex}>
      {/* Background lives in its own blur target so the glass card can blur it on Android. */}
      <BlurTargetView ref={backgroundRef} style={StyleSheet.absoluteFill}>
        {/* The native blur target ignores CSS gradients, so draw the background in a normal view. */}
        <View style={[StyleSheet.absoluteFill, screenBackground(theme)]} />
      </BlurTargetView>
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
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}>
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

        <GlassCard blurTarget={backgroundRef}>
          <View style={styles.hero}>
            <ProgressRing
              progress={ratio}
              color={theme.colors.primary}
              overflowColor={theme.colors.accent}
              trackColor={theme.colors.surfaceVariant}>
              <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>
                Steps today
              </Text>
              <Text
                variant="displayMedium"
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
        </GlassCard>

        {data && stats ? (
          <View style={styles.grid}>
            <View style={styles.row}>
              <InsightTile
                label="Daily average"
                value={formatSteps(stats.average)}
                progress={stats.average / goal}
                supporting={`${Math.round((stats.average / goal) * 100)}% of goal`}
              />
              <InsightTile
                label="This week"
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
                supporting="Last 7 days">
                <GoalSegments
                  hits={goalHits}
                  labels={data.history.map((d) => shortWeekday(new Date(`${d.day}T12:00:00`)))}
                />
              </InsightTile>
            </View>
          </View>
        ) : null}

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
              data.previews.map(({ group, rows }) => (
                <GroupPreview key={group.id} group={group} rows={rows} userId={userId} />
              ))
            ) : (
              <Card mode="contained" style={{ backgroundColor: theme.colors.elevation.level1 }}>
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

        <Card mode="contained" style={tintedCard(theme)}>
          <Card.Title title="Last 7 days" />
          <Card.Content>
            {data ? (
              <WeekChart
                series={[{ name: 'You', color: theme.colors.primary, data: data.history }]}
                goal={goal}
              />
            ) : null}
          </Card.Content>
        </Card>
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
  hero: { alignItems: 'center', paddingVertical: 24 },
  row: { flexDirection: 'row', gap: 12 },
  grid: { gap: 12 },
  section: { gap: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  emptyGroups: { gap: 12, alignItems: 'flex-start', paddingVertical: 16 },
});
