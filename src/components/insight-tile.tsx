import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, ProgressBar, Text } from 'react-native-paper';

import { useAppTheme } from '@/theme';

type Props = {
  label: string;
  value: string;
  supporting: string;
  /** Fraction of a target; renders a linear progress indicator. */
  progress?: number;
  children?: ReactNode;
};

/** Material 3 filled card: label, headline value, optional linear progress, supporting text. */
export function InsightTile({ label, value, supporting, progress, children }: Props) {
  const theme = useAppTheme();

  return (
    <Card mode="contained" style={[styles.card, { backgroundColor: theme.colors.elevation.level2 }]}>
      <Card.Content style={styles.content}>
        <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>
          {label}
        </Text>
        <Text variant="headlineSmall" style={{ color: theme.colors.onSurface }}>
          {value}
        </Text>
        {progress !== undefined ? (
          <ProgressBar
            progress={Math.min(Math.max(progress, 0), 1)}
            color={theme.colors.primary}
            style={[styles.progress, { backgroundColor: theme.colors.surfaceVariant }]}
          />
        ) : null}
        {children}
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          {supporting}
        </Text>
      </Card.Content>
    </Card>
  );
}

/** Segmented indicator: one segment per day, filled when that day's goal was met. */
export function GoalSegments({ hits, labels }: { hits: boolean[]; labels: string[] }) {
  const theme = useAppTheme();
  return (
    <View style={styles.segments}>
      {hits.map((hit, i) => (
        <View key={i} style={styles.segmentColumn}>
          <View
            style={[
              styles.segment,
              { backgroundColor: hit ? theme.colors.primary : theme.colors.surfaceVariant },
            ]}
          />
          <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {labels[i]}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1 },
  content: { gap: 6, paddingVertical: 16 },
  progress: { height: 4, borderRadius: 2, marginVertical: 4 },
  segments: { flexDirection: 'row', gap: 4, marginVertical: 4 },
  segmentColumn: { flex: 1, alignItems: 'center', gap: 4 },
  segment: { alignSelf: 'stretch', height: 4, borderRadius: 2 },
});
