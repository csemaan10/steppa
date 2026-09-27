import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, HelperText, SegmentedButtons, Text, TextInput, useTheme } from 'react-native-paper';
import Animated, { useAnimatedKeyboard, useAnimatedStyle } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';
import { useAppLock } from '@/providers/app-lock-provider';
import { useAuth } from '@/providers/auth-provider';
import { screenBackground } from '@/theme';

type Mode = 'sign-in' | 'sign-up';

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export default function SignInScreen() {
  const theme = useTheme();
  const { session } = useAuth();
  const { locked, signInWithBiometrics, forget, clearLock } = useAppLock();
  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
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
          <View style={styles.hero}>
            <Text variant="displaySmall" style={{ color: theme.colors.primary }}>
              Steppa
            </Text>
            <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant }}>
              Walk more, together.
            </Text>
          </View>

          {showBiometric ? (
            <>
              <Text variant="bodyLarge" style={styles.center}>
                Welcome back{session?.user.email ? `, ${session.user.email}` : ''}
              </Text>
              <Button mode="contained" icon="fingerprint" onPress={biometricSignIn} loading={busy} disabled={busy}>
                Sign in with biometrics
              </Button>
              {message ? (
                <HelperText type="error" visible style={styles.center}>
                  {message.text}
                </HelperText>
              ) : null}
              <Button mode="outlined" icon="form-textbox-password" onPress={switchToPassword} disabled={busy}>
                Use password
              </Button>
              <Button onPress={forget} disabled={busy}>
                Use a different account
              </Button>
            </>
          ) : (
            <>
              {locked ? null : (
                <SegmentedButtons
                  value={mode}
                  onValueChange={(v) => setMode(v as Mode)}
                  buttons={[
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
              <TextInput
                mode="outlined"
                label="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
              />

              {mode === 'sign-up' ? (
                <>
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
                </>
              ) : null}

              {message ? (
                <HelperText type={message.error ? 'error' : 'info'} visible>
                  {message.text}
                </HelperText>
              ) : null}

              <Button mode="contained" onPress={submit} loading={busy} disabled={busy}>
                {mode === 'sign-in' ? 'Sign in' : 'Create account'}
              </Button>
              {locked ? (
                <Button mode="outlined" icon="fingerprint" onPress={switchToBiometric} disabled={busy}>
                  Use biometrics instead
                </Button>
              ) : null}
            </>
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
});
