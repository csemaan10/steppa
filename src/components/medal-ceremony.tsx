import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Icon, Text, useTheme } from 'react-native-paper';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { UserAvatar } from '@/components/user-avatar';
import { useCountUp } from '@/hooks/use-count-up';
import type { LeaderboardRow } from '@/lib/api';
import { formatSteps } from '@/lib/dates';

export const MEDAL_COLORS = ['#E3B341', '#A8B0B8', '#C3834C'];

// Timeline (ms). Blocks rise 3rd → 1st, then characters land bronze → silver → gold,
// each getting its medal, then the winner's crown and confetti.
const BLOCK_AT = [240, 120, 0];
const LAND_AT = [1900, 1200, 500];
const MEDAL_AFTER = 300;
const CROWN_AT = LAND_AT[0]! + 650;
/** When the ceremony is over, for anything that should follow it (e.g. your result). */
export const CEREMONY_END = CROWN_AT + 400;

const HEIGHTS = [104, 78, 58];
const AVATAR = [60, 50, 50];
const DROP_FROM = -320;

const CONFETTI_COLORS = ['#E3B341', '#FF4F8B', '#1E90FF', '#00C98A', '#9C6BFF', '#FF9F1C'];
const CONFETTI_MS = 1900;
const GRAVITY = 900;
// Fixed per-piece launch values, generated once so re-renders don't reshuffle them.
const CONFETTI = Array.from({ length: 36 }, (_, i) => {
  const angle = (-160 + Math.random() * 140) * (Math.PI / 180);
  const speed = 260 + Math.random() * 300;
  return {
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    spin: (Math.random() - 0.5) * 1440,
    width: 6 + Math.random() * 4,
    height: 10 + Math.random() * 6,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length]!,
  };
});

type Props = {
  /** Top three with steps, best first. */
  podium: LeaderboardRow[];
  userId: string;
  onPressUser: (userId: string) => void;
};

/** Animated medal ceremony: characters drop onto the podium and get their medals. Remount to replay. */
export function MedalCeremony({ podium, userId, onPressUser }: Props) {
  const confetti = useSharedValue(0);

  useEffect(() => {
    confetti.set(withDelay(CROWN_AT, withTiming(1, { duration: CONFETTI_MS, easing: Easing.linear })));
  }, [confetti]);

  // Visual order: 2nd, 1st, 3rd.
  const order = [1, 0, 2].filter((i) => i < podium.length);

  return (
    <View style={styles.stage}>
      {order.map((place) => (
        <Spot
          key={podium[place]!.user_id}
          row={podium[place]!}
          place={place}
          isMe={podium[place]!.user_id === userId}
          onPress={() => onPressUser(podium[place]!.user_id)}
        />
      ))}
      <View pointerEvents="none" style={styles.confettiOrigin}>
        {CONFETTI.map((piece, i) => (
          <ConfettiPiece key={i} piece={piece} progress={confetti} />
        ))}
      </View>
    </View>
  );
}

type SpotProps = { row: LeaderboardRow; place: number; isMe: boolean; onPress: () => void };

