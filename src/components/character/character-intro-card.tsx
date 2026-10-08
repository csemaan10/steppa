import 'expo-sqlite/localStorage/install';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Text, useTheme } from 'react-native-paper';

import { CharacterCanvas } from '@/components/character/character-canvas';
import type { Profile } from '@/lib/api';
import { hashString, normalizeLook } from '@/lib/character';
import { surfaceCard } from '@/theme';

const SEEN_KEY = 'steppa:character-intro-seen';

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
 * One-time Today card announcing podium characters: shows once on each phone after the update,
 * until it's dismissed or opened.
 */
export function CharacterIntroCard({ profile }: { profile: Profile }) {
  const theme = useTheme();
  const [seen, setSeen] = useState(readSeen);
  const look = useMemo(() => normalizeLook(profile.podium_character, profile.id), [profile.podium_character, profile.id]);

  if (seen) return null;
  const seed = (hashString(profile.id) % 1000) / 1000;

  function dismiss() {
    markSeen();
    setSeen(true);
  }

  function customize() {
    dismiss();
    router.push({ pathname: '/settings', params: { focus: 'character' } });
  }

  return (
    <Card mode="contained" style={surfaceCard(theme)}>
      <Card.Content style={styles.row}>
        <CharacterCanvas look={look} seed={seed} width={112} />
        <View style={styles.text}>
          <Text variant="titleMedium">Meet your podium character</Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            Pick their hair, clothes, pets and podium move in Settings.
          </Text>
        </View>
      </Card.Content>
      <Card.Actions>
        <Button onPress={dismiss}>Not now</Button>
        <Button mode="contained" onPress={customize}>
          Customize
        </Button>
      </Card.Actions>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  text: { flex: 1, gap: 4 },
});
