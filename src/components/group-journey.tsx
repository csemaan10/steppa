import 'expo-sqlite/localStorage/install';
import { useEffect, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { ActivityIndicator, Card, Text } from 'react-native-paper';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Chip, PostcardCollection, ProgressBar } from '@/components/journey-parts';
import { JourneyScene, type Person } from '@/components/journey-scene';
import { PostcardModal } from '@/components/postcard';
import { mapHeightFor, RouteMap } from '@/components/route-map';
import { SectionHeader } from '@/components/section-header';
import { UserAvatar } from '@/components/user-avatar';
import { useLoader } from '@/hooks/use-loader';
import {
  endGroupJourney,
  getGroupJourney,
  getLeaderboard,
  startGroupJourney,
  type Group,
  type GroupJourneyStatus,
  type LeaderboardRow,
} from '@/lib/api';
import { formatSteps } from '@/lib/dates';
import {
  formatDuration,
  formatKm,
  GROUP_ROUTES,
  journeyDay,
  kmFromSteps,
  progressOn,
  stepsForKm,
  type Route,
  type Stop,
} from '@/lib/journeys';
import { glassCard, useAppTheme, withAlpha } from '@/theme';

type Props = {
  group: Group;
  userId: string;
  /** The group's members, for their characters and names (the group page's leaderboard rows). */
  members: LeaderboardRow[];
  /** False while the tab is hidden but kept alive: the scene holds still and new postcards wait. */
  active: boolean;
};

type PostcardView = { stops: Stop[]; title: string; open: boolean };

/** How many of a group journey's postcards this phone has shown (each member sees their own). */
function seenCount(journeyId: number): number {
  try {
    return Number(localStorage.getItem(`steppa:group-postcards:${journeyId}`)) || 0;
  } catch {
    return 0;
  }
}

function markSeen(journeyId: number, count: number) {
  try {
    localStorage.setItem(`steppa:group-postcards:${journeyId}`, String(count));
  } catch {}
}

/**
 * A group's Journey tab: the whole group walks one long route together on everyone's steps added
 * up. The owner picks the route; everyone sees the group standing together at the latest stop,
 * the map, who's carrying the group, and a group-photo postcard from every stop.
 */
