import { Pressable, StyleSheet, View } from 'react-native';
import { Card, Icon, SegmentedButtons, Text, useTheme } from 'react-native-paper';

import { useThemeChoice, type AppearanceMode } from '@/providers/theme-provider';
import { glassCard, PALETTES, THEME_NAMES } from '@/theme';

export function ThemePicker() {
  const theme = useTheme();
  const { themeName, setThemeName, mode, setMode } = useThemeChoice();

  return (
    <Card mode="contained" style={glassCard(theme)}>
      <Card.Title title="Theme" titleVariant="titleMedium" />
      <Card.Content style={styles.mode}>
        <SegmentedButtons
          value={mode}
          onValueChange={(v) => setMode(v as AppearanceMode)}
          buttons={[
            { value: 'system', label: 'System', icon: 'theme-light-dark' },
            { value: 'light', label: 'Light', icon: 'white-balance-sunny' },
            { value: 'dark', label: 'Dark', icon: 'weather-night' },
          ]}
        />
      </Card.Content>
      <Card.Content style={styles.row}>
        {THEME_NAMES.map((name) => {
          const palette = PALETTES[name];
          const selected = name === themeName;
          return (
            <Pressable
              key={name}
              onPress={() => setThemeName(name)}
              style={styles.option}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${palette.label} theme`}>
              <View
                style={[
                  styles.ring,
                  { borderColor: selected ? theme.colors.onSurface : 'transparent' },
                ]}>
                <View style={[styles.swatch, { backgroundColor: palette.swatch }]}>
                  {selected ? <Icon source="check" size={20} color="#FFFFFF" /> : null}
                </View>
              </View>
              <Text
                variant="labelMedium"
                style={{ color: selected ? theme.colors.onSurface : theme.colors.onSurfaceVariant }}>
                {palette.label}
              </Text>
            </Pressable>
          );
        })}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  mode: { paddingBottom: 16 },
  // Four per row, so the names have room; the last row may be short.
  row: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 16, paddingBottom: 16 },
  option: { width: '25%', alignItems: 'center', gap: 6 },
  ring: { borderWidth: 2, borderRadius: 999, padding: 3 },
  swatch: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
