import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { ActivityIndicator, Appbar, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Appear } from '@/components/appear';
import { Button } from '@/components/button';
import { useCookieFlights } from '@/components/game/cookie-flights';
import { useGameToast } from '@/components/game/game-toast';
import { TreatCounter } from '@/components/game/treat-counter';
import { GlassBackAction } from '@/components/glass-action';
import { PlaydateScene, usePlaydate } from '@/components/playdate-scene';
import { worldTitle } from '@/components/world-parts';
import { useLoader } from '@/hooks/use-loader';
import { getMateWorld, getProfile, getTreats, getWorld, giveTreat, lastTreatGiven, type Treats } from '@/lib/api';
import { PHOTO_FEET, PHOTO_SIZE } from '@/components/pet-adventures';
import { timeOfDay } from '@/lib/scene-art';
import { levelOf, stageOf, WORLDS, type KindPicks } from '@/lib/world';
import { useUserId } from '@/providers/auth-provider';
import { screenBackground, transparentHeader, useAppTheme } from '@/theme';
import { TreatIcon, treatButtonIcon } from '@/components/treat-icon';

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/**
 * A playdate with a group mate's pet: both pets in the park together. Play with them, or give your
 * friend's pet one of your treats (once a day each), which flies from your counter into its mouth.
 */
export default function PlaydateScreen() {
  const theme = useAppTheme();
  const myId = useUserId();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error } = useLoader(async () => {
    const [mine, theirs, them, treats, last] = await Promise.all([
      getWorld(myId),
      getMateWorld(id).catch(() => null),
      getProfile(id),
      getTreats(),
      lastTreatGiven(myId, id),
    ]);
    // Whether you've given them one today, by this phone's clock (the server checks by yours).
    return { mine, theirs, friend: them.display_name, treats, givenToday: !!last && sameDay(new Date(last), new Date()) };
  }, `${myId}:${id}`);

  const header = (
    <Appbar.Header style={transparentHeader}>
      <GlassBackAction onPress={() => router.back()} />
      <Appbar.Content title="Playdate" />
    </Appbar.Header>
  );

  if (!data) {
    return (
      <View style={[styles.flex, screenBackground(theme)]}>
        {header}
        <View style={styles.center}>
          {error ? <Text style={{ color: theme.colors.error }}>{error}</Text> : <ActivityIndicator />}
        </View>
      </View>
    );
  }

  const mine = data.mine && WORLDS[data.mine.world.kind] ? data.mine : null;
  const theirs = data.theirs && WORLDS[data.theirs.world.kind] ? data.theirs : null;
  if (!mine || !theirs) {
    return (
      <View style={[styles.flex, screenBackground(theme)]}>
        {header}
        <View style={styles.center}>
          <Text variant="titleMedium" style={styles.message}>
            {!mine ? 'Adopt a pet of your own first, then bring it along.' : `${data.friend} hasn't adopted a pet yet.`}
          </Text>
          {!mine ? (
            <Button mode="contained" icon="paw" onPress={() => router.replace('/pet')}>
              Adopt a pet
            </Button>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <Playdate
      friendId={id}
      friend={data.friend}
      mine={{ steps: mine.steps, picks: mine.world.picks[mine.world.kind] }}
      theirs={{ steps: theirs.steps, picks: theirs.world.picks[theirs.world.kind] }}
      loadedTreats={data.treats}
      givenToday={data.givenToday}
    />
  );
}

type Pet = { steps: number; picks: KindPicks | undefined };

function Playdate({
  friendId,
  friend,
  mine,
  theirs,
  loadedTreats,
  givenToday,
}: {
  friendId: string;
  /** Your friend's name. */
  friend: string;
  mine: Pet;
  theirs: Pet;
  /** Null before migration 018: no treats to give. */
  loadedTreats: Treats | null;
  givenToday: boolean;
}) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const sceneWidth = Math.min(width - 32, 520);
  const date = usePlaydate();
  const [treats, setTreats] = useState(loadedTreats);
  const [given, setGiven] = useState(givenToday);
  const [giving, setGiving] = useState(false);
  const counterRef = useRef<View>(null);
  const mouthRef = useRef<View>(null);
  const { fly, flights } = useCookieFlights();
  const { show, toast } = useGameToast(insets.bottom + 24);

  const def = WORLDS.pet;
  const myName = worldTitle(def, mine.picks?.name);
  const theirName = theirs.picks?.name || `${friend}'s pet`;
  const available = treats ? treats.earned - treats.fed - treats.spent : 0;
  // Roughly your friend's pet's mouth, where the treat lands (see PlaydateScene).
  const mouthY = PHOTO_FEET - 47 * PHOTO_SIZE[stageOf(levelOf(theirs.steps))]!;

  async function give() {
    if (!treats || giving) return;
    setGiving(true);
    try {
      const result = await giveTreat(friendId);
      if (result === 'given') {
        setTreats({ ...treats, spent: treats.spent + 1 });
        setGiven(true);
        fly(counterRef, mouthRef, 1, {
          onDone: () => {
            date.treat(mouthY);
            show(`${theirName} loved it!`, '💗');
          },
        });
      } else if (result === 'already') {
        setGiven(true);
        show(`You've given ${theirName} a treat today`, <TreatIcon size={20} />);
      } else if (result === 'no-treats') {
        show('No treats to spare. Walk a little to earn one!', '👟');
      } else {
        show("Can't give a treat right now", <TreatIcon size={20} />);
      }
    } catch (e) {
      show(e instanceof Error ? e.message : 'Something went wrong', '⚠️');
    } finally {
      setGiving(false);
    }
  }

  return (
    <View style={[styles.flex, screenBackground(theme)]}>
      <Appbar.Header style={transparentHeader}>
        <GlassBackAction onPress={() => router.back()} />
        <Appbar.Content title="Playdate" />
        {treats ? <TreatCounter count={available} toNext={treats.toNext} targetRef={counterRef} /> : null}
      </Appbar.Header>
      <View style={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        {/* The scene, the names and the buttons arrive one after another. */}
        <Appear>
          <PlaydateScene date={date} mine={mine} theirs={theirs} width={sceneWidth} time={timeOfDay()} mouthRef={mouthRef} />
        </Appear>
        <Appear index={1} style={styles.names}>
          <Text variant="titleLarge" style={styles.bold}>
            {myName} & {theirName}
          </Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            A playdate at the park with {friend}
          </Text>
        </Appear>
        <Appear index={2} style={[styles.actions, { width: sceneWidth }]}>
          <Button mode="contained-tonal" icon="tennis-ball" compact onPress={date.play} style={styles.action}>
            Play
          </Button>
          {treats ? (
            <Button
              mode="contained-tonal"
              icon={given ? 'check' : treatButtonIcon}
              compact
              disabled={given || available < 1}
              loading={giving}
              onPress={give}
              accessibilityLabel={given ? `You gave ${theirName} a treat today` : `Give ${theirName} a treat`}
              style={styles.treat}>
              {given ? 'Treat given today' : 'Give a treat'}
            </Button>
          ) : null}
        </Appear>
      </View>
      {flights}
      {toast}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  message: { textAlign: 'center' },
  content: { alignItems: 'center', gap: 16, paddingHorizontal: 16, paddingTop: 8 },
  names: { alignItems: 'center', gap: 2 },
  bold: { fontWeight: '800' },
  actions: { flexDirection: 'row', gap: 8 },
  action: { flex: 1 },
  treat: { flex: 1.6 },
});
