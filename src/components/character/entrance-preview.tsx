import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { Easing, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { Button } from '@/components/button';
import { CharacterCanvas } from '@/components/character/character-canvas';
import { ENTRANCE_POSE, ENTRANCE_SECONDS, type EntranceKind } from '@/components/character/entrance';
import { EntranceStage } from '@/components/character/entrance-stage';
import { ENTRANCES, LABELS, hashString, type CharacterLook } from '@/lib/character';

const WIDTH = 116;
const BLOCK = 44;

/** Every entrance, to cycle through while watching. */
const KINDS = ENTRANCES.filter((e): e is EntranceKind => e !== 'rise');

/** A small podium block where entrances play on demand: yours, or step through them all. */
export function EntrancePreview({ look, userId }: { look: CharacterLook; userId: string }) {
  const theme = useTheme();
  // Starts on your own entrance (or the first one); "Next" steps through the rest without changing yours.
  const [kind, setKind] = useState<EntranceKind>(look.entrance === 'rise' ? KINDS[0]! : look.entrance);
  const clock = useSharedValue(-1);
  const [run, setRun] = useState(0);
  const [phase, setPhase] = useState<'enter' | 'cheer'>('enter');
  const seed = (hashString(userId) % 1000) / 1000;
  const length = ENTRANCE_SECONDS[kind] * 1000;

  // Plays the entrance, then a few cheers, each time `run` or the entrance changes.
  useEffect(() => {
    clock.set(-1);
    clock.set(withDelay(250, withTiming(ENTRANCE_SECONDS[kind], { duration: length, easing: Easing.linear })));
    const timers = [setTimeout(() => setPhase('enter'), 0), setTimeout(() => setPhase('cheer'), 250 + length)];
    return () => timers.forEach(clearTimeout);
  }, [clock, kind, length, run]);

  return (
    <View style={styles.wrap}>
      <View style={[styles.stage, { backgroundColor: theme.colors.surfaceVariant }]}>
        <View style={styles.spot}>
          <View style={styles.above}>
            <EntranceStage kind={kind} clock={clock} width={WIDTH} ground={BLOCK} fx={phase === 'enter'}>
              <CharacterCanvas
                look={look}
                seed={seed}
                width={WIDTH}
                motion={phase === 'enter' ? ENTRANCE_POSE[kind] : 'cheer'}
                clock={phase === 'enter' ? clock : undefined}
              />
            </EntranceStage>
          </View>
          <View style={[styles.block, { backgroundColor: theme.colors.primaryContainer, height: BLOCK }]} />
        </View>
      </View>
      <Text variant="labelLarge">{LABELS[kind]}</Text>
      <View style={styles.buttons}>
        <Button mode="text" icon="replay" onPress={() => setRun((n) => n + 1)}>
          Replay
        </Button>
        <Button mode="text" icon="skip-next" onPress={() => setKind((k) => KINDS[(KINDS.indexOf(k) + 1) % KINDS.length]!)}>
          Next entrance
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 4, alignItems: 'center' },
  buttons: { flexDirection: 'row' },
  stage: {
    width: '100%',
    height: WIDTH * 1.6,
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  spot: { width: WIDTH, alignItems: 'center' },
  // Over the block, so a character in front of it isn't hidden by it.
  above: { zIndex: 2 },
  // The block sits under the character, which starts at its foot and ends on its top.
  block: { width: WIDTH * 0.8, borderTopLeftRadius: 12, borderTopRightRadius: 12, marginTop: -2, zIndex: 1 },
});
