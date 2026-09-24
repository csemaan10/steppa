import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Loads data whenever the screen gains focus or `key` changes; exposes `reload` for pull-to-refresh.
 * `key` should encode every input `load` depends on (e.g. `${id}:${period}`).
 */
export function useLoader<T>(load: () => Promise<T>, key: string) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const loadRef = useRef(load);
  const activeKey = useRef(key);

  useEffect(() => {
    loadRef.current = load;
  });

  const reload = useCallback(async () => {
    activeKey.current = key;
    setLoading(true);
    try {
      const result = await loadRef.current();
      // Drop responses for a key that has since changed (e.g. switching periods quickly).
      if (activeKey.current !== key) return;
      setData(result);
      setError(null);
    } catch (e) {
      if (activeKey.current === key) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (activeKey.current === key) setLoading(false);
    }
  }, [key]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  return { data, error, loading, reload };
}
