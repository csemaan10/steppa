import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

import type { DaySteps } from '@/lib/api';
import { formatSteps, shortWeekday } from '@/lib/dates';

type Series = { name: string; color: string; data: DaySteps[] };

type Props = { series: Series[]; goal?: number; height?: number };

export function WeekChart({ series, goal, height = 140 }: Props) {
  const theme = useTheme();
  const days = series[0]?.data ?? [];
  const max = Math.max(goal ?? 0, 1, ...series.flatMap((s) => s.data.map((d) => d.steps)));
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <View style={{ paddingTop: series.length > 1 ? 52 : 36 }}>
      <View style={[styles.chart, { height }]}>
        {goal ? (
          <View
            style={[
              styles.goalLine,
              { bottom: (goal / max) * height, borderColor: theme.colors.outline },
            ]}
          />
        ) : null}
        {days.map((day, i) => {
          const isSelected = selected === i;
          const tallest = Math.max(...series.map((s) => Math.max(4, (s.data[i]!.steps / max) * height)));
          return (
            <Pressable
              key={day.day}
              style={styles.column}
              onPress={() => setSelected(isSelected ? null : i)}
              accessibilityLabel={`${shortWeekday(new Date(`${day.day}T12:00:00`))}: ${series
                .map((s) => `${s.name} ${formatSteps(s.data[i]!.steps)}`)
                .join(', ')}`}>
              {series.map((s) => (
                <View
                  key={s.name}
                  style={[
                    styles.bar,
                    {
                      height: Math.max(4, (s.data[i]!.steps / max) * height),
                      backgroundColor: s.color,
                      opacity: selected === null || isSelected ? 1 : 0.35,
                    },
                  ]}
                />
              ))}
              {isSelected ? (
                <View pointerEvents="none" style={[styles.tooltipWrap, { bottom: tallest + 6 }]}>
                  <View style={[styles.tooltip, { backgroundColor: theme.colors.inverseSurface }]}>
                    {series.map((s) => (
                      <Text key={s.name} variant="labelMedium" style={{ color: theme.colors.inverseOnSurface }}>
                        {series.length > 1 ? `${s.name}: ` : ''}
                        {formatSteps(s.data[i]!.steps)}
                      </Text>
                    ))}
                  </View>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
      <View style={styles.labels}>
        {days.map((day) => (
          <Text
            key={day.day}
            variant="labelSmall"
            style={[styles.label, { color: theme.colors.onSurfaceVariant }]}>
            {shortWeekday(new Date(`${day.day}T12:00:00`))}
          </Text>
        ))}
      </View>
      {series.length > 1 ? (
        <View style={styles.legend}>
          {series.map((s) => (
            <View key={s.name} style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: s.color }]} />
              <Text variant="labelMedium">{s.name}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tooltipWrap: { position: 'absolute', left: -40, right: -40, alignItems: 'center', zIndex: 1 },
  tooltip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, alignItems: 'center' },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  column: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 3 },
  bar: { flex: 1, maxWidth: 22, borderRadius: 8 },
  goalLine: { position: 'absolute', left: 0, right: 0, borderTopWidth: 1, borderStyle: 'dashed' },
  labels: { flexDirection: 'row', gap: 8, marginTop: 6 },
  label: { flex: 1, textAlign: 'center' },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
