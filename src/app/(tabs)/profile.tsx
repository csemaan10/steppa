import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Appbar, Card, Text } from 'react-native-paper';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { GlassAction } from '@/components/glass-action';
import { UserAvatar } from '@/components/user-avatar';
import { useTabBarSpace } from '@/components/floating-tab-bar';
import { MonthCard } from '@/components/month-card';
import { LifetimeCard, StepsOverviewCard, StreakCard } from '@/components/profile-stats';
import { TrophyCase } from '@/components/trophy-case';
import { WeekChart } from '@/components/week-chart';
import { WeekdayChart } from '@/components/weekday-chart';
import { useLoader } from '@/hooks/use-loader';
import { getProfile, getProfileStats, getStepHistory } from '@/lib/api';
import { formatSteps } from '@/lib/dates';
import { useUserId } from '@/providers/auth-provider';
import { glassCard, screenBackground, transparentHeader, useAppTheme } from '@/theme';
import { enter } from '@/theme/motion';

/**
 * One of the page's blocks, rising in once in a short top-to-bottom stagger when the profile loads.
 * No layout transition: the month card grows and shrinks on its own spring, and one would make the
 * blocks below trail behind it.
 */
function Block({ index, style, children }: { index: number; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  return (
    <Animated.View entering={enter(index, reduceMotion)} style={style}>
      {children}
    </Animated.View>
  );
}

export default function ProfileScreen() {
  const theme = useAppTheme();
  const userId = useUserId();
  const tabBarSpace = useTabBarSpace();
  const { data } = useLoader(async () => {
    const [profile, history60, lifetime] = await Promise.all([
      getProfile(userId),
      getStepHistory(userId, 60),
      getProfileStats(userId),
    ]);
    return { profile, history: history60.slice(-30), previous: history60.slice(0, 30), history60, lifetime };
  }, userId);

  const lifetime = data?.lifetime;

  return (
    <View style={[styles.flex, screenBackground(theme)]}>
      <Appbar.Header mode="small" style={transparentHeader}>
        <Appbar.Content title="Profile" />
        <GlassAction icon="cog-outline" onPress={() => router.push('/settings')} accessibilityLabel="Settings" />
      </Appbar.Header>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: tabBarSpace }]}>
        {data ? (
          <>
            <Block index={0} style={styles.header}>
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
            </Block>

            <Block index={1}>
              <StepsOverviewCard history={data.history} previous={data.previous} goal={data.profile.daily_goal} />
            </Block>

            {lifetime ? (
              <Block index={2}>
                <TrophyCase stats={lifetime} />
              </Block>
            ) : null}

            {lifetime ? (
              <Block index={3}>
                <StreakCard current={lifetime.current_streak} longest={lifetime.longest_streak} />
              </Block>
            ) : null}

            <Block index={4}>
              <Card mode="contained" style={glassCard(theme)}>
                <Card.Title title="This week" />
                <Card.Content>
                  <WeekChart
                    series={[{ name: 'You', color: theme.colors.primary, data: data.history.slice(-7) }]}
                    goal={data.profile.daily_goal}
                  />
                </Card.Content>
              </Card>
            </Block>

            {/* The rest arrive together: the stagger is capped, so the page lands quickly. */}
            <Block index={5} style={styles.rest}>
              {/* Remounts after a history import (Settings) adds days, so the calendar refetches. */}
              <MonthCard key={lifetime?.days_tracked} userId={userId} goal={data.profile.daily_goal} />

              <Card mode="contained" style={glassCard(theme)}>
                <Card.Title title="Your rhythm" subtitle="Average by weekday, last 60 days" />
                <Card.Content>
                  <WeekdayChart history={data.history60} />
                </Card.Content>
              </Card>

              {lifetime ? <LifetimeCard stats={lifetime} /> : null}
            </Block>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 12 },
  header: { alignItems: 'center', gap: 6, marginBottom: 12 },
  rest: { gap: 12 },
});
