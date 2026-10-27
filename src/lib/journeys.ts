import type { Scene } from '@/lib/scene-art';

/** About 1,300 steps make a kilometre (a ~77 cm stride). */
export const STEPS_PER_KM = 1300;

/** Postcard skies: a top-to-bottom gradient behind each stop's art. */
export const SKIES = {
  dawn: ['#F6A96B', '#E0607E'],
  noon: ['#4FACFE', '#2E6FD0'],
  lake: ['#2BC0A4', '#1F6F8B'],
  dusk: ['#8E6CF0', '#E05A87'],
  forest: ['#5BAE6B', '#1F6F4A'],
  gold: ['#F2B33D', '#D9662B'],
  night: ['#34467A', '#6A3F95'],
  sea: ['#36B5D8', '#1D5FA8'],
  stone: ['#B39B82', '#6B5444'],
  maple: ['#E2483D', '#9E1F2C'],
  // The pet's fantasy lands
  candy: ['#FF9ED2', '#B98CFF'],
  ember: ['#FF8A3D', '#8E2B4A'],
  cloud: ['#8FD3FF', '#B9A8FF'],
  lagoon: ['#2BC7D9', '#1A4F9C'],
  space: ['#3A3F8F', '#0B0E2A'],
  enchanted: ['#4FB98A', '#5B4BB7'],
} as const satisfies Record<string, readonly [string, string]>;

export type Sky = keyof typeof SKIES;

/** A named stop on a route; reaching it unlocks its postcard. */
export type Stop = {
  lat: number;
  lng: number;
  name: string;
  /** Distance from the start along the route (approximate trail/road distance). */
  km: number;
  emoji: string;
  sky: Sky;
  /** The place, drawn on the journey screen with your character waving from it. */
  scene: Scene;
  fact: string;
};

/** Shape points ([lat, lng]) trace the route between stops; the first and last points are stops. */
type PathPoint = Stop | readonly [number, number];

export type Route = {
  key: string;
  name: string;
  /** e.g. "Toronto → Ottawa" */
  subtitle: string;
  flag: string;
  path: PathPoint[];
  stops: Stop[];
  totalKm: number;
};

export function isStop(p: PathPoint): p is Stop {
  return !Array.isArray(p);
}

export function latLng(p: PathPoint): [number, number] {
  return isStop(p) ? [p.lat, p.lng] : [p[0], p[1]];
}

function stop(
  lat: number,
  lng: number,
  name: string,
  km: number,
  emoji: string,
  sky: Sky,
  scene: Scene,
  fact: string
): Stop {
  return { lat, lng, name, km, emoji, sky, scene, fact };
}

function route(key: string, name: string, subtitle: string, flag: string, path: PathPoint[]): Route {
  const stops = path.filter(isStop);
  return { key, name, subtitle, flag, path, stops, totalKm: stops[stops.length - 1]!.km };
}

