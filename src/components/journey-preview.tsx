import { router } from 'expo-router';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Card, Icon, Text } from 'react-native-paper';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';

import { Button } from '@/components/button';
import { FlagIcon } from '@/components/flag-icon';
import { PlaceIcon } from '@/components/place-icon';
import { TapCard } from '@/components/tap-card';
import { mapHeightFor, RouteMap } from '@/components/route-map';
import type { CurrentJourney, Profile } from '@/lib/api';
import { formatKm, getRoute, journeyDay, progressOn, ROUTES } from '@/lib/journeys';
import { glassCard, useAppTheme } from '@/theme';
import { enter } from '@/theme/motion';

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
    <TapCard mode="contained" style={glassCard(theme)} onPress={() => router.push('/journey')}>
      <View style={styles.header}>
        <View style={[styles.flag, { backgroundColor: theme.colors.primaryContainer }]}>
          <FlagIcon flag={route.flag} size={30} />
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
            <View style={styles.nextStop}>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                to
              </Text>
              <PlaceIcon emoji={progress.next.emoji} size={15} color={theme.colors.onSurfaceVariant} />
              <Text variant="bodySmall" numberOfLines={1} style={[styles.shrink, { color: theme.colors.onSurfaceVariant }]}>
                {progress.next.name}
              </Text>
            </View>
          </View>
        ) : null}
      </View>
    </TapCard>
  );
}

/** How many new postcards are waiting, until you open the journey. Fades in and stays still. */
function NewPostcards({ count }: { count: number }) {
  const theme = useAppTheme();
  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      accessibilityLabel={`${count} new ${count === 1 ? 'postcard' : 'postcards'}`}
      style={[styles.newPill, { backgroundColor: theme.colors.primary }]}>
      <Text variant="labelLarge" style={{ color: theme.colors.onPrimary }}>
        📮 {count} new
      </Text>
    </Animated.View>
  );
}

function StartCard() {
  const theme = useAppTheme();
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();

  return (
    <TapCard mode="contained" style={glassCard(theme)} onPress={() => router.push('/journey')}>
      <View style={[styles.map, styles.startMap]}>
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
            <Animated.View key={r.key} entering={enter(i, reduceMotion)}>
              <FlagIcon flag={r.flag} size={30} />
            </Animated.View>
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
    </TapCard>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, paddingBottom: 12 },
  flag: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1 },
  map: { paddingHorizontal: 12 },
  // With nothing above it, the map needs its own gap from the card's top edge.
  startMap: { paddingTop: 12 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 16,
    paddingTop: 12,
  },
  right: { alignItems: 'flex-end', flexShrink: 1 },
  nextStop: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  shrink: { flexShrink: 1 },
  bold: { fontWeight: '700' },
  newPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 14 },
  start: { gap: 8, paddingTop: 14, paddingBottom: 16 },
  flags: { flexDirection: 'row', gap: 2 },
  startButton: { alignSelf: 'flex-start', marginTop: 4 },
});
