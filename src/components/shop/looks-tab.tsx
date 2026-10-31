import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Icon, Text, TextInput } from 'react-native-paper';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Button } from '@/components/button';
import { ButtonGroup } from '@/components/button-group';
import { TREAT } from '@/components/game/colors';
import { NewBadge, SparkleBurst } from '@/components/game/game-fx';
import { gameMotion } from '@/components/game/game-motion';
import { SpendButton } from '@/components/game/spend-button';
import { TreatIcon } from '@/components/treat-icon';
import { shortSteps } from '@/components/world-parts';
import { usePressed } from '@/hooks/use-pressed';
import type { ShopPrice } from '@/lib/api';
import { destinationNamed } from '@/lib/pet-adventures';
import { isFresh, onSale, saleMonths, SECTION_TITLES, SHOP, type Fresh, type ShopSection, type ShopThing } from '@/lib/shop';
import { choiceLevel, LEVELS, NAME_LENGTH, type Choice, type Picks, type Slot, type WorldDef } from '@/lib/world';
import { glass, useAppTheme, withAlpha } from '@/theme';

const COLUMNS = 3;
const GAP = 10;
/** Who your pet is rather than what it wears: kept in their own part of Looks, with its name. */
export const IDENTITY_SLOTS = ['species'];

type Part = 'wardrobe' | 'sale' | 'pet';
const PARTS = [
  { value: 'wardrobe' as const, label: 'Wardrobe', icon: 'hanger' as const },
  { value: 'sale' as const, label: 'For sale', icon: 'tag-outline' as const },
  { value: 'pet' as const, label: 'Name & species', icon: 'paw' as const },
];
const SECTIONS: ShopSection[] = ['toys', 'yard', 'season', 'buddy'];

/** Why a look can't be worn yet: shown small under it, and read out in full. */
type Lock = { note: string; spoken: string; icon: string };

function stepsLock(level: number): Lock {
  const steps = shortSteps(LEVELS[level]!);
  return { note: steps, spoken: `unlocks at ${steps} steps`, icon: 'lock' };
}

type Props = {
  def: WorldDef;
  level: number;
  /** Destinations it has been to (src/lib/pet-adventures.ts): their souvenirs are its to wear. */
  visited: Set<string>;
  /** A souvenir just brought home, marked new and shelved first. */
  newSouvenir: string | null;
  /** What's worn now, for every unlocked slot. */
  picks: Picks;
  /** Milestones just reached: their looks are marked new and shelved first. */
  fresh: Fresh | null;
  /** The saved name, or empty. */
  name: string;
  /** "Your pet", shown when it has no name. */
  placeholder: string;
  onRename: (name: string) => void;
  onPick: (slot: string, choice: string) => void;
  /** Things bought with treats, and keepsakes from full passport pages. */
  owned: ReadonlySet<string>;
  /** What the shop sells, by item (empty before migration 021). */
  prices: ReadonlyMap<string, ShopPrice>;
  /** Treats to spend. */
  available: number;
  /** What's being bought right now. */
  buying: string | null;
  /** Shown on the pet above before you buy it. */
  trying: ShopThing | null;
  onTry: (thing: ShopThing | null) => void;
  onBuy: (thing: ShopThing, price: number) => void;
};

/**
 * Looks, in three parts. The wardrobe: every look on shelves of tiles, tap one to put it on, locked
 * ones saying when they unlock, and souvenirs from its trips (and keepsakes from full passport pages)
 * on a shelf of their own. For sale: toys and things for the yard to buy with treats, each tried on
 * above before you buy it. Name & species: who your pet is, kept apart from what it wears.
 */
