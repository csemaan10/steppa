import { useSyncExternalStore } from 'react';

import type { CharacterLook } from '@/lib/character';

// The podium character as last edited on this phone, so the Settings card shows each change at once
// (even while the editor is still closing) instead of waiting for the profile to reload.
const looks = new Map<string, CharacterLook>();
const listeners = new Set<() => void>();

export function rememberLook(userId: string, look: CharacterLook) {
  looks.set(userId, look);
  listeners.forEach((l) => l());
}

export function peekLook(userId: string): CharacterLook | undefined {
  return looks.get(userId);
}

/** The latest look for `userId` edited on this phone, or undefined if there's none yet. */
export function useRememberedLook(userId: string): CharacterLook | undefined {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    () => looks.get(userId)
  );
}
