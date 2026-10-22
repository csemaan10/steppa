import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';

import { Button } from '@/components/button';
import { diagnoseToday, type DiagnosticLine } from '@/lib/health';
import { glassCard } from '@/theme';

/** Reads today's steps several ways and shows the results, for tracking down wrong step counts. */
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
        {lines ? (
          <View style={styles.lines}>
            {lines.map((line) => (
              <View key={line.label} style={styles.line}>
                <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                  {line.label}
                </Text>
                <Text variant="bodyMedium" selectable>
                  {line.value}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
        <Button mode="contained-tonal" icon="stethoscope" onPress={run} loading={running} disabled={running}>
          {lines ? 'Run again' : 'Run step check'}
        </Button>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { gap: 12, paddingBottom: 16 },
  lines: { gap: 10 },
  line: { gap: 2 },
});
