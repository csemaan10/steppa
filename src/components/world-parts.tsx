import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Card, Icon, Text } from 'react-native-paper';
import Animated, {
  Easing,
  FadeIn,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Button } from '@/components/button';
import { usePressed } from '@/hooks/use-pressed';
import {
  choiceLevel,
  LEVELS,
  MAX_LEVEL,
  stageOf,
  unlockAt,
  type Choice,
  type Slot,
  type Unlock,
  type WorldDef,
} from '@/lib/world';
import { glass, glassCard, useAppTheme, withAlpha } from '@/theme';

/** Material's standard easing, for things appearing and leaving. */
const STANDARD = Easing.bezier(0.2, 0, 0, 1);

/** 10K, 250K, 1.5M. */
export function shortSteps(steps: number): string {
  if (steps >= 1_000_000) return `${+(steps / 1_000_000).toFixed(1)}M`;
  if (steps >= 1_000) return `${Math.round(steps / 1_000)}K`;
  return String(steps);
}

/** What someone's world is called: its name, or "Your garden". */
export function worldTitle(def: WorldDef, name: string | undefined): string {
  return name || `Your ${def.title.toLowerCase()}`;
}

// ---------- Choices ----------

/** A slot's options as chips; ones that unlock later show a lock and when. */
export function ChoiceChips({
  slot,
  level,
  selected,
  owned,
  onPick,
}: {
  slot: Slot;
  level: number;
  selected: string | undefined;
  /** Things bought in the shop: only these of the slot's shop choices show. */
  owned?: ReadonlySet<string>;
  onPick: (choice: string) => void;
}) {
  return (
    <View style={styles.chips}>
      {slot.choices.filter((c) => !c.shop || owned?.has(c.id)).map((choice) => {
        const unlocksAt = choice.shop ? 0 : choiceLevel(slot, choice);
        return (
          <ChoiceChip
            key={choice.id}
            choice={choice}
            selected={choice.id === selected}
            lockedUntil={unlocksAt > level ? LEVELS[unlocksAt]! : null}
            onPress={() => onPick(choice.id)}
          />
        );
      })}
    </View>
  );
}