function Spot({ row, place, isMe, onPress }: SpotProps) {
  const theme = useTheme();
  const land = LAND_AT[place]!;
  const medalColor = MEDAL_COLORS[row.rank - 1] ?? MEDAL_COLORS[place]!;
  const steps = useCountUp(row.total_steps, 600, land + 200);

  const block = useSharedValue(0);
  const drop = useSharedValue(DROP_FROM);
  const shown = useSharedValue(0);
  const medal = useSharedValue(0);
  const crown = useSharedValue(0);

  useEffect(() => {
    block.set(withDelay(BLOCK_AT[place]!, withSpring(HEIGHTS[place]!, { damping: 18, stiffness: 220 })));
    shown.set(withDelay(land, withTiming(1, { duration: 150 })));
    // Low damping so the character bounces when it lands.
    drop.set(withDelay(land, withSpring(0, { damping: 9, stiffness: 170, mass: 0.9 })));
    medal.set(withDelay(land + MEDAL_AFTER, withSpring(1, { damping: 5, stiffness: 120 })));
    if (place === 0) crown.set(withDelay(CROWN_AT, withSpring(1, { damping: 8, stiffness: 160 })));
  }, [block, drop, shown, medal, crown, land, place]);

  const blockStyle = useAnimatedStyle(() => ({ height: block.value }));
  const figureStyle = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateY: drop.value }],
  }));
  // Swings in like a pendulum from the ribbon's top.
  const medalStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, medal.value * 2),
    transform: [{ rotate: `${(1 - medal.value) * -70}deg` }, { scale: 0.4 + medal.value * 0.6 }],
  }));
  const crownStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, crown.value * 2),
    transform: [{ translateY: (1 - crown.value) * -90 }, { rotate: `${(1 - crown.value) * -25}deg` }],
  }));
  const labelStyle = useAnimatedStyle(() => ({ opacity: medal.value > 0.05 ? 1 : 0 }));

  return (
    <Pressable
      style={styles.spot}
      onPress={isMe ? undefined : onPress}
      accessibilityLabel={`${row.rank}: ${row.display_name}, ${formatSteps(row.total_steps)} steps`}>
      <Animated.View style={[styles.figure, figureStyle]}>
        <Animated.View style={[styles.crown, place !== 0 && styles.hidden, crownStyle]}>
          <Icon source="crown" size={30} color={MEDAL_COLORS[0]} />
        </Animated.View>
        <View style={[styles.avatarRing, isMe && { borderColor: theme.colors.primary }]}>
          <UserAvatar name={row.display_name} color={row.avatar_color} icon={row.avatar_icon} size={AVATAR[place]} />
        </View>
        <Animated.View style={[styles.medal, medalStyle]}>
          <View style={[styles.ribbon, { backgroundColor: theme.colors.primary }]} />
          <View style={[styles.disc, { backgroundColor: medalColor }]}>
            <Text variant="labelLarge" style={styles.discText}>
              {row.rank}
            </Text>
          </View>
        </Animated.View>
      </Animated.View>

      <Animated.View style={[styles.label, labelStyle]}>
        <Text variant="labelLarge" numberOfLines={1}>
          {isMe ? 'You' : row.display_name}
        </Text>
        <Text variant="titleSmall" style={styles.steps}>
          {formatSteps(steps)}
        </Text>
      </Animated.View>

      <Animated.View style={[styles.block, { backgroundColor: theme.colors.primaryContainer }, blockStyle]}>
        <Text variant="headlineSmall" style={[styles.place, { color: theme.colors.onPrimaryContainer }]}>
          {row.rank}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

type Piece = (typeof CONFETTI)[number];

function ConfettiPiece({ piece, progress }: { piece: Piece; progress: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const p = progress.value;
    const t = (p * CONFETTI_MS) / 1000;
    return {
      opacity: p === 0 || p === 1 ? 0 : p < 0.7 ? 1 : (1 - p) / 0.3,
      transform: [
        { translateX: piece.vx * t },
        { translateY: piece.vy * t + 0.5 * GRAVITY * t * t },
        { rotate: `${piece.spin * t}deg` },
      ],
    };
  });
  return (
    <Animated.View
      style={[styles.piece, { width: piece.width, height: piece.height, backgroundColor: piece.color }, style]}
    />
  );
}

const styles = StyleSheet.create({
  stage: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingTop: 48 },
  spot: { flex: 1, alignItems: 'center' },
  figure: { alignItems: 'center' },
  crown: { marginBottom: -6, zIndex: 1 },
  hidden: { display: 'none' },
  avatarRing: { borderWidth: 2, borderColor: 'transparent', borderRadius: 999, padding: 2 },
  medal: { alignItems: 'center', marginTop: -10, transformOrigin: 'top' },
  ribbon: { width: 8, height: 12, borderRadius: 2 },
  disc: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  discText: { color: '#fff', fontWeight: '800' },
  label: { alignItems: 'center', marginVertical: 6, maxWidth: '100%' },
  steps: { fontVariant: ['tabular-nums'] },
  block: {
    width: '100%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    alignItems: 'center',
    paddingTop: 6,
    overflow: 'hidden',
  },
  place: { fontWeight: '800' },
  // Confetti bursts from above the winner, in the middle of the stage.
  confettiOrigin: { position: 'absolute', top: 40, left: '50%' },
  piece: { position: 'absolute', borderRadius: 2 },
});
