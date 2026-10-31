// The shop: what it shows as new after a milestone, how a level-up names its rewards, and the things
// for sale with treats. Their prices and the months seasonal things are on sale come from the database
// (shop_items, migration 021) so they can change without an update; how each thing looks is in
// src/lib/world/pet.ts, where it's a `shop` choice in one of the pet's slots.

import type { ShopPrice } from '@/lib/api';
import { choiceLevel, unlockAt, type Choice, type Slot, type WorldDef } from '@/lib/world';

/** The shop's sections. */
export type ShopTab = 'looks' | 'tricks' | 'trips';

export function isShopTab(value: string | undefined): value is ShopTab {
  return value === 'looks' || value === 'tricks' || value === 'trips';
}

/** Milestones just reached, from–to inclusive, passed to the shop as "3-5". */
export type Fresh = { from: number; to: number };

export function freshParam(fresh: Fresh): string {
  return `${fresh.from}-${fresh.to}`;
}

export function parseFresh(param: string | undefined): Fresh | null {
  const match = param?.match(/^(\d+)-(\d+)$/);
  return match ? { from: Number(match[1]), to: Number(match[2]) } : null;
}

/** Whether a look unlocked at one of the fresh milestones (its own level or its slot's). */
export function isFresh(slot: Slot, choice: Choice, fresh: Fresh | null): boolean {
  if (!fresh) return false;
  const level = choiceLevel(slot, choice);
  return level >= fresh.from && level <= fresh.to;
}

/** One thing a level-up brings, as a reward tile. */
export type Reward = { key: string; label: string; emoji?: string; color?: string; grows?: boolean };

/** Everything unlocked from milestone `from` to `to`: growing first, then new things, then new options. */
export function rewardsBetween(def: WorldDef, from: number, to: number): Reward[] {
  const rewards: Reward[] = [];
  for (let level = from; level <= to; level++) {
    const unlock = unlockAt(def, level);
    if (unlock.grows) rewards.push({ key: `grow-${level}`, label: `${unlock.grows} stage`, emoji: '🌱', grows: true });
    for (const slot of unlock.slots) {
      const first = slot.choices[0];
      rewards.push({
        key: `slot-${slot.id}`,
        label: slot.title,
        emoji: first?.emoji ?? (first?.color ? undefined : '🎁'),
        color: first?.color,
      });
    }
    for (const { slot, choices } of unlock.choices) {
      for (const choice of choices) {
        rewards.push({
          key: `choice-${slot.id}-${choice.id}`,
          label: choice.label,
          emoji: choice.emoji,
          color: choice.color,
        });
      }
    }
  }
  return rewards;
}

// ---------- Things for sale ----------

export type ShopSection = 'toys' | 'yard' | 'season' | 'buddy';

/** Something to keep: its name, a line about it, and the pet's slot it goes in. */
export type ShopThing = { id: string; name: string; blurb: string; section: ShopSection; slot: string };

export const SHOP: ShopThing[] = [
  { id: 'frisbee', name: 'Frisbee', blurb: 'Play throws a frisbee to catch', section: 'toys', slot: 'toy' },
  { id: 'rope', name: 'Tug rope', blurb: 'Play turns into a game of tug', section: 'toys', slot: 'toy' },
  { id: 'bubbles', name: 'Bubbles', blurb: 'Play blows bubbles to pop', section: 'toys', slot: 'toy' },
  { id: 'cloudbed', name: 'Cloud bed', blurb: 'A fluffy cloud to nap on', section: 'yard', slot: 'bed' },
  { id: 'flowerbed', name: 'Flower beds', blurb: 'Roses and daisies in a raised bed', section: 'yard', slot: 'fun' },
  { id: 'pond', name: 'Pond', blurb: 'Lily pads, bulrushes and a frog', section: 'yard', slot: 'fun' },
  { id: 'cottage', name: 'Cottage', blurb: 'A little house with a chimney', section: 'yard', slot: 'house' },
  { id: 'treehouse', name: 'Treehouse', blurb: 'A hut up a tree, with a ladder', section: 'yard', slot: 'house' },
  { id: 'pumpkins', name: 'Pumpkins', blurb: 'One carved, and lit up after dark', section: 'season', slot: 'season' },
  { id: 'festive-tree', name: 'Festive tree', blurb: 'Baubles by day, fairy lights by night', section: 'season', slot: 'season' },
  { id: 'tulips', name: 'Tulips', blurb: 'A clump of spring colours', section: 'season', slot: 'season' },
  { id: 'sunflowers', name: 'Sunflowers', blurb: 'Taller than your pet, nearly', section: 'season', slot: 'season' },
  {
    id: 'hedgehog',
    name: 'Hedgehog',
    blurb: 'A little friend that hops along when your pet plays',
    section: 'buddy',
    slot: 'buddy',
  },
];

export const SECTION_TITLES: Record<ShopSection, string> = {
  toys: 'Toys',
  yard: 'For the yard',
  season: 'Seasonal',
  buddy: 'Something to save for',
};

/** Whether it's on sale this month (things without months always are). */
export function onSale(price: ShopPrice, now = new Date()): boolean {
  return !price.months || price.months.includes(now.getMonth() + 1);
}

const monthName = (month: number) => new Date(2026, month - 1, 15).toLocaleDateString(undefined, { month: 'short' });

/** When a seasonal thing is on sale: "Jun–Aug", "Dec–Jan". */
export function saleMonths(months: readonly number[]): string {
  return months.length === 1 ? monthName(months[0]!) : `${monthName(months[0]!)}–${monthName(months[months.length - 1]!)}`;
}

/** Prices by item. */
export function priceList(prices: readonly ShopPrice[]): Map<string, ShopPrice> {
  return new Map(prices.map((p) => [p.item, p]));
}
