import 'expo-sqlite/localStorage/install';
import { createClient, type Session } from '@supabase/supabase-js';
import { AppState } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env.local.'
  );
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    storage: localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Matches supabase-js's default storage key.
const storageKey = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`;

/** Synchronously reads the persisted session so the first render can pick the right route. */
export function readStoredSession(): Session | null {
  try {
    const raw = localStorage.getItem(storageKey);
    const session = raw ? (JSON.parse(raw) as Session) : null;
    return session?.access_token && session.user?.id ? session : null;
  } catch {
    return null;
  }
}

AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
