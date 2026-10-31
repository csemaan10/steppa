import { useEffect, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Card, Icon, Text } from 'react-native-paper';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  interpolate,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { usePressed } from '@/hooks/use-pressed';
import { glassCard, useAppTheme } from '@/theme';

/** Material's standard easing, for opening and closing. */
const STANDARD = Easing.bezier(0.2, 0, 0, 1);

/**
 * A section folded down to a line or two: its title, a count on the right and a summary underneath,
 * with something small beside it (a progress bar, a postcard). Tap it to open the whole section
 * inside the card; tap again to fold it.
 */
export function PreviewCard({
  title,
  icon,
  note,
  summary,
  below,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  /** Beside the title: a flag. */
  icon?: ReactNode;
  /** A count on the right: "3 of 8". */
  note?: string;
  summary: string;
  /** Under the summary, in the folded card too (a progress bar). */
  below?: ReactNode;
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const theme = useAppTheme();
  const muted = { color: theme.colors.onSurfaceVariant };
  const { pressed, onPressIn, onPressOut } = usePressed();
  const open = useSharedValue(expanded ? 1 : 0);
  useEffect(() => {
    open.set(withTiming(expanded ? 1 : 0, { duration: 250, easing: STANDARD }));
  }, [open, expanded]);
  const chevron = useAnimatedStyle(() => ({ transform: [{ rotate: `${open.get() * 180}deg` }] }));
  const press = useAnimatedStyle(() => ({ transform: [{ scale: interpolate(pressed.get(), [0, 1], [1, 0.98]) }] }));

  return (
    <Animated.View layout={LinearTransition.duration(250).easing(STANDARD)} style={press}>
      <Card mode="contained" style={glassCard(theme)}>
        <Pressable
          onPress={onToggle}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={`${title}. ${summary}`}
          style={styles.head}>
          <View style={styles.text}>
            <View style={[styles.titleRow, icon ? styles.centered : null]}>
              <View style={styles.titleStart}>
                {icon}
                <Text variant="titleMedium" style={styles.title}>
                  {title}
                </Text>
              </View>
              {note ? (
                <Text variant="labelMedium" style={muted}>
                  {note.toUpperCase()}
                </Text>
              ) : null}
            </View>
            <Text variant="bodyMedium" numberOfLines={expanded ? undefined : 1} style={muted}>
              {summary}
            </Text>
            {below}
          </View>
          <Animated.View style={chevron}>
            <Icon source="chevron-down" size={22} color={theme.colors.onSurfaceVariant} />
          </Animated.View>
        </Pressable>
        {expanded ? (
          <Animated.View entering={FadeIn.duration(200).delay(80)} exiting={FadeOut.duration(120)} style={styles.body}>
            {children}
          </Animated.View>
        ) : null}
      </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  text: { flex: 1, gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  centered: { alignItems: 'center' },
  titleStart: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  title: { fontWeight: '700' },
  body: { paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
});
