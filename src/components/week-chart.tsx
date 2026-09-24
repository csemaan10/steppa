import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

import type { DaySteps } from '@/lib/api';
import { shortWeekday } from '@/lib/dates';

type Series = { name: string; color: string; data: DaySteps[] };

type Props = { series: Series[]; goal?: number; height?: number };

export function WeekChart({ series, goal, height = 140 }: Props) {
  const theme = useTheme();
  const days = series[0]?.data ?? [];
  const max = Math.max(goal ?? 0, 1, ...series.flatMap((s) => s.data.map((d) => d.steps)));

  return (
    <View>
      <View style={[styles.chart, { height }]}>
        {goal ? (
          <View
            style={[
              styles.goalLine,
              { bottom: (goal / max) * height, borderColor: theme.colors.outline },
            ]}
          />
        ) : null}
        {days.map((day, i) => (
          <View key={day.day} style={styles.column}>
            {series.map((s) => (
              <View
                key={s.name}
                style={[
                  styles.bar,
                  {
                    height: Math.max(4, (s.data[i]!.steps / max) * height),
                    backgroundColor: s.color,
                  },
                ]}
              />
            ))}
          </View>
        ))}
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
