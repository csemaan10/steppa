import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Modal, Portal, Text } from 'react-native-paper';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { Button } from '@/components/button';
import type { Motion } from '@/components/character/rig';
import { JourneyScene, type Person } from '@/components/journey-scene';
import { hashString } from '@/lib/character';
import { formatKm, SKIES, type Route, type Sky, type Stop } from '@/lib/journeys';
import type { TimeOfDay } from '@/lib/scene-art';
import { useAppTheme, withAlpha } from '@/theme';

/** Postcards are 25:16, like the real thing. */
const ASPECT = 0.64;
const PAPER = '#FFFDF8';
/** The paper border round the picture side. */
const ART_INSET = 6;
const BACK_PAPER = '#FBF6EA';
const INK = '#3A2F25';
const SERIF = Platform.select({ ios: 'Georgia', default: 'serif' });

/** Each postcard keeps the hour its sky colours suggest, so a set of them isn't all midday. */
const POSTCARD_TIME: Record<Sky, TimeOfDay> = {
  dawn: 'dawn',
  noon: 'day',
  lake: 'day',
  dusk: 'dusk',
  forest: 'day',
  gold: 'dawn',
  night: 'night',
  sea: 'day',
  stone: 'day',
  maple: 'dusk',
};

const POSES: Motion[] = ['p-peace', 'p-salute', 'p-crossed', 'p-hips', 'flex'];

/**
 * The pose for a stop's photo: everyone cheers at the finish; otherwise the next pose along the
 * route, so neighbouring postcards differ, and in a group photo each person strikes a different one.
 */
function postcardPose(route: Route, stop: Stop, person: number): Motion {
  const index = route.stops.indexOf(stop);
  if (index === route.stops.length - 1) return 'cheer';
  return POSES[(index + person + hashString(route.key)) % POSES.length]!;
}

function sky(stop: Stop): string {
  const [top, bottom] = SKIES[stop.sky];
  return `linear-gradient(180deg, ${top} 0%, ${bottom} 100%)`;
}

/** The picture side: gradient sky, sun, rolling hills and the stop's emoji standing in the sun. */
function PostcardArt({ stop, emojiSize }: { stop: Stop; emojiSize: number }) {
  return (
    <View style={[StyleSheet.absoluteFill, { experimental_backgroundImage: sky(stop) }]}>
      <Svg width="100%" height="100%" viewBox="0 0 300 192" preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
        <Circle cx={218} cy={92} r={46} fill="rgba(255,255,255,0.16)" />
        <Circle cx={218} cy={92} r={32} fill="rgba(255,255,255,0.2)" />
        <Path d="M0 138 C 50 112, 110 128, 165 118 S 255 100, 300 120 L 300 192 L 0 192 Z" fill="rgba(255,255,255,0.16)" />
        <Path d="M0 166 C 70 144, 130 162, 200 152 S 270 144, 300 158 L 300 192 L 0 192 Z" fill="rgba(0,0,0,0.12)" />
      </Svg>
      {/* Centred on the sun. */}
      <View
        style={[
          styles.emojiSpot,
          { width: emojiSize * 1.4, height: emojiSize * 1.4, marginLeft: -emojiSize * 0.7, marginTop: -emojiSize * 0.7 },
        ]}>
        <Text style={{ fontSize: emojiSize, lineHeight: emojiSize * 1.2 }}>{stop.emoji}</Text>
      </View>
    </View>
  );
}

/** Perforated stamp with the route's flag and how far along the stop is. */
function Stamp({ route, stop }: { route: Route; stop: Stop }) {
  return (
    <View style={styles.stamp}>
      <View style={[styles.stampInner, { experimental_backgroundImage: sky(stop) }]}>
        <Text style={styles.stampFlag}>{route.flag}</Text>
        <Text style={styles.stampKm}>{formatKm(stop.km)} KM</Text>
      </View>
    </View>
  );
}

/** Round cancellation mark with wavy lines trailing to the left; it inks over the stamp's corner. */
function Postmark({ ink }: { ink: string }) {
  return (
    <Svg width={112} height={64}>
      {[18, 28].map((y) => (
        <Path key={y} d={`M2 ${y} q 7 -5 14 0 t 14 0 t 14 0 t 14 0`} stroke={ink} strokeWidth={1.6} fill="none" />
      ))}
      <Circle cx={84} cy={32} r={26} stroke={ink} strokeWidth={1.6} fill="none" />
      <Circle cx={84} cy={32} r={20} stroke={ink} strokeWidth={0.8} strokeDasharray="2 3" fill="none" />
    </Svg>
  );
}

type PostcardProps = {
  route: Route;
  stop: Stop;
  /** Posing on the front: you on your own, or the whole group. */
  people: Person[];
  /** Front and centre in a group photo. */
  you?: string;
  /** The name in the address block on the back: yours, or the group's. */
  recipient: string;
  width: number;
};

