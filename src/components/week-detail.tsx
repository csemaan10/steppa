import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon, ProgressBar, Text } from 'react-native-paper';

import { ExpandingCard, type Rect } from '@/components/expanding-card';
import { SectionHeader } from '@/components/section-header';
import { WeekChart } from '@/components/week-chart';
import { summarize, type DaySteps } from '@/lib/api';
import { addDays, formatSteps, toDayKey } from '@/lib/dates';
import { KCAL_PER_STEP, KM_PER_STEP, STEPS_PER_MINUTE } from '@/lib/estimates';
import { useAppTheme, withAlpha } from '@/theme';

export type WeekDetailKind = 'average' | 'total' | 'best' | 'goal';

const TITLES: Record<WeekDetailKind, string> = {
  average: 'Daily average',
  total: 'Total',
  best: 'Best day',
  goal: 'Goal met',
};

const SHORT_DATE = { month: 'short', day: 'numeric' } as const;

const dayLabel = (day: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(`${day}T12:00:00`).toLocaleDateString(undefined, opts);

/** "Today", "Yesterday", else the weekday. */
function dayName(day: string) {
  const today = new Date();
  if (day === toDayKey(today)) return 'Today';
  if (day === toDayKey(addDays(today, -1))) return 'Yesterday';
  return dayLabel(day, { weekday: 'long' });
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function walkingTime(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h ? `${h} h ${m} min` : `${m} min`;
}

type Props = {
  kind: WeekDetailKind;
  /** Oldest first: the 7 days shown, after the 7 before them for comparison. */
  history: DaySteps[];
  goal: number;
  streak: number;
  /** The tapped tile's place on screen, for the card to grow out of. */
  origin: Rect;
  onClose: () => void;
};

/** One of the Today tiles opened up: the detail behind that one number. */
export function WeekDetail({ kind, history, goal, streak, origin, onClose }: Props) {
  const week = history.slice(-7);
  const before = history.slice(0, -7);
  const range = week.length ? `${dayLabel(week[0].day, SHORT_DATE)} – ${dayLabel(week[week.length - 1].day, SHORT_DATE)}` : '';
  const props = { week, before, goal };

  return (
    <ExpandingCard origin={origin} title={TITLES[kind]} subtitle={`Last 7 days · ${range}`} onClose={onClose}>
      {kind === 'average' ? <AverageDetail {...props} /> : null}
      {kind === 'total' ? <TotalDetail {...props} /> : null}
      {kind === 'best' ? <BestDetail {...props} /> : null}
      {kind === 'goal' ? <GoalDetail {...props} streak={streak} /> : null}
    </ExpandingCard>
  );
}

type DetailProps = { week: DaySteps[]; before: DaySteps[]; goal: number };

function AverageDetail({ week, before, goal }: DetailProps) {
  const theme = useAppTheme();
  const { average } = summarize(week);
  const previous = summarize(before).average;
  const walked = week.filter((d) => d.steps > 0);
  const above = walked.filter((d) => d.steps >= average).length;
  const quietest = walked.reduce<DaySteps | null>((q, d) => (!q || d.steps < q.steps ? d : q), null);

  return (
    <>
      <Hero
        value={formatSteps(average)}
        caption={walked.length ? `steps a day, over the ${plural(walked.length, 'day')} you walked` : 'No steps yet'}>
        <Change now={average} then={previous} />
      </Hero>
      <WeekChart series={[{ name: 'Steps', color: theme.colors.primary, data: week }]} goal={goal} />
      <Tiles
        items={[
          { label: 'Of your goal', value: `${Math.round((average / goal) * 100)}%`, supporting: `Goal: ${formatSteps(goal)}` },
          { label: 'At or above average', value: plural(above, 'day'), supporting: `of ${walked.length} you walked` },
          {
            label: 'Quietest day',
            value: quietest ? formatSteps(quietest.steps) : '–',
            supporting: quietest ? dayName(quietest.day) : 'No steps yet',
          },
          { label: 'The 7 days before', value: previous ? formatSteps(previous) : '–', supporting: 'daily average' },
        ]}
      />
    </>
  );
}

function TotalDetail({ week, before, goal }: DetailProps) {
  const theme = useAppTheme();
  const { total } = summarize(week);
  const previous = summarize(before).total;
  const weekly = goal * 7;

  return (
    <>
      <Hero value={formatSteps(total)} caption={`steps, ${Math.round((total / weekly) * 100)}% of ${formatSteps(weekly)} for the week`}>
        <View style={styles.barWrap}>
          <ProgressBar
            progress={Math.min(total / weekly, 1)}
            color={theme.colors.primary}
            style={[styles.bar, { backgroundColor: withAlpha(theme.colors.onSurface, 0.1) }]}
          />
        </View>
        <Change now={total} then={previous} />
      </Hero>
      <WeekChart series={[{ name: 'Steps', color: theme.colors.primary, data: week }]} goal={goal} />
      <SectionHeader title="That's about" />
      <Tiles
        items={[
          { label: 'Distance', value: `${(total * KM_PER_STEP).toFixed(1)} km`, supporting: 'estimated' },
          { label: 'Walking time', value: walkingTime(total / STEPS_PER_MINUTE), supporting: 'at an easy pace' },
          { label: 'Calories', value: `~${formatSteps(total * KCAL_PER_STEP)}`, supporting: 'kcal, estimated' },
          { label: 'The 7 days before', value: previous ? formatSteps(previous) : '–', supporting: 'steps in total' },
        ]}
      />
    </>
  );
}

function BestDetail({ week, before, goal }: DetailProps) {
  const theme = useAppTheme();
  const ranked = week.filter((d) => d.steps > 0).sort((a, b) => b.steps - a.steps);
  const best = ranked[0];
  const { average } = summarize(week);
  const previousBest = before.reduce<DaySteps | null>((b, d) => (d.steps > 0 && (!b || d.steps > b.steps) ? d : b), null);

  if (!best) return <Hero value="–" caption="No steps yet this week" />;

  return (
    <>
      <Hero value={formatSteps(best.steps)} caption={`steps on ${dayName(best.day)}, ${dayLabel(best.day, SHORT_DATE)}`}>
        <Pill
          color={best.steps >= goal ? theme.colors.primary : theme.colors.onSurfaceVariant}
          text={
            best.steps >= goal
              ? `${formatSteps(best.steps - goal)} over your goal`
              : `${Math.round((best.steps / goal) * 100)}% of your goal`
          }
        />
      </Hero>
      <WeekChart
        series={[{ name: 'Steps', color: theme.colors.primary, data: week }]}
        goal={goal}
        highlight={week.indexOf(best)}
      />
      <Tiles
        items={[
          { label: 'Above your average', value: `+${formatSteps(best.steps - average)}`, supporting: `average ${formatSteps(average)}` },
          {
            label: 'Best of the 7 before',
            value: previousBest ? formatSteps(previousBest.steps) : '–',
            supporting: previousBest ? dayLabel(previousBest.day, { weekday: 'long' }) : 'No steps',
          },
        ]}
      />
      <SectionHeader title="Ranking" />
      <View>
        {ranked.map((d, i) => (
          <DayRow key={d.day} day={d.day} first={i === 0} lead={<Rank n={i + 1} />}>
            <Text variant="titleSmall" style={[styles.bold, styles.tabular]}>
              {formatSteps(d.steps)}
            </Text>
          </DayRow>
        ))}
      </View>
    </>
  );
}

function GoalDetail({ week, before, goal, streak }: DetailProps & { streak: number }) {
  const theme = useAppTheme();
  const hits = week.filter((d) => d.steps >= goal).length;
  const previousHits = before.filter((d) => d.steps >= goal).length;

  return (
    <>
      <Hero value={`${hits} of 7 days`} caption={`at your goal of ${formatSteps(goal)} steps`}>
        <View style={styles.pills}>
          {streak > 0 ? <Pill color={theme.colors.primary} text={`${streak}-day streak`} /> : null}
          {before.length ? (
            <Pill color={theme.colors.onSurfaceVariant} text={`${previousHits} of 7 the week before`} />
          ) : null}
        </View>
      </Hero>
      <WeekChart series={[{ name: 'Steps', color: theme.colors.primary, data: week }]} goal={goal} />
      <SectionHeader title="Each day" />
      <View>
        {[...week].reverse().map((d, i) => {
          const met = d.steps >= goal;
          return (
            <DayRow
              key={d.day}
              day={d.day}
              first={i === 0}
              trail={
                <Icon
                  source={met ? 'check-circle' : 'circle-outline'}
                  size={22}
                  color={met ? theme.colors.primary : theme.colors.outlineVariant}
                />
              }>
              <Text variant="titleSmall" style={[styles.bold, styles.tabular]}>
                {formatSteps(d.steps)}
              </Text>
              <Text variant="labelSmall" style={{ color: met ? theme.colors.primary : theme.colors.onSurfaceVariant }}>
                {met ? `${formatSteps(d.steps - goal)} over` : `${formatSteps(goal - d.steps)} short`}
              </Text>
            </DayRow>
          );
        })}
      </View>
    </>
  );
}

function Hero({ value, caption, children }: { value: string; caption: string; children?: ReactNode }) {
  const theme = useAppTheme();
  return (
    <View style={styles.hero}>
      <Text variant="displaySmall" numberOfLines={1} adjustsFontSizeToFit style={[styles.bold, { color: theme.colors.primary }]}>
        {value}
      </Text>
      <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
        {caption}
      </Text>
      {children}
    </View>
  );
}

function Pill({ color, text }: { color: string; text: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: withAlpha(color, 0.12) }]}>
      <Text variant="labelLarge" style={{ color }}>
        {text}
      </Text>
    </View>
  );
}

