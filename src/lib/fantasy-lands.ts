// Fantasy lands for the pet's adventures: made-up places it can be sent to alongside the real ones
// on the journey routes. Each land is shaped like a route so its places make postcards the same way;
// they're never walked, so there's no map and no distance.

import type { Route, Sky, Stop } from '@/lib/journeys';
import type { Scene } from '@/lib/scene-art';

function place(name: string, emoji: string, sky: Sky, scene: Scene, fact: string): Stop {
  return { lat: 0, lng: 0, name, km: 0, emoji, sky, scene, fact };
}

function land(key: string, name: string, subtitle: string, flag: string, stops: Stop[]): Route {
  return { key, name, subtitle, flag, path: stops, stops, totalKm: 0 };
}

export const FANTASY_LANDS: Route[] = [
  land('candy-kingdom', 'Candy Kingdom', 'Where the hills are sweets', '🍭', [
    place('Gumdrop Hills', '🍬', 'candy', ['candy', 'candyhills', 'gumdrops'],
      'The gumdrops grow back overnight. The green ones are said to taste of apple, but they roll away before anyone can check.'),
    place('Lollipop Lane', '🍭', 'candy', ['candy', 'candyhills', 'lollipops'],
      'Every lollipop on the lane is a different flavour. Nobody has licked them all; the record is 41.'),
    place('Chocolate River', '🍫', 'candy', ['candy', 'candyhills', 'candycanes', 'chocriver'],
      'Warm on one bank, cold on the other. The candy canes along it are the only bridges, and they are very sticky.'),
    place('Cupcake Castle', '🧁', 'candy', ['candy', 'candyhills', 'cupcakecastle'],
      'The royal family lives in the middle cupcake. The sprinkles on top are repainted every spring.'),
  ]),
  land('dragon-peaks', 'Dragon Peaks', 'Mountains with something hiding in them', '🐉', [
    place('Ember Valley', '🌋', 'ember', ['rock', 'mountains', 'volcano'],
      'The ground here is always toasty. Dragons come down in winter to warm their toes.'),
    place("Dragon's Roost", '🐉', 'ember', ['rock', 'mountains', 'dragonnest'],
      'The eggs hatch when someone kind walks by. One wobbled, which is a very good sign.'),
    place('Crystal Caves', '💎', 'ember', ['rock', 'crags', 'crystals'],
      'The crystals hum a note if you sing to them. Barking counts.'),
    place("Wizard's Tower", '🧙', 'ember', ['grass', 'pines', 'wizardtower'],
      'The wizard is out, but left a sign: back in 300 years, please water the plants.'),
  ]),
  land('cloud-kingdom', 'Cloud Kingdom', 'Up above the weather', '☁️', [
    place('Sky Castle', '🏰', 'cloud', ['cloud', 'skycastle'],
      'Built on the fluffiest cloud there is. The guards check every visitor for muddy paws.'),
    place('Rainbow Bridge', '🌈', 'cloud', ['cloud', 'rainbow'],
      'Seven colours, one way across. It goes violet first, which feels like walking on grapes.'),
    place('Floating Isles', '🏝️', 'cloud', ['cloud', 'floatisles'],
      'The waterfalls never reach the bottom. Nobody knows where the water goes.'),
    place('Balloon Harbour', '🎈', 'cloud', ['cloud', 'balloons'],
      'Ships up here are balloons. Ask nicely and they let you hold the string.'),
  ]),
  land('mermaid-lagoon', 'Mermaid Lagoon', 'All the way to the bottom of the sea', '🧜', [
    place('Coral Reef', '🪸', 'lagoon', ['seabed', 'coral', 'bubbles'],
      'Every colour you can think of, and a few you can only see underwater.'),
    place('Kelp Forest', '🌿', 'lagoon', ['seabed', 'kelp', 'bubbles'],
      'The tallest trees in the sea, and they sway all day. Otters tie themselves to them to nap.'),
    place('Sunken Ship', '⚓', 'lagoon', ['seabed', 'wreck', 'bubbles'],
      'Its treasure was found long ago. It turned out to be a very old sandwich.'),
    place('Mermaid Palace', '🐚', 'lagoon', ['seabed', 'kelp', 'shellpalace'],
      'Built from one enormous shell. Hold your ear to the wall and you can hear the land.'),
  ]),
  land('moon-base', 'Moon Base', 'One small step for a pet', '🚀', [
    place('Crater Camp', '🏕️', 'space', ['moon', 'craters'],
      'You can jump six times higher up here. Fetch takes a very long time.'),
    place('Rocket Pad', '🚀', 'space', ['moon', 'craters', 'rocket'],
      'Countdown is from ten, but the rocket only leaves once everyone has had a snack.'),
    place('Ringed Planet View', '🪐', 'space', ['moon', 'craters', 'planet'],
      'The best seat in the solar system. The rings are made of ice and old space dust.'),
    place('Moon Crystals', '🔮', 'space', ['moon', 'crystals'],
      'They glow brighter the more steps someone walked that day. Today they were very bright.'),
  ]),
  land('enchanted-forest', 'Enchanted Forest', 'Where the toadstools have doors', '🍄', [
    place('Mushroom Village', '🍄', 'enchanted', ['grass', 'trees', 'mushrooms'],
      'Every house is a mushroom, and every mushroom has a doorbell. Ring gently.'),
    place('Fairy Glen', '🧚', 'enchanted', ['grass', 'trees', 'fairylights'],
      'The fairies only come out if you stay very still. That was the hardest part.'),
    place('Wishing Well', '🪙', 'enchanted', ['grass', 'trees', 'well'],
      'Drop in a coin and make a wish. A treat counts as a coin here.'),
    place('Unicorn Meadow', '🦄', 'enchanted', ['grass', 'hills', 'unicorn'],
      'The unicorns are shy, but they love anyone who has walked a long way to see them.'),
  ]),
];
