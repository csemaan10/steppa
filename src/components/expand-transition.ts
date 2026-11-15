import { router, useFocusEffect, useNavigation } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, Platform, useWindowDimensions, type View } from 'react-native';
import {
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { motion } from '@/theme/motion';

const INSET = 16;
const RADIUS = 16;
/** About when the expand spring has landed, to switch to the static full-screen styles. */
const OPEN_MS = 340;
/** About when the collapse spring is back in the card (the content has long faded by then). */
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
 * It runs on springs (motion.expand out, motion.collapse back), so a close straight after opening
 * turns around from wherever the screen has got to. With reduced motion the screen stays full size
 * and only fades in and out over the backdrop.
 *
 * The animated styles stay on for as long as the screen is open. It used to swap them for static
 * full-screen styles once it had opened (to guard against a Reanimated bug, fixed in the version the
 * app now uses, that dropped animated values while the app was paused), but on Android that swap
 * could race the spring's last frames and leave the screen stuck part-way open. As a backstop, the
 * screen is pinned fully open whenever the app comes back to the foreground.
 */
export function useExpandTransition(originY?: string, originHeight?: string) {
  const navigation = useNavigation();
  const { width, height } = useWindowDimensions();
  const h = Number(originHeight) || 80;
  const y = Number.isFinite(Number(originY)) && originY ? Number(originY) : height / 2 - h / 2;
  const reduceMotion = useReducedMotion();
  // The container's shape: 0 = the card, 1 = full screen. Held at full size with reduced motion.
  const progress = useSharedValue(EXPAND && !reduceMotion ? 0 : 1);
  // How far the screen has faded in (the content and the backdrop follow it).
  const shown = useSharedValue(EXPAND ? 0 : 1);
  const [phase, setPhase] = useState<Phase>(EXPAND ? 'opening' : 'open');
  const closing = useRef(false);

  // Timers rather than worklet finished callbacks, which can be lost if the app was paused.
  useEffect(() => {
    if (!EXPAND) return;
    progress.set(withSpring(1, motion.expand));
    shown.set(withTiming(1, motion.fade));
    const timer = setTimeout(() => {
      if (!closing.current) setPhase('open');
    }, OPEN_MS);
    // Back from the background (a share sheet, another app): fully open, whatever the animation was
    // doing when the app was paused.
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || closing.current) return;
      progress.set(1);
      shown.set(1);
    });
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, [progress, shown]);

  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    // Pops this screen specifically, not whatever happens to be focused when the timer fires.
    if (!EXPAND) {
      navigation.goBack();
      return;
    }
    setPhase('closing');
    if (!reduceMotion) progress.set(withSpring(0, motion.collapse));
    shown.set(withTiming(0, motion.fadeOut));
    setTimeout(() => navigation.goBack(), CLOSE_MS);
  }, [navigation, progress, shown, reduceMotion]);

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
    opacity: EXPAND ? Math.min(progress.value, shown.value) * BACKDROP_OPACITY : 0,
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
      // Fades in over the middle of the expand; with reduced motion the shape holds still and only this fades.
      opacity: Math.min(interpolate(p, [0.3, 0.9], [0, 1], 'clamp'), shown.value),
    };
  });

  // iOS never animates (a native push does the work), so it gets plain full-screen styles.
  const full = { position: 'absolute', top: 0, left: 0, width, height } as const;

  return {
    backdropStyle: EXPAND ? animatedBackdropStyle : { opacity: 0 },
    containerStyle: EXPAND ? animatedContainerStyle : { ...full, overflow: 'hidden' as const },
    contentStyle: EXPAND ? animatedContentStyle : full,
    /** Pass to the screen's root `pointerEvents` so a closing screen never blocks the tabs under it. */
    pointerEvents: phase === 'closing' ? ('none' as const) : ('auto' as const),
    close,
  };
}
