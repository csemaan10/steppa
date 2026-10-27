import 'expo-sqlite/localStorage/install';

import { router } from 'expo-router';
import { useEffect, useEffectEvent, useRef, useState, type RefObject } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { ActivityIndicator, Appbar, Card, Text } from 'react-native-paper';
import Animated from 'react-native-reanimated';

import { Button } from '@/components/button';
import { useTabBarSpace } from '@/components/floating-tab-bar';
import { useCookieFlights } from '@/components/game/cookie-flights';
import { useGameToast } from '@/components/game/game-toast';
import { LevelUp } from '@/components/game/level-up';
import { NewTrick } from '@/components/game/new-trick';
import { TreatCounter } from '@/components/game/treat-counter';
import { GlassAction } from '@/components/glass-action';
import { ProgressBar } from '@/components/journey-parts';
import { AdventuresSection, PetPostcardModal, type OpenPostcard } from '@/components/pet-adventures';
import { PetCreator } from '@/components/pet-creator';
import { usePetPlay, type Lesson } from '@/components/pet-play';
import { TrickMenu, TricksSection } from '@/components/pet-tricks';
import { SectionHeader } from '@/components/section-header';
import { MilestoneList, shortSteps, StageBadge, worldTitle } from '@/components/world-parts';
import { WorldScene } from '@/components/world-scene';
import { useCountUp } from '@/hooks/use-count-up';
import { useKeyboardSpace } from '@/hooks/use-keyboard-space';
import { useLoader } from '@/hooks/use-loader';
import { useScreenFocused } from '@/hooks/use-screen-focused';
import { useWorldEditor } from '@/hooks/use-world-editor';
import {
  feedPet,
  getAdventures,
  getProfile,
  getStepHistory,
  getTreatGifts,
  getTreats,
  getWorld,
  startWorld,
  syncSteps,
  updateWorld,
  type Adventure,
  type TreatGift,
  type Treats,
  type World,
} from '@/lib/api';
import { formatSteps } from '@/lib/dates';
import { askForPushOnce } from '@/lib/notifications';
import { markPetMilestoneShown } from '@/lib/pet-milestones';
import { timeOfDay } from '@/lib/scene-art';
import { freshParam } from '@/lib/shop';
import {
  describeUnlock,
  drawWorld,
  learnedTricks,
  levelOf,
  levelProgress,
  MAX_LEVEL,
  MOOD_SAYS,
  moodLine,
  moodOf,
  training,
  unlockAt,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  WORLDS,
  type KindPicks,
  type Trick,
} from '@/lib/world';
import { useUserId } from '@/providers/auth-provider';
import { glassCard, screenBackground, transparentHeader, useAppTheme } from '@/theme';

/** The scene never takes more than this share of the screen's height, so there's room below it. */
const SCENE_SHARE = 0.42;
/** After a treat finishes teaching a trick: it eats, has its go, then the trick is announced. */
const ANNOUNCE_AFTER_MS = 2400;
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

