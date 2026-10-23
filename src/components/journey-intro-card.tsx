import 'expo-sqlite/localStorage/install';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Text } from 'react-native-paper';

import { Button } from '@/components/button';
import { JourneyScene } from '@/components/journey-scene';
import type { Profile } from '@/lib/api';
import { hashString } from '@/lib/character';
import { ROUTES } from '@/lib/journeys';
import { glassCard, useAppTheme } from '@/theme';

const SEEN_KEY = 'steppa:journey-intro-seen';

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
 * Today card inviting someone who hasn't started a journey to try one, with their character waving
 * from the start of a route (each person gets one: Toronto, Venice, the Pyrenees or Hadrian's Wall).
 * Shown until it's dismissed or opened; Today only renders it while there's no journey.
 */
export function JourneyIntroCard({ profile }: { profile: Profile }) {
  const theme = useAppTheme();
  const [seen, setSeen] = useState(readSeen);

  if (seen) return null;
  const route = ROUTES[hashString(profile.id) % ROUTES.length]!;

  function dismiss() {
    markSeen();
    setSeen(true);
  }

  function open() {
    dismiss();
    router.push('/journey');
  }

  return (
    <Card mode="contained" style={glassCard(theme)}>
      <View style={styles.scene}>
        <JourneyScene profile={profile} stop={route.stops[0]!} greeting="Let's go on a journey!" height={140} />
      </View>
      <Card.Content style={styles.text}>
        <Text variant="titleMedium">Go on a journey</Text>
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
          Walk a real route like Hadrian&apos;s Wall or the Camino with your daily steps, and collect a postcard
          at every stop.
        </Text>
      </Card.Content>
      <Card.Actions>
        <Button onPress={dismiss}>Not now</Button>
        <Button mode="contained" onPress={open}>
          Choose a route
        </Button>
      </Card.Actions>
    </Card>
  );
}

const styles = StyleSheet.create({
  scene: { padding: 8, paddingBottom: 0 },
  text: { gap: 4, paddingTop: 12 },
});
