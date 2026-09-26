import 'expo-sqlite/localStorage/install';
import { createContext, use, useState, type PropsWithChildren } from 'react';

import { THEME_NAMES, type ThemeName } from '@/theme';

const STORAGE_KEY = 'steppa:theme';

type ThemeChoice = { themeName: ThemeName; setThemeName: (name: ThemeName) => void };

const ThemeChoiceContext = createContext<ThemeChoice>({ themeName: 'green', setThemeName: () => {} });

function readSaved(): ThemeName {
  const saved = localStorage.getItem(STORAGE_KEY);
  return THEME_NAMES.includes(saved as ThemeName) ? (saved as ThemeName) : 'green';
}

/** The user's colour theme, saved on the device. */
export function ThemeChoiceProvider({ children }: PropsWithChildren) {
  const [themeName, setName] = useState<ThemeName>(readSaved);

  function setThemeName(name: ThemeName) {
    localStorage.setItem(STORAGE_KEY, name);
    setName(name);
  }

  return <ThemeChoiceContext value={{ themeName, setThemeName }}>{children}</ThemeChoiceContext>;
}

export function useThemeChoice() {
  return use(ThemeChoiceContext);
}
