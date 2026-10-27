import { useRef, type RefObject } from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';

import { MAGIC_COLOR, TRIP_COLOR } from '@/components/game/colors';
import { SpendButton } from '@/components/game/spend-button';
import { EXPRESSIVE_SHAPES, GlassShape, type ExpressiveShape } from '@/components/glass-shape';
import type { OpenPostcard } from '@/components/pet-adventures';
import { PostcardThumb } from '@/components/postcard';
import { SectionHeader } from '@/components/section-header';
import type { Adventure } from '@/lib/api';
import { SKIES } from '@/lib/journeys';
import {
  ADVENTURE_COST,
  COUNTRIES,
  FANTASY_DESTINATIONS,
  passportPoints,
  placeFor,
  PLACES,
  visitedIn,
  type Destination,
} from '@/lib/pet-adventures';
import { glassCard, useAppTheme, withAlpha } from '@/theme';

/** A passport stamp's size. */
const STAMP = 46;

type Props = {
  /** The pet's name. */
  name: string;
  available: number;
  adventures: Adventure[];
  /** The flag of the country (or fantasy land) being booked right now. */
  busy: string | null;
  /** Books a trip; `ticket` is the destination's card, for the treats to fly to. */
  onBook: (destination: Destination, ticket: RefObject<View | null>) => void;
  onOpen: (postcard: OpenPostcard) => void;
};

/**
 * Trips: your pet's passport (a point for every new place, a stamp for every country and fantasy
 * land), where to send it next, and every postcard it has sent home.
 */
export function TripsTab({ name, available, adventures, busy, onBook, onOpen }: Props) {
  const theme = useAppTheme();
  const visited = adventures.map((a) => a.place);
  const points = passportPoints(visited);
  // Places since removed from the app are skipped.
  const postcards = adventures.flatMap((a, i) => {
    const place = placeFor(a.place);
    return place ? [{ id: a.id, place, number: adventures.length - i }] : [];
  });

  return (
    <View style={styles.page}>
      <View style={[glassCard(theme), styles.passport]}>
        <View style={styles.passportHead}>
          <View style={[styles.cover, { backgroundColor: TRIP_COLOR }]}>
            <Icon source="passport" size={20} color="#FFFFFF" />
          </View>
          <View style={styles.flex}>
            <Text variant="titleMedium" style={styles.bold}>
              {name}&apos;s passport
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              A point for every new place · {points} of {PLACES.length}
            </Text>
          </View>
          <View style={[styles.points, { backgroundColor: withAlpha(TRIP_COLOR, 0.14) }]}>
            <Text style={[styles.pointsValue, { color: TRIP_COLOR }]}>{points}</Text>
            <Text style={[styles.pointsLabel, { color: TRIP_COLOR }]}>PTS</Text>
          </View>
        </View>
        {[COUNTRIES, FANTASY_DESTINATIONS].map((row, r) => (
          <View
            key={r}
            style={[styles.stamps, r > 0 && [styles.magicStamps, { borderColor: theme.colors.outlineVariant }]]}>
            {row.map((destination, i) => (
              <DestinationStamp
                key={destination.flag}
                destination={destination}
                seen={visitedIn(destination, visited)}
                tilt={i % 2 ? 6 : -6}
              />
            ))}
          </View>
        ))}
      </View>

      <SectionHeader title="Where to?" note={`${ADVENTURE_COST} treats a trip`} />
      {COUNTRIES.map((destination) => (
        <DestinationCard
          key={destination.flag}
          destination={destination}
          seen={visitedIn(destination, visited)}
          available={available}
          busy={busy === destination.flag}
          disabled={!!busy}
          onBook={onBook}
        />
      ))}

      <SectionHeader title="Fantasy lands" note="Through the portal ✨" />
      {FANTASY_DESTINATIONS.map((destination) => (
        <DestinationCard
          key={destination.flag}
          destination={destination}
          seen={visitedIn(destination, visited)}
          available={available}
          busy={busy === destination.flag}
          disabled={!!busy}
          onBook={onBook}
        />
      ))}

      <SectionHeader title="Postcards" note={`${postcards.length}`} />
      {postcards.length ? (
        <View style={styles.grid}>
          {postcards.map(({ id, place, number }, i) => (
            <PostcardThumb
              key={id}
              route={place.route}
              stop={place.stop}
              index={i}
              onPress={() => onOpen({ place, number, isNew: false })}
            />
          ))}
        </View>
      ) : (
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
          No postcards yet. Send {name} somewhere and one will come home.
        </Text>
      )}
    </View>
  );
}

