import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Button, Card, Icon, Text } from 'react-native-paper';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';

import { mapHeightFor, RouteMap } from '@/components/route-map';
import type { CurrentJourney, Profile } from '@/lib/api';
import { formatKm, getRoute, journeyDay, progressOn, ROUTES } from '@/lib/journeys';
import { surfaceCard, useAppTheme } from '@/theme';

/** The route the "start a journey" card draws as a teaser. */
const FEATURED = getRoute('toronto-ottawa')!;
/** Screen padding plus the map's inset inside the card, on both sides. */
const MAP_INSET = 56;

type Props = { current: CurrentJourney | null; profile: Profile };

/** Home screen card: your journey so far, or an invitation to start one. */
export function JourneyPreview({ current, profile }: Props) {
  const theme = useAppTheme();
  const { width } = useWindowDimensions();
  if (!current) return <StartCard />;

  const { journey, route, steps } = current;
  const progress = progressOn(route, steps);
  const finished = !!journey.completed_on;
  const day = journeyDay(journey.started_on, finished ? new Date(`${journey.completed_on}T12:00:00`) : new Date());
  const unseen = Math.max(0, progress.reached - journey.postcards_seen);

  return (
    <Card mode="contained" style={surfaceCard(theme)} onPress={() => router.push('/journey')}>
      <View style={styles.header}>
        <View style={[styles.flag, { backgroundColor: theme.colors.primaryContainer }]}>
          <Text style={styles.flagText}>{route.flag}</Text>
        </View>
        <View style={styles.headerText}>
          <Text variant="titleMedium" numberOfLines={1}>
            {finished ? `You made it to ${progress.last.name}!` : route.name}
          </Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {finished
              ? `${formatKm(route.totalKm)} km in ${day} ${day === 1 ? 'day' : 'days'} 🏁`
              : `Day ${day} · ${Math.floor(progress.fraction * 100)}% of the way`}
          </Text>
        </View>
        {unseen > 0 ? (
          <NewPostcards count={unseen} />
        ) : (
          <Icon source="chevron-right" size={24} color={theme.colors.onSurfaceVariant} />
        )}
      </View>

      <View style={styles.map}>
        <RouteMap
          route={route}
          km={progress.km}
          height={mapHeightFor(route, width - MAP_INSET, 130, 170)}
          traveller={{ name: profile.display_name, color: profile.avatar_color, icon: profile.avatar_icon }}
        />
      </View>

      <View style={styles.footer}>
        <View>
          <Text variant="titleMedium" style={styles.bold}>
            {formatKm(progress.km)} km
          </Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            walked
          </Text>
        </View>
        {finished ? (
          <Button mode="contained-tonal" icon="map-marker-path" onPress={() => router.push('/journey')}>
            Where next?
          </Button>
        ) : progress.next ? (
          <View style={styles.right}>
            <Text variant="titleMedium" style={styles.bold}>
              {formatKm(progress.next.km - progress.km)} km
            </Text>
            <Text variant="bodySmall" numberOfLines={1} style={{ color: theme.colors.onSurfaceVariant }}>
              to {progress.next.emoji} {progress.next.name}
            </Text>
          </View>
        ) : null}
      </View>
    </Card>
  );
}

/** Wiggles every couple of seconds until you open the journey. */
function NewPostcards({ count }: { count: number }) {
  const theme = useAppTheme();
  const tilt = useSharedValue(0);

  useEffect(() => {
    tilt.set(
      withRepeat(
        withSequence(
          withTiming(-10, { duration: 70 }),
          withTiming(10, { duration: 90 }),
          withTiming(-6, { duration: 80 }),
          withTiming(0, { duration: 70 }),
          withDelay(1800, withTiming(0, { duration: 0 }))
        ),
        -1
      )
    );
  }, [tilt]);

  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${tilt.value}deg` }] }));

  // Wiggle on an inner view so its transform doesn't fight the entering zoom.
  return (
    <Animated.View
      entering={ZoomIn.springify().damping(10)}
      accessibilityLabel={`${count} new ${count === 1 ? 'postcard' : 'postcards'}`}>
      <Animated.View style={[styles.newPill, { backgroundColor: theme.colors.primary }, style]}>
        <Text variant="labelLarge" style={{ color: theme.colors.onPrimary }}>
          📮 {count} new
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

function StartCard() {
  const theme = useAppTheme();
  const { width } = useWindowDimensions();

  return (
    <Card mode="contained" style={surfaceCard(theme)} onPress={() => router.push('/journey')}>
      <View style={styles.map}>
        {/* Preview: no traveller, so the whole route draws itself in. */}
        <RouteMap
          route={FEATURED}
          km={FEATURED.totalKm}
          height={mapHeightFor(FEATURED, width - MAP_INSET, 130, 170)}
          delay={400}
        />
      </View>
      <Card.Content style={styles.start}>
        <View style={styles.flags}>
          {ROUTES.map((r, i) => (
            <Animated.Text key={r.key} entering={ZoomIn.delay(200 + i * 90).springify().damping(10)} style={styles.flagText}>
              {r.flag}
            </Animated.Text>
          ))}
        </View>
        <Text variant="titleMedium">Go on a journey</Text>
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
          Walk from Toronto to Ottawa, follow the Camino or cross Italy. Your steps carry you along the route,
          with a postcard from every stop.
        </Text>
        <Button mode="contained-tonal" icon="map-marker-path" onPress={() => router.push('/journey')} style={styles.startButton}>
          Choose a route
        </Button>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, paddingBottom: 12 },
  flag: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  flagText: { fontSize: 22, lineHeight: 28 },
  headerText: { flex: 1 },
  map: { paddingHorizontal: 12 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 16,
    paddingTop: 12,
  },
  right: { alignItems: 'flex-end', flexShrink: 1 },
  bold: { fontWeight: '700' },
  newPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 14 },
  start: { gap: 8, paddingTop: 14, paddingBottom: 16 },
  flags: { flexDirection: 'row', gap: 6 },
  startButton: { alignSelf: 'flex-start', marginTop: 4 },
});
