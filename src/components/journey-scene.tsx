import { useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from 'react-native-paper';
import { useReducedMotion } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { CharacterCanvas } from '@/components/character/character-canvas';
import type { Motion } from '@/components/character/rig';
import type { Profile } from '@/lib/api';
import { hashString, normalizeLook } from '@/lib/character';
import type { Stop } from '@/lib/journeys';
import { drawScene, SCENE_HEIGHT, SCENE_WIDTH, timeOfDay, type TimeOfDay } from '@/lib/scene-art';

const FPS = 30;
/** Postcard paper and ink, so the speech bubble matches the postcards. */
const INK = '#3A2F25';
const PAPER = '#FFFDF8';

type Props = {
  profile: Profile;
  stop: Stop;
  /** Said in a speech bubble over the character's head; no bubble without it. */
  greeting?: string;
  /** What the character does: a wave unless told otherwise (postcards pose for the photo). */
  motion?: Motion;
  /** The hour to draw; the phone's own unless told otherwise. */
  time?: TimeOfDay;
  /** Panel height; the character and their spacing scale with it. */
  height?: number;
  /** How tall the character stands, as a share of the height. */
  characterSize?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Your podium character in an illustration of a stop (a city, a forest, a beach...), waving by
 * default, at the time of day it is for you, with an optional speech bubble. The scene's bottom
 * edge is kept when it's cropped, so the character's feet stay on the ground whatever the width.
 */
export function JourneyScene({
  profile,
  stop,
  greeting,
  motion = 'wave',
  time: timeOverride,
  height = 200,
  characterSize = 0.54,
  style,
}: Props) {
  const reduceMotion = useReducedMotion();
  const look = useMemo(() => normalizeLook(profile.podium_character, profile.id), [profile.podium_character, profile.id]);
  const seed = (hashString(profile.id) % 1000) / 1000;
  const time = timeOverride ?? timeOfDay();
  const art = useMemo(() => drawScene(stop.scene, time, stop.name), [stop.scene, stop.name, time]);
  // At the full 200: a 108-tall character standing 18 up, with the bubble 14 from the top.
  const characterHeight = Math.round(height * characterSize);

  return (
    <View
      style={[
        styles.scene,
        { height, experimental_backgroundImage: `linear-gradient(180deg, ${art.sky[0]} 0%, ${art.sky[1]} 100%)` },
        style,
      ]}
      accessible={!!greeting}
      accessibilityLabel={greeting ? `Your character waving. ${greeting}` : undefined}>
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
      <View
        style={[styles.character, { marginLeft: -characterHeight, bottom: Math.round(height * 0.09) }]}
        pointerEvents="none">
        <CharacterCanvas
          look={look}
          seed={seed}
          width={characterHeight * 2}
          motion={motion}
          animate={!reduceMotion}
          fps={FPS}
        />
      </View>
      {/* Over the character's head, in the open sky on that side. */}
      {greeting ? (
        <View style={[styles.bubble, { top: Math.round(height * 0.07) }]} pointerEvents="none">
          <View style={styles.tail} />
          <Text variant="labelLarge" numberOfLines={2} style={styles.bubbleText}>
            {greeting}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  scene: { borderRadius: 20, overflow: 'hidden' },
  character: { position: 'absolute', left: '30%' },
  bubble: {
    position: 'absolute',
    left: '30%',
    marginLeft: -34,
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
