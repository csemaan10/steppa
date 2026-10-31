import { DarkTheme as NavDark, DefaultTheme as NavLight, type Theme } from 'expo-router';
import { Platform, StyleSheet, type ViewStyle } from 'react-native';
import { configureFonts, MD3DarkTheme, MD3LightTheme, useTheme, type MD3Theme } from 'react-native-paper';

import { PALETTES, type ThemeName } from '@/theme/palettes';

export { PALETTES, THEME_NAMES, type ThemeName } from '@/theme/palettes';

/** Paper MD3 theme plus a bright `accent` used for "over goal" highlights. */
export type AppTheme = MD3Theme & {
  colors: MD3Theme['colors'] & { accent: string; accentText: string };
  /** Soft glows behind the frosted glass cards, from the top-left corner down. */
  blobs: [string, string, string];
};

// Some Android OEM system fonts (OnePlus, Oppo, Xiaomi...) measure bold text with the regular face,
// then clip its last letters when drawing. Naming the family outright makes the two agree.
const fonts = Platform.OS === 'android' ? configureFonts({ config: { fontFamily: 'Roboto' } }) : MD3LightTheme.fonts;

export function buildTheme(name: ThemeName, dark: boolean): AppTheme {
  const palette = PALETTES[name];
  const base = dark ? MD3DarkTheme : MD3LightTheme;
  const scheme = { ...base.colors, ...(dark ? palette.dark : palette.light) };
  return {
    ...base,
    fonts,
    colors: {
      ...scheme,
      accent: dark ? palette.accent.dark : palette.accent.light,
      accentText: dark ? palette.accent.dark : palette.accent.text,
    },
    // One colour, in the palette's own primary tones (80 and 90 in light, 30 and 40 in dark).
    blobs: dark
      ? [scheme.primaryContainer, scheme.inversePrimary, scheme.primaryContainer]
      : [scheme.inversePrimary, scheme.primaryContainer, scheme.inversePrimary],
  };
}

export const useAppTheme = () => useTheme<AppTheme>();

export function toNavigationTheme(theme: MD3Theme): Theme {
  const base = theme.dark ? NavDark : NavLight;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: theme.colors.primary,
      background: theme.colors.background,
      card: theme.colors.surface,
      text: theme.colors.onSurface,
      border: theme.colors.outlineVariant,
      notification: theme.colors.error,
    },
  };
}

export const avatarColors = [
  '#006C4C',
  '#3D6373',
  '#8B5000',
  '#7D5260',
  '#4355B9',
  '#984061',
  '#0061A4',
  '#6750A4',
  '#BB1614',
  '#006A6A',
  '#4C6200',
  '#A04100',
  '#455A64',
  '#C2185B',
  '#283593',
  '#8E24AA',
  '#00838F',
  '#2E7D32',
  '#5D4037',
  '#D84315',
  '#212121',
  // Vibrant: bright and saturated, but dark enough that the white initials/icon stay readable.
  '#FF1744',
  '#F50057',
  '#FF2E93',
  '#D500F9',
  '#AA00FF',
  '#7C3AED',
  '#651FFF',
  '#3D5AFE',
  '#2962FF',
  '#0091EA',
  '#00A3A3',
  '#00A86B',
  '#2DB300',
  '#FF6D00',
  '#FF3D00',
  '#E8A200',
];

