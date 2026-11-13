import { Skia } from '@shopify/react-native-skia';
import { Directory, File } from 'expo-file-system';
import { widgetsDirectory, type WidgetTimelineEntry } from 'expo-widgets';

import { THICKNESS_SCALE } from '@/lib/ring-style';
import { formatSteps } from '@/lib/dates';
import { nextMidnight, nextSkyChange, readWidgetState, widgetView, type PetView, type WidgetView } from '@/lib/widgets/data';
import { styledRingSvg } from '@/lib/widgets/ring-svg';
import { cropAround, petSpot, sceneSvg } from '@/lib/widgets/scene-svg';
import PetWidget, { type PetPicture, type PetWidgetProps } from '@/widgets/ios/pet-widget';
import StepsWidget, { type StepsWidgetProps } from '@/widgets/ios/steps-widget';

/** Pixel sizes of the pet pictures: a small widget (square) and a medium one, at 3x. */
const SQUARE = { width: 510, height: 510 };
const WIDE = { width: 1092, height: 510 };
/** The Steps widget's ring picture: 112 points across, at 3x. */
const RING = 336;
/** What the widget pictures in the shared folder are named by. */
const PREFIXES = ['pet-', 'ring-'];

/** A short, stable name for a picture, so an unchanged one isn't drawn twice. */
function hash(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** Draws an SVG as a PNG in the shared widgets folder; its file:// URI, or null. */
function png(svg: string, size: { width: number; height: number }, keep: Set<string>, prefix = 'pet-'): string | null {
  if (!widgetsDirectory) return null;
  const file = new File(widgetsDirectory, `${prefix}${hash(svg)}.png`);
  keep.add(file.uri);
  if (file.exists) return file.uri;
  const dom = Skia.SVG.MakeFromString(svg);
  const surface = Skia.Surface.Make(size.width, size.height);
  if (!dom || !surface) return null;
  surface.getCanvas().drawSvg(dom, size.width, size.height);
  surface.flush();
  file.write(surface.makeImageSnapshot().encodeToBytes());
  return file.uri;
}

/**
 * The pet's world for one widget size, and where the pet is in it. `happy` also draws it enjoying
 * itself, for when it's tapped; only the entry showing now needs that.
 */
function petPicture(pet: PetView, size: { width: number; height: number }, happy: boolean, keep: Set<string>): PetPicture | null {
  const crop = cropAround(pet.art, size.width / size.height);
  const plain = png(sceneSvg(pet.art, crop, size.width, size.height), size, keep);
  if (!plain) return null;
  return {
    plain,
    happy: happy ? png(sceneSvg(pet.art, crop, size.width, size.height, true), size, keep) : null,
    spot: petSpot(pet.art, crop),
  };
}

/** The ring in the app's style, light and dark; null for Classic, which the widget draws itself. */
function ringImage(v: WidgetView, keep: Set<string>): StepsWidgetProps['ringImage'] {
  if (v.ring.style === 'classic') return null;
  try {
    const size = { width: RING, height: RING };
    const light = png(styledRingSvg(v.progress, RING, v.ring, v.light), size, keep, 'ring-');
    const dark = png(styledRingSvg(v.progress, RING, v.ring, v.dark), size, keep, 'ring-');
    return light && dark ? { light, dark } : null;
  } catch (e) {
    console.warn('Could not draw the ring for its widget', e);
    return null;
  }
}

function stepsProps(v: WidgetView, keep: Set<string>): StepsWidgetProps {
  return {
    ready: v.ready,
    stepsText: v.stepsText,
    shortSteps: v.shortSteps,
    goalText: v.goalText,
    ofGoal: `of ${formatSteps(v.goal)}`,
    progress: v.progress,
    over: v.over,
    streak: v.streak,
    ringColor: v.ring.color,
    ringScale: THICKNESS_SCALE[v.ring.thickness],
    ringImage: ringImage(v, keep),
    light: v.light,
    dark: v.dark,
  };
}

function petProps(v: WidgetView, keep: Set<string>, happy = false): PetWidgetProps {
  let square: PetPicture | null = null;
  let wide: PetPicture | null = null;
  if (v.pet) {
    try {
      square = petPicture(v.pet, SQUARE, happy, keep);
      wide = petPicture(v.pet, WIDE, happy, keep);
    } catch (e) {
      console.warn('Could not draw the pet for its widget', e);
    }
  }
  return {
    ready: v.ready,
    hasPet: !!v.pet,
    name: v.pet?.name ?? 'Your pet',
    feeling: v.pet?.feeling ?? '',
    line: v.pet?.line ?? '',
    stepsText: v.stepsText,
    progress: v.progress,
    ringColor: v.ring.color,
    says: v.pet?.says ?? [],
    pets: 0,
    square,
    wide,
    light: v.light,
    dark: v.dark,
  };
}

/** What was last handed to each widget, so a sync that changed nothing doesn't reload them. */
let lastSteps = '';
let lastPet = '';

/**
 * Hands both widgets a timeline: what's saved now, then a fresh day at midnight (0 steps, a sleepy
 * pet at night), so they roll over even if Steppa doesn't run then. Never throws. Pictures are
 * drawn only when the pet's look changes (a new mood, sky or outfit); otherwise they're reused.
 */
export function refreshWidgets(): void {
  try {
    const state = readWidgetState();
    const now = new Date();
    const midnight = nextMidnight(now);
    const views = [widgetView(state, now), widgetView(state, midnight)] as const;
    // Every picture an entry uses; any other in the folder is left over and goes.
    const keep = new Set<string>();

    const steps: WidgetTimelineEntry<StepsWidgetProps>[] = [
      { date: now, props: stepsProps(views[0], keep) },
      { date: midnight, props: stepsProps(views[1], keep) },
    ];
    const stepsKey = JSON.stringify(steps.map((e) => e.props));
    const stepsChanged = stepsKey !== lastSteps;
    if (stepsChanged) {
      StepsWidget.updateTimeline(steps);
      lastSteps = stepsKey;
    }

    // The pet's sky also turns with the hour (dusk, night...), so it gets the next change too.
    const sky = nextSkyChange(now);
    const pet: WidgetTimelineEntry<PetWidgetProps>[] = [
      { date: now, props: petProps(views[0], keep, true) },
      ...(sky ? [{ date: sky, props: petProps(widgetView(state, sky), keep) }] : []),
      { date: midnight, props: petProps(views[1], keep) },
    ];
    const petKey = JSON.stringify(pet.map((e) => e.props));
    const petChanged = petKey !== lastPet;
    if (petChanged) {
      PetWidget.updateTimeline(pet);
      lastPet = petKey;
    }
    // Pictures no entry uses any more.
    if ((stepsChanged || petChanged) && widgetsDirectory) {
      for (const item of new Directory(widgetsDirectory).list()) {
        if (item instanceof File && PREFIXES.some((p) => item.name.startsWith(p)) && !keep.has(item.uri)) item.delete();
      }
    }
  } catch (e) {
    console.warn('Could not update the widgets', e);
  }
}
