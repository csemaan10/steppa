// What the home screen and lock screen widgets show, kept on the phone so they can be redrawn
// without the app: the background step sync, iOS's timeline at midnight, and Android's widget task
// all draw from this. Each platform's drawing lives in ./publish.

import 'expo-sqlite/localStorage/install';

import { MD3DarkTheme, MD3LightTheme } from 'react-native-paper';

import { addDays, formatSteps, startOfDay, toDayKey } from '@/lib/dates';
import { mix, timeOfDay } from '@/lib/scene-art';
import { drawWorld, MOOD_SAYS, moodLine, moodOf, type KindPicks, type Mood, type WorldArt } from '@/lib/world';
import { readRingSettings, type RingSettings } from '@/lib/ring-style';
import { PALETTES, THEME_NAMES, type ThemeName } from '@/theme/palettes';

const STATE_KEY = 'steppa:widgets';
/** The app's theme choice (src/providers/theme-provider.tsx). */
const THEME_KEY = 'steppa:theme';

export type WidgetState = {
  /** The local day `steps` were counted on. */
  day: string;
  steps: number;
  goal: number;
  /** Goal days in a row up to the day before `day`; `day` adds one once its goal is met. */
  streakBefore: number;
  /** The pet as last seen: the steps it has grown with, and what it wears. Null without a pet. */
  pet: { steps: number; saved: KindPicks | undefined } | null;
  /** Today's picture when the pet isn't at home (off on a trip, or round at a friend's). */
  away: { day: string; art: WorldArt } | null;
};

const EMPTY: WidgetState = { day: '', steps: 0, goal: 10000, streakBefore: 0, pet: null, away: null };

export function readWidgetState(): WidgetState | null {
  try {
    const saved = localStorage.getItem(STATE_KEY);
    return saved ? { ...EMPTY, ...(JSON.parse(saved) as Partial<WidgetState>) } : null;
  } catch {
    return null;
  }
}

/** Saves what changed. Call `refreshWidgets` (./publish) afterwards to redraw them. */
export function saveWidgetState(patch: Partial<WidgetState>): void {
  try {
    const prev = readWidgetState() ?? EMPTY;
    const next = { ...prev, ...patch };
    // A sync on a new day: the streak carries on from the last day saved, until Today reloads it.
    if (patch.day && prev.day && patch.day !== prev.day && patch.streakBefore === undefined) {
      next.streakBefore = streakBefore(prev, new Date());
    }
    localStorage.setItem(STATE_KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable: the widgets keep what they last showed.
  }
}

/** Signed out: the widgets go back to asking you to open Steppa. */
export function clearWidgetState(): void {
  try {
    localStorage.removeItem(STATE_KEY);
  } catch {}
}

// ---------- What a widget shows ----------

export type WidgetColors = {
  background: string;
  text: string;
  muted: string;
  /** The ring and the big number. */
  primary: string;
  /** Past the goal: the ring's second lap and the number. */
  over: string;
  overText: string;
  /** The ring's empty part. */
  track: string;
  /** How much of the track shows: see-through in light mode, so it darkens the glows under it too. */
  trackAlpha: number;
  /** The app's background glows (screenBackground): colour, strength, centre and reach (shares of the widget). */
  glows: Glow[];
};

export type Glow = { color: string; alpha: number; x: number; y: number; reach: number };

export type PetView = {
  name: string;
  mood: Mood;
  /** A couple of words: "Snoozing", "Happy"... */
  feeling: string;
  /** How it feels and the steps to the next mood, as on the Pet tab. */
  line: string;
  /** What it says when you tap it on the widget, taken in turn (its own sounds, then its mood's). */
  says: string[];
  art: WorldArt;
};

export type WidgetView = {
  /** False before the app has synced once on this phone (or after signing out). */
  ready: boolean;
  steps: number;
  goal: number;
  /** Today's share of the goal; over 1 past it. */
  progress: number;
  over: boolean;
  /** "6,240". */
  stepsText: string;
  /** "6.2k", for the lock screen's little circle. */
  shortSteps: string;
  /** "62% of 10,000" or "+1,240 over goal". */
  goalText: string;
  streak: number;
  /** Null without a pet. */
  pet: PetView | null;
  /** The ring as the app draws it (Settings): style, colour, thickness. */
  ring: RingSettings;
  light: WidgetColors;
  dark: WidgetColors;
};

const FEELING: Record<Mood, string> = {
  sleepy: 'Snoozing',
  awake: 'Wants a walk',
  happy: 'Happy',
  overjoyed: 'Overjoyed',
};

/** "6,240" → "6.2k"; under 1,000 as is. */
function shortCount(steps: number): string {
  if (steps < 1000) return String(Math.round(steps));
  if (steps < 10000) return `${(Math.floor(steps / 100) / 10).toFixed(1).replace(/\.0$/, '')}k`;
  return `${Math.floor(steps / 1000)}k`;
}

/** Paper's colours are rgba() strings; the widgets want #RRGGBB. */
function hex(color: string): string {
  if (color.startsWith('#')) return color.slice(0, 7);
  const [r = 0, g = 0, b = 0] = color.match(/[\d.]+/g)?.map(Number) ?? [];
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
}

function themeName(): ThemeName {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    return THEME_NAMES.includes(saved as ThemeName) ? (saved as ThemeName) : 'green';
  } catch {
    return 'green';
  }
}

