// Android widgets: the step ring and the pet, on the home screen and (Android 16 QPR2 and later)
// the lock screen. Drawn from what src/lib/widgets/data.ts saved, so the app needn't be open.
//
// The library calls these components as plain functions rather than rendering them, so the React
// Compiler must leave them alone: its memo cache is a hook, which throws there and leaves the widget
// blank.
'use no memo';

import {
  FlexWidget,
  OverlapWidget,
  SvgWidget,
  TextWidget,
  type ColorProp,
  type WidgetInfo,
  type WidgetRepresentation,
} from 'react-native-android-widget';

import { formatSteps } from '@/lib/dates';
import { readWidgetState, widgetView, type WidgetColors, type WidgetView } from '@/lib/widgets/data';
import { backgroundSvg, cropAround, petSpot, ringSvg, sceneSvg } from '@/lib/widgets/scene-svg';

/** The names in app.json's react-native-android-widget entry. */
export const ANDROID_WIDGETS = ['Steps', 'Pet'] as const;
export type AndroidWidgetName = (typeof ANDROID_WIDGETS)[number];

/** The click action for tapping the pet (handled in src/widgets/register.android.ts). */
export const PET_TAP = 'PET';

type Size = { width: number; height: number };

/** One frame of the ring filling to a new count, or the pet mid-play. */
export type Moment = { progress?: number; steps?: number; petted?: number };

const hexColor = (color: string) => color as `#${string}`;

/** #RRGGBB at `alpha`, for the pet's name tag over its world. */
function translucent(color: string, alpha: number): ColorProp {
  const n = parseInt(color.slice(1), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/**
 * Fills the widget with the app's background (the theme colour and its glows) and opens Steppa (at
 * `uri`) when tapped.
 */
function Frame({ c, size, uri, children, padding = 12, row = false, top = false }: { c: WidgetColors; size: Size; uri: string; children: React.ReactNode; padding?: number; row?: boolean; top?: boolean }) {
  return (
    <OverlapWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri }}
      style={{ width: 'match_parent', height: 'match_parent', borderRadius: 24, backgroundColor: hexColor(c.background), overflow: 'hidden' }}>
      <SvgWidget
        svg={backgroundSvg(c.background, c.glows, Math.max(1, Math.round(size.width)), Math.max(1, Math.round(size.height)))}
        style={{ width: 'match_parent', height: 'match_parent' }}
      />
      <FlexWidget
        style={{
          width: 'match_parent',
          height: 'match_parent',
          padding,
          flexDirection: row ? 'row' : 'column',
          alignItems: top ? 'flex-start' : 'center',
          justifyContent: top ? 'flex-start' : 'center',
          flexGap: row ? 16 : 0,
        }}>
        {children}
      </FlexWidget>
    </OverlapWidget>
  );
}

function Message({ c, size, uri, title, body }: { c: WidgetColors; size: Size; uri: string; title: string; body: string }) {
  return (
    <Frame c={c} size={size} uri={uri} padding={16} top>
      <TextWidget text={title} style={{ fontSize: 15, fontWeight: '600', color: hexColor(c.text) }} />
      <TextWidget text={body} maxLines={3} style={{ fontSize: 13, color: hexColor(c.muted), marginTop: 4 }} />
    </Frame>
  );
}

