// What the shop shows as new after a milestone, and how a level-up names its rewards.

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
