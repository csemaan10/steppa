import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, Text as NativeText, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { WORLD_WIDTH, type PetSpot, type TrickId } from '@/lib/world';

// Everything eases in and out, like the rest of the app's motion: a hop rises fast and falls under
// gravity, with no spring overshoot or bounce.
const UP = Easing.out(Easing.quad);
const DOWN = Easing.in(Easing.quad);
const SWING = Easing.inOut(Easing.sin);
const STANDARD = Easing.bezier(0.2, 0, 0, 1);
const HEART = '#FF6F91';

/** The tap reactions, taken in turn. */
const REACTIONS = ['hop', 'wiggle', 'turn'] as const;
/** What it says on trying on something new, in turn. */
const DRESS_UP_LINES = ['Ooh!', 'Fancy!', 'Love it!', 'So me!', 'Ta-da!'];

/** Things it gets up to on its own, taken in turn. */
const IDLE = ['tail', 'dig', 'pounce', 'butterfly'] as const;
/** After you've played with it, it waits this long before doing anything on its own. */
const IDLE_AFTER = 6000;

type Effect =
  | { id: number; kind: 'heart'; dx: number }
  | { id: number; kind: 'bubble'; text: string }
  | { id: number; kind: 'treat'; emoji: string }
  | { id: number; kind: 'ball' }
  | { id: number; kind: 'frisbee' }
  | { id: number; kind: 'rope'; dir: number }
  | { id: number; kind: 'soap'; dx: number; delay: number }
  /** Where they burst, if not where the ball is caught. */
  | { id: number; kind: 'sparkles'; at?: readonly [number, number] }
  /** A puff kicked up at its feet, `x` across the scene. */
  | { id: number; kind: 'dust'; x: number }
  /** Earth flying out behind it as it digs, toward `dir`. */
  | { id: number; kind: 'dirt'; dir: number }
  | { id: number; kind: 'butterfly' }
  /** A fish blowing bubbles. */
  | { id: number; kind: 'bubbles' };
/** An effect before it has an id (each kind keeps its own fields). */
type NewEffect<E = Effect> = E extends Effect ? Omit<E, 'id'> : never;

export type PetPlay = ReturnType<typeof usePetPlay>;

type PlayOptions = {
  /** Tricks it knows: every fourth tap, it shows one off. */
  tricks?: readonly TrickId[];
  /** Things it says besides its own sounds, like how it feels today. */
  says?: readonly string[];
};

/** A training attempt after a treat: the trick, and how well it does it (1 when this treat teaches it). */
export type Lesson = { trick: TrickId; skill: number };

/**
 * Playing with your pet: tap it (it hops, wiggles or turns around, in turn), hold it to stroke it
 * (it squishes happily and purrs while hearts float up), give it a treat, toss it a ball, or ask for
 * a trick it knows. The pet's own layers move with the shared values here; hearts, treats and speech
 * bubbles are effects drawn over the scene. Pass the result to WorldScene's `play` and call the
 * actions from buttons.
 */
