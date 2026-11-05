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

export type ShopSection = 'toys' | 'wear' | 'yard' | 'party' | 'flags' | 'season' | 'buddy';

/** Something to keep: its name, a line about it, and the pet's slot it goes in. */
export type ShopThing = { id: string; name: string; blurb: string; section: ShopSection; slot: string };

export const SHOP: ShopThing[] = [
  { id: 'frisbee', name: 'Frisbee', blurb: 'Play throws a frisbee to catch', section: 'toys', slot: 'toy' },
  { id: 'rope', name: 'Tug rope', blurb: 'Play turns into a game of tug', section: 'toys', slot: 'toy' },
  { id: 'bubbles', name: 'Bubbles', blurb: 'Play blows bubbles to pop', section: 'toys', slot: 'toy' },
  { id: 'lenin-suit', name: 'Lenin outfit', blurb: 'A dark three-piece suit and a red tie', section: 'wear', slot: 'outfit' },
  { id: 'lenin-cap', name: "Lenin's cap", blurb: 'The flat cloth cap to go with it', section: 'wear', slot: 'hat' },
  { id: 'tuxedo', name: 'Tuxedo', blurb: 'Satin lapels and a bow tie', section: 'wear', slot: 'outfit' },
  { id: 'raincoat', name: 'Raincoat', blurb: 'Bright yellow, with a hood and toggles', section: 'wear', slot: 'outfit' },
  { id: 'pirate-coat', name: 'Pirate coat', blurb: 'Gold braid, a frilly jabot and a big belt', section: 'wear', slot: 'outfit' },
  { id: 'tricorn', name: 'Pirate hat', blurb: 'A tricorn with a skull and crossbones', section: 'wear', slot: 'hat' },
  { id: 'tutu', name: 'Tutu', blurb: 'A pink leotard and a frilly net skirt', section: 'wear', slot: 'outfit' },
  { id: 'sundress', name: 'Sundress', blurb: 'Daisies all over and a pink ribbon', section: 'wear', slot: 'outfit' },
  { id: 'gown', name: 'Princess gown', blurb: 'Puff sleeves, gold trim and a sparkly skirt', section: 'wear', slot: 'outfit' },
  { id: 'fairy', name: 'Fairy dress', blurb: 'A petal skirt and see-through wings', section: 'wear', slot: 'outfit' },
  { id: 'cardigan', name: 'Cardigan', blurb: 'Pink and cosy, with pearl buttons', section: 'wear', slot: 'outfit' },
  { id: 'overalls', name: 'Dungarees', blurb: 'Denim over a yellow tee', section: 'wear', slot: 'outfit' },
  { id: 'jersey', name: 'Football shirt', blurb: 'Number 10', section: 'wear', slot: 'outfit' },
  { id: 'tiara', name: 'Tiara', blurb: 'Silver, with a pink jewel', section: 'wear', slot: 'hat' },
  { id: 'hairbow', name: 'Hair bow', blurb: 'A big polka-dot bow', section: 'wear', slot: 'hat' },
  { id: 'sunhat', name: 'Sun hat', blurb: 'Floppy straw with flowers on the ribbon', section: 'wear', slot: 'hat' },
  { id: 'pearls', name: 'Pearls', blurb: 'A string of pearls', section: 'wear', slot: 'collar' },
  { id: 'cloudbed', name: 'Cloud bed', blurb: 'A fluffy cloud to nap on', section: 'yard', slot: 'bed' },
  { id: 'heartbed', name: 'Heart bed', blurb: 'A heart-shaped cushion', section: 'yard', slot: 'bed' },
  { id: 'beanbag', name: 'Beanbag', blurb: 'A squashy lilac beanbag to sink into', section: 'yard', slot: 'bed' },
  { id: 'flowerbed', name: 'Flower beds', blurb: 'Roses and daisies in a raised bed', section: 'yard', slot: 'fun' },
  { id: 'pond', name: 'Pond', blurb: 'Lily pads, bulrushes and a frog', section: 'yard', slot: 'fun' },
  { id: 'trampoline', name: 'Trampoline', blurb: 'A bouncy one, with a padded rim', section: 'yard', slot: 'fun' },
  { id: 'tent', name: 'Play tent', blurb: 'Stripes, a pennant, and a lamp inside at night', section: 'yard', slot: 'house' },
  { id: 'swing', name: 'Swing set', blurb: 'A swing that sways in the breeze', section: 'yard', slot: 'fun' },
  { id: 'picnic', name: 'Picnic', blurb: 'A gingham blanket, a basket and watermelon', section: 'yard', slot: 'fun' },
  { id: 'ballpit', name: 'Ball pit', blurb: 'A pool full of coloured balls', section: 'yard', slot: 'fun' },
  { id: 'fountain', name: 'Fountain', blurb: 'A stone fountain, glinting in the light', section: 'yard', slot: 'fun' },
  { id: 'igloo', name: 'Igloo', blurb: 'Snow blocks, lit up inside at night', section: 'yard', slot: 'house' },
  { id: 'castle', name: 'Castle', blurb: 'Two towers, pink roofs and pennants', section: 'yard', slot: 'house' },
  { id: 'cottage', name: 'Cottage', blurb: 'A little house with a chimney', section: 'yard', slot: 'house' },
  { id: 'treehouse', name: 'Treehouse', blurb: 'A hut up a tree, with a ladder', section: 'yard', slot: 'house' },
  { id: 'disco', name: 'Disco ball', blurb: 'Glints by day, sends coloured lights round the yard at night', section: 'party', slot: 'party' },
  { id: 'bunting', name: 'Bunting', blurb: 'Flags strung across the yard', section: 'party', slot: 'party' },
  { id: 'pinata', name: 'Piñata', blurb: 'A star piñata with streamers', section: 'party', slot: 'party' },
  { id: 'paper-lanterns', name: 'Paper lanterns', blurb: 'Round lanterns that glow after dark', section: 'party', slot: 'party' },
  { id: 'fairy-lights', name: 'Fairy lights', blurb: 'Coloured bulbs that twinkle after dark', section: 'party', slot: 'party' },
  { id: 'flag-ussr', name: 'USSR flag', blurb: 'Red, with the hammer and sickle', section: 'flags', slot: 'flag' },
  { id: 'flag-pirate', name: 'Pirate flag', blurb: 'The Jolly Roger', section: 'flags', slot: 'flag' },
  { id: 'flag-rainbow', name: 'Rainbow flag', blurb: 'Six bright stripes', section: 'flags', slot: 'flag' },
  { id: 'flag-canada', name: 'Canada flag', blurb: 'The maple leaf', section: 'flags', slot: 'flag' },
  { id: 'flag-uk', name: 'UK flag', blurb: 'The Union Jack', section: 'flags', slot: 'flag' },
  { id: 'flag-usa', name: 'US flag', blurb: 'The Stars and Stripes', section: 'flags', slot: 'flag' },
  { id: 'flag-italy', name: 'Italy flag', blurb: 'Green, white and red', section: 'flags', slot: 'flag' },
  { id: 'flag-china', name: 'China flag', blurb: 'Five gold stars on red', section: 'flags', slot: 'flag' },
  { id: 'flag-bulgaria', name: 'Bulgaria flag', blurb: 'White, green and red', section: 'flags', slot: 'flag' },
  { id: 'flag-lebanon', name: 'Lebanon flag', blurb: 'The cedar', section: 'flags', slot: 'flag' },
  { id: 'flag-japan', name: 'Japan flag', blurb: 'The red sun', section: 'flags', slot: 'flag' },
  { id: 'flag-bangladesh', name: 'Bangladesh flag', blurb: 'A red disc on green', section: 'flags', slot: 'flag' },
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
  wear: 'To wear',
  yard: 'For the yard',
  party: 'Party',
  flags: 'Flags',
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
