import { useEffect } from 'react';
import { Modal, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Text } from 'react-native-paper';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { Button } from '@/components/button';
import { NewBadge, Ribbon, SparkleBurst, Sunburst } from '@/components/game/game-fx';
import { gameMotion, riseIn } from '@/components/game/game-motion';
import { formatSteps } from '@/lib/dates';
import { rewardsBetween, type Reward } from '@/lib/shop';
import { LEVELS, type WorldDef } from '@/lib/world';
import { useAppTheme } from '@/theme';

const MEDAL = 132;
/** Reward cards shown; any more are counted underneath. */
const SHOWN_REWARDS = 6;
const COLUMNS = 3;
const GAP = 10;
/** The beats, in ms: medal slams, ribbon unfurls, headline, then the rewards flip over one by one. */
const SLAM_AT = 150;
/** The medal hits the page: the shockwave and sparkles go off. */
const HIT_AT = SLAM_AT + gameMotion.slam.duration;
const RIBBON_AT = 420;
const HEADLINE_AT = 640;
const REWARDS_AT = 820;
const REWARD_STAGGER = 110;

type Props = {
  def: WorldDef;
  /** The first milestone being celebrated (several can land at once). */
  from: number;
  level: number;
  name: string;
  onShop: () => void;
  onLater: () => void;
};

/**
 * A milestone, game style: the screen dims, rays turn, a medal with the new level slams down with a
 * shockwave, "LEVEL UP!" unfurls, and what it unlocked flips over card by card. Then off to the shop.
 */
export function LevelUp({ def, from, level, name, onShop, onLater }: Props) {
  const { width } = useWindowDimensions();
  const panel = Math.min(width - 40, 340);
  const tile = (panel - GAP * (COLUMNS - 1)) / COLUMNS;
  const rewards = rewardsBetween(def, from, level);
  const shown = rewards.slice(0, SHOWN_REWARDS);
  const more = rewards.length - shown.length;
  const count = level - from + 1;
  const buttonsAt = REWARDS_AT + shown.length * REWARD_STAGGER + 200;

  const dim = useSharedValue(0);
  const slam = useSharedValue(0);
  const shock = useSharedValue(0);
  useEffect(() => {
    dim.set(withTiming(1, { duration: 260 }));
    slam.set(withDelay(SLAM_AT, withTiming(1, gameMotion.slam)));
    shock.set(withDelay(HIT_AT, withTiming(1, { duration: 650, easing: Easing.out(Easing.cubic) })));
  }, [dim, slam, shock]);

  const backdrop = useAnimatedStyle(() => ({ opacity: dim.value }));
  const medal = useAnimatedStyle(() => ({
    opacity: slam.value > 0.01 ? 1 : 0,
    transform: [{ scale: 2.4 - 1.4 * slam.value }, { rotate: `${(1 - slam.value) * -18}deg` }],
  }));
  const ring = useAnimatedStyle(() => ({
    opacity: shock.value === 0 ? 0 : 1 - shock.value,
    transform: [{ scale: 0.7 + shock.value * 1.6 }],
  }));

  return (
    <Modal
      transparent
      visible
      statusBarTranslucent
      navigationBarTranslucent
      animationType="none"
      onRequestClose={onLater}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdrop]} />
      <View style={styles.page}>
        <View style={styles.hero}>
          <View style={styles.behind}>
            <Sunburst size={Math.min(width * 1.25, 540)} color="#FFE08A" />
          </View>
          <Animated.View style={[styles.shock, ring]} />
          <Animated.View style={medal}>
            <Medal level={level} />
          </Animated.View>
          <SparkleBurst count={16} radius={120} delay={HIT_AT} />
        </View>

        <View style={styles.ribbon}>
          <Ribbon
            text={count > 1 ? `${count} LEVELS UP!` : 'LEVEL UP!'}
            width={Math.min(panel, 300)}
            delay={RIBBON_AT}
          />
        </View>
        <Animated.Text entering={riseIn(HEADLINE_AT)} style={styles.headline}>
          {name} reached {formatSteps(LEVELS[level]!)} steps
        </Animated.Text>

        {shown.length ? (
          <View style={[styles.rewards, { width: panel }]}>
            {shown.map((reward, i) => (
              <RewardCard key={reward.key} reward={reward} index={i} width={tile} />
            ))}
          </View>
        ) : null}
        {more > 0 ? (
          <Animated.Text entering={FadeIn.delay(buttonsAt - 150)} style={styles.more}>
            +{more} more in the shop
          </Animated.Text>
        ) : null}

        <Animated.View
          entering={riseIn(buttonsAt)}
          style={[styles.buttons, { width: panel }]}>
          <Button mode="contained" icon="storefront" onPress={onShop}>
            Open shop
          </Button>
          <Button textColor="#FFFFFF" onPress={onLater} style={styles.later}>
            Later
          </Button>
        </Animated.View>
      </View>
    </Modal>
  );
}

