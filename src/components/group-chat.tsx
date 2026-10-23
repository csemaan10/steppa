import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Icon, IconButton, Text, useTheme } from 'react-native-paper';
import Animated, {
  FadeInDown,
  FadeOutDown,
  Keyframe,
  LayoutAnimationConfig,
  LinearTransition,
  useAnimatedKeyboard,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChatPodiumCard } from '@/components/chat-podium-card';
import { MessageActions, type MessageAction } from '@/components/message-actions';
import { ReactionChips } from '@/components/message-reactions';
import { UserAvatar } from '@/components/user-avatar';
import {
  blockUser,
  deleteMessage,
  editMessage,
  getDayLeaderboard,
  getMessages,
  getReactions,
  removeReaction,
  reportMessage,
  sendMessage,
  setReaction,
  subscribeToMessages,
  subscribeToReactions,
  type ChatMessage,
  type LeaderboardRow,
  type Reaction,
  type ReactionKey,
} from '@/lib/api';
import { markRead } from '@/lib/chat-read';
import { addDays, startOfDay, toDayKey } from '@/lib/dates';

type Member = { display_name: string; avatar_color: string; avatar_icon: string | null };

type Props = {
  groupId: string;
  userId: string;
  members: Map<string, Member>;
  /** Called with the newest message id each time the visible messages change (for the unread dot). */
  onRead?: (messageId: number) => void;
};

/** Chat rows: messages plus yesterday's podium card, which sits where today begins. */
type Item = { kind: 'message'; message: ChatMessage } | { kind: 'podium' };

// Rows close gaps and make room with a spring (deletes, new messages, reactions changing height).
const ROW_MOVE = LinearTransition.springify().damping(20).stiffness(200);
const MESSAGE_IN = FadeInDown.springify().damping(18).stiffness(220);
// Deleted, reported or blocked: the bubble shrinks toward its side and fades.
const MESSAGE_OUT = new Keyframe({
  0: { opacity: 1, transform: [{ scale: 1 }] },
  100: { opacity: 0, transform: [{ scale: 0.6 }] },
}).duration(220);
const BANNER_IN = FadeInDown.duration(160);
const BANNER_OUT = FadeOutDown.duration(120);

/** Inserts in place (newest first); a no-op if it's already there. */
function addMessage(list: ChatMessage[], message: ChatMessage): ChatMessage[] {
  if (list.some((m) => m.id === message.id)) return list;
  return [message, ...list].sort((a, b) => b.id - a.id);
}

function upsertReaction(list: Reaction[], r: Reaction): Reaction[] {
  return [...list.filter((x) => x.message_id !== r.message_id || x.user_id !== r.user_id), r];
}

