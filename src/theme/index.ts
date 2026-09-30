import { DarkTheme as NavDark, DefaultTheme as NavLight, type Theme } from 'expo-router';
import type { ViewStyle } from 'react-native';
import { MD3DarkTheme, MD3LightTheme, useTheme, type MD3Theme } from 'react-native-paper';

import { PALETTES, type ThemeName } from '@/theme/palettes';

export { PALETTES, THEME_NAMES, type ThemeName } from '@/theme/palettes';

/** Paper MD3 theme plus a bright `accent` used for "over goal" highlights. */
export type AppTheme = MD3Theme & {
  colors: MD3Theme['colors'] & { accent: string; accentText: string };
};

export function buildTheme(name: ThemeName, dark: boolean): AppTheme {
  const palette = PALETTES[name];
  const base = dark ? MD3DarkTheme : MD3LightTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      ...(dark ? palette.dark : palette.light),
      accent: dark ? palette.accent.dark : palette.accent.light,
      accentText: dark ? palette.accent.dark : palette.accent.text,
    },
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

/** Screen background: a soft primary-container tint at the top fading into the surface. */
export function screenBackground(theme: MD3Theme): ViewStyle {
  const tint = withAlpha(theme.colors.primaryContainer, theme.dark ? 0.4 : 0.6);
  return {
    backgroundColor: theme.colors.background,
    experimental_backgroundImage: `linear-gradient(180deg, ${tint} 0%, ${theme.colors.background} 70%)`,
  };
}

export const transparentHeader: ViewStyle = { backgroundColor: 'transparent' };

/** Material 3 filled card surface, shared by every card so they read as one system. */
export function surfaceCard(theme: MD3Theme): ViewStyle {
  return { backgroundColor: theme.colors.elevation.level1 };
}
