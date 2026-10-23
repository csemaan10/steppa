import { Pressable, StyleSheet, View } from 'react-native';
import { List, Modal, Portal, Text } from 'react-native-paper';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';

import { REACTION_EMOJI, REACTION_KEYS } from '@/components/message-reactions';
import type { ReactionKey } from '@/lib/api';
import { useAppTheme } from '@/theme';

export type MessageAction = { icon: string; label: string; destructive?: boolean; onPress: () => void };

const STAGGER_MS = 30;
const MENU_IN = FadeInDown.duration(200);

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
            <Animated.View key={key} entering={ZoomIn.delay(i * STAGGER_MS).springify().damping(11).stiffness(240)}>
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
  picker: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignSelf: 'center',
    gap: 2,
    padding: 6,
    borderRadius: 32,
  },
  emojiButton: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  pressed: { transform: [{ scale: 1.2 }] },
  emoji: { fontSize: 28 },
  menu: { borderRadius: 24, paddingVertical: 8, overflow: 'hidden' },
  preview: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  item: { paddingHorizontal: 8 },
});