export function usePetPlay(spot: PetSpot | undefined, { tricks = [], says = [] }: PlayOptions = {}) {
  /** Scene units up. */
  const hop = useSharedValue(0);
  /** Scene units right. */
  const slide = useSharedValue(0);
  /** Degrees, about its feet. */
  const tilt = useSharedValue(0);
  /** Degrees, about its middle: rolls, flips and handstands. */
  const roll = useSharedValue(0);
  /** 1 facing forward, -1 turned around. */
  const turn = useSharedValue(1);
  /** 0–1: squashed down while being stroked (up to 2 sitting for a trick). */
  const squish = useSharedValue(0);
  /** 0–1: how much the happy face shows. */
  const joy = useSharedValue(0);
  const [effects, setEffects] = useState<Effect[]>([]);
  const nextId = useRef(0);
  const taps = useRef(0);
  const said = useRef(0);
  const dressed = useRef(0);
  const idled = useRef(0);
  /** Until when it's busy with something you asked for, so it doesn't wander off mid-trick. */
  const busyUntil = useRef(0);
  const stroking = useRef<ReturnType<typeof setInterval> | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      if (stroking.current) clearInterval(stroking.current);
    },
    []
  );

  function add(effect: NewEffect) {
    const id = nextId.current++;
    // One speech bubble at a time; a handful of hearts at most.
    setEffects((all) => [
      ...(effect.kind === 'bubble' ? all.filter((e) => e.kind !== 'bubble') : all).slice(-10),
      { ...effect, id } as Effect,
    ]);
  }

  /** Runs `run` after `ms`, unless the pet leaves the screen first. */
  function later(ms: number, run: () => void) {
    const timer = setTimeout(() => {
      timers.current = timers.current.filter((t) => t !== timer);
      run();
    }, ms);
    timers.current.push(timer);
  }

  function say(text?: string) {
    if (!spot) return;
    const lines = [...spot.sounds, ...says];
    add({ kind: 'bubble', text: text ?? lines[said.current++ % lines.length]! });
  }

  function hearts(count: number) {
    for (let i = 0; i < count; i++) later(i * 140, () => add({ kind: 'heart', dx: (i % 2 ? 1 : -1) * (4 + i * 3) }));
  }

  /** The happy face, for `ms`. */
  function cheer(ms: number) {
    joy.set(withSequence(withTiming(1, { duration: 90 }), withDelay(ms, withTiming(0, { duration: 160 }))));
  }

  function jump(height: number) {
    hop.set(
      withSequence(withTiming(height, { duration: LEAP_UP, easing: UP }), withTiming(0, { duration: 210, easing: DOWN }))
    );
  }

  /** Something's happening for about `ms`: idle moments wait until well after. */
  function busy(ms = 1500) {
    busyUntil.current = Math.max(busyUntil.current, Date.now() + ms);
  }

  function tap() {
    if (!spot) return;
    busy();
    const count = taps.current++;
    if (tricks.length && count % 4 === 3) {
      showOff(tricks[Math.floor(count / 4) % tricks.length]!);
      return;
    }
    const reaction = REACTIONS[count % REACTIONS.length]!;
    const size = spot.box[3];
    if (reaction === 'hop') jump(size * 0.14);
    if (reaction === 'wiggle') {
      tilt.set(
        withSequence(
          withTiming(7, { duration: 110, easing: SWING }),
          withTiming(-7, { duration: 170, easing: SWING }),
          withTiming(5, { duration: 150, easing: SWING }),
          withTiming(0, { duration: 130, easing: SWING })
        )
      );
    }
    if (reaction === 'turn') {
      turn.set(
        withSequence(
          withTiming(-1, { duration: 260, easing: STANDARD }),
          withDelay(260, withTiming(1, { duration: 260, easing: STANDARD }))
        )
      );
    }
    cheer(700);
    say();
    hearts(2);
  }

  /** Starts stroking it: it settles down happily, purrs, and hearts keep floating up. */
  function holdStart() {
    if (!spot || stroking.current) return;
    busy(3000);
    squish.set(withTiming(1, { duration: 220, easing: STANDARD }));
    joy.set(withTiming(1, { duration: 120 }));
    say(spot.sounds[0]);
    hearts(1);
    stroking.current = setInterval(() => hearts(1), 420);
  }

  function holdEnd() {
    if (!stroking.current) return;
    clearInterval(stroking.current);
    stroking.current = null;
    squish.set(withTiming(0, { duration: 260, easing: STANDARD }));
    joy.set(withDelay(250, withTiming(0, { duration: 160 })));
  }

  /** A stroke from the Pet button: a moment of being held. */
  function stroke() {
    holdStart();
    later(1300, holdEnd);
  }

  /**
   * A treat drops in from above, right into its mouth; it gobbles it up. With a lesson, it then has
   * a go at the trick it's learning: partway while it's still learning, the whole thing once it has it.
   */
  function treat(lesson?: Lesson) {
    if (!spot) return;
    busy(lesson ? 4000 : 1500);
    add({ kind: 'treat', emoji: spot.treat });
    later(TREAT_FALL, () => {
      jump(spot.box[3] * 0.08);
      cheer(1100);
      say('Nom nom!');
      hearts(3);
    });
    if (!lesson) return;
    later(TREAT_FALL + 1000, () => {
      if (lesson.skill >= 1) {
        showOff(lesson.trick, 'Ta-da!');
        return;
      }
      const ms = perform(lesson.trick, lesson.skill);
      later(ms, () => say(lesson.skill < 0.4 ? 'Hmm?' : lesson.skill < 0.75 ? 'Like this?' : 'Almost!'));
    });
  }

  /** A trick it knows, done properly, with a cheer at the end. */
  function showOff(trick: TrickId, line?: string) {
    const ms = perform(trick, 1);
    busy(ms + 800);
    later(ms, () => {
      add({ kind: 'sparkles' });
      cheer(900);
      say(line);
      hearts(3);
    });
  }

  /**
   * Moves the pet through a trick and returns how long it takes. `skill` below 1 is a training
   * attempt: the same moves done only partway, so you can see it getting there. A fish stays in
   * its bowl, so its moves are smaller and it turns about its middle rather than falling over.
   */
  function perform(trick: TrickId, skill: number): number {
    if (!spot) return 0;
    const k = Math.min(1, Math.max(0.15, skill));
    const h = spot.box[3];
    const room = spot.bowl ? 0.15 : 1;
    // Rolls and dashes head for whichever side has more room.
    const dir = spot.box[0] + spot.box[2] / 2 < WORLD_WIDTH / 2 ? 1 : -1;
    const ease = { easing: STANDARD };
    switch (trick) {
      case 'sit':
        squish.set(
          withSequence(
            withTiming(1.8 * k, { duration: 180, ...ease }),
            withDelay(600, withTiming(0, { duration: 220, ...ease }))
          )
        );
        return 1000;
      case 'spin': {
        const flips = Math.max(1, Math.round(4 * k));
        const steps = Array.from({ length: flips }, (_, i) => withTiming(i % 2 ? 1 : -1, { duration: 120, easing: SWING }));
        if (flips % 2) steps.push(withTiming(1, { duration: 120, easing: SWING }));
        turn.set(withSequence(...steps));
        jump(h * 0.06 * (spot.bowl ? 0.5 : 1));
        return steps.length * 120 + 100;
      }
      case 'rollover':
        roll.set(
          withSequence(
            withTiming(dir * 360 * k, { duration: 700, ...ease }),
            k >= 1 ? withTiming(0, { duration: 0 }) : withTiming(0, { duration: 300, ...ease })
          )
        );
        slide.set(
          withSequence(withTiming(dir * 34 * k * room, { duration: 700, ...ease }), withTiming(0, { duration: 420, ...ease }))
        );
        return 1150;
      case 'playdead': {
        const over = spot.bowl ? roll : tilt;
        over.set(
          withSequence(
            withTiming(dir * (spot.bowl ? 180 : 90) * k, { duration: 260, easing: DOWN }),
            withDelay(900, withTiming(0, { duration: 260, ...ease }))
          )
        );
        later(1300, () => jump(h * 0.08 * (spot.bowl ? 0.5 : 1)));
        return 1700;
      }
      case 'dance': {
        const beats = Math.max(2, Math.round(6 * k));
        tilt.set(
          withSequence(
            ...Array.from({ length: beats }, (_, i) => withTiming((i % 2 ? -1 : 1) * 10 * k, { duration: 220, easing: SWING })),
            withTiming(0, { duration: 160, easing: SWING })
          )
        );
        for (let i = 0; i < beats; i += 2) later(i * 220, () => jump(h * 0.05 * (spot.bowl ? 0.5 : 1)));
        say('♪');
        return beats * 220 + 160;
      }
      case 'backflip': {
        const height = h * 0.45 * k * (spot.bowl ? 0.2 : 1);
        hop.set(
          withSequence(withTiming(height, { duration: 300, easing: UP }), withTiming(0, { duration: 300, easing: DOWN }))
        );
        roll.set(
          withSequence(
            withTiming(-dir * 360 * k, { duration: 600, ...ease }),
            k >= 1 ? withTiming(0, { duration: 0 }) : withTiming(0, { duration: 220, ...ease })
          )
        );
        return 850;
      }
      case 'zoomies': {
        const far = 80 * k * room;
        slide.set(
          withSequence(
            withTiming(dir * far, { duration: 340, ...ease }),
            withTiming(-dir * far, { duration: 620, ...ease }),
            withTiming(0, { duration: 340, ...ease })
          )
        );
        turn.set(
          withSequence(
            withDelay(300, withTiming(-1, { duration: 80 })),
            withDelay(560, withTiming(1, { duration: 80 }))
          )
        );
        for (let i = 0; i < 6; i++) later(i * 210, () => jump(h * 0.05 * (spot.bowl ? 0.5 : 1)));
        return 1350;
      }
      case 'handstand':
        hop.set(
          withSequence(
            withTiming(h * 0.25 * k * (spot.bowl ? 0.2 : 1), { duration: 240, easing: UP }),
            withDelay(900, withTiming(0, { duration: 240, easing: DOWN }))
          )
        );
        roll.set(
          withSequence(
            withTiming(180 * k, { duration: 300, ...ease }),
            withDelay(840, withTiming(k >= 1 ? 360 : 0, { duration: 300, ...ease })),
            withTiming(0, { duration: 0 })
          )
        );
        return 1500;
    }
  }

  /** A little happy bounce, for an overjoyed pet now and then. */
  function bounce() {
    if (!spot) return;
    jump(spot.box[3] * 0.08);
    cheer(600);
    hearts(1);
  }

  /**
   * Trying on a new look: it hops up and twirls round twice to show it off, sparkles go off, and it
   * says what it thinks.
   */
  function dressUp() {
    if (!spot) return;
    busy(1500);
    jump(spot.box[3] * 0.16);
    turn.set(
      withSequence(
        withTiming(-1, { duration: 130, easing: SWING }),
        withTiming(1, { duration: 130, easing: SWING }),
        withTiming(-1, { duration: 130, easing: SWING }),
        withTiming(1, { duration: 130, easing: SWING })
      )
    );
    later(320, () => add({ kind: 'sparkles' }));
    cheer(1100);
    later(420, () => say(DRESS_UP_LINES[dressed.current++ % DRESS_UP_LINES.length]));
    hearts(2);
  }

  /**
   * Plays with its toy: a frisbee to catch, a rope to tug or bubbles to pop, or fetch with a ball for
   * any other toy.
   */
  function play(toy?: string) {
    if (toy === 'frisbee') frisbee();
    else if (toy === 'rope') tug();
    else if (toy === 'bubbles') bubbles();
    else fetchBall();
  }

  /** Leans toward a throw and crouches, then leaps up to catch it, `leap` (a share of its height) high. */
  function leapFor(dir: number, flight: number, leap: number) {
    if (!spot) return;
    tilt.set(
      withSequence(
        withTiming(dir * 6, { duration: 350, easing: SWING }),
        withDelay(flight - 900, withTiming(0, { duration: 250, easing: SWING }))
      )
    );
    later(flight - LEAP_UP - 150, () =>
      squish.set(
        withSequence(withTiming(0.8, { duration: 150, easing: STANDARD }), withTiming(0, { duration: 110, easing: UP }))
      )
    );
    later(flight - LEAP_UP, () => jump(spot.box[3] * leap));
  }

  /** A frisbee glides in high from the side, slowing as it floats down, and the pet leaps right up for it. */
  function frisbee() {
    if (!spot) return;
    busy(FRISBEE + 800);
    const { dir } = fetchPath(spot);
    add({ kind: 'frisbee' });
    leapFor(dir, FRISBEE, FRISBEE_LEAP);
    later(FRISBEE, () => {
      add({ kind: 'sparkles', at: frisbeeCatch(spot) });
      cheer(900);
      say('Caught it!');
      hearts(2);
    });
  }

  /** A rope comes in from the side; the pet grabs it and tugs, three good pulls, and wins. */
  function tug() {
    if (!spot) return;
    busy(ROPE_IN + TUG + 800);
    const { dir } = fetchPath(spot);
    add({ kind: 'rope', dir });
    const pulls = [12, 16, 20].flatMap((far) => [
      withTiming(-dir * far, { duration: 260, easing: SWING }),
      withTiming(-dir * far * 0.3, { duration: 220, easing: SWING }),
    ]);
    slide.set(withDelay(ROPE_IN, withSequence(...pulls, withTiming(0, { duration: 320, easing: STANDARD }))));
    const leans = [0, 1, 2].flatMap(() => [
      withTiming(-dir * 8, { duration: 260, easing: SWING }),
      withTiming(-dir * 2, { duration: 220, easing: SWING }),
    ]);
    tilt.set(withDelay(ROPE_IN, withSequence(...leans, withTiming(0, { duration: 320, easing: SWING }))));
    later(ROPE_IN, () => {
      cheer(TUG);
      say('Grrr!');
    });
    later(ROPE_IN + TUG, () => {
      say('Mine!');
      hearts(3);
    });
  }

  /** Bubbles float up past it, and it hops to pop each one. */
  function bubbles() {
    if (!spot) return;
    const last = SOAP[SOAP.length - 1]![1] + SOAP_RISE * SOAP_POP;
    busy(last + 800);
    for (const [dx, delay] of SOAP) {
      add({ kind: 'soap', dx, delay });
      later(delay + SOAP_RISE * SOAP_POP - LEAP_UP, () => jump(spot.box[3] * 0.12));
      later(delay + SOAP_RISE * SOAP_POP, () => {
        cheer(400);
        hearts(1);
      });
    }
    later(last, () => say('Pop!'));
  }

  /**
   * Fetch: a ball is thrown in from the side and bounces twice on the way. The pet leans toward it,
   * crouches, and leaps to catch it at the top of its jump; the ball pops into sparkles.
   */
  function fetchBall() {
    if (!spot) return;
    busy(FETCH + 800);
    const { dir } = fetchPath(spot);
    add({ kind: 'ball' });
    leapFor(dir, FETCH, CATCH_LEAP);
    later(FETCH, () => {
      add({ kind: 'sparkles' });
      cheer(900);
      say('Got it!');
      hearts(2);
    });
  }

  /**
   * Goal zoomies: it tears round the yard, edge to edge and back twice, kicking up dust, then
   * celebrates. A fish does loop-the-loops in its bowl, blowing bubbles.
   */
  function zoomies() {
    if (!spot) return;
    const [x, , w, h] = spot.box;
    busy(3600);
    say('Goal!!');
    cheer(3000);
    if (spot.bowl) {
      roll.set(
        withSequence(
          withTiming(360, { duration: 700, easing: STANDARD }),
          withTiming(720, { duration: 700, easing: STANDARD }),
          withTiming(0, { duration: 0 })
        )
      );
      add({ kind: 'bubbles' });
      later(700, () => add({ kind: 'bubbles' }));
      later(1500, () => {
        add({ kind: 'sparkles' });
        hearts(3);
      });
      return;
    }
    // As far as each edge of the yard, leaving a little room.
    const right = WORLD_WIDTH - 14 - (x + w);
    const left = -(x - 14);
    const run = { easing: SWING };
    const legs = [
      { to: right, ms: 480 },
      { to: left, ms: 820 },
      { to: right, ms: 820 },
      { to: 0, ms: 480 },
    ];
    slide.set(withSequence(...legs.map((leg) => withTiming(leg.to, { duration: leg.ms, ...run }))));
    // Turns round at the end of each run.
    turn.set(withSequence(...legs.map((leg, i) => withDelay(leg.ms - 60, withTiming(i % 2 ? 1 : -1, { duration: 60 })))));
    // Little bounding hops all the way, and a puff of dust where it lands.
    const centre = x + w / 2;
    const total = legs.reduce((sum, leg) => sum + leg.ms, 0);
    let start = 0;
    let from = 0;
    for (const leg of legs) {
      for (let t = 0; t < leg.ms; t += 170) {
        const p = t / leg.ms;
        const eased = p < 0.5 ? 2 * p * p : 1 - 2 * (1 - p) * (1 - p);
        const px = centre + from + (leg.to - from) * eased;
        later(start + t, () => {
          jump(h * 0.05);
          add({ kind: 'dust', x: px });
        });
      }
      start += leg.ms;
      from = leg.to;
    }
    later(total + 80, () => {
      add({ kind: 'sparkles' });
      say('Zoom zoom!');
      hearts(4);
    });
  }

  /**
   * Something it does by itself when you've left it be for a while: chases its tail, digs, pounces
   * on something only it can see, or watches a butterfly. Nothing if you've just been playing.
   */
  function idle() {
    if (!spot || Date.now() < busyUntil.current + IDLE_AFTER) return;
    const moment = IDLE[idled.current++ % IDLE.length]!;
    const h = spot.box[3];
    const small = spot.bowl ? 0.5 : 1;
    const dir = spot.box[0] + spot.box[2] / 2 < WORLD_WIDTH / 2 ? 1 : -1;
    busy(2600);
    switch (moment) {
      case 'tail': {
        // Round and round after its own tail.
        const flips = 6;
        turn.set(
          withSequence(
            ...Array.from({ length: flips }, (_, i) => withTiming(i % 2 ? 1 : -1, { duration: 150, easing: SWING })),
            withTiming(1, { duration: 150, easing: SWING })
          )
        );
        tilt.set(
          withSequence(
            ...Array.from({ length: flips }, (_, i) => withTiming((i % 2 ? -1 : 1) * 6, { duration: 150, easing: SWING })),
            withTiming(0, { duration: 150, easing: SWING })
          )
        );
        for (let i = 0; i < flips; i += 2) later(i * 150, () => jump(h * 0.04 * small));
        say('?!');
        later(flips * 150 + 200, () => cheer(500));
        return;
      }
      case 'dig':
        if (spot.bowl) {
          add({ kind: 'bubbles' });
          later(900, () => say('Blub!'));
          return;
        }
        // Nose down, paws going, earth flying out behind.
        tilt.set(
          withSequence(
            withTiming(dir * 12, { duration: 200, easing: STANDARD }),
            ...Array.from({ length: 6 }, (_, i) => withTiming(dir * (i % 2 ? 12 : 16), { duration: 120, easing: SWING })),
            withTiming(0, { duration: 240, easing: STANDARD })
          )
        );
        squish.set(
          withSequence(withTiming(0.5, { duration: 200, easing: STANDARD }), withDelay(720, withTiming(0, { duration: 240, easing: STANDARD })))
        );
        for (let i = 0; i < 4; i++) later(220 + i * 180, () => add({ kind: 'dirt', dir: -dir }));
        later(1250, () => {
          jump(h * 0.06);
          say(['A bone?', 'Hmm…', 'Ooh!'][idled.current % 3]);
        });
        return;
      case 'pounce': {
        // Crouches, wiggles, and springs at nothing at all.
        const far = 34 * (spot.bowl ? 0.15 : 1);
        squish.set(
          withSequence(withTiming(0.9, { duration: 260, easing: STANDARD }), withDelay(440, withTiming(0, { duration: 120, easing: UP })))
        );
        tilt.set(
          withSequence(
            withDelay(260, withTiming(3, { duration: 90, easing: SWING })),
            withTiming(-3, { duration: 90, easing: SWING }),
            withTiming(3, { duration: 90, easing: SWING }),
            withTiming(0, { duration: 90, easing: SWING })
          )
        );
        later(700, () => {
          jump(h * 0.2 * small);
          slide.set(
            withSequence(
              withTiming(dir * far, { duration: 380, easing: STANDARD }),
              withDelay(500, withTiming(0, { duration: 600, easing: STANDARD }))
            )
          );
        });
        later(1150, () => say('Got it!'));
        return;
      }
      case 'butterfly':
        // It flutters round its head; the pet looks up and tries to catch it.
        add({ kind: 'butterfly' });
        later(900, () => tilt.set(withSequence(withTiming(-dir * 6, { duration: 300, easing: SWING }), withDelay(900, withTiming(0, { duration: 300, easing: SWING })))));
        later(1300, () => jump(h * 0.12 * small));
        later(1900, () => jump(h * 0.16 * small));
        later(2300, () => {
          say('Aww…');
          cheer(500);
        });
        return;
    }
  }

  function remove(id: number) {
    setEffects((all) => all.filter((e) => e.id !== id));
  }

  return {
    hop,
    slide,
    tilt,
    roll,
    turn,
    squish,
    joy,
    effects,
    remove,
    tap,
    holdStart,
    holdEnd,
    stroke,
    treat,
    play,
    showOff,
    say,
    bounce,
    dressUp,
    zoomies,
    idle,
  };
}

