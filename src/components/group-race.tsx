import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getLeaderboard, type LeaderboardRow } from '@/lib/api';
import { formatSteps } from '@/lib/dates';

const MIN_TRACK_H = 420;
const MAX_TRACK_H = 1600;
/** Track grows by 1px for this many steps between first and last place. */
const STEPS_PER_PX = 25;
const MAX_CAR_W = 22;
const CAR_RATIO = 2.1;
const TRAIL_W_RATIO = 0.35;
const TAG_H = 18;
const TAG_W = 72;

type Props = { groupId: string; userId: string };

/**
 * Today's race, bottom to top: each member is an F1 car in their colour in their own lane,
 * with a trail the length of their steps. The leader sits at the top; everyone else is relative.
 */
export function GroupRace({ groupId, userId }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [trackWidth, setTrackWidth] = useState(0);
  const [lap, setLap] = useState(0);
  const { width: screenW } = useWindowDimensions();

  useEffect(() => {
    let active = true;
    getLeaderboard(groupId, 'today').then((r) => active && setRows(r));
    return () => {
      active = false;
    };
  }, [groupId]);

  async function refresh() {
    setRefreshing(true);
    setRows(await getLeaderboard(groupId, 'today'));
    setLap((l) => l + 1);
    setRefreshing(false);
  }

  const racers = rows ?? [];
  const carW = MAX_CAR_W;
  const carH = carW * CAR_RATIO;
  const leader = racers[0]?.total_steps ?? 0;
  const last = racers[racers.length - 1]?.total_steps ?? 0;
  const range = leader - last;
  // Bottom of the track sits a bit below last place, so close races spread over the full height.
  const floor = Math.max(0, last - Math.max(range * 0.3, 500));
  const fractionOf = (steps: number) => (leader > floor ? (steps - floor) / (leader - floor) : 1);
  // Before the track is measured, lay out for the screen width so the height is right first time.
  const width = trackWidth || screenW - 32;
  const layout = layoutRace(
    racers.map((r) => fractionOf(r.total_steps)),
    width,
    carW,
    carH,
    Math.min(MAX_TRACK_H, Math.max(MIN_TRACK_H, 300 + range / STEPS_PER_PX))
  );
  const { trackH, travel } = layout;
  const positions = layout.xs;
  /** Where each car is drawn, 0 (bottom) to 1 (top): the step fraction, spaced out if cars are close. */
  const shown = layout.ys.map((y) => (travel > 0 ? y / travel : 1));

  // Scroll so your car is in view once the race is laid out.
  const scrollRef = useRef<ScrollView>(null);
  const [viewportH, setViewportH] = useState(0);
  const [trackTop, setTrackTop] = useState(0);
  const myRow = racers.find((r) => r.user_id === userId);
  const myIndex = myRow ? racers.indexOf(myRow) : -1;
  const myCarY = myIndex >= 0 ? trackTop + trackH - 6 - layout.ys[myIndex]! - (carH + TAG_H) / 2 : null;
  useEffect(() => {
    if (myCarY === null || !viewportH || !trackWidth) return;
    const id = setTimeout(() => scrollRef.current?.scrollTo({ y: Math.max(0, myCarY - viewportH / 2), animated: true }), 250);
    return () => clearTimeout(id);
  }, [myCarY, viewportH, trackWidth, lap]);

  return (
    <ScrollView
      ref={scrollRef}
      onLayout={(e) => setViewportH(e.nativeEvent.layout.height)}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 16 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
      <View style={styles.header}>
        <MaterialCommunityIcons name="flag-checkered" size={20} color={theme.colors.onSurface} />
        <Text variant="titleMedium">Today&apos;s race</Text>
        {range > 0 ? (
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginLeft: 'auto' }}>
            Gap {formatSteps(range)} steps
          </Text>
        ) : null}
      </View>

      <View
        style={[styles.track, { height: trackH, backgroundColor: theme.dark ? '#1E2321' : '#2B302E' }]}
        onLayout={(e) => {
          setTrackWidth(e.nativeEvent.layout.width);
          setTrackTop(e.nativeEvent.layout.y);
        }}>
        {trackWidth > 0
          ? racers.map((row, i) => (
              <RaceCar
                key={`${row.user_id}:${lap}`}
                row={row}
                index={i}
                x={positions[i]!}
                fraction={shown[i]!}
                travel={travel}
                carW={carW}
                carH={carH}
                isMe={row.user_id === userId}
                numberOnLeft={positions[i]! > trackWidth - 80}
              />
            ))
          : null}
      </View>

      <View style={styles.legend}>
        {racers.map((row) => (
          <View key={row.user_id} style={styles.legendRow}>
            <View style={[styles.swatch, { backgroundColor: row.avatar_color }]} />
            <Text variant="bodyMedium" style={styles.legendName} numberOfLines={1}>
              {row.rank}. {row.user_id === userId ? 'You' : row.display_name}
            </Text>
            <Text variant="titleSmall">{formatSteps(row.total_steps)}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

type CarProps = {
  row: LeaderboardRow;
  index: number;
  /** Horizontal centre of the car within the track. */
  x: number;
  fraction: number;
  /** Vertical distance a car travels from the bottom to the top of the track. */
  travel: number;
  carW: number;
  carH: number;
  isMe: boolean;
  /** Put the step count on the left when the car is near the right edge. */
  numberOnLeft: boolean;
};

function RaceCar({ row, index, x, fraction, travel, carW, carH, isMe, numberOnLeft }: CarProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.set(withDelay(150 + index * 100, withSpring(fraction, { damping: 18, stiffness: 60 })));
  }, [progress, fraction, index]);

  const trailStyle = useAnimatedStyle(() => ({ height: progress.value * travel + carH / 2 }));
  const carStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -progress.value * travel }] }));
  const trailW = Math.max(3, carW * TRAIL_W_RATIO);

  return (
    <>
      <Animated.View
        style={[
          styles.trail,
          {
            left: x,
            width: trailW,
            borderRadius: trailW / 2,
            marginLeft: -trailW / 2,
            experimental_backgroundImage: `linear-gradient(0deg, ${row.avatar_color}00 0%, ${row.avatar_color}BB 100%)`,
          },
          trailStyle,
        ]}
      />
      <Animated.View style={[styles.car, { left: x, marginLeft: -TAG_W / 2, width: TAG_W }, carStyle]}>
        <View style={styles.tag}>
          <Text numberOfLines={1} style={styles.tagText}>
            {isMe ? 'You' : row.display_name}
          </Text>
        </View>
        <View>
          <F1Car color={row.avatar_color} w={carW} h={carH} highlight={isMe} />
          <Text
            numberOfLines={1}
            style={[
              styles.stepsGlow,
              { textShadowColor: row.avatar_color, top: carH / 2 - 8 },
              numberOnLeft ? { right: carW + 6, textAlign: 'right' } : { left: carW + 6 },
            ]}>
            {formatSteps(row.total_steps)}
          </Text>
        </View>
      </Animated.View>
    </>
  );
}

