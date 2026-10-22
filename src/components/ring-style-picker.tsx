import { Pressable, StyleSheet, View } from 'react-native';
import { Card, Text } from 'react-native-paper';

import { ButtonGroup } from '@/components/button-group';
import { ProgressRing } from '@/components/progress-ring';
import {
  RING_COLORS,
  RING_STYLES,
  RING_STYLE_LABELS,
  setRingSettings,
  useRingSettings,
  type RingCat,
  type RingThickness,
} from '@/lib/ring-style';
import { glassCard, useAppTheme, withAlpha } from '@/theme';

/**
 * Settings card for the step ring: style (each a small live preview), the cat's coat on Cat paws,
 * colour and thickness.
 */
export function RingStylePicker() {
  const theme = useAppTheme();
  const settings = useRingSettings();

  return (
    <Card mode="contained" style={glassCard(theme)}>
      <Card.Title title="Progress ring" titleVariant="titleMedium" />
      <Card.Content style={styles.content}>
        <View style={styles.grid}>
          {RING_STYLES.map((s) => {
            const selected = s === settings.style;
            return (
              <Pressable
                key={s}
                onPress={() => setRingSettings({ style: s })}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`${RING_STYLE_LABELS[s]} ring`}
                style={[
                  styles.option,
                  {
                    borderColor: selected ? theme.colors.primary : 'transparent',
                    backgroundColor: selected ? withAlpha(theme.colors.primary, 0.1) : 'transparent',
                  },
                ]}>
                <ProgressRing
                  settings={{ style: s }}
                  progress={0.7}
                  size={56}
                  stroke={7}
                  color={theme.colors.primary}
                  overflowColor={theme.colors.accent}
                  trackColor={theme.colors.surfaceVariant}
                />
                <Text variant="labelMedium" style={selected && { color: theme.colors.primary, fontWeight: '700' }}>
                  {RING_STYLE_LABELS[s]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {settings.style === 'cat' ? (
          <>
            <Text variant="labelLarge">Cat colour</Text>
            <ButtonGroup<RingCat>
              value={settings.cat}
              onChange={(cat) => setRingSettings({ cat })}
              options={[
                { value: 'gingercat', label: 'Ginger' },
                { value: 'greycat', label: 'Grey' },
                { value: 'tabbycat', label: 'Tabby' },
                { value: 'blackcat', label: 'Black' },
              ]}
            />
          </>
        ) : null}

        <Text variant="labelLarge">Colour</Text>
        <View style={styles.swatches}>
          {[null, ...RING_COLORS].map((c) => {
            const selected = settings.color === c;
            return (
              <Pressable
                key={c ?? 'theme'}
                onPress={() => setRingSettings({ color: c })}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={c ? `Ring colour ${c}` : 'Theme colour'}
                style={[
                  styles.swatch,
                  { backgroundColor: c ?? theme.colors.primary, borderColor: selected ? theme.colors.onSurface : 'transparent' },
                ]}>
                {c === null ? (
                  <Text variant="labelSmall" style={{ color: theme.colors.onPrimary, fontWeight: '700' }}>
                    Auto
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        <Text variant="labelLarge">Thickness</Text>
        <ButtonGroup<RingThickness>
          value={settings.thickness}
          onChange={(thickness) => setRingSettings({ thickness })}
          options={[
            { value: 'slim', label: 'Slim' },
            { value: 'regular', label: 'Regular' },
            { value: 'bold', label: 'Bold' },
          ]}
        />
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { gap: 10, paddingBottom: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 },
  // Overflow visible so the neon glow can spread past the option's edges.
  option: {
    width: '23.5%',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 2,
    overflow: 'visible',
  },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  swatch: { width: 36, height: 36, borderRadius: 18, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
});
