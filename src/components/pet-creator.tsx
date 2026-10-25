import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Text, TextInput } from 'react-native-paper';

import { Button } from '@/components/button';
import { usePetPlay } from '@/components/pet-play';
import { ChoiceChips } from '@/components/world-parts';
import { WorldScene } from '@/components/world-scene';
import { timeOfDay } from '@/lib/scene-art';
import { drawWorld, NAME_LENGTH, resolvePicks, WORLDS, type KindPicks } from '@/lib/world';
import { glassCard, useAppTheme } from '@/theme';

/**
 * Adopting a pet: the baby pet in its yard, changing as you pick its species, colour and pattern
 * (everything that's yours from the start), and a name. It's playable already, so you can say hi.
 */
export function PetCreator({
  sceneWidth,
  animate,
  busy,
  onAdopt,
}: {
  sceneWidth: number;
  animate: boolean;
  busy: boolean;
  onAdopt: (picks: KindPicks) => void;
}) {
  const theme = useAppTheme();
  const def = WORLDS.pet;
  const starters = def.slots.filter((s) => s.level === 0);
  const [chosen, setChosen] = useState<KindPicks>({});
  const [name, setName] = useState('');
  const picks = resolvePicks(def, 0, chosen);
  const art = drawWorld('pet', 0, picks, timeOfDay());
  const play = usePetPlay(art.pet);
  const trimmed = name.trim();

  return (
    <>
      <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant }}>
        Adopt a pet that grows with every step you take from today. Reach milestones to watch it grow up and unlock
        hats, toys and more.
      </Text>
      <View style={styles.scene}>
        <WorldScene
          art={art}
          width={sceneWidth}
          animate={animate}
          version={JSON.stringify(picks)}
          play={play}
          radius={24}
        />
      </View>
      <Text variant="labelMedium" style={[styles.hint, { color: theme.colors.onSurfaceVariant }]}>
        Tap your pet to say hi
      </Text>

      <Card mode="contained" style={glassCard(theme)}>
        <Card.Content style={styles.slots}>
          {starters.map((slot) => (
            <View key={slot.id} style={styles.slot}>
              <Text variant="titleSmall" style={styles.bold}>
                {slot.title}
              </Text>
              <ChoiceChips
                slot={slot}
                level={0}
                selected={picks[slot.id]}
                onPick={(choice) => setChosen({ ...chosen, [slot.id]: choice })}
              />
            </View>
          ))}
          <TextInput
            mode="outlined"
            label="Name"
            placeholder="Mochi, Biscuit, Nugget..."
            value={name}
            onChangeText={setName}
            maxLength={NAME_LENGTH}
            returnKeyType="done"
            style={styles.name}
          />
        </Card.Content>
      </Card>

      <Button
        mode="contained"
        icon="paw"
        loading={busy}
        disabled={busy}
        onPress={() => onAdopt(trimmed ? { ...picks, name: trimmed } : picks)}
        style={styles.adopt}>
        {trimmed ? `Adopt ${trimmed}` : 'Adopt'}
      </Button>
    </>
  );
}

const styles = StyleSheet.create({
  scene: { alignSelf: 'center' },
  hint: { textAlign: 'center', marginTop: -4 },
  slots: { gap: 18 },
  slot: { gap: 8 },
  bold: { fontWeight: '700' },
  name: { backgroundColor: 'transparent' },
  adopt: { alignSelf: 'center', minWidth: 180 },
});