/**
 * Wraps one of the pet's layers so it moves with the play: hops, slides, wiggles, turns and squishes
 * about its feet, and rolls about its middle.
 */
export function PetBody({
  play,
  spot,
  scale,
  children,
}: {
  play: PetPlay;
  spot: PetSpot;
  scale: number;
  children: ReactNode;
}) {
  const [x, y, w, h] = spot.box;
  const feet = [(x + w / 2) * scale, (y + h) * scale, 0];
  const middle = [(x + w / 2) * scale, (y + h / 2) * scale, 0];
  const { hop, slide, tilt, roll, turn, squish } = play;
  const style = useAnimatedStyle(() => ({
    transformOrigin: feet,
    transform: [
      { translateX: slide.get() * scale },
      { translateY: -hop.get() * scale },
      { rotate: `${tilt.get()}deg` },
      { scaleX: turn.get() * (1 + squish.get() * 0.05) },
      { scaleY: 1 - squish.get() * 0.07 },
    ],
  }));
  const rolled = useAnimatedStyle(() => ({ transformOrigin: middle, transform: [{ rotate: `${roll.get()}deg` }] }));
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <Animated.View style={[StyleSheet.absoluteFill, rolled]}>{children}</Animated.View>
    </Animated.View>
  );
}

/** A little buddy's layer: it hops along with the pet, not quite as high. */
export function FollowBody({ play, scale, children }: { play: PetPlay; scale: number; children: ReactNode }) {
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: -play.hop.get() * 0.5 * scale }] }));
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      {children}
    </Animated.View>
  );
}

