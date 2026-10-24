import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { ActivityIndicator, Appbar, Card, Text } from 'react-native-paper';
import Animated, { BounceIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { GlassBackAction } from '@/components/glass-action';
import { Chip, PostcardCollection, ProgressBar } from '@/components/journey-parts';
import { JourneyScene } from '@/components/journey-scene';
import { PostcardModal } from '@/components/postcard';
import { mapHeightFor, RouteMap, type Traveller } from '@/components/route-map';
import { SectionHeader } from '@/components/section-header';
import { useCountUp } from '@/hooks/use-count-up';
import { useLoader } from '@/hooks/use-loader';
import {
  endJourney,
  getCompletedJourneys,
  getCurrentJourney,
  getProfile,
  getStepHistory,
  markPostcardsSeen,
  startJourney,
  type CurrentJourney,
  type Journey,
  type Profile,
} from '@/lib/api';
import { formatSteps } from '@/lib/dates';
import {
  formatDuration,
  formatKm,
  getRoute,
  journeyDay,
  progressOn,
  ROUTES,
  SKIES,
  stepsForKm,
  type Progress,
  type Route,
  type Stop,
} from '@/lib/journeys';
import { useUserId } from '@/providers/auth-provider';
import { glassCard, screenBackground, transparentHeader, useAppTheme } from '@/theme';

type PostcardView = { stops: Stop[]; title: string; open: boolean };

export default function JourneyScreen() {
  const theme = useAppTheme();
  const userId = useUserId();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [postcards, setPostcards] = useState<PostcardView | null>(null);

  const { data, error, reload } = useLoader(async () => {
    const [profile, current, completed, history] = await Promise.all([
      getProfile(userId),
      getCurrentJourney(userId),
      getCompletedJourneys(userId),
      getStepHistory(userId, 14),
    ]);
    return { profile, current, completed, history };
  }, userId);

  const current = data?.current ?? null;
  const progress = current ? progressOn(current.route, current.steps) : null;
  const finished = !!current?.journey.completed_on;

  // New postcards open by themselves, once per batch (starting a route gives you the first one).
  const seen = current?.journey.postcards_seen ?? 0;
  const batch = current && progress && progress.reached > seen ? `${current.journey.id}:${progress.reached}` : null;
  const [openedBatch, setOpenedBatch] = useState<string | null>(null);
  if (batch && batch !== openedBatch && current && progress) {
    setOpenedBatch(batch);
    const count = progress.reached - seen;
    setPostcards({
      stops: current.route.stops.slice(seen, progress.reached),
      title: count === 1 ? '📮 New postcard!' : `📮 ${count} new postcards!`,
      open: true,
    });
  }
  const journeyId = current?.journey.id;
  const reached = progress?.reached;
  useEffect(() => {
    if (batch && journeyId !== undefined && reached !== undefined) {
      markPostcardsSeen(journeyId, reached).catch(() => {});
    }
  }, [batch, journeyId, reached]);

  // Typical steps on days you walk, over the last two weeks; your goal until there's history.
  const activeDays = data?.history.filter((d) => d.steps > 0) ?? [];
  const dailySteps = activeDays.length
    ? activeDays.reduce((sum, d) => sum + d.steps, 0) / activeDays.length
    : (data?.profile.daily_goal ?? 10000);

  const traveller: Traveller | undefined = data
    ? { name: data.profile.display_name, color: data.profile.avatar_color, icon: data.profile.avatar_icon }
    : undefined;

  function fail(e: unknown) {
    Alert.alert('Something went wrong', e instanceof Error ? e.message : String(e));
  }

  function start(route: Route) {
    Alert.alert(
      `Walk ${route.name}?`,
      `${formatKm(route.totalKm)} km with ${route.stops.length} postcards to collect. Every step from today counts.`,
      [
        { text: 'Not yet', style: 'cancel' },
        {
          text: "Let's go",
          onPress: async () => {
            setBusy(true);
            try {
              await startJourney(userId, route.key);
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

  function end(c: CurrentJourney, km: number) {
    Alert.alert('End this journey?', `You'll lose your ${formatKm(km)} km on ${c.route.name}.`, [
      { text: 'Keep walking', style: 'cancel' },
      {
        text: 'End journey',
        style: 'destructive',
        onPress: () =>
          endJourney(c.journey.id)
            .then(reload)
            .catch(fail),
      },
    ]);
  }

  function showPostcard(stop: Stop) {
    setPostcards({ stops: [stop], title: '📮 Postcard', open: true });
  }

  const active = current && progress && !finished ? { current, progress } : null;

  return (
    <View style={[styles.flex, screenBackground(theme)]}>
      <Appbar.Header style={transparentHeader}>
        <GlassBackAction onPress={() => router.back()} />
        <Appbar.Content title={active ? active.current.route.name : 'Journeys'} />
      </Appbar.Header>

      {!data ? (
        <View style={styles.center}>
          {error ? <Text style={{ color: theme.colors.error }}>{error}</Text> : <ActivityIndicator />}
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
          {active ? (
            <ActiveJourney
              current={active.current}
              progress={active.progress}
              profile={data.profile}
              traveller={traveller}
              dailySteps={dailySteps}
              onOpenPostcard={showPostcard}
              onEnd={() => end(active.current, active.progress.km)}
            />
          ) : null}

          {current && finished ? (
            <FinishedJourney
              current={current}
              profile={data.profile}
              traveller={traveller}
              onOpenPostcard={showPostcard}
            />
          ) : null}

          {!active ? (
            <RoutePicker
              title={current ? 'Where next?' : 'Choose a journey'}
              dailySteps={dailySteps}
              completed={data.completed}
              busy={busy}
              onStart={start}
            />
          ) : null}

          {data.completed.length ? <Passport journeys={data.completed} /> : null}
        </ScrollView>
      )}

      {postcards && current && data ? (
        <PostcardModal
          open={postcards.open}
          route={current.route}
          stops={postcards.stops}
          people={[data.profile]}
          you={data.profile.id}
          recipient={data.profile.display_name}
          title={postcards.title}
          onClose={() => setPostcards({ ...postcards, open: false })}
        />
      ) : null}
    </View>
  );
}

type ActiveProps = {
  current: CurrentJourney;
  progress: Progress;
  profile: Profile;
  traveller?: Traveller;
  dailySteps: number;
  onOpenPostcard: (stop: Stop) => void;
  onEnd: () => void;
};

function ActiveJourney({ current, progress, profile, traveller, dailySteps, onOpenPostcard, onEnd }: ActiveProps) {
  const theme = useAppTheme();
  const { width } = useWindowDimensions();
  const { journey, route, steps } = current;
  const day = journeyDay(journey.started_on);
  const kmShown = useCountUp(Math.round(progress.km * 10), 1400, 250) / 10;
  const next = progress.next;
  const kmToNext = next ? next.km - progress.km : 0;
  const daysLeft = stepsForKm(route.totalKm - progress.km) / Math.max(dailySteps, 1);
  // Your character waves from where you are: the stop you last reached, or the next one once
  // you're past halfway to it.
  const nearNext = next && progress.km >= (progress.last.km + next.km) / 2 ? next : null;
  const sceneStop = nearNext ?? progress.last;
  const greeting = nearNext ? `Almost at ${nearNext.name}!` : `Hi from ${progress.last.name}!`;

  return (
    <>
      <Animated.View entering={FadeInDown.springify().damping(18)} style={styles.hero}>
        <Text style={styles.heroFlag}>{route.flag}</Text>
        <View style={styles.flex}>
          <Text variant="titleMedium" style={styles.bold}>
            {route.subtitle}
          </Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            Day {day} · {formatSteps(steps)} steps so far
          </Text>
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(80).springify().damping(18)}>
        <JourneyScene people={[profile]} stop={sceneStop} greeting={greeting} />
      </Animated.View>

      <RouteMap
        route={route}
        km={progress.km}
        height={mapHeightFor(route, width - 32, 240, 420)}
        traveller={traveller}
        detailed
      />

      <Card mode="contained" style={glassCard(theme)}>
        <Card.Content style={styles.progressCard}>
          <View style={styles.kmRow}>
            <Text variant="displaySmall" style={[styles.bold, { color: theme.colors.primary }]}>
              {formatKm(kmShown)}
            </Text>
            <Text variant="titleMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              of {formatKm(route.totalKm)} km
            </Text>
          </View>
          <ProgressBar fraction={progress.fraction} />
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {Math.floor(progress.fraction * 100)}% of the way · {progress.reached} of {route.stops.length} stops
          </Text>
        </Card.Content>
      </Card>

      <View style={styles.tiles}>
        {next ? (
          <Animated.View entering={FadeInDown.delay(150).springify().damping(18)} style={styles.flex}>
            <Card mode="contained" style={[glassCard(theme), styles.tile]}>
              <Card.Content style={styles.tileContent}>
                <View style={[styles.stopBadge, { experimental_backgroundImage: skyGradient(next) }]}>
                  <Text style={styles.stopEmoji}>{next.emoji}</Text>
                </View>
                <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>
                  Next stop
                </Text>
                <Text variant="titleMedium" numberOfLines={1} style={styles.bold}>
                  {next.name}
                </Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  {formatKm(kmToNext)} km · about {formatSteps(stepsForKm(kmToNext))} steps
                </Text>
              </Card.Content>
            </Card>
          </Animated.View>
        ) : null}
        <Animated.View entering={FadeInDown.delay(250).springify().damping(18)} style={styles.flex}>
          <Card mode="contained" style={[glassCard(theme), styles.tile]}>
            <Card.Content style={styles.tileContent}>
              <View style={[styles.stopBadge, { backgroundColor: theme.colors.tertiaryContainer }]}>
                <Text style={styles.stopEmoji}>{route.stops[route.stops.length - 1]!.emoji}</Text>
              </View>
              <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>
                Arriving
              </Text>
              <Text variant="titleMedium" numberOfLines={1} style={styles.bold}>
                {capitalize(formatDuration(daysLeft))}
              </Text>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                at {formatSteps(dailySteps)} steps a day
              </Text>
            </Card.Content>
          </Card>
        </Animated.View>
      </View>

      <PostcardCollection route={route} progress={progress} onOpen={onOpenPostcard} />

      <Button icon="flag-off-outline" textColor={theme.colors.error} onPress={onEnd} style={styles.endButton}>
        End journey
      </Button>
    </>
  );
}

function FinishedJourney({
  current,
  profile,
  traveller,
  onOpenPostcard,
}: {
  current: CurrentJourney;
  profile: Profile;
  traveller?: Traveller;
  onOpenPostcard: (stop: Stop) => void;
}) {
  const theme = useAppTheme();
  const { width } = useWindowDimensions();
  const { journey, route, steps } = current;
  const progress = progressOn(route, steps);
  const days = journeyDay(journey.started_on, new Date(`${journey.completed_on}T12:00:00`));

  return (
    <>
      <Card mode="contained" style={glassCard(theme)}>
        <Card.Content style={styles.finished}>
          <Animated.Text entering={BounceIn.delay(150)} style={styles.trophy}>
            🏆
          </Animated.Text>
          <Text variant="headlineSmall" style={[styles.bold, styles.centerText]}>
            You made it to {progress.last.name}!
          </Text>
          <Text variant="bodyMedium" style={[styles.centerText, { color: theme.colors.onSurfaceVariant }]}>
            {formatKm(route.totalKm)} km in {days} {days === 1 ? 'day' : 'days'}, every postcard collected.
          </Text>
        </Card.Content>
      </Card>
      <JourneyScene people={[profile]} stop={progress.last} greeting={`Made it to ${progress.last.name}!`} />
      <RouteMap
        route={route}
        km={route.totalKm}
        height={mapHeightFor(route, width - 32, 220, 360)}
        traveller={traveller}
        detailed
      />
      <PostcardCollection route={route} progress={progress} onOpen={onOpenPostcard} />
    </>
  );
}

type PickerProps = {
  title: string;
  dailySteps: number;
  completed: Journey[];
  busy: boolean;
  onStart: (route: Route) => void;
};

function RoutePicker({ title, dailySteps, completed, busy, onStart }: PickerProps) {
  const theme = useAppTheme();
  const { width } = useWindowDimensions();
  const done = new Set(completed.map((j) => j.route));

  return (
    <View style={styles.section}>
      <Text variant="titleLarge" style={styles.bold}>
        {title}
      </Text>
      <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
        Every step from the day you start moves you along the route. About 1,300 steps make a kilometre, and each
        stop sends you a postcard.
      </Text>
      {ROUTES.map((route, i) => (
        <Animated.View key={route.key} entering={FadeInDown.delay(i * 120).springify().damping(18)}>
          <Card mode="contained" style={glassCard(theme)}>
            <View style={styles.pickerMap}>
              {/* No traveller: the whole route draws itself in, one card after another. */}
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
                {done.has(route.key) ? <Text style={styles.doneMark}>✅</Text> : null}
              </View>
              <View style={styles.chips}>
                <Chip text={`${formatKm(route.totalKm)} km`} />
                <Chip text={`${route.stops.length} postcards`} />
                <Chip text={`${formatDuration(stepsForKm(route.totalKm) / Math.max(dailySteps, 1))} at your pace`} />
              </View>
              <Button mode="contained" disabled={busy} onPress={() => onStart(route)} style={styles.startButton}>
                {done.has(route.key) ? 'Walk it again' : 'Start'}
              </Button>
            </Card.Content>
          </Card>
        </Animated.View>
      ))}
    </View>
  );
}

/** Finished journeys, like stamps in a passport. */
function Passport({ journeys }: { journeys: Journey[] }) {
  const theme = useAppTheme();

  return (
    <View style={styles.section}>
      <SectionHeader title="Passport" />
      <Card mode="contained" style={glassCard(theme)}>
        <Card.Content style={styles.passport}>
          {journeys.map((j, i) => {
            const route = getRoute(j.route);
            if (!route || !j.completed_on) return null;
            const days = journeyDay(j.started_on, new Date(`${j.completed_on}T12:00:00`));
            const finishedOn = new Date(`${j.completed_on}T12:00:00`).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });
            return (
              <Animated.View key={j.id} entering={FadeInDown.delay(i * 80)} style={styles.passportRow}>
                <View
                  style={[
                    styles.passportStamp,
                    { borderColor: theme.colors.primary, transform: [{ rotate: `${i % 2 ? 6 : -6}deg` }] },
                  ]}>
                  <Text style={styles.stopEmoji}>{route.flag}</Text>
                </View>
                <View style={styles.flex}>
                  <Text variant="titleSmall">{route.name}</Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    {formatKm(route.totalKm)} km in {days} {days === 1 ? 'day' : 'days'} · {finishedOn}
                  </Text>
                </View>
              </Animated.View>
            );
          })}
        </Card.Content>
      </Card>
    </View>
  );
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function skyGradient(stop: Stop): string {
  const [top, bottom] = SKIES[stop.sky];
  return `linear-gradient(180deg, ${top} 0%, ${bottom} 100%)`;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, gap: 16 },
  bold: { fontWeight: '700' },
  centerText: { textAlign: 'center' },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroFlag: { fontSize: 36, lineHeight: 44 },
  progressCard: { gap: 10, paddingVertical: 16 },
  kmRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  tiles: { flexDirection: 'row', gap: 12 },
  tile: { flex: 1 },
  tileContent: { gap: 2, paddingVertical: 14 },
  stopBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  stopEmoji: { fontSize: 20, lineHeight: 26 },
  section: { gap: 12 },
  endButton: { alignSelf: 'center' },
  finished: { alignItems: 'center', gap: 6, paddingVertical: 20 },
  trophy: { fontSize: 56, lineHeight: 68 },
  pickerMap: { padding: 12, paddingBottom: 0 },
  pickerContent: { gap: 10, paddingTop: 12, paddingBottom: 16 },
  pickerTitle: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pickerFlag: { fontSize: 28, lineHeight: 36 },
  doneMark: { fontSize: 18 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  startButton: { alignSelf: 'flex-start' },
  passport: { gap: 14, paddingVertical: 16 },
  passportRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  passportStamp: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
