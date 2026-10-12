import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Appbar, Card, HelperText, Text, TextInput, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AccountCard } from '@/components/account-card';
import { AppLockCard } from '@/components/app-lock-card';
import { BackgroundSyncCard } from '@/components/background-sync-card';
import { BlockedUsersCard } from '@/components/blocked-users-card';
import { CharacterEditorCard } from '@/components/character/character-editor-card';
import { CollapsibleSection } from '@/components/collapsible-section';
import { RingStylePicker } from '@/components/ring-style-picker';
import { StepCheckCard } from '@/components/step-check-card';
import { ThemePicker } from '@/components/theme-picker';
import { AVATAR_ICONS, UserAvatar } from '@/components/user-avatar';
import { useLoader } from '@/hooks/use-loader';
import { getProfile, updateProfile, type Profile } from '@/lib/api';
import { useUserId } from '@/providers/auth-provider';
import { avatarColors, screenBackground, surfaceCard, transparentHeader } from '@/theme';

export default function SettingsScreen() {
  const theme = useTheme();
  const userId = useUserId();
  const { data: profile, error } = useLoader(() => getProfile(userId), userId);

  if (!profile) {
    return (
      <View style={[styles.flex, screenBackground(theme)]}>
        <Appbar.Header mode="small" style={transparentHeader}>
          <Appbar.BackAction onPress={() => router.back()} />
          <Appbar.Content title="Settings" />
        </Appbar.Header>
        <View style={styles.center}>
          {error ? <Text style={{ color: theme.colors.error }}>{error}</Text> : <ActivityIndicator />}
        </View>
      </View>
    );
  }

  // Keyed so the form seeds from the profile once; focus reloads don't wipe edits.
  return <SettingsForm key={profile.id} profile={profile} userId={userId} />;
}

function SettingsForm({ profile, userId }: { profile: Profile; userId: string }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  // Opened from the Today card with focus=character: scroll the character editor into view.
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const scroller = useRef<ScrollView>(null);
  const scrolledToFocus = useRef(false);
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [goal, setGoal] = useState(String(profile.daily_goal));
  const [color, setColor] = useState(profile.avatar_color);
  const [icon, setIcon] = useState(profile.avatar_icon);
  const [openAvatar, setOpenAvatar] = useState<'color' | 'icon' | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  // What's saved on the server, to skip saving a field that didn't change.
  const [saved, setSaved] = useState({ displayName: profile.display_name, goal: String(profile.daily_goal) });

  const iconOptions: (string | null)[] = [null, ...AVATAR_ICONS];
  const toggleAvatar = (key: 'color' | 'icon') => setOpenAvatar((current) => (current === key ? null : key));

  // Everything on this screen saves as you change it, like the cards below.
  async function save(patch: Parameters<typeof updateProfile>[1]) {
    try {
      await updateProfile(userId, patch);
      setSaveError(null);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Could not save');
    }
  }

  function saveName() {
    const name = displayName.trim();
    if (!name) {
      setSaveError('Enter a name.');
      return;
    }
    if (name === saved.displayName) return;
    setSaved((prev) => ({ ...prev, displayName: name }));
    save({ display_name: name });
  }

  function saveGoal() {
    const goalNum = Number(goal);
    if (!Number.isInteger(goalNum) || goalNum < 1000 || goalNum > 100000) {
      setSaveError('Enter a goal between 1,000 and 100,000 steps.');
      return;
    }
    if (goal === saved.goal) return;
    setSaved((prev) => ({ ...prev, goal }));
    save({ daily_goal: goalNum });
  }

  return (
    <View style={[styles.flex, screenBackground(theme)]}>
      <Appbar.Header mode="small" style={transparentHeader}>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Settings" />
      </Appbar.Header>

      <ScrollView ref={scroller} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.preview}>
          <UserAvatar name={displayName || profile.display_name} color={color} icon={icon} size={88} />
          <Text variant="titleLarge" numberOfLines={1}>
            {displayName.trim() || 'Your name'}
          </Text>
        </View>

        <Card mode="contained" style={surfaceCard(theme)}>
          <Card.Content style={styles.section}>
            <TextInput
              mode="outlined"
              label="Display name"
              value={displayName}
              onChangeText={setDisplayName}
              onBlur={saveName}
              maxLength={40}
            />
            <TextInput
              mode="outlined"
              label="Daily step goal"
              value={goal}
              onChangeText={(t) => setGoal(t.replace(/\D/g, ''))}
              onBlur={saveGoal}
              keyboardType="number-pad"
            />
            {saveError ? (
              <HelperText type="error" visible>
                {saveError}
              </HelperText>
            ) : null}
          </Card.Content>
        </Card>

        <Card mode="contained" style={surfaceCard(theme)}>
          <Card.Title title="Avatar" titleVariant="titleMedium" />
          <Card.Content style={styles.avatarSections}>
            <CollapsibleSection
              title="Colour"
              accessory={<View style={[styles.dot, { backgroundColor: color }]} />}
              expanded={openAvatar === 'color'}
              onToggle={() => toggleAvatar('color')}>
              <View style={styles.wrap}>
                {avatarColors.map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => {
                      setColor(c);
                      save({ avatar_color: c });
                    }}
                    accessibilityLabel={`Color ${c}`}
                    accessibilityState={{ selected: c === color }}
                    style={[
                      styles.swatch,
                      { backgroundColor: c },
                      c === color && { borderColor: theme.colors.onSurface, borderWidth: 3 },
                    ]}
                  />
                ))}
              </View>
            </CollapsibleSection>
            <CollapsibleSection
              title="Icon"
              accessory={<UserAvatar name={displayName || '?'} color={color} icon={icon} size={24} />}
              expanded={openAvatar === 'icon'}
              onToggle={() => toggleAvatar('icon')}>
              <View style={styles.wrap}>
                {iconOptions.map((option) => {
                  const selected = option === icon;
                  return (
                    <Pressable
                      key={option ?? 'initials'}
                      onPress={() => {
                        setIcon(option);
                        save({ avatar_icon: option });
                      }}
                      accessibilityLabel={option ? `${option} avatar` : 'Initials avatar'}
                      accessibilityState={{ selected }}
                      style={[styles.iconRing, { borderColor: selected ? theme.colors.onSurface : 'transparent' }]}>
                      <UserAvatar name={displayName || '?'} color={color} icon={option} size={40} />
                    </Pressable>
                  );
                })}
              </View>
            </CollapsibleSection>
          </Card.Content>
        </Card>

        <View
          onLayout={(e) => {
            if (focus !== 'character' || scrolledToFocus.current) return;
            scrolledToFocus.current = true;
            scroller.current?.scrollTo({ y: e.nativeEvent.layout.y - 8, animated: true });
          }}>
          <CharacterEditorCard key={profile.id} profile={profile} />
        </View>

        <ThemePicker />

        <RingStylePicker />

        <AppLockCard />

        <BackgroundSyncCard />

        <BlockedUsersCard userId={userId} />

        <StepCheckCard />

        <AccountCard userId={userId} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  content: { padding: 16, gap: 12 },
  preview: { alignItems: 'center', gap: 8, marginBottom: 4 },
  section: { gap: 12 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  swatch: { width: 36, height: 36, borderRadius: 18 },
  iconRing: { borderWidth: 2, borderRadius: 999, padding: 2 },
  avatarSections: { gap: 10, paddingBottom: 16 },
  dot: { width: 20, height: 20, borderRadius: 10 },
});
