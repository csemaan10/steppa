import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Appbar, Card, Divider, Text, useTheme } from 'react-native-paper';

import { TrophyCase } from '@/components/trophy-case';
import { UserAvatar } from '@/components/user-avatar';
import { WeekChart } from '@/components/week-chart';
import { useLoader } from '@/hooks/use-loader';
import { getProfile, getProfileStats, getStepHistory, summarize } from '@/lib/api';
import { formatSteps } from '@/lib/dates';
import { useUserId } from '@/providers/auth-provider';
import { screenBackground, tintedCard, transparentHeader } from '@/theme';

export default function UserScreen() {
  const theme = useTheme();
  const myId = useUserId();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data, error } = useLoader(async () => {
    const [me, them, myHistory, theirHistory, theirStats] = await Promise.all([
      getProfile(myId),
      getProfile(id),
      getStepHistory(myId, 30),
      getStepHistory(id, 30),
      getProfileStats(id),
    ]);
    return { me, them, myHistory, theirHistory, theirStats };
  }, `${myId}:${id}`);

  if (!data) {
    return (
      <View style={[styles.flex, screenBackground(theme)]}>
        <Appbar.Header style={transparentHeader}>
          <Appbar.BackAction onPress={() => router.back()} />
        </Appbar.Header>
        <View style={styles.center}>
          {error ? <Text style={{ color: theme.colors.error }}>{error}</Text> : <ActivityIndicator />}
        </View>
      </View>
    );
  }

  const { me, them, myHistory, theirHistory, theirStats } = data;
  const mine7 = summarize(myHistory.slice(-7));
  const theirs7 = summarize(theirHistory.slice(-7));
  const mine30 = summarize(myHistory);
  const theirs30 = summarize(theirHistory);

  const rows: { label: string; mine: number; theirs: number }[] = [
    { label: 'Today', mine: mine7.today, theirs: theirs7.today },
    { label: '7-day total', mine: mine7.total, theirs: theirs7.total },
    { label: '30-day average', mine: mine30.average, theirs: theirs30.average },
    { label: 'Best day (30d)', mine: mine30.best, theirs: theirs30.best },
    {
      label: 'Goal days (30d)',
      mine: myHistory.filter((d) => d.steps >= me.daily_goal).length,
      theirs: theirHistory.filter((d) => d.steps >= them.daily_goal).length,
    },
  ];
  // Score = daily duels: each day in the last 30 where both of you have steps, the higher count wins.
  const duels = myHistory.flatMap((d, i) => {
    const theirs = theirHistory[i]?.steps ?? 0;
    return d.steps > 0 && theirs > 0 && d.steps !== theirs ? [d.steps > theirs] : [];
  });
  const wins = duels.filter(Boolean).length;
  const losses = duels.length - wins;

  return (
    <View style={[styles.flex, screenBackground(theme)]}>
      <Appbar.Header style={transparentHeader}>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title={them.display_name} />
      </Appbar.Header>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.versus}>
          <View style={styles.person}>
            <UserAvatar name={me.display_name} color={me.avatar_color} size={64} />
            <Text variant="titleSmall">You</Text>
          </View>
          <View style={styles.score}>
            <Text variant="displaySmall">
              {wins} – {losses}
            </Text>
            <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              {duels.length === 0
                ? 'No shared days yet'
                : wins > losses
                  ? "You're ahead"
                  : wins < losses
                    ? `${them.display_name} leads`
                    : 'Neck and neck'}
            </Text>
            <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
              Daily wins · last 30 days
            </Text>
          </View>
          <View style={styles.person}>
            <UserAvatar name={them.display_name} color={them.avatar_color} size={64} />
            <Text variant="titleSmall" numberOfLines={1}>
              @{them.username}
            </Text>
          </View>
        </View>

        <TrophyCase stats={theirStats} />

        <Card mode="elevated">
          <Card.Content>
            {rows.map((row, i) => (
              <View key={row.label}>
                {i > 0 ? <Divider /> : null}
                <View style={styles.compareRow}>
                  <Text
                    variant="titleMedium"
                    style={[styles.value, row.mine > row.theirs && { color: theme.colors.primary }]}>
                    {formatSteps(row.mine)}
                  </Text>
                  <Text variant="labelMedium" style={[styles.metric, { color: theme.colors.onSurfaceVariant }]}>
                    {row.label}
                  </Text>
                  <Text
                    variant="titleMedium"
                    style={[
                      styles.value,
                      styles.valueRight,
                      row.theirs > row.mine && { color: theme.colors.tertiary },
                    ]}>
                    {formatSteps(row.theirs)}
                  </Text>
                </View>
              </View>
            ))}
          </Card.Content>
        </Card>

        <Card mode="contained" style={tintedCard(theme)}>
          <Card.Title title="Last 7 days" />
          <Card.Content>
            <WeekChart
              series={[
                { name: 'You', color: theme.colors.primary, data: myHistory.slice(-7) },
                { name: them.display_name, color: theme.colors.tertiary, data: theirHistory.slice(-7) },
              ]}
            />
          </Card.Content>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, gap: 16 },
  versus: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  person: { alignItems: 'center', gap: 6, width: 96 },
  score: { alignItems: 'center' },
  compareRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  value: { flex: 1 },
  valueRight: { textAlign: 'right' },
  metric: { flex: 1.2, textAlign: 'center' },
});
