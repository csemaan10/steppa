import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Button } from '@/components/button';
import { TREAT, TRICK_COLOR } from '@/components/game/colors';
import { InkStamp } from '@/components/game/game-fx';
import { SpendButton } from '@/components/game/spend-button';
import { TrickIcon } from '@/components/trick-icon';
import { TreatIcon } from '@/components/treat-icon';
import { learnedTricks, training, TRICKS, type Trick, type TrickId } from '@/lib/world';
import { glassCard, useAppTheme, withAlpha } from '@/theme';

type Props = {
  /** Treats it has eaten so far. */
  fed: number;
  /** Treats you have to spend. */
  available: number;
  /** What's being bought right now (a trick's id, or something else in the shop). */
  buying: string | null;
  /** Learned on this visit: it gets a "LEARNED" stamp. */
  justLearned: TrickId | null;
  onLearn: (trick: Trick, cost: number) => void;
  onShowOff: (trick: TrickId) => void;
};

/**
 * Tricks, in the order it learns them: the ones it knows (ask for them), the one it's learning (buy
 * the rest of its treats in one go), and the ones after it.
 */
export function TricksTab({ fed, available, buying, justLearned, onLearn, onShowOff }: Props) {
  const theme = useAppTheme();
  const learning = training(fed);
  const knows = new Set(learnedTricks(fed).map((t) => t.id));

  return (
    <View style={styles.page}>
      <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
        Teach the next trick in one go with the treats it still needs, then ask for it from the Tricks button on the Pet tab.
      </Text>
      {TRICKS.map((trick, i) => {
        const state = knows.has(trick.id) ? 'learned' : learning?.trick.id === trick.id ? 'learning' : 'locked';
        return (
          <TrickCard
            key={trick.id}
            trick={trick}
            state={state}
            given={state === 'learning' ? learning!.given : 0}
            after={TRICKS[i - 1]?.name ?? null}
            available={available}
            busy={buying === trick.id}
            stamped={justLearned === trick.id}
            onLearn={onLearn}
            onShowOff={onShowOff}
          />
        );
      })}
    </View>
  );
}

function TrickCard({
  trick,
  state,
  given,
  after,
  available,
  busy,
  stamped,
  onLearn,
  onShowOff,
}: {
  trick: Trick;
  state: 'learned' | 'learning' | 'locked';
  given: number;
  after: string | null;
  available: number;
  busy: boolean;
  stamped: boolean;
  onLearn: (trick: Trick, cost: number) => void;
  onShowOff: (trick: TrickId) => void;
}) {
  const theme = useAppTheme();
  const cost = trick.treats - given;
  const short = cost - available;
  const muted = theme.colors.onSurfaceVariant;
  const disc =
    state === 'learned'
      ? withAlpha(TRICK_COLOR, 0.16)
      : state === 'learning'
        ? withAlpha(TREAT.face, 0.3)
        : withAlpha(theme.colors.onSurface, 0.06);

  return (
    <View style={[glassCard(theme), styles.card, state === 'learning' && { borderColor: TREAT.face, borderWidth: 2 }]}>
      <View style={[styles.disc, { backgroundColor: disc }]}>
        <View style={state === 'locked' && styles.dim}>
          <TrickIcon trick={trick.id} size={32} color={state === 'locked' ? muted : state === 'learning' ? TREAT.deep : TRICK_COLOR} />
        </View>
        {state === 'locked' ? (
          <View style={[styles.lock, { backgroundColor: theme.colors.surface }]}>
            <Icon source="lock" size={11} color={muted} />
          </View>
        ) : null}
      </View>

      <View style={styles.middle}>
        <Text variant="titleMedium" style={[styles.bold, state === 'locked' && { color: muted }]}>
          {trick.name}
        </Text>
        {state === 'learned' ? (
          <View style={styles.row}>
            <Icon source="check-circle" size={14} color={TRICK_COLOR} />
            <Text variant="labelMedium" style={{ color: TRICK_COLOR }}>
              Learned
            </Text>
          </View>
        ) : state === 'learning' ? (
          <>
            <TreatBar fraction={given / trick.treats} />
            <Text variant="bodySmall" style={{ color: muted }}>
              {short > 0 ? `${short} more ${short === 1 ? 'treat' : 'treats'} to go` : `${given} of ${trick.treats} treats`}
            </Text>
          </>
        ) : (
          <View style={styles.row}>
            <Text variant="bodySmall" style={{ color: muted }}>
              {after ? `After ${after}` : 'First up'} ·
            </Text>
            <TreatIcon size={14} />
            <Text variant="bodySmall" style={{ color: muted }}>
              {trick.treats}
            </Text>
          </View>
        )}
      </View>

      {state === 'learned' ? (
        <Button mode="outlined" compact onPress={() => onShowOff(trick.id)} accessibilityLabel={`Ask for ${trick.name}`}>
          Show
        </Button>
      ) : state === 'learning' ? (
        <SpendButton
          label="Learn"
          price={cost}
          compact
          disabled={short > 0}
          loading={busy}
          onPress={() => onLearn(trick, cost)}
          accessibilityLabel={`Learn ${trick.name} for ${cost} treats`}
        />
      ) : null}

      {stamped ? (
        <View pointerEvents="none" style={styles.stamp}>
          <InkStamp text="LEARNED" color={TRICK_COLOR} rotate={-10} size={14} delay={1800} />
        </View>
      ) : null}
    </View>
  );
}

/** Treats given toward the trick, in cookie colours. */
function TreatBar({ fraction }: { fraction: number }) {
  const fill = useSharedValue(0);
  useEffect(() => {
    fill.set(withTiming(fraction, { duration: 700, easing: Easing.out(Easing.cubic) }));
  }, [fill, fraction]);
  const style = useAnimatedStyle(() => ({ width: `${Math.max(fill.value, 0.03) * 100}%` }));
  return (
    <View style={[styles.track, { backgroundColor: withAlpha(TREAT.face, 0.22) }]}>
      <Animated.View style={[styles.fill, style]} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: 12 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  disc: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  dim: { opacity: 0.35 },
  lock: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  middle: { flex: 1, gap: 4 },
  bold: { fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3, backgroundColor: TREAT.face },
  // Over the middle of the card, like a stamp on a form.
  stamp: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
});
