import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Card, Text } from 'react-native-paper';

import { usePetPlay } from '@/components/pet-play';
import { StageBadge } from '@/components/world-parts';
import { WorldScene } from '@/components/world-scene';
import { useScreenFocused } from '@/hooks/use-screen-focused';
import type { WorldStatus } from '@/lib/api';
import { formatSteps } from '@/lib/dates';
import { timeOfDay } from '@/lib/scene-art';
import { drawWorld, levelOf, WORLDS } from '@/lib/world';
import { glassCard, useAppTheme } from '@/theme';

/**
 * Someone's pet on their profile: its name, how grown it is and the steps behind it, in its yard.
 * You can tap it and hold it to play, the same as your own. `owner` is null for your own pet.
 */
export function PetProfileCard({ status, owner }: { status: WorldStatus; owner: string | null }) {
  const theme = useAppTheme();
  const { width } = useWindowDimensions();
  const focused = useScreenFocused();
  const { world, steps } = status;
  const def = WORLDS[world.kind];
  const saved = world.picks[world.kind];
  const art = drawWorld(world.kind, steps, saved, timeOfDay());
  const play = usePetPlay(art.pet);
  const name = saved?.name;

  // The screen's padding (16 a side) and the card's (8 a side).
  const sceneWidth = width - 48;

  return (
    <Card mode="contained" style={glassCard(theme)}>
      <Card.Content style={styles.text}>
        <Text variant="titleMedium" numberOfLines={1} style={styles.bold}>
          {[name, owner ? `${owner}'s pet` : name ? 'your pet' : 'Your pet'].filter(Boolean).join(', ')}
        </Text>
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
          {formatSteps(steps)} steps walked together
        </Text>
      </Card.Content>
      <View style={styles.scene}>
        <WorldScene art={art} width={sceneWidth} animate={focused} play={play} radius={18} />
        <StageBadge def={def} level={levelOf(steps)} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  text: { gap: 2, paddingTop: 14, paddingBottom: 10 },
  bold: { fontWeight: '700' },
  scene: { margin: 8, marginTop: 0 },
});
