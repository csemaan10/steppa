import { useState } from 'react';
import { View } from 'react-native';

import { PostcardFrame, type PostcardPlace } from '@/components/postcard';
import { WorldScene } from '@/components/world-scene';
import type { PetMate } from '@/lib/api';
import { hashString } from '@/lib/character';
import type { Place } from '@/lib/pet-adventures';
import type { TimeOfDay } from '@/lib/scene-art';
import { drawVisit, type KindPicks } from '@/lib/world';

/** A day your pet spent with a friend's: whose pet, as it looks now, and where they were. */
export type VisitCard = {
  /** The day of the visit, which also tells them apart: a pet visits once a day at most. */
  day: string;
  /** The friend whose pet it is. */
  owner: string;
  /** Their pet's name. */
  pet: string;
  steps: number;
  saved: KindPicks | undefined;
  /** Where their pet was off to that day, so yours went to find it there; null if it was at home. */
  away: Place | null;
};

/** What the two of them got up to in the yard, for the back: the same one every time for a given visit. */
const DAYS = [
  (me: string, them: string) => `${me} and ${them} chased each other round the yard until they both needed a nap.`,
  (me: string, them: string) => `${them} showed ${me} every corner of the yard. Twice.`,
  (me: string, them: string) => `${me} had a drink from ${them}'s bowl. Same water as at home, but somehow better.`,
  (me: string, them: string) => `${me} and ${them} found the sunniest spot in the yard and shared it all afternoon.`,
];

/** A visit to `mate`'s pet, which has walked `steps`, on `day`, wherever it was. */
export function visitCardFor(day: string, mate: PetMate, steps: number, away: Place | null): VisitCard {
  const saved = mate.world.picks.pet;
  return { day, owner: mate.name, pet: saved?.name || `${mate.name}'s pet`, steps, saved, away };
}

/** Where a visit's postcard is from, for the postcard and its thumbnail; `name` is your pet's. */
export function visitPlace(visit: VisitCard, name: string): PostcardPlace {
  const { away } = visit;
  if (away) {
    const fact = `${visit.pet} was off in ${away.stop.name} for the day, so ${name} went too, and they saw it together.`;
    return { name: away.stop.name, emoji: away.stop.emoji, sky: away.stop.sky, fact };
  }
  const fact = DAYS[hashString(visit.day) % DAYS.length]!(name, visit.pet);
  return { name: `${visit.owner}'s yard`, emoji: '🏡', sky: 'noon', fact };
}

/** The two of them in the friend's yard (or wherever their pet was), cropped so the ground stays at the bottom. */
function VisitScene({
  visit,
  steps,
  picks,
  time,
  height,
}: {
  visit: VisitCard;
  steps: number;
  picks: KindPicks | undefined;
  time: TimeOfDay;
  height: number;
}) {
  const [width, setWidth] = useState(0);
  const art = drawVisit({ steps: visit.steps, saved: visit.saved, away: visit.away?.stop }, steps, picks, time, 'happy');
  const where = visit.away ? visit.away.stop.name : `${visit.owner}'s yard`;
  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ height }}
      accessible
      accessibilityLabel={`Your pet with ${visit.pet} in ${where}`}>
      {width ? <WorldScene art={art} width={width} cropTo={height} radius={0} version={`visit-${visit.day}`} /> : null}
    </View>
  );
}

/** A postcard your pet sent from a day with a friend's pet: the two of them together, and their day on the back. */
export function VisitPostcard({
  visit,
  steps,
  picks,
  name,
  recipient,
  number,
  width,
}: {
  visit: VisitCard;
  /** Your pet's steps and choices, so it looks the way it does at home. */
  steps: number;
  picks: KindPicks | undefined;
  /** "Mochi", or "Your pet". */
  name: string;
  /** Who it's addressed to: you. */
  recipient: string;
  /** Which visit this was, counting from 1. */
  number: number;
  width: number;
}) {
  return (
    <PostcardFrame
      stop={visitPlace(visit, name)}
      flag={visit.away?.route.flag}
      caption={`${name} visits ${visit.pet}`}
      stamp={`NO. ${number}`}
      sign={`Love, ${name} 🐾`}
      address={[recipient, 'The yard', 'Home sweet home']}
      width={width}
      scene={(height, time) => <VisitScene visit={visit} steps={steps} picks={picks} time={time} height={height} />}
    />
  );
}