export function LooksTab({
  def,
  level,
  visited,
  newSouvenir,
  picks,
  fresh,
  name,
  placeholder,
  onRename,
  onPick,
  owned,
  prices,
  available,
  buying,
  trying,
  onTry,
  onBuy,
}: Props) {
  const theme = useAppTheme();
  const { width } = useWindowDimensions();
  const [part, setPart] = useState<Part>('wardrobe');
  // Each part stays built once it's been opened, just hidden while another shows: the wardrobe has a
  // hundred-odd tiles, and tearing them down and building them again made every switch slow.
  const [opened, setOpened] = useState<ReadonlySet<Part>>(() => new Set<Part>(['wardrobe']));
  const [draft, setDraft] = useState(name);
  // Rounded down: three tiles that add up to exactly the row would wrap the last one on rounding.
  const tile = Math.floor((Math.min(width, 520) - 32 - GAP * (COLUMNS - 1)) / COLUMNS) - 1;
  const looks = def.slots.filter((s) => !IDENTITY_SLOTS.includes(s.id));
  // Something bought for a slot shows it early; the seasonal and keepsake slots only hold such things.
  const owns = (slot: Slot) => slot.choices.some((c) => c.shop && owned.has(c.id));
  const unlocked = looks.filter((s) => (s.level <= level && !s.shop) || owns(s));
  const locked = looks.filter((s) => s.level > level && !s.shop && !owns(s));
  const wearable = (slot: Slot) => slot.choices.filter((c) => !c.shop || owned.has(c.id));
  const hasFresh = (slot: Slot) => slot.choices.some((c) => isFresh(slot, c, fresh));
  // A milestone's new looks are the first thing you see.
  const shelves = [...unlocked].sort((a, b) => Number(hasFresh(b)) - Number(hasFresh(a)));
  const identity = def.slots.filter((s) => IDENTITY_SLOTS.includes(s.id) && s.level <= level);

  function open(next: Part) {
    setPart(next);
    setOpened((was) => (was.has(next) ? was : new Set([...was, next])));
  }

  function saveName() {
    if (draft.trim() !== name) onRename(draft);
  }

  function renderSale() {
    if (!prices.size) {
      return (
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
          Nothing for sale yet.
        </Text>
      );
    }
    return SECTIONS.map((section) => {
      const things = SHOP.filter((t) => t.section === section && prices.get(t.id)?.treats);
      if (!things.length) return null;
      const tryingHere = trying && things.includes(trying) ? trying : null;
      const price = tryingHere ? prices.get(tryingHere.id)! : null;
      return (
        <View key={section} style={styles.shelf}>
          <Shelf title={SECTION_TITLES[section]} note={`${things.filter((t) => owned.has(t.id)).length} of ${things.length} yours`}>
            {things.map((thing) => {
              const choice = def.slots.find((sl) => sl.id === thing.slot)?.choices.find((c) => c.id === thing.id);
              if (!choice) return null;
              const cost = prices.get(thing.id)!;
              const mine = owned.has(thing.id);
              const forSale = onSale(cost);
              return (
                <ItemTile
                  key={thing.id}
                  choice={choice}
                  size={tile}
                  equipped={mine && picks[thing.slot] === thing.id}
                  lock={
                    mine || forSale
                      ? null
                      : { note: cost.months ? saleMonths(cost.months) : '', spoken: 'not on sale this month', icon: 'calendar' }
                  }
                  tag={mine ? undefined : { note: `${cost.treats}`, spoken: `${cost.treats} treats`, icon: 'treat' }}
                  trying={trying?.id === thing.id}
                  fresh={false}
                  onPress={() => (mine ? onPick(thing.slot, thing.id) : onTry(trying?.id === thing.id ? null : thing))}
                />
              );
            })}
          </Shelf>
          {tryingHere && price?.treats ? (
            <View style={[glass(theme, 'card'), styles.buy]}>
              <View style={styles.flex}>
                <Text variant="titleSmall" style={styles.bold}>
                  {tryingHere.name}
                </Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  {tryingHere.blurb}
                </Text>
              </View>
              <View style={styles.buyActions}>
                <SpendButton
                  label="Buy"
                  price={price.treats}
                  compact
                  disabled={available < price.treats || !!buying}
                  loading={buying === tryingHere.id}
                  onPress={() => onBuy(tryingHere, price.treats!)}
                  accessibilityLabel={`Buy ${tryingHere.name} for ${price.treats} treats`}
                />
                <Button compact onPress={() => onTry(null)}>
                  Not now
                </Button>
              </View>
            </View>
          ) : null}
        </View>
      );
    });
  }

  function renderPet() {
    return (
      <>
        <TextInput
          mode="outlined"
          label="Name"
          placeholder={placeholder}
          value={draft}
          onChangeText={setDraft}
          onBlur={saveName}
          onSubmitEditing={saveName}
          maxLength={NAME_LENGTH}
          returnKeyType="done"
          style={styles.name}
        />
        {identity.map((slot) => (
          <Shelf key={slot.id} title={slot.title} note={`${slot.choices.length} to choose from`}>
            {slot.choices.map((choice) => (
              <ItemTile
                key={choice.id}
                choice={choice}
                size={tile}
                equipped={picks[slot.id] === choice.id}
                lock={choiceLevel(slot, choice) > level ? stepsLock(choiceLevel(slot, choice)) : null}
                fresh={false}
                onPress={() => onPick(slot.id, choice.id)}
              />
            ))}
          </Shelf>
        ))}
      </>
    );
  }

  function renderShelf(slot: Slot) {
    const choices = wearable(slot);
    const yours = choices.filter((c) => c.shop || choiceLevel(slot, c) <= level).length;
    return (
      <Shelf key={slot.id} title={slot.title} note={`${yours} of ${choices.length}`} fresh={hasFresh(slot)}>
        {choices.map((choice) => {
          const at = choice.shop ? 0 : choiceLevel(slot, choice);
          return (
            <ItemTile
              key={choice.id}
              choice={choice}
              size={tile}
              equipped={picks[slot.id] === choice.id}
              lock={at > level ? stepsLock(at) : null}
              fresh={isFresh(slot, choice, fresh)}
              onPress={() => onPick(slot.id, choice.id)}
            />
          );
        })}
      </Shelf>
    );
  }

  function renderWardrobe() {
    const souvenirs = def.souvenirs ?? [];
    // A trip's souvenir is yours once it has been there; a keepsake once the server says the page is full.
    const has = (s: (typeof souvenirs)[number]) => (s.full ? owned.has(s.choice.id) : visited.has(s.from));
    const souvenirShelf = souvenirs.length ? (
      <Shelf
        key="souvenirs"
        title="Souvenirs"
        note={`${souvenirs.filter(has).length} of ${souvenirs.length}`}
        fresh={!!newSouvenir}>
        {souvenirs.map((souvenir) => {
          const { from, slot, choice, full } = souvenir;
          const where = destinationNamed(from);
          const mine = has(souvenir);
          const worn = picks[slot] === choice.id;
          const place = where?.name ?? from;
          return (
            <ItemTile
              key={choice.id}
              choice={choice}
              size={tile}
              equipped={worn}
              lock={
                mine
                  ? null
                  : full
                    ? { note: `Fill ${place}`, spoken: `for filling the ${place} page of the passport`, icon: 'passport' }
                    : { note: place, spoken: `a souvenir from ${place}`, icon: 'airplane' }
              }
              fresh={choice.id === newSouvenir}
              // Tap one you're wearing to take it off.
              onPress={() => onPick(slot, worn ? 'none' : choice.id)}
              canTakeOff
            />
          );
        })}
      </Shelf>
    ) : null;
    const firstShelves = newSouvenir ? [] : shelves.filter(hasFresh);
    const restShelves = shelves.filter((slot) => !firstShelves.includes(slot));

    return (
      <>
        {firstShelves.map((slot) => renderShelf(slot))}
        {souvenirShelf}
        {restShelves.map((slot) => renderShelf(slot))}

        {locked.length ? (
          <>
            <Text variant="labelLarge" style={[styles.coming, { color: theme.colors.onSurfaceVariant }]}>
              COMING UP
            </Text>
            {locked.map((slot) => (
              <Shelf key={slot.id} title={slot.title} note={`${shortSteps(LEVELS[slot.level]!)} steps`} locked>
                {slot.choices.filter((c) => !c.shop).map((choice) => (
                  <ItemTile
                    key={choice.id}
                    choice={choice}
                    size={tile}
                    equipped={false}
                    lock={stepsLock(choiceLevel(slot, choice))}
                    fresh={false}
                  />
                ))}
              </Shelf>
            ))}
          </>
        ) : null}
      </>
    );
  }

  const render: Record<Part, () => ReactNode> = { wardrobe: renderWardrobe, sale: renderSale, pet: renderPet };

  return (
    <View style={styles.page}>
      <ButtonGroup value={part} onChange={open} options={PARTS} />
      <View>
        {PARTS.map(({ value }) =>
          opened.has(value) ? (
            // The part showing sets the height; the others lie over it unseen and untouchable.
            <View
              key={value}
              style={value === part ? styles.part : [styles.part, styles.hidden]}
              pointerEvents={value === part ? 'auto' : 'none'}
              importantForAccessibility={value === part ? 'auto' : 'no-hide-descendants'}
              accessibilityElementsHidden={value !== part}>
              {render[value]()}
            </View>
          ) : null
        )}
      </View>
    </View>
  );
}

