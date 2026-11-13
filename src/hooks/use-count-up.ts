import { useEffect, useRef, useState } from 'react';

/**
 * Animates a number up to `target` with an ease-out curve: from 0 at first, then from wherever it
 * shows when `target` changes, so a live count rolls on from the old total.
 */
export function useCountUp(target: number, duration = 900, delay = 0): number {
  const [value, setValue] = useState(0);
  const shown = useRef(0);

  useEffect(() => {
    const from = shown.current;
    let frame = 0;
    let start: number | null = null;
    const tick = (now: number) => {
      start ??= now + delay;
      const t = duration > 0 ? Math.min(1, Math.max(0, (now - start) / duration)) : 1;
      const next = Math.round(from + (target - from) * (1 - Math.pow(1 - t, 3)));
      shown.current = next;
      setValue(next);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration, delay]);

  return value;
}