/** The pet itself, to tap or hold; a little bigger than it looks, so it's easy to hit. */
export function PetTarget({ play, spot, scale }: { play: PetPlay; spot: PetSpot; scale: number }) {
  const [x, y, w, h] = spot.box;
  const pad = 8;
  return (
    <Pressable
      onPress={play.tap}
      onLongPress={play.holdStart}
      onPressOut={play.holdEnd}
      delayLongPress={280}
      accessibilityRole="button"
      accessibilityLabel="Your pet"
      accessibilityHint="Tap to play, or hold to pet it"
      style={{
        position: 'absolute',
        left: (x - pad) * scale,
        top: (y - pad) * scale,
        width: (w + pad * 2) * scale,
        height: (h + pad * 2) * scale,
      }}
    />
  );
}

/** Hearts, speech bubbles, treats and balls, drawn over the scene. */
export function PetEffects({ play, spot, scale }: { play: PetPlay; spot: PetSpot; scale: number }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {play.effects.map((effect) => {
        const done = () => play.remove(effect.id);
        switch (effect.kind) {
          case 'heart':
            return <FloatingHeart key={effect.id} spot={spot} dx={effect.dx} scale={scale} onDone={done} />;
          case 'bubble':
            return <SpeechBubble key={effect.id} spot={spot} text={effect.text} scale={scale} onDone={done} />;
          case 'treat':
            return <FallingTreat key={effect.id} spot={spot} emoji={effect.emoji} scale={scale} onDone={done} />;
          case 'ball':
            return <FetchBall key={effect.id} spot={spot} scale={scale} onDone={done} />;
          case 'frisbee':
            return <Frisbee key={effect.id} spot={spot} scale={scale} onDone={done} />;
          case 'rope':
            return <TugRope key={effect.id} spot={spot} dir={effect.dir} slide={play.slide} scale={scale} onDone={done} />;
          case 'soap':
            return (
              <SoapBubble key={effect.id} spot={spot} dx={effect.dx} delay={effect.delay} scale={scale} onDone={done} />
            );
          case 'sparkles':
            return <CatchSparkles key={effect.id} spot={spot} at={effect.at} scale={scale} onDone={done} />;
          case 'dust':
            return <Dust key={effect.id} spot={spot} x={effect.x} scale={scale} onDone={done} />;
          case 'dirt':
            return <Dirt key={effect.id} spot={spot} dir={effect.dir} scale={scale} onDone={done} />;
          case 'butterfly':
            return <Butterfly key={effect.id} spot={spot} scale={scale} onDone={done} />;
          case 'bubbles':
            return <Bubbles key={effect.id} spot={spot} scale={scale} onDone={done} />;
        }
      })}
    </View>
  );
}

