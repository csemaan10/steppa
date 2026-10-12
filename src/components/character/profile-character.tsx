import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from 'react-native-paper';
import { Easing, useReducedMotion, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';

import { CharacterCanvas } from '@/components/character/character-canvas';
import { ENTRANCE_POSE, ENTRANCE_SECONDS } from '@/components/character/entrance';
import { EntranceStage } from '@/components/character/entrance-stage';
import { CHEER_HOP } from '@/components/character/rig';
import type { Profile } from '@/lib/api';
import { hashString, normalizeLook } from '@/lib/character';
import { surfaceCard } from '@/theme';

/** Big enough to fill the card on any phone (the character's body is the middle of this stage). */
const WIDTH = 240;
const BLOCK = 56;
/** Waits for the screen to finish sliding in before the entrance starts. */
const START_MS = 350;
/** How long they cheer after their entrance (or a tap), before going back to their own move. */
const CHEER_MS = CHEER_HOP * 4 * 1000;

/** A player's character on a small block: makes their entrance on open, and again on a tap. */
export function ProfileCharacter({ profile }: { profile: Profile }) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const look = useMemo(() => normalizeLook(profile.podium_character, profile.id), [profile.podium_character, profile.id]);
  const seed = (hashString(profile.id) % 1000) / 1000;
  // The chosen way of getting up onto the block (null: they're simply standing on it).
  const entrance = look.entrance !== 'rise' && !reduceMotion ? look.entrance : null;
  // Seconds into the entrance; negative until it starts (the character isn't shown yet).
  const clock = useSharedValue(-1);
  const [phase, setPhase] = useState<'enter' | 'cheer' | null>(entrance ? 'enter' : null);
  const [run, setRun] = useState(0);

  // The entrance on open and on each tap, then a few cheers. Without one, a tap just cheers.
  useEffect(() => {
    if (!entrance) {
      if (run === 0 || reduceMotion) return;
      const timers = [setTimeout(() => setPhase('cheer'), 0), setTimeout(() => setPhase(null), CHEER_MS)];
      return () => timers.forEach(clearTimeout);
    }
    const length = ENTRANCE_SECONDS[entrance] * 1000;
    clock.set(-1);
    clock.set(
      withDelay(
        START_MS,
        withSequence(
          withTiming(0, { duration: 1 }),
          withTiming(ENTRANCE_SECONDS[entrance], { duration: length, easing: Easing.linear })
        )
      )
    );
    const timers = [
      // Into the entrance pose while still hidden, so their idle pose (and pets) never flashes up.
      setTimeout(() => setPhase('enter'), 0),
      setTimeout(() => setPhase('cheer'), START_MS + length),
      setTimeout(() => setPhase(null), START_MS + length + CHEER_MS),
    ];
    return () => {
      timers.forEach(clearTimeout);
      // Interrupted by a tap: stand on the block rather than freeze mid-air.
      clock.set(ENTRANCE_SECONDS[entrance]);
      setPhase(null);
    };
  }, [clock, entrance, reduceMotion, run]);

  const canvas = (
    <CharacterCanvas
      look={look}
      seed={seed}
      width={WIDTH}
      motion={phase === 'enter' && entrance ? ENTRANCE_POSE[entrance] : phase === 'cheer' ? 'cheer' : undefined}
      clock={phase === 'enter' ? clock : undefined}
    />
  );

  return (
    <Pressable
      onPress={() => setRun((n) => n + 1)}
      style={[styles.stage, surfaceCard(theme)]}
      accessibilityRole="button"
      accessibilityLabel={`${profile.display_name}'s podium character`}
      accessibilityHint={entrance ? 'Replays their entrance' : 'Makes them cheer'}>
      <View style={styles.spot}>
        <View style={styles.above}>
          {entrance ? (
            <EntranceStage kind={entrance} clock={clock} width={WIDTH} ground={BLOCK} fx={phase === 'enter'}>
              {canvas}
            </EntranceStage>
          ) : (
            canvas
          )}
        </View>
        <View style={[styles.block, { backgroundColor: theme.colors.primaryContainer }]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Snug round the character; jumps and effects that go higher are clipped at the top.
  stage: {
    height: 180,
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  spot: { width: WIDTH, alignItems: 'center' },
  // Over the block, so a character in front of it isn't hidden by it.
  above: { zIndex: 2 },
  // The block sits under the character, which starts at its foot and ends on its top.
  block: {
    width: WIDTH * 0.8,
    height: BLOCK,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    marginTop: -2,
    zIndex: 1,
  },
});
