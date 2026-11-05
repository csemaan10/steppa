import { Pressable, StyleSheet, View } from 'react-native';
import { Card, Icon, Text } from 'react-native-paper';

import { Button } from '@/components/button';
import { TREAT, TRICK_COLOR } from '@/components/game/colors';
import { ProgressBar } from '@/components/journey-parts';
import type { OpenPostcard } from '@/components/pet-adventures';
import { PlaceIcon } from '@/components/place-icon';
import { PreviewCard } from '@/components/preview-card';
import { TrickIcon } from '@/components/trick-icon';
import { MilestoneList, shortSteps } from '@/components/world-parts';
import type { Adventure } from '@/lib/api';
import { formatSteps } from '@/lib/dates';
import { SKIES } from '@/lib/journeys';
import type { Page } from '@/lib/passport';
import { placeFor, PLACES, type Place } from '@/lib/pet-adventures';
import {
  describeUnlock,
  learnedTricks,
  resolvePicks,
  levelProgress,
  MAX_LEVEL,
  training,
  TRICKS,
  type Choice,
  type KindPicks,
  type TrickId,
  type Unlock,
  type WorldDef,
} from '@/lib/world';
import { glass, glassCard, useAppTheme, withAlpha } from '@/theme';

/** A card's title, with a count on the right. */
function Head({ title, note }: { title: string; note: string }) {
  const theme = useAppTheme();
  return (
    <View style={styles.head}>
      <Text variant="titleMedium" style={styles.bold}>
        {title}
      </Text>
      <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
        {note.toUpperCase()}
      </Text>
    </View>
  );
}

const DISC = 34;

/**
 * Tricks: every trick as a disc, in the order it learns them (the ones it knows filled in and
 * tappable to ask for, the one it's learning ringed, the rest locked), and the way to the trick shop.
 */
