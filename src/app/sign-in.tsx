import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { HelperText, Text, TextInput } from 'react-native-paper';
import Animated, { useAnimatedKeyboard, useAnimatedStyle, useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ButtonGroup } from '@/components/button-group';
import { Collapsible } from '@/components/collapsible';
import { supabase } from '@/lib/supabase';
import { useAppLock } from '@/providers/app-lock-provider';
import { useAuth } from '@/providers/auth-provider';
import { screenBackground, useAppTheme } from '@/theme';
import { enter, leave } from '@/theme/motion';

type Mode = 'sign-in' | 'sign-up';

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

/**
 * Signing in or up. The name and the form rise in on open; switching between signing in and creating
 * an account folds the extra fields open or shut (pushing the rest along rather than popping in), and
 * the biometric and password panels crossfade. Folds rather than layout transitions, because the
 * keyboard moves everything every frame and a layout transition would trail behind it.
 */
export default function SignInScreen() {
  const theme = useAppTheme();
  const reduceMotion = useReducedMotion();
  const { session } = useAuth();
  const { locked, signInWithBiometrics, forget, clearLock } = useAppLock();
  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  // The last message, kept while its line folds away.
  const [shownMessage, setShownMessage] = useState(message);
  if (message && message !== shownMessage) setShownMessage(message);
  const [usePassword, setUsePassword] = useState(false);
  const showBiometric = locked && !usePassword;

  const usernameInvalid = mode === 'sign-up' && username.length > 0 && !USERNAME_RE.test(username);
  const keyboard = useAnimatedKeyboard();
  const keyboardPadding = useAnimatedStyle(() => ({ paddingBottom: keyboard.height.value }));

  async function biometricSignIn() {
    setMessage(null);
    setBusy(true);
    try {
      if (!(await signInWithBiometrics())) setMessage({ text: 'Not recognised. Try again.', error: true });
    } finally {
      setBusy(false);
    }
  }

  function switchToPassword() {
    setMessage(null);
    setMode('sign-in');
    setEmail(session?.user.email ?? '');
    setUsePassword(true);
  }

  function switchToBiometric() {
    setMessage(null);
    setUsePassword(false);
  }

  async function submit() {
    setMessage(null);
    if (!email.trim() || password.length < 6) {
      setMessage({ text: 'Enter an email and a password of at least 6 characters.', error: true });
      return;
    }
    if (mode === 'sign-up' && (!USERNAME_RE.test(username) || !displayName.trim())) {
      setMessage({ text: 'Choose a valid username and display name.', error: true });
      return;
    }

    setBusy(true);
    // With a kept session, clearing first would sign in before the password is checked.
    if (!locked) clearLock();
    try {
      if (mode === 'sign-in') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        clearLock();
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { username, display_name: displayName.trim() } },
        });
        if (error) throw error;
        if (!data.session) {
          setMessage({ text: 'Check your inbox to confirm your email, then sign in.', error: false });
          setMode('sign-in');
        }
      }
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : 'Something went wrong', error: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={[styles.flex, screenBackground(theme)]}>
      <Animated.View style={[styles.flex, keyboardPadding]}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Animated.View entering={enter(0, reduceMotion)} style={styles.hero}>
            <Text variant="displaySmall" style={{ color: theme.colors.primary }}>
              Steppa
            </Text>
            <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant }}>
              Walk more, together.
            </Text>
          </Animated.View>

          {showBiometric ? (
            <Animated.View key="biometric" entering={enter(1, reduceMotion)} exiting={leave(reduceMotion)} style={styles.panel}>
              <Text variant="bodyLarge" style={styles.center}>
                Welcome back{session?.user.email ? `, ${session.user.email}` : ''}
              </Text>
              <View>
                <Button mode="contained" icon="fingerprint" onPress={biometricSignIn} loading={busy} disabled={busy}>
                  Sign in with biometrics
                </Button>
                <Collapsible expanded={!!message} style={styles.foldBelow}>
                  <HelperText type="error" visible style={styles.center}>
                    {shownMessage?.text}
                  </HelperText>
                </Collapsible>
              </View>
              <Button mode="outlined" icon="form-textbox-password" onPress={switchToPassword} disabled={busy}>
                Use password
              </Button>
              <Button onPress={forget} disabled={busy}>
                Use a different account
              </Button>
            </Animated.View>
          ) : (
            <Animated.View key="password" entering={enter(1, reduceMotion)} exiting={leave(reduceMotion)} style={styles.panel}>
              {locked ? null : (
                <ButtonGroup<Mode>
                  value={mode}
                  onChange={setMode}
                  options={[
                    { value: 'sign-in', label: 'Sign in' },
                    { value: 'sign-up', label: 'Create account' },
                  ]}
                />
              )}

              <TextInput
                mode="outlined"
                label="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
              />
              {/* Each fold sits in a group with the field above it and keeps its gap on the inside,
                  so the gap opens and shuts with it. */}
              <View>
                <TextInput
                  mode="outlined"
                  label="Password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
                />

                <Collapsible expanded={mode === 'sign-up'} style={styles.foldGroup}>
                  <View>
                    <TextInput
                      mode="outlined"
                      label="Username"
                      value={username}
                      onChangeText={(t) => setUsername(t.toLowerCase())}
                      autoCapitalize="none"
                      error={usernameInvalid}
                    />
                    <HelperText type="error" visible={usernameInvalid}>
                      3–20 characters: lowercase letters, numbers, underscores.
                    </HelperText>
                  </View>
                  <TextInput
                    mode="outlined"
                    label="Display name"
                    value={displayName}
                    onChangeText={setDisplayName}
                    maxLength={40}
                  />
                </Collapsible>

                <Collapsible expanded={!!message} style={styles.foldBelow}>
                  <HelperText type={shownMessage?.error ? 'error' : 'info'} visible>
                    {shownMessage?.text}
                  </HelperText>
                </Collapsible>
              </View>

              <View>
                <Button mode="contained" onPress={submit} loading={busy} disabled={busy}>
                  {mode === 'sign-in' ? 'Sign in' : 'Create account'}
                </Button>
                <Collapsible expanded={mode === 'sign-up'} style={styles.foldBelow}>
                  {/* App Store guideline 1.2: users agree to content rules before they can post in chat. */}
                  <Text variant="bodySmall" style={[styles.center, { color: theme.colors.onSurfaceVariant }]}>
                    By creating an account you agree not to post abusive, hateful, or explicit content. Such
                    content is removed and accounts that post it may be banned.
                  </Text>
                </Collapsible>
              </View>
              {locked ? (
                <Button mode="outlined" icon="fingerprint" onPress={switchToBiometric} disabled={busy}>
                  Use biometrics instead
                </Button>
              ) : null}
            </Animated.View>
          )}
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  container: { padding: 24, gap: 16, flexGrow: 1, justifyContent: 'center' },
  hero: { alignItems: 'center', marginBottom: 16, gap: 4 },
  panel: { gap: 16 },
  // A fold's gap to what's above it, inside the fold so it opens and shuts with it.
  foldBelow: { paddingTop: 16 },
  foldGroup: { paddingTop: 16, gap: 16 },
});
