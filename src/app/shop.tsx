import { router, useLocalSearchParams } from 'expo-router';
import { useDeferredValue, useEffect, useRef, useState, type RefObject } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { ActivityIndicator, Appbar, Text } from 'react-native-paper';
import Animated, {
  FadeIn,
  FadeOutDown,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCookieFlights } from '@/components/game/cookie-flights';
import { MagicPoof } from '@/components/game/game-fx';
import { gameMotion, riseIn } from '@/components/game/game-motion';
import { useGameToast } from '@/components/game/game-toast';
import { NewTrick } from '@/components/game/new-trick';
import { SouvenirReveal } from '@/components/game/souvenir-reveal';
import { TreatCounter } from '@/components/game/treat-counter';
import { TripTicket } from '@/components/game/trip-ticket';
import { GlassBackAction } from '@/components/glass-action';
import { PetPostcardModal, type OpenPostcard } from '@/components/pet-adventures';
import { usePetPlay } from '@/components/pet-play';
import { TreatsSheet } from '@/components/pet-treats';
import { TreatIcon } from '@/components/treat-icon';
import { PrimaryTabs } from '@/components/primary-tabs';
import { BuyCard, LooksTab } from '@/components/shop/looks-tab';
import { TricksTab } from '@/components/shop/tricks-tab';
import { TripsTab, type Outing } from '@/components/shop/trips-tab';
import { visitCardFor, type VisitCard } from '@/components/visit-postcard';
import { worldTitle } from '@/components/world-parts';
import { WorldScene } from '@/components/world-scene';
import { useLoader } from '@/hooks/use-loader';
import { useWorldEditor } from '@/hooks/use-world-editor';
import {
  buyItem,
  feedPetMany,
  getAdventures,
  getMateWorld,
  getPetMates,
  getProfile,
  getPurchases,
  getShopPrices,
  getTodaysVisits,
  getTreats,
  getVisits,
  getWorld,
  goOnAdventure,
  visitMate,
  type Adventure,
  type PetMate,
  type ShopPrice,
  type Treats,
  type Visit,
  type World,
} from '@/lib/api';
import {
  ADVENTURE_COST,
  awayOn,
  awayToday,
  destinationNamed,
  nextPlace,
  visitedDestinations,
  visitedIn,
  type Destination,
  type Place,
} from '@/lib/pet-adventures';
import { toDayKey } from '@/lib/dates';
import { timeOfDay } from '@/lib/scene-art';
import { isShopTab, parseFresh, priceList, type Fresh, type ShopTab, type ShopThing } from '@/lib/shop';
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
    const [status, treats, adventures, profile, owned, prices, todays, mates, visits] = await Promise.all([
      getWorld(userId),
      getTreats(),
      getAdventures(userId),
      getProfile(userId),
      getPurchases(userId),
      getShopPrices(),
      getTodaysVisits(userId),
      getPetMates(userId).catch(() => []),
      getVisits(userId),
    ]);
    // Postcards from its visits, with each friend's pet as it looks now and wherever it was that day.
    // A friend who has left your groups can't be drawn any more, so theirs are left out.
    const hosts = [...new Set(visits.map((v) => v.host))].filter((id) => mates.some((m) => m.id === id));
    const found = await Promise.all(
      hosts.map(async (id) => {
        const [host, trips] = await Promise.all([getMateWorld(id).catch(() => null), getAdventures(id).catch(() => [])]);
        return host ? ([id, { steps: host.steps, trips }] as const) : null;
      })
    );
    const hostsFound = new Map(found.flatMap((h) => (h ? [h] : [])));
    const visitPostcards = visits.flatMap((v, i) => {
      const mate = mates.find((m) => m.id === v.host);
      const host = hostsFound.get(v.host);
      if (!mate || !host) return [];
      return [{ card: visitCardFor(v.day, mate, host.steps, awayOn(host.trips, v.day)), number: visits.length - i }];
    });
    return {
      status,
      treats,
      adventures,
      you: profile.display_name,
      owned,
      prices,
      todays,
      mates,
      visitPostcards,
      visitCount: visits.length,
    };
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
          loadedOwned={data.owned}
          prices={data.prices}
          todays={data.todays}
          mates={data.mates}
          loadedVisitPostcards={data.visitPostcards}
          visitCount={data.visitCount}
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
  loadedOwned,
  prices,
  todays: loadedTodays,
  mates,
  loadedVisitPostcards,
  visitCount,
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
  /** Things bought with treats, and keepsakes. */
  loadedOwned: string[];
  /** The shop's prices (empty before migration 021). */
  prices: ShopPrice[];
  /** Today's visits: your pet's to a friend, and friends' pets to yours. */
  todays: Visit[];
  /** Group mates with pets, to visit. */
  mates: PetMate[];
  /** Postcards from its visits to friends, newest first. */
  loadedVisitPostcards: { card: VisitCard; number: number }[];
  /** How many visits it has been on. */
  visitCount: number;
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
  // Something being tried on shows on the pet before it's bought.
  const [trying, setTrying] = useState<ShopThing | null>(null);
  const shown = trying ? { ...saved, [trying.slot]: trying.id } : saved;
  const picks = resolvePicks(def, level, shown);
  const art = drawWorld(world.kind, steps, shown, timeOfDay());

  // Spending shows at once; a reload brings back the server's counts.
  const [treats, setTreats] = useState(loadedTreats);
  const [adventures, setAdventures] = useState(loadedAdventures);
  const [visitPostcards, setVisitPostcards] = useState(loadedVisitPostcards);
  const [loaded, setLoaded] = useState({ loadedTreats, loadedAdventures, loadedVisitPostcards });
  if (
    loaded.loadedTreats !== loadedTreats ||
    loaded.loadedAdventures !== loadedAdventures ||
    loaded.loadedVisitPostcards !== loadedVisitPostcards
  ) {
    setLoaded({ loadedTreats, loadedAdventures, loadedVisitPostcards });
    setTreats(loadedTreats);
    setAdventures(loadedAdventures);
    setVisitPostcards(loadedVisitPostcards);
  }
  const fed = treats?.fed ?? world.treats_fed ?? 0;
  const available = treats ? treats.earned - treats.fed - treats.spent : 0;
  // Bought here and not back from the server yet.
  const [bought, setBought] = useState<string[]>([]);
  const owned = new Set([...loadedOwned, ...bought]);
  const price = priceList(prices);
  const [visits, setVisits] = useState<{ base: Visit[]; today: Visit[] }>({ base: loadedTodays, today: loadedTodays });
  const todays = visits.base === loadedTodays ? visits.today : loadedTodays;
  // One outing a day: trips, or a visit to a friend's.
  const out = todays.find((v) => v.guest === world.user_id);
  const trip = awayToday(adventures);
  const outing: Outing | null = trip
    ? { trip }
    : out
      ? { friend: mates.find((m) => m.id === out.host)?.name ?? 'a friend' }
      : null;
  // Friends whose pet has been with yours today, either way round.
  const together = new Set(todays.map((v) => (v.guest === world.user_id ? v.host : v.guest)));
  const [sheetOpen, setSheetOpen] = useState(false);
  const play = usePetPlay(art.pet, { tricks: learnedTricks(fed).map((t) => t.id) });

  const [tab, setTab] = useState<ShopTab>(initialTab);
  // The tabs and the stage answer a switch at once; the tab's content follows a moment behind, built
  // in the background, so a heavy one (Trips) doesn't freeze the switch while it's laid out.
  const page = useDeferredValue(tab);
  // The tabs built so far: each stays once it's been opened (see the pages below).
  const [opened, setOpened] = useState<ReadonlySet<ShopTab>>(() => new Set([initialTab]));
  if (!opened.has(page)) setOpened(new Set([...opened, page]));
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
  // Something tried on brings up a card to buy it, floating over the bottom of the screen; the
  // shelves leave room for it, and toasts pop up above it.
  const tryingPrice = trying ? price.get(trying.id)?.treats : undefined;
  const buyCardShown = !!trying && !!tryingPrice;
  const { show, toast } = useGameToast(insets.bottom + (buyCardShown ? BUY_CARD_ROOM : 24));

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
        show('Not enough treats yet', <TreatIcon size={20} />);
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
        show(`A trip takes ${ADVENTURE_COST} treats`, <TreatIcon size={20} />);
        return;
      }
      const number = adventures.length + 1;
      const firstVisit = visitedIn(destination, adventures.map((a) => a.place)) === 0;
      setBringing((firstVisit && def.souvenirs?.find((s) => s.from === destination.key && !s.full)) || null);
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

  /** Tries something for sale on, or puts it back: the pet shows it off, a toy gets played with. */
  function tryOn(thing: ShopThing | null) {
    setTrying(thing);
    if (!thing) return;
    setPoof((n) => n + 1);
    if (thing.slot === 'toy') play.play(thing.id);
    else play.dressUp();
  }

  /** Buys what's being tried on: the treats fly from the counter to the pet, and it's theirs. */
  async function buy(thing: ShopThing, cost: number) {
    if (!treats || buying) return;
    setBuying(thing.id);
    try {
      if (!(await buyItem(thing.id))) {
        show('Not enough treats yet', <TreatIcon size={20} />);
        return;
      }
      setTreats({ ...treats, spent: treats.spent + cost });
      setBought([...bought, thing.id]);
      fly(counterRef, mouthRef, Math.min(cost, 12), {
        onDone: () => {
          setTrying(null);
          pick(thing.slot, thing.id);
          show(`${thing.name} is ${name}'s now!`, '🎉');
        },
      });
    } catch (e) {
      failed(e);
    } finally {
      setBuying(null);
    }
  }

  /** Sends the pet to a friend's yard for the day: the treats fly onto their card, then a postcard comes home. */
  async function visitFriend(mate: PetMate, cost: number, card: RefObject<View | null>) {
    if (!treats || buying) return;
    setBuying(`visit:${mate.id}`);
    try {
      // Their pet as it looks now and where it is today, for the postcard.
      const [went, host, trips] = await Promise.all([
        visitMate(mate.id),
        getMateWorld(mate.id).catch(() => null),
        getAdventures(mate.id).catch(() => []),
      ]);
      if (!went) {
        show(outing ? `${name} has already been out today` : 'Not enough treats yet', <TreatIcon size={20} />);
        return;
      }
      setTreats({ ...treats, spent: treats.spent + cost });
      const now = new Date();
      const day = toDayKey(now);
      setVisits({
        base: loadedTodays,
        today: [{ id: now.getTime(), guest: world.user_id, host: mate.id, day, created_at: now.toISOString() }, ...todays],
      });
      const sent = host ? { card: visitCardFor(day, mate, host.steps, awayToday(trips)), number: visitCount + 1 } : null;
      if (sent) setVisitPostcards([sent, ...visitPostcards]);
      fly(counterRef, card, Math.min(cost, 12), {
        onDone: () =>
          sent
            ? setPostcard({ visit: sent.card, number: sent.number, isNew: true })
            : show(`${name} is off to ${mate.world.picks.pet?.name || `${mate.name}'s pet`} for the day`, '🏡'),
      });
    } catch (e) {
      failed(e);
    } finally {
      setBuying(null);
    }
  }

  function renderTab(which: ShopTab) {
    if (which === 'looks') {
      return (
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
          owned={owned}
          prices={price}
          trying={trying}
          onTry={tryOn}
        />
      );
    }
    if (!treats) {
      return <Text style={styles.message}>Treats aren&apos;t switched on yet, so there&apos;s nothing to buy here.</Text>;
    }
    if (which === 'tricks') {
      return (
        <TricksTab
          fed={fed}
          available={available}
          buying={buying}
          justLearned={justLearned}
          onLearn={learn}
          onShowOff={(trick) => play.showOff(trick)}
        />
      );
    }
    return (
      <TripsTab
        name={name}
        available={available}
        adventures={adventures}
        busy={buying}
        onBook={book}
        onOpen={setPostcard}
        mates={mates}
        visitPostcards={visitPostcards}
        outing={outing}
        together={together}
        visitPrice={price.get('visit')?.treats ?? null}
        onVisit={visitFriend}
        onPassport={() => router.push('/passport')}
      />
    );
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
            onPress={() => setSheetOpen(true)}
          />
        ) : null}
      </Appbar.Header>

      <Animated.View style={[styles.stage, stageBox]}>
        <Animated.View style={[styles.stageScale, stageScale]}>
          {/* No version: a new look swaps in place under the poof. Crossfading a whole second scene in
              stuttered on Android, and the old pet stood still under the new one while it twirled. */}
          <WorldScene art={art} width={sceneWidth} play={play} radius={24} />
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

      <PrimaryTabs
        value={tab}
        onChange={(next) => {
          setTab(next);
          setTrying(null);
        }}
        tabs={TABS}
      />

      {/* Each tab stays built once it's been opened, just hidden while another shows, and keeps its
          own scroll: tearing a big one down (the wardrobe, the album) and building the next froze
          Android on a switch. */}
      <View style={styles.flex}>
        {TABS.map(({ value }) =>
          opened.has(value) ? (
            <View
              key={value}
              style={[StyleSheet.absoluteFill, value !== page && styles.hidden]}
              pointerEvents={value === page ? 'auto' : 'none'}
              importantForAccessibility={value === page ? 'auto' : 'no-hide-descendants'}
              accessibilityElementsHidden={value !== page}>
              <ScrollView
                contentContainerStyle={[
                  styles.content,
                  { paddingBottom: insets.bottom + 32 + (buyCardShown && value === 'looks' ? BUY_CARD_ROOM : 0) },
                ]}>
                <Animated.View entering={FadeIn.duration(180)}>{renderTab(value)}</Animated.View>
              </ScrollView>
            </View>
          ) : null
        )}
      </View>

      {trying && tryingPrice ? (
        <Animated.View
          entering={riseIn()}
          exiting={FadeOutDown.duration(160)}
          style={[styles.buyCard, { bottom: insets.bottom + 12 }]}>
          <BuyCard
            thing={trying}
            price={tryingPrice}
            available={available}
            buying={buying}
            onBuy={() => buy(trying, tryingPrice)}
            onCancel={() => tryOn(null)}
          />
        </Animated.View>
      ) : null}
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
      {treats ? (
        <TreatsSheet
          open={sheetOpen}
          name={name}
          available={available}
          toNext={treats.toNext}
          onClose={() => setSheetOpen(false)}
        />
      ) : null}
      {flights}
      {toast}
    </>
  );
}

/** Room kept at the bottom for the floating buy card: its height and a gap. */
const BUY_CARD_ROOM = 112;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  buyCard: { position: 'absolute', left: 16, right: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  stage: { alignItems: 'center', marginBottom: 8 },
  stageScale: { transformOrigin: 'top' },
  mouth: { position: 'absolute', width: 4, height: 4 },
  content: { padding: 16, paddingTop: 12 },
  hidden: { opacity: 0 },
  message: { textAlign: 'center', marginTop: 24 },
});
