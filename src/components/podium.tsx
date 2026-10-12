import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { PlayerBadges, RankDelta } from '@/components/player-badges';
import { CharacterCanvas } from '@/components/character/character-canvas';
import { ENTRANCE_HEADS_OFF, ENTRANCE_POSE, ENTRANCE_SECONDS } from '@/components/character/entrance';
import { EntranceStage, bringToFront } from '@/components/character/entrance-stage';
import { useCountUp } from '@/hooks/use-count-up';
import { activeAverage, type LeaderboardRow } from '@/lib/api';
import { hashString, normalizeLook } from '@/lib/character';
import { formatSteps } from '@/lib/dates';

const HEIGHTS = [112, 84, 64];
/** Width of the character stage above each block (the character is half as tall). */
const CHARACTER_WIDTH = 88;
/** Idle moves are redrawn at half rate: at this size it hardly shows, and it halves the drawing. Entrances follow their own clock, at full rate. */
const CHARACTER_FPS = 30;
// 3rd rises first, then 2nd, then 1st.
const DELAYS = [30, 15, 0];
/** About how long the block's spring takes to settle, so entrances start once it's up. */
const RISE_MS = 300;
// Entrances: 3rd goes first, then 2nd, then 1st.
const ENTRANCE_DELAYS = [500, 250, 0];

type Props = {
  rows: LeaderboardRow[];
  userId: string;
  /** Show the per-active-day average (off for a single day). */
  showAverage: boolean;
  onPressUser: (userId: string) => void;
  /** False pauses the characters (e.g. while the Leaderboard tab is hidden or the podium is scrolled away). */
  animate?: boolean;
  /** Changing this replays the rise (e.g. on a period switch) without rebuilding the podium. */
  replayKey?: string;
};

/** Animated top-3 podium. Change `replayKey` to replay the rise; the characters stay put. */
export function Podium({ rows, userId, showAverage, onPressUser, animate = true, replayKey }: Props) {
  const top = rows.slice(0, 3);
  // Visual order: 2nd, 1st, 3rd.
  const order = [1, 0, 2].filter((i) => i < top.length);

  return (
    <View style={styles.podium}>
      {order.map((place) => (
        <PodiumSpot
          key={top[place]!.user_id}
          row={top[place]!}
          place={place}
          showAverage={showAverage}
          isMe={top[place]!.user_id === userId}
          animate={animate}
          replayKey={replayKey}
          onPress={() => onPressUser(top[place]!.user_id)}
        />
      ))}
    </View>
  );
}

type SpotProps = {
  row: LeaderboardRow;
  place: number;
  showAverage: boolean;
  isMe: boolean;
  animate: boolean;
  replayKey?: string;
  onPress: () => void;
};

