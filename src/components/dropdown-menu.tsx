import { useEffect, useEffectEvent, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { BackHandler, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Icon, Portal, Text } from 'react-native-paper';
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { usePressed } from '@/hooks/use-pressed';
import { useAppTheme, withAlpha } from '@/theme';

/** Between the button and the menu, and the menu and the screen's edge. */
const GAP = 6;
const MARGIN = 16;
const OPEN = { duration: 220, easing: Easing.out(Easing.cubic) };
const CLOSE = { duration: 140, easing: Easing.in(Easing.quad) };

type Spot = { x: number; top: number; bottom: number; width: number };

/**
 * A Material 3 Expressive dropdown: rounded groups of items on the surface colour, split by small
 * gaps rather than dividers, unfolding from the button that opens it (or up from it, when there's no
 * room below). It matches the button's width, and a tap outside or Back closes it.
 */
export function DropdownMenu({
  open,
  onDismiss,
  anchor,
  children,
}: {
  open: boolean;
  onDismiss: () => void;
  /** The button that opens it. */
  anchor: ReactNode;
  /** `MenuGroup`s. */
  children: ReactNode;
}) {
  const { height: screen } = useWindowDimensions();
  const anchorRef = useRef<View>(null);
  const [spot, setSpot] = useState<Spot | null>(null);
  const [height, setHeight] = useState(0);
  // Stays mounted while it folds away.
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);
  const shown = useSharedValue(0);

  useEffect(() => {
    if (open) {
      anchorRef.current?.measureInWindow((x, y, width, h) => setSpot({ x, top: y, bottom: y + h, width }));
      return;
    }
    shown.set(
      withTiming(0, CLOSE, (done) => {
        if (done) scheduleOnRN(setMounted, false);
      })
    );
  }, [open, shown]);

  const dismiss = useEffectEvent(onDismiss);
  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      dismiss();
      return true;
    });
    return () => sub.remove();
  }, [open]);

  // Below the button if it fits, otherwise above it.
  const below = !spot || !height || spot.bottom + GAP + height <= screen - MARGIN;
  const top = spot ? (below ? spot.bottom + GAP : Math.max(MARGIN, spot.top - GAP - height)) : 0;

  const panel = useAnimatedStyle(() => ({
    opacity: interpolate(shown.value, [0, 0.6], [0, 1], 'clamp'),
    transform: [
      { translateY: (1 - shown.value) * (below ? -8 : 8) },
      { scaleY: 0.9 + 0.1 * shown.value },
    ],
  }));

  return (
    <View ref={anchorRef} collapsable={false}>
      {anchor}
      {mounted && spot ? (
        <Portal>
          <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} accessibilityLabel="Close menu" />
          <Animated.View
            accessibilityRole="menu"
            onLayout={(e) => {
              // Unfolds once its height is known, so it can open upward if it has to.
              setHeight(e.nativeEvent.layout.height);
              if (open) shown.set(withTiming(1, OPEN));
            }}
            style={[
              styles.panel,
              { left: spot.x, top, width: spot.width, transformOrigin: below ? 'top' : 'bottom' },
              panel,
            ]}>
            {children}
          </Animated.View>
        </Portal>
      ) : null}
    </View>
  );
}

/** A rounded block of items; a menu's groups sit a small gap apart. */
export function MenuGroup({ children }: { children: ReactNode }) {
  const theme = useAppTheme();
  return <View style={[styles.group, { backgroundColor: theme.colors.elevation.level2 }]}>{children}</View>;
}

type IconSource = ComponentProps<typeof Icon>['source'];

/**
 * One choice: a leading icon (or emoji), its label, and a line of supporting text if it needs one.
 * Pressing it shows a state layer and tightens its corners, like the app's buttons.
 */
export function MenuItem({
  label,
  supporting,
  icon,
  emoji,
  disabled,
  onPress,
}: {
  label: string;
  supporting?: string;
  icon?: IconSource;
  emoji?: string;
  disabled?: boolean;
  onPress?: () => void;
}) {
  const theme = useAppTheme();
  const { pressed, onPressIn, onPressOut } = usePressed();
  const color = disabled ? withAlpha(theme.colors.onSurface, 0.38) : theme.colors.onSurface;
  const subtle = disabled ? withAlpha(theme.colors.onSurface, 0.38) : theme.colors.onSurfaceVariant;

  const shape = useAnimatedStyle(() => ({ borderRadius: interpolate(pressed.value, [0, 1], [12, 8]) }));
  const stateLayer = useAnimatedStyle(() => ({ opacity: pressed.value * 0.1 }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled || !onPress}
      accessibilityRole="menuitem"
      accessibilityState={{ disabled: !!disabled }}
      accessibilityLabel={supporting ? `${label}, ${supporting}` : label}>
      <Animated.View style={[styles.item, supporting ? styles.tall : null, shape]}>
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.onSurface }, stateLayer]}
        />
        <View style={styles.leading}>
          {emoji ? (
            <Text style={[styles.emoji, disabled && styles.faded]}>{emoji}</Text>
          ) : icon ? (
            <Icon source={icon} size={20} color={subtle} />
          ) : null}
        </View>
        <View style={styles.text}>
          <Text variant="labelLarge" numberOfLines={1} style={{ color }}>
            {label}
          </Text>
          {supporting ? (
            <Text variant="bodySmall" numberOfLines={1} style={{ color: subtle }}>
              {supporting}
            </Text>
          ) : null}
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: { position: 'absolute', gap: 4 },
  group: {
    borderRadius: 16,
    padding: 4,
    gap: 2,
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.18), 0 3px 8px 2px rgba(0, 0, 0, 0.1)',
  },
  item: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    overflow: 'hidden',
  },
  tall: { minHeight: 56, paddingVertical: 6 },
  leading: { width: 24, alignItems: 'center' },
  emoji: { fontSize: 18, lineHeight: 24 },
  faded: { opacity: 0.38 },
  text: { flex: 1, gap: 1 },
});
