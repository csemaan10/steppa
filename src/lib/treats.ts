// Treats: how they're earned, for the explanation behind the treat count, and how to describe each
// bonus. Walking earns them (migration 018) and friends give them (020); the bonuses are worked out by
// claim_treats (migration 021), and the amounts here must match it.

import { STEPS_PER_TREAT, type TreatBonus } from '@/lib/api';
import { formatSteps } from '@/lib/dates';
import { getRoute } from '@/lib/journeys';
import { STAGE_LEVELS } from '@/lib/world/common';

/** The few treats every new pet starts with. */
export const STARTING_TREATS = 5;
/** A goal day counts for bonuses only with at least this many steps, however low the goal. */
export const BONUS_GOAL_FLOOR = 5000;

/** Treats for reaching a pet milestone: more when it grows into its next stage. */
export function milestoneTreats(level: number): number {
  return (STAGE_LEVELS as readonly number[]).includes(level) ? 25 : 10;
}

/** Every way to earn, one line each: what you do and what it pays. */
export function waysToEarn(petName: string): { what: string; pays: string }[] {
  return [
    { what: 'Walking', pays: `1 for every ${formatSteps(STEPS_PER_TREAT)} steps` },
    { what: 'Hitting your daily goal', pays: '2 a day' },
    { what: 'Streaks', pays: '5 at 7 days, 15 at 30, 40 at 100' },
    { what: 'Medals in your groups', pays: '3 gold, 2 silver, 1 bronze' },
    { what: `${petName}'s milestones`, pays: '10 each, 25 when it grows' },
    { what: 'Finishing a journey', pays: '20, alone or with a group' },
    { what: "A friend's pet visiting", pays: '2 each visit' },
    { what: 'Friends giving them', pays: '1 each, once a day per friend' },
  ];
}

/** The small print under the list. */
export const EARN_NOTES = [
  `Goal days and streaks need at least ${formatSteps(BONUS_GOAL_FLOOR)} steps, even if your goal is lower.`,
  'Medals count once a day, your best one, in groups of three or more.',
];

const dayLabel = (day: string) =>
  new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

const MEDALS: Record<string, string> = { gold: 'Gold', silver: 'Silver', bronze: 'Bronze' };

/** One bonus in a few words: "Hit your goal on Thu, Oct 30", "Biscuit reached 100,000 steps". */
export function describeBonus(bonus: TreatBonus, petName: string): string {
  switch (bonus.reason) {
    case 'milestone':
      return `${petName} reached ${formatSteps(Number(bonus.detail ?? 0))} steps`;
    case 'goal':
      return `Hit your goal on ${dayLabel(bonus.ref)}`;
    case 'streak':
      return `${bonus.detail}-day streak`;
    case 'medal':
      return `${MEDALS[bonus.detail ?? ''] ?? 'A'} medal on ${dayLabel(bonus.ref)}`;
    case 'journey': {
      const route = bonus.detail ? getRoute(bonus.detail) : undefined;
      return route ? `Finished ${route.name}` : 'Finished a journey';
    }
    case 'visit':
      return `${bonus.detail ?? "A friend's pet"} came to visit`;
  }
}
