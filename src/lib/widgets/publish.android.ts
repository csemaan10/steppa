import { requestWidgetUpdate } from 'react-native-android-widget';

import { readWidgetState, widgetView } from '@/lib/widgets/data';
import { renderAndroidWidget, type Moment } from '@/widgets/android/widgets';

/** The ring's last drawn share of the goal, so the next update can fill from there. */
const DRAWN_KEY = 'steppa:widget-ring';
/** The fill: a handful of frames, easing out, over about two thirds of a second. */
const FRAMES = 8;
const FRAME_MS = 80;

function readDrawn(): { progress: number; steps: number } | null {
  try {
    const saved = localStorage.getItem(DRAWN_KEY);
    return saved ? (JSON.parse(saved) as { progress: number; steps: number }) : null;
  } catch {
    return null;
  }
}

function saveDrawn(progress: number, steps: number): void {
  try {
    localStorage.setItem(DRAWN_KEY, JSON.stringify({ progress, steps }));
  } catch {}
}

function draw(widgetName: 'Steps' | 'Pet', moment?: Moment): Promise<void> {
  return requestWidgetUpdate({ widgetName, renderWidget: (info) => renderAndroidWidget(widgetName, info, moment) }).catch((e) =>
    console.warn('Could not update the widget', widgetName, e)
  );
}

/** Bumped by each refresh, so an older fill stops when a newer one starts. */
let run = 0;

/**
 * Redraws every Steps and Pet widget on the home screen and lock screen. When the count has moved,
 * the ring fills (or empties, at midnight) to it over a few frames and the number counts along.
 * Never throws.
 */
export function refreshWidgets(): void {
  const mine = ++run;
  const v = widgetView(readWidgetState());
  const from = readDrawn();
  saveDrawn(v.progress, v.steps);
  if (!from || (Math.abs(from.progress - v.progress) < 0.005 && from.steps === v.steps)) {
    void draw('Pet');
    void draw('Steps');
    return;
  }
  void (async () => {
    for (let i = 1; i <= FRAMES; i++) {
      if (run !== mine) return;
      const t = 1 - (1 - i / FRAMES) ** 3;
      const moment =
        i === FRAMES
          ? undefined
          : { progress: from.progress + (v.progress - from.progress) * t, steps: Math.round(from.steps + (v.steps - from.steps) * t) };
      // The pet's step tag fills along too, at half the frames: each of its frames redraws the whole scene.
      await Promise.all([draw('Steps', moment), i % 2 === 0 ? draw('Pet', moment) : null]);
      if (i < FRAMES) await new Promise((resolve) => setTimeout(resolve, FRAME_MS));
    }
  })();
}
