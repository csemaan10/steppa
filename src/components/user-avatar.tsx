import { Avatar } from 'react-native-paper';

/** Built-in avatar icons (Material Community Icons names). */
export const AVATAR_ICONS = [
  'cat',
  'dog',
  'robot',
  'guitar-electric',
  'rocket-launch',
  'ghost',
  'alien',
  'penguin',
  'rabbit',
  'owl',
  'pizza',
  'basketball',
  'gamepad-variant',
  'cactus',
  'lightning-bolt',
  'crown',
] as const;

type Props = { name: string; color: string; icon?: string | null; size?: number };

export function UserAvatar({ name, color, icon, size = 40 }: Props) {
  if (icon) {
    return <Avatar.Icon size={size} icon={icon} color="#FFFFFF" style={{ backgroundColor: color }} />;
  }
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');
  return <Avatar.Text size={size} label={initials || '?'} color="#FFFFFF" style={{ backgroundColor: color }} />;
}
