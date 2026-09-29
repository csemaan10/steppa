import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Appbar, Card, HelperText, Text, TextInput, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppLockCard } from '@/components/app-lock-card';
import { BlockedUsersCard } from '@/components/blocked-users-card';
import { FlairEditorCard } from '@/components/flair-editor-card';
import { ThemePicker } from '@/components/theme-picker';
import { AVATAR_ICONS, UserAvatar } from '@/components/user-avatar';
import { useLoader } from '@/hooks/use-loader';
import { getProfile, updateProfile, type Profile } from '@/lib/api';
import { useUserId } from '@/providers/auth-provider';
import { avatarColors, screenBackground, surfaceCard, transparentHeader } from '@/theme';

export default function SettingsScreen() {
  const theme = useTheme();
  const userId = useUserId();
  const { data: profile, error } = useLoader(() => getProfile(userId), userId);

  if (!profile) {
    return (
      <View style={[styles.flex, screenBackground(theme)]}>
        <Appbar.Header style={transparentHeader}>
          <Appbar.BackAction onPress={() => router.back()} />
          <Appbar.Content title="Settings" />
        </Appbar.Header>
        <View style={styles.center}>
          {error ? <Text style={{ color: theme.colors.error }}>{error}</Text> : <ActivityIndicator />}
        </View>
      </View>
    );
  }

  // Keyed so the form seeds from the profile once; focus reloads don't wipe edits.
  return <SettingsForm key={profile.id} profile={profile} userId={userId} />;
}

function SettingsForm({ profile, userId }: { profile: Profile; userId: string }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [goal, setGoal] = useState(String(profile.daily_goal));
  const [color, setColor] = useState(profile.avatar_color);
  const [icon, setIcon] = useState(profile.avatar_icon);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const dirty =
    displayName.trim() !== profile.display_name ||
    goal !== String(profile.daily_goal) ||
    color !== profile.avatar_color ||
    icon !== profile.avatar_icon;

  async function save() {
    const goalNum = Number(goal);
    if (!displayName.trim() || !Number.isInteger(goalNum) || goalNum < 1000 || goalNum > 100000) {
      setSaveError('Enter a name and a goal between 1,000 and 100,000.');
      return;
    }
    setSaving(true);
    try {
      await updateProfile(userId, {
        display_name: displayName.trim(),
        daily_goal: goalNum,
        avatar_color: color,
        avatar_icon: icon,
      });
      setSaveError(null);
      router.back();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={[styles.flex, screenBackground(theme)]}>
      <Appbar.Header style={transparentHeader}>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Settings" />
        <Appbar.Action icon="check" onPress={save} disabled={!dirty || saving} accessibilityLabel="Save" />
      </Appbar.Header>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.preview}>
          <UserAvatar name={displayName || profile.display_name} color={color} icon={icon} size={88} />
          <Text variant="titleLarge" numberOfLines={1}>
            {displayName.trim() || 'Your name'}
          </Text>
        </View>

        <Card mode="contained" style={surfaceCard(theme)}>
          <Card.Content style={styles.section}>
            <TextInput
              mode="outlined"
              label="Display name"
              value={displayName}
              onChangeText={setDisplayName}
              maxLength={40}
            />
            <TextInput
              mode="outlined"
              label="Daily step goal"
              value={goal}
              onChangeText={(t) => setGoal(t.replace(/\D/g, ''))}
              keyboardType="number-pad"
            />
            {saveError ? (
              <HelperText type="error" visible>
                {saveError}
              </HelperText>
            ) : null}
          </Card.Content>
        </Card>

        <Card mode="contained" style={surfaceCard(theme)}>
          <Card.Content style={styles.section}>
            <Text variant="titleSmall">Avatar color</Text>
            <View style={styles.wrap}>
              {avatarColors.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setColor(c)}
                  accessibilityLabel={`Color ${c}`}
                  accessibilityState={{ selected: c === color }}
                  style={[
                    styles.swatch,
                    { backgroundColor: c },
                    c === color && { borderColor: theme.colors.onSurface, borderWidth: 3 },
                  ]}
                />
              ))}
            </View>
            <Text variant="titleSmall">Avatar</Text>
            <View style={styles.wrap}>
              {[null, ...AVATAR_ICONS].map((option) => {
                const selected = option === icon;
                return (
                  <Pressable
                    key={option ?? 'initials'}
                    onPress={() => setIcon(option)}
                    accessibilityLabel={option ? `${option} avatar` : 'Initials avatar'}
                    accessibilityState={{ selected }}
                    style={[styles.iconRing, { borderColor: selected ? theme.colors.onSurface : 'transparent' }]}>
                    <UserAvatar name={displayName || '?'} color={color} icon={option} size={40} />
                  </Pressable>
                );
              })}
            </View>
          </Card.Content>
        </Card>

        <FlairEditorCard profile={profile} />

        <ThemePicker />

        <AppLockCard />

        <BlockedUsersCard userId={userId} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  content: { padding: 16, gap: 12 },
  preview: { alignItems: 'center', gap: 8, marginBottom: 4 },
  section: { gap: 12 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  swatch: { width: 36, height: 36, borderRadius: 18 },
  iconRing: { borderWidth: 2, borderRadius: 999, padding: 2 },
});