/** 0 → 1 over `duration` from when it appears (after `delay`), then `onDone`. */
function useProgress(duration: number, onDone: () => void, easing = Easing.linear, delay = 0): SharedValue<number> {
  const p = useSharedValue(0);
  useEffect(() => {
    p.set(
      withDelay(
        delay,
        withTiming(1, { duration, easing }, (finished) => {
          if (finished) scheduleOnRN(onDone);
        })
      )
    );
    // Runs once: each effect plays a single time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return p;
}

const HEART_SIZE = 14;

function FloatingHeart({ spot, dx, scale, onDone }: { spot: PetSpot; dx: number; scale: number; onDone: () => void }) {
  const p = useProgress(1200, onDone, UP);
  const size = HEART_SIZE * scale;
  const style = useAnimatedStyle(() => {
    const v = p.get();
    return {
      opacity: v < 0.12 ? v / 0.12 : 1 - (v - 0.12) / 0.88,
      transform: [
        { translateX: Math.sin(v * Math.PI * 2) * 4 * scale },
        { translateY: -v * 48 * scale },
        { scale: 0.6 + 0.4 * Math.min(1, v * 4) },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        styles.effect,
        { left: (spot.head[0] + dx) * scale - size / 2, top: spot.head[1] * scale - size, width: size, height: size },
        style,
      ]}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path
          d="M12 21C5 15.4 2 12.2 2 8.4 2 5.4 4.3 3 7.2 3c1.9 0 3.6 1 4.8 2.6C13.2 4 14.9 3 16.8 3 19.7 3 22 5.4 22 8.4c0 3.8-3 7-10 12.6Z"
          fill={HEART}
        />
        <Path d="M6.4 6.2c-1.3.4-2 1.6-1.9 2.8.5-1 1.3-1.7 2.4-2.1Z" fill="#FFFFFF" opacity={0.7} />
      </Svg>
    </Animated.View>
  );
}

function SpeechBubble({
  spot,
  text,
  scale,
  onDone,
}: {
  spot: PetSpot;
  text: string;
  scale: number;
  onDone: () => void;
}) {
  const p = useProgress(1400, onDone);
  const style = useAnimatedStyle(() => {
    const v = p.get();
    return {
      opacity: v < 0.08 ? v / 0.08 : v > 0.8 ? (1 - v) / 0.2 : 1,
      transform: [{ translateY: -Math.min(1, v / 0.08) * 4 * scale }],
    };
  });
  // Just beside the pet at head height, on whichever side has more room (a big pet fills the middle).
  const [boxX, , boxW] = spot.box;
  const right = WORLD_WIDTH - (boxX + boxW) >= boxX;
  const x = (right ? boxX + boxW - 6 : boxX + 6) * scale;
  return (
    <Animated.View
      style={[
        styles.effect,
        styles.bubble,
        { top: (spot.head[1] - 14) * scale },
        right ? { left: x } : { right: WORLD_WIDTH * scale - x },
        style,
      ]}>
      <NativeText style={styles.bubbleText}>{text}</NativeText>
    </Animated.View>
  );
}

/** How long a treat takes to drop into the pet's mouth. */
const TREAT_FALL = 520;

function FallingTreat({
  spot,
  emoji,
  scale,
  onDone,
}: {
  spot: PetSpot;
  emoji: string;
  scale: number;
  onDone: () => void;
}) {
  const total = TREAT_FALL + 200;
  const p = useProgress(total, onDone);
  const land = TREAT_FALL / total;
  const size = 24 * scale;
  const style = useAnimatedStyle(() => {
    const v = p.get();
    const fall = Math.min(1, v / land);
    const eaten = v > land ? (v - land) / (1 - land) : 0;
    return {
      opacity: 1 - eaten,
      transform: [{ translateY: -(1 - fall * fall) * (spot.mouth[1] + 30) * scale }, { scale: 1 - eaten * 0.7 }],
    };
  });
  return (
    <Animated.View
      style={[
        styles.effect,
        styles.center,
        { left: spot.mouth[0] * scale - size, top: spot.mouth[1] * scale - size, width: size * 2, height: size * 2 },
        style,
      ]}>
      <NativeText style={{ fontSize: size }}>{emoji}</NativeText>
    </Animated.View>
  );
}

/** How long fetch takes, from the throw to the catch. */
const FETCH = 1400;
/** How long a leap takes to reach its top. */
const LEAP_UP = 170;
/** How high the pet leaps for the catch, as a share of its height. */
const CATCH_LEAP = 0.2;
const BALL_RADIUS = 9;
/** When the ball touches the ground, as shares of the flight. */
const FIRST_BOUNCE = 0.34;
const SECOND_BOUNCE = 0.62;

/**
 * Fetch's path in scene units: thrown in from the side with more room, at about head height, it
 * lands well out from the pet, bounces in closer, then bounces up into the pet's mouth at the top
 * of its leap.
 */
function fetchPath(spot: PetSpot) {
  const [x, y, w, h] = spot.box;
  const centre = x + w / 2;
  const dir = centre < WORLD_WIDTH / 2 ? 1 : -1;
  const clampX = (v: number) => Math.min(WORLD_WIDTH - 16, Math.max(16, v));
  return {
    dir,
    start: [dir > 0 ? WORLD_WIDTH + 20 : -20, Math.max(24, spot.head[1] - 30)] as const,
    bounces: [clampX(centre + dir * (w / 2 + 70)), clampX(centre + dir * (w / 2 + 26))] as const,
    ground: y + h - BALL_RADIUS,
    catch: [centre, spot.mouth[1] - h * CATCH_LEAP] as const,
  };
}

/** A red rubber ball with a white band, drawn rather than an emoji so it looks the same everywhere. */
function Ball({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <Path d="M10 0a10 10 0 1 1 0 20a10 10 0 1 1 0-20Z" fill="#FF6F61" />
      <Path d="M10 20a10 10 0 0 1-10-10h20a10 10 0 0 1-10 10Z" fill="#E85A4F" opacity={0.6} />
      <Path d="M0.7 7.3C6 9.6 14 9.6 19.3 7.3L19.9 10.9C14 13.4 6 13.4 0.1 10.9Z" fill="#FFFFFF" />
      <Path d="M5 5.5a2.2 1.5-35 1 1 3-2.2a2.2 1.5-35 1 1-3 2.2Z" fill="#FFFFFF" opacity={0.55} />
    </Svg>
  );
}

function FetchBall({ spot, scale, onDone }: { spot: PetSpot; scale: number; onDone: () => void }) {
  const total = FETCH + 120;
  const p = useProgress(total, onDone);
  const caught = FETCH / total;
  const size = BALL_RADIUS * 2 * scale;
  const {
    start: [sx, sy],
    bounces: [b1, b2],
    ground,
    catch: [cx, cy],
  } = fetchPath(spot);

  const style = useAnimatedStyle(() => {
    const v = p.get();
    let x = cx;
    let y = cy;
    if (v < FIRST_BOUNCE) {
      // Thrown flat, falling faster and faster to the first bounce.
      const t = v / FIRST_BOUNCE;
      x = sx + (b1 - sx) * t;
      y = sy + (ground - sy) * t * t;
    } else if (v < SECOND_BOUNCE) {
      const t = (v - FIRST_BOUNCE) / (SECOND_BOUNCE - FIRST_BOUNCE);
      x = b1 + (b2 - b1) * t;
      y = ground - 46 * 4 * t * (1 - t);
    } else if (v < caught) {
      // The last bounce arcs up and over into the catch.
      const t = (v - SECOND_BOUNCE) / (caught - SECOND_BOUNCE);
      x = b2 + (cx - b2) * t;
      y = ground + (cy - ground) * t - 34 * 4 * t * (1 - t);
    }
    // Squashed for a moment as it hits the ground, then gulped down.
    const hit = Math.max(0, 1 - Math.min(Math.abs(v - FIRST_BOUNCE), Math.abs(v - SECOND_BOUNCE)) / 0.035);
    const gone = v > caught ? (v - caught) / (1 - caught) : 0;
    return {
      opacity: 1 - gone,
      transform: [
        { translateX: x * scale - size / 2 },
        { translateY: y * scale - size / 2 },
        { scaleX: (1 + hit * 0.18) * (1 - gone * 0.6) },
        { scaleY: (1 - hit * 0.24) * (1 - gone * 0.6) },
        // Rolls as it travels.
        { rotate: `${((x - sx) / BALL_RADIUS) * (180 / Math.PI)}deg` },
      ],
    };
  });

  return (
    <Animated.View style={[styles.effect, styles.origin, { width: size, height: size }, style]}>
      <Ball size={size} />
    </Animated.View>
  );
}

/** A little burst of sparkles where the ball is caught (or `at` another spot). */
function CatchSparkles({
  spot,
  at,
  scale,
  onDone,
}: {
  spot: PetSpot;
  at?: readonly [number, number];
  scale: number;
  onDone: () => void;
}) {
  const p = useProgress(520, onDone, UP);
  const [cx, cy] = at ?? fetchPath(spot).catch;
  const size = 48 * scale;
  const style = useAnimatedStyle(() => {
    const v = p.get();
    return { opacity: 1 - v * v, transform: [{ scale: 0.4 + v }, { rotate: `${v * 40}deg` }] };
  });
  return (
    <Animated.View
      style={[styles.effect, { left: cx * scale - size / 2, top: cy * scale - size / 2, width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 48 48">
        {Array.from({ length: 6 }, (_, i) => {
          const a = (i * Math.PI) / 3;
          const x = 24 + Math.cos(a) * 15;
          const y = 24 + Math.sin(a) * 15;
          const r = i % 2 ? 3.2 : 4.4;
          return (
            <Path
              key={i}
              d={`M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}Z`}
              fill={i % 2 ? '#FFFFFF' : '#FFD54F'}
            />
          );
        })}
      </Svg>
    </Animated.View>
  );
}

/** Where its feet touch the ground. */
const groundOf = (spot: PetSpot) => spot.box[1] + spot.box[3] - 3;

/** A puff of dust where it lands mid-run: three soft blobs that spread and fade. */
function Dust({ spot, x, scale, onDone }: { spot: PetSpot; x: number; scale: number; onDone: () => void }) {
  const p = useProgress(520, onDone, UP);
  const size = 30 * scale;
  const style = useAnimatedStyle(() => {
    const v = p.get();
    return { opacity: 0.7 * (1 - v), transform: [{ scale: 0.4 + v * 0.9 }, { translateY: -v * 4 * scale }] };
  });
  return (
    <Animated.View
      style={[styles.effect, { left: x * scale - size / 2, top: groundOf(spot) * scale - size * 0.6, width: size, height: size * 0.6 }, style]}>
      <Svg width={size} height={size * 0.6} viewBox="0 0 30 18">
        <Path
          d="M2 12a6 6 0 1 0 12 0a6 6 0 1 0 -12 0ZM9 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0ZM19 12a5 5 0 1 0 10 0a5 5 0 1 0 -10 0Z"
          fill="#E9E1D3"
        />
      </Svg>
    </Animated.View>
  );
}

/** Clods of earth thrown up behind it while it digs, arcing out and falling. */
function Dirt({ spot, dir, scale, onDone }: { spot: PetSpot; dir: number; scale: number; onDone: () => void }) {
  const p = useProgress(620, onDone);
  const [x, , w] = spot.box;
  const from = x + w / 2 + dir * w * 0.25;
  const ground = groundOf(spot);
  return (
    <>
      {[0, 1, 2, 3].map((i) => (
        <Clod key={i} p={p} index={i} from={from} ground={ground} dir={dir} scale={scale} />
      ))}
    </>
  );
}

function Clod({
  p,
  index,
  from,
  ground,
  dir,
  scale,
}: {
  p: SharedValue<number>;
  index: number;
  from: number;
  ground: number;
  dir: number;
  scale: number;
}) {
  const size = (3 + (index % 2) * 1.6) * scale;
  const reach = 16 + index * 7;
  const lift = 18 + (index % 3) * 6;
  const style = useAnimatedStyle(() => {
    const v = p.get();
    return {
      opacity: v < 0.8 ? 1 : (1 - v) / 0.2,
      transform: [
        { translateX: (from + dir * reach * v) * scale - size / 2 },
        { translateY: (ground - lift * 4 * v * (1 - v)) * scale - size },
      ],
    };
  });
  return <Animated.View style={[styles.effect, styles.origin, styles.clod, { width: size, height: size, borderRadius: size / 2 }, style]} />;
}

const BUTTERFLY = 2600;

/**
 * A butterfly drifts in from the far side, loops twice round the pet's head just out of reach, and
 * flutters away up and out of the scene.
 */
function Butterfly({ spot, scale, onDone }: { spot: PetSpot; scale: number; onDone: () => void }) {
  const p = useProgress(BUTTERFLY, onDone);
  const size = 16 * scale;
  const [hx, hy] = spot.head;
  const dir = hx < WORLD_WIDTH / 2 ? 1 : -1;
  const start = [dir > 0 ? WORLD_WIDTH + 20 : -20, hy - 60] as const;
  const out = [hx - dir * 90, -30] as const;
  const r = 30;
  const style = useAnimatedStyle(() => {
    const v = p.get();
    let x: number;
    let y: number;
    if (v < 0.25) {
      const t = v / 0.25;
      x = start[0] + (hx + r - start[0]) * t;
      y = start[1] + (hy - 24 - start[1]) * t;
    } else if (v < 0.78) {
      const a = ((v - 0.25) / 0.53) * Math.PI * 4;
      x = hx + Math.cos(a) * r;
      y = hy - 24 - Math.sin(a) * r * 0.45;
    } else {
      const t = (v - 0.78) / 0.22;
      x = hx + r + (out[0] - hx - r) * t;
      y = hy - 24 + (out[1] - hy + 24) * t;
    }
    // A little up-and-down as it flaps, and the wings closing and opening.
    y += Math.sin(v * 60) * 2;
    return {
      transform: [
        { translateX: x * scale - size / 2 },
        { translateY: y * scale - size / 2 },
        { scaleX: 0.25 + 0.75 * Math.abs(Math.sin(v * 48)) },
      ],
    };
  });
  return (
    <Animated.View style={[styles.effect, styles.origin, { width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 16 16">
        <Path d="M8 8C5 2 0 2 1 6C1.5 8 4 9 8 8ZM8 8C11 2 16 2 15 6C14.5 8 12 9 8 8Z" fill="#FF9EC4" />
        <Path d="M8 8C5 13 1.5 13 2 10.5C2.5 9 5 8.5 8 8ZM8 8C11 13 14.5 13 14 10.5C13.5 9 11 8.5 8 8Z" fill="#C9A8FF" />
        <Path d="M7.4 4.5h1.2v8h-1.2Z" fill="#4A3A5C" />
      </Svg>
    </Animated.View>
  );
}

/** A few bubbles rising from a fish's mouth and fading near the top of the water. */
function Bubbles({ spot, scale, onDone }: { spot: PetSpot; scale: number; onDone: () => void }) {
  const p = useProgress(1300, onDone);
  return (
    <>
      {[0, 1, 2, 3].map((i) => (
        <Bubble key={i} p={p} index={i} spot={spot} scale={scale} />
      ))}
    </>
  );
}

function Bubble({ p, index, spot, scale }: { p: SharedValue<number>; index: number; spot: PetSpot; scale: number }) {
  const size = (5 + (index % 2) * 2.5) * scale;
  const [mx, my] = spot.mouth;
  const style = useAnimatedStyle(() => {
    const v = Math.min(1, Math.max(0, (p.get() - index * 0.12) / 0.6));
    return {
      opacity: v === 0 ? 0 : 1 - v,
      transform: [
        { translateX: (mx + 8 + Math.sin(v * 9 + index) * 3) * scale - size / 2 },
        { translateY: (my - v * 40) * scale - size / 2 },
      ],
    };
  });
  return (
    <Animated.View style={[styles.effect, styles.origin, styles.bubbleRing, { width: size, height: size, borderRadius: size / 2 }, style]} />
  );
}

// ---------- Frisbee ----------

/** How long the frisbee flies, and how high the pet leaps for it (a share of its height). */
const FRISBEE = 1700;
const FRISBEE_LEAP = 0.34;
/** The disc's height in scene units (it's twice as wide). */
const DISC = 13;

/** Where the frisbee is caught: in the pet's mouth at the top of its leap. */
function frisbeeCatch(spot: PetSpot): readonly [number, number] {
  const [x, , w, h] = spot.box;
  return [x + w / 2, spot.mouth[1] - h * FRISBEE_LEAP];
}

/** A flying disc, seen nearly edge-on. */
function Disc({ height }: { height: number }) {
  return (
    <Svg width={height * 2} height={height} viewBox="0 0 26 13">
      <Path d="M1 7.5a12 4.4 0 1 0 24 0a12 4.4 0 1 0-24 0Z" fill="#3E95C9" />
      <Path d="M1 6a12 4.4 0 1 0 24 0a12 4.4 0 1 0-24 0Z" fill="#5AB8F0" />
      <Path d="M5 6a8 2.6 0 1 0 16 0a8 2.6 0 1 0-16 0Z" fill="#9AD5F7" />
      <Path d="M6.6 6a6.4 2 0 1 0 12.8 0a6.4 2 0 1 0-12.8 0Z" fill="#5AB8F0" />
    </Svg>
  );
}

/** In from the side, high up, then floating down and slowing into the catch, on one smooth curve. */
function Frisbee({ spot, scale, onDone }: { spot: PetSpot; scale: number; onDone: () => void }) {
  const total = FRISBEE + 100;
  const p = useProgress(total, onDone);
  const caught = FRISBEE / total;
  const { dir } = fetchPath(spot);
  const [cx, cy] = frisbeeCatch(spot);
  const sx = dir > 0 ? WORLD_WIDTH + 30 : -30;
  const sy = Math.max(20, cy - 46);
  // The curve's control points: it sails in level, then sinks gently into the catch.
  const [ax, ay] = [sx - dir * 120, sy - 14];
  const [bx, by] = [cx + dir * 70, cy - 26];
  const w = DISC * 2 * scale;
  const h = DISC * scale;

  const style = useAnimatedStyle(() => {
    const v = p.get();
    const t = 1 - (1 - Math.min(1, v / caught)) ** 2;
    const u = 1 - t;
    const x = u * u * u * sx + 3 * u * u * t * ax + 3 * u * t * t * bx + t * t * t * cx;
    const y = u * u * u * sy + 3 * u * u * t * ay + 3 * u * t * t * by + t * t * t * cy;
    const gone = v > caught ? (v - caught) / (1 - caught) : 0;
    return {
      opacity: 1 - gone,
      transform: [
        { translateX: x * scale - w / 2 },
        { translateY: y * scale - h / 2 },
        { rotate: `${-dir * 8 + Math.sin(v * 30) * 3}deg` },
        { scaleY: 0.9 + Math.sin(v * 40) * 0.1 },
      ],
    };
  });
  return (
    <Animated.View style={[styles.effect, styles.origin, { width: w, height: h }, style]}>
      <Disc height={h} />
    </Animated.View>
  );
}

// ---------- Tug of war ----------

/** How long the rope takes to come in, how long the tugging lasts, and how long the rope is. */
const ROPE_IN = 450;
const TUG = 3 * 480 + 320;
const ROPE = 240;

/** A striped rope with a knot at the pet's end. */
function Rope({ width, height, knotRight }: { width: number; height: number; knotRight: boolean }) {
  const stripes = Array.from(
    { length: Math.ceil(ROPE / 9) },
    (_, i) => `M${i * 9 + 2} 4.6L${i * 9 + 5.4} 4.6L${i * 9 + 3.4} 9.4L${i * 9} 9.4Z`
  ).join('');
  const knot = knotRight ? ROPE - 6 : 6;
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${ROPE} 14`}>
      <Path d={`M0 4.6H${ROPE}V9.4H0Z`} fill="#F1E3C6" />
      <Path d={stripes} fill="#E5534B" />
      <Path d={`M${knot - 6} 7a6 6 0 1 0 12 0a6 6 0 1 0-12 0Z`} fill="#E5534B" />
    </Svg>
  );
}

/** The rope, held in the pet's mouth: it comes in from the side, moves as the pet tugs, then goes. */
function TugRope({
  spot,
  dir,
  slide,
  scale,
  onDone,
}: {
  spot: PetSpot;
  dir: number;
  slide: SharedValue<number>;
  scale: number;
  onDone: () => void;
}) {
  const total = ROPE_IN + TUG + 500;
  const p = useProgress(total, onDone);
  const inAt = ROPE_IN / total;
  const outAt = (ROPE_IN + TUG + 100) / total;
  const [mx, my] = spot.mouth;
  const w = ROPE * scale;
  const h = 14 * scale;
  const style = useAnimatedStyle(() => {
    const v = p.get();
    const enter = Math.min(1, v / inAt);
    const leave = v > outAt ? (v - outAt) / (1 - outAt) : 0;
    // Off toward the side it comes from, until it's in; pulled back out once the pet has won.
    const away = (1 - enter) * (1 - enter) * 200 + leave * leave * 260;
    const end = mx + slide.get() + dir * away;
    return { transform: [{ translateX: (dir > 0 ? end : end - ROPE) * scale }, { translateY: (my - 7) * scale }] };
  });
  return (
    <Animated.View style={[styles.effect, styles.origin, { width: w, height: h }, style]}>
      <Rope width={w} height={h} knotRight={dir < 0} />
    </Animated.View>
  );
}

// ---------- Bubbles ----------

/** How long a bubble takes to rise, and when (as a share of that) the pet pops it. */
const SOAP_RISE = 1500;
const SOAP_POP = 0.82;
/** Each bubble: how far to the side of the pet it rises, and when it starts (ms). */
const SOAP: readonly (readonly [number, number])[] = [
  [-30, 0],
  [26, 420],
  [-12, 840],
  [36, 1260],
];

/** A soap bubble drifting up past the pet's head, wobbling a little, until it's popped. */
function SoapBubble({
  spot,
  dx,
  delay,
  scale,
  onDone,
}: {
  spot: PetSpot;
  dx: number;
  delay: number;
  scale: number;
  onDone: () => void;
}) {
  const p = useProgress(SOAP_RISE + 180, onDone, Easing.linear, delay);
  const pop = (SOAP_RISE * SOAP_POP) / (SOAP_RISE + 180);
  const [, y, , h] = spot.box;
  const [hx, hy] = spot.head;
  const sx = hx + dx;
  const sy = y + h - 10;
  const ex = hx + dx * 0.35;
  const ey = hy - 6;
  const size = 16 * scale;
  const style = useAnimatedStyle(() => {
    const v = p.get();
    const t = Math.min(1, v / pop);
    const popped = v > pop ? (v - pop) / (1 - pop) : 0;
    return {
      opacity: Math.min(1, v * 8) * (1 - popped),
      transform: [
        { translateX: (sx + (ex - sx) * t + Math.sin(t * Math.PI * 3) * 4) * scale - size / 2 },
        { translateY: (sy + (ey - sy) * (1 - (1 - t) * (1 - t))) * scale - size / 2 },
        { scale: 1 + popped * 0.8 },
      ],
    };
  });
  return (
    <Animated.View style={[styles.effect, styles.origin, { width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 20 20">
        <Path d="M10 1a9 9 0 1 1 0 18a9 9 0 1 1 0-18Z" fill="#FFFFFF" opacity={0.22} />
        <Path
          d="M10 1a9 9 0 1 1 0 18a9 9 0 1 1 0-18ZM10 2.4a7.6 7.6 0 1 0 0 15.2a7.6 7.6 0 1 0 0-15.2Z"
          fill="#FFFFFF"
          opacity={0.85}
        />
        <Path d="M6 5.6a2.4 1.6-35 1 1 3-2a2.4 1.6-35 1 1-3 2Z" fill="#FFFFFF" />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  effect: { position: 'absolute' },
  clod: { backgroundColor: '#8A6A48' },
  bubbleRing: { borderWidth: 1.4, borderColor: 'rgba(255, 255, 255, 0.85)', backgroundColor: 'rgba(255, 255, 255, 0.2)' },
  /** Placed entirely by its transform. */
  origin: { left: 0, top: 0 },
  center: { alignItems: 'center', justifyContent: 'center' },
  bubble: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#FFFDF8',
    boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.15)',
  },
  bubbleText: { color: '#3A2F25', fontWeight: '800', fontSize: 14 },
});
