import { useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Modal, Portal } from 'react-native-paper';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { Button } from '@/components/button';
import { SparkleBurst } from '@/components/game/game-fx';
import { PostcardFrame } from '@/components/postcard';
import type { Place } from '@/lib/pet-adventures';
import { drawScene, SCENE_HEIGHT, SCENE_WIDTH, type TimeOfDay } from '@/lib/scene-art';
import { drawPetPhoto, levelOf, stageOf, type KindPicks } from '@/lib/world';

/** Where the pet stands in a journey scene: a third of the way in, where a character would. */
const PHOTO_X = 108;
export const PHOTO_FEET = 182;
/** Its size in the photo at each stage: a little bigger as it grows, but always clear of the place's name. */
export const PHOTO_SIZE = [0.64, 0.68, 0.71, 0.74, 0.78, 0.82];

/** A new postcard's pet waits for the card to land, hops in, then celebrates. */
const ARRIVE_AT = 700;
const HOP_IN_MS = 1200;
const HOPS = 3;

/**
 * Your pet in one of the journey routes' places. On a new postcard it hops in from the left, lands
 * with a burst of sparkles and a happy jump; after that (and on postcards from the album) it bobs
 * gently on the spot, like it's pleased to be there.
 */
function PetPlaceScene({
  place,
  steps,
  picks,
  time,
  height,
  arriving,
}: {
  place: Place;
  steps: number;
  picks: KindPicks | undefined;
  time: TimeOfDay;
  height: number;
  arriving: boolean;
}) {
  const [width, setWidth] = useState(0);
  const scene = drawScene(place.stop.scene, time, place.stop.name);
  const pet = drawPetPhoto(steps, picks, time, PHOTO_X, PHOTO_FEET, PHOTO_SIZE[stageOf(levelOf(steps))]!);

  const hopIn = useSharedValue(arriving ? 0 : 1);
  const happy = useSharedValue(0);
  const bob = useSharedValue(0);
  const sway = useSharedValue(0);
  const skip = useSharedValue(0);
  useEffect(() => {
    if (arriving) {
      hopIn.set(withDelay(ARRIVE_AT, withTiming(1, { duration: HOP_IN_MS, easing: Easing.linear })));
      happy.set(
        withDelay(
          ARRIVE_AT + HOP_IN_MS + 150,
          withSequence(
            withTiming(1, { duration: 200, easing: Easing.out(Easing.quad) }),
            withTiming(0, { duration: 240, easing: Easing.in(Easing.quad) })
          )
        )
      );
    }
    // Then it stays lively: bobbing, swaying on its feet, and a happy little hop every few seconds.
    const settled = arriving ? ARRIVE_AT + HOP_IN_MS + 700 : 0;
    bob.set(withDelay(settled, withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }), -1, true)));
    sway.set(withDelay(settled, withRepeat(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin) }), -1, true)));
    skip.set(
      withDelay(
        settled + 900,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 180, easing: Easing.out(Easing.quad) }),
            withTiming(0, { duration: 220, easing: Easing.in(Easing.quad) }),
            withDelay(2400, withTiming(0, { duration: 0 }))
          ),
          -1
        )
      )
    );
  }, [arriving, hopIn, happy, bob, sway, skip]);

  // Where the pet stands, through the same cover-and-crop as the picture: sparkles go off at its
  // middle, and it sways and squashes about its feet.
  const fit = Math.max(width / SCENE_WIDTH, height / SCENE_HEIGHT);
  const landX = (width - SCENE_WIDTH * fit) / 2 + PHOTO_X * fit;
  const feetY = height - SCENE_HEIGHT * fit + PHOTO_FEET * fit;
  const landY = feetY - 40 * fit;

  const moving = useAnimatedStyle(() => {
    const p = hopIn.value;
    const along = 1 - (1 - p) * (1 - p);
    const hop = p < 1 ? Math.abs(Math.sin(p * Math.PI * HOPS)) * height * 0.1 : 0;
    return {
      transform: [
        { translateX: -(1 - along) * width * 0.75 },
        { translateY: -hop - happy.value * height * 0.14 - skip.value * height * 0.06 - bob.value * 4 },
        { rotate: `${(sway.value * 2 - 1) * 3}deg` },
        { scaleY: 1 + bob.value * 0.03 },
      ],
    };
  });

  const picture = (shapes: typeof pet) => (
    <Svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${SCENE_WIDTH} ${SCENE_HEIGHT}`}
      preserveAspectRatio="xMidYMax slice"
      style={StyleSheet.absoluteFill}>
      {shapes.map((s, i) => (
        <Path key={i} d={s.d} fill={s.fill} opacity={s.opacity} />
      ))}
    </Svg>
  );

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ height, experimental_backgroundImage: `linear-gradient(180deg, ${scene.sky[0]} 0%, ${scene.sky[1]} 100%)` }}
      accessible
      accessibilityLabel={`Your pet in ${place.stop.name}`}>
      {/* Like a journey scene, cropped at the sides so the ground stays at the bottom. */}
      {picture(scene.shapes)}
      <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: [landX, feetY, 0] }, moving]}>
        {picture(pet)}
      </Animated.View>
      {arriving && width ? (
        <View pointerEvents="none" style={[styles.landing, { left: landX, top: landY }]}>
          <SparkleBurst count={10} radius={height * 0.22} delay={ARRIVE_AT + HOP_IN_MS} />
        </View>
      ) : null}
    </View>
  );
}

type PostcardProps = {
  place: Place;
  /** The pet's steps and choices, so it looks the way it does at home. */
  steps: number;
  picks: KindPicks | undefined;
  /** "Mochi", or "Your pet". */
  name: string;
  /** Who it's addressed to: you. */
  recipient: string;
  /** Which adventure this was, counting from 1. */
  number: number;
  width: number;
  /** Just arrived: the pet hops into the picture. */
  arriving: boolean;
};

/** A postcard your pet sent from an adventure: itself in the place, and the place's story on the back. */
function PetPostcard({ place, steps, picks, name, recipient, number, width, arriving }: PostcardProps) {
  return (
    <PostcardFrame
      stop={place.stop}
      flag={place.route.flag}
      caption={`${name}'s adventure ${number}`}
      stamp={`NO. ${number}`}
      sign={`Love, ${name} 🐾`}
      address={[recipient, 'The yard', 'Home sweet home']}
      width={width}
      scene={(height, time) => (
        <PetPlaceScene place={place} steps={steps} picks={picks} time={time} height={height} arriving={arriving} />
      )}
    />
  );
}

