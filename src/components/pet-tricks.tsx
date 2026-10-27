import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Text } from 'react-native-paper';

import { Button } from '@/components/button';
import { DropdownMenu, MenuGroup, MenuItem } from '@/components/dropdown-menu';
import { TREAT } from '@/components/game/colors';
import { SectionHeader } from '@/components/section-header';
import { learnedTricks, training, TRICKS, type TrickId } from '@/lib/world';
import { glassCard, useAppTheme, withAlpha } from '@/theme';

/**
 * The Tricks button under Pet, Treat and Play: a menu of the tricks it knows, so you can ask for one
 * and watch it right there in the scene. The one it's learning and the way to the trick shop sit at
 * the bottom.
 */
export function TrickMenu({
  fed,
  width,
  onShowOff,
  onShop,
}: {
  /** Treats it has eaten. */
  fed: number;
  width: number;
  onShowOff: (trick: TrickId) => void;
  onShop: () => void;
}) {
  const [open, setOpen] = useState(false);
  const learned = learnedTricks(fed);
  const learning = training(fed);

  function choose(then: () => void) {
    setOpen(false);
    then();
  }

  return (
    <View style={{ width }}>
      <DropdownMenu
        open={open}
        onDismiss={() => setOpen(false)}
        anchor={
          <Button
            mode="contained-tonal"
            icon="star-four-points"
            trailingIcon={open ? 'chevron-up' : 'chevron-down'}
            compact
            onPress={() => setOpen(!open)}
            accessibilityLabel={`Tricks, ${learned.length} known`}>
            {learned.length ? `Tricks · ${learned.length}` : 'Tricks'}
          </Button>
        }>
        <MenuGroup>
          {learned.map((trick) => (
            <MenuItem
              key={trick.id}
              emoji={trick.emoji}
              label={trick.name}
              onPress={() => choose(() => onShowOff(trick.id))}
            />
          ))}
          {learned.length ? null : (
            <MenuItem icon="star-four-points-outline" label="No tricks yet" supporting="Every treat is practice" disabled />
          )}
        </MenuGroup>
        <MenuGroup>
          <MenuItem
            icon="storefront-outline"
            label="Trick shop"
            supporting={
              learning
                ? `Learning ${learning.trick.name} · ${learning.given}/${learning.trick.treats} treats`
                : 'Every trick learned'
            }
            onPress={() => choose(onShop)}
          />
        </MenuGroup>
      </DropdownMenu>
    </View>
  );
}

/**
 * Tricks further down the Pet tab: how many it knows and how far it is with the next one. Asking
 * for them is in the Tricks menu under the scene; buying them is in the shop.
 */
export function TricksSection({
  name,
  fed,
  onShop,
}: {
  name: string;
  /** Treats it has eaten. */
  fed: number;
  onShop: () => void;
}) {
  const theme = useAppTheme();
  const muted = { color: theme.colors.onSurfaceVariant };
  const learned = learnedTricks(fed);
  const learning = training(fed);

  return (
    <>
      <SectionHeader title="Tricks" note={`${learned.length} of ${TRICKS.length}`} onPress={onShop} />
      <Card mode="contained" style={glassCard(theme)}>
        <Card.Content style={styles.body}>
          {learned.length ? null : (
            <Text variant="bodyMedium" style={muted}>
              {name} doesn&apos;t know any tricks yet. Every treat is practice.
            </Text>
          )}
          {learning ? (
            <View style={styles.next}>
              <Text style={styles.nextEmoji}>{learning.trick.emoji}</Text>
              <View style={styles.flex}>
                <Text style={[styles.nextName, { color: theme.colors.onSurface }]}>Learning {learning.trick.name}</Text>
                <View style={[styles.track, { backgroundColor: withAlpha(TREAT.face, 0.22) }]}>
                  <View
                    style={[styles.fill, { width: `${Math.max(learning.given / learning.trick.treats, 0.03) * 100}%` }]}
                  />
                </View>
              </View>
              <Text style={[styles.count, muted]}>
                {learning.given}/{learning.trick.treats}
              </Text>
            </View>
          ) : (
            <Text variant="bodyLarge">{name} knows every trick there is!</Text>
          )}
          <Button mode="contained-tonal" icon="storefront" onPress={onShop}>
            Trick shop
          </Button>
        </Card.Content>
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  body: { gap: 16 },
  flex: { flex: 1, gap: 6 },
  next: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nextEmoji: { fontSize: 24, lineHeight: 30 },
  nextName: { fontSize: 14, fontWeight: '800' },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4, backgroundColor: TREAT.face },
  count: { fontSize: 13, fontWeight: '900', fontVariant: ['tabular-nums'] },
});
