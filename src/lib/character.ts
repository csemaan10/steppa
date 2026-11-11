// Podium characters: what a player can choose (looks, face, clothes, a watch, pets), defaults,
// and the pet rules.
// Drawing and animation live in src/components/character.

export const SKINS = ['#FFDBC4', '#F1C27D', '#E0AC69', '#C68642', '#8D5524', '#5C3A21'] as const;
// Defaults pick from the original seven, so new styles never change anyone's default look.
const ORIGINAL_HAIR = ['short', 'long', 'bun', 'curly', 'longcurly', 'spiky', 'bald'] as const;
export const HAIR_STYLES = [
  'short', 'buzz', 'sidepart', 'quiff', 'mohawk', 'afro', 'spiky', 'curly', 'curtains', 'bun', 'long', 'longcurly', 'bald',
] as const;
export const HAIR_COLORS = ['#1B1B1B', '#4E342E', '#8D6E63', '#E6C27A', '#C0532B', '#9E1B1B', '#9E9E9E'] as const;
export const EYE_COLORS = ['#222222', '#5D3A1A', '#2E6DB4', '#3B8D4A', '#8E7A3A', '#6B7B8C'] as const;
export const EXPRESSIONS = ['happy', 'grin', 'surprised', 'wink', 'angry'] as const;
export const GLASSES = [
  'none', 'round', 'wire', 'square', 'oversized', 'cateye', 'browline', 'aviator', 'shades', 'sport',
  'visor', 'heart', 'star', 'monocle',
] as const;
/** Glasses whose colour is the lenses'; the others take it on the frame. */
export const TINTED_GLASSES: readonly Glasses[] = ['shades', 'sport', 'visor', 'heart', 'star'];
export const GLASSES_COLORS = [
  '#1B1B1B', '#6D4C41', '#C9A227', '#B0BEC5', '#FAFAFA', '#E53935', '#FB8C00', '#FDD835', '#43A047',
  '#00ACC1', '#1E88E5', '#8E24AA', '#EC407A',
] as const;
export const FACIAL_HAIR = ['none', 'stubble', 'moustache', 'goatee', 'disconnected', 'beard'] as const;
export const TOPS = ['tee', 'hoodie', 'tank', 'longsleeve', 'jersey', 'jacket'] as const;
export const TOP_COLORS = [
  '#E53935', '#FB8C00', '#FDD835', '#43A047', '#1E88E5', '#8E24AA', '#EC407A', '#FAFAFA', '#263238',
  '#00ACC1', '#7CB342', '#6D4C41',
] as const;
export const PATTERNS = ['none', 'stripes', 'heart', 'bolt', 'star'] as const;
export const BOTTOMS = ['trousers', 'shorts', 'skirt'] as const;
export const FITS = ['regular', 'baggy'] as const;
/** How they get up onto the podium in the morning recap; 'rise' is the plain block rise. */
export const ENTRANCES = ['rise', 'bigjump', 'superman', 'lantern', 'web', 'cards', 'cars', 'teleport', 'lightning', 'jetpack', 'parachute', 'portal', 'horseride', 'carpet', 'ufo', 'zipline'] as const;
export const PANTS_COLORS = [
  '#263238', '#3949AB', '#6D4C41', '#90A4AE', '#1565C0', '#C62828', '#AD1457', '#2E7D32', '#D7CCC8',
] as const;
export const SHOE_COLORS = ['#2B2B2B', '#FAFAFA', '#E53935', '#1E88E5', '#FDD835', '#43A047', '#FF6D00', '#EC407A', '#8E24AA'] as const;
export const WATCHES = ['none', 'smart', 'classic', 'band', 'ring'] as const;
export const WATCH_COLORS = ['#263238', '#FAFAFA', '#6D4C41', '#E53935', '#1E88E5', '#43A047', '#FDD835', '#EC407A', '#8E24AA'] as const;
export const IDLES = [
  'smile', 'wave', 'flex', 'dance', 'jump', 'lounge', 'sleep',
  'soccer', 'basket', 'vbspike', 'vbset', 'vbbump', 'knit',
  'walk', 'archery', 'guitar', 'jumprope', 'yoga',
  'run', 'skate', 'boxing', 'tennis', 'meditate',
  'webswing', 'cardthrow', 'hero', 'construct', 'flight', 'shield', 'thunder', 'speedster', 'weights',
  'claws', 'eyebeam', 'spell',
] as const;
/** Moves grouped for the picker; every idle is in exactly one group. */
export const IDLE_GROUPS: { title: string; idles: readonly Idle[] }[] = [
  {
    title: 'Movement',
    idles: ['smile', 'wave', 'flex', 'dance', 'jump', 'walk', 'run', 'lounge', 'sleep', 'yoga', 'meditate', 'knit', 'guitar'],
  },
  {
    title: 'Sports',
    idles: ['soccer', 'basket', 'vbspike', 'vbset', 'vbbump', 'tennis', 'boxing', 'archery', 'skate', 'jumprope', 'weights'],
  },
  {
    title: 'Heroes',
    idles: [
      'webswing', 'cardthrow', 'hero', 'flight', 'shield', 'thunder', 'speedster', 'construct', 'claws',
      'eyebeam', 'spell',
    ],
  },
];

