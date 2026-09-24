import { DarkTheme as NavDark, DefaultTheme as NavLight, type Theme } from 'expo-router';
import type { ViewStyle } from 'react-native';
import { MD3DarkTheme, MD3LightTheme, type MD3Theme } from 'react-native-paper';

// Material 3 color scheme generated from seed #006C4C.
export const lightTheme: MD3Theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#006C4C',
    onPrimary: '#FFFFFF',
    primaryContainer: '#89F8C7',
    onPrimaryContainer: '#002114',
    secondary: '#4D6357',
    onSecondary: '#FFFFFF',
    secondaryContainer: '#CFE9D9',
    onSecondaryContainer: '#092016',
    tertiary: '#3D6373',
    onTertiary: '#FFFFFF',
    tertiaryContainer: '#C1E8FB',
    onTertiaryContainer: '#001F29',
    error: '#BA1A1A',
    onError: '#FFFFFF',
    errorContainer: '#FFDAD6',
    onErrorContainer: '#410002',
    background: '#FBFDF9',
    onBackground: '#191C1A',
    surface: '#FBFDF9',
    onSurface: '#191C1A',
    surfaceVariant: '#DBE5DD',
    onSurfaceVariant: '#404943',
    outline: '#707973',
    outlineVariant: '#BFC9C2',
    inverseSurface: '#2E312F',
    inverseOnSurface: '#EFF1ED',
    inversePrimary: '#6CDBAC',
    surfaceDisabled: 'rgba(25, 28, 26, 0.12)',
    onSurfaceDisabled: 'rgba(25, 28, 26, 0.38)',
    backdrop: 'rgba(42, 50, 45, 0.4)',
    elevation: {
      level0: 'transparent',
      level1: '#EEF6F0',
      level2: '#E6F2EB',
      level3: '#DFEDE5',
      level4: '#DDEBE3',
      level5: '#D8E9DF',
    },
  },
};

export const darkTheme: MD3Theme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#6CDBAC',
    onPrimary: '#003826',
    primaryContainer: '#005138',
    onPrimaryContainer: '#89F8C7',
    secondary: '#B3CCBE',
    onSecondary: '#1F352A',
    secondaryContainer: '#354B40',
    onSecondaryContainer: '#CFE9D9',
    tertiary: '#A5CCDF',
    onTertiary: '#073543',
    tertiaryContainer: '#244C5B',
    onTertiaryContainer: '#C1E8FB',
    error: '#FFB4AB',
    onError: '#690005',
    errorContainer: '#93000A',
    onErrorContainer: '#FFDAD6',
    background: '#191C1A',
    onBackground: '#E1E3DF',
    surface: '#191C1A',
    onSurface: '#E1E3DF',
    surfaceVariant: '#404943',
    onSurfaceVariant: '#BFC9C2',
    outline: '#8A938C',
    outlineVariant: '#404943',
    inverseSurface: '#E1E3DF',
    inverseOnSurface: '#2E312F',
    inversePrimary: '#006C4C',
    surfaceDisabled: 'rgba(225, 227, 223, 0.12)',
    onSurfaceDisabled: 'rgba(225, 227, 223, 0.38)',
    backdrop: 'rgba(42, 50, 45, 0.4)',
    elevation: {
      level0: 'transparent',
      level1: '#1C2521',
      level2: '#1F2B26',
      level3: '#22312B',
      level4: '#23332C',
      level5: '#25362F',
    },
  },
};

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
  const tint = `${theme.colors.primaryContainer}${theme.dark ? '33' : '40'}`;
  return {
    backgroundColor: theme.colors.background,
    experimental_backgroundImage: `linear-gradient(180deg, ${tint} 0%, ${theme.colors.background} 45%)`,
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
