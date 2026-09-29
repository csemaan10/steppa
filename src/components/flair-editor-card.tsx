import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Card, HelperText, Icon, List, Switch, Text, useTheme } from 'react-native-paper';

import { FLAIR_COLORS, FLAIR_ICONS, FlairAvatar, FlairBadge } from '@/components/flair';
import { updateProfile, type Flair, type Profile } from '@/lib/api';
import { formatSteps } from '@/lib/dates';
import { surfaceCard } from '@/theme';

type Props = { profile: Profile };

/** Profile card for choosing how you look on leaderboards: accent colour, badge icon, glow. */
export function FlairEditorCard({ profile }: Props) {
  const theme = useTheme();
  const [flair, setFlair] = useState<Flair>({
    flair_icon: profile.flair_icon ?? null,
    flair_color: profile.flair_color ?? null,
    flair_glow: profile.flair_glow ?? false,
  });
  const [error, setError] = useState<string | null>(null);

  // Save each change right away; roll back if the server rejects it.
  function change(patch: Partial<Flair>) {
    const previous = flair;
    setFlair({ ...flair, ...patch });
    setError(null);
    updateProfile(profile.id, patch).catch((e) => {
      setFlair(previous);
      setError(e instanceof Error ? e.message : 'Could not save');
    });
  }

  const selectedBorder = { borderColor: theme.colors.onSurface };

  return (
    <Card mode="contained" style={surfaceCard(theme)}>
      <Card.Title title="Leaderboard style" subtitle="How you appear in every group" titleVariant="titleMedium" />
      <Card.Content style={styles.content}>
        {/* Live preview, styled like a leaderboard row. */}
        <View style={[styles.preview, { backgroundColor: theme.colors.surfaceVariant }]}>
          <FlairAvatar
            name={profile.display_name}
            color={profile.avatar_color}
            icon={profile.avatar_icon}
            size={40}
            {...flair}
          />
          <View style={styles.previewName}>
            <Text variant="titleSmall" numberOfLines={1} style={styles.shrink}>
              {profile.display_name}
            </Text>
            <FlairBadge {...flair} fallbackColor={theme.colors.onSurfaceVariant} />
          </View>
          <Text variant="titleMedium">{formatSteps(12345)}</Text>
        </View>

        <Text variant="labelLarge">Accent colour</Text>
        <View style={styles.wrap}>
          <Pressable
            onPress={() => change({ flair_color: null })}
            accessibilityLabel="No accent colour"
            accessibilityState={{ selected: !flair.flair_color }}
            style={[styles.swatch, styles.none, { borderColor: theme.colors.outline }, !flair.flair_color && selectedBorder]}>
            <Icon source="cancel" size={18} color={theme.colors.onSurfaceVariant} />
          </Pressable>
          {FLAIR_COLORS.map((c) => (
            <Pressable
              key={c}
              onPress={() => change({ flair_color: c })}
              accessibilityLabel={`Accent ${c}`}
              accessibilityState={{ selected: flair.flair_color === c }}
              style={[
                styles.swatch,
                { backgroundColor: c, borderColor: 'transparent' },
                flair.flair_color === c && selectedBorder,
              ]}
            />
          ))}
        </View>

        <Text variant="labelLarge">Badge</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.icons}>
          {[null, ...FLAIR_ICONS].map((option) => {
            const selected = option === flair.flair_icon;
            return (
              <Pressable
                key={option ?? 'none'}
                onPress={() => change({ flair_icon: option })}
                accessibilityLabel={option ? `${option} badge` : 'No badge'}
                accessibilityState={{ selected }}
                style={[
                  styles.iconChip,
                  { backgroundColor: selected ? theme.colors.secondaryContainer : 'transparent' },
                ]}>
                <Icon
                  source={option ?? 'cancel'}
                  size={22}
                  color={
                    option
                      ? (flair.flair_color ?? theme.colors.onSurfaceVariant)
                      : theme.colors.onSurfaceVariant
                  }
                />
              </Pressable>
            );
          })}
        </ScrollView>

        {error ? (
          <HelperText type="error" visible>
            {error}
          </HelperText>
        ) : null}
      </Card.Content>
      <List.Item
        title="Glow"
        description="A soft glow around your avatar"
        left={(props) => <List.Icon {...props} icon="shimmer" />}
        right={() => <Switch value={flair.flair_glow} onValueChange={(on) => change({ flair_glow: on })} />}
        onPress={() => change({ flair_glow: !flair.flair_glow })}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { gap: 12 },
  preview: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16 },
  previewName: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  shrink: { flexShrink: 1 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatch: { width: 32, height: 32, borderRadius: 16, borderWidth: 3 },
  none: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  icons: { gap: 4 },
  iconChip: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
