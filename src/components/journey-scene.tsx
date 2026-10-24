import { useMemo, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from 'react-native-paper';
import { useReducedMotion } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { CharacterCanvas } from '@/components/character/character-canvas';
import type { Motion } from '@/components/character/rig';
import { hashString, normalizeLook, type CharacterLook } from '@/lib/character';
import { arrange, groundRise, type CrowdSpot } from '@/lib/crowd';
import type { Stop } from '@/lib/journeys';
import { drawScene, SCENE_HEIGHT, SCENE_WIDTH, timeOfDay, type TimeOfDay } from '@/lib/scene-art';

const FPS = 30;
/** Postcard paper and ink, so the speech bubble matches the postcards. */
const INK = '#3A2F25';
const PAPER = '#FFFDF8';

/** Someone in the scene: anyone with an id and a saved character (a profile or a leaderboard row). */
export type Person = { id: string; podium_character?: CharacterLook | null };

type Props = {
  /** One person stands on their own on the left; more make a group photo. */
  people: Person[];
  /** Who stands front and centre in a group, and is the only one animating (the rest hold still). */
  you?: string;
  stop: Stop;
  /** Said in a speech bubble over the character's head; no bubble without it. */
  greeting?: string;
  /** What everyone does, or what each does by their place in `people`: a wave unless told otherwise. */
  motion?: Motion | ((index: number) => Motion);
  /** The hour to draw; the phone's own unless told otherwise. */
  time?: TimeOfDay;
  /** Panel height; the characters and their spacing scale with it. */
  height?: number;
  /** How tall a character stands on their own, as a share of the height (a group is a bit smaller). */
  characterSize?: number;
  /** False to hold everyone still, e.g. while the screen it's on is hidden. */
  animate?: boolean;
  style?: StyleProp<ViewStyle>;
};

type Spot = CrowdSpot<Person>;

/**
 * Characters in an illustration of a stop (a city, a forest, a beach...), waving by default, at the
 * time of day it is for you, with an optional speech bubble. One person stands in the left third;
 * a group stands together in up to three rows sized to the width (17 fit on a phone), with any
 * beyond that counted in a chip. The scene's bottom edge is kept when it's cropped, so feet stay on
 * the ground whatever the width.
 */
export function JourneyScene({
  people,
  you,
  stop,
  greeting,
  motion = 'wave',
  time: timeOverride,
  height = 200,
  characterSize = 0.54,
  animate = true,
  style,
}: Props) {
  const reduceMotion = useReducedMotion();
  const time = timeOverride ?? timeOfDay();
  const [width, setWidth] = useState(0);
  const motionFor = (index: number) => (typeof motion === 'function' ? motion(index) : motion);
  const ground = Math.round(height * 0.09);

  // One expression rather than reassigning: React Compiler makes destructured locals read-only.
  const { spots, hidden }: { spots: Spot[]; hidden: number } =
    people.length === 1
      ? // A percentage needs no measuring, so a lone character is in place on the first frame.
        {
          spots: [{ person: people[0]!, index: 0, x: null, bottom: ground, size: Math.round(height * characterSize) }],
          hidden: 0,
        }
      : width > 0
        ? arrange(people, you, width, height * characterSize * 0.78, ground)
        : { spots: [], hidden: 0 };
  // A group's back rows stand higher, so the ground rises to meet them.
  const rise = people.length > 1 ? groundRise(spots, width, height) : 0;
  // React Compiler memoizes this; a manual useMemo over values derived from the layout trips it up.
  const art = drawScene(stop.scene, time, stop.name, rise);

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={[
        styles.scene,
        { height, experimental_backgroundImage: `linear-gradient(180deg, ${art.sky[0]} 0%, ${art.sky[1]} 100%)` },
        style,
      ]}
      accessible={!!greeting}
      accessibilityLabel={greeting ? `${people.length > 1 ? 'Your group' : 'Your character'} waving. ${greeting}` : undefined}>
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${SCENE_WIDTH} ${SCENE_HEIGHT}`}
        preserveAspectRatio="xMidYMax slice"
        style={StyleSheet.absoluteFill}>
        {art.shapes.map((s, i) => (
          <Path key={i} d={s.d} fill={s.fill} opacity={s.opacity} transform={s.lift ? `translate(0 ${-s.lift})` : undefined} />
        ))}
      </Svg>
      {spots.map((spot) => (
        <Figure
          key={spot.person.id}
          spot={spot}
          group={people.length > 1}
          motion={motionFor(spot.index)}
          animate={animate && !reduceMotion && (people.length === 1 || spot.person.id === you)}
        />
      ))}
      {hidden > 0 ? (
        <View style={[styles.more, { bottom: ground }]}>
          <Text variant="labelMedium" style={styles.moreText}>
            +{hidden}
          </Text>
        </View>
      ) : null}
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

function Figure({ spot, group, motion, animate }: { spot: Spot; group: boolean; motion: Motion; animate: boolean }) {
  const { person, x, bottom, size } = spot;
  // Pets would crowd a group photo, so only someone on their own brings theirs.
  const look = useMemo(() => {
    const own = normalizeLook(person.podium_character, person.id);
    return group ? { ...own, pets: [] } : own;
  }, [person.podium_character, person.id, group]);
  const seed = (hashString(person.id) % 1000) / 1000;

  return (
    // Each canvas is twice as wide as the character (room for pets), centred on where they stand.
    <View
      style={[styles.character, x === null ? { left: '30%', marginLeft: -size } : { left: x - size }, { bottom }]}
      pointerEvents="none">
      <CharacterCanvas look={look} seed={seed} width={size * 2} motion={motion} animate={animate} fps={FPS} />
    </View>
  );
}

const styles = StyleSheet.create({
  scene: { borderRadius: 20, overflow: 'hidden' },
  character: { position: 'absolute' },
  more: {
    position: 'absolute',
    right: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  moreText: { color: '#FFFFFF', fontWeight: '700' },
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
