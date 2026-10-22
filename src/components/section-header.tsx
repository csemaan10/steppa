import { Pressable, StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';

import { useAppTheme, withAlpha } from '@/theme';

type Props = {
  title: string;
  /** Small caps note on the right, like a count or a date range. */
  note?: string;
  /** Turns the note into a link, e.g. to the full list. */
  onPress?: () => void;
};

/** Splits a page into sections: a rule across it, then a bold title and a small caps note. */
export function SectionHeader({ title, note, onPress }: Props) {
  const theme = useAppTheme();
  const noteText = note ? (
    <Text
      variant="labelMedium"
      style={[styles.note, { color: onPress ? theme.colors.primary : theme.colors.onSurfaceVariant }]}>
      {note.toUpperCase()}
    </Text>
  ) : null;

  return (
    <View style={styles.section}>
      <View style={[styles.rule, { backgroundColor: withAlpha(theme.colors.onSurface, 0.15) }]} />
      <View style={styles.row}>
        <Text variant="titleMedium" accessibilityRole="header" numberOfLines={1} style={styles.title}>
          {title}
        </Text>
        {onPress ? (
          <Pressable onPress={onPress} hitSlop={12} accessibilityRole="button" style={styles.link}>
            {noteText}
            <Icon source="chevron-right" size={16} color={theme.colors.primary} />
          </Pressable>
        ) : (
          noteText
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12, paddingTop: 4 },
  rule: { height: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontWeight: '800' },
  note: { letterSpacing: 1.2, fontWeight: '600' },
  link: { flexDirection: 'row', alignItems: 'center', gap: 2 },
});
