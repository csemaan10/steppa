import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

import { TrophyIcon } from '@/components/award-icons';
import { CharacterCanvas } from '@/components/character/character-canvas';
import { RainCloud } from '@/components/recap/celebration';
import { MEDAL_COLORS } from '@/components/character/scene-common';
import type { LeaderboardRow } from '@/lib/api';
import { hashString, normalizeLook } from '@/lib/character';
import { formatSteps } from '@/lib/dates';
import { withAlpha } from '@/theme';

const MEDAL_NAMES = ['gold', 'silver', 'bronze'];

export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
}

/** Where the viewer finished, with a medal line on the podium or a sad character off it. */
export type Placement =
  | { kind: 'podium'; place: number }
  | { kind: 'off'; rank: number; behind: number }
  | { kind: 'none' };

export function placementOf(me: LeaderboardRow, podium: LeaderboardRow[]): Placement {
  if (me.total_steps <= 0) return { kind: 'none' };
  // By rank, so a tie for third that didn't fit on the podium still counts as bronze.
  if (me.rank <= 3) return { kind: 'podium', place: Math.min(me.rank, 3) - 1 };
  const bronze = podium[podium.length - 1]!;
  return { kind: 'off', rank: me.rank, behind: bronze.total_steps - me.total_steps };
}

type Props = {
  me: LeaderboardRow;
  podium: LeaderboardRow[];
  /** Everyone in the group, for "5th of 8". */
  total: number;
  compact?: boolean;
  play: boolean;
};

export function RecapPlacement({ me, podium, total, compact = false, play }: Props) {
  const theme = useTheme();
  const placement = placementOf(me, podium);
  const look = useMemo(() => normalizeLook(me.podium_character, me.user_id), [me.podium_character, me.user_id]);
  const seed = (hashString(me.user_id) % 1000) / 1000;

  if (placement.kind === 'podium') {
    const medal = MEDAL_COLORS[placement.place]!;
    return (
      <View
        style={[
          styles.banner,
          compact && styles.bannerCompact,
          { backgroundColor: withAlpha(medal.disc, theme.dark ? 0.22 : 0.3), borderColor: withAlpha(medal.rim, 0.5) },
        ]}>
        <View style={styles.headline}>
          {placement.place === 0 ? <TrophyIcon size={compact ? 18 : 22} /> : null}
          <Text variant={compact ? 'labelLarge' : 'titleMedium'} style={styles.bold}>
            {placement.place === 0 ? 'You won!' : `You took ${MEDAL_NAMES[placement.place]}!`}
          </Text>
        </View>
        <Text variant={compact ? 'labelMedium' : 'bodyMedium'} style={{ color: theme.colors.onSurfaceVariant }}>
          {formatSteps(me.total_steps)} steps
        </Text>
      </View>
    );
  }

  const title = placement.kind === 'off' ? `You placed ${ordinal(placement.rank)} of ${total}` : 'No steps logged';
  const detail =
    placement.kind === 'off'
      ? `${formatSteps(placement.behind)} steps short of bronze`
      : 'Sync your steps to get on the podium.';

  if (compact) {
    return (
      <View style={[styles.sadRow, { backgroundColor: theme.colors.surfaceVariant }]}>
        <CharacterCanvas look={look} seed={seed} width={56} motion="sad" animate={play} />
        <View style={styles.text}>
          <Text variant="labelLarge" style={styles.bold}>
            {title}
          </Text>
          <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            {detail}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.sad}>
      <View style={styles.cloud}>
        <RainCloud size={46} color={theme.dark ? '#8B95A1' : '#A9B3BE'} />
      </View>
      <CharacterCanvas look={look} seed={seed} width={150} motion="sad" animate={play} />
      <View style={[styles.ground, { backgroundColor: theme.colors.surfaceVariant }]} />
      <Text variant="titleMedium" style={styles.bold}>
        {title}
      </Text>
      <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center' }}>
        {detail}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bold: { fontWeight: '700' },
  headline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  banner: { alignItems: 'center', gap: 2, paddingVertical: 14, borderRadius: 16, borderWidth: 1 },
  bannerCompact: { paddingVertical: 8, borderRadius: 12 },
  sad: { alignItems: 'center', gap: 4 },
  // The cloud hangs just above the character's head, so the rain lands on it.
  cloud: { marginBottom: -24, zIndex: 1 },
  ground: { width: 120, height: 6, borderRadius: 3, marginTop: -2, marginBottom: 8 },
  sadRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 12, borderRadius: 12 },
  text: { flex: 1, gap: 2 },
});