function colorsFor(name: ThemeName, dark: boolean): WidgetColors {
  const palette = PALETTES[name];
  const scheme = { ...(dark ? MD3DarkTheme : MD3LightTheme).colors, ...(dark ? palette.dark : palette.light) };
  const background = hex(scheme.background);
  const text = hex(scheme.onSurface);
  // As the app's screens: three soft glows in the palette's own primary tones, gentler lower down.
  const strength = dark ? 0.55 : 0.75;
  const [a, b] = dark
    ? [hex(scheme.primaryContainer), hex(scheme.inversePrimary)]
    : [hex(scheme.inversePrimary), hex(scheme.primaryContainer)];
  const glows: Glow[] = [
    { color: a, alpha: strength, x: 0.08, y: 0.04, reach: 0.55 },
    { color: b, alpha: strength * 0.8, x: 1, y: 0.38, reach: 0.45 },
    { color: a, alpha: strength * 0.6, x: 0.12, y: 0.92, reach: 0.5 },
  ];
  return {
    glows,
    background,
    text,
    muted: hex(scheme.onSurfaceVariant),
    primary: hex(scheme.primary),
    over: dark ? palette.accent.dark : palette.accent.light,
    overText: dark ? palette.accent.dark : palette.accent.text,
    // As the app's ring track (ringTrack): in light mode the text colour, see-through, so it shows over the
    // glows as well as the plain background; a touch stronger than the app's 12%, as widgets are small.
    track: dark ? hex(scheme.surfaceVariant) : text,
    trackAlpha: dark ? 1 : 0.16,
  };
}

const goalOf = (s: WidgetState) => (s.goal > 0 ? s.goal : 10000);

/**
 * Goal days in a row before the day of `now`. If the saved day is earlier, the run carries on only
 * if it was yesterday and its goal was met.
 */
function streakBefore(s: WidgetState, now: Date): number {
  if (s.day === toDayKey(now)) return s.streakBefore;
  const yesterday = toDayKey(addDays(startOfDay(now), -1));
  return s.day === yesterday && s.steps >= goalOf(s) ? s.streakBefore + 1 : 0;
}

/** Everything the widgets show at `now`, from what's saved. A new day starts at 0 steps. */
export function widgetView(state: WidgetState | null, now: Date = new Date()): WidgetView {
  const s = state ?? EMPTY;
  const today = toDayKey(now);
  const current = s.day === today;
  const steps = current ? s.steps : 0;
  const goal = goalOf(s);
  const before = streakBefore(s, now);
  const progress = steps / goal;
  const over = progress >= 1;
  const name = s.pet?.saved?.name || 'Your pet';
  const mood = moodOf(steps, goal);
  const art = !s.pet
    ? null
    : s.away?.day === today
      ? s.away.art
      : drawWorld('pet', s.pet.steps, s.pet.saved, timeOfDay(now), mood);
  const theme = themeName();
  return {
    ready: !!state && !!s.day,
    steps,
    goal,
    progress,
    over,
    stepsText: formatSteps(steps),
    shortSteps: shortCount(steps),
    goalText: over && steps > goal ? `+${formatSteps(steps - goal)} over goal` : `${Math.round(progress * 100)}% of ${formatSteps(goal)}`,
    streak: before + (over ? 1 : 0),
    pet: art
      ? { name, mood, feeling: FEELING[mood], line: moodLine(mood, name, steps, goal), says: [...(art.pet?.sounds ?? []), ...MOOD_SAYS[mood]], art }
      : null,
    ring: readRingSettings(),
    light: colorsFor(theme, false),
    dark: colorsFor(theme, true),
  };
}

/** The next local midnight after `now`, when the widgets start a new day. */
export function nextMidnight(now: Date = new Date()): Date {
  return addDays(startOfDay(now), 1);
}

/** When the pet's sky next changes today (dawn, day, dusk, night: see timeOfDay), or null. */
export function nextSkyChange(now: Date = new Date()): Date | null {
  for (const hour of [5, 8, 18, 21]) {
    const at = startOfDay(now);
    at.setHours(hour);
    if (at > now) return at;
  }
  return null;
}
