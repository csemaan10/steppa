import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import {
  Appbar,
  Button,
  Card,
  Dialog,
  HelperText,
  Icon,
  Portal,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';

import { useTabBarSpace } from '@/components/floating-tab-bar';
import { ThemePicker } from '@/components/theme-picker';
import { MonthCard } from '@/components/month-card';
import { StatTile } from '@/components/stat-tile';
import { TrophyCase } from '@/components/trophy-case';
import { AVATAR_ICONS, UserAvatar } from '@/components/user-avatar';
import { WeekChart } from '@/components/week-chart';
import { WeekdayChart } from '@/components/weekday-chart';
import { useLoader } from '@/hooks/use-loader';
import { getProfile, getProfileStats, getStepHistory, summarize, updateProfile } from '@/lib/api';
import { formatSteps } from '@/lib/dates';
import { supabase } from '@/lib/supabase';
import { useUserId } from '@/providers/auth-provider';
import { avatarColors, screenBackground, tintedCard, transparentHeader } from '@/theme';

export default function ProfileScreen() {
  const theme = useTheme();
  const userId = useUserId();
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

  const stats = data ? summarize(data.history) : null;
  const daysHitGoal = data
    ? data.history.filter((d) => d.steps >= data.profile.daily_goal).length
    : 0;
  const previousTotal = data ? summarize(data.previous).total : 0;
  const trend = stats && previousTotal ? Math.round(((stats.total - previousTotal) / previousTotal) * 100) : null;
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
              {lifetime && lifetime.current_streak > 0 ? (
                <View style={[styles.streakPill, { backgroundColor: theme.colors.tertiaryContainer }]}>
                  <Icon source="fire" size={16} color="#F4511E" />
                  <Text
                    variant="labelLarge"
                    numberOfLines={1}
                    style={[styles.streakText, { color: theme.colors.onTertiaryContainer }]}>
                    {lifetime.current_streak}-day streak
                  </Text>
                </View>
              ) : null}
            </View>

            {lifetime ? <TrophyCase stats={lifetime} /> : null}

            <Text variant="titleMedium">Streaks</Text>
            <View style={styles.row}>
              <StatTile label="Current" value={`🔥 ${lifetime?.current_streak ?? 0} days`} highlight />
              <StatTile label="Longest" value={`${lifetime?.longest_streak ?? 0} days`} />
            </View>

            <Text variant="titleMedium">Last 30 days</Text>
            <View style={styles.row}>
              <StatTile label="Total" value={formatSteps(stats!.total)} highlight />
              <StatTile label="Daily avg" value={formatSteps(stats!.average)} />
            </View>
            <View style={styles.row}>
              <StatTile label="Goal hit rate" value={`${Math.round((daysHitGoal / 30) * 100)}%`} />
              <StatTile
                label="vs previous 30"
                value={trend === null ? '—' : `${trend > 0 ? '▲' : trend < 0 ? '▼' : ''} ${Math.abs(trend)}%`}
              />
            </View>

            <Card mode="contained" style={tintedCard(theme)}>
              <Card.Title title="This week" />
              <Card.Content>
                <WeekChart
                  series={[{ name: 'You', color: theme.colors.primary, data: data.history.slice(-7) }]}
                  goal={data.profile.daily_goal}
                />
              </Card.Content>
            </Card>

            <MonthCard userId={userId} goal={data.profile.daily_goal} />

            <Card mode="contained" style={{ backgroundColor: theme.colors.elevation.level1 }}>
              <Card.Title title="Your rhythm" subtitle="Average by weekday, last 60 days" />
              <Card.Content>
                <WeekdayChart history={data.history60} />
              </Card.Content>
            </Card>

            {lifetime ? (
              <>
                <Text variant="titleMedium">All time</Text>
                <View style={styles.row}>
                  <StatTile label="Steps" value={formatSteps(lifetime.lifetime_steps)} highlight />
                  <StatTile label="Distance" value={`${formatSteps(lifetime.lifetime_steps * 0.000762)} km`} />
                </View>
                <View style={styles.row}>
                  <StatTile label="Calories" value={`~${formatSteps(lifetime.lifetime_steps * 0.04)}`} />
                  <StatTile label="Active days" value={formatSteps(lifetime.days_tracked)} />
                </View>
                {lifetime.best_day ? (
                  <StatTile
                    label={`Best day · ${new Date(`${lifetime.best_day}T12:00:00`).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}`}
                    value={`${formatSteps(lifetime.best_steps ?? 0)} steps`}
                  />
                ) : null}
              </>
            ) : null}
          </>
        ) : null}

        <ThemePicker />

        <Button mode="outlined" icon="logout" onPress={() => supabase.auth.signOut()} style={styles.signOut}>
          Sign out
        </Button>
      </ScrollView>

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
            <View style={styles.icons}>
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
            </View>
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
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    marginTop: 4,
  },
  streakText: { letterSpacing: 0, flexShrink: 0 },
  row: { flexDirection: 'row', gap: 12 },
  signOut: { marginTop: 12 },
  dialogContent: { gap: 12 },
  colors: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  swatch: { width: 36, height: 36, borderRadius: 18 },
  icons: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  iconRing: { borderWidth: 2, borderRadius: 999, padding: 2 },
});
