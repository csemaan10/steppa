// Adventures: save up treats and your pet sets off for one of the places on the journey routes, or
// somewhere in a fantasy land, sending back a postcard of itself there. Each place is visited once
// until it has seen them all.

import { FANTASY_LANDS } from '@/lib/fantasy-lands';
import { GROUP_ROUTES, ROUTES, type Route, type Stop } from '@/lib/journeys';

/** Treats an adventure costs. Must match go_on_adventure in migration 018. */
export const ADVENTURE_COST = 10;

/** `fantasy` places are in one of the made-up lands rather than on a real route. */
export type Place = { key: string; route: Route; stop: Stop; fantasy: boolean };

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

/** Every stop on every route, once each (Ottawa is on two), then the fantasy lands' places. */
export const PLACES: Place[] = (() => {
  const byKey = new Map<string, Place>();
  const add = (routes: Route[], fantasy: boolean) => {
    for (const route of routes) {
      for (const stop of route.stops) {
        const key = placeKey(stop.name);
        if (!byKey.has(key)) byKey.set(key, { key, route, stop, fantasy });
      }
    }
  };
  add([...ROUTES, ...GROUP_ROUTES], false);
  add(FANTASY_LANDS, true);
  return [...byKey.values()];
})();

const BY_KEY = new Map(PLACES.map((p) => [p.key, p]));

export function placeFor(key: string): Place | undefined {
  return BY_KEY.get(key);
}

/** Somewhere it hasn't been yet, at random; anywhere once it's been everywhere. */
export function nextPlace(visited: readonly string[], among: readonly Place[] = PLACES): Place {
  const seen = new Set(visited);
  const fresh = among.filter((p) => !seen.has(p.key));
  const from = fresh.length ? fresh : among;
  return from[Math.floor(Math.random() * from.length)]!;
}

// ---------- Destinations and the passport ----------

/** The countries the routes run through, by their flag. */
const COUNTRY_NAMES: Record<string, string> = {
  '🇬🇧': 'United Kingdom',
  '🇨🇦': 'Canada',
  '🇪🇸': 'Spain',
  '🇮🇹': 'Italy',
  '🇺🇸': 'United States',
  '🇨🇳': 'China',
};

/**
 * Somewhere to send the pet: a country, or one of the fantasy lands. It picks a place there. `key`
 * names it for souvenirs ("canada", "moon-base").
 */
export type Destination = { key: string; flag: string; name: string; places: Place[]; fantasy: boolean };

/** Every place, grouped by its country (or fantasy land), in the order the routes come. */
const DESTINATIONS: Destination[] = (() => {
  const byFlag = new Map<string, Destination>();
  for (const place of PLACES) {
    const { flag } = place.route;
    const name = place.fantasy ? place.route.name : (COUNTRY_NAMES[flag] ?? flag);
    const destination = byFlag.get(flag) ?? {
      key: place.fantasy ? place.route.key : placeKey(name),
      flag,
      name,
      places: [],
      fantasy: place.fantasy,
    };
    destination.places.push(place);
    byFlag.set(flag, destination);
  }
  return [...byFlag.values()];
})();

export const COUNTRIES = DESTINATIONS.filter((d) => !d.fantasy);
export const FANTASY_DESTINATIONS = DESTINATIONS.filter((d) => d.fantasy);

export function destinationNamed(key: string): Destination | undefined {
  return DESTINATIONS.find((d) => d.key === key);
}

/** The destinations it has been to (their keys): each one's souvenir is its to wear. */
export function visitedDestinations(visited: readonly string[]): Set<string> {
  const seen = new Set(visited);
  return new Set(DESTINATIONS.filter((d) => d.places.some((p) => seen.has(p.key))).map((d) => d.key));
}

/** A passport point for every new place visited; going back somewhere earns a postcard, not a point. */
export function passportPoints(visited: readonly string[]): number {
  return new Set(visited.filter((key) => BY_KEY.has(key))).size;
}

/** How many of a destination's places have been visited. */
export function visitedIn(destination: Destination, visited: readonly string[]): number {
  const seen = new Set(visited);
  return destination.places.filter((p) => seen.has(p.key)).length;
}
