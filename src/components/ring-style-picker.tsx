import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { ButtonGroup, useGlide } from '@/components/button-group';
import { CollapsibleCard } from '@/components/collapsible-card';
import { PressableScale } from '@/components/pressable-scale';
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
import { refreshWidgets } from '@/lib/widgets';
import { ringTrack, useAppTheme, withAlpha } from '@/theme';
import { enter, layoutMove, leave } from '@/theme/motion';

/** Saves a ring choice; the widgets wear the same ring, so they redraw too. */
function setRing(patch: Parameters<typeof setRingSettings>[0]) {
  setRingSettings(patch);
  refreshWidgets();
}

const THICKNESS_LABELS: Record<RingThickness, string> = { slim: 'Slim', regular: 'Regular', bold: 'Bold' };

const COLORS: (string | null)[] = [null, ...RING_COLORS];

/**
 * Settings card for the step ring: style (each a small live preview), the cat's coat on Cat paws,
 * colour and thickness. The chosen style's box and the chosen colour's ring each glide to a new
 * pick, and the cat's row comes and goes with Cat paws while the rows below slide to make room.
 */
export function RingStylePicker() {
  const theme = useAppTheme();
  const reduceMotion = useReducedMotion();
  const settings = useRingSettings();
  const box = useGlide(RING_STYLES.indexOf(settings.style));
  const ring = useGlide(COLORS.indexOf(settings.color));
  // Every style option is the same size; the box takes its height from the first.
  const [boxHeight, setBoxHeight] = useState(0);

  return (
    <CollapsibleCard
      title="Progress ring"
      summary={`${RING_STYLE_LABELS[settings.style]} · ${THICKNESS_LABELS[settings.thickness]}`}
      preview={
        <ProgressRing
          progress={0.7}
          size={36}
          stroke={5}
          color={theme.colors.primary}
          overflowColor={theme.colors.accent}
          trackColor={ringTrack(theme)}
        />
      }>
      <View style={styles.content}>
        <View style={styles.grid}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.box,
              { height: boxHeight, borderColor: theme.colors.primary, backgroundColor: withAlpha(theme.colors.primary, 0.1) },
              box.style,
            ]}
          />
          {RING_STYLES.map((s, i) => {
            const selected = s === settings.style;
            return (
              <PressableScale
                key={s}
                pressedScale={0.97}
                onPress={() => setRing({ style: s })}
                onLayout={(e) => {
                  box.place(i)(e);
                  if (i === 0) setBoxHeight(e.nativeEvent.layout.height);
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`${RING_STYLE_LABELS[s]} ring`}
                style={styles.option}>
                <ProgressRing
                  settings={{ style: s }}
                  progress={0.7}
                  size={56}
                  stroke={7}
                  color={theme.colors.primary}
                  overflowColor={theme.colors.accent}
                  trackColor={ringTrack(theme)}
                />
                <Text variant="labelMedium" style={selected && { color: theme.colors.primary, fontWeight: '700' }}>
                  {RING_STYLE_LABELS[s]}
                </Text>
              </PressableScale>
            );
          })}
        </View>

        {settings.style === 'cat' ? (
          <Animated.View entering={enter(0, reduceMotion)} exiting={leave(reduceMotion)} style={styles.content}>
            <Text variant="labelLarge">Cat colour</Text>
            <ButtonGroup<RingCat>
              value={settings.cat}
              onChange={(cat) => setRing({ cat })}
              options={[
                { value: 'gingercat', label: 'Ginger' },
                { value: 'greycat', label: 'Grey' },
                { value: 'tabbycat', label: 'Tabby' },
                { value: 'blackcat', label: 'Black' },
              ]}
            />
          </Animated.View>
        ) : null}

        <Animated.View layout={layoutMove} style={styles.content}>
          <Text variant="labelLarge">Colour</Text>
          <View style={styles.swatches}>
            {COLORS.map((c, i) => {
              const selected = settings.color === c;
              return (
                <PressableScale
                  key={c ?? 'theme'}
                  pressedScale={0.92}
                  onPress={() => setRing({ color: c })}
                  onLayout={ring.place(i)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={c ? `Ring colour ${c}` : 'Theme colour'}
                  style={[styles.swatch, { backgroundColor: c ?? theme.colors.primary }]}>
                  {c === null ? (
                    <Text variant="labelSmall" style={{ color: theme.colors.onPrimary, fontWeight: '700' }}>
                      Auto
                    </Text>
                  ) : null}
                </PressableScale>
              );
            })}
            {/* One ring over the swatches, gliding to the chosen colour. */}
            <Animated.View
              pointerEvents="none"
              style={[styles.swatch, styles.marker, { borderColor: theme.colors.onSurface }, ring.style]}
            />
          </View>

          <Text variant="labelLarge">Thickness</Text>
          <ButtonGroup<RingThickness>
            value={settings.thickness}
            onChange={(thickness) => setRing({ thickness })}
            options={[
              { value: 'slim', label: 'Slim' },
              { value: 'regular', label: 'Regular' },
              { value: 'bold', label: 'Bold' },
            ]}
          />
        </Animated.View>
      </View>
    </CollapsibleCard>
  );
}

const styles = StyleSheet.create({
  content: { gap: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 },
  // Overflow visible so the neon glow can spread past the option's edges.
  option: {
    width: '23.5%',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    // Room for the box's border, so nothing moves when it arrives.
    paddingHorizontal: 2,
    overflow: 'visible',
  },
  // The chosen style's box, laid under the options and gliding between them.
  box: { position: 'absolute', top: 0, left: 0, width: '23.5%', borderRadius: 14, borderWidth: 2 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  swatch: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  // The chosen colour's ring, laid over the swatches.
  marker: { position: 'absolute', top: 0, left: 0, borderWidth: 3 },
});
