import {
  Easing,
  LinearTransition,
  ReduceMotion,
  withDelay,
  withSpring,
  withTiming,
  type EntryExitAnimationFunction,
  type WithSpringConfig,
  type WithTimingConfig,
} from 'react-native-reanimated';

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

/**
 * Fades are what reduced motion falls back to, so they always play (ReduceMotion.Never); it's the
 * movement around them that stops.
 */
function fade(duration: number): WithTimingConfig {
  return { duration, easing: Easing.bezier(0.25, 0.1, 0.25, 1), reduceMotion: ReduceMotion.Never };
}

const press = spring(2000, 1);
const release = spring(1000, 0.75);
const spatial = spring(1400, 0.9);

export const motion = {
  /** Touch-down: straight in, no bounce, so the press shows at once. ~0.1 s. */
  press,
  /** Letting go: springs back with a slight settle. ~0.17 s. */
  release,
  /** Moves and resizes: indicators, the FAB, shapes changing. ~0.15 s. */
  spatial,
  /** A card growing to fill the screen. ~0.25 s, with the faintest overshoot. */
  expand: spring(500, 0.85),
  /** The same card shrinking back; no bounce, so it never dips smaller than where it lands. */
  collapse: spring(700, 1),
  /** Opacity and colour, no bounce. */
  effects: spring(3000, 1),

  /** Toggles, thumbs and other small UI moving to a new state: the same as `spatial`. */
  snappy: spatial,
  /**
   * A glass thumb gliding to a new option (the segmented controls): iOS's feel, a touch softer than
   * `spatial`, settling with a hint of give (~2%). ~0.3 s.
   */
  glide: spring(500, 0.78),
  /** That thumb lifting off the track while it's held or moving, and settling back down. */
  lift: spring(700, 0.75),
  /** Content arriving or moving into place: entrances, neighbours sliding over. ~0.3 s, no visible bounce. */
  smooth: spring(220, 0.88),
  /** Celebrations only (a goal met): softer, with a ~3% overshoot. */
  gentle: spring(140, 0.76),
  /** Something appearing, or new content crossfading in. */
  fade: fade(220),
  /** Something leaving: quicker than it came. */
  fadeOut: fade(160),
  /** Between the items of a group arriving together; capped so a group lands in under ~0.3 s. */
  stagger: 35,
} as const;

/** How many items a stagger runs over; later ones arrive with the last of them. */
const STAGGER_STEPS = 5;

/**
 * A block arriving: fades in while it rises 12 points into place, `index` places after the first of
 * its group. With reduced motion it only fades, all at once.
 */
export function enter(index = 0, reduceMotion = false): EntryExitAnimationFunction {
  const delay = reduceMotion ? 0 : Math.min(index, STAGGER_STEPS) * motion.stagger;
  const rise = reduceMotion ? 0 : 12;
  const { fade: fadeIn, smooth } = motion;
  return () => {
    'worklet';
    return {
      initialValues: { opacity: 0, transform: [{ translateY: rise }] },
      animations: {
        opacity: withDelay(delay, withTiming(1, fadeIn)),
        transform: [{ translateY: withDelay(delay, withSpring(0, smooth)) }],
      },
    };
  };
}

/** A block leaving: fades out as it settles back a touch (just fades, with reduced motion). */
export function leave(reduceMotion = false): EntryExitAnimationFunction {
  const { fadeOut, press: settle } = motion;
  const scale = reduceMotion ? 1 : 0.97;
  return () => {
    'worklet';
    return {
      initialValues: { opacity: 1, transform: [{ scale: 1 }] },
      animations: {
        opacity: withTiming(0, fadeOut),
        transform: [{ scale: withSpring(scale, settle) }],
      },
    };
  };
}

/** Neighbours sliding into place when something above them appears, goes or changes size. */
export const layoutMove = LinearTransition.springify()
  .stiffness(motion.smooth.stiffness!)
  .damping(motion.smooth.damping!)
  .mass(1)
  .reduceMotion(ReduceMotion.System);
