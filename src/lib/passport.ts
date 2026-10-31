// The pet's passport: a page for each country its trips can go to, stamped for every place it has
// been on an adventure. Your own walking journeys don't count; the passport is the pet's. A full page
// brings home that country's keepsake for the yard: a souvenir (see `souvenirs` in
// src/lib/world/pet.ts) that the server hands out (claim_keepsakes, migration 023) and the pet keeps
// like anything from the shop.

import type { Adventure } from '@/lib/api';
import { COUNTRIES, type Destination, type Place } from '@/lib/pet-adventures';
import { WORLDS, type Souvenir } from '@/lib/world';

/** One place on a page, and the day the pet first went there, if it has. */
export type PageStamp = { place: Place; day: string | null };

export type Page = {
  country: Destination;
  stamps: PageStamp[];
  /** Places stamped. */
  filled: number;
  /** What filling it brings home. */
  keepsake: Souvenir | undefined;
};

/** Each country's keepsake, for a full page. */
export function keepsakeFor(country: Destination): Souvenir | undefined {
  return WORLDS.pet.souvenirs?.find((s) => s.full && s.from === country.key);
}

/** The keepsake an item is, and the country whose page brings it. */
export function keepsakeNamed(item: string): { souvenir: Souvenir; country: Destination } | undefined {
  const souvenir = WORLDS.pet.souvenirs?.find((s) => s.full && s.choice.id === item);
  const country = souvenir && COUNTRIES.find((c) => c.key === souvenir.from);
  return souvenir && country ? { souvenir, country } : undefined;
}

/** Every page, its places in route order, from the pet's adventures. */
export function passportPages(adventures: readonly Adventure[]): Page[] {
  // The first time the pet went there (adventures come newest first).
  const first = new Map<string, string>();
  for (const a of adventures) first.set(a.place, a.created_at.slice(0, 10));
  return COUNTRIES.map((country) => {
    const pageStamps = country.places.map((place) => ({ place, day: first.get(place.key) ?? null }));
    return {
      country,
      stamps: pageStamps,
      filled: pageStamps.filter((s) => s.day).length,
      keepsake: keepsakeFor(country),
    };
  });
}