/** Each destination's shape, on its stamp and its card alike: no two in a row the same. */
function shapeOf(destination: Destination): ExpressiveShape {
  const row = destination.fantasy ? FANTASY_DESTINATIONS : COUNTRIES;
  return EXPRESSIVE_SHAPES[row.indexOf(destination) % EXPRESSIVE_SHAPES.length]!;
}

/** A fantasy land's sky shows through its glass; a country's glass is clear. */
function tintOf(destination: Destination): readonly [string, string] | undefined {
  return destination.fantasy ? SKIES[destination.places[0]!.stop.sky] : undefined;
}

/** A stamp in the passport: faint until visited, inked in after, ticked once it's all seen. */
function DestinationStamp({ destination, seen, tilt }: { destination: Destination; seen: number; tilt: number }) {
  const theme = useAppTheme();
  const color = destination.fantasy ? MAGIC_COLOR : TRIP_COLOR;
  const all = seen === destination.places.length;
  const inked = seen > 0;
  return (
    <View
      style={styles.stampCell}
      accessible
      accessibilityLabel={`${destination.name}: ${seen} of ${destination.places.length} places`}>
      <View style={styles.stamp}>
        <GlassShape
          shape={shapeOf(destination)}
          size={STAMP}
          tint={tintOf(destination)}
          ring={inked ? color : undefined}
          wash={all ? color : undefined}
          dim={!inked}
          style={{ transform: [{ rotate: `${inked ? tilt : 0}deg` }] }}>
          <Text style={styles.stampFlag}>{destination.flag}</Text>
        </GlassShape>
        {all ? (
          <View style={[styles.done, { backgroundColor: color, borderColor: theme.colors.surface }]}>
            <Icon source="check-bold" size={10} color="#FFFFFF" />
          </View>
        ) : null}
      </View>
      <Text style={[styles.stampCount, { color: theme.colors.onSurfaceVariant }]}>
        {seen}/{destination.places.length}
      </Text>
    </View>
  );
}

/** Somewhere to send the pet: a country's flag, or a fantasy land's emoji, in its glass shape. */
function DestinationCard({
  destination,
  seen,
  available,
  busy,
  disabled,
  onBook,
}: {
  destination: Destination;
  seen: number;
  available: number;
  busy: boolean;
  disabled: boolean;
  onBook: (destination: Destination, ticket: RefObject<View | null>) => void;
}) {
  const theme = useAppTheme();
  const ref = useRef<View>(null);
  const { name, flag, places, fantasy } = destination;
  const color = fantasy ? MAGIC_COLOR : TRIP_COLOR;
  const left = places.length - seen;
  const short = ADVENTURE_COST - available;

  return (
    <View ref={ref} collapsable={false} style={[glassCard(theme), styles.country]}>
      <GlassShape shape={shapeOf(destination)} size={48} tint={tintOf(destination)}>
        <Text style={styles.cardIcon}>{flag}</Text>
      </GlassShape>
      <View style={styles.flex}>
        <Text variant="titleMedium" style={styles.bold}>
          {name}
        </Text>
        <View style={[styles.track, { backgroundColor: withAlpha(color, 0.14) }]}>
          <View
            style={[styles.fill, { backgroundColor: color, width: `${Math.max(seen / places.length, 0.03) * 100}%` }]}
          />
        </View>
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          {left > 0 ? `${seen} of ${places.length} places · +1 point` : 'Seen it all · a postcard, no points'}
        </Text>
      </View>
      <SpendButton
        label="Go"
        price={ADVENTURE_COST}
        mode="contained-tonal"
        compact
        disabled={short > 0 || disabled}
        loading={busy}
        onPress={() => onBook(destination, ref)}
        accessibilityLabel={`Send your pet to ${name} for ${ADVENTURE_COST} treats`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: 12 },
  flex: { flex: 1, gap: 4 },
  bold: { fontWeight: '700' },
  passport: { padding: 16, gap: 16 },
  passportHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cover: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  points: { alignItems: 'center', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 14 },
  pointsValue: { fontSize: 20, fontWeight: '900', lineHeight: 24 },
  pointsLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  stamps: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  // The fantasy lands' stamps, on their own page of the passport.
  magicStamps: { borderTopWidth: 1, borderStyle: 'dashed', paddingTop: 14 },
  stampCell: { alignItems: 'center', gap: 4, width: '15%', minWidth: 46 },
  stamp: { width: STAMP, height: STAMP },
  stampFlag: { fontSize: 22, lineHeight: 28 },
  done: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stampCount: { fontSize: 11, fontWeight: '700' },
  country: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  cardIcon: { fontSize: 24, lineHeight: 30 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 14 },
});
