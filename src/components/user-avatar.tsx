import { Avatar } from 'react-native-paper';

type Props = { name: string; color: string; size?: number };

export function UserAvatar({ name, color, size = 40 }: Props) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');
  return <Avatar.Text size={size} label={initials || '?'} color="#FFFFFF" style={{ backgroundColor: color }} />;
}
