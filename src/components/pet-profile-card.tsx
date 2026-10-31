import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Card, Text } from 'react-native-paper';

import { Button } from '@/components/button';
import { usePetPlay } from '@/components/pet-play';
import { StageBadge } from '@/components/world-parts';
import { WorldScene } from '@/components/world-scene';
import { useScreenFocused } from '@/hooks/use-screen-focused';
import { getAdventures, type Adventure, type WorldStatus } from '@/lib/api';
import { formatSteps } from '@/lib/dates';
import { awayToday } from '@/lib/pet-adventures';
import { timeOfDay } from '@/lib/scene-art';
import { drawAway, drawWorld, learnedTricks, levelOf, WORLDS } from '@/lib/world';
import { glassCard, useAppTheme } from '@/theme';

/**
 * Someone's pet on their profile: its name, how grown it is and the steps behind it, in its yard (or
 * wherever it's gone on an adventure today), with the tricks it knows and how many adventures it's
 * been on. You can tap it and hold it to play, the same as your own, and it shows off its tricks.
 * `owner` is null for your own pet; a friend's has a button for a playdate with yours.
 */
export function PetProfileCard({ status, owner }: { status: WorldStatus; owner: string | null }) {
  const theme = useAppTheme();
  const { width } = useWindowDimensions();
  const focused = useScreenFocused();
  const { world, steps } = status;
  const def = WORLDS[world.kind];
  const saved = world.picks[world.kind];
  const [adventures, setAdventures] = useState<Adventure[]>([]);
  useEffect(() => {
    let live = true;
    getAdventures(world.user_id).then((all) => live && setAdventures(all));
    return () => {
      live = false;
    };
  }, [world.user_id]);
  const away = awayToday(adventures);
  const time = timeOfDay();
  const art = away ? drawAway(away.stop, steps, saved, time) : drawWorld(world.kind, steps, saved, time);
  const tricks = learnedTricks(world.treats_fed ?? 0);
  const play = usePetPlay(art.pet, { tricks: tricks.map((t) => t.id) });
  const name = saved?.name;
  const muted = { color: theme.colors.onSurfaceVariant };
  const trips = adventures.length;
  const extras = [
    away ? `In ${away.stop.name} today` : null,
    tricks.length ? `Knows ${tricks.length} ${tricks.length === 1 ? 'trick' : 'tricks'}` : null,
    trips ? `${trips} ${trips === 1 ? 'adventure' : 'adventures'}` : null,
  ].filter(Boolean);

  // The screen's padding (16 a side) and the card's (8 a side).
  const sceneWidth = width - 48;

  return (
    <Card mode="contained" style={glassCard(theme)}>
      <Card.Content style={styles.text}>
        <Text variant="titleMedium" numberOfLines={1} style={styles.bold}>
          {[name, owner ? `${owner}'s pet` : name ? 'your pet' : 'Your pet'].filter(Boolean).join(', ')}
        </Text>
        <Text variant="bodyMedium" style={muted}>
          {formatSteps(steps)} steps walked together
        </Text>
        {extras.length ? (
          <Text variant="bodyMedium" style={muted}>
            {extras.join(' · ')}
          </Text>
        ) : null}
      </Card.Content>
      <View style={styles.scene}>
        <WorldScene art={art} width={sceneWidth} animate={focused} version={away?.key ?? 'home'} play={play} radius={18} />
        <StageBadge def={def} level={levelOf(steps)} />
      </View>
      {owner ? (
        <View style={styles.actions}>
          <Button
            mode="contained-tonal"
            icon="paw"
            onPress={() => router.push({ pathname: '/playdate/[id]', params: { id: world.user_id } })}>
            Playdate
          </Button>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  text: { gap: 2, paddingTop: 14, paddingBottom: 10 },
  bold: { fontWeight: '700' },
  scene: { margin: 8, marginTop: 0 },
  actions: { paddingHorizontal: 8, paddingBottom: 10 },
});
