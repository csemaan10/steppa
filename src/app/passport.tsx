import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Appbar, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SouvenirReveal } from '@/components/game/souvenir-reveal';
import { GlassBackAction } from '@/components/glass-action';
import { PassportPage } from '@/components/passport';
import { worldTitle } from '@/components/world-parts';
import { useLoader } from '@/hooks/use-loader';
import { useWorldEditor } from '@/hooks/use-world-editor';
import { claimKeepsakes, getAdventures, getWorld } from '@/lib/api';
import { keepsakeNamed, passportPages } from '@/lib/passport';
import { WORLDS } from '@/lib/world';
import { useUserId } from '@/providers/auth-provider';
import { screenBackground, transparentHeader, useAppTheme } from '@/theme';

/**
 * Your pet's passport: a page for each country, stamped wherever it has been on a trip. A full page
 * brings home a keepsake for the yard.
 */
export default function PassportScreen() {
  const theme = useAppTheme();
  const userId = useUserId();
  const insets = useSafeAreaInsets();
  const { data, error } = useLoader(async () => {
    const [keepsakes, adventures, status] = await Promise.all([
      claimKeepsakes(),
      getAdventures(userId),
      getWorld(userId).catch(() => null),
    ]);
    return { keepsakes, adventures, status };
  }, userId);
  const editor = useWorldEditor(userId, data?.status?.world ?? null);
  const [open, setOpen] = useState<string | null>(null);
  // Keepsakes just brought home, shown one at a time.
  const [shown, setShown] = useState<{ from: string[]; seen: number }>({ from: [], seen: 0 });
  const fresh = data?.keepsakes ?? [];
  const seen = shown.from === fresh ? shown.seen : 0;
  const revealing = fresh[seen] ? keepsakeNamed(fresh[seen]) : undefined;

  const world = editor.world && WORLDS[editor.world.kind] ? editor.world : null;
  const name = world ? worldTitle(WORLDS[world.kind], world.picks[world.kind]?.name) : 'your pet';
  const pages = data ? passportPages(data.adventures) : [];
  const stamped = pages.reduce((sum, p) => sum + p.filled, 0);
  const places = pages.reduce((sum, p) => sum + p.stamps.length, 0);
  const full = pages.filter((p) => p.filled === p.stamps.length).length;

  return (
    <View style={[styles.flex, screenBackground(theme)]}>
      <Appbar.Header style={transparentHeader}>
        <GlassBackAction onPress={() => router.back()} />
        <Appbar.Content title={world ? `${name}'s passport` : 'Passport'} />
      </Appbar.Header>

      {!data ? (
        <View style={styles.center}>
          {error ? <Text style={{ color: theme.colors.error }}>{error}</Text> : <ActivityIndicator />}
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
          <View style={styles.intro}>
            <Text variant="titleMedium" style={styles.bold}>
              {stamped} of {places} places · {full} {full === 1 ? 'keepsake' : 'keepsakes'}
            </Text>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              Every place {name} goes on a trip gets a stamp. Fill a country&apos;s page and {name} brings
              home a keepsake for the yard.
            </Text>
          </View>
          {pages.map((page) => (
            <PassportPage
              key={page.country.flag}
              page={page}
              name={name}
              expanded={open === page.country.flag}
              onToggle={() => setOpen(open === page.country.flag ? null : page.country.flag)}
            />
          ))}
        </ScrollView>
      )}

      {revealing ? (
        <SouvenirReveal
          key={revealing.souvenir.choice.id}
          souvenir={revealing.souvenir}
          from={revealing.country}
          name={name}
          onWear={() => {
            setShown({ from: fresh, seen: seen + 1 });
            if (world) editor.pick('keepsake', revealing.souvenir.choice.id);
          }}
          onLater={() => setShown({ from: fresh, seen: seen + 1 })}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  content: { padding: 16, paddingTop: 8, gap: 12 },
  intro: { gap: 4, paddingHorizontal: 4, paddingBottom: 4 },
  bold: { fontWeight: '700' },
});
