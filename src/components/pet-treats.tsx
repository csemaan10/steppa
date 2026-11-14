import { useEffect, useState, type RefObject } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Card, Modal, Portal, Text } from 'react-native-paper';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { Button } from '@/components/button';
import { Frost, frostPane } from '@/components/frost';
import { getTreatBonuses, type TreatBonus } from '@/lib/api';
import { formatSteps } from '@/lib/dates';
import { describeBonus, EARN_NOTES, waysToEarn } from '@/lib/treats';
import { glassCard, useAppTheme } from '@/theme';
import { motion } from '@/theme/motion';

/**
 * How treats work, opened from the treat count: what you have, every way to earn more and what each
 * pays, and the latest bonuses you've had.
 */
export function TreatsSheet({
  open,
  name,
  available,
  toNext,
  onClose,
  onShop,
  blurTarget,
}: {
  open: boolean;
  /** The pet's name. */
  name: string;
  available: number;
  /** Steps to the next treat from walking. */
  toNext: number;
  onClose: () => void;
  /** Opens the shop; left out on the shop itself. */
  onShop?: () => void;
  /** What the sheet floats over, to blur on Android; the tab screens unless given. */
  blurTarget?: RefObject<View | null>;
}) {
  const theme = useAppTheme();
  const { height } = useWindowDimensions();
  const muted = { color: theme.colors.onSurfaceVariant };
  const [lately, setLately] = useState<TreatBonus[] | null>(null);
  useEffect(() => {
    if (!open) return;
    let live = true;
    getTreatBonuses().then((rows) => live && setLately(rows));
    return () => {
      live = false;
    };
  }, [open]);

  // As the modal fades in, the sheet grows the last few percent out of the top right, where the treat
  // count you tapped sits. Closing is just the modal's fade.
  const rise = useSharedValue(1);
  useEffect(() => {
    if (!open) return;
    rise.set(0);
    rise.set(withSpring(1, motion.smooth));
  }, [open, rise]);
  const riseStyle = useAnimatedStyle(() => ({ transform: [{ scale: 0.94 + 0.06 * rise.value }] }));

  return (
    <Portal>
      <Modal visible={open} onDismiss={onClose} contentContainerStyle={styles.modal}>
        <Animated.View style={[styles.fromCounter, riseStyle]}>
          <Card
            mode="contained"
            style={[frostPane(theme), { borderRadius: glassCard(theme).borderRadius, maxHeight: height * 0.8 }]}>
            <Frost target={blurTarget} />
            <ScrollView contentContainerStyle={styles.sheet}>
              <View style={styles.head}>
                <Text variant="headlineSmall" style={styles.bold}>
                  {available} {available === 1 ? 'treat' : 'treats'}
                </Text>
                <Text variant="bodyMedium" style={muted}>
                  Another in {formatSteps(toNext)} steps
                </Text>
              </View>

              <View style={styles.group}>
                <Text variant="titleSmall" style={styles.bold}>
                  How to earn
                </Text>
                {waysToEarn(name).map((way) => (
                  <View key={way.what} style={styles.row}>
                    <Text variant="bodyMedium" style={styles.what}>
                      {way.what}
                    </Text>
                    <Text variant="bodyMedium" style={[styles.pays, muted]}>
                      {way.pays}
                    </Text>
                  </View>
                ))}
                {EARN_NOTES.map((note) => (
                  <Text key={note} variant="bodySmall" style={muted}>
                    {note}
                  </Text>
                ))}
              </View>

              {lately?.length ? (
                <Animated.View entering={FadeIn.duration(200)} style={styles.group}>
                  <Text variant="titleSmall" style={styles.bold}>
                    Lately
                  </Text>
                  {lately.map((bonus) => (
                    <BonusRow key={bonus.id} bonus={bonus} name={name} />
                  ))}
                </Animated.View>
              ) : null}

              <View style={styles.actions}>
                <Button onPress={onClose}>Close</Button>
                {onShop ? (
                  <Button mode="contained" onPress={onShop}>
                    Shop
                  </Button>
                ) : null}
              </View>
            </ScrollView>
          </Card>
        </Animated.View>
      </Modal>
    </Portal>
  );
}

/** "+10  Mochi reached 100,000 steps". */
function BonusRow({ bonus, name }: { bonus: TreatBonus; name: string }) {
  const theme = useAppTheme();
  return (
    <View style={styles.row}>
      <Text variant="labelLarge" style={[styles.plus, { color: theme.colors.primary }]}>
        +{bonus.treats}
      </Text>
      <Text variant="bodyMedium" style={styles.what}>
        {describeBonus(bonus, name)}
      </Text>
    </View>
  );
}

/** The bonus treats that just came in, each with what it was for, until you've seen them. */
export function NewTreatsCard({
  bonuses,
  name,
  onDone,
}: {
  bonuses: TreatBonus[];
  name: string;
  onDone: () => void;
}) {
  const theme = useAppTheme();
  const total = bonuses.reduce((sum, b) => sum + b.treats, 0);
  // The few biggest, then a count of the rest.
  const shown = [...bonuses].sort((a, b) => b.treats - a.treats).slice(0, 4);
  const rest = bonuses.length - shown.length;
  // It rises in and leaves through the Appear the pet page puts it in.
  return (
    <Card mode="contained" style={glassCard(theme)}>
      <Card.Content style={styles.receipt}>
        <Text variant="titleMedium" style={styles.bold}>
          {total} bonus {total === 1 ? 'treat' : 'treats'}
        </Text>
        {shown.map((bonus) => (
          <BonusRow key={bonus.id} bonus={bonus} name={name} />
        ))}
        {rest > 0 ? (
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            And {rest} more
          </Text>
        ) : null}
        <Button compact onPress={onDone} style={styles.ok}>
          OK
        </Button>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  bold: { fontWeight: '700' },
  modal: { padding: 16 },
  fromCounter: { transformOrigin: 'top right' },
  sheet: { padding: 20, gap: 20 },
  head: { gap: 2 },
  group: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'baseline', gap: 12 },
  what: { flex: 1 },
  pays: { flexShrink: 1, textAlign: 'right' },
  plus: { width: 36, fontWeight: '700' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  receipt: { gap: 8, paddingTop: 14 },
  ok: { alignSelf: 'flex-end' },
});
