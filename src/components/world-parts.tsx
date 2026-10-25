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
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Button } from '@/components/button';
import { usePressed } from '@/hooks/use-pressed';
import type { World } from '@/lib/api';
import {
  choiceLevel,
  describeUnlock,
  LEVELS,
  MAX_LEVEL,
  stageOf,
  unlockAt,
  type Choice,
  type Slot,
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
  onPick,
}: {
  slot: Slot;
  level: number;
  selected: string | undefined;
  onPick: (choice: string) => void;
}) {
  return (
    <View style={styles.chips}>
      {slot.choices.map((choice) => {
        const unlocksAt = choiceLevel(slot, choice);
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

/** Every milestone with what it brings: the ones reached ticked, the next one ringed. */
export function MilestoneList({ def, level }: { def: WorldDef; level: number }) {
  const theme = useAppTheme();
  const [expanded, setExpanded] = useState(false);
  const all = Array.from({ length: MAX_LEVEL }, (_, i) => i + 1);
  const from = Math.max(1, Math.min(level - COLLAPSED_BEFORE, MAX_LEVEL - COLLAPSED_BEFORE - COLLAPSED_AFTER));
  const folded = (l: number) => l >= from && l <= from + COLLAPSED_BEFORE + COLLAPSED_AFTER;
  const shown = expanded ? all : all.filter(folded);

  return (
    <Card mode="contained" style={glassCard(theme)}>
      <Card.Content style={styles.milestones}>
        {shown.map((l) => {
          const reached = l <= level;
          const next = l === level + 1;
          const unlock = unlockAt(def, l);
          return (
            <Animated.View key={l} entering={folded(l) ? undefined : FadeIn.duration(180)} style={styles.milestone}>
              <View
                style={[
                  styles.dot,
                  reached
                    ? { backgroundColor: theme.colors.primary }
                    : { borderWidth: 2, borderColor: next ? theme.colors.primary : theme.colors.outlineVariant },
                ]}>
                {reached ? (
                  <Icon source="check" size={14} color={theme.colors.onPrimary} />
                ) : next ? null : (
                  <Icon source="lock-outline" size={12} color={theme.colors.onSurfaceVariant} />
                )}
              </View>
              <View style={styles.flex}>
                <Text
                  variant="titleSmall"
                  style={[styles.bold, !reached && !next && { color: theme.colors.onSurfaceVariant }]}>
                  {shortSteps(unlock.steps)} steps
                </Text>
                <Text variant="bodySmall" numberOfLines={2} style={{ color: theme.colors.onSurfaceVariant }}>
                  {describeUnlock(unlock)}
                </Text>
              </View>
            </Animated.View>
          );
        })}
        <Button
          icon={expanded ? 'chevron-up' : 'chevron-down'}
          compact
          onPress={() => setExpanded(!expanded)}
          style={styles.showAll}>
          {expanded ? 'Show less' : `Show all ${MAX_LEVEL}`}
        </Button>
      </Card.Content>
    </Card>
  );
}

// ---------- Celebrating ----------

/** The most milestones whose new options the card asks about at once; older ones are just counted. */
const ASK_ABOUT = 3;

/**
 * Shown when there are milestones you haven't seen (your starting choices are made when you adopt,
 * so it starts from the first): how your pet grew and what unlocked, with the new options to pick
 * from right there. Slides in on arrival; on Done it folds away, and the cards below slide up.
 */
export function CelebrationCard({
  def,
  world,
  level,
  onPick,
  onDone,
}: {
  def: WorldDef;
  world: World;
  level: number;
  onPick: (slot: string, choice: string) => void;
  onDone: () => void;
}) {
  const theme = useAppTheme();
  const first = Math.max(1, world.celebrated);
  const unlocks = Array.from({ length: level - first + 1 }, (_, i) => unlockAt(def, first + i));
  const asked = unlocks.slice(-ASK_ABOUT);
  const slots = [...new Set([...asked.flatMap((u) => u.slots), ...asked.flatMap((u) => u.choices.map((c) => c.slot))])];
  const grew = unlocks.filter((u) => u.grows);
  const earlier = unlocks.length - asked.length;

  // In: fade and rise. Out: fade while the height folds to nothing.
  const shown = useSharedValue(0);
  const fold = useSharedValue(1);
  const [height, setHeight] = useState(0);
  useEffect(() => {
    shown.set(withTiming(1, { duration: 300, easing: STANDARD }));
  }, [shown]);
  const animated = useAnimatedStyle(() => ({
    opacity: shown.get() * fold.get(),
    transform: [{ translateY: (1 - shown.get()) * 12 }],
    ...(fold.get() < 1 && height ? { height: height * fold.get(), overflow: 'hidden' as const } : null),
  }));

  function done() {
    fold.set(
      withTiming(0, { duration: 250, easing: STANDARD }, (finished) => {
        if (finished) scheduleOnRN(onDone);
      })
    );
  }

  return (
    <Animated.View style={animated} onLayout={(e) => fold.get() === 1 && setHeight(e.nativeEvent.layout.height)}>
      <Card mode="contained" style={[glassCard(theme), styles.celebration, { borderColor: theme.colors.primary }]}>
        <Card.Content style={styles.celebrationBody}>
          <Text variant="titleLarge" style={styles.bold}>
            {unlocks.length === 1 ? `🎉 ${shortSteps(LEVELS[level]!)} steps!` : `🎉 ${unlocks.length} new milestones!`}
          </Text>
          {grew.length ? (
            <Text variant="bodyLarge">
              It grew! Now it&apos;s <Text style={styles.bold}>{grew[grew.length - 1]!.grows!.toLowerCase()}</Text>.
            </Text>
          ) : null}
          {earlier > 0 ? (
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              Plus {earlier} earlier {earlier === 1 ? 'milestone' : 'milestones'}, all in Customize.
            </Text>
          ) : null}
          {slots.map((slot) => (
            <View key={slot.id} style={styles.slot}>
              <Text variant="titleSmall" style={styles.bold}>
                {slot.title}
              </Text>
              <ChoiceChips
                slot={slot}
                level={level}
                selected={picksFor(world, slot)}
                onPick={(c) => onPick(slot.id, c)}
              />
            </View>
          ))}
          <Button mode="contained" onPress={done} style={styles.done}>
            Lovely
          </Button>
        </Card.Content>
      </Card>
    </Animated.View>
  );
}

/** The chosen option for a slot, or its default. */
function picksFor(world: World, slot: Slot): string {
  return world.picks[world.kind]?.[slot.id] ?? slot.choices[0]!.id;
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
  milestones: { gap: 14 },
  milestone: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  showAll: { alignSelf: 'center' },
  celebration: { borderWidth: 2 },
  celebrationBody: { gap: 12 },
  slot: { gap: 8 },
  done: { alignSelf: 'flex-end' },
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
