import 'expo-sqlite/localStorage/install';
import { createContext, use, useState, type PropsWithChildren } from 'react';
import { Appearance } from 'react-native';

import { THEME_NAMES, type ThemeName } from '@/theme';

const STORAGE_KEY = 'steppa:theme';
const MODE_KEY = 'steppa:appearance';

export type AppearanceMode = 'system' | 'light' | 'dark';
export const APPEARANCE_MODES: AppearanceMode[] = ['system', 'light', 'dark'];

type ThemeChoice = {
  themeName: ThemeName;
  setThemeName: (name: ThemeName) => void;
  mode: AppearanceMode;
  setMode: (mode: AppearanceMode) => void;
};

const ThemeChoiceContext = createContext<ThemeChoice>({
  themeName: 'green',
  setThemeName: () => {},
  mode: 'system',
  setMode: () => {},
});

function readSaved(): ThemeName {
  const saved = localStorage.getItem(STORAGE_KEY);
  return THEME_NAMES.includes(saved as ThemeName) ? (saved as ThemeName) : 'green';
}

function readSavedMode(): AppearanceMode {
  const saved = localStorage.getItem(MODE_KEY);
  return APPEARANCE_MODES.includes(saved as AppearanceMode) ? (saved as AppearanceMode) : 'system';
}

// Overriding at the native level too, so alerts, the keyboard and system sheets match the app.
// useColorScheme() then reports the override, or the phone's setting for 'system'.
function applyMode(mode: AppearanceMode) {
  Appearance.setColorScheme(mode === 'system' ? 'unspecified' : mode);
}

// Before the first render, so the app never flashes the phone's scheme.
applyMode(readSavedMode());

/** The user's colour theme and light/dark choice, saved on the device. */
export function ThemeChoiceProvider({ children }: PropsWithChildren) {
  const [themeName, setName] = useState<ThemeName>(readSaved);
  const [mode, setModeState] = useState<AppearanceMode>(readSavedMode);

  function setThemeName(name: ThemeName) {
    localStorage.setItem(STORAGE_KEY, name);
    setName(name);
  }

  function setMode(next: AppearanceMode) {
    localStorage.setItem(MODE_KEY, next);
    applyMode(next);
    setModeState(next);
  }

  return (
    <ThemeChoiceContext value={{ themeName, setThemeName, mode, setMode }}>{children}</ThemeChoiceContext>
  );
}

export function useThemeChoice() {
  return use(ThemeChoiceContext);
}