/** Applies an alpha (0–1) to a `#RRGGBB` or `rgb(a)(...)` colour. Paper's baseline purple uses rgba. */
export function withAlpha(color: string, alpha: number): string {
  if (color.startsWith('#') && color.length === 7) {
    return `${color}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;
  }
  const rgb = color.match(/\d+(\.\d+)?/g);
  if (rgb && rgb.length >= 3) return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
  return color;
}

/**
 * Screen background: three soft glows of the theme colour for the glass cards to frost over. They're on the
 * screen, not the scroll content, so they stay put while cards slide across them like glass over light.
 * Each glow fades to its own colour at zero alpha; fading to `transparent` (black) would grey the edges.
 */
export function screenBackground(theme: AppTheme): ViewStyle {
  const strength = theme.dark ? 0.55 : 0.75;
  const [a, b, c] = theme.blobs;
  // `soften` scales a glow down: the lower ones are gentler, so the bottom half stays calm.
  const glow = (color: string, at: string, reach: number, soften = 1) =>
    `radial-gradient(circle at ${at}, ${withAlpha(color, strength * soften)} 0%, ${withAlpha(color, 0)} ${reach}%)`;
  return {
    backgroundColor: theme.colors.background,
    experimental_backgroundImage: [glow(a, '8% 4%', 55), glow(b, '100% 38%', 45, 0.8), glow(c, '12% 92%', 50, 0.6)].join(
      ', '
    ),
  };
}

export const transparentHeader: ViewStyle = { backgroundColor: 'transparent' };

/**
 * The unfilled part of a progress ring. In light mode a dark wash rather than the pale surfaceVariant,
 * which is about as light as the glows and see-through glass behind it and disappears into them.
 */
export function ringTrack(theme: MD3Theme): string {
  return theme.dark ? theme.colors.surfaceVariant : withAlpha(theme.colors.onSurface, 0.12);
}

const CARD_RADIUS = 24;

/**
 * Frosted glass tokens, the same frost as the floating tab bar's blur: `fill` is the tint expo-blur
 * lays over its blur at the bar's intensity (60), a near-white veil in light mode and a smoky one in
 * dark, even all over, with the bar's hairline outlineVariant rim. The shadows are kept faint and
 * wide, just enough to hold a pane's edge where it sits over plain background rather than a glow;
 * small things like the top-bar buttons get only a tight one, so nothing smudges below them.
 */
const GLASS = {
  light: {
    fill: 'rgba(249, 249, 249, 0.47)',
    shadow: '0px 1px 3px rgba(0, 0, 0, 0.03), 0px 6px 18px rgba(0, 0, 0, 0.05)',
    smallShadow: '0px 1px 2px rgba(0, 0, 0, 0.05)',
  },
  dark: {
    fill: 'rgba(25, 25, 25, 0.41)',
    shadow: '0px 1px 3px rgba(0, 0, 0, 0.2), 0px 6px 18px rgba(0, 0, 0, 0.18)',
    smallShadow: '0px 1px 2px rgba(0, 0, 0, 0.2)',
  },
};

/** The glass colours themselves, for drawing glass in a shape of its own (see `GlassShape`). */
export function glassTokens(theme: MD3Theme) {
  return { ...(theme.dark ? GLASS.dark : GLASS.light), border: theme.colors.outlineVariant };
}

/**
 * Frosted glass without a shape. Behind a pane there's only the fixed glow background, which a blur
 * wouldn't change, so the tab bar's tint over it gives the same look without a blur pass per card.
 * - `card`: menu cards.
 * - `small`: buttons and other small panes: the same frost with only a tight shadow.
 * - `strong`: frosted nearly opaque, for a card floating over a dimmed screen with content behind.
 */
export function glass(theme: MD3Theme, kind: 'card' | 'small' | 'strong' = 'card'): ViewStyle {
  const g = glassTokens(theme);
  const small = kind === 'small';
  const fill =
    kind === 'strong'
      ? theme.dark
        ? withAlpha(theme.colors.background, 0.8)
        : 'rgba(255, 255, 255, 0.8)'
      : g.fill;
  return {
    // Paper's iOS Surface paints its background colour on two stacked layers, which would double a
    // translucent fill, so the fill is drawn as an image instead.
    backgroundColor: 'transparent',
    experimental_backgroundImage: `linear-gradient(${fill}, ${fill})`,
    borderColor: g.border,
    borderWidth: StyleSheet.hairlineWidth,
    // Unlike `shadow*` and Android elevation, a box shadow is only drawn outside the pane, so it
    // doesn't show through the fill as a dark smudge.
    boxShadow: small ? g.smallShadow : g.shadow,
  };
}

/** Frosted glass card, shared by every menu card so they read as one system. */
export function glassCard(theme: MD3Theme): ViewStyle {
  return { ...glass(theme), borderRadius: CARD_RADIUS };
}

/** Solid, raised card for leaderboards, so they stand up off the glass around them. */
export function liftedCard(theme: MD3Theme): ViewStyle {
  return {
    backgroundColor: theme.dark ? theme.colors.elevation.level3 : theme.colors.surface,
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.dark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
    boxShadow: theme.dark
      ? '0px 1px 3px rgba(0, 0, 0, 0.3), 0px 6px 16px rgba(0, 0, 0, 0.28)'
      : '0px 1px 3px rgba(0, 0, 0, 0.05), 0px 6px 16px rgba(0, 0, 0, 0.08)',
  };
}