function StepsWidget({ v, c, size }: { v: WidgetView; c: WidgetColors; size: Size }) {
  if (!v.ready) return <Message c={c} size={size} uri="steppa://" title="Steps today" body="Open Steppa to sync your steps." />;
  const number = hexColor(v.over ? c.overText : c.primary);
  const wide = size.width >= 220 && size.width > size.height * 1.4;
  // Inside the padding: 12 a side when small, 16 beside the details.
  const ring = Math.max(48, Math.min(wide ? size.height - 32 : Math.min(size.width, size.height) - 24, 150));
  const percent = `${Math.round(v.progress * 100)}%`;

  // The ring, with the count (or, beside the details, the percentage) in the middle.
  const dial = (
    <OverlapWidget style={{ width: ring, height: ring }}>
      <SvgWidget svg={ringSvg(v.progress, ring, c)} style={{ width: ring, height: ring }} />
      <FlexWidget style={{ width: ring, height: ring, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: ring * 0.14 }}>
        <TextWidget
          text={wide ? percent : v.stepsText}
          maxLines={1}
          style={{ fontSize: Math.round(ring * (wide ? 0.2 : 0.19)), fontWeight: '700', color: number, adjustsFontSizeToFit: true }}
        />
        {!wide && ring >= 96 ? (
          <TextWidget text={`of ${formatSteps(v.goal)}`} maxLines={1} style={{ fontSize: 12, color: hexColor(c.muted) }} />
        ) : null}
      </FlexWidget>
    </OverlapWidget>
  );

  if (!wide) return <Frame c={c} size={size} uri="steppa://">{dial}</Frame>;
  return (
    <Frame c={c} size={size} uri="steppa://" row padding={16}>
      {dial}
      <FlexWidget style={{ flex: 1, flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start' }}>
        <TextWidget text="Steps today" style={{ fontSize: 13, fontWeight: '500', color: hexColor(c.muted) }} />
        <TextWidget text={v.stepsText} maxLines={1} style={{ fontSize: 32, fontWeight: '700', color: number, adjustsFontSizeToFit: true }} />
        <TextWidget text={v.goalText} maxLines={1} style={{ fontSize: 13, color: hexColor(c.muted) }} />
        {v.streak > 1 ? (
          <TextWidget text={`${v.streak}-day streak`} maxLines={1} style={{ fontSize: 13, fontWeight: '600', color: hexColor(c.text), marginTop: 2 }} />
        ) : null}
      </FlexWidget>
    </Frame>
  );
}

function PetWidget({ v, c, size, petted }: { v: WidgetView; c: WidgetColors; size: Size; petted: number }) {
  if (!v.ready) return <Message c={c} size={size} uri="steppa://pet" title="Your pet" body="Open Steppa to see your pet." />;
  if (!v.pet) return <Message c={c} size={size} uri="steppa://pet" title="Your pet" body="Adopt a pet on the Pet tab, and it will live here." />;
  const { art, name, feeling, says } = v.pet;
  const width = Math.max(40, Math.round(size.width));
  const height = Math.max(40, Math.round(size.height));
  const crop = cropAround(art, width / height);
  const spot = petSpot(art, crop);
  // Small enough (the lock screen's narrow slot) and there's only room for the picture.
  const tag = width >= 110 && height >= 110;
  // Wide enough for the name tag to say how it feels as well as the steps beside it.
  const roomy = width >= 250;
  const said = petted > 0 && says.length ? says[(petted - 1) % says.length] : null;
  const bubble = 110;
  return (
    <OverlapWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: 'steppa://pet' }}
      style={{ width: 'match_parent', height: 'match_parent', borderRadius: 24, backgroundColor: hexColor(c.background), overflow: 'hidden' }}>
      <SvgWidget svg={sceneSvg(art, crop, width, height, petted > 0)} style={{ width: 'match_parent', height: 'match_parent' }} />
      {/* Tapping the pet plays with it, as on the Pet tab; anywhere else opens the Pet tab. */}
      {spot ? (
        <FlexWidget
          clickAction={PET_TAP}
          style={{
            marginLeft: Math.round(spot.box.x * width),
            marginTop: Math.round(spot.box.y * height),
            width: Math.max(1, Math.round(spot.box.w * width)),
            height: Math.max(1, Math.round(spot.box.h * height)),
            backgroundColor: '#00000000',
          }}
        />
      ) : null}
      {said && spot ? (
        <FlexWidget
          style={{
            marginLeft: Math.round(Math.min(width - bubble - 6, Math.max(6, spot.head.x * width - bubble / 2))),
            marginTop: Math.round(Math.max(tag ? 58 : 6, spot.head.y * height - 44)),
            width: bubble,
            alignItems: 'center',
          }}>
          <TextWidget
            text={said}
            maxLines={1}
            style={{ fontSize: 13, fontWeight: '600', color: '#1C1B1F', backgroundColor: 'rgba(255, 255, 255, 0.93)', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5 }}
          />
        </FlexWidget>
      ) : null}
      {/* Up in the sky: the name tag on the left, today's steps on the right. A small widget has
          room for just the name (its face shows how it feels); a long name gives way to the steps. */}
      {tag ? (
        <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'flex-start', padding: 10 }}>
          <FlexWidget style={{ flex: 1, flexDirection: 'column', alignItems: 'flex-start', marginRight: 6 }}>
            <FlexWidget
              style={{
                flexDirection: 'column',
                backgroundColor: translucent(c.background, 0.86),
                borderRadius: 12,
                paddingHorizontal: 10,
                paddingVertical: 6,
              }}>
              <TextWidget text={name} maxLines={1} truncate="END" style={{ fontSize: 14, fontWeight: '600', color: hexColor(c.text) }} />
              {roomy ? (
                <TextWidget text={petted > 0 ? 'Loved that' : feeling} maxLines={1} truncate="END" style={{ fontSize: 12, color: hexColor(c.muted) }} />
              ) : null}
            </FlexWidget>
          </FlexWidget>
          <FlexWidget
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: translucent(c.background, 0.86),
              borderRadius: 12,
              paddingHorizontal: 8,
              paddingVertical: 4,
              flexGap: 4,
            }}>
            <SvgWidget svg={ringSvg(v.progress, 13, c, 0.2)} style={{ width: 13, height: 13 }} />
            <TextWidget text={v.stepsText} maxLines={1} style={{ fontSize: 12, fontWeight: '600', color: hexColor(c.text) }} />
          </FlexWidget>
        </FlexWidget>
      ) : null}
    </OverlapWidget>
  );
}

/**
 * One widget, in both the light and the dark scheme (Android picks by the phone's setting). A
 * `moment` overrides what's saved: a frame of the ring filling, or the pet being played with.
 */
export function renderAndroidWidget(name: string, info: Pick<WidgetInfo, 'width' | 'height'>, moment: Moment = {}): WidgetRepresentation {
  const saved = widgetView(readWidgetState());
  const v =
    moment.progress === undefined
      ? saved
      : { ...saved, progress: moment.progress, stepsText: formatSteps(moment.steps ?? saved.steps) };
  const size = { width: info.width, height: info.height };
  const draw = (c: WidgetColors) =>
    name === 'Pet' ? <PetWidget v={v} c={c} size={size} petted={moment.petted ?? 0} /> : <StepsWidget v={v} c={c} size={size} />;
  return { light: draw(v.light), dark: draw(v.dark) };
}
