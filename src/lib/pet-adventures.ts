// Adventures: save up treats and your pet sets off for one of the places on the journey routes,
// sending back a postcard of itself there. Each place is visited once until it has seen them all.

import { GROUP_ROUTES, ROUTES, type Route, type Stop } from '@/lib/journeys';

/** Treats an adventure costs. Must match go_on_adventure in migration 018. */
export const ADVENTURE_COST = 10;

export type Place = { key: string; route: Route; stop: Stop };

/** Accented letters as plain ones ("León" → "leon"), spelled out rather than trusting normalize() everywhere. */
const PLAIN: Record<string, string> = {
  á: 'a', à: 'a', â: 'a', ä: 'a', é: 'e', è: 'e', ê: 'e', ë: 'e', í: 'i', ï: 'i',
  ó: 'o', ô: 'o', ö: 'o', ú: 'u', ü: 'u', ñ: 'n', ç: 'c',
};

/** "Santiago de Compostela" → "santiago-de-compostela"; what's saved for each adventure. */
function placeKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[áàâäéèêëíïóôöúüñç]/g, (c) => PLAIN[c]!)
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Every stop on every route, once each (Ottawa is on two). */
export const PLACES: Place[] = (() => {
  const byKey = new Map<string, Place>();
  for (const route of [...ROUTES, ...GROUP_ROUTES]) {
    for (const stop of route.stops) {
      const key = placeKey(stop.name);
      if (!byKey.has(key)) byKey.set(key, { key, route, stop });
    }
  }
  return [...byKey.values()];
})();

const BY_KEY = new Map(PLACES.map((p) => [p.key, p]));

export function placeFor(key: string): Place | undefined {
  return BY_KEY.get(key);
}

/** Somewhere it hasn't been yet, at random; anywhere once it's been everywhere. */
export function nextPlace(visited: readonly string[]): Place {
  const seen = new Set(visited);
  const fresh = PLACES.filter((p) => !seen.has(p.key));
  const from = fresh.length ? fresh : PLACES;
  return from[Math.floor(Math.random() * from.length)]!;
}