function dropReaction(list: Reaction[], messageId: number, userId: string): Reaction[] {
  return list.filter((x) => x.message_id !== messageId || x.user_id !== userId);
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function GroupChat({ groupId, userId, members, onRead }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  // Newest first, rendered in an inverted list.
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [podium, setPodium] = useState<LeaderboardRow[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  // Long-press menu (kept after closing so it can fade out with its content), and the message
  // being edited in the composer.
  const [menu, setMenu] = useState<{ message: ChatMessage; open: boolean } | null>(null);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  // Newest id from the first load; only messages after it slide in (null until loaded).
  const [loadedUpTo, setLoadedUpTo] = useState<number | null>(null);
  const input = useRef<TextInput>(null);
  const today = startOfDay(new Date());
  const yesterday = toDayKey(addDays(today, -1));
  const keyboard = useAnimatedKeyboard();
  // Keyboard height already covers the nav-bar inset, so use whichever is larger.
  const keyboardPadding = useAnimatedStyle(() => ({
    paddingBottom: Math.max(keyboard.height.value, insets.bottom),
  }));

  useEffect(() => {
    let active = true;
    // Messages and their reactions land in the same render, so existing reactions don't pop in.
    // Reactions are optional: chat still loads if they fail.
    getMessages(groupId)
      .then(async (initial) => ({
        initial,
        initialReactions: await getReactions(initial.map((m) => m.id)).catch(() => []),
      }))
      .then(({ initial, initialReactions }) => {
        if (!active) return;
        setMessages((current) => {
          const byId = new Map([...initial, ...current].map((m) => [m.id, m]));
          return [...byId.values()].sort((a, b) => b.id - a.id);
        });
        setReactions((current) => initialReactions.reduce(upsertReaction, current));
        setLoadedUpTo(initial[0]?.id ?? 0);
      })
      .catch((e) => active && setError(e instanceof Error ? e.message : String(e)));
    const unsubscribeMessages = subscribeToMessages(groupId, (m) => setMessages((list) => addMessage(list, m)), {
      onUpdate: (m) => setMessages((list) => list.map((x) => (x.id === m.id ? m : x))),
      onDelete: (id) => {
        setMessages((list) => list.filter((m) => m.id !== id));
        setReactions((list) => list.filter((r) => r.message_id !== id));
      },
    });
    const unsubscribeReactions = subscribeToReactions(
      groupId,
      (r) => setReactions((list) => upsertReaction(list, r)),
      (messageId, reactorId) => setReactions((list) => dropReaction(list, messageId, reactorId))
    );
    return () => {
      active = false;
      unsubscribeMessages();
      unsubscribeReactions();
    };
  }, [groupId]);

  const fail = (e: unknown) => Alert.alert('Error', e instanceof Error ? e.message : String(e));
  const nameOf = (id: string) => members.get(id)?.display_name ?? 'Member';

  // Tapping your current reaction removes it; any other emoji replaces it. Applied right away and
  // rolled back if the server says no.
  function react(message: ChatMessage, key: ReactionKey) {
    const before = reactions;
    const removing = reactions.some((r) => r.message_id === message.id && r.user_id === userId && r.emoji === key);
    setReactions(
      removing
        ? dropReaction(reactions, message.id, userId)
        : upsertReaction(reactions, { message_id: message.id, user_id: userId, emoji: key })
    );
    (removing ? removeReaction(message.id, userId) : setReaction(message.id, userId, key)).catch((e) => {
      setReactions(before);
      fail(e);
    });
  }

  function startEdit(message: ChatMessage) {
    setEditing(message);
    setDraft(message.body);
    setError(null);
  }

  // Focus the composer once the menu has closed and the draft holds the message.
  useEffect(() => {
    if (editing) input.current?.focus();
  }, [editing]);

  function cancelEdit() {
    setEditing(null);
    setDraft('');
  }

  function confirmDelete(message: ChatMessage) {
    Alert.alert('Delete message?', "It'll be removed for everyone in the group.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        // Removed right away so the exit animation plays without waiting; put back if it fails.
        onPress: () => {
          setMessages((list) => list.filter((m) => m.id !== message.id));
          if (editing?.id === message.id) cancelEdit();
          deleteMessage(message.id).catch((e) => {
            setMessages((list) => addMessage(list, message));
            fail(e);
          });
        },
      },
    ]);
  }

  // Report and block hide content immediately; the database (RLS) keeps it hidden on reload and
  // in live updates.
  function report(message: ChatMessage) {
    reportMessage(message.id, userId)
      .then(() => {
        setMessages((list) => list.filter((m) => m.id !== message.id));
        Alert.alert('Reported', "Thanks. We'll review it, and you won't see it again.");
      })
      .catch(fail);
  }

  function block(message: ChatMessage, name: string) {
    Alert.alert(`Block ${name}?`, "You won't see their messages. You can unblock them from your profile.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Block',
        style: 'destructive',
        onPress: () =>
          blockUser(userId, message.user_id)
            .then(() => {
              setMessages((list) => list.filter((m) => m.user_id !== message.user_id));
              setReactions((list) => list.filter((r) => r.user_id !== message.user_id));
            })
            .catch(fail),
      },
    ]);
  }

  function actionsFor(message: ChatMessage): MessageAction[] {
    if (message.user_id === userId) {
      return [
        { icon: 'pencil-outline', label: 'Edit', onPress: () => startEdit(message) },
        { icon: 'delete-outline', label: 'Delete', destructive: true, onPress: () => confirmDelete(message) },
      ];
    }
    const name = members.get(message.user_id)?.display_name ?? 'this member';
    return [
      { icon: 'flag-outline', label: 'Report message', onPress: () => report(message) },
      { icon: 'account-cancel-outline', label: `Block ${name}`, destructive: true, onPress: () => block(message, name) },
    ];
  }

  // Yesterday's top three (people with steps only), shown as a card at the start of today.
  useEffect(() => {
    let active = true;
    getDayLeaderboard(groupId, yesterday)
      .then((rows) => active && setPodium(rows.filter((r) => r.total_steps > 0 && r.rank <= 3).slice(0, 3)))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [groupId, yesterday]);

  // Everything loaded here has been seen.
  const newestId = messages[0]?.id;
  useEffect(() => {
    if (newestId === undefined) return;
    markRead(groupId, newestId);
    onRead?.(newestId);
  }, [groupId, newestId, onRead]);

  // Newest first (inverted list), with the podium card placed after today's messages.
  const todayMs = today.getTime();
  const firstOlder = messages.findIndex((m) => new Date(m.created_at).getTime() < todayMs);
  const split = firstOlder === -1 ? messages.length : firstOlder;
  const items: Item[] = [
    ...messages.slice(0, split).map((message) => ({ kind: 'message' as const, message })),
    ...(podium.length ? [{ kind: 'podium' as const }] : []),
    ...messages.slice(split).map((message) => ({ kind: 'message' as const, message })),
  ];

  async function send() {
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    setError(null);
    try {
      if (editing) {
        const message = body === editing.body ? editing : await editMessage(editing.id, body);
        setMessages((list) => list.map((m) => (m.id === message.id ? message : m)));
        setEditing(null);
        setDraft('');
      } else {
        const message = await sendMessage(groupId, userId, body);
        setDraft('');
        setMessages((list) => addMessage(list, message));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : editing ? 'Could not save' : 'Could not send');
    } finally {
      setSending(false);
    }
  }

  return (
    // Leaving the chat (switching views) shouldn't play every bubble's exit animation.
    <LayoutAnimationConfig skipExiting>
      <Animated.View style={[styles.flex, keyboardPadding]}>
        {messages.length === 0 && !podium.length ? (
          <Text variant="bodyMedium" style={[styles.empty, { color: theme.colors.onSurfaceVariant }]}>
            No messages yet. Say hi 👋
          </Text>
        ) : null}
        <Animated.FlatList
          inverted
          data={items}
          keyExtractor={(i) => (i.kind === 'podium' ? 'podium' : String(i.message.id))}
          itemLayoutAnimation={ROW_MOVE}
          contentContainerStyle={styles.list}
          renderItem={({ item: row, index }) => {
            if (row.kind === 'podium') return <ChatPodiumCard rows={podium} day={yesterday} userId={userId} />;
            const item = row.message;
            const mine = item.user_id === userId;
            const member = members.get(item.user_id);
            // Inverted: the item visually above is the next one in the array; the podium card breaks a run.
            const above = items[index + 1];
            const firstOfRun = above?.kind !== 'message' || above.message.user_id !== item.user_id;
            const isNew = loadedUpTo !== null && item.id > loadedUpTo;
            return (
              <Animated.View
                entering={isNew ? MESSAGE_IN : undefined}
                exiting={MESSAGE_OUT}
                style={[
                  styles.messageRow,
                  mine && styles.mineRow,
                  !firstOfRun && styles.tight,
                  { transformOrigin: mine ? 'right bottom' : 'left bottom' },
                ]}>
                {/* Whatever mounts with the row (e.g. reactions already there) appears without animating;
                    reactions added later still pop in. */}
                <LayoutAnimationConfig skipEntering>
                  {!mine ? (
                    <View style={styles.avatarSlot}>
                      {firstOfRun ? (
                        <UserAvatar
                          name={member?.display_name ?? '?'}
                          color={member?.avatar_color ?? theme.colors.outline}
                          icon={member?.avatar_icon}
                          size={28}
                        />
                      ) : null}
                    </View>
                  ) : null}
                  <View style={[styles.bubbleColumn, mine && styles.mineColumn]}>
                    {!mine && firstOfRun ? (
                      <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                        {member?.display_name ?? 'Member'}
                      </Text>
                    ) : null}
                    <Pressable
                      onLongPress={() => setMenu({ message: item, open: true })}
                      accessibilityHint={mine ? 'Long press to react, edit or delete' : 'Long press to react, report or block'}
                      style={[
                        styles.bubble,
                        mine
                          ? { backgroundColor: theme.colors.primary, borderBottomRightRadius: 6 }
                          : { backgroundColor: theme.colors.surfaceVariant, borderBottomLeftRadius: 6 },
                      ]}>
                      <Text
                        variant="bodyLarge"
                        style={{ color: mine ? theme.colors.onPrimary : theme.colors.onSurfaceVariant }}>
                        {item.body}
                      </Text>
                      <Text
                        variant="labelSmall"
                        style={[
                          styles.time,
                          { color: mine ? theme.colors.onPrimary : theme.colors.onSurfaceVariant },
                        ]}>
                        {item.edited_at ? 'edited · ' : ''}
                        {formatTime(item.created_at)}
                      </Text>
                    </Pressable>
                    <ReactionChips
                      reactions={reactions.filter((r) => r.message_id === item.id)}
                      userId={userId}
                      mine={mine}
                      nameOf={nameOf}
                      onToggle={(key) => react(item, key)}
                    />
                  </View>
                </LayoutAnimationConfig>
              </Animated.View>
            );
          }}
        />

        {error ? (
          <Text variant="bodySmall" style={[styles.error, { color: theme.colors.error }]}>
            {error}
          </Text>
        ) : null}

        {editing ? (
          <Animated.View
            entering={BANNER_IN}
            exiting={BANNER_OUT}
            style={[styles.editBanner, { borderColor: theme.colors.primary }]}>
            <Icon source="pencil-outline" size={18} color={theme.colors.primary} />
            <View style={styles.flex}>
              <Text variant="labelMedium" style={{ color: theme.colors.primary }}>
                Editing message
              </Text>
              <Text variant="bodySmall" numberOfLines={1} style={{ color: theme.colors.onSurfaceVariant }}>
                {editing.body}
              </Text>
            </View>
            <IconButton icon="close" size={18} onPress={cancelEdit} accessibilityLabel="Cancel editing" style={styles.cancel} />
          </Animated.View>
        ) : null}

        <View style={styles.composer}>
          <View style={[styles.field, { backgroundColor: theme.colors.surfaceVariant }]}>
            <TextInput
              ref={input}
              placeholder="Message"
              placeholderTextColor={theme.colors.onSurfaceVariant}
              value={draft}
              onChangeText={setDraft}
              maxLength={500}
              multiline
              style={[styles.input, { color: theme.colors.onSurface }]}
              cursorColor={theme.colors.primary}
              selectionColor={theme.colors.primary}
            />
          </View>
          <IconButton
            icon={editing ? 'check' : 'send'}
            mode="contained"
            size={22}
            onPress={send}
            disabled={sending || !draft.trim()}
            accessibilityLabel={editing ? 'Save edit' : 'Send message'}
            style={styles.send}
          />
        </View>

        {menu ? (
          <MessageActions
            visible={menu.open}
            body={menu.message.body}
            current={reactions.find((r) => r.message_id === menu.message.id && r.user_id === userId)?.emoji ?? null}
            actions={actionsFor(menu.message)}
            onReact={(key) => react(menu.message, key)}
            onDismiss={() => setMenu({ ...menu, open: false })}
          />
        ) : null}
      </Animated.View>
    </LayoutAnimationConfig>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { padding: 16, gap: 8, flexGrow: 1 },
  empty: { textAlign: 'center', marginTop: 32 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 8 },
  mineRow: { justifyContent: 'flex-end' },
  tight: { marginTop: 0 },
  avatarSlot: { width: 28 },
  bubbleColumn: { maxWidth: '78%', gap: 2 },
  mineColumn: { alignItems: 'flex-end' },
  bubble: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  time: { opacity: 0.7, alignSelf: 'flex-end', marginTop: 2 },
  error: { paddingHorizontal: 16 },
  editBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    paddingLeft: 12,
    borderLeftWidth: 3,
  },
  cancel: { margin: 0 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  field: { flex: 1, minHeight: 48, borderRadius: 24, justifyContent: 'center', paddingHorizontal: 18 },
  input: {
    fontSize: 16,
    lineHeight: 22,
    maxHeight: 120,
    paddingVertical: 12,
    textAlignVertical: 'center',
  },
  send: { margin: 0, width: 48, height: 48, borderRadius: 24 },
});
