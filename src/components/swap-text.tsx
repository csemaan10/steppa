import { useEffect, useState, type ComponentProps } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from 'react-native-paper';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { motion } from '@/theme/motion';

type Props = Omit<ComponentProps<typeof Text>, 'children'> & {
  children: string;
  /** For the box the two layers share, e.g. `flexShrink` in a row (`style` goes on the text). */
  containerStyle?: StyleProp<ViewStyle>;
};

/**
 * Text that crossfades when it changes: the old words fade up and out as the new ones rise in, so
 * a value updating in place reads as an update rather than a flicker. The new text sets the size,
 * and the old one is laid over it while it goes. The first value just shows.
 */
export function SwapText({ children: text, style, containerStyle, ...rest }: Props) {
  const reduceMotion = useReducedMotion();
  const [shown, setShown] = useState(text);
  const [leaving, setLeaving] = useState<string | null>(null);
  // 1 = the new text fully in; drives both layers.
  const progress = useSharedValue(1);
  const shift = useSharedValue(0);

  // Adjusting state during render (not in an effect), so the swap starts on the frame the text changes.
  if (text !== shown) {
    setLeaving(shown);
    setShown(text);
  }

  useEffect(() => {
    if (leaving === null) return;
    progress.set(0);
    progress.set(withTiming(1, motion.fade));
    shift.set(reduceMotion ? 0 : 6);
    shift.set(withSpring(0, motion.smooth));
  }, [leaving, shown, progress, shift, reduceMotion]);

  const incoming = useAnimatedStyle(() => ({ opacity: progress.value, transform: [{ translateY: shift.value }] }));
  const outgoing = useAnimatedStyle(() => ({
    // Gone in the first ~60% of the fade-in, so the two never sit fully on top of each other.
    opacity: Math.max(0, 1 - progress.value * 1.7),
    transform: [{ translateY: shift.value - (reduceMotion ? 0 : 6) }],
  }));

  return (
    <View style={containerStyle}>
      <Animated.View style={incoming}>
        <Text {...rest} style={style}>
          {shown}
        </Text>
      </Animated.View>
      {leaving !== null ? (
        <Animated.View
          pointerEvents="none"
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
          style={[StyleSheet.absoluteFill, outgoing]}>
          <Text {...rest} style={style}>
            {leaving}
          </Text>
        </Animated.View>
      ) : null}
    </View>
  );
}
