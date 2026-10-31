import { useEffect, useRef, useState, type ComponentProps } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { Button } from '@/components/button';
import { treatButtonIcon } from '@/components/treat-icon';

/** How long "Sure?" waits for the second press. */
const CONFIRM_MS = 3000;

type Props = {
  label: string;
  /** Treats it costs, shown after the label. */
  price: number;
  icon?: ComponentProps<typeof Button>['icon'];
  mode?: ComponentProps<typeof Button>['mode'];
  compact?: boolean;
  disabled?: boolean;
  loading?: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * The app's button for spending treats: "Learn · 12", after the treat icon. The first press asks "Sure?" with a little
 * shake instead of a dialog; a second press within a few seconds spends them.
 */
export function SpendButton({
  label,
  price,
  icon,
  mode = 'contained',
  compact,
  disabled,
  loading,
  onPress,
  accessibilityLabel,
  style,
}: Props) {
  const [arming, setArming] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const shake = useSharedValue(0);
  useEffect(() => () => clearTimeout(timer.current), []);

  function press() {
    if (!arming) {
      setArming(true);
      shake.set(
        withSequence(
          withTiming(-1, { duration: 45 }),
          withTiming(1, { duration: 70 }),
          withTiming(-0.6, { duration: 60 }),
          withTiming(0, { duration: 55 })
        )
      );
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setArming(false), CONFIRM_MS);
      return;
    }
    clearTimeout(timer.current);
    setArming(false);
    onPress();
  }

  const wobble = useAnimatedStyle(() => ({ transform: [{ rotate: `${shake.value * 3}deg` }] }));

  return (
    <Animated.View style={[wobble, style]}>
      <Button
        mode={mode}
        icon={icon ?? treatButtonIcon}
        compact={compact}
        disabled={disabled}
        loading={loading}
        onPress={press}
        accessibilityLabel={accessibilityLabel ? (arming ? `Sure? ${accessibilityLabel}` : accessibilityLabel) : undefined}>
        {`${arming ? 'Sure?' : label} · ${price}`}
      </Button>
    </Animated.View>
  );
}
