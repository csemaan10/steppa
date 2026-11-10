import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Portal, Text } from 'react-native-paper';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Frost, frostPane } from '@/components/frost';
import { GlassAction } from '@/components/glass-action';
import { useAppTheme } from '@/theme';
import { motion } from '@/theme/motion';

export type Rect = { x: number; y: number; width: number; height: number };

const MARGIN = 12;
const RADIUS = 28;
const HEADER_HEIGHT = 64;
/** Long enough for the collapse spring to settle before the card unmounts. */
const CLOSE_MS = 260;

type Props = {
  /** Where the tapped card sits on screen: this one grows out of it and shrinks back into it. */
  origin: Rect;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
};

/**
 * A glass card that grows out of the card that was tapped (a Material container transform, on an
 * Expressive spring) over a dimmed screen. It fits its content, up to the full screen, and sits
 * centred. Tapping outside, the close button or Android back shrinks it back to where it came from.
 */
export function ExpandingCard({ origin, title, subtitle, onClose, children }: Props) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  // The body is measured on its first layout, while the card is still invisible, and the card then
  // opens to fit it. Only the first measurement counts, so the target never moves mid-animation.
  const [bodyHeight, setBodyHeight] = useState(0);
  const maxHeight = height - insets.top - insets.bottom - MARGIN * 2;
  const cardHeight = bodyHeight ? Math.min(HEADER_HEIGHT + bodyHeight, maxHeight) : maxHeight;
  const target = {
    x: MARGIN,
    y: insets.top + MARGIN + (maxHeight - cardHeight) / 2,
    width: width - MARGIN * 2,
    height: cardHeight,
  };

  const progress = useSharedValue(0);
  const [closing, setClosing] = useState(false);
  const closed = useRef(false);
  const measured = bodyHeight > 0;
  useEffect(() => {
    if (measured && !closed.current) progress.set(withSpring(1, motion.expand));
  }, [measured, progress]);

  const close = useCallback(() => {
    if (closed.current) return;
    closed.current = true;
    setClosing(true);
    progress.set(withSpring(0, motion.collapse));
    // A timer rather than the spring's finished callback, which can be lost if the app is paused.
    setTimeout(onClose, CLOSE_MS);
  }, [onClose, progress]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [close]);

  const scrimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 0.4], 'clamp'),
  }));
  const cardStyle = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      top: origin.y + (target.y - origin.y) * p,
      left: origin.x + (target.x - origin.x) * p,
      width: origin.width + (target.width - origin.width) * p,
      height: origin.height + (target.height - origin.height) * p,
      opacity: interpolate(p, [0, 0.2], [0, 1], 'clamp'),
    };
  });
  // The content is laid out once at full size and pinned in place while the growing card clips it,
  // so it never re-lays out mid-animation.
  const contentStyle = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      top: (target.y - origin.y) * (1 - p),
      left: (target.x - origin.x) * (1 - p),
      opacity: interpolate(p, [0.4, 0.9], [0, 1], 'clamp'),
    };
  });

  return (
    <Portal>
      <View style={StyleSheet.absoluteFill} pointerEvents={closing ? 'none' : 'auto'}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.scrim }, scrimStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close" />
        </Animated.View>

        <Animated.View style={[styles.card, frostPane(theme), cardStyle]} accessibilityViewIsModal>
          {/* Frosted like the tab bar: the screen behind blurs, rather than showing through a tint. */}
          <Frost />
          <Animated.View style={[styles.content, { width: target.width, height: target.height }, contentStyle]}>
            <View style={styles.header}>
              <View style={styles.flex}>
                <Text variant="titleLarge" accessibilityRole="header" numberOfLines={1} style={styles.title}>
                  {title}
                </Text>
                {subtitle ? (
                  <Text variant="bodySmall" numberOfLines={1} style={{ color: theme.colors.onSurfaceVariant }}>
                    {subtitle}
                  </Text>
                ) : null}
              </View>
              <GlassAction icon="close" onPress={close} accessibilityLabel="Close" />
            </View>
            <ScrollView
              contentContainerStyle={styles.body}
              onContentSizeChange={(_w, h) => setBodyHeight((b) => b || h)}>
              {children}
            </ScrollView>
          </Animated.View>
        </Animated.View>
      </View>
    </Portal>
  );
}

const styles = StyleSheet.create({
  card: { position: 'absolute', borderRadius: RADIUS, overflow: 'hidden' },
  content: { position: 'absolute' },
  header: { height: HEADER_HEIGHT, flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 20, paddingRight: 8 },
  flex: { flex: 1 },
  title: { fontWeight: '800' },
  body: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 20, gap: 16 },
});
