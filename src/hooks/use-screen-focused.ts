import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

/** Whether this screen is the one showing (a hidden tab stays mounted), e.g. to pause animations. */
export function useScreenFocused(): boolean {
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, [])
  );
  return focused;
}
