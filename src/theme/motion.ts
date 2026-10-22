import { ReduceMotion, type WithSpringConfig } from 'react-native-reanimated';

/**
 * Material 3 Expressive motion: springs instead of fixed-length easing, so presses react on touch-down
 * and interrupting one mid-way stays smooth. Tuned stiff so nothing feels floaty: presses go in with no
 * bounce and come back with just a hint of one (ratio 0.75, a ~3% overshoot), and moves barely overshoot.
 * Reanimated runs a spring until its energy drops below a threshold; its default kept them going for
 * hundreds of milliseconds of invisible sub-pixel wobble, so this stops them at 1e-4.
 * damping = ratio × 2√(stiffness × mass). Everything honours the phone's reduce-motion setting.
 */
function spring(stiffness: number, dampingRatio: number): WithSpringConfig {
  return {
    stiffness,
    damping: dampingRatio * 2 * Math.sqrt(stiffness),
    mass: 1,
    energyThreshold: 1e-4,
    reduceMotion: ReduceMotion.System,
  };
}

export const motion = {
  /** Touch-down: straight in, no bounce, so the press shows at once. ~0.1 s. */
  press: spring(2000, 1),
  /** Letting go: springs back with a slight settle. ~0.17 s. */
  release: spring(1000, 0.75),
  /** Moves and resizes: indicators, the FAB, shapes changing. ~0.15 s. */
  spatial: spring(1400, 0.9),
  /** A card growing to fill the screen. ~0.25 s, with the faintest overshoot. */
  expand: spring(500, 0.85),
  /** The same card shrinking back; no bounce, so it never dips smaller than where it lands. */
  collapse: spring(700, 1),
  /** Opacity and colour, no bounce. */
  effects: spring(3000, 1),
} as const;