// Shortest first. Distances are rounded; coordinates are close enough for a stylised map.
export const ROUTES: Route[] = [
  route("hadrians-wall", "Hadrian's Wall", 'Wallsend → Bowness-on-Solway', '🇬🇧', [
    stop(54.9877, -1.5326, 'Wallsend', 0, '🏛️', 'dawn', ['grass', 'hills', 'wall', 'ruins'],
      "The wall's eastern end. The Romans began building it in AD 122 and called the fort here Segedunum."),
    stop(54.9695, -1.6107, 'Newcastle', 6, '🌉', 'noon', ['stone', 'skyline', 'river', 'bridge'],
      "The Romans bridged the Tyne here and named it Pons Aelius, after Hadrian's family name."),
    [54.985, -1.7],
    stop(54.9967, -1.793, 'Heddon-on-the-Wall', 24, '🧱', 'stone', ['grass', 'hills', 'wall', 'trees'],
      'The first stretch of original Roman wall you meet on the path, still standing after 1,900 years.'),
    [55.005, -1.95],
    [55.02, -2.05],
    stop(55.0257, -2.1404, 'Chesters', 45, '♨️', 'forest', ['grass', 'hills', 'trees', 'ruins'],
      'Chesters Roman Fort, home to the best-preserved Roman army bathhouse in Britain.'),
    [55.03, -2.25],
    stop(55.013, -2.331, 'Housesteads', 59, '🏰', 'dusk', ['grass', 'crags', 'wall', 'ruins'],
      'Housesteads, the most complete Roman fort in Britain, perched on the crags of the Whin Sill.'),
    [55.003, -2.4],
    [54.995, -2.5],
    stop(54.9894, -2.6028, 'Birdoswald', 78, '🌿', 'forest', ['grass', 'hills', 'pines', 'wall'],
      'Birdoswald Roman Fort sits high above a loop of the River Irthing, with long runs of wall nearby.'),
    [54.96, -2.75],
    [54.92, -2.85],
    stop(54.8925, -2.9329, 'Carlisle', 106, '🏰', 'gold', ['grass', 'hills', 'houses', 'castle'],
      'Carlisle Castle has guarded the border here for more than 900 years.'),
    [54.91, -3.03],
    [54.94, -3.13],
    stop(54.953, -3.213, 'Bowness-on-Solway', 135, '🌊', 'sea', ['sand', 'farshore', 'sea', 'boat'],
      "The wall's western end, looking out over the Solway Firth to Scotland. Coast to coast on foot!"),
  ]),

  route('toronto-ottawa', 'Toronto to Ottawa', 'Toronto → Ottawa', '🇨🇦', [
    stop(43.6426, -79.3871, 'Toronto', 0, '🏙️', 'dawn', ['stone', 'needle', 'skyline', 'sea'],
      'The CN Tower rises 553 m over Lake Ontario. Ottawa is that way: east along the lake, then up the Rideau.'),
    [43.78, -79.1],
    [43.87, -78.88],
    stop(43.9593, -78.1677, 'Cobourg', 115, '🏖️', 'noon', ['sand', 'sea', 'lighthouse'],
      "A sandy Lake Ontario beach and Victoria Hall, the grand town hall Cobourg finished in 1860."),
    [44.05, -77.75],
    stop(44.1628, -77.3832, 'Belleville', 185, '🍇', 'dusk', ['grass', 'vines', 'lake'],
      "On the Bay of Quinte. Prince Edward County's vineyards are just across the water."),
    [44.25, -76.95],
    stop(44.2312, -76.486, 'Kingston', 260, '🏰', 'stone', ['grass', 'lake', 'castle'],
      "Canada's first capital, in 1841, and home to Fort Henry. The Rideau Canal starts here."),
    [44.3, -76.44],
    [44.45, -76.3],
    stop(44.553, -76.239, 'Jones Falls', 310, '💦', 'lake', ['grass', 'pines', 'falls'],
      'Its stone arch dam was the tallest in North America when the Rideau Canal opened in 1832.'),
    [44.653, -76.316],
    [44.7, -76.19],
    [44.904, -76.021],
    stop(45.0167, -75.837, 'Merrickville', 395, '🏘️', 'forest', ['grass', 'hills', 'trees', 'houses'],
      'A 19th-century mill village whose stone blockhouse has watched over the canal since the 1830s.'),
    [45.1, -75.75],
    [45.226, -75.683],
    stop(45.4236, -75.7009, 'Ottawa', 462, '🍁', 'maple', ['grass', 'river', 'parliament'],
      'Parliament Hill! The Rideau Canal you followed turns into a 7.8 km skateway every winter.'),
  ]),

  route('camino', 'Camino de Santiago', 'Saint-Jean → Santiago', '🇪🇸', [
    stop(43.163, -1.238, 'Saint-Jean-Pied-de-Port', 0, '🎒', 'dawn', ['path', 'mountains', 'houses'],
      'Pilgrims have set off from this French town for centuries. First up: the Pyrenees.'),
    stop(43.0094, -1.3196, 'Roncesvalles', 25, '⛰️', 'forest', ['path', 'mountains', 'pines'],
      'Over the Pyrenees and into Spain. The climb tops out around 1,450 m.'),
    [42.93, -1.5],
    stop(42.8125, -1.6458, 'Pamplona', 68, '🐂', 'gold', ['stone', 'hills', 'oldtown', 'campanile'],
      'Famous for the running of the bulls at the San Fermín festival every July.'),
    [42.672, -1.814],
    [42.671, -2.031],
    [42.57, -2.19],
    stop(42.4627, -2.445, 'Logroño', 160, '🍷', 'dusk', ['path', 'hills', 'vines'],
      'Capital of La Rioja wine country. Calle Laurel is lined with tapas bars.'),
    [42.416, -2.733],
    [42.44, -2.95],
    [42.42, -3.19],
    stop(42.3409, -3.7041, 'Burgos', 280, '⛪', 'stone', ['stone', 'hills', 'oldtown', 'spires'],
      'Its Gothic cathedral, begun in 1221, is a UNESCO World Heritage Site.'),
    [42.31, -4.04],
    [42.267, -4.406],
    [42.338, -4.603],
    [42.371, -5.03],
    [42.5, -5.42],
    stop(42.5987, -5.5671, 'León', 460, '✨', 'night', ['stone', 'oldtown', 'spires'],
      "The cathedral's medieval stained glass covers nearly 1,800 m². Pilgrims call it the house of light."),
    [42.46, -5.88],
    [42.4588, -6.0563],
    [42.48, -6.28],
    stop(42.4886, -6.3615, 'Cruz de Ferro', 535, '🪨', 'noon', ['path', 'mountains', 'cross'],
      'An iron cross at the highest point of the route, where pilgrims leave a stone carried from home.'),
    [42.546, -6.598],
    [42.606, -6.811],
    [42.708, -7.043],
    [42.756, -7.24],
    stop(42.7805, -7.4141, 'Sarria', 665, '🥾', 'forest', ['path', 'hills', 'pines', 'trees'],
      "About 115 km from Santiago, the most popular start for pilgrims walking the 100 km needed for a Compostela."),
    [42.807, -7.616],
    [42.873, -7.869],
    [42.914, -8.015],
    [42.927, -8.163],
    stop(42.8806, -8.5446, 'Santiago de Compostela', 780, '🐚', 'gold', ['stone', 'hills', 'oldtown', 'spires', 'campanile'],
      'You made it! Pilgrims finish at the cathedral, where the botafumeiro, a giant incense burner, swings over the crowd.'),
  ]),

  route('italy', 'Grand Tour of Italy', 'Venice → Amalfi', '🇮🇹', [
    stop(45.434, 12.3388, 'Venice', 0, '🛶', 'sea', ['stone', 'sea', 'oldtown', 'campanile', 'gondola'],
      'More than 100 islands linked by around 400 bridges. No cars here, just your feet.'),
    stop(45.4064, 11.8768, 'Padua', 40, '📚', 'stone', ['stone', 'oldtown', 'campanile'],
      'Home to one of the oldest universities in the world, founded in 1222. Galileo taught here.'),
    [45.07, 11.79],
    [44.836, 11.62],
    stop(44.4949, 11.3426, 'Bologna', 155, '🍝', 'gold', ['stone', 'oldtown', 'campanile', 'campanile'],
      'Nearly 40 km of porticoes, so you can walk across the city without getting rained on.'),
    [44.25, 11.3],
    [44.05, 11.25],
    stop(43.7731, 11.256, 'Florence', 260, '🎨', 'dawn', ['stone', 'hills', 'oldtown', 'dome'],
      "Brunelleschi's dome, finished in 1436, is still the largest brick dome ever built."),
    [43.585, 11.316],
    [43.47, 11.29],
    stop(43.3188, 11.3308, 'Siena', 335, '🐎', 'dusk', ['stone', 'hills', 'oldtown', 'campanile'],
      'Twice every summer, horses race bareback around the Piazza del Campo in the Palio.'),
    [43.06, 11.6],
    [42.896, 11.77],
    [42.645, 11.985],
    [42.42, 12.105],
    [42.2, 12.3],
    stop(41.8902, 12.4922, 'Rome', 565, '🏛️', 'gold', ['stone', 'oldtown', 'colosseum'],
      'The Colosseum once held around 50,000 spectators. All roads lead here, but yours keeps going south.'),
    [41.467, 12.9],
    [41.29, 13.25],
    [41.256, 13.606],
    [41.106, 14.21],
    stop(40.8518, 14.2681, 'Naples', 790, '🍕', 'sea', ['stone', 'volcano', 'sea', 'oldtown'],
      'The birthplace of pizza, with Vesuvius watching over the bay.'),
    stop(40.7462, 14.4989, 'Pompeii', 815, '🌋', 'night', ['path', 'volcano', 'ruins'],
      'Buried by Vesuvius in AD 79 and preserved in ash, a whole Roman town frozen in time.'),
    [40.7, 14.55],
    [40.66, 14.58],
    stop(40.634, 14.6027, 'Amalfi', 850, '🍋', 'gold', ['sand', 'sea', 'cliffs'],
      'Lemons, cliffs and the sea. You walked here all the way from Venice!'),
  ]),
];