/** Vertical room one car needs: its name tag, the car, and a little air. */
const CAR_SLOT_H = (MAX_CAR_W * CAR_RATIO) + TAG_H + 14;

type RaceLayout = { xs: number[]; ys: number[]; travel: number; trackH: number };

/**
 * Places the cars (leader first). Height follows steps, but consecutive cars in the standings are
 * kept at least `minGap` apart so a close race never piles cars on top of each other; the track
 * grows to fit. Columns go centre-out by rank, so cars sharing a column are a full slot apart.
 */
function layoutRace(fractions: number[], width: number, carW: number, carH: number, baseTrackH: number): RaceLayout {
  const n = fractions.length;
  const slotW = Math.max(carW + 12, TAG_W * 0.8);
  const columns = Math.max(1, Math.floor((width - 16) / slotW));
  const extra = carH + TAG_H + 12;

  // Few enough cars for one each: spread evenly across, leader in the middle, alternating outward.
  if (n <= columns) {
    const travel = baseTrackH - extra;
    const spots = Array.from({ length: n }, (_, i) =>
      n === 1 ? width / 2 : 8 + slotW / 2 + (i * (width - 16 - slotW)) / (n - 1)
    );
    const mid = (n - 1) / 2;
    const order = spots
      .map((x, i) => ({ x, d: Math.abs(i - mid), side: i < mid ? 0 : 1 }))
      .sort((p, q) => p.d - q.d || p.side - q.side);
    return { xs: fractions.map((_, i) => order[i]!.x), ys: fractions.map((f) => f * travel), travel, trackH: baseTrackH };
  }

  // Neighbours in the standings sit in different columns, so they only need part of a slot between
  // them; any two cars `columns` apart share a column and end up a whole slot or more apart.
  const minGap = CAR_SLOT_H / Math.max(1, Math.floor(columns / 2));
  const travel = Math.max(baseTrackH - extra, (n - 1) * minGap);
  const trackH = travel + extra;

  // Keep each car within reach of its place (room above for everyone ahead, below for everyone
  // behind), then push down any car that's too close to the one ahead.
  const ys = fractions.map((f, i) => Math.min(Math.max(f * travel, (n - 1 - i) * minGap), travel - i * minGap));
  for (let i = 1; i < n; i++) ys[i] = Math.min(ys[i]!, ys[i - 1]! - minGap);

  const colX = Array.from(
    { length: columns },
    (_, c) => 8 + slotW / 2 + (c * (width - 16 - slotW)) / Math.max(1, columns - 1)
  );
  const center = (columns - 1) / 2;
  const centreOut = colX
    .map((x, c) => ({ x, d: Math.abs(c - center), side: c < center ? 0 : 1 }))
    .sort((p, q) => p.d - q.d || p.side - q.side)
    .map((c) => c.x);
  return { xs: fractions.map((_, i) => centreOut[i % columns]!), ys, travel, trackH };
}

