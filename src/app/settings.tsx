import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { ActivityIndicator, Appbar, Card, HelperText, Text, TextInput } from 'react-native-paper';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AccountCard } from '@/components/account-card';
import { AppLockCard } from '@/components/app-lock-card';
import { BackgroundSyncCard } from '@/components/background-sync-card';
import { BlockedUsersCard } from '@/components/blocked-users-card';
import { useGlide } from '@/components/button-group';
import { CharacterCard } from '@/components/character/character-card';
import { Collapsible } from '@/components/collapsible';
import { CollapsibleSection } from '@/components/collapsible-section';
import { GlassBackAction } from '@/components/glass-action';
import { NotificationsCard } from '@/components/notifications-card';
import { PressableScale } from '@/components/pressable-scale';
import { SectionHeader } from '@/components/section-header';
import { RingStylePicker } from '@/components/ring-style-picker';
import { StepCheckCard } from '@/components/step-check-card';
import { ThemePicker } from '@/components/theme-picker';
import { AVATAR_ICONS, UserAvatar } from '@/components/user-avatar';
import { useLoader } from '@/hooks/use-loader';
import { getProfile, updateProfile, type Profile } from '@/lib/api';
import { useUserId } from '@/providers/auth-provider';
import { avatarColors, glassCard, screenBackground, transparentHeader, useAppTheme } from '@/theme';
import { enter } from '@/theme/motion';

