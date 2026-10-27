import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Card, Modal, Portal, Text } from 'react-native-paper';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { Button } from '@/components/button';
import { PostcardFrame, PostcardThumb } from '@/components/postcard';
import { SectionHeader } from '@/components/section-header';
import type { Adventure } from '@/lib/api';
import { ADVENTURE_COST, PLACES, placeFor, type Place } from '@/lib/pet-adventures';
import { drawScene, SCENE_HEIGHT, SCENE_WIDTH, type TimeOfDay } from '@/lib/scene-art';
import { drawPetPhoto, levelOf, stageOf, type KindPicks } from '@/lib/world';
import { glassCard, useAppTheme } from '@/theme';

/** Where the pet stands in a journey scene: a third of the way in, where a character would. */
const PHOTO_X = 108;
const PHOTO_FEET = 182;
/** Its size in the photo at each stage: a little bigger as it grows, but always clear of the place's name. */
const PHOTO_SIZE = [0.64, 0.68, 0.71, 0.74, 0.78, 0.82];

/** Your pet standing in one of the journey routes' places, smiling for the photo. */
function PetPlaceScene({
  place,
  steps,
  picks,
  time,
  height,
}: {
  place: Place;
  steps: number;
  picks: KindPicks | undefined;
  time: TimeOfDay;
  height: number;
}) {
  const scene = drawScene(place.stop.scene, time, place.stop.name);
  const pet = drawPetPhoto(steps, picks, time, PHOTO_X, PHOTO_FEET, PHOTO_SIZE[stageOf(levelOf(steps))]!);
  return (
    <View
      style={{ height, experimental_backgroundImage: `linear-gradient(180deg, ${scene.sky[0]} 0%, ${scene.sky[1]} 100%)` }}
      accessible
      accessibilityLabel={`Your pet in ${place.stop.name}`}>
      {/* Like a journey scene, cropped at the sides so the ground stays at the bottom. */}
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${SCENE_WIDTH} ${SCENE_HEIGHT}`}
        preserveAspectRatio="xMidYMax slice"
        style={StyleSheet.absoluteFill}>
        {[...scene.shapes, ...pet].map((s, i) => (
          <Path key={i} d={s.d} fill={s.fill} opacity={s.opacity} />
        ))}
      </Svg>
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
};

/** A postcard your pet sent from an adventure: itself in the place, and the place's story on the back. */
function PetPostcard({ place, steps, picks, name, recipient, number, width }: PostcardProps) {
  return (
    <PostcardFrame
      stop={place.stop}
      flag={place.route.flag}
      caption={`${place.route.flag} ${name}'s adventure ${number}`}
      stamp={`NO. ${number}`}
      sign={`Love, ${name} 🐾`}
      address={[recipient, 'The yard', 'Home sweet home']}
      width={width}
      scene={(height, time) => <PetPlaceScene place={place} steps={steps} picks={picks} time={time} height={height} />}
    />
  );
}

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
      <Modal visible={!!open} onDismiss={onClose} contentContainerStyle={styles.modal}>
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

/**
 * Adventures: send your pet off with treats you've saved, and every postcard it has sent back,
 * newest first.
 */
export function AdventuresSection({
  name,
  available,
  adventures,
  busy,
  onGo,
  onOpen,
}: {
  name: string;
  /** Treats you have to spend. */
  available: number;
  adventures: Adventure[];
  busy: boolean;
  onGo: () => void;
  onOpen: (postcard: OpenPostcard) => void;
}) {
  const theme = useAppTheme();
  const muted = { color: theme.colors.onSurfaceVariant };
  const short = ADVENTURE_COST - available;
  const visited = new Set(adventures.map((a) => a.place)).size;
  // Places since removed from the app are skipped.
  const postcards = adventures.flatMap((a, i) => {
    const place = placeFor(a.place);
    return place ? [{ id: a.id, place, number: adventures.length - i }] : [];
  });

  return (
    <>
      <SectionHeader title="Adventures" note={`${visited} of ${PLACES.length} places`} />
      <Card mode="contained" style={glassCard(theme)}>
        <Card.Content style={styles.go}>
          <View style={styles.goText}>
            <Text variant="titleSmall" style={styles.bold}>
              Send {name} on an adventure
            </Text>
            <Text variant="bodySmall" style={muted}>
              {short > 0
                ? `${short} more ${short === 1 ? 'treat' : 'treats'} to go somewhere new`
                : `${ADVENTURE_COST} treats for a postcard from somewhere new`}
            </Text>
          </View>
          <Button mode="contained" compact disabled={short > 0 || busy} loading={busy} onPress={onGo}>
            Go
          </Button>
        </Card.Content>
      </Card>
      {postcards.length ? (
        <View style={styles.grid}>
          {postcards.map(({ id, place, number }, i) => (
            <PostcardThumb
              key={id}
              route={place.route}
              stop={place.stop}
              index={i}
              onPress={() => onOpen({ place, number, isNew: false })}
            />
          ))}
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  bold: { fontWeight: '700' },
  go: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  goText: { flex: 1, gap: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 14 },
  modal: { alignItems: 'center', gap: 16, padding: 16 },
  modalTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '800', textAlign: 'center' },
  hint: { color: 'rgba(255,255,255,0.75)', fontSize: 13 },
  modalActions: { alignSelf: 'stretch', alignItems: 'flex-end', maxWidth: 400, width: '100%', marginHorizontal: 'auto' },
});
