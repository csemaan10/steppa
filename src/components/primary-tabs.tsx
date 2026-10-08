import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState, type ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export type PrimaryTab<T extends string> = {
  value: T;
  label: string;
  icon: IconName;
  activeIcon?: IconName;
  /** Small red dot on the icon (Material 3 small badge), e.g. for unread messages. */
  badge?: boolean;
};

type Props<T extends string> = { value: T; onChange: (value: T) => void; tabs: PrimaryTab<T>[] };

type Box = { x: number; width: number };

/** Material 3 primary tabs: icon over label, with an indicator that slides under the active tab's content. */
export function PrimaryTabs<T extends string>({ value, onChange, tabs }: Props<T>) {
  const theme = useTheme();
  const [tabBoxes, setTabBoxes] = useState<Partial<Record<T, Box>>>({});
  const [contentBoxes, setContentBoxes] = useState<Partial<Record<T, Box>>>({});

  const tab = tabBoxes[value];
  const content = contentBoxes[value];
  const x = (tab?.x ?? 0) + (content?.x ?? 0);
  const width = content?.width ?? 0;

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: withTiming(x, { duration: 220 }) }],
    width: withTiming(width, { duration: 220 }),
  }));

  return (
    <View style={[styles.bar, { borderBottomColor: theme.colors.outlineVariant }]} accessibilityRole="tablist">
      {tabs.map((t) => {
        const active = t.value === value;
        const color = active ? theme.colors.primary : theme.colors.onSurfaceVariant;
        return (
          <Pressable
            key={t.value}
            style={styles.tab}
            onPress={() => onChange(t.value)}
            onLayout={(e) => {
              const { x: tx, width: tw } = e.nativeEvent.layout;
              setTabBoxes((b) => ({ ...b, [t.value]: { x: tx, width: tw } }));
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={t.badge ? `${t.label}, new activity` : t.label}>
            <View
              style={styles.content}
              onLayout={(e) => {
                const { x: cx, width: cw } = e.nativeEvent.layout;
                setContentBoxes((b) => ({ ...b, [t.value]: { x: cx, width: cw } }));
              }}>
              <View>
                <MaterialCommunityIcons name={active ? (t.activeIcon ?? t.icon) : t.icon} size={24} color={color} />
                {t.badge ? <View style={[styles.badge, { backgroundColor: theme.colors.error }]} /> : null}
              </View>
              <Text variant="titleSmall" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ color }}>
                {t.label}
              </Text>
            </View>
          </Pressable>
        );
      })}
      {width > 0 ? (
        <Animated.View style={[styles.indicator, { backgroundColor: theme.colors.primary }, indicatorStyle]} />
      ) : null}
    </View>
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
