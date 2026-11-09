import { router, useFocusEffect, useNavigation } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Platform, useWindowDimensions, type View } from 'react-native';
import {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const INSET = 16;
const RADIUS = 16;
const OPEN_MS = 340;
const CLOSE_MS = 260;
const BACKDROP_OPACITY = 0.32;

/**
 * Android only. iOS opens the group as a normal native push instead (see the root layout),
 * so it gets the system slide-in and edge swipe-back rather than this Material transition.
 */
const EXPAND = Platform.OS !== 'ios';

type Phase = 'opening' | 'open' | 'closing';

/** Navigates to a group, passing the tapped card's on-screen position so the screen can expand from it. */
export function openGroupFrom(card: View | null, id: string) {
  if (!card || !EXPAND) {
    router.push({ pathname: '/group/[id]', params: { id } });
    return;
  }
  card.measureInWindow((_x, y, _w, h) => {
    router.push({
      pathname: '/group/[id]',
      params: { id, oy: String(Math.round(y)), oh: String(Math.round(h)) },
    });
  });
}

/** Opens the podium character editor out of the tapped card, like a group (see openGroupFrom). */
export function openCharacterFrom(card: View | null) {
  if (!card || !EXPAND) {
    router.push('/character');
    return;
  }
  card.measureInWindow((_x, y, _w, h) => {
    router.push({ pathname: '/character', params: { oy: String(Math.round(y)), oh: String(Math.round(h)) } });
  });
}

/**
 * Material "container transform": the screen grows from the source card's rect to full screen,
 * and shrinks back into it on close. Content stays full-size and is clipped, so it never re-lays out.
 * On iOS it's a no-op: the screen starts full size and closing is a plain back.
 *
 * Once open, the screen uses plain static styles rather than the animated ones. Animated values can
 * be dropped while the app is paused (e.g. by the system share sheet), which snapped the screen back
 * to its invisible start state while it still covered the tabs and swallowed their touches.
 */
export function useExpandTransition(originY?: string, originHeight?: string) {
  const navigation = useNavigation();
  const { width, height } = useWindowDimensions();
  const h = Number(originHeight) || 80;
  const y = Number.isFinite(Number(originY)) && originY ? Number(originY) : height / 2 - h / 2;
  const progress = useSharedValue(EXPAND ? 0 : 1);
  const [phase, setPhase] = useState<Phase>(EXPAND ? 'opening' : 'open');
  const closing = useRef(false);

  // Timers rather than worklet finished callbacks, which can be lost if the app was paused.
  useEffect(() => {
    if (!EXPAND) return;
    progress.set(withTiming(1, { duration: OPEN_MS, easing: Easing.bezier(0.2, 0, 0, 1) }));
    const timer = setTimeout(() => {
      if (!closing.current) setPhase('open');
    }, OPEN_MS);
    return () => clearTimeout(timer);
  }, [progress]);

  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    // Pops this screen specifically, not whatever happens to be focused when the timer fires.
    if (!EXPAND) {
      navigation.goBack();
      return;
    }
    setPhase('closing');
    progress.set(withTiming(0, { duration: CLOSE_MS, easing: Easing.bezier(0.3, 0, 0.8, 0.15) }));
    setTimeout(() => navigation.goBack(), CLOSE_MS);
  }, [navigation, progress]);

  // Only while focused; otherwise back on a screen pushed on top would close this one instead.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        close();
        return true;
      });
      return () => sub.remove();
    }, [close])
  );

  const animatedBackdropStyle = useAnimatedStyle(() => ({
    opacity: EXPAND ? progress.value * BACKDROP_OPACITY : 0,
  }));

  const animatedContainerStyle = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      position: 'absolute',
      top: y * (1 - p),
      left: INSET * (1 - p),
      width: width - INSET * 2 * (1 - p),
      height: h + (height - h) * p,
      borderRadius: RADIUS * (1 - p),
      overflow: 'hidden',
    };
  });

  // Counter-offset so content stays pinned to the screen while the container clips it.
  const animatedContentStyle = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      position: 'absolute',
      top: -y * (1 - p),
      left: -INSET * (1 - p),
      width,
      height,
      opacity: interpolate(p, [0.3, 0.9], [0, 1], 'clamp'),
    };
  });

  const open = phase === 'open';
  const full = { position: 'absolute', top: 0, left: 0, width, height } as const;

  return {
    backdropStyle: open ? { opacity: EXPAND ? BACKDROP_OPACITY : 0 } : animatedBackdropStyle,
    containerStyle: open ? { ...full, overflow: 'hidden' as const } : animatedContainerStyle,
    contentStyle: open ? full : animatedContentStyle,
    /** Pass to the screen's root `pointerEvents` so a closing screen never blocks the tabs under it. */
    pointerEvents: phase === 'closing' ? ('none' as const) : ('auto' as const),
    close,
  };
}
