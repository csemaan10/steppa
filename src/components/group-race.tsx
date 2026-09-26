import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getLeaderboard, type LeaderboardRow } from '@/lib/api';
import { formatSteps } from '@/lib/dates';

const TRACK_H = 420;
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
  const leader = Math.max(1, racers[0]?.total_steps ?? 0);
  const carW = MAX_CAR_W;
  const carH = carW * CAR_RATIO;
  const positions = placeCars(racers, leader, trackWidth, carW, carH);

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 16 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
      <View style={styles.header}>
        <MaterialCommunityIcons name="flag-checkered" size={20} color={theme.colors.onSurface} />
        <Text variant="titleMedium">Today&apos;s race</Text>
      </View>

      <View
        style={[styles.track, { backgroundColor: theme.dark ? '#1E2321' : '#2B302E' }]}
        onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}>
        {trackWidth > 0
          ? racers.map((row, i) => (
              <RaceCar
                key={`${row.user_id}:${lap}`}
                row={row}
                index={i}
                x={positions[i]!}
                fraction={row.total_steps / leader}
                carW={carW}
                carH={carH}
                isMe={row.user_id === userId}
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
  carW: number;
  carH: number;
  isMe: boolean;
};

function RaceCar({ row, index, x, fraction, carW, carH, isMe }: CarProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.set(withDelay(150 + index * 100, withSpring(fraction, { damping: 18, stiffness: 60 })));
  }, [progress, fraction, index]);

  const travel = TRACK_H - carH - TAG_H - 12;
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
        <F1Car color={row.avatar_color} w={carW} h={carH} highlight={isMe} />
      </Animated.View>
    </>
  );
}

/**
 * Picks an x for each car (leader first): the column whose nearest car at a similar height is furthest
 * away, preferring the centre. Keeps cars from overlapping without fixed lanes.
 */
function placeCars(rows: LeaderboardRow[], leader: number, width: number, carW: number, carH: number): number[] {
  if (width <= 0) return rows.map(() => 0);
  const slotW = Math.max(carW + 12, TAG_W * 0.8);
  const columns = Math.max(1, Math.floor((width - 16) / slotW));
  const colX = Array.from({ length: columns }, (_, c) => 8 + slotW / 2 + c * ((width - 16 - slotW) / Math.max(1, columns - 1)));
  if (columns === 1) colX[0] = width / 2;
  const center = (columns - 1) / 2;
  const travel = TRACK_H - carH - TAG_H - 12;

  // Room for everyone: give each car its own evenly spaced spot, leader in the middle, then
  // alternating left/right outward so neighbours in the standings are far apart.
  if (rows.length <= columns) {
    const n = rows.length;
    const spots = Array.from({ length: n }, (_, i) =>
      n === 1 ? width / 2 : 8 + slotW / 2 + (i * (width - 16 - slotW)) / (n - 1)
    );
    const mid = (n - 1) / 2;
    const order = spots
      .map((x, i) => ({ x, d: Math.abs(i - mid), side: i < mid ? 0 : 1 }))
      .sort((a, b) => a.d - b.d || a.side - b.side);
    return rows.map((_, i) => order[i]!.x);
  }

  const placed: { col: number; y: number }[] = [];

  return rows.map((row) => {
    const y = (row.total_steps / leader) * travel;
    let best = 0;
    let bestScore = -1;
    for (let c = 0; c < columns; c++) {
      const nearest = placed
        .filter((p) => p.col === c)
        .reduce((min, p) => Math.min(min, Math.abs(p.y - y)), Number.POSITIVE_INFINITY);
      // Cap the gap so empty columns tie, then break ties towards the centre.
      const score = Math.min(nearest, carH + TAG_H + 20) * 100 - Math.abs(c - center);
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }
    placed.push({ col: best, y });
    return colX[best]!;
  });
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
  track: { height: TRACK_H, borderRadius: 16, overflow: 'hidden' },
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
  abs: { position: 'absolute' },
  wheel: { backgroundColor: '#0B0B0B', borderRadius: 2 },
  legend: { gap: 8, marginTop: 4 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  swatch: { width: 14, height: 14, borderRadius: 4 },
  legendName: { flex: 1 },
});
