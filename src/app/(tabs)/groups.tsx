import { router } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import {
  Appbar,
  Avatar,
  Dialog,
  HelperText,
  Portal,
  Text,
  TextInput,
} from 'react-native-paper';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Appear } from '@/components/appear';
import { Button } from '@/components/button';
import { FabMenu } from '@/components/fab-menu';
import { TAB_BAR_OFFSET, useTabBarSpace } from '@/components/floating-tab-bar';
import { GroupPreview } from '@/components/group-preview';
import { useLoader } from '@/hooks/use-loader';
import { createGroup, getLeaderboard, getMyGroupsWithLatestMessage, joinGroup } from '@/lib/api';
import { attempt } from '@/lib/attempt';
import { useUserId } from '@/providers/auth-provider';
import { screenBackground, transparentHeader, useAppTheme } from '@/theme';
import { enter, layoutMove, leave } from '@/theme/motion';

type DialogKind = 'create' | 'join' | null;

export default function GroupsScreen() {
  const theme = useAppTheme();
  const userId = useUserId();
  const tabBarSpace = useTabBarSpace();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { data: groups, loading, error, reload } = useLoader(async () => {
    // One request for the groups and their unread markers, then each group's board in parallel.
    const list = await getMyGroupsWithLatestMessage(userId);
    return Promise.all(
      list.map(async ({ latest_message_id, ...group }) => ({
        group,
        rows: await getLeaderboard(group.id, 'today'),
        latestMessageId: latest_message_id,
      }))
    );
  }, userId);
  // Only pull-to-refresh shows the spinner; coming back to the tab refreshes quietly over the old list.
  const [refreshing, setRefreshing] = useState(false);
  async function pullToRefresh() {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  function closeDialog() {
    setDialog(null);
    setName('');
    setDescription('');
    setCode('');
    setDialogError(null);
  }

  async function submit() {
    setBusy(true);
    setDialogError(null);
    const joined = await attempt(() =>
      dialog === 'create' ? createGroup(userId, name, description).then((g) => g.id) : joinGroup(code)
    );
    if (joined.ok) {
      closeDialog();
      router.push({ pathname: '/group/[id]', params: { id: joined.value } });
    } else setDialogError(joined.message ?? 'Something went wrong');
    setBusy(false);
  }

  const canSubmit = dialog === 'create' ? name.trim().length > 0 : code.trim().length === 6;

  return (
    <View style={[styles.flex, screenBackground(theme)]}>
      <Appbar.Header mode="small" style={transparentHeader}>
        <Appbar.Content title="Groups" />
      </Appbar.Header>

      {/* The cards rise in top to bottom when the list first loads (the tab stays mounted, so only
          once); a group joined or left later rises in or fades out, and the cards around it slide.
          Few enough cards that animating each one's layout stays cheap. */}
      <Animated.FlatList
        data={groups ?? []}
        keyExtractor={(g) => g.group.id}
        itemLayoutAnimation={layoutMove}
        contentContainerStyle={[styles.list, { paddingBottom: tabBarSpace + 64 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing || (loading && !groups)} onRefresh={pullToRefresh} />
        }
        ListEmptyComponent={
          groups || error ? (
            <Appear exits style={styles.empty}>
              <Avatar.Icon icon="account-group-outline" size={72} />
              <Text variant="titleMedium">{error ?? 'No groups yet'}</Text>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                Create a group or join one with an invite code.
              </Text>
            </Appear>
          ) : null
        }
        renderItem={({ item, index }) => (
          <Animated.View entering={enter(index, reduceMotion)} exiting={leave(reduceMotion)}>
            <GroupPreview
              group={item.group}
              rows={item.rows}
              userId={userId}
              latestMessageId={item.latestMessageId}
              showOwner
            />
          </Animated.View>
        )}
      />

      <FabMenu
        bottom={insets.bottom + TAB_BAR_OFFSET + 12}
        actions={[
          { icon: 'ticket-confirmation-outline', label: 'Join with code', onPress: () => setDialog('join') },
          { icon: 'account-multiple-plus', label: 'Create group', onPress: () => setDialog('create') },
        ]}
      />

      <Portal>
        <Dialog visible={dialog !== null} onDismiss={closeDialog}>
          <Dialog.Title>{dialog === 'create' ? 'Create group' : 'Join group'}</Dialog.Title>
          <Dialog.Content style={styles.dialogContent}>
            {dialog === 'create' ? (
              <>
                <TextInput mode="outlined" label="Name" value={name} onChangeText={setName} maxLength={40} />
                <TextInput
                  mode="outlined"
                  label="Description (optional)"
                  value={description}
                  onChangeText={setDescription}
                  maxLength={200}
                  multiline
                />
              </>
            ) : (
              <TextInput
                mode="outlined"
                label="Invite code"
                value={code}
                onChangeText={(t) => setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                autoCapitalize="characters"
                maxLength={6}
              />
            )}
            {dialogError ? (
              <HelperText type="error" visible>
                {dialogError}
              </HelperText>
            ) : null}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={closeDialog}>Cancel</Button>
            <Button onPress={submit} loading={busy} disabled={busy || !canSubmit}>
              {dialog === 'create' ? 'Create' : 'Join'}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { padding: 16, gap: 12, flexGrow: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 96 },
  dialogContent: { gap: 12 },
});
