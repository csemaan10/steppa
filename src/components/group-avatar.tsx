import { StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';

/** Matches the `groups.color` column default (also covers rows from before migration 008). */
const DEFAULT_COLOR = '#4355B9';

/** Icons a group owner can pick (Material Community Icons names). */
export const GROUP_ICONS = [
  'walk',
  'run-fast',
  'shoe-sneaker',
  'hiking',
  'bike',
  'trophy',
  'medal',
  'flag-checkered',
  'target',
  'flash',
  'fire',
  'heart-pulse',
  'terrain',
  'pine-tree',
  'tent',
  'campfire',
  'beach',
  'compass',
  'map-marker',
  'earth',
  'city',
  'home-group',
  'account-group',
  'office-building',
  'school',
  'briefcase',
  'rocket',
  'star',
  'crown',
  'diamond-stone',
  'dice-5',
  'sail-boat',
] as const;

type Props = { name: string; color: string; icon?: string | null; size?: number };

/** Rounded-square group badge: the chosen icon, or the name's first letter. */
export function GroupAvatar({ name, color, icon, size = 42 }: Props) {
  return (
    <View style={[styles.box, { width: size, height: size, borderRadius: size / 3, backgroundColor: color || DEFAULT_COLOR }]}>
      {icon ? (
        <Icon source={icon} size={size * 0.55} color="#FFFFFF" />
      ) : (
        <Text style={[styles.letter, { fontSize: size * 0.42 }]}>{name.trim().charAt(0).toUpperCase() || '?'}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
  letter: { color: '#FFFFFF', fontWeight: '700' },
});