const BACKDROP_THEME = { colors: { backdrop: 'rgba(10, 12, 22, 0.92)' } };

/** The postcard in focus: a new one just in, or one from the album. */
export type OpenPostcard = { place: Place; number: number; isNew: boolean };

export function PetPostcardModal({
  open,
  steps,
  picks,
  name,
  recipient,
  onClose,
}: {
  open: OpenPostcard | null;
  steps: number;
  picks: KindPicks | undefined;
  name: string;
  recipient: string;
  onClose: () => void;
}) {
  const { width } = useWindowDimensions();
  return (
    <Portal>
      {/* The same deep backdrop as the trip that leads here, so the postcard reads as part of it. */}
      <Modal visible={!!open} onDismiss={onClose} contentContainerStyle={styles.modal} theme={BACKDROP_THEME}>
        {open ? (
          <>
            <Animated.Text key={`title-${open.place.key}`} entering={FadeInDown.duration(300)} style={styles.modalTitle}>
              {open.isNew ? `${name} sent a postcard!` : `${name} in ${open.place.stop.name}`}
            </Animated.Text>
            <PetPostcard
              key={`card-${open.place.key}-${open.number}`}
              place={open.place}
              steps={steps}
              picks={picks}
              name={name}
              recipient={recipient}
              number={open.number}
              width={Math.min(width - 32, 400)}
              arriving={open.isNew}
            />
            <Animated.Text entering={FadeIn.delay(1400)} style={styles.hint}>
              Tap the postcard to turn it over
            </Animated.Text>
            <View style={styles.modalActions}>
              <Button mode="contained" onPress={onClose}>
                Done
              </Button>
            </View>
          </>
        ) : null}
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  landing: { position: 'absolute', width: 0, height: 0 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 14 },
  modal: { alignItems: 'center', gap: 16, padding: 16 },
  modalTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '800', textAlign: 'center' },
  hint: { color: 'rgba(255,255,255,0.75)', fontSize: 13 },
  modalActions: { alignSelf: 'stretch', alignItems: 'flex-end', maxWidth: 400, width: '100%', marginHorizontal: 'auto' },
});