/** This week against the one before: primary when it's up, muted when it's down. */
function Change({ now, then }: { now: number; then: number }) {
  const theme = useAppTheme();
  if (!then) return null;
  const change = (now - then) / then;
  const up = change >= 0;
  return (
    <Pill
      color={up ? theme.colors.primary : theme.colors.onSurfaceVariant}
      text={`${up ? '+' : '−'}${Math.abs(Math.round(change * 100))}% on the 7 days before`}
    />
  );
}

type Tile = { label: string; value: string; supporting: string };

function Tiles({ items }: { items: Tile[] }) {
  const theme = useAppTheme();
  const muted = { color: theme.colors.onSurfaceVariant };
  return (
    <View style={styles.tiles}>
      {items.map((tile) => (
        <View
          key={tile.label}
          style={[styles.tile, { backgroundColor: withAlpha(theme.colors.onSurface, theme.dark ? 0.06 : 0.04) }]}>
          <Text variant="labelMedium" numberOfLines={1} style={muted}>
            {tile.label}
          </Text>
          <Text variant="titleMedium" numberOfLines={1} adjustsFontSizeToFit style={styles.bold}>
            {tile.value}
          </Text>
          <Text variant="labelSmall" numberOfLines={1} style={muted}>
            {tile.supporting}
          </Text>
        </View>
      ))}
    </View>
  );
}

