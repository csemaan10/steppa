import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Icon, Text, useTheme } from 'react-native-paper';
import Animated, { interpolate, useAnimatedStyle } from 'react-native-reanimated';

import { ButtonGroup, useGlide } from '@/components/button-group';
import { CollapsibleCard } from '@/components/collapsible-card';
import { usePressed } from '@/hooks/use-pressed';
import { useThemeChoice, type AppearanceMode } from '@/providers/theme-provider';
import { PALETTES, THEME_NAMES, type ThemeName } from '@/theme';
import { enter, leave } from '@/theme/motion';

const MODE_LABELS: Record<AppearanceMode, string> = { system: 'System', light: 'Light', dark: 'Dark' };

const SWATCH = 40;
const RING_GAP = 3;
const RING_WIDTH = 2;
const RING = SWATCH + (RING_GAP + RING_WIDTH) * 2;

// The check only fades: the ring gliding over is what shows the move.
const checkIn = enter(0, true);
const checkOut = leave(true);

export function ThemePicker() {
  const theme = useTheme();
  const { themeName, setThemeName, mode, setMode } = useThemeChoice();
  const ring = useGlide(THEME_NAMES.indexOf(themeName));

  return (
    <CollapsibleCard
      title="Theme"
      summary={`${PALETTES[themeName].label} · ${MODE_LABELS[mode]}`}
      preview={<View style={[styles.preview, { backgroundColor: PALETTES[themeName].swatch }]} />}>
      <View style={styles.mode}>
        <ButtonGroup<AppearanceMode>
          value={mode}
          onChange={setMode}
          options={[
            { value: 'system', label: 'System', icon: 'theme-light-dark' },
            { value: 'light', label: 'Light', icon: 'white-balance-sunny' },
            { value: 'dark', label: 'Dark', icon: 'weather-night' },
          ]}
        />
      </View>
      <View style={styles.row}>
        {/* One ring for the whole grid, gliding to the chosen theme. */}
        <Animated.View pointerEvents="none" style={[styles.marker, ring.style]}>
          <View style={[styles.ring, { borderColor: theme.colors.onSurface }]} />
        </Animated.View>
        {THEME_NAMES.map((name, i) => (
          <ThemeOption
            key={name}
            name={name}
            selected={name === themeName}
            onPress={() => setThemeName(name)}
            onLayout={ring.place(i)}
          />
        ))}
      </View>
    </CollapsibleCard>
  );
}

function ThemeOption({
  name,
  selected,
  onPress,
  onLayout,
}: {
  name: ThemeName;
  selected: boolean;
  onPress: () => void;
  onLayout: (e: LayoutChangeEvent) => void;
}) {
  const theme = useTheme();
  const palette = PALETTES[name];
  // The swatch dips while held; its name stays put.
  const press = usePressed();
  const dip = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(press.pressed.value, [0, 1], [1, 0.92]) }],
  }));
  return (
    <Pressable
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      onLayout={onLayout}
      style={styles.option}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${palette.label} theme`}>
      <Animated.View style={[styles.slot, dip]}>
        <View style={[styles.swatch, { backgroundColor: palette.swatch }]}>
          {selected ? (
            <Animated.View entering={checkIn} exiting={checkOut}>
              <Icon source="check" size={20} color="#FFFFFF" />
            </Animated.View>
          ) : null}
        </View>
      </Animated.View>
      <Text variant="labelMedium" style={{ color: selected ? theme.colors.onSurface : theme.colors.onSurfaceVariant }}>
        {palette.label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  mode: { paddingBottom: 16 },
  preview: { width: 32, height: 32, borderRadius: 16 },
  // Four per row, so the names have room; the last row may be short.
  row: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 16 },
  option: { width: '25%', alignItems: 'center', gap: 6 },
  // As wide as an option, so the ring centres over its swatch.
  marker: { position: 'absolute', top: 0, left: 0, width: '25%', alignItems: 'center' },
  ring: { width: RING, height: RING, borderRadius: RING / 2, borderWidth: RING_WIDTH },
  // The ring's room round the swatch, so the swatches line up under it.
  slot: { padding: RING_GAP + RING_WIDTH },
  swatch: { width: SWATCH, height: SWATCH, borderRadius: SWATCH / 2, alignItems: 'center', justifyContent: 'center' },
});