/**
 * Long routes a whole group walks together on everyone's steps added up: a group of five at
 * 8,000 steps a day covers about 30 km a day, so these take a season rather than a few weeks.
 */
export const GROUP_ROUTES: Route[] = [
  route('trans-canada', 'Trans-Canada', 'Halifax → Vancouver', '🇨🇦', [
    stop(44.6488, -63.5752, 'Halifax', 0, '⚓', 'dawn', ['sand', 'sea', 'lighthouse'],
      "One of the world's deepest natural harbours. Peggy's Cove lighthouse stands just down the coast."),
    [45.36, -63.28],
    [46.09, -64.78],
    [45.96, -66.64],
    [47.37, -68.33],
    [47.83, -69.54],
    stop(46.8139, -71.208, 'Quebec City', 1010, '🏰', 'dusk', ['stone', 'river', 'houses', 'castle'],
      'The only walled city north of Mexico, with the Château Frontenac standing over the St. Lawrence.'),
    [46.34, -72.54],
    stop(45.5019, -73.5674, 'Montreal', 1260, '🥯', 'noon', ['stone', 'hills', 'skyline', 'river'],
      "A city on an island around Mount Royal, famous for bagels boiled in honey water before they're baked."),
    stop(45.4236, -75.7009, 'Ottawa', 1460, '🍁', 'maple', ['grass', 'river', 'parliament'],
      "Canada's capital, where the Rideau Canal becomes the world's largest skating rink each winter."),
    [45.83, -77.11],
    [46.31, -79.46],
    [46.49, -80.99],
    [46.52, -84.33],
    stop(47.9894, -84.7702, 'Wawa', 2475, '🪿', 'lake', ['grass', 'lake', 'pines'],
      'The highway hugs Lake Superior, the biggest lake by area anywhere, and a giant goose statue greets you.'),
    [48.72, -86.38],
    [49.01, -88.26],
    stop(48.3809, -89.2477, 'Thunder Bay', 2960, '⛰️', 'forest', ['grass', 'crags', 'lake'],
      'The Sleeping Giant, a long mesa out in Lake Superior, looks like a giant lying on his back.'),
    [49.78, -92.84],
    [49.77, -94.49],
    stop(49.8951, -97.1384, 'Winnipeg', 3660, '🦬', 'gold', ['grass', 'skyline', 'river'],
      'Near the middle of Canada, where the Red and Assiniboine rivers meet. The prairies start here.'),
    [49.85, -99.95],
    stop(50.4452, -104.6189, 'Regina', 4230, '🌾', 'noon', ['path', 'wheat', 'elevator'],
      'Wheat to the horizon. Grain elevators, the "prairie sentinels", once stood in nearly every town.'),
    [50.29, -107.79],
    [50.04, -110.68],
    stop(51.0447, -114.0719, 'Calgary', 4990, '🤠', 'dusk', ['stone', 'mountains', 'skyline'],
      'The Rockies rise on the horizon, and every July the Calgary Stampede brings rodeo to town.'),
    stop(51.1784, -115.5708, 'Banff', 5120, '🏔️', 'lake', ['path', 'mountains', 'lake'],
      "Canada's first national park. Lake Louise is turquoise from rock flour ground by glaciers."),
    [51.3, -116.97],
    stop(51.3, -117.52, 'Rogers Pass', 5330, '🌲', 'forest', ['path', 'mountains', 'pines'],
      'The highway climbs through the Selkirk Mountains, where crews fire cannons to set off avalanches safely.'),
    [50.99, -118.2],
    [50.67, -120.33],
    [49.38, -121.44],
    stop(49.2827, -123.1207, 'Vancouver', 5970, '🌊', 'gold', ['sand', 'mountains', 'skyline', 'sea'],
      'Mountains, ocean and a city between them. Your group crossed Canada, from the Atlantic to the Pacific!'),
  ]),

  route('route-66', 'Route 66', 'Chicago → Santa Monica', '🇺🇸', [
    stop(41.8786, -87.6251, 'Chicago', 0, '🏙️', 'dawn', ['stone', 'skyline', 'sea'],
      "Route 66 begins on Adams Street, by a brown sign that just says 'Begin'. Lake Michigan glitters behind."),
    [41.53, -88.08],
    [40.48, -88.99],
    stop(39.7817, -89.6501, 'Springfield', 320, '🎩', 'noon', ['grass', 'wheat', 'houses'],
      "Abraham Lincoln's home town. Across Illinois the old road runs through endless fields of corn."),
    [39.18, -89.65],
    stop(38.6247, -90.1848, 'St. Louis', 485, '🌉', 'gold', ['stone', 'skyline', 'river', 'arch'],
      'The Gateway Arch rises 192 m over the Mississippi, the gateway to the West.'),
    [37.95, -91.77],
    [37.21, -93.29],
    [37.08, -94.51],
    [36.87, -94.88],
    stop(36.154, -95.9928, 'Tulsa', 1175, '🛢️', 'dusk', ['grass', 'hills', 'skyline'],
      "Tulsa's Cyrus Avery fought for the highway in the 1920s and is called the Father of Route 66."),
    [35.47, -97.52],
    [35.41, -99.4],
    [35.22, -100.25],
    stop(35.222, -101.8313, 'Amarillo', 1840, '🚙', 'gold', ['grass', 'cadillacs'],
      'Cadillac Ranch: ten old Cadillacs buried nose-first in a field, and visitors are welcome to spray-paint them.'),
    [35.17, -103.72],
    [34.94, -104.68],
    stop(35.0844, -106.6504, 'Albuquerque', 2330, '🎈', 'dawn', ['desert', 'mesas', 'balloons'],
      'Every October hundreds of hot air balloons fill the sky over the city for the Balloon Fiesta.'),
    [35.15, -107.85],
    [35.53, -108.74],
    stop(34.9022, -110.1582, 'Holbrook', 2940, '🪵', 'dusk', ['desert', 'mesas', 'cactus'],
      "Next door, the Painted Desert's striped badlands, and logs that turned to stone over 200 million years."),
    [35.02, -110.7],
    [35.2, -111.65],
    stop(35.2495, -112.191, 'Williams', 3140, '🏞️', 'noon', ['path', 'canyon'],
      'The gateway to the Grand Canyon, and the last Route 66 town the interstate bypassed, in 1984.'),
    [35.33, -112.88],
    [35.19, -114.05],
    [34.85, -114.61],
    stop(34.8958, -117.0173, 'Barstow', 3680, '🌵', 'gold', ['desert', 'mesas', 'diner'],
      'Across the Mojave the old road runs past ghost towns, giant cacti and roadside diners.'),
    [34.11, -117.29],
    [34.15, -118.14],
    stop(34.0103, -118.4962, 'Santa Monica', 3940, '🎡', 'gold', ['sand', 'sea', 'pier'],
      'The End of the Trail sign stands on Santa Monica Pier. Chicago to the Pacific, 2,448 miles, on foot!'),
  ]),

  route('great-wall', 'The Great Wall', "Old Dragon's Head → Jiayuguan", '🇨🇳', [
    stop(39.968, 119.795, "Old Dragon's Head", 0, '🐉', 'dawn', ['sand', 'sea', 'pagoda'],
      'Where the Great Wall runs into the Bohai Sea, like a dragon stooping to drink.'),
    [40.02, 118.7],
    stop(40.676, 117.243, 'Jinshanling', 330, '🏯', 'gold', ['grass', 'mountains', 'greatwall'],
      'Watchtowers every few hundred metres, and the wall riding the ridges as far as you can see.'),
    stop(40.4319, 116.5704, 'Mutianyu', 440, '🍂', 'maple', ['grass', 'mountains', 'greatwall', 'trees'],
      'Here the wall winds through forest that turns red and gold every autumn.'),
    stop(40.36, 116.02, 'Badaling', 500, '🧱', 'noon', ['stone', 'mountains', 'greatwall'],
      'The busiest stretch of the wall, and the first one opened to visitors, in 1957.'),
    [40.77, 114.88],
    stop(40.0768, 113.3001, 'Datong', 830, '🗿', 'stone', ['path', 'crags', 'pagoda'],
      'The Yungang Grottoes nearby hold over 51,000 Buddhas carved into sandstone cliffs.'),
    [39.33, 112.43],
    stop(39.42, 111.48, 'Laoniuwan', 1080, '🌊', 'lake', ['path', 'crags', 'river'],
      'Where the Great Wall meets the Yellow River, cutting through the loess plateau.'),
    [38.83, 110.5],
    stop(38.2852, 109.7341, 'Yulin', 1390, '🏜️', 'dusk', ['desert', 'hills', 'pagoda'],
      'Zhenbeitai, the biggest beacon tower on the wall, guarded the edge of the Mu Us Desert.'),
    [37.59, 107.6],
    stop(38.4872, 106.2309, 'Yinchuan', 1830, '🏺', 'gold', ['path', 'mountains', 'pagoda'],
      'Below the Helan Mountains stand the Western Xia tombs, earthen pyramids nearly 1,000 years old.'),
    [37.51, 105.19],
    stop(37.9283, 102.638, 'Wuwei', 2250, '🐎', 'noon', ['desert', 'mountains', 'greatwall'],
      'The Hexi Corridor: the Silk Road ran here, between the snowy Qilian Mountains and the Gobi.'),
    stop(38.9256, 100.4498, 'Zhangye', 2520, '🌈', 'dusk', ['desert', 'mesas'],
      "Zhangye's Rainbow Mountains: sandstone striped red, yellow and green over 24 million years."),
    [39.73, 98.49],
    stop(39.802, 98.214, 'Jiayuguan', 2760, '🏯', 'gold', ['desert', 'mountains', 'greatwall', 'pagoda'],
      "The 'First Pass Under Heaven', where the Ming wall ends in the Gobi. Your group walked the Great Wall!"),
  ]),
];

