// How your pet feels today: it wakes up as you walk and is over the moon once you reach your daily
// goal. Never sad or sick; a pet that's waiting for a walk is just sleepy.

export type Mood = 'sleepy' | 'awake' | 'happy' | 'overjoyed';

/** Shares of the daily goal where each mood starts. */
const AWAKE = 0.2;
const HAPPY = 0.6;

export function moodOf(steps: number, goal: number): Mood {
  if (goal <= 0 || steps >= goal) return 'overjoyed';
  if (steps >= goal * HAPPY) return 'happy';
  if (steps >= goal * AWAKE) return 'awake';
  return 'sleepy';
}

/** One line for under the pet: how it feels, and the steps to the next mood. */
export function moodLine(mood: Mood, name: string, steps: number, goal: number): string {
  const toGo = (share: number) => Math.max(1, Math.ceil(goal * share - steps)).toLocaleString();
  switch (mood) {
    case 'sleepy':
      return `${name} is snoozing · wakes up in ${toGo(AWAKE)} steps`;
    case 'awake':
      return `${name} wants a walk · ${toGo(1)} steps to your goal`;
    case 'happy':
      return `${name} is happy · ${toGo(1)} steps to your goal`;
    case 'overjoyed':
      return `${name} is overjoyed · you reached your goal today`;
  }
}

/** What it says when you tap it, besides its own sounds. */
export const MOOD_SAYS: Record<Mood, readonly string[]> = {
  sleepy: ['Zzz…', '*yawn*', 'Five more minutes…'],
  awake: ['Walk?', 'Walkies!'],
  happy: ['Good walk!', 'More!'],
  overjoyed: ['Best day ever!', 'We did it!'],
};
