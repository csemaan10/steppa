import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { BlurView } from 'expo-blur';
import { usePathname } from 'expo-router';
import type { TabTriggerSlotProps } from 'expo-router/ui';
import type { ComponentProps, ReactNode, RefObject } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from 'react-native-paper';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const BUTTON_WIDTH = 60;
const BUTTON_HEIGHT = 44;
const GAP = 4;
const PADDING = 6;
const TAB_BAR_HEIGHT = BUTTON_HEIGHT + PADDING * 2;
const TAB_BAR_MARGIN = 12;

/** Distance from the safe-area bottom to the top of the floating bar (for FABs/snackbars). */
export const TAB_BAR_OFFSET = TAB_BAR_HEIGHT + TAB_BAR_MARGIN;

/** Bottom padding scrollable tab content needs so it isn't hidden behind the bar. */
export function useTabBarSpace(): number {
  return useSafeAreaInsets().bottom + TAB_BAR_OFFSET + 16;
}

// TabTrigger's isFocused is memoized without the nav state, so derive the active tab from the URL.
function useActiveTab(): string {
  return usePathname().split('/')[1] || 'index';
}

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

type Props = { blurTarget: RefObject<View | null>; tabs: string[]; children: ReactNode };

export function FloatingTabBar({ blurTarget, tabs, children }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const activeIndex = Math.max(0, tabs.indexOf(useActiveTab()));
  const targetX = activeIndex * (BUTTON_WIDTH + GAP);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: withTiming(targetX, { duration: 220 }) }],
  }));

  return (
    <View pointerEvents="box-none" style={[styles.wrapper, { bottom: insets.bottom + TAB_BAR_MARGIN }]}>
      <View style={[styles.shadow, { shadowColor: theme.colors.shadow }]}>
        {/* Android's blur ignores borderRadius, so a parent view does the clipping. */}
        <View style={[styles.clip, { borderColor: theme.colors.outlineVariant }]}>
          <BlurView
            blurTarget={blurTarget}
            blurMethod="dimezisBlurViewSdk31Plus"
            intensity={60}
            tint={theme.dark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
          <Animated.View
            style={[styles.indicator, { backgroundColor: theme.colors.primary }, indicatorStyle]}
          />
          <View style={styles.row}>{children}</View>
        </View>
      </View>
    </View>
  );
}

type TabButtonProps = TabTriggerSlotProps & {
  name: string;
  icon: IconName;
  activeIcon: IconName;
  label: string;
};

export function TabButton({ name, icon, activeIcon, label, isFocused: _stale, ...props }: TabButtonProps) {
  const theme = useTheme();
  const isFocused = useActiveTab() === name;
  return (
    <Pressable
      {...props}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: isFocused }}
      style={styles.button}>
      <MaterialCommunityIcons
        name={isFocused ? activeIcon : icon}
        size={24}
        color={isFocused ? theme.colors.onPrimary : theme.colors.onSurfaceVariant}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  shadow: {
    borderRadius: TAB_BAR_HEIGHT / 2,
    ...Platform.select({
      ios: { shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
    }),
  },
  clip: {
    borderRadius: TAB_BAR_HEIGHT / 2,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', gap: GAP, padding: PADDING },
  indicator: {
    position: 'absolute',
    top: PADDING,
    left: PADDING,
    width: BUTTON_WIDTH,
    height: BUTTON_HEIGHT,
    borderRadius: BUTTON_HEIGHT / 2,
  },
  button: {
    width: BUTTON_WIDTH,
    height: BUTTON_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