function Shelf({
  title,
  note,
  fresh,
  locked,
  children,
}: {
  title: string;
  note: string;
  fresh?: boolean;
  locked?: boolean;
  children: ReactNode;
}) {
  const theme = useAppTheme();
  return (
    <View style={styles.shelf}>
      <View style={styles.shelfHead}>
        {locked ? <Icon source="lock" size={16} color={theme.colors.onSurfaceVariant} /> : null}
        <Text variant="titleMedium" style={[styles.bold, locked && { color: theme.colors.onSurfaceVariant }]}>
          {title}
        </Text>
        {fresh ? <NewBadge /> : null}
        <View style={styles.flex} />
        <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
          {note.toUpperCase()}
        </Text>
      </View>
      <View style={styles.grid}>{children}</View>
    </View>
  );
}

/**
 * One look on the shelf, on the app's glass. Tapping one you own dips it, pops it and bursts a few
 * sparkles (the pet above twirls into it); the one being worn fills with the theme's colour and is
 * ticked; a locked one is dimmed with the steps it needs.
 */
function ItemTile({
  choice,
  size,
  equipped,
  lock,
  tag,
  trying,
  fresh,
  onPress,
  canTakeOff,
}: {
  choice: Choice;
  size: number;
  equipped: boolean;
  /** Why it can't be worn yet, or null if it can. */
  lock: Lock | null;
  /** Its price, for something not yet bought: shown like a lock, but it can still be tapped to try it on. */
  tag?: Lock;
  /** Being tried on above. */
  trying?: boolean;
  fresh: boolean;
  onPress?: () => void;
  /** Tapping it while it's worn takes it off (souvenirs). */
  canTakeOff?: boolean;
}) {
  const theme = useAppTheme();
  const { pressed, onPressIn, onPressOut } = usePressed();
  const pop = useSharedValue(1);
  const [burst, setBurst] = useState(0);
  const locked = lock !== null;

  function press() {
    pop.set(withSequence(withTiming(0.86, { duration: 70 }), withTiming(1, gameMotion.pop)));
    setBurst((n) => n + 1);
    onPress?.();
  }

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: pop.value * interpolate(pressed.value, [0, 1], [1, 0.95]) }],
  }));

  const fill = theme.colors.primaryContainer;

  return (
    <Pressable
      onPress={press}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={locked || (equipped && !canTakeOff) || !onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: equipped, disabled: locked }}
      accessibilityLabel={lock ? `${choice.label}, ${lock.spoken}` : tag ? `${choice.label}, ${tag.spoken}` : choice.label}>
      <Animated.View
        style={[
          glass(theme, 'small'),
          styles.tile,
          { width: size },
          equipped && {
            experimental_backgroundImage: `linear-gradient(${fill}, ${fill})`,
            borderColor: theme.colors.primary,
            borderWidth: 2,
          },
          locked && { experimental_backgroundImage: 'none', backgroundColor: withAlpha(theme.colors.onSurface, 0.04) },
          trying && { borderColor: TREAT.deep, borderWidth: 2 },
          style,
        ]}>
        <View style={[styles.tileArt, locked && styles.dim]}>
          {choice.color ? (
            <View style={[styles.swatch, { backgroundColor: choice.color }]} />
          ) : (
            <Text style={styles.tileEmoji}>{choice.emoji ?? '✨'}</Text>
          )}
        </View>
        <Text
          variant="labelMedium"
          numberOfLines={2}
          style={[
            styles.tileLabel,
            { color: equipped ? theme.colors.onPrimaryContainer : theme.colors.onSurface },
            locked && styles.dim,
          ]}>
          {choice.label}
        </Text>
        {lock ? (
          <View style={styles.lockRow}>
            <Icon source={lock.icon} size={11} color={theme.colors.onSurfaceVariant} />
            <Text variant="labelSmall" numberOfLines={1} style={[styles.lockNote, { color: theme.colors.onSurfaceVariant }]}>
              {lock.note}
            </Text>
          </View>
        ) : tag ? (
          <View style={styles.lockRow}>
            <TreatIcon size={14} />
            <Text variant="labelMedium" style={[styles.bold, { color: TREAT.deep }]}>
              {tag.note}
            </Text>
          </View>
        ) : null}
        {equipped ? (
          <View style={[styles.check, { backgroundColor: theme.colors.primary, borderColor: theme.colors.surface }]}>
            <Icon source="check-bold" size={13} color={theme.colors.onPrimary} />
          </View>
        ) : null}
        {fresh ? <NewBadge style={styles.newSpot} /> : null}
        {burst ? <SparkleBurst key={burst} count={10} radius={size * 0.55} /> : null}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { gap: 20 },
  part: { gap: 20 },
  hidden: { position: 'absolute', top: 0, left: 0, right: 0, opacity: 0 },
  flex: { flex: 1 },
  bold: { fontWeight: '700' },
  coming: { letterSpacing: 1.5, marginBottom: -8 },
  name: { backgroundColor: 'transparent' },
  shelf: { gap: 10 },
  shelfHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  tile: {
    minHeight: 100,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderRadius: 18,
  },
  tileArt: { height: 38, alignItems: 'center', justifyContent: 'center' },
  tileEmoji: { fontSize: 30, lineHeight: 38 },
  swatch: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    boxShadow: '0 1px 4px rgba(0, 0, 0, 0.25)',
  },
  tileLabel: { textAlign: 'center' },
  dim: { opacity: 0.4 },
  lockRow: { flexDirection: 'row', alignItems: 'center', gap: 3, maxWidth: '100%' },
  lockNote: { flexShrink: 1 },
  check: {
    position: 'absolute',
    top: -7,
    right: -7,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newSpot: { position: 'absolute', top: -7, left: -5 },
  buy: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 20 },
  buyActions: { alignItems: 'center', gap: 2 },
});