/** Moves that use their own face (eyes closed), so the chosen expression doesn't show. */
export const OWN_FACE_IDLES: readonly Idle[] = ['sleep', 'yoga', 'meditate', 'claws'];
export const CATS = ['greycat', 'tabbycat', 'gingercat', 'blackcat'] as const;
/** Small ground pets that aren't cats; they take the same spots as cats. */
export const CRITTERS = ['bunny', 'hamster'] as const;
export const DOGS = ['browndog', 'goldendog', 'bwdog', 'blackdog'] as const;
/** Shoulder birds; .bird. is the green parrot (its id predates the others). */
export const BIRDS = ['bird', 'bluebird', 'macaw', 'canary', 'cockatoo'] as const;
export const PETS = [...CATS, ...CRITTERS, ...DOGS, 'horse', ...BIRDS] as const;

export type HairStyle = (typeof HAIR_STYLES)[number];
export type Expression = (typeof EXPRESSIONS)[number];
export type Glasses = (typeof GLASSES)[number];
export type FacialHair = (typeof FACIAL_HAIR)[number];
export type Top = (typeof TOPS)[number];
export type Pattern = (typeof PATTERNS)[number];
export type Bottom = (typeof BOTTOMS)[number];
export type Fit = (typeof FITS)[number];
export type Entrance = (typeof ENTRANCES)[number];
export type Watch = (typeof WATCHES)[number];
export type Idle = (typeof IDLES)[number];
export type Pet = (typeof PETS)[number];

export type CharacterLook = {
  skin: string;
  hair: HairStyle;
  hairColor: string;
  eyeColor: string;
  /** Resting face; moves with their own face (sleep, yoga, ...) keep that one. */
  expression: Expression;
  glasses: Glasses;
  /** Frame colour (lens colour for tinted glasses); null is the style's own. */
  glassesColor: string | null;
  facialHair: FacialHair;
  freckles: boolean;
  top: Top;
  /** Baggy tops are wider and longer, with looser sleeves. */
  topFit: Fit;
  topColor: string;
  /** Sleeve colour for a two-tone top; null matches the top. */
  sleeveColor: string | null;
  pattern: Pattern;
  bottom: Bottom;
  /** Baggy trousers and shorts are wider and looser; skirts ignore it. */
  bottomFit: Fit;
  /** Colour of the bottoms (trousers, shorts or skirt); named before skirts existed. */
  pantsColor: string;
  shoeColor: string;
  watch: Watch;
  watchColor: string;
  idle: Idle;
  /** How they get up onto the podium in the recap. */
  entrance: Entrance;
  pets: Pet[];
};

export const LABELS: Record<
  HairStyle | Expression | Glasses | FacialHair | Top | Pattern | Bottom | Fit | Entrance | Watch | Idle | Pet,
  string
