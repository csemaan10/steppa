import { StyleSheet, View } from 'react-native';
import { Card, Text } from 'react-native-paper';

import { Button } from '@/components/button';
import { ProgressBar } from '@/components/journey-parts';
import { SectionHeader } from '@/components/section-header';
import { learnedTricks, training, TRICKS, type TrickId } from '@/lib/world';
import { glassCard, useAppTheme } from '@/theme';

/**
 * Tricks: the one your pet is learning and how many treats it still needs, then each trick it
 * knows, to ask for.
 */
export function TricksSection({
  name,
  fed,
  onShowOff,
}: {
  name: string;
  /** Treats it has eaten. */
  fed: number;
  onShowOff: (trick: TrickId) => void;
}) {
  const theme = useAppTheme();
  const muted = { color: theme.colors.onSurfaceVariant };
  const learned = learnedTricks(fed);
  const learning = training(fed);

  return (
    <>
      <SectionHeader title="Tricks" note={`${learned.length} of ${TRICKS.length}`} />
      <Card mode="contained" style={glassCard(theme)}>
        <Card.Content style={styles.body}>
          {learning ? (
            <View style={styles.learning}>
              <View style={styles.row}>
                <Text variant="titleSmall" style={styles.bold}>
                  Learning: {learning.trick.name}
                </Text>
                <Text variant="labelLarge" style={muted}>
                  {learning.given} of {learning.trick.treats} treats
                </Text>
              </View>
              <ProgressBar fraction={learning.given / learning.trick.treats} />
              <Text variant="bodySmall" style={muted}>
                Every treat you give {name} is practice
              </Text>
            </View>
          ) : (
            <Text variant="bodyLarge">{name} knows every trick there is!</Text>
          )}
          {learned.length ? (
            <View style={styles.tricks}>
              {learned.map((trick) => (
                <Button
                  key={trick.id}
                  mode="outlined"
                  compact
                  onPress={() => onShowOff(trick.id)}
                  accessibilityLabel={`Ask for ${trick.name}`}>
                  {trick.name}
                </Button>
              ))}
            </View>
          ) : null}
        </Card.Content>
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  body: { gap: 16 },
  learning: { gap: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  bold: { fontWeight: '700' },
  tricks: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
