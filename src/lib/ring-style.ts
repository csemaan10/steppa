// How the step progress ring is drawn (style, colour, thickness, the Cat paws ring's cat), chosen in
// Settings and saved on the device.

import 'expo-sqlite/localStorage/install';
import { useSyncExternalStore } from 'react';

import { CATS } from '@/lib/character';

export const RING_STYLES = [
  'classic',
  'thin',
  'segments',
  'gradient',
  'glow',
  'dots',
  'rainbow',
  'stars',
  'hearts',
  'racecar',
  'lantern',
  'cat',
  'dog',
  'horse',
] as const;
export type RingStyle = (typeof RING_STYLES)[number];

export const RING_STYLE_LABELS: Record<RingStyle, string> = {
  classic: 'Classic',
  thin: 'Thin',
  segments: 'Segments',
  gradient: 'Gradient',
  glow: 'Neon glow',
  dots: 'Dots',
  rainbow: 'Rainbow',
  stars: 'Stars',
  hearts: 'Hearts',
  racecar: 'Race car',
  lantern: 'Lantern',
  cat: 'Cat paws',
  dog: 'Dog paws',
  horse: 'Hoofprints',
};

export const RING_THICKNESS = ['slim', 'regular', 'bold'] as const;
export type RingThickness = (typeof RING_THICKNESS)[number];
/** Stroke multiplier for each thickness. */
export const THICKNESS_SCALE: Record<RingThickness, number> = { slim: 0.65, regular: 1, bold: 1.4 };

/** Ring colours on offer besides the theme's own. */
export const RING_COLORS = ['#E53935', '#FB8C00', '#FDD835', '#43A047', '#00ACC1', '#1E88E5', '#8E24AA', '#EC407A'] as const;

/** The cat on the Cat paws ring: one of the pet cats' coats. */
export type RingCat = (typeof CATS)[number];

export type RingSettings = {
  style: RingStyle;
  /** Null uses the theme colour. */
  color: string | null;
  thickness: RingThickness;
  /** The Cat paws ring's cat. */
  cat: RingCat;
};

const KEYS = {
  style: 'steppa:ring-style',
  color: 'steppa:ring-color',
  thickness: 'steppa:ring-thickness',
  cat: 'steppa:ring-cat',
};
const listeners = new Set<() => void>();

function get(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function read(): RingSettings {
  const style = get(KEYS.style);
  const color = get(KEYS.color);
  const thickness = get(KEYS.thickness);
  const cat = get(KEYS.cat);
  return {
    style: RING_STYLES.includes(style as RingStyle) ? (style as RingStyle) : 'classic',
    color: color && /^#[0-9A-Fa-f]{6}$/.test(color) ? color : null,
    thickness: RING_THICKNESS.includes(thickness as RingThickness) ? (thickness as RingThickness) : 'regular',
    cat: CATS.includes(cat as RingCat) ? (cat as RingCat) : 'gingercat',
  };
}

let current: RingSettings = read();

/** Changes some of the ring settings and saves them. */
export function setRingSettings(patch: Partial<RingSettings>) {
  current = { ...current, ...patch };
  try {
    localStorage.setItem(KEYS.style, current.style);
    localStorage.setItem(KEYS.thickness, current.thickness);
    localStorage.setItem(KEYS.cat, current.cat);
    if (current.color) localStorage.setItem(KEYS.color, current.color);
    else localStorage.removeItem(KEYS.color);
  } catch {}
  listeners.forEach((l) => l());
}

/** The chosen ring settings; every ring on screen updates when they change. */
export function useRingSettings(): RingSettings {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    () => current
  );
}
