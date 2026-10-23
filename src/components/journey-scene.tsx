import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useReducedMotion } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { CharacterCanvas } from '@/components/character/character-canvas';
import type { Profile } from '@/lib/api';
import { hashString, normalizeLook } from '@/lib/character';
import type { Stop } from '@/lib/journeys';
import { drawScene, SCENE_HEIGHT, SCENE_WIDTH, timeOfDay } from '@/lib/scene-art';

const HEIGHT = 200;
/** How tall the character stands. Its canvas is twice as wide, leaving room for pets either side. */
const CHARACTER_HEIGHT = 108;
const FPS = 30;
/** Postcard paper and ink, so the speech bubble matches the postcards. */
const INK = '#3A2F25';
const PAPER = '#FFFDF8';

type Props = { profile: Profile; stop: Stop; greeting: string };

/**
 * Your podium character waving from the stop you've reached, in an illustration of that place (a
 * city, a forest, a beach...) at the time of day it is for you, with a speech bubble saying where
 * they are. The scene's bottom edge is kept when it's cropped, so the character's feet stay on the
 * ground whatever the screen width.
 */
export function JourneyScene({ profile, stop, greeting }: Props) {
  const reduceMotion = useReducedMotion();
  const look = useMemo(() => normalizeLook(profile.podium_character, profile.id), [profile.podium_character, profile.id]);
  const seed = (hashString(profile.id) % 1000) / 1000;
  const time = timeOfDay();
  const art = useMemo(() => drawScene(stop.scene, time, stop.name), [stop.scene, stop.name, time]);

  return (
    <View
      style={[styles.scene, { experimental_backgroundImage: `linear-gradient(180deg, ${art.sky[0]} 0%, ${art.sky[1]} 100%)` }]}
      accessible
      accessibilityLabel={`Your character waving. ${greeting}`}>
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${SCENE_WIDTH} ${SCENE_HEIGHT}`}
        preserveAspectRatio="xMidYMax slice"
        style={StyleSheet.absoluteFill}>
        {art.shapes.map((s, i) => (
          <Path key={i} d={s.d} fill={s.fill} opacity={s.opacity} />
        ))}
      </Svg>
      {/* On the ground in the left third, which every scene keeps clear. */}
      <View style={styles.character} pointerEvents="none">
        <CharacterCanvas
          look={look}
          seed={seed}
          width={CHARACTER_HEIGHT * 2}
          motion="wave"
          animate={!reduceMotion}
          fps={FPS}
        />
      </View>
      {/* Over the character's head, in the open sky on that side. */}
      <View style={styles.bubble} pointerEvents="none">
        <View style={styles.tail} />
        <Text variant="labelLarge" numberOfLines={2} style={styles.bubbleText}>
          {greeting}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scene: { height: HEIGHT, borderRadius: 20, overflow: 'hidden' },
  character: {
    position: 'absolute',
    left: '30%',
    marginLeft: -CHARACTER_HEIGHT,
    bottom: 18,
  },
  bubble: {
    position: 'absolute',
    left: '30%',
    marginLeft: -34,
    top: 14,
    maxWidth: 180,
    backgroundColor: PAPER,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  bubbleText: { color: INK, fontWeight: '700' },
  // A corner pointing down at the character's head; drawn first, so the text sits over it.
  tail: {
    position: 'absolute',
    left: 29,
    bottom: -5,
    width: 10,
    height: 10,
    backgroundColor: PAPER,
    transform: [{ rotate: '45deg' }],
  },
});