/**
 * A full postcard: the stop's illustrated place with you (or your group) posing for the photo. It
 * lands with a little tilt, the stamp thunks down, the postmark inks in, and a tap flips it over
 * to read the back.
 */
export function Postcard({ route, stop, people, you, recipient, width }: PostcardProps) {
  const height = Math.round(width * ASPECT);
  const index = route.stops.indexOf(stop);
  const start = route.stops[0]!;
  const [flipped, setFlipped] = useState(false);
  const enter = useSharedValue(0);
  const stamp = useSharedValue(0);
  const postmark = useSharedValue(0);
  const flip = useSharedValue(0);

  useEffect(() => {
    enter.set(withSpring(1, { damping: 13, stiffness: 110, mass: 0.9 }));
    stamp.set(withDelay(550, withSpring(1, { damping: 8, stiffness: 200 })));
    postmark.set(withDelay(900, withTiming(1, { duration: 280, easing: Easing.out(Easing.quad) })));
  }, [enter, stamp, postmark]);

  function turnOver() {
    setFlipped(!flipped);
    flip.set(withTiming(flipped ? 0 : 1, { duration: 650, easing: Easing.inOut(Easing.cubic) }));
  }

  const cardStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, enter.value * 2.5),
    transform: [
      { translateY: (1 - enter.value) * -140 },
      { rotate: `${-12 + enter.value * 10}deg` },
      { scale: (0.85 + 0.15 * enter.value) * (1 + 0.06 * Math.sin(Math.PI * flip.value)) },
    ],
  }));
  // Each face hides once it's turned past edge-on, so it works without backface culling.
  const frontStyle = useAnimatedStyle(() => ({
    opacity: flip.value < 0.5 ? 1 : 0,
    transform: [{ perspective: 1200 }, { rotateY: `${flip.value * 180}deg` }],
  }));
  const backStyle = useAnimatedStyle(() => ({
    opacity: flip.value >= 0.5 ? 1 : 0,
    transform: [{ perspective: 1200 }, { rotateY: `${flip.value * 180 - 180}deg` }],
  }));
  const stampStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, stamp.value * 4),
    transform: [{ scale: 2 - stamp.value }, { rotate: `${4 + (1 - stamp.value) * 20}deg` }],
  }));
  const postmarkStyle = useAnimatedStyle(() => ({
    opacity: postmark.value * 0.9,
    transform: [{ scale: 1.25 - 0.25 * postmark.value }, { rotate: '-14deg' }],
  }));

  return (
    <Animated.View style={[{ width, height }, cardStyle]}>
      <Pressable
        onPress={turnOver}
        accessibilityRole="button"
        accessibilityLabel={`Postcard from ${stop.name}. ${flipped ? stop.fact : 'Tap to turn it over.'}`}
        style={StyleSheet.absoluteFill}>
        <Animated.View style={[styles.face, styles.front, frontStyle]}>
          <View style={styles.art}>
            {/* Smaller than on the journey screen, so a two-line place name stays clear of their head. */}
            <JourneyScene
              people={people}
              you={you}
              stop={stop}
              motion={(person) => postcardPose(route, stop, person)}
              time={POSTCARD_TIME[stop.sky]}
              height={height - ART_INSET * 2}
              characterSize={0.44}
              style={styles.scene}
            />
            <View style={styles.greeting}>
              <Text style={styles.greetingSmall}>GREETINGS FROM</Text>
              <Text
                numberOfLines={2}
                adjustsFontSizeToFit
                style={[styles.place, { fontSize: width * 0.085, lineHeight: width * 0.095 }]}>
                {stop.name}
              </Text>
            </View>
            <View style={styles.caption}>
              <Text style={styles.captionText}>
                {route.flag} {route.name} · Stop {index + 1} of {route.stops.length}
              </Text>
            </View>
          </View>
          <Animated.View style={[styles.stampSpot, stampStyle]}>
            <Stamp route={route} stop={stop} />
          </Animated.View>
          <Animated.View style={[styles.postmarkSpot, postmarkStyle]}>
            <Postmark ink="rgba(255,255,255,0.8)" />
          </Animated.View>
        </Animated.View>

        <Animated.View style={[styles.face, styles.back, backStyle]}>
          <View style={styles.backLeft}>
            <Text style={[styles.backTitle, { fontSize: width * 0.044 }]}>Greetings from {stop.name}!</Text>
            <Text style={[styles.backBody, { fontSize: width * 0.035, lineHeight: width * 0.05 }]}>{stop.fact}</Text>
            <Text style={[styles.backSign, { fontSize: width * 0.035 }]}>Keep walking 👟</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.backRight}>
            <View style={styles.backStamp}>
              <Stamp route={route} stop={stop} />
            </View>
            <View style={styles.address}>
              {[
                recipient,
                route.subtitle,
                stop.km > 0 ? `${formatKm(stop.km)} km from ${start.name}` : 'Day 1. Here we go!',
              ].map((line) => (
                <Text key={line} numberOfLines={1} style={[styles.addressLine, { fontSize: width * 0.033 }]}>
                  {line}
                </Text>
              ))}
            </View>
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

