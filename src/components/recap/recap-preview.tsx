import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Card, Icon, Text, useTheme } from 'react-native-paper';

import { Button } from '@/components/button';
import { recapDayLabel, type Recap } from '@/lib/recap';
import { glassCard, withAlpha } from '@/theme';

/**
 * Small Today-screen card pointing to the morning recap. It doesn't show the results, so the
 * podium stays a surprise until the recap is opened.
 */
export function RecapPreview({ recap }: { recap: Recap }) {
  const theme = useTheme();
  const count = recap.groups.length;
  const open = () => router.push('/recap');

  return (
    <Card mode="contained" style={glassCard(theme)} onPress={open} accessibilityHint="Opens the podium recap">
      <View style={styles.row}>
        <View style={[styles.badge, { backgroundColor: withAlpha('#F5CD4B', theme.dark ? 0.25 : 0.35) }]}>
          <Icon source="podium-gold" size={22} color="#C99A1B" />
        </View>
        <View style={styles.text}>
          <Text variant="titleSmall">{recapDayLabel(recap.day)}&apos;s podium</Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {count === 1 ? 'Results are in for 1 group' : `Results are in for ${count} groups`}
          </Text>
        </View>
        <Button compact mode="contained-tonal" icon="play" onPress={open}>
          Watch
        </Button>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 10 },
  badge: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
});