export default function PetScreen() {
  const theme = useAppTheme();
  const userId = useUserId();
  const tabBarSpace = useTabBarSpace();
  const focused = useScreenFocused();
  const { width, height } = useWindowDimensions();
  const [busy, setBusy] = useState(false);
  // The name field (adopting) scrolls above the keyboard.
  const keyboardSpace = useKeyboardSpace();
  const sceneWidth = Math.min(width - 32, Math.round((height * SCENE_SHARE * WORLD_WIDTH) / WORLD_HEIGHT));
  // The treat counter sits up here beside the shop; the pet below keeps the count (treats rain into
  // it and leave it as they're given) and reports it, with the steps to the next one.
  const counterRef = useRef<View>(null);
  const [treatCount, setTreatCount] = useState<HeaderTreats | null>(null);

  const { data, error, reload } = useLoader(async () => {
    // Catch up on today's steps first; a failed read still shows what's saved.
    await syncSteps(userId, 2).catch(() => {});
    const [status, history, profile, treats, adventures, gifts] = await Promise.all([
      getWorld(userId),
      getStepHistory(userId, 14),
      getProfile(userId),
      getTreats(),
      getAdventures(userId),
      getTreatGifts(userId),
    ]);
    if (status) markPetMilestoneShown(userId, levelOf(status.steps));
    return { status, history, profile, treats, adventures, gifts };
  }, userId);
  const editor = useWorldEditor(userId, data?.status?.world ?? null);
  // A row left from testing the worlds that were dropped counts as no pet yet.
  const world = editor.world && WORLDS[editor.world.kind] ? editor.world : null;
  const steps = data?.status?.steps ?? 0;

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

  const title = !data ? 'Pet' : world ? worldTitle(WORLDS[world.kind], world.picks[world.kind]?.name) : 'Adopt a pet';

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
              onPress={() => router.push({ pathname: '/shop', params: { tab: 'tricks' } })}
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
                loadedAdventures={data.adventures}
                loadedGifts={data.gifts}
                sceneWidth={sceneWidth}
                animate={focused}
                editor={editor}
                counterRef={counterRef}
                onTreatCount={setTreatCount}
              />
            ) : (
              <PetCreator sceneWidth={sceneWidth} animate={focused} busy={busy} onAdopt={adopt} />
            )}
          </ScrollView>
        </Animated.View>
      )}
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
  loadedAdventures,
  loadedGifts,
  sceneWidth,
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
  /** Null before migration 018: treats are then free and there are no tricks or adventures. */
  loadedTreats: Treats | null;
  loadedAdventures: Adventure[];
  /** Treats friends have given it on playdates, newest first. */
  loadedGifts: TreatGift[];
  sceneWidth: number;
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

  // Treats given show straight away; each load brings back the server's count.
  const [treats, setTreats] = useState(loadedTreats);
  const [loaded, setLoaded] = useState(loadedTreats);
  // Treats earned since this phone last showed them: held back from the counter, then rained in.
  const [rain, setRain] = useState<{ source: Treats | null; total: number; incoming: number }>({
    source: null,
    total: 0,
    incoming: 0,
  });
  if (loaded !== loadedTreats) {
    setLoaded(loadedTreats);
    setTreats(loadedTreats);
  }
  if (rain.source !== loadedTreats) {
    const seen = loadedTreats ? seenTreats(userId) : null;
    const total = loadedTreats && seen !== null ? Math.max(0, loadedTreats.earned - seen) : 0;
    setRain({ source: loadedTreats, total, incoming: total });
  }
  const fed = treats?.fed ?? world.treats_fed ?? 0;
  const available = treats ? treats.earned - treats.fed - treats.spent : null;
  const [postcard, setPostcard] = useState<OpenPostcard | null>(null);
  const [announcing, setAnnouncing] = useState<Trick | null>(null);

  const art = drawWorld(world.kind, steps, saved, time, mood);
  const play = usePetPlay(art.pet, { tricks: learnedTricks(fed).map((t) => t.id), says: MOOD_SAYS[mood] });
  const shownSteps = useCountUp(steps, 1200);
  const muted = { color: theme.colors.onSurfaceVariant };

  const stepsRef = useRef<View>(null);
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

  // Walking earned treats while you were away: they fly up from your steps into the counter, one
  // landing at a time, once the tab is on screen.
  // Treats from friends come in with the rest, and say who they're from.
  const rainIn = useEffectEvent((total: number) => {
    const gifts = unseenGifts(userId, loadedGifts).slice(0, total);
    markGiftsSeen(userId, loadedGifts);
    const walked = total - gifts.length;
    if (!gifts.length) show(`+${total} ${total === 1 ? 'treat' : 'treats'} for walking!`, '🍪');
    else if (walked) show(`+${walked} for walking, +${gifts.length} from ${whoGave(gifts)}!`, '🎁');
    else show(`${whoGave(gifts)} gave ${name} ${gifts.length === 1 ? 'a treat' : `${gifts.length} treats`}!`, '🎁');
    const drawn = Math.min(total, 8);
    fly(stepsRef, counterRef, total, {
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

  async function giveTreat() {
    // Before migration 018, treats are free and teach nothing.
    if (!treats) {
      play.treat();
      return;
    }
    if (!available) return;
    const learning = training(treats.fed);
    const lesson: Lesson | undefined = learning
      ? { trick: learning.trick.id, skill: (learning.given + 1) / learning.trick.treats }
      : undefined;
    setTreats({ ...treats, fed: treats.fed + 1 });
    play.treat(lesson);
    const undo = () => setTreats((t) => t && { ...t, fed: t.fed - 1 });
    try {
      if ((await feedPet()) === null) {
        undo();
        return;
      }
      // That treat finished a trick.
      if (learning && lesson && lesson.skill >= 1) setTimeout(() => setAnnouncing(learning.trick), ANNOUNCE_AFTER_MS);
    } catch {
      undo();
    }
  }

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
      <View style={styles.scene}>
        <WorldScene
          art={art}
          width={sceneWidth}
          animate={animate}
          version={`${level}:${time}:${mood}:${JSON.stringify(saved ?? {})}`}
          play={play}
          radius={24}
        />
        <StageBadge def={def} level={level} />
        {announcing ? <NewTrick key={announcing.id} trick={announcing} onDone={() => setAnnouncing(null)} /> : null}
      </View>

      <View style={[styles.actions, { width: sceneWidth }]}>
        <Button mode="contained-tonal" icon="hand-heart" compact onPress={play.stroke} style={styles.action}>
          Pet
        </Button>
        <Button
          mode="contained-tonal"
          icon="cookie"
          compact
          disabled={available === 0}
          onPress={giveTreat}
          accessibilityLabel={shownTreats === null ? 'Treat' : `Treat, ${shownTreats} left`}
          style={shownTreats === null ? styles.action : styles.treat}>
          {shownTreats === null ? 'Treat' : `Treat · ${shownTreats}`}
        </Button>
        <Button mode="contained-tonal" icon="tennis-ball" compact onPress={play.play} style={styles.action}>
          Play
        </Button>
      </View>
      {treats ? (
        <TrickMenu
          fed={fed}
          width={sceneWidth}
          onShowOff={(trick) => play.showOff(trick)}
          onShop={() => openShop('tricks')}
        />
      ) : null}
      <Text variant="labelMedium" style={[styles.hint, muted]}>
        {moodLine(mood, name, today, goal)}
      </Text>

      <Card mode="contained" style={glassCard(theme)}>
        <Card.Content style={styles.stats}>
          <View>
            <View ref={stepsRef} collapsable={false} style={styles.stepsSpot}>
              <Text variant="displaySmall" style={styles.bold}>
                {formatSteps(shownSteps)}
              </Text>
            </View>
            <Text variant="bodyMedium" style={muted}>
              steps walked together since {since}
            </Text>
          </View>
          {next ? (
            <View style={styles.next}>
              <View style={styles.nextRow}>
                <Text variant="titleSmall" style={styles.bold}>
                  Next: {shortSteps(next.steps)}
                </Text>
                <Text variant="labelLarge" style={muted}>
                  {formatSteps(toGo)} to go
                </Text>
              </View>
              <ProgressBar fraction={levelProgress(steps)} />
              <Text variant="bodySmall" numberOfLines={2} style={muted}>
                {describeUnlock(next)}
                {days ? ` · ${aboutDays(days)} at your pace` : ''}
              </Text>
            </View>
          ) : (
            <Text variant="bodyLarge">Fully grown, every last milestone! Every step still counts.</Text>
          )}
        </Card.Content>
      </Card>

      {treats && available !== null ? (
        <>
          <TricksSection name={name} fed={fed} onShop={() => openShop('tricks')} />
          <AdventuresSection
            name={name}
            adventures={loadedAdventures}
            onOpen={setPostcard}
            onShop={() => openShop('trips')}
          />
          <PetPostcardModal
            open={postcard}
            steps={steps}
            picks={saved}
            name={name}
            recipient={you}
            onClose={() => setPostcard(null)}
          />
        </>
      ) : null}

      <SectionHeader title="Milestones" note={`${level} of ${MAX_LEVEL}`} />
      <MilestoneList def={def} level={level} />

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
      ) : null}
      {flights}
      {toast}
    </>
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
  scene: { alignSelf: 'center' },
  // Over the scene's top-right corner, like a game's HUD.
  treats: { marginRight: 8 },
  stepsSpot: { alignSelf: 'flex-start' },
  actions: { alignSelf: 'center', flexDirection: 'row', gap: 8 },
  action: { flex: 1 },
  // Wider than Pet and Play, for its count.
  treat: { flex: 1.4 },
  hint: { textAlign: 'center', marginTop: -4 },
  bold: { fontWeight: '700' },
  stats: { gap: 16 },
  next: { gap: 8 },
  nextRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
});
