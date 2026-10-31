import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { StyleSheet, type View } from 'react-native';
import { Portal } from 'react-native-paper';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { TreatIcon } from '@/components/treat-icon';

type Point = { x: number; y: number };

type Flight = {
  id: number;
  from: Point;
  to: Point;
  count: number;
  /** As each one lands (0-based). */
  onLand?: (index: number) => void;
  onDone?: () => void;
};

export type FlyOptions = { onLand?: (index: number) => void; onDone?: () => void };

/** Most cookies drawn in one flight; a big purchase still reads as "lots" without flooding the screen. */
const MAX_DRAWN = 8;
const FLIGHT_MS = 560;
const STAGGER_MS = 75;
const SIZE = 28;

function centreOf(ref: RefObject<View | null>): Promise<Point | null> {
  return new Promise((resolve) => {
    const node = ref.current;
    if (!node) return resolve(null);
    node.measureInWindow((x, y, width, height) =>
      resolve(width || height ? { x: x + width / 2, y: y + height / 2 } : null)
    );
  });
}

/**
 * Treats flying between two things on screen in a little arc, one after another: from your treat
 * counter into your pet's mouth when you spend them, or into the counter when you earn them.
 * Render `flights` once, anywhere; they draw over everything.
 */
export function useCookieFlights(): {
  fly: (from: RefObject<View | null>, to: RefObject<View | null>, count: number, options?: FlyOptions) => Promise<void>;
  flights: ReactNode;
} {
  const [all, setAll] = useState<Flight[]>([]);
  const nextId = useRef(0);

  async function fly(
    from: RefObject<View | null>,
    to: RefObject<View | null>,
    count: number,
    options: FlyOptions = {}
  ) {
    const [a, b] = await Promise.all([centreOf(from), centreOf(to)]);
    if (!a || !b || count < 1) {
      options.onDone?.();
      return;
    }
    nextId.current += 1;
    const flight: Flight = {
      id: nextId.current,
      from: a,
      to: b,
      count: Math.min(count, MAX_DRAWN),
      ...options,
    };
    setAll((list) => [...list, flight]);
  }

  function finish(flight: Flight) {
    setAll((list) => list.filter((f) => f.id !== flight.id));
    flight.onDone?.();
  }

  const flights = (
    <Portal>
      {all.map((flight) =>
        Array.from({ length: flight.count }, (_, i) => (
          <FlyingTreat
            key={`${flight.id}-${i}`}
            flight={flight}
            index={i}
            onLand={() => {
              flight.onLand?.(i);
              if (i === flight.count - 1) finish(flight);
            }}
          />
        ))
      )}
    </Portal>
  );

  return { fly, flights };
}

function FlyingTreat({ flight, index, onLand }: { flight: Flight; index: number; onLand: () => void }) {
  const t = useSharedValue(0);
  const latest = useRef(onLand);
  useEffect(() => {
    latest.current = onLand;
  });

  useEffect(() => {
    function land() {
      latest.current();
    }
    t.set(
      withDelay(
        index * STAGGER_MS,
        withTiming(1, { duration: FLIGHT_MS, easing: Easing.inOut(Easing.quad) }, (done) => {
          if (done) scheduleOnRN(land);
        })
      )
    );
  }, [t, index]);

  // Each one takes a slightly different arc and starts a little off-centre, so they read as a handful.
  const { from, to } = flight;
  const arc = 70 + (index % 3) * 28;
  const jitter = (index % 2 ? 1 : -1) * (6 + (index % 4) * 3);
  const spin = index % 2 ? 320 : -280;

  const style = useAnimatedStyle(() => {
    const p = t.value;
    const x = from.x + jitter * (1 - p) + (to.x - from.x) * p;
    const y = from.y + (to.y - from.y) * p - arc * Math.sin(Math.PI * p);
    return {
      opacity: p === 0 ? 0 : p > 0.94 ? (1 - p) / 0.06 : 1,
      transform: [
        { translateX: x - SIZE / 2 },
        { translateY: y - SIZE / 2 },
        { scale: 0.75 + 0.45 * Math.sin(Math.PI * p) },
        { rotate: `${p * spin}deg` },
      ],
    };
  });

  return (
    <Animated.View pointerEvents="none" style={[styles.treat, style]}>
      <TreatIcon size={26} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  treat: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
