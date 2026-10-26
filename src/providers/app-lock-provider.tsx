import 'expo-sqlite/localStorage/install';
import * as LocalAuthentication from 'expo-local-authentication';
import { createContext, use, useState, type PropsWithChildren } from 'react';

import { forgetPushToken } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

const ENABLED_KEY = 'steppa:biometric-sign-in';
const SIGNED_OUT_KEY = 'steppa:biometric-signed-out';

type AppLock = {
  /** Biometric sign-in is turned on for this device. */
  enabled: boolean;
  /** Returns an error message, or null on success or cancel. */
  setEnabled: (on: boolean) => Promise<string | null>;
  /** Signed out, but the session is kept so biometrics can bring it back. */
  locked: boolean;
  signOut: () => Promise<void>;
  /** Returns true if the user was signed back in. */
  signInWithBiometrics: () => Promise<boolean>;
  /** Drops the kept session so the next sign-in needs a password. */
  forget: () => Promise<void>;
  /** Call after a password sign-in, which replaces any kept session. */
  clearLock: () => void;
};

const AppLockContext = createContext<AppLock | null>(null);

export function AppLockProvider({ children }: PropsWithChildren) {
  const { session } = useAuth();
  const [enabled, setEnabledState] = useState(() => localStorage.getItem(ENABLED_KEY) === '1');
  const [signedOut, setSignedOut] = useState(() => localStorage.getItem(SIGNED_OUT_KEY) === '1');
  const locked = enabled && signedOut && !!session;

  function setLock(on: boolean) {
    localStorage.setItem(SIGNED_OUT_KEY, on ? '1' : '0');
    setSignedOut(on);
  }

  async function setEnabled(on: boolean): Promise<string | null> {
    if (on) {
      const ready =
        (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
      if (!ready) return 'Set up a fingerprint or face unlock on this phone first.';
      const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Turn on biometric sign-in' });
      if (!result.success) return null;
    }
    localStorage.setItem(ENABLED_KEY, on ? '1' : '0');
    setEnabledState(on);
    return null;
  }

  // A locked phone keeps its pushes (it's still that person's); signing out for real stops them.
  async function signOut() {
    if (enabled) setLock(true);
    else {
      await forgetPushToken();
      await supabase.auth.signOut();
    }
  }

  async function signInWithBiometrics() {
    const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Sign in to Steppa' });
    if (result.success) setLock(false);
    return result.success;
  }

  async function forget() {
    setLock(false);
    await forgetPushToken();
    await supabase.auth.signOut();
  }

  return (
    <AppLockContext
      value={{ enabled, setEnabled, locked, signOut, signInWithBiometrics, forget, clearLock: () => setLock(false) }}>
      {children}
    </AppLockContext>
  );
}

export function useAppLock(): AppLock {
  const value = use(AppLockContext);
  if (!value) throw new Error('useAppLock must be used inside AppLockProvider');
  return value;
}
