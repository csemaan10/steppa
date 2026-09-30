import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { Appbar, Button, Card, Snackbar, Text, useTheme } from 'react-native-paper';

import { UserAvatar } from '@/components/user-avatar';
import { useTabBarSpace } from '@/components/floating-tab-bar';
import { MonthCard } from '@/components/month-card';
import { LifetimeCard, StepsOverviewCard, StreakCard } from '@/components/profile-stats';
import { TrophyCase } from '@/components/trophy-case';
import { WeekChart } from '@/components/week-chart';
import { WeekdayChart } from '@/components/weekday-chart';
import { useLoader } from '@/hooks/use-loader';
import { deleteMyAccount, getProfile, getProfileStats, getStepHistory, importStepHistory } from '@/lib/api';
import { formatSteps } from '@/lib/dates';
import { healthSourceName, isHealthAvailable, requestHealthPermission, requestHistoryPermission } from '@/lib/health';
import { useAppLock } from '@/providers/app-lock-provider';
import { useUserId } from '@/providers/auth-provider';
import { screenBackground, surfaceCard, transparentHeader } from '@/theme';

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

  const [importing, setImporting] = useState(false);
  const [importCount, setImportCount] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  async function importHistory() {
    setImporting(true);
    try {
      if (!(await isHealthAvailable()) || !(await requestHealthPermission())) {
        throw new Error(`Allow Steppa to read steps in ${healthSourceName} first.`);
      }
      // Older steps need a separate grant on Android; skipped or declined, recent days still import.
      await requestHistoryPermission();
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

  const lifetime = data?.lifetime;

  return (
    <View style={[styles.flex, screenBackground(theme)]}>
      <Appbar.Header style={transparentHeader}>
        <Appbar.Content title="Profile" />
        <Appbar.Action icon="cog-outline" onPress={() => router.push('/settings')} accessibilityLabel="Settings" />
      </Appbar.Header>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: tabBarSpace }]}>
        {data ? (
          <>
            <View style={styles.header}>
              <UserAvatar
                name={data.profile.display_name}
                color={data.profile.avatar_color}
                icon={data.profile.avatar_icon}
                size={88}
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
          </>
        ) : null}

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
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 12 },
  header: { alignItems: 'center', gap: 6, marginBottom: 12 },
  signOut: { marginTop: 12 },
});
