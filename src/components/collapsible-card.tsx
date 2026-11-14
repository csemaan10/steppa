import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Text } from 'react-native-paper';

import { Collapsible } from '@/components/collapsible';
import { Chevron } from '@/components/collapsible-section';
import { PressableScale } from '@/components/pressable-scale';
import { SwapText } from '@/components/swap-text';
import { glassCard, useAppTheme } from '@/theme';

type Props = {
  title: string;
  /** A small preview of what's chosen, shown on the right of the header. */
  preview?: ReactNode;
  /** What's chosen, in words, under the title. */
  summary?: string;
  children: ReactNode;
};

/**
 * A settings card that folds down to its title and a preview of the current choice. Starts closed.
 * The header dips while held, and the summary crossfades as the choice changes.
 */
export function CollapsibleCard({ title, preview, summary, children }: Props) {
  const theme = useAppTheme();
  const [expanded, setExpanded] = useState(false);

  return (
    <Card mode="contained" style={glassCard(theme)}>
      <PressableScale
        onPress={() => setExpanded((e) => !e)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={summary ? `${title}: ${summary}` : title}
        style={styles.header}>
        <View style={styles.text}>
          <Text variant="titleMedium">{title}</Text>
          {summary ? (
            <SwapText variant="bodyMedium" numberOfLines={1} style={{ color: theme.colors.onSurfaceVariant }}>
              {summary}
            </SwapText>
          ) : null}
        </View>
        {preview}
        <Chevron expanded={expanded} color={theme.colors.onSurfaceVariant} size={24} />
      </PressableScale>
      <Collapsible expanded={expanded} style={styles.body}>
        {children}
      </Collapsible>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, minHeight: 72 },
  text: { flex: 1, gap: 2 },
  body: { paddingHorizontal: 16, paddingBottom: 16 },
});
