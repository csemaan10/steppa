import { Modal, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Text } from 'react-native-paper';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Button } from '@/components/button';
import { MAGIC_COLOR, TRIP_COLOR } from '@/components/game/colors';
import { InkStamp, Ribbon, SparkleBurst, Sunburst } from '@/components/game/game-fx';
import { popIn, riseIn } from '@/components/game/game-motion';
import type { Destination } from '@/lib/pet-adventures';
import type { Souvenir } from '@/lib/world';

const CARD = 148;
/** The beats, in ms: the card pops up, the ribbon unfurls, it's stamped, then the words and buttons. */
const CARD_AT = 120;
const RIBBON_AT = 380;
const STAMP_AT = 640;
const WORDS_AT = 820;

/**
 * The first trip to somewhere brings back its souvenir: rays turn behind it, it pops up on a card
 * with sparkles, "SOUVENIR!" unfurls and the card is stamped with where it's from. Then wear it, or
 * keep it for later (it waits in the wardrobe). A keepsake for a full passport page says so, and goes
 * in the yard rather than on.
 */
export function SouvenirReveal({
  souvenir,
  from,
  name,
  onWear,
  onLater,
}: {
  souvenir: Souvenir;
  from: Destination;
  /** The pet's name. */
  name: string;
  onWear: () => void;
  onLater: () => void;
}) {
  const keepsake = !!souvenir.full;
  const { width } = useWindowDimensions();
  const color = from.fantasy ? MAGIC_COLOR : TRIP_COLOR;
  return (
    <Modal transparent visible statusBarTranslucent navigationBarTranslucent animationType="none" onRequestClose={onLater}>
      <Animated.View entering={FadeIn.duration(240)} style={[StyleSheet.absoluteFill, styles.backdrop]} />
      <View style={styles.page}>
        <View style={styles.hero}>
          <View style={styles.behind}>
            <Sunburst size={Math.min(width * 1.2, 520)} color="#FFE08A" />
          </View>
          <Animated.View entering={popIn(CARD_AT)} style={styles.card}>
            <Text style={styles.emoji}>{souvenir.choice.emoji}</Text>
            <View style={styles.stamp}>
              <InkStamp text={from.name.toUpperCase()} color={color} rotate={-10} size={11} delay={STAMP_AT} />
            </View>
          </Animated.View>
          <SparkleBurst count={14} radius={110} delay={CARD_AT + 120} />
        </View>
        <Ribbon text={keepsake ? 'PAGE FILLED!' : 'SOUVENIR!'} width={Math.min(width - 60, 280)} color={color} delay={RIBBON_AT} />
        <Animated.Text entering={riseIn(WORDS_AT)} style={styles.headline}>
          {keepsake
            ? `${name} filled the ${from.name} page and brought home a ${souvenir.choice.label.toLowerCase()}`
            : `${name} brought back a ${souvenir.choice.label.toLowerCase()} from ${from.name}`}
        </Animated.Text>
        <Animated.View entering={riseIn(WORDS_AT + 160)} style={styles.buttons}>
          <Button mode="contained" icon={keepsake ? 'home-heart' : 'hanger'} onPress={onWear}>
            {keepsake ? 'Put it in the yard' : 'Wear it'}
          </Button>
          <Button textColor="#FFFFFF" onPress={onLater}>
            Later
          </Button>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(10, 12, 22, 0.94)' },
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  hero: { width: CARD, height: CARD + 20, alignItems: 'center', justifyContent: 'center' },
  behind: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  card: {
    width: CARD,
    height: CARD,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderBottomWidth: 5,
    borderBottomColor: 'rgba(0, 0, 0, 0.12)',
    boxShadow: '0 12px 30px rgba(0, 0, 0, 0.4)',
  },
  emoji: { fontSize: 72, lineHeight: 88 },
  stamp: { position: 'absolute', bottom: -10, right: -18 },
  headline: { color: '#FFFFFF', fontSize: 20, fontWeight: '800', textAlign: 'center', maxWidth: 320 },
  buttons: { alignItems: 'center', gap: 4 },
});
