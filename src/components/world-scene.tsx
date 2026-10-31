import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { FollowBody, PetBody, PetEffects, PetTarget, type PetPlay } from '@/components/pet-play';
import { WORLD_HEIGHT, WORLD_WIDTH, type Layer, type Motion, type WorldArt } from '@/lib/world';
import type { Shape } from '@/lib/scene-art';

/** The crossfade when the world changes: Material's standard easing, short. */
const FADE = 250;
const STANDARD = Easing.bezier(0.2, 0, 0, 1);
const VIEW_BOX = `0 0 ${WORLD_WIDTH} ${WORLD_HEIGHT}`;

type Props = {
  art: WorldArt;
  width: number;
  /** False to hold everything still (the tab is hidden). Reduce motion also holds it still. */
  animate?: boolean;
  /** Changes whenever the world does (a new choice, a new stage), so the old one fades into the new. */
  version?: string;
  /** Makes the pet playable: tap or hold it, and the play's buttons move it (see usePetPlay). */
  play?: PetPlay;
  /** Shows only the bottom this many pixels (the ground and the pet), for a shorter panel. */
  cropTo?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

type Frame = { art: WorldArt; version: string | undefined; id: number };

/**
 * A world (src/lib/world) drawn at `width`, keeping its 4:3 shape. Still layers are plain SVGs; each
 * moving layer is an SVG in a view moved by Reanimated on the UI thread, so nothing re-renders while
 * fish swim and clouds drift. When `version` changes, the new world fades in over the old one.
 */
export function WorldScene({ art, width, animate = true, version, play, cropTo, radius = 20, style }: Props) {
  const reduceMotion = useReducedMotion();
  const height = Math.round((width * WORLD_HEIGHT) / WORLD_WIDTH);
  const shown = cropTo ? Math.min(cropTo, height) : height;
  const scale = width / WORLD_WIDTH;
  const moving = animate && !reduceMotion;

  // The worlds on screen: the current one, plus any still fading out beneath it.
  const [frames, setFrames] = useState<Frame[]>([{ art, version, id: 0 }]);
  const latest = frames[frames.length - 1]!;
  if (latest.version !== version) setFrames([...frames.slice(-2), { art, version, id: latest.id + 1 }]);

  return (
    <View style={[{ width, height: shown, borderRadius: radius }, styles.frame, style]}>
      {/* The whole scene, slid up so its bottom edge lines up with the panel's. */}
      <View style={{ position: 'absolute', left: 0, top: shown - height, width, height }}>
        {frames.map((frame) => {
          const current = frame === latest;
          return (
            <FadeFrame
              key={frame.id}
              fadeIn={frame.id > 0}
              sky={(current ? art : frame.art).sky}
              onShown={() => setFrames((all) => all.filter((f) => f.id >= frame.id))}>
              {(current ? art : frame.art).layers.map((layer, i) => {
                const drawn = layer.motion ? (
                  <MovingLayer
                    key={i}
                    layer={layer}
                    motion={layer.motion}
                    scale={scale}
                    width={width}
                    height={height}
                    moving={moving}
                    joy={current ? play?.joy : undefined}
                  />
                ) : (
                  <Paths key={i} shapes={layer.shapes} />
                );
                if (current && play && art.pet && layer.pet) {
                  return (
                    <PetBody key={i} play={play} spot={art.pet} scale={scale}>
                      {drawn}
                    </PetBody>
                  );
                }
                return current && play && layer.follow ? (
                  <FollowBody key={i} play={play} scale={scale}>
                    {drawn}
                  </FollowBody>
                ) : (
                  drawn
                );
              })}
            </FadeFrame>
          );
        })}
        {play && art.pet ? (
          <>
            <PetEffects play={play} spot={art.pet} scale={scale} />
            <PetTarget play={play} spot={art.pet} scale={scale} />
          </>
        ) : null}
      </View>
    </View>
  );
}

/**
 * One world, fading in over the one before (Material's standard easing). Driven by a shared value
 * rather than an entering animation, so it doesn't replay when the tab is shown again.
 */
function FadeFrame({
  fadeIn,
  sky,
  onShown,
  children,
}: {
  fadeIn: boolean;
  sky: readonly [string, string];
  onShown: () => void;
  children: ReactNode;
}) {
  const opacity = useSharedValue(fadeIn ? 0 : 1);
  useEffect(() => {
    if (!fadeIn) return;
    opacity.set(
      withTiming(1, { duration: FADE, easing: STANDARD }, (finished) => {
        if (finished) scheduleOnRN(onShown);
      })
    );
    // Runs once: a frame only ever fades in when it first appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        { experimental_backgroundImage: `linear-gradient(180deg, ${sky[0]} 0%, ${sky[1]} 100%)` },
        style,
      ]}>
      {children}
    </Animated.View>
  );
}

function Paths({ shapes }: { shapes: Shape[] }) {
  return (
    <Svg width="100%" height="100%" viewBox={VIEW_BOX} style={StyleSheet.absoluteFill}>
      {shapes.map((s, i) => (
        <Path key={i} d={s.d} fill={s.fill} opacity={s.opacity} />
      ))}
    </Svg>
  );
}

