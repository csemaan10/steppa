// Shared pieces for drawing character scenes: the animation clock, colour shading and pet coats.

import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { useAnimatedReaction, useFrameCallback, useReducedMotion, useSharedValue, type SharedValue } from 'react-native-reanimated';

/**
 * Scene time in seconds. Runs only while `active` (e.g. the scene is on screen), the screen is
 * focused, and motion isn't reduced; otherwise the character holds its last pose.
 */
export function useSceneClock(active: boolean, fps: number): SharedValue<number> {
  const time = useSharedValue(0);
  // Scene time when the clock last started: Reanimated restarts timeSinceFirstFrame each time a frame
  // callback is switched back on, so a paused scene carries on from its pose instead of snapping back.
  const base = useSharedValue(0);
  const reduceMotion = useReducedMotion();
  const step = 1000 / fps;
  const clock = useFrameCallback((frame) => {
    if (frame.timeSincePreviousFrame === null) base.value = time.value;
    const t = base.value + frame.timeSinceFirstFrame / 1000;
    // Skip frames when capped: drawing the scene is the costly part, not the clock.
    if ((t - time.value) * 1000 >= step) time.value = t;
  }, false);
  useFocusEffect(
    useCallback(() => {
      clock.setActive(active && !reduceMotion);
      return () => clock.setActive(false);
    }, [clock, reduceMotion, active])
  );
  return time;
}

/**
 * Another clock (an entrance's, which runs every display frame) stepped down to `fps`, for drawing:
 * a scene redraws only when its step changes. Without it each podium character and its effects were
 * re-recorded on every frame of an entrance (up to 120 a second), which made the leaderboard stutter
 * while they played. Movement done with transforms can keep following the smooth clock.
 */
export function useSteppedClock(clock: SharedValue<number>, fps: number): SharedValue<number> {
  const stepped = useSharedValue(clock.value);
  useAnimatedReaction(
    // Negative means not started yet; that stays as it is so nothing shows early.
    () => (clock.value < 0 ? clock.value : Math.floor(clock.value * fps) / fps),
    (next, previous) => {
      if (next !== previous) stepped.value = next;
    },
    // The clock too: a canvas switches from its own clock to an entrance's and back.
    [clock, fps]
  );
  return stepped;
}

/** Lighten (amount > 0) or darken a #RRGGBB colour. */
export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = [n >> 16, (n >> 8) & 255, n & 255].map((v) =>
    Math.round(amount < 0 ? v * (1 + amount) : v + (255 - v) * amount)
  );
  return '#' + ch.map((v) => v.toString(16).padStart(2, '0')).join('');
}

export const CAT_COATS = {
  greycat: { base: '#7E8794', dark: '#5F6773', light: '#9AA2AE', eye: '#C9D65A', stripes: false },
  tabbycat: { base: '#9C9B94', dark: '#3F3E3A', light: '#C9C6BC', eye: '#B7C54A', stripes: true },
  gingercat: { base: '#E8893A', dark: '#B55A1B', light: '#F6C08A', eye: '#9CC55A', stripes: true },
  // Yellow eyes so the face reads on a black coat.
  blackcat: { base: '#2B2B2B', dark: '#111111', light: '#474747', eye: '#F2C94C', stripes: false },
} as const;

export const DOG_COATS = {
  browndog: { coat: '#A56A3A', light: '#E6C29A', dark: '#5A3417', eye: '#222222', blaze: false },
  goldendog: { coat: '#D9A441', light: '#F4DCA6', dark: '#B07F28', eye: '#222222', blaze: false },
  // White blaze and amber eyes so the face reads on a black coat.
  bwdog: { coat: '#2B2B2B', light: '#F2F2F2', dark: '#161616', eye: '#C98A2E', blaze: true },
  blackdog: { coat: '#262626', light: '#3D3D3D', dark: '#111111', eye: '#C98A2E', blaze: false },
} as const;

/** The horse (the pet, and the one ridden in on): coat, far-side legs, mane and tail, hooves, eye, nostril. */
export const HORSE_COAT = {
  coat: '#8B5A2B',
  farLeg: '#744A22',
  mane: '#2B1B10',
  hoof: '#1E1E1E',
  eye: '#111111',
  nostril: '#3A2210',
} as const;

/** Gold, silver, bronze: disc, rim, the ribbon's two halves, and the glow behind the podium character. */
export const MEDAL_COLORS = [
  { disc: '#F5CD4B', rim: '#C99A1B', straps: ['#E5484D', '#B32D31'], glow: '#FFC83D' },
  { disc: '#DCE2E8', rim: '#97A1AC', straps: ['#3B82F6', '#1F55C9'], glow: '#AEBBCB' },
  { disc: '#E3A46F', rim: '#A8693A', straps: ['#22A06B', '#167650'], glow: '#E08A4A' },
] as const;

/** Shoulder birds: body, wing, head, tail and beak colours; the cockatoo also has a crest. */
export const BIRD_COATS = {
  bird: { body: '#43A047', wing: '#2E7D32', head: '#66BB6A', tail: '#2E7D32', beak: '#FDD835', crest: null },
  bluebird: { body: '#1E88E5', wing: '#1565C0', head: '#FDD835', tail: '#0D47A1', beak: '#263238', crest: null },
  macaw: { body: '#E53935', wing: '#1E88E5', head: '#E53935', tail: '#FDD835', beak: '#ECEFF1', crest: null },
  canary: { body: '#FDD835', wing: '#F9A825', head: '#FFEB3B', tail: '#F9A825', beak: '#FB8C00', crest: null },
  cockatoo: { body: '#F5F5F5', wing: '#E0E0E0', head: '#FAFAFA', tail: '#EEEEEE', beak: '#424242', crest: '#FDD835' },
} as const;