export function getRoute(key: string): Route | undefined {
  return ROUTES.find((r) => r.key === key) ?? GROUP_ROUTES.find((r) => r.key === key);
}

export function kmFromSteps(steps: number): number {
  return steps / STEPS_PER_KM;
}

export function stepsForKm(km: number): number {
  return Math.round(km * STEPS_PER_KM);
}

export type Progress = {
  /** Distance walked, capped at the route length. */
  km: number;
  fraction: number;
  /** Stops reached so far, including the start. */
  reached: number;
  next: Stop | null;
  /** The last stop reached. */
  last: Stop;
  done: boolean;
};

export function progressOn(route: Route, steps: number): Progress {
  const km = Math.min(kmFromSteps(steps), route.totalKm);
  const reached = route.stops.filter((s) => s.km <= km).length;
  return {
    km,
    fraction: route.totalKm > 0 ? km / route.totalKm : 1,
    reached,
    next: route.stops[reached] ?? null,
    last: route.stops[Math.max(reached - 1, 0)]!,
    done: reached >= route.stops.length,
  };
}

/** Whole kilometres, or one decimal under 10 so the first day still shows movement. */
export function formatKm(km: number): string {
  return km < 10 ? km.toFixed(1).replace(/\.0$/, '') : Math.floor(km).toLocaleString();
}

/** "about 5 days", "about 3 weeks", "about 4 months". */
export function formatDuration(days: number): string {
  if (days <= 1) return 'about a day';
  if (days < 14) return `about ${Math.round(days)} days`;
  if (days < 60) return `about ${Math.round(days / 7)} weeks`;
  const months = Math.round(days / 30);
  return months >= 12 ? 'over a year' : `about ${months} months`;
}

/** Day number of a journey (day 1 is the start day). `day` is a YYYY-MM-DD key. */
export function journeyDay(startedOn: string, until: Date = new Date()): number {
  const start = new Date(`${startedOn}T12:00:00`);
  const end = new Date(until);
  end.setHours(12, 0, 0, 0);
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);
}
