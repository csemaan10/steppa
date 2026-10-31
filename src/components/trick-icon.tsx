import { Glyph } from '@/components/glyph';
import { TRICK_ICONS } from '@/lib/world/trick-icons';
import type { TrickId } from '@/lib/world/tricks';

/** A trick's icon (src/lib/world/trick-icons.ts) in one colour, `size` across. */
export function TrickIcon({ trick, size = 24, color }: { trick: TrickId; size?: number; color: string }) {
  return <Glyph parts={TRICK_ICONS[trick]} size={size} color={color} />;
}
