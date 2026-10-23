import { Pressable, StyleSheet, View } from 'react-native';
import { List, Modal, Portal, Text } from 'react-native-paper';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';

import { REACTION_EMOJI, REACTION_KEYS } from '@/components/message-reactions';
import type { ReactionKey } from '@/lib/api';
import { useAppTheme } from '@/theme';
import { motion } from '@/theme/motion';

export type MessageAction = { icon: string; label: string; destructive?: boolean; onPress: () => void };

/** Kept short, so the last of the fifteen is in place in about a quarter of a second. */
const STAGGER_MS = 8;
const MENU_IN = FadeInDown.duration(200);
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
            <Animated.View key={key} entering={popIn(i)}>
              <Pressable
                onPress={() => run(() => onReact(key))}
                accessibilityRole="button"
                accessibilityState={{ selected: current === key }}
                accessibilityLabel={`React ${REACTION_EMOJI[key]}`}
                style={({ pressed }) => [
                  styles.emojiButton,
                  current === key && { backgroundColor: theme.colors.primaryContainer },
                  pressed && styles.pressed,
                ]}>
                <Text style={styles.emoji}>{REACTION_EMOJI[key]}</Text>
              </Pressable>
            </Animated.View>
          ))}
        </View>

        <Animated.View entering={MENU_IN} style={[styles.menu, { backgroundColor: theme.colors.elevation.level3 }]}>
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
  pressed: { transform: [{ scale: 1.2 }] },
  emoji: { fontSize: 26 },
  menu: { borderRadius: 24, paddingVertical: 8, overflow: 'hidden' },
  preview: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  item: { paddingHorizontal: 8 },
});
