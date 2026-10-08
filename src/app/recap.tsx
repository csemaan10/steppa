import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { ActivityIndicator, Button, IconButton, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GroupAvatar } from '@/components/group-avatar';
import { Confetti } from '@/components/recap/celebration';
import { RecapPlacement, placementOf } from '@/components/recap/recap-placement';
import { RecapPodium } from '@/components/recap/recap-podium';
import { useLoader } from '@/hooks/use-loader';
import { cachedRecap, loadRecap, markRecapSeen, recapDay, recapDayLabel, type GroupRecap } from '@/lib/recap';
import { useUserId } from '@/providers/auth-provider';
import { screenBackground, useAppTheme } from '@/theme';

/** Morning recap: yesterday's final podium in each group, one page per group. */
export default function RecapScreen() {
  const theme = useAppTheme();
  const userId = useUserId();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { group } = useLocalSearchParams<{ group?: string }>();
  const day = recapDay();
  const cached = cachedRecap(day);
  const { data } = useLoader(() => (cached ? Promise.resolve(cached) : loadRecap(userId, undefined, day)), `${userId}:${day}`);
  const recap = data ?? cached;
  const pages = recap?.groups ?? [];
  const [page, setPage] = useState(() => Number(group) || 0);
  const pager = useRef<ScrollView>(null);

  useEffect(() => markRecapSeen(day), [day]);

  function onScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    setPage(Math.round(e.nativeEvent.contentOffset.x / width));
  }

  function next() {
    if (page >= pages.length - 1) return router.back();
    pager.current?.scrollTo({ x: (page + 1) * width, animated: true });
    setPage(page + 1);
  }

  const date = new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { month: 'long', day: 'numeric' });

  return (
    <View style={[styles.flex, screenBackground(theme), { paddingTop: insets.top, paddingBottom: insets.bottom + 12 }]}>
      <View style={styles.header}>
        <View style={styles.flex}>
          <Text variant="headlineSmall" style={styles.bold}>
            {recapDayLabel(day)}&apos;s podium
          </Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            Final results · {date}
          </Text>
        </View>
        <IconButton icon="close" onPress={() => router.back()} accessibilityLabel="Close" />
      </View>

      {!recap ? (
        <ActivityIndicator style={styles.flex} />
      ) : pages.length === 0 ? (
        <View style={[styles.flex, styles.center]}>
          <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant }}>
            Nobody in your groups logged steps.
          </Text>
        </View>
      ) : (
        <ScrollView
          ref={pager}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScrollEnd}
          contentOffset={{ x: page * width, y: 0 }}
          // Android can ignore contentOffset, so jump to the tapped group once laid out too.
          onLayout={() => page > 0 && pager.current?.scrollTo({ x: page * width, animated: false })}
          style={styles.flex}>
          {pages.map((g, i) => (
            <RecapPage key={g.group.id} recap={g} userId={userId} width={width} height={height} active={i === page} />
          ))}
        </ScrollView>
      )}

      {pages.length ? (
        <View style={styles.footer}>
          <View style={styles.dots}>
            {pages.length > 1
              ? pages.map((g, i) => (
                  <View
                    key={g.group.id}
                    style={[
                      styles.dot,
                      { backgroundColor: i === page ? theme.colors.primary : theme.colors.outlineVariant },
                      i === page && styles.dotActive,
                    ]}
                  />
                ))
              : null}
          </View>
          <Button mode="contained" onPress={next} contentStyle={styles.buttonContent}>
            {page >= pages.length - 1 ? 'Done' : 'Next group'}
          </Button>
        </View>
      ) : null}
    </View>
  );
}

type PageProps = { recap: GroupRecap; userId: string; width: number; height: number; active: boolean };

function RecapPage({ recap, userId, width, height, active }: PageProps) {
  const theme = useAppTheme();
  const { group, podium, rows, me } = recap;
  const onPodium = !!me && placementOf(me, podium).kind === 'podium';
  // Only the page on screen plays; it replays each time you swipe back to it.
  return (
    <View style={{ width }}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.groupRow}>
          <GroupAvatar name={group.name} color={group.color} icon={group.icon} size={32} />
          <Text variant="titleMedium" numberOfLines={1} style={styles.flexShrink}>
            {group.name}
          </Text>
        </View>
        <RecapPodium podium={podium} userId={userId} play={active} />
        {me ? (
          <RecapPlacement me={me} podium={podium} total={rows.length} play={active} />
        ) : null}
        {podium.length < 3 ? (
          <Text variant="bodySmall" style={[styles.note, { color: theme.colors.onSurfaceVariant }]}>
            Only {podium.length === 1 ? 'one person' : 'two people'} logged steps.
          </Text>
        ) : null}
      </ScrollView>
      {onPodium ? <Confetti width={width} height={height} play={active} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexShrink: { flexShrink: 1 },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  bold: { fontWeight: '700' },
  header: { flexDirection: 'row', alignItems: 'center', paddingLeft: 20, paddingRight: 4, paddingVertical: 8 },
  page: { padding: 20, gap: 24, flexGrow: 1, justifyContent: 'center' },
  groupRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  note: { textAlign: 'center' },
  footer: { paddingHorizontal: 20, gap: 16 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, minHeight: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotActive: { width: 20 },
  buttonContent: { paddingVertical: 6 },
});
