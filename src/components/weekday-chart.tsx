import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

import type { DaySteps } from '@/lib/api';
import { formatSteps } from '@/lib/dates';

const LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const NAMES = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];

/** Average steps per weekday over the given history. */
export function weekdayAverages(history: DaySteps[]): number[] {
  const sums = Array(7).fill(0);
  const counts = Array(7).fill(0);
  for (const d of history) {
    if (d.steps <= 0) continue;
    const dow = new Date(`${d.day}T12:00:00`).getDay();
    sums[dow] += d.steps;
    counts[dow] += 1;
  }
  return sums.map((s, i) => (counts[i] ? Math.round(s / counts[i]) : 0));
}

export function WeekdayChart({ history }: { history: DaySteps[] }) {
  const theme = useTheme();
  const averages = weekdayAverages(history);
  const max = Math.max(1, ...averages);
  const bestIndex = averages.indexOf(Math.max(...averages));
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <View style={styles.wrap}>
      <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
        You walk the most on{' '}
        <Text variant="bodyMedium" style={{ color: theme.colors.primary, fontWeight: '700' }}>
          {NAMES[bestIndex]}
        </Text>{' '}
        · avg {formatSteps(averages[bestIndex]!)}
      </Text>
      <View style={styles.chart}>
        {averages.map((avg, i) => {
          const barHeight = Math.max(4, (avg / max) * 80);
          const isSelected = selected === i;
          return (
            <Pressable
              key={i}
              style={styles.column}
              onPress={() => setSelected(isSelected ? null : i)}
              accessibilityLabel={`${NAMES[i]}: average ${formatSteps(avg)} steps`}>
              {isSelected ? (
                <View pointerEvents="none" style={[styles.tooltipWrap, { bottom: barHeight + 22 }]}>
                  <View style={[styles.tooltip, { backgroundColor: theme.colors.inverseSurface }]}>
                    <Text variant="labelMedium" style={{ color: theme.colors.inverseOnSurface }}>
                      {formatSteps(avg)}
                    </Text>
                  </View>
                </View>
              ) : null}
              <View
                style={[
                  styles.bar,
                  {
                    height: barHeight,
                    backgroundColor: i === bestIndex ? theme.colors.primary : theme.colors.secondaryContainer,
                    opacity: selected === null || isSelected ? 1 : 0.4,
                  },
                ]}
              />
              <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                {LABELS[i]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 130 },
  tooltipWrap: { position: 'absolute', left: -30, right: -30, alignItems: 'center', zIndex: 1 },
  tooltip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  column: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  bar: { width: '70%', maxWidth: 24, borderRadius: 8 },
});
