import { Pressable, StyleSheet, View } from 'react-native';
import { List, Modal, Portal, Text } from 'react-native-paper';
import Animated, { FadeIn, interpolate, useAnimatedStyle, useReducedMotion, ZoomIn } from 'react-native-reanimated';

import { REACTION_EMOJI, REACTION_KEYS } from '@/components/message-reactions';
import { usePressed } from '@/hooks/use-pressed';
import type { ReactionKey } from '@/lib/api';
import { useAppTheme } from '@/theme';
import { enter, motion } from '@/theme/motion';

export type MessageAction = { icon: string; label: string; destructive?: boolean; onPress: () => void };

/** Kept short, so the last of the fifteen is in place in about a quarter of a second. */
const STAGGER_MS = 8;
const COLUMNS = 5;
const BUTTON = 42;
const PADDING = 6;

// Each emoji pops in on the app's quick release spring (src/theme/motion.ts), a hint of bounce at most.
const { release } = motion;
const popIn = (i: number) =>
  ZoomIn.delay(i * STAGGER_MS)
    .springify()
    .stiffness(release.stiffness!)
    .damping(release.damping!)
    .energyThreshold(release.energyThreshold!);
// With reduced motion the picker just fades in, all at once.
const FADE_IN = FadeIn.duration(motion.fade.duration!);
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = {
  visible: boolean;
  /** The message text, kept while the sheet fades out. */
  body: string;
  /** The viewer's current reaction on the message, highlighted in the picker. */
  current: ReactionKey | null;
  actions: MessageAction[];
  onReact: (key: ReactionKey) => void;
  onDismiss: () => void;
};

/** Long-press menu for a chat message: a reaction picker above a list of actions. */
export function MessageActions({ visible, body, current, actions, onReact, onDismiss }: Props) {
  const theme = useAppTheme();
  const reduceMotion = useReducedMotion();

  // Close first so any follow-up alert isn't stacked on the modal.
  function run(fn: () => void) {
    onDismiss();
    fn();
  }

  return (
    <Portal>
      <Modal visible={visible} onDismiss={onDismiss} contentContainerStyle={styles.wrapper}>
        <View style={[styles.picker, { backgroundColor: theme.colors.elevation.level3 }]}>
          {REACTION_KEYS.map((key, i) => (
            <Animated.View key={key} entering={reduceMotion ? FADE_IN : popIn(i)}>
              <EmojiButton
                emoji={REACTION_EMOJI[key]}
                selected={current === key}
                selectedColor={theme.colors.primaryContainer}
                onPress={() => run(() => onReact(key))}
              />
            </Animated.View>
          ))}
        </View>

        {/* Rises in under the picker; Paper's modal fades the backdrop behind both. */}
        <Animated.View entering={enter(0, reduceMotion)} style={[styles.menu, { backgroundColor: theme.colors.elevation.level3 }]}>
          <Text
            variant="bodyMedium"
            numberOfLines={3}
            style={[styles.preview, { color: theme.colors.onSurfaceVariant }]}>
            {body}
          </Text>
          {actions.map((a) => {
            const color = a.destructive ? theme.colors.error : theme.colors.onSurface;
            return (
              <List.Item
                key={a.label}
                title={a.label}
                titleStyle={{ color }}
                left={(props) => <List.Icon {...props} icon={a.icon} color={color} />}
                onPress={() => run(a.onPress)}
                style={styles.item}
              />
            );
          })}
        </Animated.View>
      </Modal>
    </Portal>
  );
}

type EmojiProps = { emoji: string; selected: boolean; selectedColor: string; onPress: () => void };

/** One emoji in the picker: grows while held (the picker's magnifier), on the press springs. */
function EmojiButton({ emoji, selected, selectedColor, onPress }: EmojiProps) {
  const press = usePressed();
  const grow = useAnimatedStyle(() => ({ transform: [{ scale: interpolate(press.pressed.value, [0, 1], [1, 1.2]) }] }));
  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`React ${emoji}`}
      style={[styles.emojiButton, selected && { backgroundColor: selectedColor }, grow]}>
      <Text style={styles.emoji}>{emoji}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginHorizontal: 24, gap: 12 },
  // Three rows of five.
  picker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignSelf: 'center',
    width: COLUMNS * BUTTON + PADDING * 2,
    rowGap: 2,
    padding: PADDING,
    borderRadius: 28,
  },
  emojiButton: {
    width: BUTTON,
    height: BUTTON,
    borderRadius: BUTTON / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 26 },
  menu: { borderRadius: 24, paddingVertical: 8, overflow: 'hidden' },
  preview: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  item: { paddingHorizontal: 8 },
});
