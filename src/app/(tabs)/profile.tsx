import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import {
  Appbar,
  Button,
  Card,
  Dialog,
  HelperText,
  Portal,
  Snackbar,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';

import { AppLockCard } from '@/components/app-lock-card';
import { BlockedUsersCard } from '@/components/blocked-users-card';
import { FlairAvatar } from '@/components/flair';
import { FlairEditorCard } from '@/components/flair-editor-card';
import { useTabBarSpace } from '@/components/floating-tab-bar';
import { ThemePicker } from '@/components/theme-picker';
import { MonthCard } from '@/components/month-card';
import { LifetimeCard, StepsOverviewCard, StreakCard } from '@/components/profile-stats';
import { TrophyCase } from '@/components/trophy-case';
import { AVATAR_ICONS, UserAvatar } from '@/components/user-avatar';
import { WeekChart } from '@/components/week-chart';
import { WeekdayChart } from '@/components/weekday-chart';
import { useLoader } from '@/hooks/use-loader';
import {
  deleteMyAccount,
  getProfile,
  getProfileStats,
  getStepHistory,
  importStepHistory,
  updateProfile,
} from '@/lib/api';
import { formatSteps } from '@/lib/dates';
import { healthSourceName, isHealthAvailable, requestHealthPermission } from '@/lib/health';
import { useAppLock } from '@/providers/app-lock-provider';
import { useUserId } from '@/providers/auth-provider';
import { avatarColors, screenBackground, surfaceCard, transparentHeader } from '@/theme';

export default function ProfileScreen() {
  const theme = useTheme();
  const userId = useUserId();
  const { signOut, forget, setEnabled } = useAppLock();
  const tabBarSpace = useTabBarSpace();
  const { data, reload } = useLoader(async () => {
    const [profile, history60, lifetime] = await Promise.all([
      getProfile(userId),
      getStepHistory(userId, 60),
      getProfileStats(userId),
    ]);
    return { profile, history: history60.slice(-30), previous: history60.slice(0, 30), history60, lifetime };
  }, userId);

  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [goal, setGoal] = useState('');
  const [color, setColor] = useState(avatarColors[0]!);
  const [icon, setIcon] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importCount, setImportCount] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  async function importHistory() {
    setImporting(true);
    try {
      if (!(await isHealthAvailable()) || !(await requestHealthPermission())) {
        throw new Error(`Allow Steppa to read steps in ${healthSourceName} first.`);
      }
      const days = await importStepHistory(userId);
      setNotice(`Imported ${days} day${days === 1 ? '' : 's'} of steps from ${healthSourceName}.`);
      setImportCount((n) => n + 1);
      await reload();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  }

  function confirmDeleteAccount() {
    Alert.alert(
      'Delete account?',
      'This permanently deletes your profile, step history, and messages. Groups you own are deleted for everyone. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMyAccount();
              // The login no longer exists: drop biometric sign-in and the local session.
              await setEnabled(false);
              await forget();
            } catch (e) {
              Alert.alert('Could not delete account', e instanceof Error ? e.message : String(e));
            }
          },
        },
      ]
    );
  }

  function startEdit() {
    if (!data) return;
    setDisplayName(data.profile.display_name);
    setGoal(String(data.profile.daily_goal));
    setColor(data.profile.avatar_color);
    setIcon(data.profile.avatar_icon);
    setEditError(null);
    setEditing(true);
  }

  async function save() {
    const goalNum = Number(goal);
    if (!displayName.trim() || !Number.isInteger(goalNum) || goalNum < 1000 || goalNum > 100000) {
      setEditError('Enter a name and a goal between 1,000 and 100,000.');
      return;
    }
    setBusy(true);
    try {
      await updateProfile(userId, {
        display_name: displayName.trim(),
        daily_goal: goalNum,
        avatar_color: color,
        avatar_icon: icon,
      });
      setEditing(false);
      await reload();
    } catch (e) {
      setEditError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  const lifetime = data?.lifetime;

  return (
    <View style={[styles.flex, screenBackground(theme)]}>
      <Appbar.Header style={transparentHeader}>
        <Appbar.Content title="Profile" />
        <Appbar.Action icon="pencil" onPress={startEdit} disabled={!data} accessibilityLabel="Edit profile" />
      </Appbar.Header>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: tabBarSpace }]}>
        {data ? (
          <>
            <View style={styles.header}>
              <FlairAvatar
                name={data.profile.display_name}
                color={data.profile.avatar_color}
                icon={data.profile.avatar_icon}
                size={88}
                flair_color={data.profile.flair_color}
                flair_glow={data.profile.flair_glow}
              />
              <Text variant="headlineSmall">{data.profile.display_name}</Text>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                @{data.profile.username} · Goal {formatSteps(data.profile.daily_goal)}/day
              </Text>
            </View>

            <StepsOverviewCard history={data.history} previous={data.previous} goal={data.profile.daily_goal} />

            {lifetime ? <TrophyCase stats={lifetime} /> : null}

            {lifetime ? <StreakCard current={lifetime.current_streak} longest={lifetime.longest_streak} /> : null}

            <Card mode="contained" style={surfaceCard(theme)}>
              <Card.Title title="This week" />
              <Card.Content>
                <WeekChart
                  series={[{ name: 'You', color: theme.colors.primary, data: data.history.slice(-7) }]}
                  goal={data.profile.daily_goal}
                />
              </Card.Content>
            </Card>

            <MonthCard key={importCount} userId={userId} goal={data.profile.daily_goal} />

            <Card mode="contained" style={surfaceCard(theme)}>
              <Card.Title title="Your rhythm" subtitle="Average by weekday, last 60 days" />
              <Card.Content>
                <WeekdayChart history={data.history60} />
              </Card.Content>
            </Card>

            {lifetime ? <LifetimeCard stats={lifetime} /> : null}

            <FlairEditorCard key={data.profile.id} profile={data.profile} />
          </>
        ) : null}

        <ThemePicker />

        <AppLockCard />

        <BlockedUsersCard userId={userId} />

        <Button
          mode="contained-tonal"
          icon="history"
          onPress={importHistory}
          loading={importing}
          disabled={importing}
          style={styles.signOut}>
          {importing ? 'Importing the last year…' : 'Import step history'}
        </Button>

        <Button mode="outlined" icon="logout" onPress={signOut}>
          Sign out
        </Button>

        <Button icon="account-remove-outline" textColor={theme.colors.error} onPress={confirmDeleteAccount}>
          Delete account
        </Button>
      </ScrollView>

      <Snackbar
        visible={!!notice}
        onDismiss={() => setNotice(null)}
        duration={4000}
        style={{ marginBottom: tabBarSpace }}>
        {notice}
      </Snackbar>

      <Portal>
        <Dialog visible={editing} onDismiss={() => setEditing(false)}>
          <Dialog.Title>Edit profile</Dialog.Title>
          <Dialog.Content style={styles.dialogContent}>
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
            <Text variant="labelLarge">Avatar color</Text>
            <View style={styles.colors}>
              {avatarColors.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setColor(c)}
                  accessibilityLabel={`Color ${c}`}
                  style={[
                    styles.swatch,
                    { backgroundColor: c },
                    c === color && { borderColor: theme.colors.onSurface, borderWidth: 3 },
                  ]}
                />
              ))}
            </View>
            <Text variant="labelLarge">Avatar</Text>
            <ScrollView style={styles.iconScroll} contentContainerStyle={styles.icons} nestedScrollEnabled>
              {[null, ...AVATAR_ICONS].map((option) => {
                const selected = option === icon;
                return (
                  <Pressable
                    key={option ?? 'initials'}
                    onPress={() => setIcon(option)}
                    accessibilityLabel={option ? `${option} avatar` : 'Initials avatar'}
                    accessibilityState={{ selected }}
                    style={[
                      styles.iconRing,
                      { borderColor: selected ? theme.colors.onSurface : 'transparent' },
                    ]}>
                    <UserAvatar name={displayName || '?'} color={color} icon={option} size={40} />
                  </Pressable>
                );
              })}
            </ScrollView>
            {editError ? (
              <HelperText type="error" visible>
                {editError}
              </HelperText>
            ) : null}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setEditing(false)}>Cancel</Button>
            <Button onPress={save} loading={busy} disabled={busy}>
              Save
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 12 },
  header: { alignItems: 'center', gap: 6, marginBottom: 12 },
  signOut: { marginTop: 12 },
  dialogContent: { gap: 12 },
  colors: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  swatch: { width: 36, height: 36, borderRadius: 18 },
  iconScroll: { maxHeight: 220 },
  icons: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  iconRing: { borderWidth: 2, borderRadius: 999, padding: 2 },
});