type ThumbProps = {
  route: Route;
  stop: Stop;
  /** Kilometres still to go; set while the postcard is locked. */
  kmAway?: number;
  index: number;
  onPress?: () => void;
};

/** A postcard in the collection: the picture side once reached, a sealed envelope until then. */
export function PostcardThumb({ stop, kmAway, index, onPress }: ThumbProps) {
  const theme = useAppTheme();
  const locked = kmAway !== undefined;

  return (
    <Animated.View entering={FadeInDown.delay(index * 60).springify().damping(16)} style={styles.thumbWrap}>
      <Pressable
        disabled={locked}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={locked ? `${stop.name}, ${formatKm(kmAway)} km away` : `Postcard from ${stop.name}`}
        style={({ pressed }) => [
          styles.thumb,
          locked
            ? { borderColor: theme.colors.outlineVariant, backgroundColor: withAlpha(theme.colors.surfaceVariant, 0.5) }
            : styles.thumbPaper,
          pressed && styles.pressed,
        ]}>
        {locked ? (
          <View style={styles.locked}>
            <MaterialCommunityIcons name="email-lock-outline" size={22} color={theme.colors.onSurfaceVariant} />
            <Text variant="labelMedium" numberOfLines={1} style={{ color: theme.colors.onSurfaceVariant }}>
              {stop.name}
            </Text>
            <Text variant="labelSmall" style={{ color: theme.colors.outline }}>
              in {formatKm(kmAway)} km
            </Text>
          </View>
        ) : (
          <View style={styles.thumbArt}>
            <PostcardArt stop={stop} emojiSize={30} />
            <Text numberOfLines={1} style={styles.thumbName}>
              {stop.name}
            </Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

type ModalProps = {
  open: boolean;
  route: Route;
  /** Shown one after another. */
  stops: Stop[];
  people: Person[];
  you?: string;
  recipient: string;
  /** Heading above the card, e.g. "New postcard". The last stop always gets a finish-line heading. */
  title: string;
  onClose: () => void;
};

export function PostcardModal({ open, route, stops, people, you, recipient, title, onClose }: ModalProps) {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  // Start from the first postcard each time a new set opens.
  const [shown, setShown] = useState(stops);
  if (shown !== stops) {
    setShown(stops);
    setIndex(0);
  }

  const stop = stops[Math.min(index, stops.length - 1)];
  if (!stop) return null;
  const isLast = index >= stops.length - 1;
  const finale = stop === route.stops[route.stops.length - 1];

  return (
    <Portal>
      <Modal visible={open} onDismiss={onClose} contentContainerStyle={styles.modal}>
        {finale ? <Confetti key={`confetti-${stop.name}`} /> : null}
        <Animated.Text key={`title-${stop.name}`} entering={FadeInDown.duration(300)} style={styles.modalTitle}>
          {finale ? `🏁 You made it to ${stop.name}!` : title}
        </Animated.Text>
        <Postcard key={`card-${stop.name}`} route={route} stop={stop} people={people} you={you} recipient={recipient} width={Math.min(width - 32, 400)} />
        <Animated.Text entering={FadeIn.delay(1400)} style={styles.hint}>
          Tap the postcard to turn it over
        </Animated.Text>
        <View style={styles.modalActions}>
          <Text style={styles.count}>{stops.length > 1 ? `${index + 1} of ${stops.length}` : ''}</Text>
          <Button mode="contained" onPress={() => (isLast ? onClose() : setIndex(index + 1))}>
            {isLast ? 'Done' : 'Next postcard'}
          </Button>
        </View>
      </Modal>
    </Portal>
  );
}

const CONFETTI_COLORS = ['#F2B33D', '#E05A87', '#4FACFE', '#5BAE6B', '#8E6CF0', '#E2483D'];
const CONFETTI_PIECES = 36;

/** Deterministic 0–1 "random" so renders stay pure. */
function noise(i: number, salt: number): number {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** A one-off burst for the finish line. */
function Confetti() {
  return (
    <View pointerEvents="none" style={styles.confetti}>
      {Array.from({ length: CONFETTI_PIECES }, (_, i) => (
        <ConfettiPiece key={i} index={i} />
      ))}
    </View>
  );
}

function ConfettiPiece({ index }: { index: number }) {
  const t = useSharedValue(0);
  const angle = ((-160 + noise(index, 1) * 140) * Math.PI) / 180;
  const distance = 150 + noise(index, 2) * 160;
  const spin = (noise(index, 3) - 0.5) * 1440;
  const color = CONFETTI_COLORS[index % CONFETTI_COLORS.length]!;

  useEffect(() => {
    t.set(withDelay(200 + noise(index, 4) * 250, withTiming(1, { duration: 2200, easing: Easing.linear })));
  }, [t, index]);

  const style = useAnimatedStyle(() => {
    const p = t.value;
    // Burst outward fast, slow down, then fall.
    const out = 1 - Math.pow(1 - Math.min(p * 1.6, 1), 3);
    return {
      opacity: p === 0 ? 0 : p < 0.75 ? 1 : (1 - p) / 0.25,
      transform: [
        { translateX: Math.cos(angle) * distance * out },
        { translateY: Math.sin(angle) * distance * out + 420 * p * p },
        { rotate: `${spin * p}deg` },
      ],
    };
  });

  return <Animated.View style={[styles.piece, { backgroundColor: color }, style]} />;
}

const styles = StyleSheet.create({
  face: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 12,
    boxShadow: '0 10px 28px rgba(0, 0, 0, 0.35)',
  },
  front: { backgroundColor: PAPER, padding: ART_INSET },
  art: { flex: 1, borderRadius: 7, overflow: 'hidden' },
  // The art clips the corners, so the scene needs none of its own.
  scene: { borderRadius: 0 },
  emojiSpot: { position: 'absolute', left: '72.7%', top: '48%', alignItems: 'center', justifyContent: 'center' },
  // Clear of the stamp and postmark; long names wrap or shrink.
  greeting: { position: 'absolute', top: 14, left: 16, right: '40%' },
  greetingSmall: { color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: '700', letterSpacing: 2.5 },
  place: {
    color: '#FFFFFF',
    fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  // Bottom right, since the character stands on the left.
  caption: {
    position: 'absolute',
    right: 12,
    bottom: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  captionText: { color: '#FFFFFF', fontSize: 11, fontWeight: '600' },
  stampSpot: { position: 'absolute', top: 16, right: 16 },
  // Ring centred on the stamp's bottom-left corner (stamp is 50×60 at 16,16).
  postmarkSpot: { position: 'absolute', top: 44, right: 38 },
  stamp: {
    width: 50,
    height: 60,
    padding: 3,
    backgroundColor: PAPER,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#D9CCB4',
    borderRadius: 3,
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
  },
  stampInner: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 1 },
  stampFlag: { fontSize: 20, lineHeight: 24 },
  stampKm: { color: '#FFFFFF', fontSize: 8, fontWeight: '800', letterSpacing: 0.5 },
  back: { backgroundColor: BACK_PAPER, flexDirection: 'row', padding: 14 },
  backLeft: { flex: 1.25, gap: 6, paddingRight: 12 },
  backTitle: { fontFamily: SERIF, fontWeight: '700', fontStyle: 'italic', color: INK },
  backBody: { fontFamily: SERIF, fontStyle: 'italic', color: INK },
  backSign: { fontFamily: SERIF, fontStyle: 'italic', color: withAlpha(INK, 0.75), marginTop: 'auto' },
  divider: { width: 1, backgroundColor: '#D8CDB8' },
  backRight: { flex: 1, paddingLeft: 12, justifyContent: 'space-between' },
  backStamp: { alignSelf: 'flex-end' },
  address: { gap: 6 },
  addressLine: {
    fontFamily: SERIF,
    fontStyle: 'italic',
    color: INK,
    borderBottomWidth: 1,
    borderBottomColor: '#D8CDB8',
    paddingBottom: 2,
  },
  thumbWrap: { width: '48%' },
  thumb: { aspectRatio: 1.5, borderRadius: 10, borderWidth: 1.5, borderStyle: 'dashed', overflow: 'hidden' },
  thumbPaper: {
    backgroundColor: PAPER,
    borderWidth: 0,
    padding: 3,
    boxShadow: '0 3px 8px rgba(0, 0, 0, 0.18)',
  },
  pressed: { transform: [{ scale: 0.97 }] },
  thumbArt: { flex: 1, borderRadius: 7, overflow: 'hidden' },
  thumbName: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 6,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  locked: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, padding: 8 },
  modal: { alignItems: 'center', gap: 16, padding: 16 },
  modalTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '800', textAlign: 'center' },
  hint: { color: 'rgba(255,255,255,0.75)', fontSize: 13 },
  modalActions: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    maxWidth: 400,
    width: '100%',
    marginHorizontal: 'auto',
  },
  count: { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
  confetti: { position: 'absolute', top: 60, left: 0, right: 0, height: 0, alignItems: 'center', zIndex: 10 },
  piece: { position: 'absolute', width: 7, height: 11, borderRadius: 2 },
});
