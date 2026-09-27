import { Avatar } from 'react-native-paper';

/** Built-in avatar icons (Material Community Icons names), grouped loosely by theme. */
export const AVATAR_ICONS = [
  // Animals
  'cat',
  'dog',
  'penguin',
  'rabbit',
  'owl',
  'panda',
  'koala',
  'unicorn',
  'fish',
  'bee',
  'butterfly',
  'turtle',
  'snake',
  'dolphin',
  'duck',
  'bird',
  'horse',
  'pig',
  'cow',
  'ladybug',
  'jellyfish',
  // Sports
  'basketball',
  'soccer',
  'tennis',
  'football',
  'baseball',
  'volleyball',
  'bike',
  'run',
  'swim',
  'hiking',
  'ski',
  'skateboard',
  'dumbbell',
  'yoga',
  'karate',
  // Food
  'pizza',
  'coffee',
  'ice-cream',
  'cupcake',
  'hamburger',
  'taco',
  'food-apple',
  'fruit-watermelon',
  // Nature
  'cactus',
  'flower',
  'tree',
  'leaf',
  'mushroom',
  'weather-sunny',
  'moon-waning-crescent',
  'snowflake',
  'fire',
  'earth',
  // Fun
  'robot',
  'ghost',
  'alien',
  'ninja',
  'wizard-hat',
  'skull',
  'emoticon-cool',
  'emoticon-happy',
  'heart',
  'diamond-stone',
  'star',
  'crown',
  'lightning-bolt',
  'rocket-launch',
  'guitar-electric',
  'headphones',
  'music',
  'camera',
  'palette',
  'gamepad-variant',
  'chess-knight',
  'puzzle',
  'sword',
  'shield',
  'anchor',
  'airplane',
  'car-sports',
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