/**
 * Runs one motion forever. Back-and-forth motions go from rest out to one side, then swing between
 * both sides on a sine ease; gliding ones start at their phase and loop. `t` is -1…1 for the first
 * kind and 0…1 for the second.
 */
function useMotion(motion: Motion, delay: number, moving: boolean): SharedValue<number> {
  const looping = motion.type === 'cross' || motion.type === 'rise';
  const phase = looping ? (motion.phase ?? 0) : 0;
  const t = useSharedValue(phase);
  const { type, period } = motion;

  useEffect(() => {
    if (!moving) {
      cancelAnimation(t);
      t.set(phase);
      return;
    }
    if (type === 'cross' || type === 'rise') {
      const linear = { easing: Easing.linear };
      t.set(phase);
      t.set(
        withDelay(
          delay,
          withSequence(
            withTiming(1, { ...linear, duration: Math.max(1, (1 - phase) * period) }),
            withRepeat(withSequence(withTiming(0, { duration: 0 }), withTiming(1, { ...linear, duration: period })), -1)
          )
        )
      );
    } else {
      t.set(0);
      t.set(
        withDelay(
          delay,
          withSequence(
            withTiming(1, { duration: period / 4, easing: Easing.out(Easing.sin) }),
            withRepeat(withTiming(-1, { duration: period / 2, easing: Easing.inOut(Easing.sin) }), -1, true)
          )
        )
      );
    }
    return () => cancelAnimation(t);
  }, [t, type, period, phase, delay, moving]);

  return t;
}

/** Closed eyes shown for a moment every few seconds. */
function useBlink(moving: boolean, enabled: boolean): SharedValue<number> {
  const shown = useSharedValue(0);
  useEffect(() => {
    if (!moving || !enabled) {
      cancelAnimation(shown);
      shown.set(0);
      return;
    }
    shown.set(
      withRepeat(
        withSequence(withDelay(3400, withTiming(1, { duration: 40 })), withDelay(120, withTiming(0, { duration: 60 }))),
        -1
      )
    );
    return () => cancelAnimation(shown);
  }, [shown, moving, enabled]);
  return shown;
}

function MovingLayer({
  layer,
  motion,
  scale,
  width,
  height,
  moving,
  joy,
}: {
  layer: Layer;
  motion: Motion;
  scale: number;
  width: number;
  height: number;
  moving: boolean;
  /** How much the pet's happy face shows (0–1), while you play with it. */
  joy?: SharedValue<number>;
}) {
  const t = useMotion(motion, layer.delay ?? 0, moving);
  const blink = useBlink(moving, !!layer.blink?.length);

  const animated = useAnimatedStyle(() => {
    const v = t.get();
    switch (motion.type) {
      case 'drift':
        return { transform: [{ translateX: v * motion.dx * scale }] };
      case 'bob':
        return { transform: [{ translateY: v * motion.dy * scale }] };
      case 'cross':
        return { transform: [{ translateX: v * motion.dx * scale }] };
      case 'rise':
        // Fades in at the bottom and out over the last third.
        return {
          opacity: v < 0.12 ? v / 0.12 : v > 0.66 ? (1 - v) / 0.34 : 1,
          transform: [{ translateY: -v * motion.dy * scale }],
        };
      case 'sway':
        return {
          transformOrigin: [motion.x * scale, motion.y * scale, 0],
          transform: [{ rotate: `${v * motion.deg}deg` }],
        };
      case 'breathe':
        return {
          transformOrigin: [motion.x * scale, motion.y * scale, 0],
          transform: [{ scaleY: 1 + (motion.amount * (v + 1)) / 2 }],
        };
      case 'twinkle':
        return { opacity: motion.min + ((1 - motion.min) * (v + 1)) / 2 };
    }
  });
  // A happy face replaces a blink rather than sitting on top of one.
  const blinkStyle = useAnimatedStyle(() => ({ opacity: blink.get() * (1 - (joy?.get() ?? 0)) }));
  const happyStyle = useAnimatedStyle(() => ({ opacity: joy?.get() ?? 0 }));

  const moved = (
    <Animated.View style={[{ width, height }, animated]}>
      <Paths shapes={layer.shapes} />
      {layer.blink?.length ? (
        <Animated.View style={[StyleSheet.absoluteFill, blinkStyle]}>
          <Paths shapes={layer.blink} />
        </Animated.View>
      ) : null}
      {layer.happy?.length && joy ? (
        <Animated.View style={[StyleSheet.absoluteFill, happyStyle]}>
          <Paths shapes={layer.happy} />
        </Animated.View>
      ) : null}
    </Animated.View>
  );

  if (!layer.clip)
    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {moved}
      </View>
    );
  // The clip box stays put while the layer moves inside it.
  const [x, y, w, h] = layer.clip;
  return (
    <View
      pointerEvents="none"
      style={[styles.clip, { left: x * scale, top: y * scale, width: w * scale, height: h * scale }]}>
      <View style={{ position: 'absolute', left: -x * scale, top: -y * scale }}>{moved}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden' },
  clip: { position: 'absolute', overflow: 'hidden' },
});
