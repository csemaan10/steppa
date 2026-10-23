import { createContext, use, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';

import { RecapModal } from '@/components/morning-recap';
import { getDayLeaderboard, getMyGroups, type GroupWithCount, type LeaderboardRow } from '@/lib/api';
import { addDays, toDayKey } from '@/lib/dates';
import { useUserId } from '@/providers/auth-provider';

// Local day the ceremony last opened by itself on this device, so it pops up once per day.
const SEEN_KEY = 'steppa:recap-day';

export type Recap = {
  group: GroupWithCount;
  /** Top three with steps, best first. */
  podium: LeaderboardRow[];
  /** Everyone in the group, ranked. */
  rows: LeaderboardRow[];
};

type RecapContextValue = {
  /** Groups with a podium yesterday. */
  recaps: Recap[];
  /** `YYYY-MM-DD` the recaps are for. */
  day: string | null;
  /** Plays the ceremony for one group, or every group when no id is given. */
  play: (groupId?: string) => void;
};

const RecapContext = createContext<RecapContextValue>({ recaps: [], day: null, play: () => {} });

function readSeen(): string | null {
  try {
    return localStorage.getItem(SEEN_KEY);
  } catch {
    return null;
  }
}

function writeSeen(day: string) {
  try {
    localStorage.setItem(SEEN_KEY, day);
  } catch {
    // Storage unavailable: worst case the ceremony opens again.
  }
}

async function loadRecaps(day: string): Promise<Recap[]> {
  const groups = await getMyGroups();
  const recaps = await Promise.all(
    groups.map(async (group) => {
      const rows = await getDayLeaderboard(group.id, day);
      // Same podium rule as the chat card: people with steps, top three.
      const podium = rows.filter((r) => r.total_steps > 0 && r.rank <= 3).slice(0, 3);
      return { group, podium, rows };
    })
  );
  return recaps.filter((r) => r.podium.length > 0);
}

/**
 * Loads yesterday's results for every group and opens the medal ceremony on the first open
 * (or resume) of a new day. Re-loads on each resume so late syncs show up in the home card.
 */
export function RecapProvider({ children }: PropsWithChildren) {
  const userId = useUserId();
  const [recaps, setRecaps] = useState<Recap[]>([]);
  const [day, setDay] = useState<string | null>(null);
  // Snapshot of what's playing, so a background reload can't shift it mid-ceremony.
  const [playing, setPlaying] = useState<Recap[]>([]);
  const loading = useRef(false);

  useEffect(() => {
    let active = true;

    async function refresh() {
      if (loading.current) return;
      loading.current = true;
      const now = new Date();
      const today = toDayKey(now);
      const yesterday = toDayKey(addDays(now, -1));
      try {
        const next = await loadRecaps(yesterday);
        if (!active) return;
        setRecaps(next);
        setDay(yesterday);
        if (readSeen() !== today) {
          // Marked even when there's nothing to show, so it doesn't pop up later in the day.
          writeSeen(today);
          if (next.length) setPlaying(next);
        }
      } catch {
        // Offline or failed: try again on the next resume.
      } finally {
        loading.current = false;
      }
    }

    refresh();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      active = false;
      sub.remove();
    };
  }, [userId]);

  function play(groupId?: string) {
    const list = groupId ? recaps.filter((r) => r.group.id === groupId) : recaps;
    if (list.length) setPlaying(list);
  }

  return (
    <RecapContext value={{ recaps, day, play }}>
      {children}
      <RecapModal recaps={playing} day={day} userId={userId} onClose={() => setPlaying([])} />
    </RecapContext>
  );
}

export function useRecap(): RecapContextValue {
  return use(RecapContext);
}