function PodiumSpot({ row, place, showAverage, isMe, animate, replayKey, onPress }: SpotProps) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const height = useSharedValue(0);
  const reveal = useSharedValue(0);
  const delay = DELAYS[place]!;
  const steps = useCountUp(row.total_steps, 180, delay);
  const look = useMemo(() => normalizeLook(row.podium_character, row.user_id), [row.podium_character, row.user_id]);
  // The chosen way of getting up onto the block (null: the block simply rises with them on it).
  const entrance = look.entrance !== 'rise' && !reduceMotion ? look.entrance : null;
  // Seconds into the entrance; negative until it starts (the character isn't shown yet).
  const clock = useSharedValue(-1);
  const [entering, setEntering] = useState(false);
  // Over the other spots while the entrance's effects cross them (see bringToFront).
  const [z, setZ] = useState(0);

  // Rise from the floor on mount and whenever replayKey changes (e.g. switching Today / 7 days).
  // With an entrance the block rises empty, then they make their entrance and go straight into
  // their own move.
  useEffect(() => {
    height.set(0);
    reveal.set(0);
    height.set(withDelay(delay, withSpring(HEIGHTS[place]!, { damping: 30, stiffness: 1000 })));
    reveal.set(withDelay(delay, withTiming(1, { duration: 80 })));
    if (!entrance) return;
    const start = delay + RISE_MS + ENTRANCE_DELAYS[place]!;
    const length = ENTRANCE_SECONDS[entrance] * 1000;
    clock.set(-1);
    clock.set(
      withDelay(
        start,
        withSequence(
          withTiming(0, { duration: 1 }),
          withTiming(ENTRANCE_SECONDS[entrance], { duration: length, easing: Easing.linear })
        )
      )
    );
    const timers = [
      // Into the entrance pose straight away, while they're still hidden: the clock starts them on
      // the UI thread, and a late switch would flash their idle pose (and pets) for a frame.
      setTimeout(() => setEntering(true), 0),
      setTimeout(() => setEntering(false), start + length),
      setTimeout(() => setZ(bringToFront()), start),
    ];
    const off = ENTRANCE_HEADS_OFF[entrance];
    if (off !== undefined) timers.push(setTimeout(() => setZ(bringToFront()), start + off * 1000));
    return () => {
      timers.forEach(clearTimeout);
      // Interrupted (e.g. a quick period switch): stand on the block rather than freeze mid-air.
      clock.set(ENTRANCE_SECONDS[entrance]);
      setEntering(false);
    };
  }, [height, reveal, clock, delay, place, entrance, replayKey]);

  const blockStyle = useAnimatedStyle(() => ({ height: height.value }));
  const headStyle = useAnimatedStyle(() => ({
    opacity: reveal.value,
    transform: [{ translateY: (1 - reveal.value) * 12 }, { scale: 0.85 + reveal.value * 0.15 }],
  }));

  const seed = (hashString(row.user_id) % 1000) / 1000;

  const blockColors = [
    [theme.colors.primaryContainer, theme.colors.onPrimaryContainer],
    [theme.colors.secondaryContainer, theme.colors.onSecondaryContainer],
    [theme.colors.tertiaryContainer, theme.colors.onTertiaryContainer],
  ][place]!;

  return (
    <Pressable
      style={[styles.spot, { zIndex: z }]}
      onPress={isMe ? undefined : onPress}
      accessibilityLabel={`${place + 1}: ${row.display_name}, ${formatSteps(row.total_steps)} steps`}>
      <Animated.View style={[styles.head, headStyle]}>
        {place === 0 ? <MaterialCommunityIcons name="crown" size={28} color="#E3B341" /> : null}
        <View style={styles.nameRow}>
          <Text
            variant="labelLarge"
            numberOfLines={1}
            style={[styles.name, isMe && { color: theme.colors.primary, fontWeight: '700' }]}>
            {isMe ? 'You' : row.display_name}
          </Text>
        </View>
        <View style={styles.stepsRow}>
          <Text variant="titleSmall">{formatSteps(steps)}</Text>
          <RankDelta rank={row.rank} prevRank={row.prev_rank} />
        </View>
        {showAverage ? (
          <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
            avg {formatSteps(activeAverage(row.total_steps, row.active_days))}/day
          </Text>
        ) : null}
        <PlayerBadges row={row} center />
        {/* The character stands on the block: 88 × 44 pt stage, same scale as the design preview. */}
        <View style={styles.character}>
          {entrance ? (
            <EntranceStage
              kind={entrance}
              clock={clock}
              width={CHARACTER_WIDTH}
              ground={HEIGHTS[place]!}
              fx={entering}>
              <CharacterCanvas
                look={look}
                seed={seed}
                width={CHARACTER_WIDTH}
                animate={animate}
                fps={CHARACTER_FPS}
                motion={entering ? ENTRANCE_POSE[entrance] : undefined}
                clock={entering ? clock : undefined}
              />
            </EntranceStage>
          ) : (
            <CharacterCanvas look={look} seed={seed} width={CHARACTER_WIDTH} animate={animate} fps={CHARACTER_FPS} />
          )}
        </View>
      </Animated.View>
      <Animated.View
        style={[
          styles.block,
          { backgroundColor: blockColors[0] },
          blockStyle,
        ]}>
        <Text variant="headlineMedium" style={[styles.place, { color: blockColors[1] }]}>
          {place + 1}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  podium: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingTop: 8 },
  spot: { flex: 1, alignItems: 'center' },
  // No gap below the character, so it stands right on the block. Above the block, so a character
  // making an entrance in front of it isn't hidden by it.
  head: { alignItems: 'center', gap: 4, width: '100%', zIndex: 2 },
  character: { marginTop: 2, marginBottom: -3 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '100%' },
  name: { flexShrink: 1 },
  stepsRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  block: {
    width: '100%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    alignItems: 'center',
    paddingTop: 8,
    overflow: 'hidden',
    zIndex: 1,
  },
  place: { fontWeight: '700' },
});
