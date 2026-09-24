import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import {
  Appbar,
  Avatar,
  Button,
  Card,
  Dialog,
  HelperText,
  Icon,
  Portal,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { openGroupFrom } from '@/components/expand-transition';
import { FabMenu } from '@/components/fab-menu';
import { TAB_BAR_OFFSET, useTabBarSpace } from '@/components/floating-tab-bar';
import { useLoader } from '@/hooks/use-loader';
import { createGroup, getMyGroups, joinGroup, type GroupWithCount } from '@/lib/api';
import { useUserId } from '@/providers/auth-provider';
import { screenBackground, transparentHeader } from '@/theme';

type DialogKind = 'create' | 'join' | null;

export default function GroupsScreen() {
  const theme = useTheme();
  const userId = useUserId();
  const tabBarSpace = useTabBarSpace();
  const insets = useSafeAreaInsets();
  const { data: groups, loading, error, reload } = useLoader(getMyGroups, userId);
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
    try {
      const groupId =
        dialog === 'create'
          ? (await createGroup(userId, name, description)).id
          : await joinGroup(code);
      closeDialog();
      router.push({ pathname: '/group/[id]', params: { id: groupId } });
    } catch (e) {
      setDialogError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = dialog === 'create' ? name.trim().length > 0 : code.trim().length === 6;

  return (
    <View style={[styles.flex, screenBackground(theme)]}>
      <Appbar.Header style={transparentHeader}>
        <Appbar.Content title="Groups" />
      </Appbar.Header>

      <FlatList
        data={groups ?? []}
        keyExtractor={(g) => g.id}
        contentContainerStyle={[styles.list, { paddingBottom: tabBarSpace + 64 }]}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Avatar.Icon icon="account-group-outline" size={72} />
              <Text variant="titleMedium">{error ?? 'No groups yet'}</Text>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                Create a group or join one with an invite code.
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => <GroupCard group={item} isOwner={item.owner_id === userId} />}
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

function GroupCard({ group, isOwner }: { group: GroupWithCount; isOwner: boolean }) {
  const theme = useTheme();
  const ref = useRef<View>(null);
  return (
    <View ref={ref} collapsable={false}>
      <Card
        mode="contained"
        style={{ backgroundColor: theme.colors.elevation.level1 }}
        onPress={() => openGroupFrom(ref.current, group.id)}>
        <Card.Title
          title={group.name}
          titleVariant="titleMedium"
          subtitle={`${group.member_count} member${group.member_count === 1 ? '' : 's'}`}
          subtitleStyle={{ color: theme.colors.onSurfaceVariant }}
          left={(props) => (
            <Avatar.Icon
              {...props}
              icon="account-group"
              color={theme.colors.onPrimaryContainer}
              style={{ backgroundColor: theme.colors.primaryContainer }}
            />
          )}
          right={() => (
            <View style={styles.trailing}>
              {isOwner ? (
                <View style={[styles.badge, { backgroundColor: theme.colors.secondaryContainer }]}>
                  <Text variant="labelSmall" style={{ color: theme.colors.onSecondaryContainer }}>
                    Owner
                  </Text>
                </View>
              ) : null}
              <Icon source="chevron-right" size={24} color={theme.colors.onSurfaceVariant} />
            </View>
          )}
        />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { padding: 16, gap: 12, flexGrow: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 96 },
  trailing: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 12 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  dialogContent: { gap: 12 },
});
