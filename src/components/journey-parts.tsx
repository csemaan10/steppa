import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { PostcardThumb } from '@/components/postcard';
import { SectionHeader } from '@/components/section-header';
import type { Progress, Route, Stop } from '@/lib/journeys';
import { useAppTheme } from '@/theme';

/** Pieces shared by solo journeys (the journey screen) and group journeys (a group's Journey tab). */

/** Every stop's postcard: open ones to tap, the rest showing how far away they are. */
export function PostcardCollection({
  route,
  progress,
  onOpen,
}: {
  route: Route;
  progress: Progress;
  onOpen: (stop: Stop) => void;
}) {
  return (
    <View style={styles.section}>
      <SectionHeader title="Postcards" note={`${progress.reached} of ${route.stops.length}`} />
      <View style={styles.grid}>
        {route.stops.map((stop, i) =>
          i < progress.reached ? (
            <PostcardThumb key={stop.name} route={route} stop={stop} index={i} onPress={() => onOpen(stop)} />
          ) : (
            <PostcardThumb key={stop.name} route={route} stop={stop} index={i} kmAway={stop.km - progress.km} />
          )
        )}
      </View>
    </View>
  );
}

export function Chip({ text }: { text: string }) {
  const theme = useAppTheme();
  return (
    <View style={[styles.chip, { backgroundColor: theme.colors.secondaryContainer }]}>
      <Text variant="labelMedium" style={{ color: theme.colors.onSecondaryContainer }}>
        {text}
      </Text>
    </View>
  );
}

/** Fills from empty when it first appears, then follows new progress. */
export function ProgressBar({ fraction }: { fraction: number }) {
  const theme = useAppTheme();
  const fill = useSharedValue(0);

  useEffect(() => {
    fill.set(withDelay(250, withTiming(fraction, { duration: 1400, easing: Easing.out(Easing.cubic) })));
  }, [fill, fraction]);

  const style = useAnimatedStyle(() => ({ width: `${Math.max(fill.value, 0.02) * 100}%` }));

  return (
    <View style={[styles.track, { backgroundColor: theme.colors.surfaceVariant }]}>
      <Animated.View style={[styles.fill, { backgroundColor: theme.colors.primary }, style]} />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 14 },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  track: { height: 10, borderRadius: 5, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5 },
});
