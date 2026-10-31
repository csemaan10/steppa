import { useRef, useState, type RefObject } from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';

import { Button } from '@/components/button';
import { MAGIC_COLOR, TRIP_COLOR } from '@/components/game/colors';
import { FlagIcon } from '@/components/flag-icon';
import { SpendButton } from '@/components/game/spend-button';
import { EXPRESSIVE_SHAPES, GlassShape, type ExpressiveShape } from '@/components/glass-shape';
import type { OpenPostcard } from '@/components/pet-adventures';
import { PlaceIcon } from '@/components/place-icon';
import { PostcardThumb, type PostcardPlace } from '@/components/postcard';
import { SectionHeader } from '@/components/section-header';
import { visitPlace, type VisitCard } from '@/components/visit-postcard';
import type { Adventure, PetMate } from '@/lib/api';
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
  type Place,
} from '@/lib/pet-adventures';
import { glassCard, useAppTheme, withAlpha } from '@/theme';

/** A passport stamp's size. */
const STAMP = 46;
/** Postcards shown before "See all": each is a little picture to build, and an album can run long. */
const ALBUM_START = 6;

/** Where the pet went today: off on trips, or round at a friend's (whose name this is). */
export type Outing = { trip: Place } | { friend: string };

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
  /** Group mates with pets, to send yours to for the day. */
  mates: PetMate[];
  /** Postcards from its visits to friends, newest first. */
  visitPostcards: { card: VisitCard; number: number }[];
  /** Where it has been today, if anywhere: trips and a visit don't mix on the same day. */
  outing: Outing | null;
  /** Friends whose pet has been with yours today, either way round. */
  together: ReadonlySet<string>;
  /** What a visit costs (null before migration 021: no visits). */
  visitPrice: number | null;
  onVisit: (mate: PetMate, price: number, card: RefObject<View | null>) => void;
  onPassport: () => void;
};

/**
 * Trips: your pet's passport (a point for every new place, a stamp for every country and fantasy
 * land, and the way into the whole passport), where to send it next, friends' yards to visit for the
 * day, and every postcard it has sent home.
 */