/** A gold medal with the level on it and two ribbon tails behind. */
function Medal({ level }: { level: number }) {
  const theme = useAppTheme();
  const c = MEDAL / 2;
  return (
    <View style={styles.medalBox}>
      <Svg width={MEDAL} height={70} style={styles.tails}>
        <Path d={`M${c - 34} 0 H${c - 4} L${c - 18} 66 L${c - 29} 54 L${c - 42} 62 Z`} fill="#E5534B" />
        <Path d={`M${c + 34} 0 H${c + 4} L${c + 18} 66 L${c + 29} 54 L${c + 42} 62 Z`} fill="#4F7CE8" />
      </Svg>
      <View style={styles.rim}>
        <View style={[styles.face, { backgroundColor: theme.colors.primary }]}>
          <Text style={[styles.levelWord, { color: theme.colors.onPrimary }]}>LEVEL</Text>
          <Text style={[styles.levelNumber, { color: theme.colors.onPrimary }]}>{level}</Text>
        </View>
      </View>
    </View>
  );
}

/** One unlocked thing, flipping over to face you. */
function RewardCard({ reward, index, width }: { reward: Reward; index: number; width: number }) {
  const flip = useSharedValue(0);
  useEffect(() => {
    flip.set(withDelay(REWARDS_AT + index * REWARD_STAGGER, withTiming(1, gameMotion.enter)));
  }, [flip, index]);
  const style = useAnimatedStyle(() => ({
    opacity: flip.value > 0.04 ? 1 : 0,
    transform: [
      { perspective: 600 },
      { rotateY: `${(1 - flip.value) * 90}deg` },
      { translateY: (1 - flip.value) * 18 },
    ],
  }));

  return (
    <Animated.View style={[styles.card, { width }, style]}>
      {reward.color ? (
        <View style={[styles.swatch, { backgroundColor: reward.color }]} />
      ) : (
        <Text style={styles.cardEmoji}>{reward.emoji}</Text>
      )}
      <Text numberOfLines={2} style={styles.cardLabel}>
        {reward.label}
      </Text>
      {reward.grows ? null : <NewBadge style={styles.cardBadge} />}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Deep enough that nothing behind competes with the moment.
  backdrop: { backgroundColor: 'rgba(10, 12, 22, 0.94)' },
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 14 },
  hero: { width: MEDAL, height: MEDAL + 34, alignItems: 'center', justifyContent: 'center' },
  behind: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  shock: {
    position: 'absolute',
    top: 0,
    width: MEDAL,
    height: MEDAL,
    borderRadius: MEDAL / 2,
    borderWidth: 6,
    borderColor: '#FFE08A',
  },
  medalBox: { width: MEDAL, height: MEDAL + 34, alignItems: 'center' },
  tails: { position: 'absolute', top: MEDAL * 0.62 },
  rim: {
    width: MEDAL,
    height: MEDAL,
    borderRadius: MEDAL / 2,
    alignItems: 'center',
    justifyContent: 'center',
    experimental_backgroundImage: 'linear-gradient(160deg, #FFE68F 0%, #F4B92C 100%)',
    borderBottomWidth: 6,
    borderBottomColor: '#C48A12',
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.45)',
  },
  face: {
    width: MEDAL - 26,
    height: MEDAL - 26,
    borderRadius: (MEDAL - 26) / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  levelWord: { fontSize: 12, fontWeight: '900', letterSpacing: 2, opacity: 0.85 },
  levelNumber: { fontSize: 50, fontWeight: '900', lineHeight: 56, marginTop: -4 },
  ribbon: { marginTop: -6 },
  headline: { color: '#FFFFFF', fontSize: 17, fontWeight: '800', textAlign: 'center' },
  rewards: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: GAP, marginTop: 4 },
  card: {
    minHeight: 96,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 10,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 4,
    borderBottomColor: '#D5D9E2',
  },
  cardEmoji: { fontSize: 30, lineHeight: 38 },
  swatch: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    boxShadow: '0 1px 4px rgba(0, 0, 0, 0.3)',
  },
  cardLabel: { color: '#24252B', fontSize: 12, fontWeight: '800', textAlign: 'center' },
  cardBadge: { position: 'absolute', top: -6, right: -4 },
  more: { color: 'rgba(255, 255, 255, 0.75)', fontSize: 13, fontWeight: '700' },
  buttons: { gap: 6, marginTop: 6 },
  later: { alignSelf: 'center' },
});
