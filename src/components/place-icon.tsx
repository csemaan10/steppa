import { StyleSheet, Text, View } from 'react-native';

import { Glyph } from '@/components/glyph';
import { placeIconFor } from '@/lib/place-icons';

/** A place's drawn icon (src/lib/place-icons) in one colour, `size` across; its emoji if it has none. */
export function PlaceIcon({ emoji, size = 24, color }: { emoji: string; size?: number; color: string }) {
  const parts = placeIconFor(emoji);
  if (parts) return <Glyph parts={parts} size={size} color={color} />;
  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <Text style={{ fontSize: size * 0.72, lineHeight: size }}>{emoji}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
});