> = {
  short: 'Short', buzz: 'Buzz cut', sidepart: 'Side part', quiff: 'Curly bun', mohawk: 'Mohawk', afro: 'Afro',
  long: 'Long', bun: 'Bun', curly: 'Curly', curtains: 'Curly curtains', longcurly: 'Long curly', spiky: 'Spiky', bald: 'Bald',
  happy: 'Happy', grin: 'Big grin', surprised: 'Surprised', wink: 'Wink', angry: 'Angry',
  none: 'None', round: 'Round', wire: 'Wire', square: 'Square', oversized: 'Oversized', cateye: 'Cat-eye',
  browline: 'Browline', aviator: 'Aviator', shades: 'Sunglasses', sport: 'Sport wrap', visor: 'Visor', monocle: 'Monocle',
  stubble: 'Stubble', moustache: 'Moustache', goatee: 'Goatee', disconnected: 'Goatee 2', beard: 'Beard',
  tee: 'Tee', hoodie: 'Hoodie', tank: 'Tank', longsleeve: 'Long sleeve', jersey: 'Jersey', jacket: 'Jacket',
  stripes: 'Stripes', heart: 'Heart', bolt: 'Lightning', star: 'Star',
  trousers: 'Trousers', shorts: 'Shorts', skirt: 'Skirt',
  regular: 'Regular', baggy: 'Baggy',
  rise: 'Block rise', bigjump: 'Big jump', superman: 'Superman flight', lantern: 'Lantern lift-off', web: 'Web sling',
  cards: 'Card explosion', cars: 'Car bounce', teleport: 'Teleport', lightning: 'Lightning strike', jetpack: 'Jetpack',
  parachute: 'Parachute', portal: 'Portal', horseride: 'Horse ride', carpet: 'Magic carpet', ufo: 'UFO beam',
  zipline: 'Zipline',
  smart: 'Smartwatch', classic: 'Classic', band: 'Fitness band', ring: 'Power ring',
  smile: 'Smile', wave: 'Wave', flex: 'Flex', dance: 'Dance', jump: 'Jump', lounge: 'Lounge', sleep: 'Sleep',
  soccer: 'Soccer', basket: 'Basketball', vbspike: 'Volleyball spike', vbset: 'Volleyball set',
  vbbump: 'Volleyball bump', knit: 'Knitting',
  walk: 'Walk', archery: 'Archery', guitar: 'Guitar', jumprope: 'Jump rope', yoga: 'Yoga',
  run: 'Run', skate: 'Skateboard', boxing: 'Boxing', tennis: 'Tennis serve', meditate: 'Meditate',
  webswing: 'Web swing', cardthrow: 'Card throw', hero: 'Hero pose', construct: 'Power construct',
  flight: 'Take flight', shield: 'Shield throw', thunder: 'Thunder strike', speedster: 'Speedster',
  weights: 'Lift weights',
  claws: 'Claws', eyebeam: 'Eye beam', spell: 'Spell circle',
  greycat: 'Grey cat', tabbycat: 'Tabby cat', gingercat: 'Ginger cat', blackcat: 'Black cat', bunny: 'Bunny', hamster: 'Hamster',
  browndog: 'Brown dog', goldendog: 'Golden dog', bwdog: 'Black & white dog', blackdog: 'Black dog', horse: 'Horse',
  bird: 'Green parrot', bluebird: 'Blue parrot', macaw: 'Macaw', canary: 'Canary', cockatoo: 'Cockatoo',
};

/** Stable 32-bit hash of a string (FNV-1a), for per-player defaults and animation offsets. */
export function hashString(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) h = Math.imul(h ^ value.charCodeAt(i), 16777619) >>> 0;
  return h;
}

/**
 * Default look for someone who hasn't made a character: varied per player, never a pet or
 * accessory. Picks only from the original options, so adding options never changes anyone's default.
 */
export function defaultLook(userId: string): CharacterLook {
  const h = hashString(userId);
  const pick = <T>(arr: readonly T[], shift: number): T => arr[(h >>> shift) % arr.length]!;
  return {
    skin: pick(SKINS, 0),
    hair: pick(ORIGINAL_HAIR, 3),
    hairColor: pick(HAIR_COLORS, 6),
    eyeColor: EYE_COLORS[0],
    expression: 'happy',
    glasses: 'none',
    glassesColor: null,
    facialHair: 'none',
    freckles: false,
    top: pick(TOPS.slice(0, 3), 9),
    topFit: 'regular',
    topColor: pick(TOP_COLORS.slice(0, 9), 12),
    sleeveColor: null,
    pattern: 'none',
    bottom: 'trousers',
    bottomFit: 'regular',
    pantsColor: pick(PANTS_COLORS.slice(0, 4), 15),
    shoeColor: SHOE_COLORS[0],
    watch: 'none',
    watchColor: WATCH_COLORS[0],
    idle: pick(IDLES.slice(0, 13), 18),
    // Everyone gets one of the entrances by default, picked by their id; 'rise' is still on offer.
    // Only the first eleven, so adding an entrance doesn't change anyone's default.
    entrance: pick(ENTRANCES.slice(1, 12), 21),
    pets: [],
  };
}

