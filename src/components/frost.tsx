import { BlurView } from 'expo-blur';
import { createRef, type RefObject } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { glassTokens, useAppTheme, withAlpha } from '@/theme';
import type { MD3Theme } from 'react-native-paper';

/**
 * The tab screens' blur target (a BlurTargetView in the tabs layout). Android only blurs what's inside
 * a target, so anything frosted over the tabs blurs this one, as the tab bar does.
 */
export const tabsBlurTarget = createRef<View>();

/** Android blurs from SDK 31 (Android 12); older phones get a solid frost instead of a see-through one. */
const ANDROID_BLURS = Platform.OS !== 'android' || Number(Platform.Version) >= 31;

/**
 * The tab bar's frosted glass, filling its parent: the same blur and tint, for panes that float over
 * content (expanded cards, sheets). The parent sets the shape and clips (`overflow: 'hidden'`), since
 * Android's blur ignores borderRadius. `target` is what's behind the pane on Android; it defaults to
 * the tab screens.
 */
export function Frost({ target = tabsBlurTarget }: { target?: RefObject<View | null> }) {
  const theme = useAppTheme();
  if (!ANDROID_BLURS) {
    const fill = theme.dark ? withAlpha(theme.colors.background, 0.92) : 'rgba(255, 255, 255, 0.92)';
    return <View style={[StyleSheet.absoluteFill, { backgroundColor: fill }]} />;
  }
  return (
    <BlurView
      blurTarget={target}
      blurMethod="dimezisBlurViewSdk31Plus"
      intensity={60}
      tint={theme.dark ? 'dark' : 'light'}
      style={StyleSheet.absoluteFill}
    />
  );
}

/** The rim and shadow of a pane drawn with <Frost />: like glass(), minus the fill, which the blur brings. */
export function frostPane(theme: MD3Theme) {
  const g = glassTokens(theme);
  return {
    backgroundColor: 'transparent',
    borderColor: g.border,
    borderWidth: StyleSheet.hairlineWidth,
    boxShadow: g.shadow,
    overflow: 'hidden' as const,
  };
}
