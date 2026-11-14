import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';

import { Button } from '@/components/button';
import { Collapsible } from '@/components/collapsible';
import { SwapText } from '@/components/swap-text';
import { diagnoseToday, type DiagnosticLine } from '@/lib/health';
import { glassCard } from '@/theme';

/**
 * Reads today's steps several ways and shows the results, for tracking down wrong step counts. The
 * results open above the button, and on a re-run each changed figure crossfades in place.
 */
export function StepCheckCard() {
  const theme = useTheme();
  const [lines, setLines] = useState<DiagnosticLine[] | null>(null);
  const [running, setRunning] = useState(false);

  async function run() {
    setRunning(true);
    try {
      setLines(await diagnoseToday());
    } catch (e) {
      setLines([{ label: 'Error', value: e instanceof Error ? e.message : String(e) }]);
    } finally {
      setRunning(false);
    }
  }

  return (
    <Card mode="contained" style={glassCard(theme)}>
      <Card.Title
        title="Step check"
        subtitle="Compare with your Health app if your steps look wrong"
        titleVariant="titleMedium"
      />
      <Card.Content style={styles.content}>
        <Collapsible expanded={!!lines} style={styles.lines}>
          {lines?.map((line) => (
            <View key={line.label} style={styles.line}>
              <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                {line.label}
              </Text>
              <SwapText variant="bodyMedium" selectable>
                {line.value}
              </SwapText>
            </View>
          ))}
        </Collapsible>
        <Button mode="contained-tonal" icon="stethoscope" onPress={run} loading={running} disabled={running}>
          {lines ? 'Run again' : 'Run step check'}
        </Button>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 16 },
  // Its gap to the button is inside the fold, so it opens with it.
  lines: { gap: 10, paddingBottom: 12 },
  line: { gap: 2 },
});
