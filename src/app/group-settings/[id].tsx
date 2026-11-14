import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import {
  ActivityIndicator,
  Appbar,
  Card,
  HelperText,
  IconButton,
  Text,
  TextInput,
} from 'react-native-paper';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Appear } from '@/components/appear';
import { Button } from '@/components/button';
import { GlassAction, GlassBackAction } from '@/components/glass-action';
import { GROUP_ICONS, GroupAvatar } from '@/components/group-avatar';
import { SwapText } from '@/components/swap-text';
import { UserAvatar } from '@/components/user-avatar';
import { usePressed } from '@/hooks/use-pressed';
import { useLoader } from '@/hooks/use-loader';
import {
  deleteGroup,
  getGroup,
  getLeaderboard,
  leaveGroup,
  regenerateInviteCode,
  updateGroup,
  type Group,
  type LeaderboardRow,
} from '@/lib/api';
import { useUserId } from '@/providers/auth-provider';
import { avatarColors, glassCard, screenBackground, transparentHeader, useAppTheme } from '@/theme';
import { layoutMove, leave, motion } from '@/theme/motion';

export default function GroupSettingsScreen() {
  const theme = useAppTheme();
  const userId = useUserId();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data, error, reload } = useLoader(async () => {
    const [group, members] = await Promise.all([getGroup(id), getLeaderboard(id, 'today')]);
    return { group, members };
  }, id);

  if (!data) {
    return (
      <View style={[styles.flex, screenBackground(theme)]}>
        <Appbar.Header mode="small" style={transparentHeader}>
          <GlassBackAction onPress={() => router.back()} />
          <Appbar.Content title="Group settings" />
        </Appbar.Header>
        <View style={styles.center}>
          {error ? <Text style={{ color: theme.colors.error }}>{error}</Text> : <ActivityIndicator />}
        </View>
      </View>
    );
  }

  if (data.group.owner_id !== userId) {
    return (
      <View style={[styles.flex, screenBackground(theme)]}>
        <Appbar.Header mode="small" style={transparentHeader}>
          <GlassBackAction onPress={() => router.back()} />
          <Appbar.Content title="Group settings" />
        </Appbar.Header>
        <View style={styles.center}>
          <Text style={{ color: theme.colors.onSurfaceVariant }}>Only the group owner can change settings.</Text>
        </View>
      </View>
    );
  }

  // Keyed so the form seeds from the group once; focus reloads refresh members without wiping edits.
  return <SettingsForm key={data.group.id} group={data.group} members={data.members} userId={userId} reload={reload} />;
}

type FormProps = { group: Group; members: LeaderboardRow[]; userId: string; reload: () => Promise<void> };

