// A drawn icon for every place on the journey routes and in the fantasy lands, in place of its emoji:
// keyed by the emoji the place is described with (Stop.emoji in src/lib/journeys.ts and
// src/lib/fantasy-lands.ts), so places that share an emoji share an icon. Each is a one-colour
// silhouette on the icon grid (src/lib/icon-art.ts): white on a place's sky, inked on a stamp.
// A friend's yard has one too, for the postcards from a visit.

import { heart, poly, rect, type IconPart } from '@/lib/icon-art';
import { FANTASY_ICONS } from '@/lib/place-icons/fantasy';
import { LANDMARK_ICONS } from '@/lib/place-icons/landmarks';
import { LOCAL_ICONS } from '@/lib/place-icons/local';

const HOME_ICONS: Record<string, IconPart[]> = {
  // A house with a heart for a door, and a chimney.
  '🏡': [
    { d: rect(30, 8, 5.5, 10) },
    { d: poly(24, 5, 45, 23.5, 39.5, 23.5, 39.5, 43, 8.5, 43, 8.5, 23.5, 3, 23.5) + heart(24, 31.5, 5.6), holes: true },
  ],
};

const PLACE_ICONS: Record<string, IconPart[]> = { ...LANDMARK_ICONS, ...LOCAL_ICONS, ...FANTASY_ICONS, ...HOME_ICONS };

/** The icon for a place's emoji, if one has been drawn. */
export function placeIconFor(emoji: string): IconPart[] | undefined {
  return PLACE_ICONS[emoji];
}