export function TripsTab({
  name,
  available,
  adventures,
  busy,
  onBook,
  onOpen,
  mates,
  visitPostcards,
  outing,
  together,
  visitPrice,
  onVisit,
  onPassport,
}: Props) {
  const theme = useAppTheme();
  const visited = adventures.map((a) => a.place);
  const points = passportPoints(visited);
  const [wholeAlbum, setWholeAlbum] = useState(false);
  // Round at a friend's today: no trips until tomorrow.
  const visiting = outing && 'friend' in outing ? outing.friend : null;
  // Postcards from its trips and its visits to friends, newest first. Places since removed from the
  // app are skipped.
  const postcards: { key: string; at: string; from: PostcardPlace; open: OpenPostcard }[] = [
    ...adventures.flatMap((a, i) => {
      const place = placeFor(a.place);
      if (!place) return [];
      const open = { place, number: adventures.length - i, isNew: false };
      return [{ key: `trip-${a.id}`, at: a.created_at, from: place.stop, open }];
    }),
    ...visitPostcards.map(({ card, number }) => ({
      key: `visit-${card.day}`,
      at: card.day,
      from: visitPlace(card, name),
      open: { visit: card, number, isNew: false },
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));

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
        <Button mode="outlined" icon="passport" onPress={onPassport}>
          Open the passport
        </Button>
      </View>

      <SectionHeader title="Where to?" note={`${ADVENTURE_COST} treats a trip`} />
      {visiting ? (
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
          {name}&apos;s round at {visiting}&apos;s today, so trips are back tomorrow.
        </Text>
      ) : null}
      {COUNTRIES.map((destination) => (
        <DestinationCard
          key={destination.flag}
          destination={destination}
          seen={visitedIn(destination, visited)}
          available={available}
          busy={busy === destination.flag}
          disabled={!!busy || !!visiting}
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
          disabled={!!busy || !!visiting}
          onBook={onBook}
        />
      ))}

      {visitPrice ? (
        <>
          <SectionHeader title="Visit a friend" note={`${visitPrice} treats a day`} />
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            {name} spends the day with a group mate&apos;s pet and sends you a postcard of the two of them. It&apos;s one
            outing a day, a visit or trips, and your friend gets 2 treats for having {name} over.
          </Text>
          {outing ? (
            <Text variant="bodyMedium" style={[styles.bold, { color: theme.colors.onSurfaceVariant }]}>
              {'trip' in outing
                ? `${name}'s in ${outing.trip.stop.name} today, so visits are back tomorrow.`
                : `${name}'s round at ${outing.friend}'s today, so the next visit is tomorrow.`}
            </Text>
          ) : null}
          {mates.length ? (
            mates.map((mate) => (
              <MateCard
                key={mate.id}
                mate={mate}
                price={visitPrice}
                available={available}
                busy={busy === `visit:${mate.id}`}
                together={together.has(mate.id)}
                disabled={!!busy || !!outing}
                onVisit={onVisit}
              />
            ))
          ) : (
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              Nobody in your groups has a pet yet.
            </Text>
          )}
        </>
      ) : null}

      <SectionHeader title="Postcards" note={`${postcards.length}`} />
      {postcards.length ? (
        <View style={styles.grid}>
          {(wholeAlbum ? postcards : postcards.slice(0, ALBUM_START)).map(({ key, from, open }, i) => (
            // The rest of the album rises in together, not one after another.
            <PostcardThumb key={key} stop={from} index={Math.min(i, ALBUM_START)} onPress={() => onOpen(open)} />
          ))}
        </View>
      ) : (
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
          No postcards yet. Send {name} somewhere, or round to a friend&apos;s, and one will come home.
        </Text>
      )}
      {postcards.length > ALBUM_START ? (
        <Button mode="text" onPress={() => setWholeAlbum(!wholeAlbum)}>
          {wholeAlbum ? 'Show fewer' : `See all ${postcards.length}`}
        </Button>
      ) : null}
    </View>
  );
}

/** A group mate's pet, to send yours to for the day. */
function MateCard({
  mate,
  price,
  available,
  busy,
  together,
  disabled,
  onVisit,
}: {
  mate: PetMate;
  price: number;
  available: number;
  busy: boolean;
  /** Its pet and yours have been together today. */
  together: boolean;
  disabled: boolean;
  onVisit: (mate: PetMate, price: number, card: RefObject<View | null>) => void;
}) {
  const theme = useAppTheme();
  const ref = useRef<View>(null);
  const pet = mate.world.picks.pet;
  const petName = pet?.name || `${mate.name}'s pet`;
  return (
    <View ref={ref} collapsable={false} style={[glassCard(theme), styles.country]}>
      <View style={styles.flex}>
        <Text variant="titleMedium" style={styles.bold}>
          {petName}
        </Text>
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          {together ? 'Together today' : `${mate.name}'s ${pet?.species ?? 'pet'}`}
        </Text>
      </View>
      <SpendButton
        label="Visit"
        price={price}
        mode="contained-tonal"
        compact
        disabled={available < price || disabled}
        loading={busy}
        onPress={() => onVisit(mate, price, ref)}
        accessibilityLabel={`Send your pet to ${petName} for the day, for ${price} treats`}
      />
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

/** What's on a destination's glass: a country's flag, or a fantasy land's emblem in white over its sky. */
function DestinationMark({ destination, size }: { destination: Destination; size: number }) {
  return destination.fantasy ? (
    <PlaceIcon emoji={destination.flag} size={size} color="#FFFFFF" />
  ) : (
    <FlagIcon flag={destination.flag} size={size} />
  );
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
          <DestinationMark destination={destination} size={30} />
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

/** Somewhere to send the pet: a country's flag, or a fantasy land's emblem, in its glass shape. */
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
  const { name, places, fantasy } = destination;
  const color = fantasy ? MAGIC_COLOR : TRIP_COLOR;
  const left = places.length - seen;
  const short = ADVENTURE_COST - available;

  return (
    <View ref={ref} collapsable={false} style={[glassCard(theme), styles.country]}>
      <GlassShape shape={shapeOf(destination)} size={48} tint={tintOf(destination)}>
        <DestinationMark destination={destination} size={32} />
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
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 14 },
});