export function GroupJourney({ group, userId, members, active }: Props) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const isOwner = group.owner_id === userId;
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [postcards, setPostcards] = useState<PostcardView | null>(null);

  const { data, error, reload } = useLoader(async () => {
    const [status, week] = await Promise.all([getGroupJourney(group.id), getLeaderboard(group.id, 'week')]);
    // The group's usual day: everyone's steps over the last week, per day.
    return { status, groupDaily: week.reduce((sum, r) => sum + r.total_steps, 0) / 7 };
  }, group.id);

  const status = data?.status ?? null;
  const progress = status ? progressOn(status.route, status.steps) : null;
  const finished = !!status?.journey.completed_on;
  const people: Person[] = members.map((m) => ({ id: m.user_id, podium_character: m.podium_character }));

  // New postcards open by themselves (on this tab, once per batch), as on a solo journey.
  const seen = status ? seenCount(status.journey.id) : 0;
  const batch =
    active && status && progress && progress.reached > seen ? `${status.journey.id}:${progress.reached}` : null;
  const [openedBatch, setOpenedBatch] = useState<string | null>(null);
  if (batch && batch !== openedBatch && status && progress) {
    setOpenedBatch(batch);
    const count = progress.reached - seen;
    setPostcards({
      stops: status.route.stops.slice(seen, progress.reached),
      title: count === 1 ? '📮 New group postcard!' : `📮 ${count} new group postcards!`,
      open: true,
    });
  }
  const journeyId = status?.journey.id;
  const reached = progress?.reached;
  useEffect(() => {
    if (batch && journeyId !== undefined && reached !== undefined) markSeen(journeyId, reached);
  }, [batch, journeyId, reached]);

  async function refresh() {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }

  function fail(e: unknown) {
    Alert.alert('Something went wrong', e instanceof Error ? e.message : String(e));
  }

  function start(route: Route) {
    Alert.alert(
      `Walk ${route.name} together?`,
      `${formatKm(route.totalKm)} km with ${route.stops.length} postcards. Everyone's steps from today count.`,
      [
        { text: 'Not yet', style: 'cancel' },
        {
          text: "Let's go",
          onPress: async () => {
            setBusy(true);
            try {
              await startGroupJourney(group.id, route.key);
              await reload();
            } catch (e) {
              fail(e);
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  }

  function end(s: GroupJourneyStatus, km: number) {
    Alert.alert('End the group journey?', `Everyone loses the group's ${formatKm(km)} km on ${s.route.name}.`, [
      { text: 'Keep walking', style: 'cancel' },
      {
        text: 'End journey',
        style: 'destructive',
        onPress: () => endGroupJourney(s.journey.id).then(reload).catch(fail),
      },
    ]);
  }

  if (!data) {
    return (
      <View style={styles.center}>
        {error ? <Text>{error}</Text> : <ActivityIndicator />}
      </View>
    );
  }

  const owner = members.find((m) => m.user_id === group.owner_id);

  return (
    <View style={styles.flex}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        {status && progress && !finished ? (
          <Underway
            status={status}
            group={group}
            people={people}
            members={members}
            userId={userId}
            groupDaily={data.groupDaily}
            active={active}
            onOpenPostcard={(stop) => setPostcards({ stops: [stop], title: '📮 Group postcard', open: true })}
            onEnd={isOwner ? () => end(status, progress.km) : undefined}
          />
        ) : null}

        {status && finished ? (
          <>
            <Card mode="contained" style={glassCard(theme)}>
              <Card.Content style={styles.finished}>
                <Text style={styles.trophy}>🏆</Text>
                <Text variant="headlineSmall" style={[styles.bold, styles.centerText]}>
                  {group.name} made it to {status.route.stops[status.route.stops.length - 1]!.name}!
                </Text>
                <Text variant="bodyMedium" style={[styles.centerText, { color: theme.colors.onSurfaceVariant }]}>
                  {formatKm(status.route.totalKm)} km together in{' '}
                  {journeyDay(status.journey.started_on, new Date(`${status.journey.completed_on}T12:00:00`))} days.
                </Text>
              </Card.Content>
            </Card>
            <JourneyScene
              people={people}
              you={userId}
              stop={status.route.stops[status.route.stops.length - 1]!}
              greeting="We made it!"
              height={230}
              animate={active}
            />
            <PostcardCollection
              route={status.route}
              progress={progressOn(status.route, status.steps)}
              onOpen={(stop) => setPostcards({ stops: [stop], title: '📮 Group postcard', open: true })}
            />
          </>
        ) : null}

        {!status || finished ? (
          <RouteChoice
            title={finished ? 'Where next?' : 'Walk somewhere together'}
            groupDaily={data.groupDaily}
            canStart={isOwner}
            ownerName={owner?.display_name}
            busy={busy}
            onStart={start}
          />
        ) : null}
      </ScrollView>

      {postcards && status ? (
        <PostcardModal
          open={postcards.open}
          route={status.route}
          stops={postcards.stops}
          people={people}
          you={userId}
          recipient={group.name}
          title={postcards.title}
          onClose={() => setPostcards({ ...postcards, open: false })}
        />
      ) : null}
    </View>
  );
}

type UnderwayProps = {
  status: GroupJourneyStatus;
  group: Group;
  people: Person[];
  members: LeaderboardRow[];
  userId: string;
  groupDaily: number;
  active: boolean;
  onOpenPostcard: (stop: Stop) => void;
  /** Only for the owner. */
  onEnd?: () => void;
};

function Underway({ status, group, people, members, userId, groupDaily, active, onOpenPostcard, onEnd }: UnderwayProps) {
  const theme = useAppTheme();
  const { width } = useWindowDimensions();
  const { journey, route, steps } = status;
  const progress = progressOn(route, steps);
  const next = progress.next;
  const kmToNext = next ? next.km - progress.km : 0;
  const daysLeft = stepsForKm(route.totalKm - progress.km) / Math.max(groupDaily, 1);
  // The group stands at the stop it last reached, or the next one once it's past halfway there.
  const nearNext = next && progress.km >= (progress.last.km + next.km) / 2 ? next : null;
  const sceneStop = nearNext ?? progress.last;
  const greeting = nearNext ? `Almost at ${nearNext.name}!` : `Hi from ${progress.last.name}!`;
  const names = new Map(members.map((m) => [m.user_id, m]));
  const top = status.members[0]?.steps ?? 0;
  const muted = { color: theme.colors.onSurfaceVariant };

  return (
    <>
      <Animated.View entering={FadeInDown.springify().damping(18)} style={styles.hero}>
        <Text style={styles.heroFlag}>{route.flag}</Text>
        <View style={styles.flex}>
          <Text variant="titleMedium" style={styles.bold}>
            {route.name}
          </Text>
          <Text variant="bodyMedium" style={muted}>
            Day {journeyDay(journey.started_on)} · {formatSteps(steps)} steps together
          </Text>
        </View>
      </Animated.View>

      <JourneyScene people={people} you={userId} stop={sceneStop} greeting={greeting} height={230} animate={active} />

      <RouteMap
        route={route}
        km={progress.km}
        height={mapHeightFor(route, width - 32, 220, 380)}
        traveller={{ name: group.name, color: group.color, icon: group.icon }}
        detailed
      />

      <Card mode="contained" style={glassCard(theme)}>
        <Card.Content style={styles.progressCard}>
          <View style={styles.kmRow}>
            <Text variant="displaySmall" style={[styles.bold, { color: theme.colors.primary }]}>
              {formatKm(progress.km)}
            </Text>
            <Text variant="titleMedium" style={muted}>
              of {formatKm(route.totalKm)} km
            </Text>
          </View>
          <ProgressBar fraction={progress.fraction} />
          <Text variant="bodySmall" style={muted}>
            {Math.floor(progress.fraction * 100)}% of the way · {progress.reached} of {route.stops.length} stops
          </Text>
        </Card.Content>
      </Card>

      <View style={styles.tiles}>
        {next ? (
          <Card mode="contained" style={[glassCard(theme), styles.flex]}>
            <Card.Content style={styles.tile}>
              <Text variant="labelLarge" style={muted}>
                Next stop
              </Text>
              <Text variant="titleMedium" numberOfLines={1} style={styles.bold}>
                {next.emoji} {next.name}
              </Text>
              <Text variant="bodySmall" style={muted}>
                {formatKm(kmToNext)} km to go
              </Text>
            </Card.Content>
          </Card>
        ) : null}
        <Card mode="contained" style={[glassCard(theme), styles.flex]}>
          <Card.Content style={styles.tile}>
            <Text variant="labelLarge" style={muted}>
              Arriving
            </Text>
            <Text variant="titleMedium" numberOfLines={1} style={styles.bold}>
              {formatDuration(daysLeft).replace(/^./, (c) => c.toUpperCase())}
            </Text>
            <Text variant="bodySmall" style={muted}>
              at the group&apos;s pace
            </Text>
          </Card.Content>
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Carrying the group" note={`${status.members.length} walking`} />
        <Card mode="contained" style={glassCard(theme)}>
          <Card.Content style={styles.walkers}>
            {status.members.map((m, i) => {
              const row = names.get(m.user_id);
              const share = steps ? Math.round((m.steps / steps) * 100) : 0;
              const mine = m.user_id === userId;
              // Relative to whoever has walked furthest, so the top walker's bar is full.
              const meter = top ? m.steps / top : 0;
              return (
                <View key={m.user_id} style={styles.walker}>
                  <Text variant="labelLarge" style={[styles.rank, muted]}>
                    {i + 1}
                  </Text>
                  <UserAvatar
                    name={row?.display_name ?? '?'}
                    color={row?.avatar_color ?? theme.colors.outline}
                    icon={row?.avatar_icon}
                    size={32}
                  />
                  <View style={styles.walkerName}>
                    <Text variant="bodyLarge" numberOfLines={1} style={mine && styles.bold}>
                      {mine ? 'You' : (row?.display_name ?? 'Member')}
                    </Text>
                    <View style={[styles.meter, { backgroundColor: withAlpha(theme.colors.onSurface, 0.1) }]}>
                      <View
                        style={[
                          styles.meterFill,
                          { width: `${Math.max(meter, 0.03) * 100}%`, backgroundColor: theme.colors.primary },
                        ]}
                      />
                    </View>
                  </View>
                  <View style={styles.end}>
                    <Text variant="titleSmall" style={styles.bold}>
                      {formatKm(kmFromSteps(m.steps))} km
                    </Text>
                    <Text variant="labelSmall" style={muted}>
                      {share}% of the way
                    </Text>
                  </View>
                </View>
              );
            })}
          </Card.Content>
        </Card>
      </View>

      <PostcardCollection route={route} progress={progress} onOpen={onOpenPostcard} />

      {onEnd ? (
        <Button icon="flag-off-outline" textColor={theme.colors.error} onPress={onEnd} style={styles.endButton}>
          End group journey
        </Button>
      ) : null}
    </>
  );
}

type ChoiceProps = {
  title: string;
  groupDaily: number;
  canStart: boolean;
  ownerName?: string;
  busy: boolean;
  onStart: (route: Route) => void;
};

/** The group routes, each with its map; the owner can start one, everyone else can look. */
function RouteChoice({ title, groupDaily, canStart, ownerName, busy, onStart }: ChoiceProps) {
  const theme = useAppTheme();
  const { width } = useWindowDimensions();

  return (
    <View style={styles.section}>
      <Text variant="titleLarge" style={styles.bold}>
        {title}
      </Text>
      <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
        Everyone&apos;s steps add up to move the whole group along one long route, with a group photo postcard
        from every stop.{' '}
        {canStart ? 'Pick one to start today.' : `${ownerName ?? 'The group owner'} can start one.`}
      </Text>
      {GROUP_ROUTES.map((route, i) => (
        <Animated.View key={route.key} entering={FadeInDown.delay(i * 120).springify().damping(18)}>
          <Card mode="contained" style={glassCard(theme)}>
            <View style={styles.pickerMap}>
              <RouteMap
                route={route}
                km={route.totalKm}
                height={mapHeightFor(route, width - 56, 130, 170)}
                delay={300 + i * 200}
              />
            </View>
            <Card.Content style={styles.pickerContent}>
              <View style={styles.pickerTitle}>
                <Text style={styles.pickerFlag}>{route.flag}</Text>
                <View style={styles.flex}>
                  <Text variant="titleMedium" style={styles.bold}>
                    {route.name}
                  </Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    {route.subtitle}
                  </Text>
                </View>
              </View>
              <View style={styles.chips}>
                <Chip text={`${formatKm(route.totalKm)} km`} />
                <Chip text={`${route.stops.length} postcards`} />
                {groupDaily > 0 ? (
                  <Chip text={`${formatDuration(stepsForKm(route.totalKm) / groupDaily)} together`} />
                ) : null}
              </View>
              {canStart ? (
                <Button mode="contained" disabled={busy} onPress={() => onStart(route)} style={styles.startButton}>
                  Start
                </Button>
              ) : null}
            </Card.Content>
          </Card>
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingTop: 8, gap: 16 },
  bold: { fontWeight: '700' },
  centerText: { textAlign: 'center' },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroFlag: { fontSize: 36, lineHeight: 44 },
  progressCard: { gap: 10, paddingVertical: 16 },
  kmRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  tiles: { flexDirection: 'row', gap: 12 },
  tile: { gap: 2, paddingVertical: 14 },
  section: { gap: 12 },
  walkers: { gap: 12, paddingVertical: 14 },
  walker: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  walkerName: { flex: 1, gap: 4 },
  meter: { height: 4, borderRadius: 2, overflow: 'hidden' },
  meterFill: { height: '100%', borderRadius: 2 },
  rank: { width: 18, textAlign: 'center' },
  end: { alignItems: 'flex-end' },
  endButton: { alignSelf: 'center' },
  finished: { alignItems: 'center', gap: 6, paddingVertical: 20 },
  trophy: { fontSize: 56, lineHeight: 68 },
  pickerMap: { padding: 12, paddingBottom: 0 },
  pickerContent: { gap: 10, paddingTop: 12, paddingBottom: 16 },
  pickerTitle: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pickerFlag: { fontSize: 28, lineHeight: 36 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  startButton: { alignSelf: 'flex-start' },
});
