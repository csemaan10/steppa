import { StyleSheet, View } from 'react-native';
import { Surface, Text, useTheme } from 'react-native-paper';

type Props = { label: string; value: string; highlight?: boolean };

export function StatTile({ label, value, highlight }: Props) {
  const theme = useTheme();
  return (
    <Surface
      mode="flat"
      style={[
        styles.tile,
        {
          backgroundColor: highlight
            ? theme.colors.secondaryContainer
            : theme.colors.surfaceVariant,
          borderRadius: theme.roundness * 3,
        },
      ]}>
      <View>
        <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
          {label}
        </Text>
        <Text variant="titleLarge" style={{ color: theme.colors.onSurface }}>
          {value}
        </Text>
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  tile: { flex: 1, padding: 16 },
});
