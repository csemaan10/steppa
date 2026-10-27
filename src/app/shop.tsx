import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { ActivityIndicator, Appbar, Text } from 'react-native-paper';
import Animated, { FadeIn, interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCookieFlights } from '@/components/game/cookie-flights';
import { MagicPoof } from '@/components/game/game-fx';
import { gameMotion } from '@/components/game/game-motion';
import { useGameToast } from '@/components/game/game-toast';
import { NewTrick } from '@/components/game/new-trick';
import { SouvenirReveal } from '@/components/game/souvenir-reveal';
import { TreatCounter } from '@/components/game/treat-counter';
import { TripTicket } from '@/components/game/trip-ticket';
import { GlassBackAction } from '@/components/glass-action';
import { PetPostcardModal, type OpenPostcard } from '@/components/pet-adventures';
import { usePetPlay } from '@/components/pet-play';
import { PrimaryTabs } from '@/components/primary-tabs';
import { LooksTab } from '@/components/shop/looks-tab';
import { TricksTab } from '@/components/shop/tricks-tab';
import { TripsTab } from '@/components/shop/trips-tab';
import { worldTitle } from '@/components/world-parts';
import { WorldScene } from '@/components/world-scene';
import { useLoader } from '@/hooks/use-loader';
import { useWorldEditor } from '@/hooks/use-world-editor';
import {
  feedPetMany,
  getAdventures,
  getProfile,
  getTreats,
  getWorld,
  goOnAdventure,
  type Adventure,
  type Treats,
  type World,
} from '@/lib/api';
import {
  ADVENTURE_COST,
  destinationNamed,
  nextPlace,
  visitedDestinations,
  visitedIn,
  type Destination,
  type Place,
} from '@/lib/pet-adventures';
import { timeOfDay } from '@/lib/scene-art';
import { isShopTab, parseFresh, type Fresh, type ShopTab } from '@/lib/shop';
import {
  drawWorld,
  learnedTricks,
  levelOf,
  resolvePicks,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  WORLDS,
  type Souvenir,
  type Trick,
  type TrickId,
} from '@/lib/world';
import { useUserId } from '@/providers/auth-provider';
import { screenBackground, transparentHeader, useAppTheme } from '@/theme';

/** The pet's stage stays pinned above the shelves, taking at most this share of the screen's height. */
const SCENE_SHARE = 0.28;
/** On Trips the stage shrinks to this, so the passport has the room. */
const SMALL_STAGE = 0.45;
/** After the treats land: the pet eats and has a go, then the trick is announced. */
const ANNOUNCE_AFTER_MS = 1700;

const TABS = [
  { value: 'looks' as const, label: 'Looks', icon: 'tshirt-crew-outline' as const, activeIcon: 'tshirt-crew' as const },
  {
    value: 'tricks' as const,
    label: 'Tricks',
    icon: 'star-four-points-outline' as const,
    activeIcon: 'star-four-points' as const,
  },
  { value: 'trips' as const, label: 'Trips', icon: 'airplane' as const },
];

/**
 * The shop: looks you've unlocked by walking (the wardrobe), and tricks and trips you buy with
 * treats. Your pet stands on a stage at the top, wearing whatever you pick and doing what you buy.
 * `tab` opens a section; `fresh` ("3-5") marks the looks those milestones just unlocked as new.
 */
export default function ShopScreen() {
  const theme = useAppTheme();
  const userId = useUserId();
  const params = useLocalSearchParams<{ tab?: string; fresh?: string }>();
  const { data, error } = useLoader(async () => {
    const [status, treats, adventures, profile] = await Promise.all([
      getWorld(userId),
      getTreats(),
      getAdventures(userId),
      getProfile(userId),
    ]);
    return { status, treats, adventures, you: profile.display_name };
  }, userId);
  const editor = useWorldEditor(userId, data?.status?.world ?? null);
  // Only a pet has a shop (a row left from testing the dropped worlds doesn't).
  const world = editor.world && WORLDS[editor.world.kind] ? editor.world : null;

  return (
    <View style={[styles.flex, screenBackground(theme)]}>
      {!data || !world ? (
        <>
          <Appbar.Header style={transparentHeader}>
            <GlassBackAction onPress={() => router.back()} />
            <Appbar.Content title="Shop" />
          </Appbar.Header>
          <View style={styles.center}>
            {error ? (
              <Text style={{ color: theme.colors.error }}>{error}</Text>
            ) : data !== undefined ? (
              <Text style={{ color: theme.colors.onSurfaceVariant }}>Adopt a pet first.</Text>
            ) : (
              <ActivityIndicator />
            )}
          </View>
        </>
      ) : (
        <Shop
          world={world}
          steps={data.status?.steps ?? 0}
          loadedTreats={data.treats}
          loadedAdventures={data.adventures}
          you={data.you}
          initialTab={isShopTab(params.tab) ? params.tab : 'looks'}
          fresh={parseFresh(params.fresh)}
          editor={editor}
        />
      )}
    </View>
  );
}

