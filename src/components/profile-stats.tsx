import { StyleSheet, View } from 'react-native';
import { Card, Divider, Icon, ProgressBar, Text } from 'react-native-paper';

import { ProgressRing } from '@/components/progress-ring';
import { StreakFlame, flameTier } from '@/components/streak-flame';
import { SwapText } from '@/components/swap-text';
import { summarize, type DaySteps, type ProfileStats } from '@/lib/api';
import { formatSteps } from '@/lib/dates';
import { KCAL_PER_STEP, KM_PER_STEP, STEPS_PER_MINUTE } from '@/lib/estimates';
import { glassCard, ringTrack, useAppTheme } from '@/theme';

const MARATHON_KM = 42.195;

const dayLabel = (day: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(`${day}T12:00:00`).toLocaleDateString(undefined, opts);

type OverviewProps = { history: DaySteps[]; previous: DaySteps[]; goal: number };

/**
 * Today up top (ring + big number), then the last 30 days below it: total with trend,
 * three key metrics, and one actionable insight. Today's figures crossfade when a sync brings new steps.
 */
export function StepsOverviewCard({ history, previous, goal }: OverviewProps) {
  const theme = useAppTheme();
  const today = history[history.length - 1]?.steps ?? 0;
  // Usual day = 30-day active average, excluding today so a half-finished day doesn't skew it.
  const usual = summarize(history.slice(0, -1)).average;
  const ratio = goal ? today / goal : 0;

  const stats = summarize(history);
  const prevTotal = summarize(previous).total;
  const trend = prevTotal ? Math.round(((stats.total - prevTotal) / prevTotal) * 100) : null;
  const goalDays = history.filter((d) => d.steps >= goal).length;
  const best = history.reduce<DaySteps | null>((b, d) => (d.steps > (b?.steps ?? 0) ? d : b), null);

  const up = (trend ?? 0) > 0;
  const down = (trend ?? 0) < 0;
  const trendColor = up ? theme.colors.primary : down ? theme.colors.error : theme.colors.onSurfaceVariant;

  const gap = goal - stats.average;
  const insight =
    stats.total === 0
      ? 'No steps in the last 30 days yet.'
      : gap > 0
        ? `Your average is ${formatSteps(gap)} short of your goal, about a ${Math.max(1, Math.round(gap / STEPS_PER_MINUTE))}-minute walk a day.`
        : `You average ${formatSteps(-gap)} above your goal. Time to raise it?`;

  return (
    <Card mode="contained" style={glassCard(theme)}>
      <Card.Content style={styles.content}>
        <View style={styles.today}>
          <ProgressRing
            progress={ratio}
            size={104}
            stroke={10}
            color={theme.colors.primary}
            overflowColor={theme.colors.accent}
            trackColor={ringTrack(theme)}>
            <SwapText variant="titleMedium" style={styles.bold}>
              {`${Math.round(ratio * 100)}%`}
            </SwapText>
          </ProgressRing>
          <View style={styles.flex}>
            <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>
              Today
            </Text>
            <SwapText variant="displaySmall" numberOfLines={1} adjustsFontSizeToFit style={styles.bold}>
              {formatSteps(today)}
            </SwapText>
            <SwapText variant="bodyMedium" style={{ color: today >= goal ? theme.colors.primary : theme.colors.onSurface }}>
              {today >= goal ? `Goal hit, +${formatSteps(today - goal)}` : `${formatSteps(goal - today)} to go`}
            </SwapText>
            {usual > 0 ? (
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                Usual day: {formatSteps(usual)}
              </Text>
            ) : null}
          </View>
        </View>

        <Divider style={styles.sectionDivider} />

        <View style={styles.headline}>
          <View style={styles.flex}>
            <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>
              Last 30 days
            </Text>
            <Text variant="titleLarge" style={styles.bold}>
              {formatSteps(stats.total)}
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              steps · {formatSteps(stats.total * KM_PER_STEP)} km
            </Text>
          </View>
          {trend !== null ? (
            <View
              style={[styles.chip, { borderColor: theme.colors.outlineVariant }]}
              accessibilityLabel={`${up ? 'Up' : down ? 'Down' : 'Level'} ${Math.abs(trend)}% vs the 30 days before`}>
              <Icon
                source={up ? 'trending-up' : down ? 'trending-down' : 'trending-neutral'}
                size={16}
                color={trendColor}
              />
              <Text variant="labelMedium" style={{ color: trendColor }}>
                {Math.abs(trend)}% vs prior
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.metrics}>
          <Metric label="Daily avg" value={formatSteps(stats.average)} supporting={`${Math.round((stats.average / goal) * 100)}% of goal`} />
          <Metric label="Goal days" value={`${goalDays}/30`} progress={goalDays / 30} />
          <Metric
            label="Best day"
            value={formatSteps(best?.steps ?? 0)}
            supporting={best ? dayLabel(best.day, { weekday: 'short', month: 'short', day: 'numeric' }) : '—'}
          />
        </View>

        <View style={[styles.insight, { backgroundColor: theme.colors.surfaceVariant }]}>
          <Icon source="lightbulb-on-outline" size={18} color={theme.colors.onSurfaceVariant} />
          <Text variant="bodyMedium" style={[styles.flex, { color: theme.colors.onSurfaceVariant }]}>
            {insight}
          </Text>
        </View>
      </Card.Content>
    </Card>
  );
}

function Metric({
  label,
  value,
  supporting,
  progress,
}: {
  label: string;
  value: string;
  supporting?: string;
  progress?: number;
}) {
  const theme = useAppTheme();
  return (
    <View style={styles.metric}>
      <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
        {label}
      </Text>
      <Text variant="titleMedium" style={styles.bold} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {progress !== undefined ? (
        <ProgressBar
          progress={Math.min(Math.max(progress, 0), 1)}
          color={theme.colors.primary}
          style={[styles.progress, { backgroundColor: theme.colors.surfaceVariant }]}
        />
      ) : null}
      {supporting ? (
        <Text variant="labelSmall" numberOfLines={1} style={{ color: theme.colors.onSurfaceVariant }}>
          {supporting}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Current streak against the personal record, with a flame that grows as the streak does. Kept
 * compact: one row (flame, streak and a short note, record) over a thin progress bar.
 */
export function StreakCard({ current, longest }: { current: number; longest: number }) {
  const theme = useAppTheme();
  const tier = flameTier(current);
  const isRecord = current > 0 && current >= longest;
  const toBeat = longest - current + 1;
  const supporting =
    current === 0
      ? 'Hit your goal today to start one.'
      : isRecord
        ? 'Your longest yet. Keep it going!'
        : `${toBeat} more day${toBeat === 1 ? '' : 's'} to beat your record.`;

  return (
    <Card mode="contained" style={glassCard(theme)}>
      <Card.Content style={styles.streak}>
        <View style={styles.streakRow}>
          <StreakFlame streak={current} width={34} />
          <View style={styles.flex}>
            <SwapText variant="titleMedium" style={styles.bold}>
              {current === 0 ? 'No streak yet' : `${current}-day streak`}
            </SwapText>
            <Text variant="bodySmall" numberOfLines={2} style={{ color: theme.colors.onSurfaceVariant }}>
              {supporting}
            </Text>
          </View>
          <View style={styles.end}>
            <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
              Record
            </Text>
            <Text variant="titleSmall" style={styles.bold}>
              {longest} day{longest === 1 ? '' : 's'}
            </Text>
          </View>
        </View>
        <ProgressBar
          progress={longest ? Math.min(current / longest, 1) : 0}
          color={current > 0 ? tier.outer[0] : theme.colors.tertiary}
          style={[styles.streakBar, { backgroundColor: theme.colors.surfaceVariant }]}
        />
      </Card.Content>
    </Card>
  );
}

/** Lifetime totals as an M3 list with tonal leading icons. */
export function LifetimeCard({ stats }: { stats: ProfileStats }) {
  const theme = useAppTheme();
  const km = stats.lifetime_steps * KM_PER_STEP;
  const marathons = km / MARATHON_KM;
  const perDay = stats.days_tracked ? stats.lifetime_steps / stats.days_tracked : 0;

  const rows = [
    {
      icon: 'shoe-print',
      label: 'Steps',
      value: formatSteps(stats.lifetime_steps),
      supporting: `${formatSteps(perDay)} per active day`,
    },
    {
      icon: 'map-marker-distance',
      label: 'Distance',
      value: `${formatSteps(km)} km`,
      supporting:
        marathons >= 1
          ? `≈ ${marathons.toFixed(1)} marathon${marathons >= 1.05 ? 's' : ''}`
          : `${Math.round(marathons * 100)}% of a marathon`,
    },
    {
      icon: 'fire-circle',
      label: 'Calories',
      value: `~${formatSteps(stats.lifetime_steps * KCAL_PER_STEP)}`,
      supporting: 'kcal, estimated',
    },
    {
      icon: 'calendar-check',
      label: 'Active days',
      value: formatSteps(stats.days_tracked),
      supporting: 'days with steps',
    },
    ...(stats.best_day
      ? [
          {
            icon: 'trophy-outline',
            label: 'Best day',
            value: formatSteps(stats.best_steps ?? 0),
            supporting: dayLabel(stats.best_day, { month: 'short', day: 'numeric', year: 'numeric' }),
          },
        ]
      : []),
  ];

  return (
    <Card mode="contained" style={glassCard(theme)}>
      <Card.Title title="All time" titleVariant="titleMedium" />
      <Card.Content style={styles.list}>
        {rows.map((row, i) => (
          <View key={row.label}>
            {i > 0 ? <Divider style={styles.divider} /> : null}
            <View style={styles.listRow}>
              <View style={[styles.leading, { backgroundColor: theme.colors.secondaryContainer }]}>
                <Icon source={row.icon} size={20} color={theme.colors.onSecondaryContainer} />
              </View>
              <View style={styles.flex}>
                <Text variant="bodyLarge">{row.label}</Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  {row.supporting}
                </Text>
              </View>
              <Text variant="titleMedium" style={styles.bold}>
                {row.value}
              </Text>
            </View>
          </View>
        ))}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: '700' },
  content: { gap: 8, paddingVertical: 16 },
  today: { flexDirection: 'row', alignItems: 'center', gap: 20, paddingVertical: 4 },
  sectionDivider: { marginVertical: 8 },
  headline: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  metrics: { flexDirection: 'row', gap: 16, marginTop: 8 },
  metric: { flex: 1, gap: 2 },
  progress: { height: 4, borderRadius: 2, marginVertical: 4 },
  insight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  streak: { gap: 10, paddingTop: 12, paddingBottom: 14 },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  streakBar: { height: 4, borderRadius: 2 },
  leading: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  end: { alignItems: 'flex-end' },
  list: { paddingBottom: 8 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 10 },
  divider: { marginLeft: 56 },
});
