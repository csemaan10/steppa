import { Easing, FadeInDown, ReduceMotion, ZoomIn, type EasingFunction } from 'react-native-reanimated';

/**
 * Motion for the game side of the app (the shop, treats, trips, level ups): quick, and done in one
 * move. Timings rather than springs, so nothing keeps wobbling after it lands: things ease out to
 * rest, pop past their size once and settle, or slam down and stop dead.
 */
function timing(duration: number, easing: EasingFunction) {
  return { duration, easing, reduceMotion: ReduceMotion.System };
}

const POP = Easing.out(Easing.back(1.4));

export const gameMotion = {
  /** Arriving or moving into place: fast off the mark, soft landing. */
  enter: timing(280, Easing.out(Easing.cubic)),
  /** Something big travelling in from off screen: a ticket, a postcard. */
  glide: timing(440, Easing.out(Easing.cubic)),
  /** Popping into place: one small overshoot, then still. */
  pop: timing(300, POP),
  /** A quick nudge back to rest after a squash or bump. */
  settle: timing(160, Easing.out(Easing.quad)),
  /** Stamps and medals: speeds into the surface and stops dead. */
  slam: timing(240, Easing.in(Easing.quad)),
  /** Resizing, like the shop's stage shrinking for Trips. */
  resize: timing(320, Easing.inOut(Easing.cubic)),
} as const;

/** Layout animations to match: popping in, and rising into place. */
export function popIn(delay = 0) {
  return ZoomIn.delay(delay).duration(gameMotion.pop.duration).easing(POP);
}

export function riseIn(delay = 0) {
  return FadeInDown.delay(delay).duration(gameMotion.enter.duration).easing(gameMotion.enter.easing);
}
