import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon, ProgressBar, Text } from 'react-native-paper';

import { ExpandingCard, type Rect } from '@/components/expanding-card';
import { SectionHeader } from '@/components/section-header';
import { WeekChart } from '@/components/week-chart';
import { WeekdayChart, weekdayAverages } from '@/components/weekday-chart';
import { activeAverage, summarize, type DaySteps } from '@/lib/api';
import { addDays, formatSteps, shortWeekday, toDayKey } from '@/lib/dates';
import { KCAL_PER_STEP, KM_PER_STEP, STEPS_PER_MINUTE } from '@/lib/estimates';
import { useAppTheme, withAlpha } from '@/theme';

export type WeekDetailKind = 'average' | 'total' | 'best' | 'goal';

const TITLES: Record<WeekDetailKind, string> = {
  average: 'Daily average',
  total: 'Total',
  best: 'Best day',
  goal: 'Goal met',
};

const WEEKDAY_NAMES = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];
const SHORT_DATE = { month: 'short', day: 'numeric' } as const;

const dayLabel = (day: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(`${day}T12:00:00`).toLocaleDateString(undefined, opts);
const dayOfWeek = (day: string) => new Date(`${day}T12:00:00`).getDay();

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

/**
 * The history in 7-day blocks ending today, newest first, the same windows as the Today tiles.
 * Older blocks with no steps at all (before you joined) are left off.
 */
function weekBlocks(history: DaySteps[]): DaySteps[][] {
  const blocks: DaySteps[][] = [];
  for (let end = history.length; end >= 7; end -= 7) blocks.push(history.slice(end - 7, end));
  while (blocks.length > 1 && blocks[blocks.length - 1]!.every((d) => d.steps === 0)) blocks.pop();
  return blocks;
}

type Props = {
  kind: WeekDetailKind;
  /** Oldest first, ending today: the last 8 weeks. The cards look at the last 7 days against this. */
  history: DaySteps[];
  goal: number;
  streak: number;
  /** The tapped tile's place on screen, for the card to grow out of. */
  origin: Rect;
  onClose: () => void;
};

/** One of the Today tiles opened up: the story behind that one number, different for each. */
export function WeekDetail({ kind, history, goal, streak, origin, onClose }: Props) {
  const week = history.slice(-7);
  const before = history.slice(-14, -7);
  const range = week.length ? `${dayLabel(week[0].day, SHORT_DATE)} – ${dayLabel(week[week.length - 1].day, SHORT_DATE)}` : '';
  const props = { week, before, history, goal };

  return (
    <ExpandingCard origin={origin} title={TITLES[kind]} subtitle={`Last 7 days · ${range}`} onClose={onClose}>
      {kind === 'average' ? <AverageDetail {...props} /> : null}
      {kind === 'total' ? <TotalDetail {...props} /> : null}
      {kind === 'best' ? <BestDetail {...props} /> : null}
      {kind === 'goal' ? <GoalDetail {...props} streak={streak} /> : null}
    </ExpandingCard>
  );
}

type DetailProps = { week: DaySteps[]; before: DaySteps[]; history: DaySteps[]; goal: number };

/** The average, and the weekly rhythm behind it. */
function AverageDetail({ week, before, history, goal }: DetailProps) {
  const { average } = summarize(week);
  const previous = summarize(before).average;
  const walked = week.filter((d) => d.steps > 0);
  const weeks = weekBlocks(history).length;

  // Weekdays against weekends, over every day walked in the 8 weeks.
  const split = (weekend: boolean) => {
    const days = history.filter((d) => d.steps > 0 && [0, 6].includes(dayOfWeek(d.day)) === weekend);
    return activeAverage(days.reduce((s, d) => s + d.steps, 0), days.length);
  };
  const weekdays = split(false);
  const weekends = split(true);
  const byWeekday = weekdayAverages(history);
  const walkedWeekdays = byWeekday.map((avg, i) => ({ avg, i })).filter((w) => w.avg > 0);
  const quietest = walkedWeekdays.reduce<{ avg: number; i: number } | null>((q, w) => (!q || w.avg < q.avg ? w : q), null);

  return (
    <>
      <Hero
        value={formatSteps(average)}
        caption={walked.length ? `steps a day, over the ${plural(walked.length, 'day')} you walked` : 'No steps yet'}>
        <Change now={average} then={previous} />
      </Hero>
      <SectionHeader title="Your rhythm" note={`Last ${plural(weeks, 'week')}`} />
      <WeekdayChart history={history} />
      <Tiles
        items={[
          { label: 'Weekdays', value: weekdays ? formatSteps(weekdays) : '–', supporting: 'Mon to Fri, average' },
          { label: 'Weekends', value: weekends ? formatSteps(weekends) : '–', supporting: 'Sat and Sun, average' },
          {
            label: 'Quietest weekday',
            value: quietest ? WEEKDAY_NAMES[quietest.i]! : '–',
            supporting: quietest ? `avg ${formatSteps(quietest.avg)}` : 'No steps yet',
          },
          { label: 'Of your goal', value: `${Math.round((average / goal) * 100)}%`, supporting: `Goal: ${formatSteps(goal)}` },
        ]}
      />
    </>
  );
}

/** The week's total, what it adds up to, and how it compares with the weeks before. */
function TotalDetail({ week, before, history, goal }: DetailProps) {
  const theme = useAppTheme();
  const { total } = summarize(week);
  const previous = summarize(before).total;
  const weekly = goal * 7;
  const blocks = weekBlocks(history);
  const totals = blocks.map((b) => summarize(b).total);
  const scale = Math.max(weekly, ...totals, 1);

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
      <SectionHeader title="That's about" />
      <Tiles
        items={[
          { label: 'Distance', value: `${(total * KM_PER_STEP).toFixed(1)} km`, supporting: 'estimated' },
          { label: 'Walking time', value: walkingTime(total / STEPS_PER_MINUTE), supporting: 'at an easy pace' },
          { label: 'Calories', value: `~${formatSteps(total * KCAL_PER_STEP)}`, supporting: 'kcal, estimated' },
          total >= weekly
            ? { label: 'Weekly goal', value: 'Met', supporting: `${formatSteps(total - weekly)} over` }
            : { label: 'Weekly goal', value: formatSteps(weekly - total), supporting: 'steps to go' },
        ]}
      />
      {blocks.length > 1 ? (
        <>
          <SectionHeader title="Week by week" note={`Goal ${formatSteps(weekly)}`} />
          <View style={styles.weeks}>
            {blocks.map((block, i) => (
              <WeekBar
                key={block[0]!.day}
                label={i === 0 ? 'Last 7 days' : `${dayLabel(block[0]!.day, SHORT_DATE)} – ${dayLabel(block[6]!.day, SHORT_DATE)}`}
                total={totals[i]!}
                share={totals[i]! / scale}
                goalAt={weekly / scale}
                current={i === 0}
                met={totals[i]! >= weekly}
              />
            ))}
          </View>
        </>
      ) : null}
    </>
  );
}

