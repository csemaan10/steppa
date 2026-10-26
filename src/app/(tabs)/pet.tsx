import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { ActivityIndicator, Appbar, Card, Text } from 'react-native-paper';
import Animated from 'react-native-reanimated';

import { Button } from '@/components/button';
import { useTabBarSpace } from '@/components/floating-tab-bar';
import { GlassAction } from '@/components/glass-action';
import { ProgressBar } from '@/components/journey-parts';
import { PetCreator } from '@/components/pet-creator';
import { usePetPlay } from '@/components/pet-play';
import { SectionHeader } from '@/components/section-header';
import { CelebrationCard, MilestoneList, shortSteps, StageBadge, worldTitle } from '@/components/world-parts';
import { WorldScene } from '@/components/world-scene';
import { useCountUp } from '@/hooks/use-count-up';
import { useKeyboardSpace } from '@/hooks/use-keyboard-space';
import { useLoader } from '@/hooks/use-loader';
import { useScreenFocused } from '@/hooks/use-screen-focused';
import { useWorldEditor } from '@/hooks/use-world-editor';
import { getStepHistory, getWorld, startWorld, syncSteps, updateWorld, type World } from '@/lib/api';
import { formatSteps } from '@/lib/dates';
import { timeOfDay } from '@/lib/scene-art';
import {
  describeUnlock,
  drawWorld,
  levelOf,
  levelProgress,
  MAX_LEVEL,
  unlockAt,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  WORLDS,
  type KindPicks,
} from '@/lib/world';
import { useUserId } from '@/providers/auth-provider';
import { glassCard, screenBackground, transparentHeader, useAppTheme } from '@/theme';

/** The scene never takes more than this share of the screen's height, so there's room below it. */
const SCENE_SHARE = 0.42;

