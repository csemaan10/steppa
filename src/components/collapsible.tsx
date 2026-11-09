import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { motion } from '@/theme/motion';

/** Long enough for the collapse spring to settle before the body unmounts. */
const UNMOUNT_MS = 320;

type Props = {
  expanded: boolean;
  /** Style for the content inside (padding, gap). */
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

/**
 * A body that grows open and folds shut on an Expressive spring, pushing what's below along with it.
 * The content is laid out once at full size inside a clip that animates its height, so it never
 * re-lays out mid-animation. It's only built while open (and while folding shut), so closed sections
 * cost nothing.
 */
export function Collapsible({ expanded, style, children }: Props) {
  // Kept for the length of the fold after closing, so it can animate shut before it goes.
  const [wasExpanded, setWasExpanded] = useState(expanded);
  const [lingering, setLingering] = useState(false);
  if (wasExpanded !== expanded) {
    setWasExpanded(expanded);
    setLingering(!expanded);
  }
  useEffect(() => {
    if (!lingering) return;
    const timer = setTimeout(() => setLingering(false), UNMOUNT_MS);
    return () => clearTimeout(timer);
  }, [lingering]);

  const [contentHeight, setContentHeight] = useState(0);
  const height = useSharedValue(0);
  useEffect(() => {
    height.set(withSpring(expanded ? contentHeight : 0, expanded ? motion.expand : motion.collapse));
  }, [height, expanded, contentHeight]);

  const clipStyle = useAnimatedStyle(() => ({
    height: height.value,
    // Fades in over the first part of the opening, so the content never shows half-cut and solid.
    opacity: contentHeight ? Math.min(1, (height.value / contentHeight) * 1.6) : 0,
  }));

  if (!expanded && !lingering) return null;
  return (
    <Animated.View style={[styles.clip, clipStyle]}>
      <View style={[styles.content, style]} onLayout={(e) => setContentHeight(e.nativeEvent.layout.height)}>
        {children}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  content: { position: 'absolute', top: 0, left: 0, right: 0 },
});
