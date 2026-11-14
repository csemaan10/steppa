import { Alert, Pressable, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import Animated, {
  LinearTransition,
  useAnimatedStyle,
  useReducedMotion,
  withSpring,
  withTiming,
  type EntryExitAnimationFunction,
} from 'react-native-reanimated';

import { usePressed } from '@/hooks/use-pressed';
import type { Reaction, ReactionKey } from '@/lib/api';
import { useAppTheme } from '@/theme';
import { motion } from '@/theme/motion';

/** Picker order (three rows of five); keys are what the database stores. */
export const REACTION_EMOJI: Record<ReactionKey, string> = {
  like: '👍',
  love: '❤️',
  laugh: '😂',
  fire: '🔥',
  shoe: '👟',
  wow: '😮',
  clap: '👏',
  party: '🎉',
  strong: '💪',
  trophy: '🏆',
  hundred: '💯',
  sad: '😢',
  angry: '😡',
  eyes: '👀',
  thanks: '🙏',
};

export const REACTION_KEYS = Object.keys(REACTION_EMOJI) as ReactionKey[];

// The app's quick Expressive springs: settled in about a fifth of a second, with only a hint of bounce.
const { spatial } = motion;
const CHIP_MOVE = LinearTransition.springify()
  .stiffness(spatial.stiffness!)
  .damping(spatial.damping!)
  .energyThreshold(spatial.energyThreshold!);

/** A new reaction: fades in as it grows from half size on the quick release spring. With reduced motion it only fades. */
function chipIn(reduceMotion: boolean): EntryExitAnimationFunction {
  const from = reduceMotion ? 1 : 0.5;
  const { fade, release } = motion;
  return () => {
    'worklet';
    return {
      initialValues: { opacity: 0, transform: [{ scale: from }] },
      animations: { opacity: withTiming(1, fade), transform: [{ scale: withSpring(1, release) }] },
    };
  };
}

/** A reaction taken back: shrinks as it fades, quicker than it came. */
function chipOut(reduceMotion: boolean): EntryExitAnimationFunction {
  const to = reduceMotion ? 1 : 0.5;
  const { fadeOut, press } = motion;
  return () => {
    'worklet';
    return {
      initialValues: { opacity: 1, transform: [{ scale: 1 }] },
      animations: { opacity: withTiming(0, fadeOut), transform: [{ scale: withSpring(to, press) }] },
    };
  };
}

/** The new count rolls up into place (just fades with reduced motion). */
function countIn(reduceMotion: boolean): EntryExitAnimationFunction {
  const rise = reduceMotion ? 0 : 6;
  const { fade, smooth } = motion;
  return () => {
    'worklet';
    return {
      initialValues: { opacity: 0, transform: [{ translateY: rise }] },
      animations: { opacity: withTiming(1, fade), transform: [{ translateY: withSpring(0, smooth) }] },
    };
  };
}

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
  const reduceMotion = useReducedMotion();
  // Dips on touch-down like the app's small buttons, and settles back as the toggle lands.
  const press = usePressed();
  const dip = useAnimatedStyle(() => ({ transform: [{ scale: 1 - press.pressed.value * 0.08 }] }));
  const count = names.length;

  return (
    // The dip lives on an inner view so its transform doesn't fight the entering grow.
    <Animated.View entering={chipIn(reduceMotion)} exiting={chipOut(reduceMotion)} layout={CHIP_MOVE}>
      <Animated.View style={dip}>
        <Pressable
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
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
            entering={countIn(reduceMotion)}
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
