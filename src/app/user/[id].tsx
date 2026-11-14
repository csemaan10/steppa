import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Appbar, Card, Divider, Text } from 'react-native-paper';

import { Appear } from '@/components/appear';
import { ProfileCharacter } from '@/components/character/profile-character';
import { GlassBackAction } from '@/components/glass-action';
import { PetProfileCard } from '@/components/pet-profile-card';
import { TrophyCase } from '@/components/trophy-case';
import { UserAvatar } from '@/components/user-avatar';
import { WeekChart } from '@/components/week-chart';
import { useLoader } from '@/hooks/use-loader';
import { getMateWorld, getProfile, getProfileStats, getStepHistory, getWorld, summarize } from '@/lib/api';
import { formatSteps } from '@/lib/dates';
import { WORLDS } from '@/lib/world';
import { useUserId } from '@/providers/auth-provider';
import { glassCard, screenBackground, transparentHeader, useAppTheme } from '@/theme';

export default function UserScreen() {
  const theme = useAppTheme();
  const myId = useUserId();
  const { id } = useLocalSearchParams<{ id: string }>();
  // Your own profile (tapped in a group): what your group sees, without comparing you with yourself.
  const self = id === myId;

  const { data, error } = useLoader(async () => {
    const [me, them, myHistory, theirHistory, theirStats, theirPet] = await Promise.all([
      getProfile(myId),
      self ? undefined : getProfile(id),
      getStepHistory(myId, 30),
      self ? undefined : getStepHistory(id, 30),
      getProfileStats(id),
      // Extra: no pet card rather than no profile if it can't load (someone else's needs migration 016).
      (self ? getWorld(myId) : getMateWorld(id)).catch(() => null),
    ]);
    return { me, them: them ?? me, myHistory, theirHistory: theirHistory ?? myHistory, theirStats, theirPet };
  }, `${myId}:${id}`);

  if (!data) {
    return (
      <View style={[styles.flex, screenBackground(theme)]}>
        <Appbar.Header mode="small" style={transparentHeader}>
          <GlassBackAction onPress={() => router.back()} />
        </Appbar.Header>
        <View style={styles.center}>
          {error ? <Text style={{ color: theme.colors.error }}>{error}</Text> : <ActivityIndicator />}
        </View>
      </View>
    );
  }

  const { me, them, myHistory, theirHistory, theirStats, theirPet } = data;
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
      <Appbar.Header mode="small" style={transparentHeader}>
        <GlassBackAction onPress={() => router.back()} />
        <Appbar.Content title={self ? 'You' : them.display_name} />
      </Appbar.Header>

      {/* The profile's blocks rise in top to bottom once it has loaded. */}
      <ScrollView contentContainerStyle={styles.content}>
        <Appear>
          <ProfileCharacter profile={them} />
        </Appear>

        {self ? (
          <Appear index={1} style={styles.self}>
            <Text variant="headlineSmall">{them.display_name}</Text>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              @{them.username} · how your groups see you
            </Text>
          </Appear>
        ) : null}

        {/* Only pets: a row left from testing the dropped worlds has nothing to draw. */}
        {theirPet && WORLDS[theirPet.world.kind] ? (
          <Appear index={1}>
            <PetProfileCard status={theirPet} owner={self ? null : them.display_name} />
          </Appear>
        ) : null}

        {self ? null : (
          <Appear index={2} style={styles.versus}>
            <View style={styles.person}>
              <UserAvatar name={me.display_name} color={me.avatar_color} icon={me.avatar_icon} size={64} />
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
              <UserAvatar name={them.display_name} color={them.avatar_color} icon={them.avatar_icon} size={64} />
              <Text variant="titleSmall" numberOfLines={1}>
                @{them.username}
              </Text>
            </View>
          </Appear>
        )}

        <Appear index={3}>
          <TrophyCase stats={theirStats} />
        </Appear>

        {self ? null : (
          <Appear index={4}>
            <Card mode="contained" style={glassCard(theme)}>
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
          </Appear>
        )}

        <Appear index={5}>
          <Card mode="contained" style={glassCard(theme)}>
            <Card.Title title="Last 7 days" />
            <Card.Content>
              <WeekChart
                series={[
                  { name: 'You', color: theme.colors.primary, data: myHistory.slice(-7) },
                  ...(self
                    ? []
                    : [{ name: them.display_name, color: theme.colors.tertiary, data: theirHistory.slice(-7) }]),
                ]}
                goal={self ? me.daily_goal : undefined}
              />
            </Card.Content>
          </Card>
        </Appear>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, gap: 16 },
  self: { alignItems: 'center', gap: 2, marginTop: -8 },
  versus: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  person: { alignItems: 'center', gap: 6, width: 96 },
  score: { alignItems: 'center' },
  compareRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  value: { flex: 1 },
  valueRight: { textAlign: 'right' },
  metric: { flex: 1.2, textAlign: 'center' },
});
