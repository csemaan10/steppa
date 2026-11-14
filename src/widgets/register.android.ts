import { registerWidgetTaskHandler } from 'react-native-android-widget';

import { PET_TAP, phoneSideways, renderAndroidWidget } from '@/widgets/android/widgets';

/** How long the pet stays pleased after a tap before it settles back. */
const PLAY_MS = 4000;
/** Taps on each pet widget so far, so it says something new each time. */
const taps = new Map<number, number>();

// Android asks for a widget's picture when it's added, resized, or every half hour (app.json's
// updatePeriodMillis), even with the app closed; the picture comes from what was last saved, so a
// new day starts at 0 steps on time. Tapping the pet runs here too, without opening the app.
registerWidgetTaskHandler(async ({ widgetInfo, widgetAction, clickAction, renderWidget }) => {
  // The half-hourly refresh waits while the phone is sideways: drawn then, a square widget would
  // get the wide layout (see phoneSideways). Adding and resizing happen on the home screen, so they draw.
  if (widgetAction === 'WIDGET_UPDATE' && phoneSideways(widgetInfo)) return;
  if (widgetAction === 'WIDGET_ADDED' || widgetAction === 'WIDGET_UPDATE' || widgetAction === 'WIDGET_RESIZED') {
    renderWidget(renderAndroidWidget(widgetInfo.widgetName, widgetInfo));
    return;
  }
  if (widgetAction === 'WIDGET_CLICK' && clickAction === PET_TAP) {
    const tap = (taps.get(widgetInfo.widgetId) ?? 0) + 1;
    taps.set(widgetInfo.widgetId, tap);
    // It smiles, hearts float up and it says something; then, unless tapped again, it settles.
    renderWidget(renderAndroidWidget(widgetInfo.widgetName, widgetInfo, { petted: tap }));
    await new Promise((resolve) => setTimeout(resolve, PLAY_MS));
    if (taps.get(widgetInfo.widgetId) === tap) renderWidget(renderAndroidWidget(widgetInfo.widgetName, widgetInfo));
  }
});