function ChoiceChip({
  choice,
  selected,
  lockedUntil,
  onPress,
}: {
  choice: Choice;
  selected: boolean;
  lockedUntil: number | null;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  const { pressed, onPressIn, onPressOut } = usePressed();
  const on = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    on.set(withTiming(selected ? 1 : 0, { duration: 150, easing: STANDARD }));
  }, [on, selected]);

  // Worked out here: plain functions like withAlpha can't be called from the UI thread.
  const fill = theme.colors.secondaryContainer;
  const clear = withAlpha(fill, 0);
  const border = theme.colors.outlineVariant;
  const animated = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(on.get(), [0, 1], [clear, fill]),
    borderColor: interpolateColor(on.get(), [0, 1], [border, fill]),
    transform: [{ scale: interpolate(pressed.get(), [0, 1], [1, 0.95]) }],
  }));
  const locked = lockedUntil !== null;
  const color = selected ? theme.colors.onSecondaryContainer : theme.colors.onSurface;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={locked || selected}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled: locked }}
      accessibilityLabel={locked ? `${choice.label}, unlocks at ${shortSteps(lockedUntil)} steps` : choice.label}>
      <Animated.View style={[styles.chip, locked && styles.locked, animated]}>
        {choice.color ? (
          <View style={[styles.swatch, { backgroundColor: choice.color, borderColor: theme.colors.outline }]} />
        ) : choice.emoji ? (
          <Text style={styles.emoji}>{choice.emoji}</Text>
        ) : null}
        <Text variant="labelLarge" style={{ color }}>
          {choice.label}
        </Text>
        {locked ? (
          <>
            <Icon source="lock" size={14} color={theme.colors.onSurfaceVariant} />
            <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {shortSteps(lockedUntil)}
            </Text>
          </>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

// ---------- Milestones ----------

const COLLAPSED_BEFORE = 1;
const COLLAPSED_AFTER = 3;
const NODE = 34;

/**
 * Every milestone as a road of levels: the ones reached filled in, the next one pulsing, and what
 * each brings beside it as little reward chips. In a card of its own, or `bare` to sit inside another.
 */
export function MilestoneList({ def, level, bare }: { def: WorldDef; level: number; bare?: boolean }) {
  const theme = useAppTheme();
  const [expanded, setExpanded] = useState(false);
  const all = Array.from({ length: MAX_LEVEL }, (_, i) => i + 1);
  const from = Math.max(1, Math.min(level - COLLAPSED_BEFORE, MAX_LEVEL - COLLAPSED_BEFORE - COLLAPSED_AFTER));
  const folded = (l: number) => l >= from && l <= from + COLLAPSED_BEFORE + COLLAPSED_AFTER;
  const shown = expanded ? all : all.filter(folded);

  const road = (
    <>
      {shown.map((l, i) => (
        <MilestoneStop
          key={l}
          level={l}
          state={l <= level ? 'reached' : l === level + 1 ? 'next' : 'locked'}
          unlock={unlockAt(def, l)}
          railAbove={i > 0}
          railBelow={i < shown.length - 1}
          nextReached={l + 1 <= level}
          appear={!folded(l)}
        />
      ))}
      <Button
        icon={expanded ? 'chevron-up' : 'chevron-down'}
        compact
        onPress={() => setExpanded(!expanded)}
        style={styles.showAll}>
        {expanded ? 'Show less' : `Show all ${MAX_LEVEL}`}
      </Button>
    </>
  );
  if (bare) return <View style={styles.road}>{road}</View>;
  return (
    <Card mode="contained" style={glassCard(theme)}>
      <Card.Content style={styles.road}>{road}</Card.Content>
    </Card>
  );
}

function MilestoneStop({
  level,
  state,
  unlock,
  railAbove,
  railBelow,
  nextReached,
  appear,
}: {
  level: number;
  state: 'reached' | 'next' | 'locked';
  unlock: Unlock;
  railAbove: boolean;
  railBelow: boolean;
  /** Whether the milestone after this one is reached too, so the rail on to it is filled. */
  nextReached: boolean;
  /** Fades in when the list is expanded. */
  appear: boolean;
}) {
  const theme = useAppTheme();
  const reached = state === 'reached';
  const lit = theme.colors.primary;
  const unlit = withAlpha(theme.colors.onSurface, 0.12);
  const muted = theme.colors.onSurfaceVariant;
  const chips = [
    ...(unlock.grows ? [{ key: 'grow', text: unlock.grows, emoji: '🌱', color: undefined }] : []),
    ...unlock.slots.map((s) => ({ key: `s-${s.id}`, text: s.title, emoji: s.choices[0]?.emoji, color: s.choices[0]?.color })),
    ...unlock.choices.flatMap((c) =>
      c.choices.map((choice) => ({ key: `c-${c.slot.id}-${choice.id}`, text: choice.label, emoji: choice.emoji, color: choice.color }))
    ),
  ];

  return (
    <Animated.View entering={appear ? FadeIn.duration(180) : undefined} style={styles.stop}>
      <View style={styles.rail}>
        <View style={[styles.segment, { backgroundColor: railAbove ? (reached ? lit : unlit) : 'transparent' }]} />
        <LevelNode level={level} state={state} />
        <View style={[styles.segment, { backgroundColor: railBelow ? (nextReached ? lit : unlit) : 'transparent' }]} />
      </View>
      <View style={[styles.stopBody, state === 'locked' && styles.faded]}>
        <Text style={[styles.stopTitle, { color: state === 'locked' ? muted : theme.colors.onSurface }]}>
          {shortSteps(unlock.steps)} steps
        </Text>
        <View style={styles.rewards}>
          {chips.map((chip) => (
            <View key={chip.key} style={[styles.reward, { backgroundColor: withAlpha(theme.colors.onSurface, 0.06) }]}>
              {chip.color ? (
                <View style={[styles.rewardSwatch, { backgroundColor: chip.color }]} />
              ) : chip.emoji ? (
                <Text style={styles.rewardEmoji}>{chip.emoji}</Text>
              ) : null}
              <Text style={[styles.rewardText, { color: theme.colors.onSurface }]}>{chip.text}</Text>
            </View>
          ))}
        </View>
      </View>
    </Animated.View>
  );
}

/** A level on the road: filled once reached, ringed and pulsing when it's next, locked after that. */
function LevelNode({ level, state }: { level: number; state: 'reached' | 'next' | 'locked' }) {
  const theme = useAppTheme();
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (state !== 'next') return;
    pulse.set(withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }), -1, false));
  }, [pulse, state]);
  const ring = useAnimatedStyle(() => ({ opacity: 0.45 * (1 - pulse.value), transform: [{ scale: 1 + pulse.value * 0.7 }] }));

  if (state === 'locked') {
    return (
      <View style={[styles.node, { backgroundColor: withAlpha(theme.colors.onSurface, 0.07) }]}>
        <Icon source="lock" size={14} color={theme.colors.onSurfaceVariant} />
      </View>
    );
  }
  const reached = state === 'reached';
  return (
    <View style={styles.nodeBox}>
      {reached ? null : <Animated.View style={[styles.node, styles.pulse, { backgroundColor: theme.colors.primary }, ring]} />}
      <View
        style={[
          styles.node,
          reached
            ? { backgroundColor: theme.colors.primary, borderBottomWidth: 3, borderBottomColor: 'rgba(0, 0, 0, 0.25)' }
            : { backgroundColor: theme.colors.surface, borderWidth: 3, borderColor: theme.colors.primary },
        ]}>
        <Text style={[styles.nodeText, { color: reached ? theme.colors.onPrimary : theme.colors.primary }]}>{level}</Text>
      </View>
    </View>
  );
}

/** Stage and level, in a pill over the bottom of the scene. */
export function StageBadge({ def, level }: { def: WorldDef; level: number }) {
  const theme = useAppTheme();
  return (
    <View style={[glass(theme, 'strong'), styles.badge]}>
      <Text variant="labelLarge" style={styles.bold}>
        {def.stages[stageOf(level)]}
      </Text>
      <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
        Level {level}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  bold: { fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1,
  },
  locked: { opacity: 0.6 },
  swatch: { width: 16, height: 16, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth },
  emoji: { fontSize: 15 },
  road: { paddingVertical: 8 },
  stop: { flexDirection: 'row', gap: 12, minHeight: 64 },
  rail: { width: NODE, alignItems: 'center' },
  // Square ends, so the rail runs on unbroken from one row into the next.
  segment: { flex: 1, width: 4, minHeight: 6 },
  nodeBox: { width: NODE, height: NODE },
  node: { width: NODE, height: NODE, borderRadius: NODE / 2, alignItems: 'center', justifyContent: 'center' },
  pulse: { position: 'absolute' },
  nodeText: { fontSize: 14, fontWeight: '900' },
  stopBody: { flex: 1, justifyContent: 'center', gap: 6, paddingVertical: 10 },
  faded: { opacity: 0.6 },
  stopTitle: { fontSize: 15, fontWeight: '900' },
  rewards: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  reward: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  rewardEmoji: { fontSize: 12, lineHeight: 15 },
  rewardSwatch: { width: 11, height: 11, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)' },
  rewardText: { fontSize: 11, fontWeight: '700' },
  showAll: { alignSelf: 'center', marginTop: 8 },
  badge: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
  },
});