export function TricksPreview({
  name,
  fed,
  onShowOff,
  onShop,
}: {
  name: string;
  /** Treats it has eaten. */
  fed: number;
  onShowOff: (trick: TrickId) => void;
  onShop: () => void;
}) {
  const theme = useAppTheme();
  const learned = learnedTricks(fed);
  const knows = new Set(learned.map((t) => t.id));
  const learning = training(fed);
  return (
    <Card mode="contained" style={glassCard(theme)}>
      <Card.Content style={styles.body}>
        <View style={styles.text}>
          <Head title="Tricks" note={`${learned.length} of ${TRICKS.length}`} />
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            {learning
              ? `Next: ${learning.trick.name}, ${learning.given} of ${learning.trick.treats} treats`
              : `${name} knows every trick there is`}
          </Text>
        </View>
        <View style={styles.discs}>
          {TRICKS.map((trick) => {
            const known = knows.has(trick.id);
            const next = learning?.trick.id === trick.id;
            return (
              <Pressable
                key={trick.id}
                disabled={!known}
                onPress={() => onShowOff(trick.id)}
                accessibilityRole="button"
                accessibilityLabel={known ? `Ask for ${trick.name}` : `${trick.name}, ${next ? 'learning' : 'locked'}`}
                style={({ pressed }) => [
                  styles.disc,
                  known
                    ? { backgroundColor: withAlpha(TRICK_COLOR, 0.18) }
                    : next
                      ? { borderWidth: 2, borderColor: TREAT.face, backgroundColor: withAlpha(TREAT.face, 0.12) }
                      : { backgroundColor: withAlpha(theme.colors.onSurface, 0.05) },
                  pressed && styles.pressed,
                ]}>
                <View style={!known && !next && styles.faint}>
                  <TrickIcon
                    trick={trick.id}
                    size={24}
                    color={known ? TRICK_COLOR : next ? TREAT.deep : theme.colors.onSurfaceVariant}
                  />
                </View>
                {!known && !next ? (
                  <View style={[styles.lock, { backgroundColor: theme.colors.surface }]}>
                    <Icon source="lock" size={9} color={theme.colors.onSurfaceVariant} />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
        <Button mode="contained-tonal" icon="storefront-outline" onPress={onShop}>
          Trick shop
        </Button>
      </Card.Content>
    </Card>
  );
}

const ago = (iso: string) => {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return days < 1 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
};

/** A place it has been, as a tile: its picture on its sky. Tap it for the postcard. */
function PlaceTile({ place, onPress }: { place: Place; onPress: () => void }) {
  const [top, bottom] = SKIES[place.stop.sky];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Postcard from ${place.stop.name}`}
      style={({ pressed }) => [
        styles.tile,
        { experimental_backgroundImage: `linear-gradient(180deg, ${top} 0%, ${bottom} 100%)` },
        pressed && styles.pressed,
      ]}>
      <PlaceIcon emoji={place.stop.emoji} size={28} color="#FFFFFF" />
    </Pressable>
  );
}

/**
 * Adventures: where it went last (or is today), its latest places as tiles to open their postcards,
 * and the ways to book a trip and to the passport.
 */
export function AdventuresPreview({
  name,
  adventures,
  away,
  pages,
  onOpen,
  onShop,
  onPassport,
}: {
  name: string;
  adventures: Adventure[];
  /** Where it is today, if it went somewhere. */
  away: Place | null;
  /** The passport's pages, for its stamps. */
  pages: Page[];
  onOpen: (postcard: OpenPostcard) => void;
  onShop: () => void;
  onPassport: () => void;
}) {
  const theme = useAppTheme();
  const muted = { color: theme.colors.onSurfaceVariant };
  const postcards = adventures.flatMap((a, i) => {
    const place = placeFor(a.place);
    return place ? [{ id: a.id, place, number: adventures.length - i, at: a.created_at }] : [];
  });
  const latest = postcards[0];
  const visited = new Set(adventures.map((a) => a.place)).size;
  const stamps = pages.reduce((sum, p) => sum + p.filled, 0);
  const places = pages.reduce((sum, p) => sum + p.stamps.length, 0);
  return (
    <Card mode="contained" style={glassCard(theme)}>
      <Card.Content style={styles.body}>
        <View style={styles.text}>
          <Head title="Adventures" note={`${visited} of ${PLACES.length} places`} />
          <Text variant="bodyMedium" style={muted}>
            {away
              ? `${name} is exploring ${away.stop.name} today`
              : latest
                ? `Last went to ${latest.place.stop.name}, ${ago(latest.at)}`
                : `${name} hasn't been anywhere yet. Book a trip and a postcard comes home.`}
          </Text>
        </View>
        {postcards.length ? (
          <View style={styles.tiles}>
            {postcards.slice(0, 6).map(({ id, place, number }) => (
              <PlaceTile key={id} place={place} onPress={() => onOpen({ place, number, isNew: false })} />
            ))}
          </View>
        ) : null}
        <View style={styles.row}>
          <Button mode="contained-tonal" icon="airplane" onPress={onShop} style={styles.flex}>
            Book a trip
          </Button>
          <Button mode="outlined" icon="passport" onPress={onPassport} style={styles.flex}>
            {`Passport · ${stamps}/${places}`}
          </Button>
        </View>
      </Card.Content>
    </Card>
  );
}

/** What it has on, plays with and has in its yard, slot by slot, in the order they're shown. */
const LOOK_GROUPS: { title: string; slots: string[] }[] = [
  { title: 'Wearing', slots: ['hat', 'glasses', 'outfit', 'collar', 'kicks'] },
  { title: 'Toys and friends', slots: ['toy', 'buddy', 'friend'] },
  { title: 'In the yard', slots: ['yard', 'house', 'bed', 'bowl', 'fun', 'party', 'flag', 'season', 'keepsake', 'sky'] },
];

/** One thing in use: its emoji (or colour) and name. */
function LookChip({ choice, label, onPress }: { choice: Choice; label: string; onPress: () => void }) {
  const theme = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}. Customize`}
      style={({ pressed }) => [glass(theme, 'small'), styles.chip, pressed && styles.pressed]}>
      {choice.color ? (
        <View style={[styles.swatch, { backgroundColor: choice.color }]} />
      ) : (
        <Text style={styles.chipEmoji}>{choice.emoji ?? '✨'}</Text>
      )}
      <Text variant="labelMedium">{label}</Text>
    </Pressable>
  );
}

/**
 * Looks: what it's wearing, its toys and friends, and what's in its yard right now, with the way
 * into the shop's Looks to change any of it.
 */
export function LooksPreview({
  def,
  level,
  saved,
  name,
  onCustomize,
}: {
  def: WorldDef;
  level: number;
  /** Its choices as saved. */
  saved: KindPicks | undefined;
  name: string;
  onCustomize: () => void;
}) {
  const theme = useAppTheme();
  const muted = { color: theme.colors.onSurfaceVariant };
  const picks = resolvePicks(def, level, saved);
  const inUse = (slotId: string): Choice | null => {
    const id = picks[slotId];
    if (!id || id === 'none') return null;
    return (
      def.slots.find((s) => s.id === slotId)?.choices.find((c) => c.id === id) ??
      def.souvenirs?.find((s) => s.slot === slotId && s.choice.id === id)?.choice ??
      null
    );
  };
  const groups = LOOK_GROUPS.map((group) => ({
    title: group.title,
    items: group.slots.flatMap((slot) => {
      const choice = inUse(slot);
      return choice ? [{ slot, choice }] : [];
    }),
  })).filter((group) => group.items.length);
  const count = groups.reduce((sum, group) => sum + group.items.length, 0);

  return (
    <Card mode="contained" style={glassCard(theme)}>
      <Card.Content style={styles.body}>
        <View style={styles.text}>
          <Head title="Looks" note={`${count} in use`} />
          <Text variant="bodyMedium" style={muted}>
            {count
              ? `What ${name} has on, plays with and has in the yard`
              : 'Nothing yet. Toys, hats and things for the yard come with milestones, or from the shop.'}
          </Text>
        </View>
        {groups.map((group) => (
          <View key={group.title} style={styles.group}>
            <Text variant="labelMedium" style={muted}>
              {group.title.toUpperCase()}
            </Text>
            <View style={styles.chips}>
              {group.items.map(({ slot, choice }) => (
                <LookChip
                  key={slot}
                  choice={choice}
                  label={slot === 'bowl' ? `${choice.label} bowl` : choice.label}
                  onPress={onCustomize}
                />
              ))}
            </View>
          </View>
        ))}
        <Button mode="contained-tonal" icon="hanger" onPress={onCustomize}>
          Customize
        </Button>
      </Card.Content>
    </Card>
  );
}

/** Milestones, folded to the steps to the next one; open it for the whole road. */
export function MilestonesPreview({
  def,
  level,
  steps,
  since,
  next,
  days,
  expanded,
  onToggle,
}: {
  def: WorldDef;
  level: number;
  steps: number;
  /** When it was adopted, as "Oct 1". */
  since: string;
  next: Unlock | null;
  /** "about 5 days" at your pace, if there's a pace to go on. */
  days: string | null;
  expanded: boolean;
  onToggle: () => void;
}) {
  const theme = useAppTheme();
  const toGo = next ? next.steps - steps : 0;
  return (
    <PreviewCard
      title="Milestones"
      note={`Level ${level} of ${MAX_LEVEL}`}
      summary={
        next ? `${formatSteps(toGo)} steps to ${shortSteps(next.steps)}${days ? `, ${days} at your pace` : ''}` : 'Fully grown, every last milestone'
      }
      below={next ? <ProgressBar fraction={levelProgress(steps)} /> : undefined}
      expanded={expanded}
      onToggle={onToggle}>
      <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
        {formatSteps(steps)} steps walked together since {since}.{next ? ` Next: ${describeUnlock(next)}.` : ''}
      </Text>
      <MilestoneList def={def} level={level} bare />
    </PreviewCard>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: '700' },
  body: { gap: 12, paddingTop: 14 },
  text: { gap: 2 },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  discs: { flexDirection: 'row', justifyContent: 'space-between' },
  disc: { width: DISC, height: DISC, borderRadius: DISC / 2, alignItems: 'center', justifyContent: 'center' },
  faint: { opacity: 0.45 },
  lock: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    width: 15,
    height: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', gap: 8 },
  group: { gap: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 32, paddingHorizontal: 10, borderRadius: 16 },
  chipEmoji: { fontSize: 15, lineHeight: 20 },
  swatch: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: '#FFFFFF' },
});
