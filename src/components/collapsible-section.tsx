import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Icon, Text, useTheme } from 'react-native-paper';
import Animated, { FadeIn } from 'react-native-reanimated';

type Props = {
  title: string;
  /** What's picked, shown on the right while collapsed. */
  summary?: string;
  /** Shown next to the summary, e.g. a colour swatch. */
  accessory?: ReactNode;
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
};

/** A tappable header that shows or hides its options, for keeping long settings cards short. */
export function CollapsibleSection({ title, summary, accessory, expanded, onToggle, children }: Props) {
  const theme = useTheme();
  return (
    <View style={[styles.box, { borderColor: theme.colors.outlineVariant }]}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={summary ? `${title}: ${summary}` : title}
        style={styles.header}>
        <Text variant="titleSmall" style={styles.title}>
          {title}
        </Text>
        <View style={styles.spacer} />
        {accessory}
        {summary ? (
          <Text variant="bodyMedium" numberOfLines={1} style={[styles.summary, { color: theme.colors.onSurfaceVariant }]}>
            {summary}
          </Text>
        ) : null}
        <Icon source={expanded ? 'chevron-up' : 'chevron-down'} size={22} color={theme.colors.onSurfaceVariant} />
      </Pressable>
      {expanded ? (
        <Animated.View entering={FadeIn.duration(180)} style={styles.body}>
          {children}
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 12 },
  title: { flexShrink: 0 },
  spacer: { flex: 1 },
  summary: { flexShrink: 1, textAlign: 'right' },
  body: { gap: 14, paddingHorizontal: 14, paddingBottom: 14 },
});
