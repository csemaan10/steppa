import { MEDAL_COLORS } from '@/components/character/scene-common';
import { ColorGlyph } from '@/components/glyph';
import { flameTier } from '@/components/streak-flame';
import { flameIcon, medalIcon, trophyIcon } from '@/lib/award-art';

const MEDALS = MEDAL_COLORS.map(medalIcon);
const TROPHY = trophyIcon(MEDAL_COLORS[0]);

/** A medal in the podium's colours: 0 gold, 1 silver, 2 bronze. */
export function MedalIcon({ place, size = 24 }: { place: number; size?: number }) {
  return <ColorGlyph parts={MEDALS[Math.min(Math.max(place, 0), 2)]!} size={size} />;
}

/** The winner's gold cup. */
export function TrophyIcon({ size = 24 }: { size?: number }) {
  return <ColorGlyph parts={TROPHY} size={size} />;
}

/** The streak flame held still, in the colours of the streak's tier (blue at 30 days and up). */
export function StreakIcon({ streak, size = 24 }: { streak: number; size?: number }) {
  const { outer, middle, inner } = flameTier(streak);
  return <ColorGlyph parts={flameIcon(outer[0], middle[0], inner[0])} size={size} />;
}
