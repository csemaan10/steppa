import { Alert, Pressable, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import Animated, {
  Keyframe,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  ZoomIn,
  ZoomOut,
} from 'react-native-reanimated';

import type { Reaction, ReactionKey } from '@/lib/api';
import { useAppTheme } from '@/theme';

/** Picker order; keys are what the database stores. */
export const REACTION_EMOJI: Record<ReactionKey, string> = {
  like: '👍',
  love: '❤️',
  laugh: '😂',
  fire: '🔥',
  shoe: '👟',
  wow: '😮',
};

export const REACTION_KEYS = Object.keys(REACTION_EMOJI) as ReactionKey[];

const CHIP_IN = ZoomIn.springify().damping(12).stiffness(260);
const CHIP_OUT = ZoomOut.duration(160);
const CHIP_MOVE = LinearTransition.springify().damping(18).stiffness(220);
// The new count rolls up into place.
const COUNT_IN = new Keyframe({
  0: { opacity: 0, transform: [{ translateY: 6 }] },
  100: { opacity: 1, transform: [{ translateY: 0 }] },
}).duration(180);

type Props = {
  reactions: Reaction[];
  userId: string;
  mine: boolean;
  nameOf: (userId: string) => string;
  onToggle: (key: ReactionKey) => void;
};

/** One chip per emoji with its count, under a chat bubble. Tap toggles yours; long-press shows who. */
export function ReactionChips({ reactions, userId, mine, nameOf, onToggle }: Props) {
  if (!reactions.length) return null;

  const groups = REACTION_KEYS.map((key) => ({ key, people: reactions.filter((r) => r.emoji === key) })).filter(
    (g) => g.people.length
  );

  return (
    <Animated.View layout={CHIP_MOVE} style={[styles.row, mine && styles.mineRow]}>
      {groups.map(({ key, people }) => (
        <Chip
          key={key}
          emoji={REACTION_EMOJI[key]}
          selected={people.some((r) => r.user_id === userId)}
          names={people.map((r) => (r.user_id === userId ? 'You' : nameOf(r.user_id)))}
          onPress={() => onToggle(key)}
        />
      ))}
    </Animated.View>
  );
}

type ChipProps = { emoji: string; selected: boolean; names: string[]; onPress: () => void };

function Chip({ emoji, selected, names, onPress }: ChipProps) {
  const theme = useAppTheme();
  const scale = useSharedValue(1);
  const bounce = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const count = names.length;

  function press() {
    scale.set(withSequence(withTiming(1.25, { duration: 90 }), withSpring(1, { damping: 8, stiffness: 320 })));
    onPress();
  }

  return (
    // Bounce lives on an inner view so its transform doesn't fight the entering zoom.
    <Animated.View entering={CHIP_IN} exiting={CHIP_OUT} layout={CHIP_MOVE}>
      <Animated.View style={bounce}>
        <Pressable
        onPress={press}
        onLongPress={() => Alert.alert(emoji, names.join('\n'))}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={`${emoji} ${count}: ${names.join(', ')}`}
        style={[
          styles.chip,
          {
            backgroundColor: selected ? theme.colors.primaryContainer : theme.colors.elevation.level2,
            borderColor: selected ? theme.colors.primary : theme.colors.outlineVariant,
          },
        ]}>
        <Text style={styles.emoji}>{emoji}</Text>
        {count > 1 ? (
          // Keyed by count so each change remounts and replays the roll.
          <Animated.Text
            key={count}
            entering={COUNT_IN}
            style={[
              theme.fonts.labelSmall,
              { color: selected ? theme.colors.onPrimaryContainer : theme.colors.onSurfaceVariant },
            ]}>
            {count}
          </Animated.Text>
        ) : null}
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: -6, paddingHorizontal: 6 },
  mineRow: { justifyContent: 'flex-end' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  emoji: { fontSize: 14 },
});
