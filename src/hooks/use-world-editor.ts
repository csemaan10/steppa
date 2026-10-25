import { useRef, useState } from 'react';
import { Alert } from 'react-native';

import { updateWorld, type World } from '@/lib/api';

/**
 * Changes to your world that show at once and save in the background, one after another so they
 * land in the order they were made. The next load (`loaded`) replaces them with the saved copy.
 */
export function useWorldEditor(userId: string, loaded: World | null) {
  const [edit, setEdit] = useState<{ base: World | null; world: World } | null>(null);
  const world = edit && edit.base === loaded ? edit.world : loaded;
  const queue = useRef<Promise<void>>(Promise.resolve());

  function save(next: World, patch: Parameters<typeof updateWorld>[1]) {
    setEdit({ base: loaded, world: next });
    queue.current = queue.current
      .then(() => updateWorld(userId, patch))
      .catch((e: unknown) => Alert.alert("Couldn't save that", e instanceof Error ? e.message : String(e)));
  }

  function setKindPicks(current: World, changes: Record<string, string>) {
    const picks = { ...current.picks, [current.kind]: { ...current.picks[current.kind], ...changes } };
    save({ ...current, picks }, { picks });
  }

  return {
    world,
    /** Chooses an option for one of the current kind's slots. */
    pick: (slot: string, choice: string) => world && setKindPicks(world, { [slot]: choice }),
    rename: (name: string) => world && setKindPicks(world, { name: name.trim() }),
    /** Marks every milestone up to `level` as celebrated. */
    celebrate: (level: number) => world && save({ ...world, celebrated: level + 1 }, { celebrated: level + 1 }),
  };
}