/** Top-down F1 car pointing up, scaled from its width. */
function F1Car({ color, w, h, highlight }: { color: string; w: number; h: number; highlight: boolean }) {
  const wheelW = w * 0.22;
  const wheelH = h * 0.18;
  const bodyW = w * 0.38;
  return (
    <View style={{ width: w, height: h }}>
      <View style={[styles.abs, styles.wheel, { width: wheelW, height: wheelH, left: 0, bottom: h * 0.1 }]} />
      <View style={[styles.abs, styles.wheel, { width: wheelW, height: wheelH, right: 0, bottom: h * 0.1 }]} />
      <View style={[styles.abs, styles.wheel, { width: wheelW, height: wheelH * 0.9, left: w * 0.04, top: h * 0.2 }]} />
      <View style={[styles.abs, styles.wheel, { width: wheelW, height: wheelH * 0.9, right: w * 0.04, top: h * 0.2 }]} />
      {/* Rear wing */}
      <View style={[styles.abs, { backgroundColor: color, left: w * 0.1, right: w * 0.1, bottom: 0, height: h * 0.07, borderRadius: 1 }]} />
      {/* Body */}
      <View
        style={[
          styles.abs,
          {
            backgroundColor: color,
            width: bodyW,
            left: (w - bodyW) / 2,
            bottom: h * 0.06,
            height: h * 0.62,
            borderRadius: bodyW / 2,
          },
          highlight && { borderWidth: Math.max(1, w * 0.06), borderColor: '#FFFFFF' },
        ]}
      />
      {/* Nose */}
      <View
        style={[
          styles.abs,
          { backgroundColor: color, width: bodyW * 0.45, left: (w - bodyW * 0.45) / 2, top: h * 0.06, height: h * 0.34, borderRadius: bodyW },
        ]}
      />
      {/* Front wing */}
      <View style={[styles.abs, { backgroundColor: color, left: w * 0.06, right: w * 0.06, top: 0, height: h * 0.06, borderRadius: 1 }]} />
      {/* Cockpit */}
      <View
        style={[
          styles.abs,
          { backgroundColor: '#101010', width: bodyW * 0.6, left: (w - bodyW * 0.6) / 2, top: h * 0.46, height: h * 0.14, borderRadius: bodyW },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  track: { borderRadius: 16, overflow: 'hidden' },
  trail: { position: 'absolute', bottom: 6 },
  car: { position: 'absolute', bottom: 6, alignItems: 'center', gap: 2 },
  tag: {
    height: TAG_H - 2,
    maxWidth: TAG_W,
    paddingHorizontal: 6,
    borderRadius: 8,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  tagText: { color: '#FFFFFF', fontSize: 10, fontWeight: '600' },
  stepsGlow: {
    position: 'absolute',
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
    width: 64,
  },
  abs: { position: 'absolute' },
  wheel: { backgroundColor: '#0B0B0B', borderRadius: 2 },
  legend: { gap: 8, marginTop: 4 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  swatch: { width: 14, height: 14, borderRadius: 4 },
  legendName: { flex: 1 },
});