export default function SettingsScreen() {
  const theme = useAppTheme();
  const userId = useUserId();
  const { data: profile, error } = useLoader(() => getProfile(userId), userId);

  if (!profile) {
    return (
      <View style={[styles.flex, screenBackground(theme)]}>
        <Appbar.Header mode="small" style={transparentHeader}>
          <GlassBackAction onPress={() => router.back()} />
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

/**
 * One of the screen's blocks, rising in once in a short top-to-bottom stagger when the form first
 * shows. No layout transition: the folding cards above already push it along smoothly, and one
 * would make it trail behind them.
 */
function Block({ index, style, children }: { index: number; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  return (
    <Animated.View entering={enter(index, reduceMotion)} style={style}>
      {children}
    </Animated.View>
  );
}

function SettingsForm({ profile, userId }: { profile: Profile; userId: string }) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [goal, setGoal] = useState(String(profile.daily_goal));
  const [color, setColor] = useState(profile.avatar_color);
  const [icon, setIcon] = useState(profile.avatar_icon);
  const [openAvatar, setOpenAvatar] = useState<'color' | 'icon' | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  // The last error, kept while its line folds away after it's cleared.
  const [lastError, setLastError] = useState(saveError);
  if (saveError && saveError !== lastError) setLastError(saveError);
  // What's saved on the server, to skip saving a field that didn't change.
  const [saved, setSaved] = useState({ displayName: profile.display_name, goal: String(profile.daily_goal) });

  const iconOptions: (string | null)[] = [null, ...AVATAR_ICONS];
  const toggleAvatar = (key: 'color' | 'icon') => setOpenAvatar((current) => (current === key ? null : key));
  // One ring per picker, gliding to the new pick.
  const colorRing = useGlide(avatarColors.indexOf(color));
  const iconRing = useGlide(iconOptions.indexOf(icon));

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
        <GlassBackAction onPress={() => router.back()} />
        <Appbar.Content title="Settings" />
      </Appbar.Header>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        <Block index={0} style={styles.preview}>
          <UserAvatar name={displayName || profile.display_name} color={color} icon={icon} size={88} />
          <Text variant="titleLarge" numberOfLines={1}>
            {displayName.trim() || 'Your name'}
          </Text>
        </Block>

        <Block index={1}>
          <Card mode="contained" style={glassCard(theme)}>
            <Card.Content>
              <View style={styles.section}>
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
              </View>
              {/* Opens under the fields rather than popping in, so the card grows smoothly. */}
              <Collapsible expanded={!!saveError} style={styles.error}>
                <HelperText type="error" visible>
                  {lastError}
                </HelperText>
              </Collapsible>
            </Card.Content>
          </Card>
        </Block>

        <Block index={2}>
          <Card mode="contained" style={glassCard(theme)}>
            <Card.Title title="Avatar" titleVariant="titleMedium" />
            <Card.Content style={styles.avatarSections}>
              <CollapsibleSection
                title="Colour"
                accessory={<View style={[styles.dot, { backgroundColor: color }]} />}
                expanded={openAvatar === 'color'}
                onToggle={() => toggleAvatar('color')}>
                <View style={styles.wrap}>
                  {avatarColors.map((c, i) => (
                    <PressableScale
                      key={c}
                      pressedScale={0.92}
                      onLayout={colorRing.place(i)}
                      onPress={() => {
                        setColor(c);
                        save({ avatar_color: c });
                      }}
                      accessibilityLabel={`Color ${c}`}
                      accessibilityState={{ selected: c === color }}
                      style={[styles.swatch, { backgroundColor: c }]}
                    />
                  ))}
                  <Animated.View
                    pointerEvents="none"
                    style={[styles.swatch, styles.swatchRing, { borderColor: theme.colors.onSurface }, colorRing.style]}
                  />
                </View>
              </CollapsibleSection>
              <CollapsibleSection
                title="Icon"
                accessory={<UserAvatar name={displayName || '?'} color={color} icon={icon} size={24} />}
                expanded={openAvatar === 'icon'}
                onToggle={() => toggleAvatar('icon')}>
                <View style={styles.wrap}>
                  {iconOptions.map((option, i) => (
                    <PressableScale
                      key={option ?? 'initials'}
                      pressedScale={0.92}
                      onLayout={iconRing.place(i)}
                      onPress={() => {
                        setIcon(option);
                        save({ avatar_icon: option });
                      }}
                      accessibilityLabel={option ? `${option} avatar` : 'Initials avatar'}
                      accessibilityState={{ selected: option === icon }}
                      style={styles.iconRing}>
                      <UserAvatar name={displayName || '?'} color={color} icon={option} size={40} />
                    </PressableScale>
                  ))}
                  <Animated.View
                    pointerEvents="none"
                    style={[styles.iconRing, styles.iconMarker, { borderColor: theme.colors.onSurface }, iconRing.style]}
                  />
                </View>
              </CollapsibleSection>
            </Card.Content>
          </Card>
        </Block>

        <Block index={3}>
          <CharacterCard profile={profile} />
        </Block>

        <Block index={4}>
          <ThemePicker />
        </Block>

        {/* The rest arrive together: the stagger is capped, so a long page still lands quickly. */}
        <Block index={5} style={styles.rest}>
          <RingStylePicker />

          <AppLockCard />

          <BackgroundSyncCard />

          <BlockedUsersCard userId={userId} />

          <StepCheckCard />

          <SectionHeader title="Notifications" />
          <NotificationsCard profile={profile} />

          <SectionHeader title="Account" />
          <AccountCard userId={userId} />
        </Block>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  content: { padding: 16, gap: 12 },
  rest: { gap: 12 },
  preview: { alignItems: 'center', gap: 8, marginBottom: 4 },
  section: { gap: 12 },
  error: { paddingTop: 12 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  swatch: { width: 36, height: 36, borderRadius: 18 },
  // The chosen colour's ring, laid over the swatches.
  swatchRing: { position: 'absolute', top: 0, left: 0, borderWidth: 3 },
  iconRing: { borderWidth: 2, borderColor: 'transparent', borderRadius: 999, padding: 2 },
  // The chosen icon's ring: the same size as an option's, laid over it.
  iconMarker: { position: 'absolute', top: 0, left: 0, width: 48, height: 48 },
  avatarSections: { gap: 10, paddingBottom: 16 },
  dot: { width: 20, height: 20, borderRadius: 10 },
});
