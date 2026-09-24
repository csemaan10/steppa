import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import {
  Appbar,
  Button,
  Card,
  Dialog,
  HelperText,
  Portal,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';

import { useTabBarSpace } from '@/components/floating-tab-bar';
import { StatTile } from '@/components/stat-tile';
import { UserAvatar } from '@/components/user-avatar';
import { WeekChart } from '@/components/week-chart';
import { useLoader } from '@/hooks/use-loader';
import { getProfile, getStepHistory, summarize, updateProfile } from '@/lib/api';
import { formatSteps } from '@/lib/dates';
import { supabase } from '@/lib/supabase';
import { useUserId } from '@/providers/auth-provider';
import { avatarColors, screenBackground, tintedCard, transparentHeader } from '@/theme';

export default function ProfileScreen() {
  const theme = useTheme();
  const userId = useUserId();
  const tabBarSpace = useTabBarSpace();
  const { data, reload } = useLoader(async () => {
    const [profile, history] = await Promise.all([getProfile(userId), getStepHistory(userId, 30)]);
    return { profile, history };
  }, userId);

  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [goal, setGoal] = useState('');
  const [color, setColor] = useState(avatarColors[0]!);
  const [busy, setBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  function startEdit() {
    if (!data) return;
    setDisplayName(data.profile.display_name);
    setGoal(String(data.profile.daily_goal));
    setColor(data.profile.avatar_color);
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
              <UserAvatar name={data.profile.display_name} color={data.profile.avatar_color} size={88} />
              <Text variant="headlineSmall">{data.profile.display_name}</Text>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                @{data.profile.username} · Goal {formatSteps(data.profile.daily_goal)}/day
              </Text>
            </View>

            <Text variant="titleMedium">Last 30 days</Text>
            <View style={styles.row}>
              <StatTile label="Total" value={formatSteps(stats!.total)} highlight />
              <StatTile label="Daily avg" value={formatSteps(stats!.average)} />
            </View>
            <View style={styles.row}>
              <StatTile label="Best day" value={formatSteps(stats!.best)} />
              <StatTile label="Goal hit" value={`${daysHitGoal} days`} />
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
          </>
        ) : null}

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
  row: { flexDirection: 'row', gap: 12 },
  signOut: { marginTop: 12 },
  dialogContent: { gap: 12 },
  colors: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  swatch: { width: 36, height: 36, borderRadius: 18 },
});