/** One week's total as a bar, with a tick where the weekly goal sits. */
function WeekBar(props: { label: string; total: number; share: number; goalAt: number; current: boolean; met: boolean }) {
  const theme = useAppTheme();
  const { label, total, share, goalAt, current, met } = props;
  const fill = current ? theme.colors.primary : met ? withAlpha(theme.colors.primary, 0.55) : theme.colors.secondaryContainer;
  return (
    <View style={styles.weekRow} accessibilityLabel={`${label}: ${formatSteps(total)} steps${met ? ', weekly goal met' : ''}`}>
      <View style={styles.weekLabels}>
        <Text variant="bodySmall" numberOfLines={1} style={[current && styles.bold, { color: current ? theme.colors.onSurface : theme.colors.onSurfaceVariant }]}>
          {label}
        </Text>
        <Text variant="labelLarge" style={[styles.bold, styles.tabular]}>
          {total ? formatSteps(total) : '–'}
        </Text>
      </View>
      <View style={[styles.weekTrack, { backgroundColor: withAlpha(theme.colors.onSurface, 0.06) }]}>
        <View style={[styles.weekFill, { width: `${Math.max(share * 100, total ? 2 : 0)}%`, backgroundColor: fill }]} />
        <View style={[styles.goalTick, { left: `${goalAt * 100}%`, backgroundColor: theme.colors.onSurfaceVariant }]} />
      </View>
    </View>
  );
}

