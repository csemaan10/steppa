import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Button, Card, Icon, Text, useTheme } from 'react-native-paper';

import { GroupAvatar } from '@/components/group-avatar';
import { RecapPlacement } from '@/components/recap/recap-placement';
import { RecapPodium } from '@/components/recap/recap-podium';
import { recapDayLabel, type Recap } from '@/lib/recap';
import { surfaceCard } from '@/theme';

/** Today-screen card with a mini version of the morning recap; one swipeable page per group. */
export function RecapPreview({ recap, userId }: { recap: Recap; userId: string }) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const [page, setPage] = useState(0);

  function onScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    if (width) setPage(Math.round(e.nativeEvent.contentOffset.x / width));
  }

  const open = (index: number) => router.push({ pathname: '/recap', params: { group: String(index) } });

  return (
    <Card mode="contained" style={surfaceCard(theme)}>
      <View style={styles.header}>
        <Icon source="podium-gold" size={20} color={theme.colors.primary} />
        <Text variant="titleMedium" style={styles.title}>
          {recapDayLabel(recap.day)}&apos;s podium
        </Text>
        <Button compact icon="play" onPress={() => open(page)}>
          Replay
        </Button>
      </View>
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width ? (
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onScrollEnd}>
            {recap.groups.map((g, i) => (
              <Pressable
                key={g.group.id}
                style={[styles.page, { width }]}
                onPress={() => open(i)}
                accessibilityRole="button"
                accessibilityHint="Opens the full recap">
                <View style={styles.groupRow}>
                  <GroupAvatar name={g.group.name} color={g.group.color} icon={g.group.icon} size={22} />
                  <Text variant="labelLarge" numberOfLines={1} style={[styles.groupName, { color: theme.colors.onSurfaceVariant }]}>
                    {g.group.name}
                  </Text>
                </View>
                <RecapPodium podium={g.podium} userId={userId} compact play={i === page} />
                {g.me ? (
                  <RecapPlacement me={g.me} podium={g.podium} total={g.rows.length} compact play={i === page} />
                ) : null}
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
      </View>
      {recap.groups.length > 1 ? (
        <View style={styles.dots}>
          {recap.groups.map((g, i) => (
            <View
              key={g.group.id}
              style={[styles.dot, { backgroundColor: i === page ? theme.colors.primary : theme.colors.outlineVariant }]}
            />
          ))}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 16, paddingRight: 8, paddingTop: 8 },
  title: { flex: 1 },
  page: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 14, gap: 12 },
  groupRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  groupName: { flexShrink: 1 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingBottom: 12, marginTop: -4 },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
