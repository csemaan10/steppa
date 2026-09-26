import { Pressable, StyleSheet, View } from 'react-native';
import { Card, Icon, Text, useTheme } from 'react-native-paper';

import { useThemeChoice } from '@/providers/theme-provider';
import { PALETTES, THEME_NAMES } from '@/theme';

export function ThemePicker() {
  const theme = useTheme();
  const { themeName, setThemeName } = useThemeChoice();

  return (
    <Card mode="contained" style={{ backgroundColor: theme.colors.elevation.level1 }}>
      <Card.Title title="Theme" titleVariant="titleMedium" />
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
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 16 },
  option: { alignItems: 'center', gap: 6 },
  ring: { borderWidth: 2, borderRadius: 999, padding: 3 },
  swatch: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
