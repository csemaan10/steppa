import type { Session } from '@supabase/supabase-js';
import { createContext, use, useEffect, useState, type PropsWithChildren } from 'react';

import { readStoredSession, supabase } from '@/lib/supabase';

type AuthContextValue = {
  session: Session | null;
  userId: string | null;
};

const AuthContext = createContext<AuthContextValue>({
  session: null,
  userId: null,
});

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(readStoredSession);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  return (
    <AuthContext value={{ session, userId: session?.user.id ?? null }}>
      {children}
    </AuthContext>
  );
}

export function useAuth() {
  return use(AuthContext);
}

/** For screens behind the auth guard, where a user is always present. */
export function useUserId(): string {
  const { userId } = useAuth();
  if (!userId) throw new Error('useUserId called outside an authenticated route');
  return userId;
}
