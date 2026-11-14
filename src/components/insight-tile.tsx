import { useRef, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { ProgressBar, Text } from 'react-native-paper';

import type { Rect } from '@/components/expanding-card';
import { PressableScale } from '@/components/pressable-scale';
import { SwapText } from '@/components/swap-text';
import { glassCard, useAppTheme } from '@/theme';

type Props = {
  label: string;
  value: string;
  supporting: string;
  /** Fraction of a target; renders a linear progress indicator. */
  progress?: number;
  /** Makes the tile a button; gets the tile's place on screen, for a detail card to grow out of. */
  onPress?: (origin: Rect) => void;
  /** With `onLayout`, lets a grid of tiles all match the tallest one. */
  minHeight?: number;
  onLayout?: (e: LayoutChangeEvent) => void;
  children?: ReactNode;
};

/**
 * Compact frosted glass tile: label, headline value, optional linear progress, supporting text.
 * A plain view rather than Paper's Card: on iOS the Card draws its background on an inner layer that
 * doesn't stretch, so a tile beside a taller one stayed short.
 */
export function InsightTile({ label, value, supporting, progress, onPress, minHeight, onLayout, children }: Props) {
  const theme = useAppTheme();
  const ref = useRef<View>(null);
  const size = { minHeight };

  const card = (
    <View style={[styles.flex, glassCard(theme), styles.content, !onPress && size]} onLayout={onPress ? undefined : onLayout}>
      <Text variant="labelMedium" numberOfLines={1} style={{ color: theme.colors.onSurfaceVariant }}>
        {label}
      </Text>
      {/* A new value (after a sync) crossfades in rather than flickering over. */}
      <SwapText variant="titleLarge" numberOfLines={1} adjustsFontSizeToFit style={[styles.value, { color: theme.colors.onSurface }]}>
        {value}
      </SwapText>
      {progress !== undefined ? (
        <ProgressBar
          progress={Math.min(Math.max(progress, 0), 1)}
          color={theme.colors.primary}
          style={[styles.progress, { backgroundColor: theme.colors.surfaceVariant }]}
        />
      ) : null}
      {children}
      <Text variant="labelSmall" numberOfLines={1} style={[styles.supporting, { color: theme.colors.onSurfaceVariant }]}>
        {supporting}
      </Text>
    </View>
  );
  if (!onPress) return card;

  // The ref is on a plain view outside the press dip, so the measured rect is the tile at rest.
  return (
    <View ref={ref} collapsable={false} style={[styles.flex, size]} onLayout={onLayout}>
      <PressableScale
        onPress={() => ref.current?.measureInWindow((x, y, width, height) => onPress({ x, y, width, height }))}
        pressedScale={0.96}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value}`}
        accessibilityHint="Opens more detail"
        style={styles.flex}>
        {card}
      </PressableScale>
    </View>
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
  flex: { flex: 1 },
  content: { gap: 2, paddingHorizontal: 14, paddingVertical: 12 },
  // Any extra height from matching a taller tile goes above the last line, so labels and values line
  // up along the top of a row of tiles and the supporting text along the bottom.
  supporting: { marginTop: 'auto' },
  value: { fontWeight: '700' },
  progress: { height: 4, borderRadius: 2, marginVertical: 3 },
  segments: { flexDirection: 'row', gap: 4, marginVertical: 2 },
  segmentColumn: { flex: 1, alignItems: 'center', gap: 2 },
  segment: { alignSelf: 'stretch', height: 4, borderRadius: 2 },
});
