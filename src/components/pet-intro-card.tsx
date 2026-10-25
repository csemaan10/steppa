import 'expo-sqlite/localStorage/install';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Card, Text } from 'react-native-paper';

import { Button } from '@/components/button';
import { usePetPlay } from '@/components/pet-play';
import { WorldScene } from '@/components/world-scene';
import { useScreenFocused } from '@/hooks/use-screen-focused';
import type { Profile } from '@/lib/api';
import { hashString } from '@/lib/character';
import { timeOfDay } from '@/lib/scene-art';
import { drawWorld, WORLDS, type KindPicks } from '@/lib/world';
import { glassCard, useAppTheme } from '@/theme';

const SEEN_KEY = 'steppa:pet-intro-seen';
/** The panel shows the bottom of the yard: the pet and the ground it stands on. */
const SCENE_HEIGHT = 150;

function readSeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

function markSeen() {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {}
}

/**
 * Today card inviting someone without a pet to adopt one, with a baby pet already in its yard (each
 * person gets a different one) that you can tap to say hi. Shown until it's dismissed or they adopt;
 * Today only renders it while there's no pet.
 */
export function PetIntroCard({ profile }: { profile: Profile }) {
  const theme = useAppTheme();
  const { width } = useWindowDimensions();
  const [seen, setSeen] = useState(readSeen);
  const focused = useScreenFocused();
  const species = WORLDS.pet.slots.find((s) => s.id === 'species')?.choices ?? [];
  const pick: KindPicks = species.length ? { species: species[hashString(profile.id) % species.length]!.id } : {};
  const art = drawWorld('pet', 0, pick, timeOfDay());
  const play = usePetPlay(art.pet);

  if (seen) return null;

  function dismiss() {
    markSeen();
    setSeen(true);
  }

  function open() {
    dismiss();
    router.push('/pet');
  }

  // The screen's padding (16 a side) and the card's (8 a side).
  const sceneWidth = width - 48;

  return (
    <Card mode="contained" style={glassCard(theme)}>
      <View style={styles.scene}>
        <WorldScene art={art} width={sceneWidth} cropTo={SCENE_HEIGHT} animate={focused} play={play} radius={18} />
      </View>
      <Card.Content style={styles.text}>
        <Text variant="titleMedium">Adopt a pet</Text>
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
          A little buddy that grows up with every step you take. Pick a cat, a dog, a dragon, even a tiger, and unlock
          hats, toys and more as you walk.
        </Text>
      </Card.Content>
      <Card.Actions>
        <Button onPress={dismiss}>Not now</Button>
        <Button mode="contained" onPress={open}>
          Adopt
        </Button>
      </Card.Actions>
    </Card>
  );
}

const styles = StyleSheet.create({
  scene: { padding: 8, paddingBottom: 0 },
  text: { gap: 4, paddingTop: 12 },
});
