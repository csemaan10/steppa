import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Icon, Text, useTheme } from 'react-native-paper';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { Collapsible } from '@/components/collapsible';
import { PressableScale } from '@/components/pressable-scale';
import { SwapText } from '@/components/swap-text';
import { motion } from '@/theme/motion';

type Props = {
  title: string;
  /** What's picked, shown on the right while collapsed. */
  summary?: string;
  /** Shown next to the summary, e.g. a colour swatch. */
  accessory?: ReactNode;
  expanded: boolean;
  onToggle: () => void;
  onLayout?: (e: LayoutChangeEvent) => void;
  children: ReactNode;
};

/**
 * A tappable header that shows or hides its options, for keeping long settings cards short. The
 * header dips while held, and the summary crossfades when a pick inside changes it.
 */
export function CollapsibleSection({ title, summary, accessory, expanded, onToggle, onLayout, children }: Props) {
  const theme = useTheme();
  return (
    <View style={[styles.box, { borderColor: theme.colors.outlineVariant }]} onLayout={onLayout}>
      <PressableScale
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
          <View style={styles.summary}>
            <SwapText variant="bodyMedium" numberOfLines={1} style={[styles.summaryText, { color: theme.colors.onSurfaceVariant }]}>
              {summary}
            </SwapText>
          </View>
        ) : null}
        <Chevron expanded={expanded} color={theme.colors.onSurfaceVariant} />
      </PressableScale>
      <Collapsible expanded={expanded} style={styles.body}>
        {children}
      </Collapsible>
    </View>
  );
}

/** A down chevron that turns to point up while its section is open. */
export function Chevron({ expanded, color, size = 22 }: { expanded: boolean; color: string; size?: number }) {
  const turn = useSharedValue(expanded ? 1 : 0);
  useEffect(() => {
    turn.set(withSpring(expanded ? 1 : 0, motion.spatial));
  }, [turn, expanded]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 180}deg` }] }));
  return (
    <Animated.View style={style}>
      <Icon source="chevron-down" size={size} color={color} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 12 },
  title: { flexShrink: 0 },
  spacer: { flex: 1 },
  summary: { flexShrink: 1 },
  summaryText: { textAlign: 'right' },
  body: { gap: 14, paddingHorizontal: 14, paddingBottom: 14 },
});
