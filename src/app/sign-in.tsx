import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Button, HelperText, SegmentedButtons, Text, TextInput, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';
import { screenBackground } from '@/theme';

type Mode = 'sign-in' | 'sign-up';

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export default function SignInScreen() {
  const theme = useTheme();
  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const usernameInvalid = mode === 'sign-up' && username.length > 0 && !USERNAME_RE.test(username);

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
    try {
      if (mode === 'sign-in') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
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
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <Text variant="displaySmall" style={{ color: theme.colors.primary }}>
              Steppa
            </Text>
            <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant }}>
              Walk more, together.
            </Text>
          </View>

          <SegmentedButtons
            value={mode}
            onValueChange={(v) => setMode(v as Mode)}
            buttons={[
              { value: 'sign-in', label: 'Sign in' },
              { value: 'sign-up', label: 'Create account' },
            ]}
          />

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
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: 24, gap: 16, flexGrow: 1, justifyContent: 'center' },
  hero: { alignItems: 'center', marginBottom: 16, gap: 4 },
});
