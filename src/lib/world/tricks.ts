// Tricks your pet learns from treats, in order: every treat it eats goes toward the next one. Walking
// earns the treats (migration 018 counts them), so the tricks come steadily between milestones.

export const TRICKS = [
  { id: 'sit', name: 'Sit', treats: 5 },
  { id: 'spin', name: 'Spin', treats: 10 },
  { id: 'rollover', name: 'Roll over', treats: 20 },
  { id: 'playdead', name: 'Play dead', treats: 30 },
  { id: 'dance', name: 'Dance', treats: 45 },
  { id: 'backflip', name: 'Backflip', treats: 60 },
  { id: 'zoomies', name: 'Zoomies', treats: 80 },
  { id: 'handstand', name: 'Handstand', treats: 100 },
] as const;

export type Trick = (typeof TRICKS)[number];
export type TrickId = Trick['id'];

/** The tricks it knows after eating `fed` treats. */
export function learnedTricks(fed: number): Trick[] {
  const learned: Trick[] = [];
  let total = 0;
  for (const trick of TRICKS) {
    total += trick.treats;
    if (fed < total) break;
    learned.push(trick);
  }
  return learned;
}

/** The trick it's learning and how many of its treats it has had, or null once it knows them all. */
export function training(fed: number): { trick: Trick; given: number } | null {
  let total = 0;
  for (const trick of TRICKS) {
    if (fed < total + trick.treats) return { trick, given: fed - total };
    total += trick.treats;
  }
  return null;
}