function SettingsForm({ group, members, userId, reload }: FormProps) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const id = group.id;
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description ?? '');
  const [color, setColor] = useState(group.color);
  const [icon, setIcon] = useState(group.icon);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const dirty =
    name.trim() !== group.name ||
    (description.trim() || null) !== group.description ||
    color !== group.color ||
    icon !== group.icon;

  async function save() {
    if (!name.trim()) {
      setSaveError('Give the group a name.');
      return;
    }
    setSaving(true);
    try {
      await updateGroup(id, { name: name.trim(), description: description.trim() || null, color, icon });
      setSaveError(null);
      router.back();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  function confirm(title: string, message: string, action: string, run: () => Promise<unknown>) {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: action,
        style: 'destructive',
        onPress: async () => {
          try {
            await run();
          } catch (e) {
            Alert.alert('Error', e instanceof Error ? e.message : String(e));
          }
        },
      },
    ]);
  }

  return (
    <View style={[styles.flex, screenBackground(theme)]}>
      <Appbar.Header mode="small" style={transparentHeader}>
        <GlassBackAction onPress={() => router.back()} />
        <Appbar.Content title="Group settings" />
        <GlassAction
          icon="check"
          onPress={save}
          disabled={!dirty || saving}
          accessibilityLabel="Save"
        />
      </Appbar.Header>

      {/* The form's blocks rise in top to bottom once the group has loaded. */}
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        <Appear style={styles.preview}>
          <GroupAvatar name={name || group.name} color={color} icon={icon} size={88} />
          <Text variant="titleLarge" numberOfLines={1}>
            {name.trim() || 'Untitled group'}
          </Text>
        </Appear>

        <Appear index={1}>
          <Card mode="contained" style={glassCard(theme)}>
            <Card.Content style={styles.section}>
              <TextInput mode="outlined" label="Name" value={name} onChangeText={setName} maxLength={40} />
              <TextInput
                mode="outlined"
                label="Description"
                value={description}
                onChangeText={setDescription}
                maxLength={200}
                multiline
              />
              {saveError ? (
                <Appear exits>
                  <HelperText type="error" visible>
                    {saveError}
                  </HelperText>
                </Appear>
              ) : null}
            </Card.Content>
          </Card>
        </Appear>

        <Appear index={2}>
          <Card mode="contained" style={glassCard(theme)}>
            <Card.Content style={styles.section}>
              <Text variant="titleSmall">Color</Text>
              <View style={styles.wrap}>
                {avatarColors.map((c) => (
                  <Choice
                    key={c}
                    selected={c === color}
                    onPress={() => setColor(c)}
                    accessibilityLabel={`Color ${c}`}
                    ringStyle={[styles.swatchRing, { borderColor: theme.colors.onSurface }]}>
                    <View style={[styles.swatch, { backgroundColor: c }]} />
                  </Choice>
                ))}
              </View>
              <Text variant="titleSmall">Icon</Text>
              <View style={styles.wrap}>
                {[null, ...GROUP_ICONS].map((option) => (
                  <Choice
                    key={option ?? 'letter'}
                    selected={option === icon}
                    onPress={() => setIcon(option)}
                    accessibilityLabel={option ? `${option} icon` : 'First letter'}
                    ringStyle={[styles.iconRing, { borderColor: theme.colors.onSurface }]}>
                    <View style={styles.iconPad}>
                      <GroupAvatar name={name || group.name} color={color} icon={option} size={40} />
                    </View>
                  </Choice>
                ))}
              </View>
            </Card.Content>
          </Card>
        </Appear>

        <Appear index={3}>
          <Card mode="contained" style={glassCard(theme)}>
            <Card.Content style={styles.section}>
              <Text variant="titleSmall">Invite code</Text>
              <View style={styles.codeRow}>
                {/* A replaced code crossfades in, so it's clear it changed. */}
                <SwapText variant="headlineSmall" style={styles.code}>
                  {group.invite_code}
                </SwapText>
                <Button
                  mode="contained-tonal"
                  icon="refresh"
                  onPress={() =>
                    confirm('New invite code?', 'The current code will stop working.', 'Replace', async () => {
                      await regenerateInviteCode(id);
                      await reload();
                    })
                  }>
                  New code
                </Button>
              </View>
            </Card.Content>
          </Card>
        </Appear>

        <Appear index={4}>
          <Card mode="contained" style={glassCard(theme)}>
            <Card.Content style={styles.section}>
              <SwapText variant="titleSmall">{`Members · ${members.length}`}</SwapText>
              {/* A removed member fades out and the rest slide up. */}
              {members.map((m) => (
                <Animated.View key={m.user_id} exiting={leave(reduceMotion)} layout={layoutMove} style={styles.member}>
                  <UserAvatar name={m.display_name} color={m.avatar_color} icon={m.avatar_icon} size={36} />
                  <View style={styles.flex}>
                    <Text variant="bodyLarge" numberOfLines={1}>
                      {m.display_name}
                    </Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                      {m.user_id === group.owner_id ? 'Owner' : `@${m.username}`}
                    </Text>
                  </View>
                  {m.user_id !== userId ? (
                    <IconButton
                      icon="account-remove-outline"
                      iconColor={theme.colors.error}
                      accessibilityLabel={`Remove ${m.display_name}`}
                      onPress={() =>
                        confirm(
                          `Remove ${m.display_name}?`,
                          'They can rejoin with the invite code unless you replace it.',
                          'Remove',
                          async () => {
                            await leaveGroup(id, m.user_id);
                            await reload();
                          }
                        )
                      }
                    />
                  ) : null}
                </Animated.View>
              ))}
            </Card.Content>
          </Card>
        </Appear>

        <Appear index={5}>
          <Button
            mode="outlined"
            icon="delete-outline"
            textColor={theme.colors.error}
            style={{ borderColor: theme.colors.error }}
            onPress={() =>
              confirm('Delete group?', 'This removes the group for everyone.', 'Delete', async () => {
                await deleteGroup(id);
                router.dismissTo('/groups');
              })
            }>
            Delete group
          </Button>
        </Appear>
      </ScrollView>
    </View>
  );
}

type ChoiceProps = {
  selected: boolean;
  onPress: () => void;
  accessibilityLabel: string;
  /** The selection ring, laid over the choice. */
  ringStyle: StyleProp<ViewStyle>;
  children: ReactNode;
};

/**
 * A colour or icon to pick: dips while held like the app's small buttons, and its selection ring
 * fades in as it settles onto it (and out of the one that was picked before).
 */
function Choice({ selected, onPress, accessibilityLabel, ringStyle, children }: ChoiceProps) {
  const press = usePressed();
  const on = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    on.set(withSpring(selected ? 1 : 0, motion.snappy));
  }, [on, selected]);
  const dip = useAnimatedStyle(() => ({ transform: [{ scale: 1 - press.pressed.value * 0.08 }] }));
  const ring = useAnimatedStyle(() => ({
    opacity: on.value,
    transform: [{ scale: interpolate(on.value, [0, 1], [1.12, 1]) }],
  }));
  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      style={dip}>
      {children}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, ringStyle, ring]} />
    </AnimatedPressable>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  content: { padding: 16, gap: 12 },
  preview: { alignItems: 'center', gap: 8, marginBottom: 4 },
  section: { gap: 12 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  swatch: { width: 36, height: 36, borderRadius: 18 },
  swatchRing: { borderWidth: 3, borderRadius: 18 },
  iconPad: { padding: 4 },
  iconRing: { borderWidth: 2, borderRadius: 18 },
  codeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  code: { fontWeight: '700', letterSpacing: 4 },
  member: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
