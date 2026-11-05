import 'expo-sqlite/localStorage/install';

import { router } from 'expo-router';
import { useEffect, useEffectEvent, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { ActivityIndicator, Appbar, Card, Text } from 'react-native-paper';
import Animated from 'react-native-reanimated';

import { Button } from '@/components/button';
import { FlagIcon } from '@/components/flag-icon';
import { useTabBarSpace } from '@/components/floating-tab-bar';
import { useCookieFlights } from '@/components/game/cookie-flights';
import { useGameToast } from '@/components/game/game-toast';
import { LevelUp } from '@/components/game/level-up';
import { SouvenirReveal } from '@/components/game/souvenir-reveal';
import { TreatCounter } from '@/components/game/treat-counter';
import { GlassAction } from '@/components/glass-action';
import { PetPostcardModal, type OpenPostcard } from '@/components/pet-adventures';
import { PetCreator } from '@/components/pet-creator';
import { PlaceIcon } from '@/components/place-icon';
import { usePetPlay } from '@/components/pet-play';
import { AdventuresPreview, LooksPreview, MilestonesPreview, TricksPreview } from '@/components/pet-previews';
import { NewTreatsCard, TreatsSheet } from '@/components/pet-treats';
import { TreatIcon } from '@/components/treat-icon';
import { TrickMenu } from '@/components/pet-tricks';
import { StageBadge, worldTitle } from '@/components/world-parts';
import { WorldScene } from '@/components/world-scene';
import { useKeyboardSpace } from '@/hooks/use-keyboard-space';
import { useLoader } from '@/hooks/use-loader';
import { useScreenFocused } from '@/hooks/use-screen-focused';
import { useWorldEditor } from '@/hooks/use-world-editor';
import {
  claimKeepsakes,
  claimTreats,
  getAdventures,
  getMateWorld,
  getProfile,
  getStepHistory,
  getTodaysVisits,
  getTreatGifts,
  getTreats,
  getWorld,
  startWorld,
  syncSteps,
  updateWorld,
  type Adventure,
  type TreatBonus,
  type TreatGift,
  type Treats,
  type World,
} from '@/lib/api';
import { askForPushOnce } from '@/lib/notifications';
import { keepsakeNamed, passportPages } from '@/lib/passport';
import { awayToday, type Place } from '@/lib/pet-adventures';
import { markPetMilestoneShown } from '@/lib/pet-milestones';
import { timeOfDay } from '@/lib/scene-art';
import { freshParam } from '@/lib/shop';
import {
  drawAway,
  drawVisit,
  drawWorld,
  learnedTricks,
  levelOf,
  MAX_LEVEL,
  MOOD_SAYS,
  moodLine,
  moodOf,
  resolvePicks,
  unlockAt,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  WORLDS,
  type KindPicks,
  type Visitor,
} from '@/lib/world';
import { useUserId } from '@/providers/auth-provider';
import { glass, glassCard, screenBackground, transparentHeader, useAppTheme } from '@/theme';

/** The scene never takes more than this share of the screen's height, so there's room below it. */
const SCENE_SHARE = 0.42;
/** The scene card's padding around the scene. */
const INSET = 8;
/** Treats earned since this phone last showed them, which rain into the counter. */
const seenKey = (userId: string) => `steppa:treats-seen:${userId}`;

/** The day goal zoomies last ran on this phone, so they run once a day. */
const zoomKey = (userId: string) => `steppa:zoomies:${userId}`;

function localDay(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function zoomedToday(userId: string): boolean {
  try {
    return localStorage.getItem(zoomKey(userId)) === localDay();
  } catch {
    return true;
  }
}

function markZoomed(userId: string) {
  try {
    localStorage.setItem(zoomKey(userId), localDay());
  } catch {}
}

/** What the header's treat counter shows. */
type HeaderTreats = { count: number; toNext: number };

function seenTreats(userId: string): number | null {
  try {
    const value = localStorage.getItem(seenKey(userId));
    return value === null ? null : Number(value);
  } catch {
    return null;
  }
}

/** The newest treat from a friend this phone has mentioned, so each is announced once. */
const giftsKey = (userId: string) => `steppa:gifts-seen:${userId}`;

function unseenGifts(userId: string, gifts: TreatGift[]): TreatGift[] {
  try {
    const seen = Number(localStorage.getItem(giftsKey(userId)) ?? 0);
    return gifts.filter((g) => g.id > seen);
  } catch {
    return [];
  }
}

function markGiftsSeen(userId: string, gifts: TreatGift[]) {
  if (!gifts.length) return;
  try {
    localStorage.setItem(giftsKey(userId), String(gifts[0]!.id));
  } catch {}
}

/** "Sam", "Sam and Alex", "Sam and 2 others". */
function whoGave(gifts: TreatGift[]): string {
  const names = [...new Set(gifts.map((g) => g.from))];
  if (names.length === 1) return names[0]!;
  return names.length === 2 ? `${names[0]} and ${names[1]}` : `${names[0]} and ${names.length - 1} others`;
}

function markTreatsSeen(userId: string, earned: number) {
  try {
    localStorage.setItem(seenKey(userId), String(earned));
  } catch {}
}

/** A group mate's pet yours has been with today, as it looks now, and whose it is. */
type Friend = Visitor & { owner: string; name: string };

/**
 * Today's company: the friend's pet yours went round to (and where that pet had gone, if it was off
 * on a trip), and the newest one to come over to yours.
 */
type Company = { out: (Friend & { away: Place | null }) | null; over: Friend | null };

/** A friend's pet as it looks now, and where it has gone today; null if it can't be seen. */
async function friendFor(id: string): Promise<(Friend & { away: Place | null }) | null> {
  const [mate, owner, trips] = await Promise.all([
    getMateWorld(id).catch(() => null),
    getProfile(id).catch(() => null),
    getAdventures(id).catch(() => []),
  ]);
  if (!mate) return null;
  const saved = mate.world.picks.pet;
  const who = owner?.display_name ?? 'A friend';
  return { steps: mate.steps, saved, owner: who, name: saved?.name || `${who}'s pet`, away: awayToday(trips) };
}

export default function PetScreen() {
  const theme = useAppTheme();
  const userId = useUserId();
  const tabBarSpace = useTabBarSpace();
  const focused = useScreenFocused();
  const { width, height } = useWindowDimensions();
  const [busy, setBusy] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  // The name field (adopting) scrolls above the keyboard.
  const keyboardSpace = useKeyboardSpace();
  const cardWidth = Math.min(width - 32, Math.round((height * SCENE_SHARE * WORLD_WIDTH) / WORLD_HEIGHT) + INSET * 2);
  // The treat counter sits up here beside the shop; the pet below keeps the count (treats rain into
  // it as they're earned) and reports it, with the steps to the next one.
  const counterRef = useRef<View>(null);
  const [treatCount, setTreatCount] = useState<HeaderTreats | null>(null);

  const { data, error, reload } = useLoader(async () => {
    // Catch up on today's steps first; a failed read still shows what's saved.
    await syncSteps(userId, 2).catch(() => {});
    // Then collect any bonus treats, so the count includes them, and any keepsakes the pet's trips
    // have earned.
    const [bonuses, keepsakes] = await Promise.all([claimTreats(), claimKeepsakes()]);
    const [status, history, profile, treats, adventures, gifts, todays] = await Promise.all([
      getWorld(userId),
      getStepHistory(userId, 14),
      getProfile(userId),
      getTreats(),
      getAdventures(userId),
      getTreatGifts(userId),
      getTodaysVisits(userId),
    ]);
    if (status) markPetMilestoneShown(userId, levelOf(status.steps));
    const out = todays.find((v) => v.guest === userId);
    const over = todays.find((v) => v.host === userId);
    const [outWith, overFrom] = await Promise.all([out ? friendFor(out.host) : null, over ? friendFor(over.guest) : null]);
    const company: Company = { out: outWith, over: overFrom };
    return { status, history, profile, treats, adventures, gifts, bonuses, keepsakes, company };
  }, userId);
  const editor = useWorldEditor(userId, data?.status?.world ?? null);
  // A row left from testing the worlds that were dropped counts as no pet yet.
  const world = editor.world && WORLDS[editor.world.kind] ? editor.world : null;
  const steps = data?.status?.steps ?? 0;
  const petName = world ? worldTitle(WORLDS[world.kind], world.picks[world.kind]?.name) : 'Your pet';

  const [refreshing, setRefreshing] = useState(false);
  async function pullToRefresh() {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }

  // Typical steps on days you walk, over the last two weeks, for "about N days to go".
  const active = data?.history.filter((d) => d.steps > 0) ?? [];
  const pace = active.length ? active.reduce((sum, d) => sum + d.steps, 0) / active.length : 0;

  async function adopt(picks: KindPicks) {
    setBusy(true);
    try {
      const saved = { pet: picks };
      if (editor.world) await updateWorld(userId, { kind: 'pet', picks: saved, celebrated: 1 });
      else await startWorld(userId, 'pet', saved);
      await reload();
      // A new pet is when being told it's growing makes sense.
      askForPushOnce(userId);
    } catch (e) {
      Alert.alert('Something went wrong', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const title = !data ? 'Pet' : world ? petName : 'Adopt a pet';

  return (
    <View style={[styles.flex, screenBackground(theme)]}>
      <Appbar.Header mode="small" style={transparentHeader}>
        <Appbar.Content title={title} />
        {world && treatCount !== null ? (
          <View style={styles.treats}>
            <TreatCounter
              count={treatCount.count}
              toNext={treatCount.toNext}
              targetRef={counterRef}
              onPress={() => setSheetOpen(true)}
            />
          </View>
        ) : null}
        {world ? (
          <GlassAction icon="storefront-outline" onPress={() => router.push('/shop')} accessibilityLabel="Shop" />
        ) : null}
      </Appbar.Header>

      {!data ? (
        <View style={styles.center}>
          {error ? <Text style={[styles.message, { color: theme.colors.error }]}>{error}</Text> : <ActivityIndicator />}
        </View>
      ) : (
        <Animated.View style={[styles.flex, keyboardSpace]}>
          <ScrollView
            automaticallyAdjustKeyboardInsets
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[styles.content, { paddingBottom: tabBarSpace }]}
            refreshControl={world ? <RefreshControl refreshing={refreshing} onRefresh={pullToRefresh} /> : undefined}>
            {world ? (
              <PetHome
                userId={userId}
                world={world}
                steps={steps}
                pace={pace}
                today={data.history[data.history.length - 1]?.steps ?? 0}
                goal={data.profile.daily_goal}
                you={data.profile.display_name}
                loadedTreats={data.treats}
                adventures={data.adventures}
                loadedGifts={data.gifts}
                bonuses={data.bonuses}
                keepsakes={data.keepsakes}
                company={data.company}
                cardWidth={cardWidth}
                animate={focused}
                editor={editor}
                counterRef={counterRef}
                onTreatCount={setTreatCount}
              />
            ) : (
              <PetCreator sceneWidth={cardWidth - INSET * 2} animate={focused} busy={busy} onAdopt={adopt} />
            )}
          </ScrollView>
        </Animated.View>
      )}

      {world && data?.treats ? (
        <TreatsSheet
          open={sheetOpen}
          name={petName}
          available={treatCount?.count ?? data.treats.earned - data.treats.fed - data.treats.spent}
          toNext={data.treats.toNext}
          onClose={() => setSheetOpen(false)}
          onShop={() => {
            setSheetOpen(false);
            router.push('/shop');
          }}
        />
      ) : null}
    </View>
  );
}

function PetHome({
  userId,
  world,
  steps,
  pace,
  today,
  goal,
  you,
  loadedTreats,
  adventures,
  loadedGifts,
  bonuses,
  keepsakes,
  company,
  cardWidth,
  animate,
  editor,
  counterRef,
  onTreatCount,
}: {
  userId: string;
  world: World;
  steps: number;
  pace: number;
  /** Your steps today and your daily goal, for how the pet feels. */
  today: number;
  goal: number;
  /** Your name, for the pet's postcards. */
  you: string;
  /** Null before migration 018: then there are no treats, tricks or adventures. */
  loadedTreats: Treats | null;
  adventures: Adventure[];
  /** Treats friends have given it on playdates, newest first. */
  loadedGifts: TreatGift[];
  /** Bonus treats that just came in. */
  bonuses: TreatBonus[];
  /** Keepsakes that just came home with a full passport page. */
  keepsakes: string[];
  /** Friends' pets it has been with today. */
  company: Company;
  cardWidth: number;
  animate: boolean;
  editor: ReturnType<typeof useWorldEditor>;
  /** The treat counter in the header, for treats to fly into. */
  counterRef: RefObject<View | null>;
  /** Tells the header what its treat counter shows, or null for none (before migration 018). */
  onTreatCount: (treats: HeaderTreats | null) => void;
}) {
  const theme = useAppTheme();
  const tabBarSpace = useTabBarSpace();
  const def = WORLDS[world.kind];
  const level = levelOf(steps);
  const saved = world.picks[world.kind];
  const name = worldTitle(def, saved?.name);
  const time = timeOfDay();
  const mood = moodOf(today, goal);
  const away = awayToday(adventures);
  const sceneWidth = cardWidth - INSET * 2;
  const treats = loadedTreats;

  // Treats earned since this phone last showed them: held back from the counter, then rained in.
  const [rain, setRain] = useState<{ source: Treats | null; total: number; incoming: number }>({
    source: null,
    total: 0,
    incoming: 0,
  });
  if (rain.source !== loadedTreats) {
    const seen = loadedTreats ? seenTreats(userId) : null;
    const total = loadedTreats && seen !== null ? Math.max(0, loadedTreats.earned - seen) : 0;
    setRain({ source: loadedTreats, total, incoming: total });
  }
  const fed = treats?.fed ?? world.treats_fed ?? 0;
  const available = treats ? treats.earned - treats.fed - treats.spent : null;
  const [postcard, setPostcard] = useState<OpenPostcard | null>(null);
  const [milestonesOpen, setMilestonesOpen] = useState(false);
  // The receipt for new bonuses shows until you've seen it; a reload brings a new list.
  const [seenBonuses, setSeenBonuses] = useState<TreatBonus[] | null>(null);
  // Keepsakes just brought home, revealed one at a time.
  const [revealed, setRevealed] = useState<{ from: string[]; seen: number }>({ from: [], seen: 0 });
  const keepsakesSeen = revealed.from === keepsakes ? revealed.seen : 0;
  const nextKeepsake = keepsakes[keepsakesSeen];
  const revealing = nextKeepsake ? keepsakeNamed(nextKeepsake) : undefined;

  const art = away
    ? drawAway(away.stop, steps, saved, time, mood, company.over ?? undefined)
    : company.out
      ? drawVisit({ ...company.out, away: company.out.away?.stop }, steps, saved, time, mood)
      : drawWorld(world.kind, steps, saved, time, mood, company.over ?? undefined);
  // Where it is, if not at home: off on a trip, or with a friend's pet (in their yard, or wherever it went).
  const where = away ?? company.out?.away ?? null;
  const toy = resolvePicks(def, level, saved).toy;
  const play = usePetPlay(art.pet, { tricks: learnedTricks(fed).map((t) => t.id), says: MOOD_SAYS[mood] });
  // The friend's pet in the picture (the one yours went round to, or the one over at yours) plays too.
  const friend = away ? company.over : (company.out ?? company.over);
  const guestPlay = usePetPlay(art.guest, { says: ['Hi!'] });
  const muted = { color: theme.colors.onSurfaceVariant };

  const lineRef = useRef<View>(null);
  const { fly, flights } = useCookieFlights();
  const { show, toast } = useGameToast(tabBarSpace + 12);

  // Now and then it gets up to something by itself: a sleepy pet mumbles in its sleep; otherwise it
  // chases its tail, digs, pounces or watches a butterfly (an overjoyed one sooner, bouncing between).
  const idles = useRef(0);
  const idle = useEffectEvent(() => {
    if (mood === 'sleepy') play.say('Zzz…');
    else if (mood === 'overjoyed' && idles.current++ % 2) play.bounce();
    else play.idle();
  });
  useEffect(() => {
    if (!animate) return;
    const timer = setInterval(idle, mood === 'sleepy' ? 7000 : mood === 'overjoyed' ? 6000 : 11000);
    return () => clearInterval(timer);
  }, [animate, mood]);
  // The friend's pet gets up to things too, on a beat of its own so the two rarely go at once.
  const guestIdle = useEffectEvent(() => guestPlay.idle());
  const hasGuest = !!art.guest;
  useEffect(() => {
    if (!animate || !hasGuest) return;
    const timer = setInterval(guestIdle, 13000);
    return () => clearInterval(timer);
  }, [animate, hasGuest]);

  // Treats earned while you were away fly up from under the scene into the counter, one landing at a
  // time, once the tab is on screen; the toast says where they came from (walking, bonuses, friends).
  const rainIn = useEffectEvent((total: number) => {
    const gifts = unseenGifts(userId, loadedGifts).slice(0, total);
    markGiftsSeen(userId, loadedGifts);
    const bonus = Math.min(
      total - gifts.length,
      bonuses.reduce((sum, b) => sum + b.treats, 0)
    );
    const walked = total - gifts.length - bonus;
    if (gifts.length && !walked && !bonus) {
      show(`${whoGave(gifts)} gave ${name} ${gifts.length === 1 ? 'a treat' : `${gifts.length} treats`}!`, '🎁');
    } else if (!gifts.length && !bonus) {
      show(`+${total} ${total === 1 ? 'treat' : 'treats'} for walking!`, <TreatIcon size={20} />);
    } else {
      const parts = [
        walked ? `+${walked} for walking` : null,
        bonus ? `+${bonus} bonus` : null,
        gifts.length ? `+${gifts.length} from ${whoGave(gifts)}` : null,
      ].filter(Boolean);
      show(`${parts.join(', ')}!`, gifts.length ? '🎁' : <TreatIcon size={20} />);
    }
    const drawn = Math.min(total, 8);
    fly(lineRef, counterRef, total, {
      onLand: (i) => setRain((r) => ({ ...r, incoming: total - Math.round(((i + 1) / drawn) * total) })),
      onDone: () => setRain((r) => ({ ...r, incoming: 0 })),
    });
  });
  useEffect(() => {
    if (!rain.source || !animate) return;
    const earned = rain.source.earned;
    if (!rain.total) {
      markTreatsSeen(userId, earned);
      markGiftsSeen(userId, loadedGifts);
      return;
    }
    // Only counted as seen once the rain starts, so leaving the tab first saves it for next time.
    const timer = setTimeout(() => {
      markTreatsSeen(userId, earned);
      rainIn(rain.total);
    }, 700);
    return () => clearTimeout(timer);
  }, [rain.source, rain.total, animate, userId, loadedGifts]);

  function openShop(tab?: 'tricks' | 'trips') {
    router.push(tab ? { pathname: '/shop', params: { tab } } : '/shop');
  }

  const next = level < MAX_LEVEL ? unlockAt(def, level + 1) : null;
  const toGo = next ? next.steps - steps : 0;
  const days = next && pace > 0 ? Math.ceil(toGo / pace) : null;
  const since = new Date(`${world.started_on}T00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  // Milestones reached and not yet celebrated; the takeover waits until the tab is on screen.
  const celebrateFrom = Math.max(1, world.celebrated);
  const celebrating = animate && level > 0 && world.celebrated <= level;
  const shownTreats = available === null ? null : Math.max(0, available - rain.incoming);
  // Reaching the day's goal sets off zoomies round the yard: once a day, the first time you look after
  // (and not over a milestone being celebrated).
  const zoom = useEffectEvent(() => {
    markZoomed(userId);
    play.zoomies();
  });
  useEffect(() => {
    if (!animate || celebrating || !goal || today < goal || zoomedToday(userId)) return;
    const timer = setTimeout(zoom, 2200);
    return () => clearTimeout(timer);
  }, [animate, celebrating, today, goal, userId]);

  const toNext = treats?.toNext ?? null;
  useEffect(
    () => onTreatCount(shownTreats === null || toNext === null ? null : { count: shownTreats, toNext }),
    [shownTreats, toNext, onTreatCount]
  );
  useEffect(() => () => onTreatCount(null), [onTreatCount]);

  return (
    <>
      <Card mode="contained" style={[glassCard(theme), styles.sceneCard, { width: cardWidth }]}>
        <View style={styles.scene}>
          <WorldScene
            art={art}
            width={sceneWidth}
            animate={animate}
            version={`${level}:${time}:${mood}:${where?.key ?? company.out?.owner ?? 'home'}:${company.over?.name ?? ''}:${JSON.stringify(saved ?? {})}`}
            play={play}
            guestPlay={guestPlay}
            guestName={friend?.name}
            radius={18}
          />
          {where ? (
            <PlaceBadge icon={<FlagIcon flag={where.route.flag} size={20} />} label={where.stop.name} />
          ) : company.out ? (
            <PlaceBadge
              icon={<PlaceIcon emoji="🏡" size={18} color={theme.colors.onSurface} />}
              label={`${company.out.owner}'s yard`}
            />
          ) : (
            <StageBadge def={def} level={level} />
          )}
        </View>
        <View ref={lineRef} collapsable={false}>
          <Text variant="bodyMedium" style={[styles.line, muted]}>
            {sceneLine(name, mood, today, goal, away, company)}
          </Text>
        </View>
        <View style={styles.buttons}>
          <View style={styles.actions}>
            <Button mode="contained-tonal" icon="hand-heart" onPress={play.stroke} style={styles.action}>
              Pet
            </Button>
            <Button mode="contained-tonal" icon="tennis-ball" onPress={() => play.play(toy)} style={styles.action}>
              Play
            </Button>
          </View>
          {treats ? (
            <TrickMenu fed={fed} onShowOff={(trick) => play.showOff(trick)} onShop={() => openShop('tricks')} />
          ) : null}
        </View>
      </Card>

      {bonuses.length && seenBonuses !== bonuses ? (
        <NewTreatsCard bonuses={bonuses} name={name} onDone={() => setSeenBonuses(bonuses)} />
      ) : null}

      {treats && available !== null ? (
        <>
          <TricksPreview
            name={name}
            fed={fed}
            onShowOff={(trick) => play.showOff(trick)}
            onShop={() => openShop('tricks')}
          />
          <AdventuresPreview
            name={name}
            adventures={adventures}
            away={away}
            pages={passportPages(adventures)}
            onOpen={setPostcard}
            onShop={() => openShop('trips')}
            onPassport={() => router.push('/passport')}
          />
        </>
      ) : null}
      <LooksPreview
        def={def}
        level={level}
        saved={saved}
        name={name}
        onCustomize={() => router.push({ pathname: '/shop', params: { tab: 'looks' } })}
      />
      <MilestonesPreview
        def={def}
        level={level}
        steps={steps}
        since={since}
        next={next}
        days={days ? aboutDays(days) : null}
        expanded={milestonesOpen}
        onToggle={() => setMilestonesOpen(!milestonesOpen)}
      />

      <Button mode="contained" icon="storefront-outline" onPress={() => openShop()}>
        Shop
      </Button>

      <PetPostcardModal
        open={postcard}
        steps={steps}
        picks={saved}
        name={name}
        recipient={you}
        onClose={() => setPostcard(null)}
      />
      {celebrating ? (
        <LevelUp
          def={def}
          from={celebrateFrom}
          level={level}
          name={name}
          onShop={() => {
            editor.celebrate(level);
            const fresh = freshParam({ from: celebrateFrom, to: level });
            router.push({ pathname: '/shop', params: { tab: 'looks', fresh } });
          }}
          onLater={() => editor.celebrate(level)}
        />
      ) : revealing ? (
        <SouvenirReveal
          key={revealing.souvenir.choice.id}
          souvenir={revealing.souvenir}
          from={revealing.country}
          name={name}
          onWear={() => {
            setRevealed({ from: keepsakes, seen: keepsakesSeen + 1 });
            editor.pick('keepsake', revealing.souvenir.choice.id);
          }}
          onLater={() => setRevealed({ from: keepsakes, seen: keepsakesSeen + 1 })}
        />
      ) : null}
      {flights}
      {toast}
    </>
  );
}

/** Under the scene: where the pet is if it's out, who's with it, or else how it feels. */
function sceneLine(
  name: string,
  mood: ReturnType<typeof moodOf>,
  today: number,
  goal: number,
  away: Place | null,
  { out, over }: Company
): string {
  if (away) {
    return over
      ? `${name} is exploring ${away.stop.name} today, and ${over.name} came along`
      : `${name} is exploring ${away.stop.name} today, home tomorrow`;
  }
  if (out) {
    return out.away
      ? `${name} went to find ${out.name} in ${out.away.stop.name} today`
      : `${name} is round at ${out.owner}'s with ${out.name} today`;
  }
  if (over) return `${over.name} came over from ${over.owner}'s for the day`;
  return moodLine(mood, name, today, goal);
}

/** Where the pet is today, in a pill at the top of the scene. */
function PlaceBadge({ icon, label }: { icon: ReactNode; label: string }) {
  const theme = useAppTheme();
  return (
    <View style={[glass(theme, 'strong'), styles.place]}>
      {icon}
      <Text variant="labelLarge" style={styles.bold}>
        {label}
      </Text>
    </View>
  );
}

/** "about 5 days", "about 3 weeks", "about 4 months". */
function aboutDays(days: number): string {
  if (days <= 1) return 'about a day';
  if (days < 14) return `about ${days} days`;
  if (days < 60) return `about ${Math.round(days / 7)} weeks`;
  if (days < 730) return `about ${Math.round(days / 30)} months`;
  return `about ${Math.round(days / 365)} years`;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  message: { textAlign: 'center' },
  content: { padding: 16, gap: 12 },
  // Over the scene's top-right corner, like a game's HUD.
  treats: { marginRight: 8 },
  sceneCard: { alignSelf: 'center' },
  scene: { margin: INSET, marginBottom: 0 },
  line: { textAlign: 'center', marginTop: 10, marginHorizontal: 16 },
  buttons: { gap: 8, padding: INSET + 4, paddingTop: 10 },
  actions: { flexDirection: 'row', gap: 8 },
  action: { flex: 1 },
  bold: { fontWeight: '700' },
  place: {
    position: 'absolute',
    left: 10,
    top: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingLeft: 8,
    paddingRight: 12,
    paddingVertical: 4,
    borderRadius: 14,
  },
});
