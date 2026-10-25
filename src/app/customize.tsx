import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { ActivityIndicator, Appbar, Card, Icon, Text, TextInput } from 'react-native-paper';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassBackAction } from '@/components/glass-action';
import { usePetPlay } from '@/components/pet-play';
import { SectionHeader } from '@/components/section-header';
import { ChoiceChips, shortSteps } from '@/components/world-parts';
import { WorldScene } from '@/components/world-scene';
import { useKeyboardSpace } from '@/hooks/use-keyboard-space';
import { useLoader } from '@/hooks/use-loader';
import { useWorldEditor } from '@/hooks/use-world-editor';
import { getWorld, type World } from '@/lib/api';
import { timeOfDay } from '@/lib/scene-art';
import { drawWorld, LEVELS, levelOf, NAME_LENGTH, resolvePicks, WORLD_HEIGHT, WORLD_WIDTH, WORLDS } from '@/lib/world';
import { useUserId } from '@/providers/auth-provider';
import { glassCard, screenBackground, transparentHeader, useAppTheme } from '@/theme';

/** The scene stays pinned above the options, taking at most this share of the screen's height. */
const SCENE_SHARE = 0.32;

/** Everything you've unlocked for your world, with the scene above showing each choice as you make it. */
export default function CustomizeScreen() {
  const theme = useAppTheme();
  const userId = useUserId();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { data, error } = useLoader(() => getWorld(userId), userId);
  const editor = useWorldEditor(userId, data?.world ?? null);
  // Only a pet can be customised (a row left from testing the dropped worlds can't).
  const world = editor.world && WORLDS[editor.world.kind] ? editor.world : null;
  const sceneWidth = Math.min(width - 32, Math.round((height * SCENE_SHARE * WORLD_WIDTH) / WORLD_HEIGHT));

  return (
    <View style={[styles.flex, screenBackground(theme)]}>
      <Appbar.Header style={transparentHeader}>
        <GlassBackAction onPress={() => router.back()} />
        <Appbar.Content title="Customize" />
      </Appbar.Header>

      {!data || !world ? (
        <View style={styles.center}>
          {error ? (
            <Text style={{ color: theme.colors.error }}>{error}</Text>
          ) : data !== undefined ? (
            <Text style={{ color: theme.colors.onSurfaceVariant }}>Adopt a pet first.</Text>
          ) : (
            <ActivityIndicator />
          )}
        </View>
      ) : (
        <Options world={world} steps={data.steps} sceneWidth={sceneWidth} bottom={insets.bottom} editor={editor} />
      )}
    </View>
  );
}

function Options({
  world,
  steps,
  sceneWidth,
  bottom,
  editor,
}: {
  world: World;
  steps: number;
  sceneWidth: number;
  bottom: number;
  editor: ReturnType<typeof useWorldEditor>;
}) {
  const theme = useAppTheme();
  const def = WORLDS[world.kind];
  const level = levelOf(steps);
  const saved = world.picks[world.kind];
  const picks = resolvePicks(def, level, saved);
  const time = timeOfDay();
  const art = drawWorld(world.kind, steps, saved, time);
  const play = usePetPlay(art.pet);
  const [name, setName] = useState(saved?.name ?? '');
  const unlocked = def.slots.filter((s) => s.level <= level);
  const locked = def.slots.filter((s) => s.level > level);
  const keyboardSpace = useKeyboardSpace();

  function saveName() {
    if (name.trim() !== (saved?.name ?? '')) editor.rename(name);
  }

  return (
    <>
      <View style={styles.scene}>
        <WorldScene art={art} width={sceneWidth} version={JSON.stringify(picks)} play={play} radius={24} />
      </View>
      <Animated.View style={[styles.flex, keyboardSpace]}>
        <ScrollView
          automaticallyAdjustKeyboardInsets
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.content, { paddingBottom: bottom + 24 }]}>
          <TextInput
            mode="outlined"
            label="Name"
            placeholder={`Your ${def.title.toLowerCase()}`}
            value={name}
            onChangeText={setName}
            onBlur={saveName}
            onSubmitEditing={saveName}
            maxLength={NAME_LENGTH}
            returnKeyType="done"
            style={styles.name}
          />

          <Card mode="contained" style={glassCard(theme)}>
            <Card.Content style={styles.slots}>
              {unlocked.map((slot) => (
                <View key={slot.id} style={styles.slot}>
                  <Text variant="titleSmall" style={styles.bold}>
                    {slot.title}
                  </Text>
                  <ChoiceChips
                    slot={slot}
                    level={level}
                    selected={picks[slot.id]}
                    onPick={(c) => editor.pick(slot.id, c)}
                  />
                </View>
              ))}
            </Card.Content>
          </Card>

          {locked.length ? (
            <>
              <SectionHeader title="Coming up" note={`${locked.length} to unlock`} />
              <Card mode="contained" style={glassCard(theme)}>
                <Card.Content style={styles.slots}>
                  {locked.map((slot) => (
                    <View key={slot.id} style={styles.lockedRow}>
                      <Icon source="lock-outline" size={18} color={theme.colors.onSurfaceVariant} />
                      <Text variant="bodyLarge" style={styles.flex}>
                        {slot.title}
                      </Text>
                      <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>
                        {shortSteps(LEVELS[slot.level]!)} steps
                      </Text>
                    </View>
                  ))}
                </Card.Content>
              </Card>
            </>
          ) : null}
        </ScrollView>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  scene: { alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8 },
  content: { padding: 16, paddingTop: 8, gap: 12 },
  name: { backgroundColor: 'transparent' },
  slots: { gap: 18 },
  slot: { gap: 8 },
  bold: { fontWeight: '700' },
  lockedRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
