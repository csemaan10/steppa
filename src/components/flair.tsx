import { StyleSheet, View } from 'react-native';
import { Icon } from 'react-native-paper';

import { UserAvatar } from '@/components/user-avatar';
import type { Flair } from '@/lib/api';

/** Accent colours players can pick. Bright enough to read as a ring/glow on light and dark surfaces. */
export const FLAIR_COLORS = [
  '#E3B341', // gold
  '#FF7A45', // orange
  '#F4436C', // pink
  '#B26BFF', // violet
  '#4C7DFF', // blue
  '#1FB5C9', // teal
  '#2DBE6C', // green
  '#9AA4B1', // silver
] as const;

/** Badge icons shown next to the name (Material Community Icons). */
export const FLAIR_ICONS = [
  'crown',
  'star-four-points',
  'fire',
  'lightning-bolt',
  'rocket-launch',
  'diamond-stone',
  'heart',
  'shoe-sneaker',
  'run-fast',
  'trophy',
  'medal',
  'flag-checkered',
  'weather-sunny',
  'moon-waning-crescent',
  'snowflake',
  'leaf',
  'music',
  'gamepad-variant',
  'paw',
  'ghost',
  'alien',
  'robot',
  'skull',
  'emoticon-cool',
] as const;

/** Glow colour when glow is on but no accent was chosen. */
const DEFAULT_GLOW = '#E3B341';

type AvatarProps = Partial<Flair> & {
  name: string;
  color: string;
  icon?: string | null;
  size?: number;
  /** Ring colour when the player has no accent of their own (e.g. to mark "you"). */
  fallbackRing?: string;
};

/** Avatar with the player's accent ring and optional glow. Without flair it's the plain avatar. */
export function FlairAvatar({
  name,
  color,
  icon,
  size = 40,
  flair_color,
  flair_glow,
  fallbackRing,
}: AvatarProps) {
  const ring = flair_color ?? fallbackRing;
  const glow = flair_glow ? (flair_color ?? DEFAULT_GLOW) : null;
  if (!ring && !glow) return <UserAvatar name={name} color={color} icon={icon} size={size} />;

  return (
    <View
      style={[
        styles.ring,
        { borderColor: ring ?? 'transparent' },
        glow ? { boxShadow: `0 0 ${Math.round(size / 3)}px ${Math.round(size / 12)}px ${glow}` } : null,
      ]}>
      <UserAvatar name={name} color={color} icon={icon} size={size} />
    </View>
  );
}

/** Small icon after the name; renders nothing without a badge. */
export function FlairBadge({
  flair_icon,
  flair_color,
  size = 16,
  fallbackColor,
}: Partial<Flair> & { size?: number; fallbackColor: string }) {
  if (!flair_icon) return null;
  return <Icon source={flair_icon} size={size} color={flair_color ?? fallbackColor} />;
}

const styles = StyleSheet.create({
  ring: { borderWidth: 2, borderRadius: 999, padding: 2 },
});