/** The best day, the week around it, and how it ranks. */
function BestDetail({ week, history, goal }: DetailProps) {
  const theme = useAppTheme();
  const ranked = week.filter((d) => d.steps > 0).sort((a, b) => b.steps - a.steps);
  const best = ranked[0];
  const { average } = summarize(week);
  const longBest = history.reduce<DaySteps | null>((b, d) => (d.steps > 0 && (!b || d.steps > b.steps) ? d : b), null);
  const weeks = weekBlocks(history).length;

  if (!best) return <Hero value="–" caption="No steps yet this week" />;

  return (
    <>
      <Hero value={formatSteps(best.steps)} caption={`steps on ${dayName(best.day)}, ${dayLabel(best.day, SHORT_DATE)}`}>
        <View style={styles.pills}>
          <Pill
            color={best.steps >= goal ? theme.colors.primary : theme.colors.onSurfaceVariant}
            text={
              best.steps >= goal
                ? `${formatSteps(best.steps - goal)} over your goal`
                : `${Math.round((best.steps / goal) * 100)}% of your goal`
            }
          />
          {longBest && longBest.day === best.day && weeks > 1 ? (
            <Pill color={theme.colors.primary} text={`Best in ${plural(weeks, 'week')}`} />
          ) : null}
        </View>
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
            label: `Best in ${plural(weeks, 'week')}`,
            value: longBest ? formatSteps(longBest.steps) : '–',
            supporting: longBest ? `${dayLabel(longBest.day, { weekday: 'short' })}, ${dayLabel(longBest.day, SHORT_DATE)}` : 'No steps',
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

/** Goal days this week, and the run of them over the last 8 weeks. */
function GoalDetail({ week, before, history, goal, streak }: DetailProps & { streak: number }) {
  const theme = useAppTheme();
  const hits = week.filter((d) => d.steps >= goal).length;
  const previousHits = before.filter((d) => d.steps >= goal).length;
  const blocks = weekBlocks(history);
  const span = blocks.flat();
  const spanHits = span.filter((d) => d.steps >= goal).length;
  // The nearest this week came to the goal without reaching it.
  const miss = week
    .filter((d) => d.steps > 0 && d.steps < goal)
    .reduce<DaySteps | null>((m, d) => (!m || d.steps > m.steps ? d : m), null);

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
      {blocks.length > 1 ? (
        <>
          <SectionHeader title="Goal days" note={`Last ${plural(blocks.length, 'week')}`} />
          <GoalCalendar blocks={blocks} goal={goal} />
        </>
      ) : null}
      <Tiles
        items={[
          {
            label: 'Hit rate',
            value: span.length ? `${Math.round((spanHits / span.length) * 100)}%` : '–',
            supporting: `${spanHits} of ${span.length} days`,
          },
          {
            label: 'Closest miss',
            value: miss ? `${formatSteps(goal - miss.steps)} short` : hits ? 'None' : '–',
            supporting: miss ? dayName(miss.day) : hits ? 'every walk made it' : 'No steps yet',
          },
        ]}
      />
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

/** A dot for every day of the last few weeks, oldest at the top: filled where the goal was met. */
function GoalCalendar({ blocks, goal }: { blocks: DaySteps[][]; goal: number }) {
  const theme = useAppTheme();
  const rows = [...blocks].reverse();
  const today = toDayKey(new Date());
  const legend = [
    { label: 'Goal met', style: { backgroundColor: theme.colors.primary } },
    { label: 'Walked', style: { backgroundColor: withAlpha(theme.colors.primary, 0.22) } },
    { label: 'No steps', style: { borderWidth: 1.5, borderColor: theme.colors.outlineVariant } },
  ];

  return (
    <View style={styles.calendar}>
      <View style={styles.calRow}>
        {rows[rows.length - 1]!.map((d) => (
          <Text key={d.day} variant="labelSmall" style={[styles.calCell, { color: theme.colors.onSurfaceVariant }]}>
            {shortWeekday(new Date(`${d.day}T12:00:00`))}
          </Text>
        ))}
      </View>
      {rows.map((block) => (
        <View key={block[0]!.day} style={styles.calRow}>
          {block.map((d) => {
            const met = d.steps >= goal;
            return (
              <View key={d.day} style={styles.calCell}>
                <View
                  accessibilityLabel={`${dayLabel(d.day, SHORT_DATE)}: ${formatSteps(d.steps)} steps${met ? ', goal met' : ''}`}
                  style={[
                    styles.dot,
                    met
                      ? { backgroundColor: theme.colors.primary }
                      : d.steps > 0
                        ? { backgroundColor: withAlpha(theme.colors.primary, 0.22) }
                        : { borderWidth: 1.5, borderColor: theme.colors.outlineVariant },
                    d.day === today && { outlineWidth: 2, outlineOffset: 2, outlineColor: theme.colors.onSurface, outlineStyle: 'solid' },
                  ]}
                />
              </View>
            );
          })}
        </View>
      ))}
      <View style={styles.legend}>
        {legend.map((l) => (
          <View key={l.label} style={styles.legendItem}>
            <View style={[styles.legendDot, l.style]} />
            <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {l.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
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
  weeks: { gap: 12 },
  weekRow: { gap: 6 },
  weekLabels: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  weekTrack: { height: 10, borderRadius: 5, overflow: 'visible' },
  weekFill: { height: 10, borderRadius: 5 },
  goalTick: { position: 'absolute', top: -3, width: 2, height: 16, borderRadius: 1, marginLeft: -1 },
  calendar: { gap: 8 },
  calRow: { flexDirection: 'row' },
  calCell: { flex: 1, alignItems: 'center', textAlign: 'center' },
  dot: { width: 22, height: 22, borderRadius: 11 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, paddingTop: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
});
