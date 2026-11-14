import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Card, IconButton, Text, useTheme } from 'react-native-paper';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { SwapText } from '@/components/swap-text';
import { usePressed } from '@/hooks/use-pressed';
import { activeAverage, getMonthSteps, type DaySteps } from '@/lib/api';
import { addDays, formatSteps, toDayKey } from '@/lib/dates';
import { glassCard } from '@/theme';
import { motion } from '@/theme/motion';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function shortSteps(steps: number): string {
  if (steps >= 10000) return `${Math.round(steps / 1000)}k`;
  if (steps >= 1000) return `${(steps / 1000).toFixed(1)}k`;
  return String(steps);
}

const monthKey = (year: number, month: number) => `${year}-${month}`;

/** Zero-filled placeholder so a new month renders instantly while its data loads. */
function emptyMonth(year: number, month: number): DaySteps[] {
  const first = new Date(year, month, 1);
  const count = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: count }, (_, i) => ({ day: toDayKey(addDays(first, i)), steps: 0 }));
}

type Props = { userId: string; goal: number };

/**
 * Day-by-day steps for a month: a heat strip when collapsed, a calendar when expanded. Opening and
 * closing grow the card on a spring while the two views crossfade; stepping to another month fades
 * its days in with a slight rise, and the title and totals crossfade.
 */