/**
 * Turns whatever is stored (possibly from an older or newer app version) into a valid look:
 * unknown values fall back to that player's default, and pets are trimmed to an allowed set.
 */
export function normalizeLook(raw: unknown, userId: string): CharacterLook {
  const d = defaultLook(userId);
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Record<string, unknown>;
  const oneOf = <T extends string>(list: readonly T[], v: unknown, fallback: T): T =>
    typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : fallback;
  const isColor = (v: unknown): v is string => typeof v === 'string' && /^#[0-9A-Fa-f]{6}$/.test(v);
  const color = (v: unknown, fallback: string) => (isColor(v) ? v : fallback);
  let pets: Pet[] = [];
  if (Array.isArray(r.pets)) {
    for (const p of r.pets) if ((PETS as readonly string[]).includes(p as string)) pets = addPet(pets, p as Pet);
  }
  return {
    skin: color(r.skin, d.skin),
    hair: oneOf(HAIR_STYLES, r.hair, d.hair),
    hairColor: color(r.hairColor, d.hairColor),
    eyeColor: color(r.eyeColor, d.eyeColor),
    expression: oneOf(EXPRESSIONS, r.expression, d.expression),
    glasses: oneOf(GLASSES, r.glasses, d.glasses),
    glassesColor: isColor(r.glassesColor) ? r.glassesColor : null,
    facialHair: oneOf(FACIAL_HAIR, r.facialHair, d.facialHair),
    freckles: r.freckles === true,
    top: oneOf(TOPS, r.top, d.top),
    topFit: oneOf(FITS, r.topFit, d.topFit),
    topColor: color(r.topColor, d.topColor),
    sleeveColor: isColor(r.sleeveColor) ? r.sleeveColor : null,
    pattern: oneOf(PATTERNS, r.pattern, d.pattern),
    bottom: oneOf(BOTTOMS, r.bottom, d.bottom),
    bottomFit: oneOf(FITS, r.bottomFit, d.bottomFit),
    pantsColor: color(r.pantsColor, d.pantsColor),
    shoeColor: color(r.shoeColor, d.shoeColor),
    watch: oneOf(WATCHES, r.watch, d.watch),
    watchColor: color(r.watchColor, d.watchColor),
    idle: oneOf(IDLES, r.idle, d.idle),
    entrance: oneOf(ENTRANCES, r.entrance, d.entrance),
    pets,
  };
}

/** Cats, bunnies and hamsters: they share the two spots on the character's left. */
export const isSmallPet = (p: Pet) => (CATS as readonly string[]).includes(p) || (CRITTERS as readonly string[]).includes(p);
export const isBird = (p: Pet) => (BIRDS as readonly string[]).includes(p);
const isDog = (p: Pet) => (DOGS as readonly string[]).includes(p);

/**
 * Adds a pet, adjusting the others so the set stays allowed: up to 2 small pets (cats, bunny,
 * hamster), 1 small pet + 1 dog, 1 dog, or a horse on its own. The parrot sits on the shoulder,
 * so one bird goes with any of them. The newest pick always wins.
 */
export function addPet(pets: Pet[], pet: Pet): Pet[] {
  // One bird at a time; a new one replaces the old.
  const bird: Pet[] = pets.filter(isBird).slice(-1);
  const ground = pets.filter((p) => !isBird(p));
  if (isBird(pet)) return [...ground, pet];
  if (pet === 'horse') return ['horse', ...bird];
  const rest = ground.filter((p) => p !== 'horse');
  const smalls = rest.filter(isSmallPet);
  const dog = rest.find(isDog);
  if (isDog(pet)) return [...smalls.slice(-1), pet, ...bird];
  const keep = dog ? [] : smalls.slice(-1);
  return [...keep, pet, ...(dog ? [dog] : []), ...bird];
}

/** Toggles a pet on or off within the allowed sets. */
export function togglePet(pets: Pet[], pet: Pet): Pet[] {
  return pets.includes(pet) ? pets.filter((p) => p !== pet) : addPet(pets, pet);
}