function Shop({
  world,
  steps,
  loadedTreats,
  loadedAdventures,
  you,
  initialTab,
  fresh,
  editor,
}: {
  world: World;
  steps: number;
  /** Null before migration 018: then there are no treats, so no tricks or trips to buy. */
  loadedTreats: Treats | null;
  loadedAdventures: Adventure[];
  you: string;
  initialTab: ShopTab;
  fresh: Fresh | null;
  editor: ReturnType<typeof useWorldEditor>;
}) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const sceneWidth = Math.min(width - 32, Math.round((height * SCENE_SHARE * WORLD_WIDTH) / WORLD_HEIGHT));
  const sceneHeight = Math.round((sceneWidth * WORLD_HEIGHT) / WORLD_WIDTH);
  const scale = sceneWidth / WORLD_WIDTH;

  const def = WORLDS[world.kind];
  const level = levelOf(steps);
  const saved = world.picks[world.kind];
  const name = worldTitle(def, saved?.name);
  const picks = resolvePicks(def, level, saved);
  const art = drawWorld(world.kind, steps, saved, timeOfDay());

  // Spending shows at once; a reload brings back the server's counts.
  const [treats, setTreats] = useState(loadedTreats);
  const [adventures, setAdventures] = useState(loadedAdventures);
  const [loaded, setLoaded] = useState({ loadedTreats, loadedAdventures });
  if (loaded.loadedTreats !== loadedTreats || loaded.loadedAdventures !== loadedAdventures) {
    setLoaded({ loadedTreats, loadedAdventures });
    setTreats(loadedTreats);
    setAdventures(loadedAdventures);
  }
  const fed = treats?.fed ?? world.treats_fed ?? 0;
  const available = treats ? treats.earned - treats.fed - treats.spent : 0;
  const play = usePetPlay(art.pet, { tricks: learnedTricks(fed).map((t) => t.id) });

  const [tab, setTab] = useState<ShopTab>(initialTab);
  const [buying, setBuying] = useState<string | null>(null);
  const [justLearned, setJustLearned] = useState<TrickId | null>(null);
  const [announcing, setAnnouncing] = useState<Trick | null>(null);
  const [ticket, setTicket] = useState<{ place: Place; number: number } | null>(null);
  const [postcard, setPostcard] = useState<OpenPostcard | null>(null);
  const [poof, setPoof] = useState(0);
  // A first trip somewhere brings its souvenir home: shown once its postcard is put down.
  const [bringing, setBringing] = useState<Souvenir | null>(null);
  const [unpacking, setUnpacking] = useState<Souvenir | null>(null);
  const [newSouvenir, setNewSouvenir] = useState<string | null>(null);
  const visited = visitedDestinations(adventures.map((a) => a.place));

  const counterRef = useRef<View>(null);
  const mouthRef = useRef<View>(null);
  const { fly, flights } = useCookieFlights();
  const { show, toast } = useGameToast(insets.bottom + 24);

  // On Trips the stage shrinks toward its top, giving the passport the room.
  const small = useSharedValue(initialTab === 'trips' ? 1 : 0);
  useEffect(() => {
    small.set(withTiming(tab === 'trips' ? 1 : 0, gameMotion.resize));
  }, [small, tab]);
  const stageBox = useAnimatedStyle(() => ({ height: interpolate(small.value, [0, 1], [sceneHeight, sceneHeight * SMALL_STAGE]) }));
  const stageScale = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(small.value, [0, 1], [1, SMALL_STAGE]) }],
  }));

  function failed(e: unknown) {
    show(e instanceof Error ? e.message : 'Something went wrong', '⚠️');
  }

  /** Teaches a whole trick: the treats fly from your counter into its mouth, it does the trick, and it's announced. */
  async function learn(trick: Trick, cost: number) {
    if (!treats || buying) return;
    setBuying(trick.id);
    try {
      const eaten = await feedPetMany(cost);
      if (eaten === null) {
        show('Not enough treats yet', '🍪');
        return;
      }
      setTreats({ ...treats, fed: eaten });
      fly(counterRef, mouthRef, cost, {
        onDone: () => {
          play.treat({ trick: trick.id, skill: 1 });
          setJustLearned(trick.id);
          setTimeout(() => setAnnouncing(trick), ANNOUNCE_AFTER_MS);
        },
      });
    } catch (e) {
      failed(e);
    } finally {
      setBuying(null);
    }
  }

  /**
   * Sends it somewhere new in the country (or fantasy land) you picked: the treats fly onto its
   * card, the boarding pass comes up, then the postcard from wherever it landed.
   */
  async function book(destination: Destination, card: RefObject<View | null>) {
    if (!treats || buying) return;
    setBuying(destination.flag);
    try {
      const place = nextPlace(
        adventures.map((a) => a.place),
        destination.places
      );
      if (!(await goOnAdventure(place.key))) {
        show(`A trip takes ${ADVENTURE_COST} treats`, '🍪');
        return;
      }
      const number = adventures.length + 1;
      const firstVisit = visitedIn(destination, adventures.map((a) => a.place)) === 0;
      setBringing((firstVisit && def.souvenirs?.find((s) => s.from === destination.key)) || null);
      setTreats({ ...treats, spent: treats.spent + ADVENTURE_COST });
      setAdventures([{ id: Date.now(), place: place.key, created_at: new Date().toISOString() }, ...adventures]);
      fly(counterRef, card, ADVENTURE_COST, { onDone: () => setTicket({ place, number }) });
    } catch (e) {
      failed(e);
    } finally {
      setBuying(null);
    }
  }

  /** Puts on a look: a puff of cloud hides the swap while the pet twirls into it. */
  function pick(slot: string, choice: string) {
    editor.pick(slot, choice);
    setPoof((n) => n + 1);
    play.dressUp();
  }

  const mouth = art.pet?.mouth;
  const box = art.pet?.box;

  return (
    <>
      <Appbar.Header style={transparentHeader}>
        <GlassBackAction onPress={() => router.back()} />
        <Appbar.Content title="Shop" />
        {treats ? (
          <TreatCounter
            count={available}
            toNext={treats.toNext}
            targetRef={counterRef}
            onPress={() => setTab('tricks')}
          />
        ) : null}
      </Appbar.Header>

      <Animated.View style={[styles.stage, stageBox]}>
        <Animated.View style={[styles.stageScale, stageScale]}>
          <WorldScene art={art} width={sceneWidth} version={JSON.stringify(picks)} play={play} radius={24} />
          {/* Where bought treats fly to. */}
          {mouth ? (
            <View
              ref={mouthRef}
              collapsable={false}
              pointerEvents="none"
              style={[styles.mouth, { left: mouth[0] * scale - 2, top: mouth[1] * scale - 2 }]}
            />
          ) : null}
          {poof && box ? (
            <MagicPoof
              key={poof}
              x={(box[0] + box[2] / 2) * scale}
              y={(box[1] + box[3] / 2) * scale}
              size={Math.max(box[2], box[3]) * scale}
            />
          ) : null}
          {announcing ? <NewTrick key={announcing.id} trick={announcing} onDone={() => setAnnouncing(null)} /> : null}
        </Animated.View>
      </Animated.View>

      <PrimaryTabs value={tab} onChange={setTab} tabs={TABS} />

      {/* Keyed by tab, so each one opens at the top. */}
      <ScrollView key={tab} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
        <Animated.View entering={FadeIn.duration(180)}>
          {tab === 'looks' ? (
            <LooksTab
              def={def}
              level={level}
              visited={visited}
              newSouvenir={newSouvenir}
              picks={picks}
              fresh={fresh}
              name={saved?.name ?? ''}
              placeholder={`Your ${def.title.toLowerCase()}`}
              onRename={editor.rename}
              onPick={pick}
            />
          ) : !treats ? (
            <Text style={styles.message}>Treats aren&apos;t switched on yet, so there&apos;s nothing to buy here.</Text>
          ) : tab === 'tricks' ? (
            <TricksTab
              fed={fed}
              available={available}
              buying={buying}
              justLearned={justLearned}
              onLearn={learn}
              onShowOff={(trick) => play.showOff(trick)}
            />
          ) : (
            <TripsTab
              name={name}
              available={available}
              adventures={adventures}
              busy={buying}
              onBook={book}
              onOpen={setPostcard}
            />
          )}
        </Animated.View>
      </ScrollView>

      {ticket ? (
        <TripTicket
          place={ticket.place}
          number={ticket.number}
          name={name}
          onDone={() => {
            setTicket(null);
            setPostcard({ place: ticket.place, number: ticket.number, isNew: true });
          }}
        />
      ) : null}
      <PetPostcardModal
        open={postcard}
        steps={steps}
        picks={saved}
        name={name}
        recipient={you}
        onClose={() => {
          setPostcard(null);
          if (bringing) {
            setUnpacking(bringing);
            setBringing(null);
          }
        }}
      />
      {unpacking ? (
        <SouvenirReveal
          souvenir={unpacking}
          from={destinationNamed(unpacking.from)!}
          name={name}
          onWear={() => {
            setUnpacking(null);
            setNewSouvenir(unpacking.choice.id);
            setTab('looks');
            pick(unpacking.slot, unpacking.choice.id);
          }}
          onLater={() => {
            setUnpacking(null);
            setNewSouvenir(unpacking.choice.id);
          }}
        />
      ) : null}
      {flights}
      {toast}
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  stage: { alignItems: 'center', marginBottom: 8 },
  stageScale: { transformOrigin: 'top' },
  mouth: { position: 'absolute', width: 4, height: 4 },
  content: { padding: 16, paddingTop: 12 },
  message: { textAlign: 'center', marginTop: 24 },
});
