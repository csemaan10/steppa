import { memo, useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View, type ViewToken } from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CharacterCanvas } from '@/components/character/character-canvas';
import { CAT_X, DOG_X, HORSE_X } from '@/components/character/rig';
import type { LeaderboardRow } from '@/lib/api';
import { DOGS, hashString, isSmallPet, normalizeLook, type CharacterLook, type Pet } from '@/lib/character';
import { glassCard } from '@/theme';

/** Stage width for cabinet characters: twice the podium's, so only a few shelves fit on screen. */
const STAGE_WIDTH = 176;
/** Points per rig unit: the stage shows the rig's 120-unit-wide scene, from x = -30. */
const STAGE_SCALE = STAGE_WIDTH / 120;

/**
 * The shelf's span in rig units: under the character, stretched to reach every pet standing on
 * the stage (half-widths include each pet's shadow).
 */
function shelfSpan(look: CharacterLook): { left: number; right: number } {
  const cats = look.pets.filter(isSmallPet).length;
  let left = -18;
  let right = 78;
  if (cats > 0) left = Math.min(left, CAT_X[cats - 1]! - 7);
  if (look.pets.some((p) => (DOGS as readonly Pet[]).includes(p))) right = Math.max(right, DOG_X + 7.5);
  if (look.pets.includes('horse')) right = Math.max(right, HORSE_X + 12);
  return { left, right };
}
/** Cabinet characters are drawn with Skia (trial), which keeps full frame rate with several on screen. */
const CABINET_FPS = 60;

/** A row counts as on screen once a fifth of it shows. */
const VIEWABILITY = { itemVisiblePercentThreshold: 20 };

const MEDALS = [
  { key: 'gold', color: '#E3B341', label: 'gold' },
  { key: 'silver', color: '#A8B0B8', label: 'silver' },
  { key: 'bronze', color: '#C3834C', label: 'bronze' },
] as const;

type Props = {
  rows: LeaderboardRow[];
  userId: string;
  onPressUser: (userId: string) => void;
  /** False pauses every character (the tab is hidden but kept alive). */
  active?: boolean;
};

/**
 * The group's trophy cabinet: every member's character beside the medals they've won here
 * (a medal is a top-3 finish on a completed day). Most golds first, then silvers, then bronzes.
 */
export function TrophyCabinet({ rows, userId, onPressUser, active = true }: Props) {
  const insets = useSafeAreaInsets();
  const sorted = useMemo(
    () =>
      [...rows].sort(
        (a, b) => b.gold - a.gold || b.silver - a.silver || b.bronze - a.bronze || a.display_name.localeCompare(b.display_name)
      ),
    [rows]
  );

  // Only characters on screen animate; the rest hold still until scrolled back into view.
  const [visible, setVisible] = useState<Set<string>>(() => new Set());
  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken<LeaderboardRow>[] }) => {
    setVisible(new Set(viewableItems.map((v) => v.item.user_id)));
  }, []);

  return (
    <FlatList
      data={sorted}
      keyExtractor={(r) => r.user_id}
      onViewableItemsChanged={onViewableItemsChanged}
      viewabilityConfig={VIEWABILITY}
      extraData={active ? visible : null}
      // Each row is a live scene: keep only a little beyond the screen mounted.
      initialNumToRender={4}
      maxToRenderPerBatch={2}
      windowSize={3}
      removeClippedSubviews
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 16 }]}
      renderItem={({ item }) => (
        <Shelf row={item} isMe={item.user_id === userId} animate={active && visible.has(item.user_id)} onPressUser={onPressUser} />
      )}
    />
  );
}

type ShelfProps = { row: LeaderboardRow; isMe: boolean; animate: boolean; onPressUser: (userId: string) => void };

/** Memoised so a row only re-renders when its own data or on-screen state changes. */
const Shelf = memo(function Shelf({ row, isMe, animate, onPressUser }: ShelfProps) {
  const theme = useTheme();
  const look = useMemo(() => normalizeLook(row.podium_character, row.user_id), [row.podium_character, row.user_id]);
  const seed = (hashString(row.user_id) % 1000) / 1000;
  const total = row.gold + row.silver + row.bronze;
  const span = shelfSpan(look);
  // A second small pet (cat, bunny, hamster) sits at the stage's far left, so only trim that side when there isn't one.
  const twoCats = look.pets.filter(isSmallPet).length > 1;

  return (
    <Card
      mode="contained"
      // Yours is picked out by a primary rim; a solid fill would stop it reading as glass.
      style={[glassCard(theme), isMe && { borderColor: theme.colors.primary }]}
      onPress={isMe ? undefined : () => onPressUser(row.user_id)}
      accessibilityLabel={`${row.display_name}: ${row.gold} gold, ${row.silver} silver, ${row.bronze} bronze`}>
      <View style={styles.row}>
        <View style={[styles.character, twoCats && styles.characterWide]}>
          <CharacterCanvas look={look} seed={seed} width={STAGE_WIDTH} animate={animate} fps={CABINET_FPS} />
          {/* A shelf for the character to stand on. */}
          <View
            style={[
              styles.shelf,
              {
                backgroundColor: theme.colors.outlineVariant,
                marginLeft: (span.left + 30) * STAGE_SCALE,
                width: (span.right - span.left) * STAGE_SCALE,
              },
            ]}
          />
        </View>
        <View style={styles.details}>
          <Text variant="titleSmall" numberOfLines={1}>
            {isMe ? 'You' : row.display_name}
          </Text>
          {total > 0 ? (
            <View style={styles.medals}>
              {MEDALS.map((m) => (
                <View key={m.key} style={styles.medal}>
                  <View style={[styles.disc, { backgroundColor: m.color }]} />
                  <Text variant="titleMedium" style={styles.count}>
                    {row[m.key]}
                  </Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    {m.label}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              No medals yet
            </Text>
          )}
        </View>
      </View>
    </Card>
  );
});

const styles = StyleSheet.create({
  content: { padding: 16, paddingTop: 12, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 12, paddingVertical: 14 },
  // Pulled left over the stage's empty edge, which only a second cat uses.
  character: { alignItems: 'center', marginLeft: -12 },
  characterWide: { marginLeft: 0 },
  shelf: { alignSelf: 'flex-start', height: 4, borderRadius: 2, marginTop: -3 },
  details: { flex: 1, gap: 10 },
  medals: { gap: 6 },
  medal: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  disc: { width: 16, height: 16, borderRadius: 8 },
  count: { fontVariant: ['tabular-nums'], fontWeight: '700' },
});