type DayRowProps = { day: string; first: boolean; lead?: ReactNode; trail?: ReactNode; children: ReactNode };

/** A day in a list: optional lead, the day's name and date, its figures on the right, optional trail. */
function DayRow({ day, first, lead, trail, children }: DayRowProps) {
  const theme = useAppTheme();
  return (
    <View
      style={[
        styles.dayRow,
        !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.outlineVariant },
      ]}>
      {lead}
      <View style={styles.flex}>
        <Text variant="bodyLarge">{dayName(day)}</Text>
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          {dayLabel(day, SHORT_DATE)}
        </Text>
      </View>
      <View style={styles.end}>{children}</View>
      {trail}
    </View>
  );
}

function Rank({ n }: { n: number }) {
  const theme = useAppTheme();
  const first = n === 1;
  return (
    <View style={[styles.rank, { backgroundColor: first ? theme.colors.primary : withAlpha(theme.colors.onSurface, 0.08) }]}>
      <Text variant="labelMedium" style={[styles.bold, { color: first ? theme.colors.onPrimary : theme.colors.onSurfaceVariant }]}>
        {n}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: '700' },
  tabular: { fontVariant: ['tabular-nums'] },
  hero: { alignItems: 'flex-start', gap: 2 },
  // The hero hugs its content, so the weekly bar is stretched across it explicitly.
  barWrap: { alignSelf: 'stretch', marginTop: 8 },
  bar: { height: 6, borderRadius: 3 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginTop: 8 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { flexBasis: '47%', flexGrow: 1, gap: 2, padding: 12, borderRadius: 16 },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  end: { alignItems: 'flex-end' },
  rank: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
});
