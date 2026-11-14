import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState, type ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  withSpring,
  withTiming,
  type DerivedValue,
} from 'react-native-reanimated';

import { usePressed } from '@/hooks/use-pressed';
import { motion } from '@/theme/motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export type FabMenuAction = { icon: IconName; label: string; onPress: () => void };

type Props = { actions: FabMenuAction[]; bottom: number };

/** Material 3 FAB menu: the FAB expands into a stack of labeled tonal buttons and turns into a close button. */
export function FabMenu({ actions, bottom }: Props) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  // With reduced motion the menu fades in and out (quicker out) instead of unfolding.
  const progress = useDerivedValue<number>(() =>
    reduceMotion
      ? withTiming(open ? 1 : 0, open ? motion.fade : motion.fadeOut)
      : withSpring(open ? 1 : 0, motion.spatial)
  );
  // Held, the FAB tightens its corners and dips (M3 Expressive), on top of the open/close morph.
  const { pressed, onPressIn, onPressOut } = usePressed();

  const fabStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [theme.colors.primaryContainer, theme.colors.primary]
    ),
    borderRadius: interpolate(progress.value, [0, 1], [16, 28]) - pressed.value * 6,
    transform: [{ scale: 1 - pressed.value * 0.06 }],
  }));
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(progress.value, [0, 1], [0, 45])}deg` }],
  }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: progress.value * 0.4 }));

  function select(action: FabMenuAction) {
    setOpen(false);
    action.onPress();
  }

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Animated.View
        pointerEvents={open ? 'auto' : 'none'}
        style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.scrim }, scrimStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} accessibilityLabel="Close menu" />
      </Animated.View>

      <View pointerEvents="box-none" style={[styles.column, { bottom }]}>
        <View pointerEvents={open ? 'box-none' : 'none'} style={styles.items}>
          {actions.map((action, i) => (
            <FabMenuItem
              key={action.label}
              action={action}
              progress={progress}
              // Items nearest the FAB appear first (all together with reduced motion).
              order={reduceMotion ? 0 : actions.length - 1 - i}
              still={reduceMotion}
              onPress={() => select(action)}
            />
          ))}
        </View>

        <Pressable
          onPress={() => setOpen((o) => !o)}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          accessibilityRole="button"
          accessibilityLabel={open ? 'Close menu' : 'Open menu'}
          accessibilityState={{ expanded: open }}>
          <Animated.View style={[styles.fab, fabStyle]}>
            <Animated.View style={iconStyle}>
              <MaterialCommunityIcons
                name="plus"
                size={24}
                color={open ? theme.colors.onPrimary : theme.colors.onPrimaryContainer}
              />
            </Animated.View>
          </Animated.View>
        </Pressable>
      </View>
    </View>
  );
}

type ItemProps = {
  action: FabMenuAction;
  progress: DerivedValue<number>;
  order: number;
  /** Reduced motion: fades in place, without the rise and grow. */
  still: boolean;
  onPress: () => void;
};

function FabMenuItem({ action, progress, order, still, onPress }: ItemProps) {
  const theme = useTheme();
  const { pressed, onPressIn, onPressOut } = usePressed();
  const style = useAnimatedStyle(() => {
    const start = order * 0.15;
    const t = interpolate(progress.value, [start, Math.min(1, start + 0.7)], [0, 1], 'clamp');
    const m = still ? 1 : t;
    return {
      opacity: t,
      transform: [{ translateY: (1 - m) * 16 }, { scale: (0.9 + m * 0.1) * (1 - pressed.value * 0.03) }],
    };
  });
  const shape = useAnimatedStyle(() => ({ borderRadius: 28 - pressed.value * 10 }));

  return (
    <Animated.View style={style}>
      <AnimatedPressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        accessibilityRole="menuitem"
        style={[styles.item, { backgroundColor: theme.colors.primaryContainer }, shape]}>
        <MaterialCommunityIcons name={action.icon} size={22} color={theme.colors.onPrimaryContainer} />
        <Text variant="titleMedium" style={{ color: theme.colors.onPrimaryContainer }}>
          {action.label}
        </Text>
      </AnimatedPressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  column: { position: 'absolute', right: 16, alignItems: 'flex-end', gap: 12 },
  items: { alignItems: 'flex-end', gap: 8 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 56,
    paddingHorizontal: 20,
    borderRadius: 28,
  },
  fab: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
});
