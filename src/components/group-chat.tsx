import { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { IconButton, Text, useTheme } from 'react-native-paper';
import Animated, { useAnimatedKeyboard, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChatPodiumCard } from '@/components/chat-podium-card';
import { UserAvatar } from '@/components/user-avatar';
import {
  blockUser,
  getDayLeaderboard,
  getMessages,
  reportMessage,
  sendMessage,
  subscribeToMessages,
  type ChatMessage,
  type LeaderboardRow,
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

function addMessage(list: ChatMessage[], message: ChatMessage): ChatMessage[] {
  return list.some((m) => m.id === message.id) ? list : [message, ...list];
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
  const today = startOfDay(new Date());
  const yesterday = toDayKey(addDays(today, -1));
  const keyboard = useAnimatedKeyboard();
  // Keyboard height already covers the nav-bar inset, so use whichever is larger.
  const keyboardPadding = useAnimatedStyle(() => ({
    paddingBottom: Math.max(keyboard.height.value, insets.bottom),
  }));

  useEffect(() => {
    let active = true;
    getMessages(groupId)
      .then((initial) => {
        if (active) {
          setMessages((current) => {
            const byId = new Map([...initial, ...current].map((m) => [m.id, m]));
            return [...byId.values()].sort((a, b) => b.id - a.id);
          });
        }
      })
      .catch((e) => active && setError(e instanceof Error ? e.message : String(e)));
    const unsubscribe = subscribeToMessages(groupId, (m) => setMessages((list) => addMessage(list, m)));
    return () => {
      active = false;
      unsubscribe();
    };
  }, [groupId]);

  // Long-press on someone else's message. Both actions hide content immediately; the database
  // (RLS) keeps it hidden on reload and in live updates.
  function moderate(message: ChatMessage) {
    const name = members.get(message.user_id)?.display_name ?? 'this member';
    const fail = (e: unknown) => Alert.alert('Error', e instanceof Error ? e.message : String(e));
    Alert.alert(name, message.body, [
      {
        text: 'Report message',
        onPress: () =>
          reportMessage(message.id, userId)
            .then(() => {
              setMessages((list) => list.filter((m) => m.id !== message.id));
              Alert.alert('Reported', "Thanks. We'll review it, and you won't see it again.");
            })
            .catch(fail),
      },
      {
        text: `Block ${name}`,
        style: 'destructive',
        onPress: () =>
          Alert.alert(`Block ${name}?`, "You won't see their messages. You can unblock them from your profile.", [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Block',
              style: 'destructive',
              onPress: () =>
                blockUser(userId, message.user_id)
                  .then(() => setMessages((list) => list.filter((m) => m.user_id !== message.user_id)))
                  .catch(fail),
            },
          ]),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
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
      const message = await sendMessage(groupId, userId, body);
      setDraft('');
      setMessages((list) => addMessage(list, message));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send');
    } finally {
      setSending(false);
    }
  }

  return (
    <Animated.View style={[styles.flex, keyboardPadding]}>
      {messages.length === 0 && !podium.length ? (
        <Text variant="bodyMedium" style={[styles.empty, { color: theme.colors.onSurfaceVariant }]}>
          No messages yet. Say hi 👋
        </Text>
      ) : null}
      <FlatList
        inverted
        data={items}
        keyExtractor={(i) => (i.kind === 'podium' ? 'podium' : String(i.message.id))}
        contentContainerStyle={styles.list}
        renderItem={({ item: row, index }) => {
          if (row.kind === 'podium') return <ChatPodiumCard rows={podium} day={yesterday} userId={userId} />;
          const item = row.message;
          const mine = item.user_id === userId;
          const member = members.get(item.user_id);
          // Inverted: the item visually above is the next one in the array; the podium card breaks a run.
          const above = items[index + 1];
          const firstOfRun = above?.kind !== 'message' || above.message.user_id !== item.user_id;
          return (
            <View style={[styles.messageRow, mine && styles.mineRow, !firstOfRun && styles.tight]}>
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
                  onLongPress={mine ? undefined : () => moderate(item)}
                  accessibilityHint={mine ? undefined : 'Long press to report or block'}
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
                    {formatTime(item.created_at)}
                  </Text>
                </Pressable>
              </View>
            </View>
          );
        }}
      />

      {error ? (
        <Text variant="bodySmall" style={[styles.error, { color: theme.colors.error }]}>
          {error}
        </Text>
      ) : null}

      <View style={styles.composer}>
        <View style={[styles.field, { backgroundColor: theme.colors.surfaceVariant }]}>
          <TextInput
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
          icon="send"
          mode="contained"
          size={22}
          onPress={send}
          disabled={sending || !draft.trim()}
          accessibilityLabel="Send message"
          style={styles.send}
        />
      </View>
    </Animated.View>
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