export default function PetScreen() {
  const theme = useAppTheme();
  const userId = useUserId();
  const tabBarSpace = useTabBarSpace();
  const focused = useScreenFocused();
  const { width, height } = useWindowDimensions();
  const [busy, setBusy] = useState(false);
  // The name field (adopting) scrolls above the keyboard.
  const keyboardSpace = useKeyboardSpace();
  const sceneWidth = Math.min(width - 32, Math.round((height * SCENE_SHARE * WORLD_WIDTH) / WORLD_HEIGHT));

  const { data, error, reload } = useLoader(async () => {
    // Catch up on today's steps first; a failed read still shows what's saved.
    await syncSteps(userId, 2).catch(() => {});
    const [status, history] = await Promise.all([getWorld(userId), getStepHistory(userId, 14)]);
    return { status, history };
  }, userId);
  const editor = useWorldEditor(userId, data?.status?.world ?? null);
  // A row left from testing the worlds that were dropped counts as no pet yet.
  const world = editor.world && WORLDS[editor.world.kind] ? editor.world : null;
  const steps = data?.status?.steps ?? 0;

  const [refreshing, setRefreshing] = useState(false);
  async function pullToRefresh() {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }

  // Typical steps on days you walk, over the last two weeks, for "about N days to go".
  const active = data?.history.filter((d) => d.steps > 0) ?? [];
  const pace = active.length ? active.reduce((sum, d) => sum + d.steps, 0) / active.length : 0;

  async function adopt(picks: KindPicks) {
    setBusy(true);
    try {
      const saved = { pet: picks };
      if (editor.world) await updateWorld(userId, { kind: 'pet', picks: saved, celebrated: 1 });
      else await startWorld(userId, 'pet', saved);
      await reload();
    } catch (e) {
      Alert.alert('Something went wrong', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const title = !data ? 'Pet' : world ? worldTitle(WORLDS[world.kind], world.picks[world.kind]?.name) : 'Adopt a pet';

  return (
    <View style={[styles.flex, screenBackground(theme)]}>
      <Appbar.Header mode="small" style={transparentHeader}>
        <Appbar.Content title={title} />
        {world ? (
          <GlassAction
            icon="palette-outline"
            onPress={() => router.push('/customize')}
            accessibilityLabel="Customize"
          />
        ) : null}
      </Appbar.Header>

      {!data ? (
        <View style={styles.center}>
          {error ? <Text style={[styles.message, { color: theme.colors.error }]}>{error}</Text> : <ActivityIndicator />}
        </View>
      ) : (
        <Animated.View style={[styles.flex, keyboardSpace]}>
          <ScrollView
            automaticallyAdjustKeyboardInsets
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[styles.content, { paddingBottom: tabBarSpace }]}
            refreshControl={world ? <RefreshControl refreshing={refreshing} onRefresh={pullToRefresh} /> : undefined}>
            {world ? (
              <PetHome
                world={world}
                steps={steps}
                pace={pace}
                sceneWidth={sceneWidth}
                animate={focused}
                editor={editor}
              />
            ) : (
              <PetCreator sceneWidth={sceneWidth} animate={focused} busy={busy} onAdopt={adopt} />
            )}
          </ScrollView>
        </Animated.View>
      )}
    </View>
  );
}

function PetHome({
  world,
  steps,
  pace,
  sceneWidth,
  animate,
  editor,
}: {
  world: World;
  steps: number;
  pace: number;
  sceneWidth: number;
  animate: boolean;
  editor: ReturnType<typeof useWorldEditor>;
}) {
  const theme = useAppTheme();
  const def = WORLDS[world.kind];
  const level = levelOf(steps);
  const saved = world.picks[world.kind];
  const time = timeOfDay();
  const art = drawWorld(world.kind, steps, saved, time);
  const play = usePetPlay(art.pet);
  const shownSteps = useCountUp(steps, 1200);
  const muted = { color: theme.colors.onSurfaceVariant };

  const next = level < MAX_LEVEL ? unlockAt(def, level + 1) : null;
  const toGo = next ? next.steps - steps : 0;
  const days = next && pace > 0 ? Math.ceil(toGo / pace) : null;
  const since = new Date(`${world.started_on}T00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  return (
    <>
      <View style={styles.scene}>
        <WorldScene
          art={art}
          width={sceneWidth}
          animate={animate}
          version={`${level}:${time}:${JSON.stringify(saved ?? {})}`}
          play={play}
          radius={24}
        />
        <StageBadge def={def} level={level} />
      </View>

      <View style={[styles.actions, { width: sceneWidth }]}>
        <Button mode="contained-tonal" icon="hand-heart" compact onPress={play.stroke} style={styles.action}>
          Pet
        </Button>
        <Button mode="contained-tonal" icon="cookie" compact onPress={play.treat} style={styles.action}>
          Treat
        </Button>
        <Button mode="contained-tonal" icon="tennis-ball" compact onPress={play.play} style={styles.action}>
          Play
        </Button>
      </View>
      <Text variant="labelMedium" style={[styles.hint, muted]}>
        Tap your pet, or hold to pet it
      </Text>

      {world.celebrated <= level && level > 0 ? (
        <CelebrationCard
          key={world.celebrated}
          def={def}
          world={world}
          level={level}
          onPick={editor.pick}
          onDone={() => editor.celebrate(level)}
        />
      ) : null}

      <Card mode="contained" style={glassCard(theme)}>
        <Card.Content style={styles.stats}>
          <View>
            <Text variant="displaySmall" style={styles.bold}>
              {formatSteps(shownSteps)}
            </Text>
            <Text variant="bodyMedium" style={muted}>
              steps walked together since {since}
            </Text>
          </View>
          {next ? (
            <View style={styles.next}>
              <View style={styles.nextRow}>
                <Text variant="titleSmall" style={styles.bold}>
                  Next: {shortSteps(next.steps)}
                </Text>
                <Text variant="labelLarge" style={muted}>
                  {formatSteps(toGo)} to go
                </Text>
              </View>
              <ProgressBar fraction={levelProgress(steps)} />
              <Text variant="bodySmall" numberOfLines={2} style={muted}>
                {describeUnlock(next)}
                {days ? ` · ${aboutDays(days)} at your pace` : ''}
              </Text>
            </View>
          ) : (
            <Text variant="bodyLarge">Fully grown, every last milestone! Every step still counts.</Text>
          )}
        </Card.Content>
      </Card>

      <SectionHeader title="Milestones" note={`${level} of ${MAX_LEVEL}`} />
      <MilestoneList def={def} level={level} />
    </>
  );
}

/** "about 5 days", "about 3 weeks", "about 4 months". */
function aboutDays(days: number): string {
  if (days <= 1) return 'about a day';
  if (days < 14) return `about ${days} days`;
  if (days < 60) return `about ${Math.round(days / 7)} weeks`;
  if (days < 730) return `about ${Math.round(days / 30)} months`;
  return `about ${Math.round(days / 365)} years`;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  message: { textAlign: 'center' },
  content: { padding: 16, gap: 12 },
  scene: { alignSelf: 'center' },
  actions: { alignSelf: 'center', flexDirection: 'row', gap: 8 },
  action: { flex: 1 },
  hint: { textAlign: 'center', marginTop: -4 },
  bold: { fontWeight: '700' },
  stats: { gap: 16 },
  next: { gap: 8 },
  nextRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
});
