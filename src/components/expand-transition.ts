import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { BackHandler, useWindowDimensions, type View } from 'react-native';
import {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const INSET = 16;
const RADIUS = 16;
const CLOSE_MS = 260;

/** Navigates to a group, passing the tapped card's on-screen position so the screen can expand from it. */
export function openGroupFrom(card: View | null, id: string) {
  if (!card) {
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

/**
 * Material "container transform": the screen grows from the source card's rect to full screen,
 * and shrinks back into it on close. Content stays full-size and is clipped, so it never re-lays out.
 */
export function useExpandTransition(originY?: string, originHeight?: string) {
  const { width, height } = useWindowDimensions();
  const h = Number(originHeight) || 80;
  const y = Number.isFinite(Number(originY)) && originY ? Number(originY) : height / 2 - h / 2;
  const progress = useSharedValue(0);
  const closing = useRef(false);

  useEffect(() => {
    progress.set(withTiming(1, { duration: 340, easing: Easing.bezier(0.2, 0, 0, 1) }));
  }, [progress]);

  // Navigate on a JS timer: the worklet's finished callback can be lost if the app was paused
  // (e.g. by the system share sheet), which left the screen stuck open.
  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    progress.set(withTiming(0, { duration: CLOSE_MS, easing: Easing.bezier(0.3, 0, 0.8, 0.15) }));
    setTimeout(() => router.back(), CLOSE_MS);
  }, [progress]);

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

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value * 0.32 }));

  const containerStyle = useAnimatedStyle(() => {
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
  const contentStyle = useAnimatedStyle(() => {
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

  return { backdropStyle, containerStyle, contentStyle, close };
}
