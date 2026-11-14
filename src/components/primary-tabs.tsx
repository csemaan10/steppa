import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, useState, type ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring, type SharedValue } from 'react-native-reanimated';

import { motion } from '@/theme/motion';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export type PrimaryTab<T extends string> = {
  value: T;
  label: string;
  icon: IconName;
  activeIcon?: IconName;
  /** Small red dot on the icon (Material 3 small badge), e.g. for unread messages. */
  badge?: boolean;
};

type Props<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  tabs: PrimaryTab<T>[];
  /** Live tab position (0 = first tab, may be between tabs): the indicator follows it, e.g. while swiping pages. */
  position?: SharedValue<number>;
};

type Box = { x: number; width: number };

/**
 * Material 3 primary tabs: icon over label, with an indicator that slides under the active tab's content.
 * The indicator and the tab colours both follow one position, so they move together: a pager's live
 * position while swiping, or otherwise one of the tabs' own that springs to the chosen tab.
 */
export function PrimaryTabs<T extends string>({ value, onChange, tabs, position }: Props<T>) {
  const theme = useTheme();
  const [tabBoxes, setTabBoxes] = useState<Partial<Record<T, Box>>>({});
  const [contentBoxes, setContentBoxes] = useState<Partial<Record<T, Box>>>({});

  const index = Math.max(0, tabs.findIndex((t) => t.value === value));
  const own = useSharedValue(index);
  useEffect(() => {
    own.set(withSpring(index, motion.spatial));
  }, [own, index]);
  const live = position ?? own;

  // Every tab's indicator spot, once all are measured, so the position can slide between them.
  const spots = tabs.map((t) => {
    const tb = tabBoxes[t.value];
    const cb = contentBoxes[t.value];
    return tb && cb ? { x: tb.x + cb.x, width: cb.width } : null;
  });
  const measured = spots.every((s) => s !== null);
  const steps = tabs.map((_, i) => i);
  const xs = spots.map((s) => s?.x ?? 0);
  const widths = spots.map((s) => s?.width ?? 0);
  // The bar is drawn at the widest tab's width and scaled down to each, so it only ever moves by
  // transform (no layout per frame).
  const base = Math.max(1, ...widths);

  const indicatorStyle = useAnimatedStyle(() => {
    const x = interpolate(live.value, steps, xs, 'clamp');
    const w = interpolate(live.value, steps, widths, 'clamp');
    return { transform: [{ translateX: x + (w - base) / 2 }, { scaleX: w / base }] };
  });

  return (
    <View style={[styles.bar, { borderBottomColor: theme.colors.outlineVariant }]} accessibilityRole="tablist">
      {tabs.map((t, i) => (
        <Tab
          key={t.value}
          tab={t}
          index={i}
          live={live}
          active={t.value === value}
          onPress={() => onChange(t.value)}
          onTabLayout={(box) => setTabBoxes((b) => ({ ...b, [t.value]: box }))}
          onContentLayout={(box) => setContentBoxes((b) => ({ ...b, [t.value]: box }))}
        />
      ))}
      {measured ? (
        <Animated.View
          style={[styles.indicator, { width: base, backgroundColor: theme.colors.primary }, indicatorStyle]}
        />
      ) : null}
    </View>
  );
}

type TabProps<T extends string> = {
  tab: PrimaryTab<T>;
  index: number;
  live: SharedValue<number>;
  active: boolean;
  onPress: () => void;
  onTabLayout: (box: Box) => void;
  onContentLayout: (box: Box) => void;
};

/**
 * One tab. Its active colours sit over the inactive ones and fade in as the position reaches it, so
 * the colour moves in step with the indicator instead of switching when the tap lands.
 */
function Tab<T extends string>({ tab: t, index, live, active, onPress, onTabLayout, onContentLayout }: TabProps<T>) {
  const theme = useTheme();
  const on = useAnimatedStyle(() => ({ opacity: Math.max(0, 1 - Math.abs(live.value - index)) }));
  const label = (color: string) => (
    <Text variant="titleSmall" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ color }}>
      {t.label}
    </Text>
  );

  return (
    <Pressable
      style={styles.tab}
      onPress={onPress}
      onLayout={(e) => {
        const { x, width } = e.nativeEvent.layout;
        onTabLayout({ x, width });
      }}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={t.badge ? `${t.label}, new activity` : t.label}>
      <View
        style={styles.content}
        onLayout={(e) => {
          const { x, width } = e.nativeEvent.layout;
          onContentLayout({ x, width });
        }}>
        <View>
          <MaterialCommunityIcons name={t.icon} size={24} color={theme.colors.onSurfaceVariant} />
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, on]}>
            <MaterialCommunityIcons name={t.activeIcon ?? t.icon} size={24} color={theme.colors.primary} />
          </Animated.View>
          {t.badge ? <View style={[styles.badge, { backgroundColor: theme.colors.error }]} /> : null}
        </View>
        <View>
          {label(theme.colors.onSurfaceVariant)}
          <Animated.View
            pointerEvents="none"
            importantForAccessibility="no-hide-descendants"
            accessibilityElementsHidden
            style={[StyleSheet.absoluteFill, on]}>
            {label(theme.colors.primary)}
          </Animated.View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', height: 64 },
  content: { alignItems: 'center', gap: 2, paddingHorizontal: 4 },
  badge: { position: 'absolute', top: 0, right: -2, width: 8, height: 8, borderRadius: 4 },
  indicator: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    height: 3,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
});
