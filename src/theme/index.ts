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

export const avatarColors = ['#006C4C', '#3D6373', '#8B5000', '#7D5260', '#4355B9', '#984061'];

/** Screen background: a soft primary-container tint at the top fading into the surface. */
export function screenBackground(theme: MD3Theme): ViewStyle {
  const tint = `${theme.colors.primaryContainer}${theme.dark ? '66' : '99'}`;
  return {
    backgroundColor: theme.colors.background,
    experimental_backgroundImage: `linear-gradient(180deg, ${tint} 0%, ${theme.colors.background} 70%)`,
  };
}

export const transparentHeader: ViewStyle = { backgroundColor: 'transparent' };

/** Chart card: secondary-container tint glowing in from the top-left. */
export function tintedCard(theme: MD3Theme): ViewStyle {
  return {
    backgroundColor: theme.colors.elevation.level1,
    experimental_backgroundImage: `linear-gradient(160deg, ${theme.colors.secondaryContainer} 0%, ${theme.colors.elevation.level1} 75%)`,
  };
}