export function MonthCard({ userId, goal }: Props) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const now = new Date();
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [expanded, setExpanded] = useState(false);
  const [months, setMonths] = useState<Record<string, DaySteps[]>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [heights, setHeights] = useState({ strip: 0, grid: 0 });
  const requested = useRef(new Set<string>());

  // Fetch the visible month plus the previous one, so stepping back feels instant.
  useEffect(() => {
    let active = true;
    for (const offset of [0, -1]) {
      const d = new Date(cursor.year, cursor.month + offset, 1);
      const key = monthKey(d.getFullYear(), d.getMonth());
      if (offset !== 0 && requested.current.has(key)) continue;
      requested.current.add(key);
      getMonthSteps(userId, d.getFullYear(), d.getMonth())
        .then((data) => active && setMonths((m) => ({ ...m, [key]: data })))
        .catch(() => requested.current.delete(key));
    }
    return () => {
      active = false;
    };
  }, [userId, cursor.year, cursor.month]);

  const days = months[monthKey(cursor.year, cursor.month)] ?? emptyMonth(cursor.year, cursor.month);
  const isCurrentMonth = cursor.year === now.getFullYear() && cursor.month === now.getMonth();
  const todayKey = toDayKey(now);
  const elapsed = days.filter((d) => d.day <= todayKey);
  const total = elapsed.reduce((s, d) => s + d.steps, 0);
  const average = activeAverage(total, elapsed.filter((d) => d.steps > 0).length);
  const goalDays = elapsed.filter((d) => d.steps >= goal).length;
  const leadingBlanks = new Date(cursor.year, cursor.month, 1).getDay();
  const title = new Date(cursor.year, cursor.month, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
  const selectedDay = days.find((d) => d.day === selected);

  const measured = heights.strip > 0 && heights.grid > 0;
  // The body's height and the grid's slide spring from wherever they are, so a quick second tap
  // turns them round; the two views crossfade, the leaving one faster.
  const height = useSharedValue(0);
  const open = useSharedValue(expanded ? 1 : 0);
  const gridFade = useSharedValue(expanded ? 1 : 0);
  useEffect(() => {
    if (!measured) return;
    const target = expanded ? heights.grid : heights.strip;
    // The first measurement just sets the size; after that, opening, closing and a month with
    // more or fewer weeks all spring there.
    if (height.get() === 0) height.set(target);
    else height.set(withSpring(target, expanded ? motion.expand : motion.collapse));
  }, [height, expanded, measured, heights.grid, heights.strip]);
  useEffect(() => {
    open.set(withSpring(expanded ? 1 : 0, expanded ? motion.expand : motion.collapse));
    gridFade.set(withTiming(expanded ? 1 : 0, expanded ? motion.fade : motion.fadeOut));
  }, [open, gridFade, expanded]);

  const bodyStyle = useAnimatedStyle(() => ({ height: height.value }));
  const gridStyle = useAnimatedStyle(() => ({
    opacity: gridFade.value,
    transform: [{ translateY: reduceMotion ? 0 : (1 - open.value) * -8 }],
  }));
  const stripStyle = useAnimatedStyle(() => ({ opacity: 1 - gridFade.value }));
  const chevronStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${open.value * 180}deg` }] }));

  // Another month's days fade in with a slight rise. Started on the tap itself, so the old month is
  // already fading as the new one renders, and it never shows at full strength in between.
  const arrive = useSharedValue(1);
  const rise = useSharedValue(0);
  const daysStyle = useAnimatedStyle(() => ({ opacity: arrive.value, transform: [{ translateY: rise.value }] }));

  function shift(delta: number) {
    const d = new Date(cursor.year, cursor.month + delta, 1);
    setCursor({ year: d.getFullYear(), month: d.getMonth() });
    setSelected(null);
    arrive.set(0);
    arrive.set(withTiming(1, motion.fade));
    rise.set(reduceMotion ? 0 : 6);
    rise.set(withSpring(0, motion.smooth));
  }

  function cellColors(day: DaySteps) {
    if (day.day > todayKey) return { bg: 'transparent', fg: theme.colors.outline, opacity: 1 };
    if (day.steps >= goal) return { bg: theme.colors.primary, fg: theme.colors.onPrimary, opacity: 1 };
    if (day.steps === 0) return { bg: theme.colors.surfaceVariant, fg: theme.colors.onSurfaceVariant, opacity: 1 };
    return {
      bg: theme.colors.primaryContainer,
      fg: theme.colors.onPrimaryContainer,
      opacity: 0.35 + 0.65 * (day.steps / goal),
    };
  }

  return (
    <Card mode="contained" style={glassCard(theme)}>
      <Pressable onPress={() => setExpanded((e) => !e)} accessibilityRole="button" accessibilityState={{ expanded }}>
        <View style={styles.header}>
          <DipIconButton icon="chevron-left" size={20} onPress={() => shift(-1)} accessibilityLabel="Previous month" />
          <View style={styles.headerText}>
            <SwapText variant="titleMedium" numberOfLines={1} style={styles.centered}>
              {title}
            </SwapText>
            <SwapText variant="bodySmall" numberOfLines={1} style={[styles.centered, { color: theme.colors.onSurfaceVariant }]}>
              {`${formatSteps(total)} steps · avg ${formatSteps(average)} · ${goalDays} goal days`}
            </SwapText>
          </View>
          <DipIconButton
            icon="chevron-right"
            size={20}
            disabled={isCurrentMonth}
            onPress={() => shift(1)}
            accessibilityLabel="Next month"
          />
          <DipIconButton
            icon="chevron-down"
            size={22}
            iconStyle={chevronStyle}
            onPress={() => setExpanded((e) => !e)}
            accessibilityLabel={expanded ? 'Collapse' : 'Expand'}
          />
        </View>
      </Pressable>

      {/* Both views stay mounted and measured; the container animates between their heights. */}
      <Animated.View style={[styles.body, measured && bodyStyle]}>
        <Animated.View
          style={[styles.layer, stripStyle]}
          pointerEvents={expanded ? 'none' : 'auto'}
          onLayout={(e) => {
            const h = e.nativeEvent.layout.height;
            setHeights((prev) => (prev.strip === h ? prev : { ...prev, strip: h }));
          }}>
          <Animated.View style={[styles.strip, daysStyle]}>
            {days.map((day) => {
              const c = cellColors(day);
              return (
                <View
                  key={day.day}
                  style={[
                    styles.stripCell,
                    { backgroundColor: c.bg === 'transparent' ? theme.colors.surfaceVariant : c.bg },
                    { opacity: day.day > todayKey ? 0.35 : c.opacity },
                  ]}
                />
              );
            })}
          </Animated.View>
        </Animated.View>

        <Animated.View
          style={[styles.layer, gridStyle]}
          pointerEvents={expanded ? 'auto' : 'none'}
          onLayout={(e) => {
            const h = e.nativeEvent.layout.height;
            setHeights((prev) => (prev.grid === h ? prev : { ...prev, grid: h }));
          }}>
          <Animated.View style={[styles.grid, daysStyle]}>
            {WEEKDAYS.map((w, i) => (
              <Text key={i} variant="labelSmall" style={[styles.weekday, { color: theme.colors.onSurfaceVariant }]}>
                {w}
              </Text>
            ))}
            {Array.from({ length: leadingBlanks }, (_, i) => (
              <View key={`blank-${i}`} style={styles.cell} />
            ))}
            {days.map((day) => {
              const c = cellColors(day);
              const isToday = day.day === todayKey;
              const isSelected = day.day === selected;
              return (
                <Pressable
                  key={day.day}
                  style={styles.cell}
                  onPress={() => setSelected(isSelected ? null : day.day)}
                  accessibilityLabel={`${day.day}: ${formatSteps(day.steps)} steps`}>
                  {/* Border width is constant so selecting never changes layout. */}
                  <View
                    style={[
                      styles.cellInner,
                      { borderColor: isSelected || isToday ? theme.colors.primary : 'transparent' },
                    ]}>
                    <View
                      style={[StyleSheet.absoluteFill, styles.cellBg, { backgroundColor: c.bg, opacity: c.opacity }]}
                    />
                    <Text variant="labelSmall" style={{ color: c.fg, opacity: 0.8 }}>
                      {Number(day.day.slice(8))}
                    </Text>
                    {day.day <= todayKey ? (
                      <Text
                        variant="labelMedium"
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.6}
                        style={[styles.cellSteps, { color: c.fg }]}>
                        {shortSteps(day.steps)}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </Animated.View>
          <Text
            variant="bodyMedium"
            numberOfLines={1}
            style={[styles.selected, !selectedDay && { color: theme.colors.onSurfaceVariant }]}>
            {selectedDay ? (
              <>
                {new Date(`${selectedDay.day}T12:00:00`).toLocaleDateString(undefined, {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric',
                })}
                : <Text style={{ fontWeight: '700' }}>{formatSteps(selectedDay.steps)} steps</Text>
              </>
            ) : (
              'Tap a day to see its steps'
            )}
          </Text>
        </Animated.View>
      </Animated.View>
    </Card>
  );
}

type DipProps = ComponentProps<typeof IconButton> & { iconStyle?: ComponentProps<typeof Animated.View>['style'] };

/**
 * Paper's icon button with the app's press: it dips on touch-down and springs back on release.
 * `iconStyle` animates the button inside the dip, e.g. to turn the chevron.
 */
function DipIconButton({ iconStyle, ...props }: DipProps) {
  const press = usePressed();
  const dip = useAnimatedStyle(() => ({ transform: [{ scale: interpolate(press.pressed.value, [0, 1], [1, 0.92]) }] }));
  return (
    <Animated.View style={dip}>
      <Animated.View style={iconStyle}>
        <IconButton {...props} onPressIn={press.onPressIn} onPressOut={press.onPressOut} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  headerText: { flex: 1 },
  centered: { textAlign: 'center' },
  body: { overflow: 'hidden', marginHorizontal: 16, marginBottom: 16 },
  layer: { position: 'absolute', top: 0, left: 0, right: 0 },
  strip: { flexDirection: 'row', gap: 2, height: 28 },
  stripCell: { flex: 1, borderRadius: 3 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: { width: `${100 / 7}%`, textAlign: 'center', marginBottom: 6 },
  cell: { width: `${100 / 7}%`, aspectRatio: 0.9, padding: 2 },
  cellInner: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cellBg: { borderRadius: 8 },
  cellSteps: {
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: -0.2,
    paddingHorizontal: 2,
    alignSelf: 'stretch',
    textAlign: 'center',
  },
  selected: { textAlign: 'center', marginTop: 12 },
});
