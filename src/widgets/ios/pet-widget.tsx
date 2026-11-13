// iOS Pet widget: your pet in its world on the home screen, and how it's feeling on the Lock Screen.
// Runs in the widget's own runtime (see steps-widget.tsx): everything it uses lives inside it. The
// pictures are PNGs the app draws into the shared widgets folder (src/lib/widgets/publish.ios.ts).

import { Button, Circle, HStack, Image, Rectangle, Spacer, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import {
  aspectRatio,
  background,
  buttonStyle,
  clipped,
  containerBackground,
  containerRelativeFrame,
  contentShape,
  contentTransition,
  font,
  foregroundStyle,
  frame,
  layoutPriority,
  lineLimit,
  minimumScaleFactor,
  monospacedDigit,
  offset,
  opacity,
  padding,
  resizable,
  rotationEffect,
  shapes,
  strokeBorder,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

import type { WidgetColors } from '@/lib/widgets/data';

/** Where the pet is in a picture, as shares of it: the box to tap and the top of its head. */
export type PetSpotShares = { box: { x: number; y: number; w: number; h: number }; head: { x: number; y: number } };

/** One of the two pictures (small and medium widgets), plain and enjoying itself. */
export type PetPicture = { plain: string; happy: string | null; spot: PetSpotShares | null };

export type PetWidgetProps = {
  ready: boolean;
  hasPet: boolean;
  name: string;
  /** "Snoozing", "Happy"... */
  feeling: string;
  /** "Biscuit is happy · 2,340 steps to your goal". */
  line: string;
  /** Today's steps, for the little tag in the corner, and the share of the goal for its ring. */
  stepsText: string;
  progress: number;
  /** The app's ring colour (Settings), or null for the theme's. */
  ringColor: string | null;
  /** What it says when tapped, in turn. */
  says: string[];
  /** Taps since the app last updated the widget: 0 for none, then it smiles and says something. */
  pets: number;
  square: PetPicture | null;
  wide: PetPicture | null;
  light: WidgetColors;
  dark: WidgetColors;
};

const PetWidget = (props: PetWidgetProps, env: WidgetEnvironment) => {
  'widget';
  const c = env.colorScheme === 'dark' ? props.dark : props.light;
  const family = env.widgetFamily;
  // No timeline yet (the widget gallery, or before Steppa first runs): just the name.
  if (!c) {
    return <Text modifiers={[containerBackground(env.colorScheme === 'dark' ? '#191C1A' : '#F6FBF6', 'widget'), widgetURL('steppa://pet')]}>Steppa</Text>;
  }
  const url = widgetURL('steppa://pet');

  if (family === 'accessoryInline') {
    return <Text modifiers={[url]}>{props.hasPet ? `${props.name} · ${props.feeling}` : 'Steppa'}</Text>;
  }

  if (family === 'accessoryRectangular') {
    return (
      <VStack alignment="leading" spacing={2} modifiers={[url]}>
        <Text modifiers={[font({ size: 17, weight: 'semibold', design: 'rounded' }), lineLimit(1)]}>
          {props.hasPet ? props.name : 'Your pet'}
        </Text>
        <Text modifiers={[font({ size: 13 }), lineLimit(2)]}>
          {props.hasPet ? props.line.replace(`${props.name} is `, '').replace(/^./, (l) => l.toUpperCase()) : 'Adopt one in Steppa'}
        </Text>
      </VStack>
    );
  }

  const picture = family === 'systemSmall' ? props.square : props.wide;
  if (!props.hasPet || !picture) {
    return (
      <HStack modifiers={[containerBackground(c.background, 'widget'), url, padding({ all: 16 })]}>
        <VStack alignment="leading" spacing={6}>
          <Text modifiers={[font({ size: 15, weight: 'semibold' }), foregroundStyle(c.text)]}>Your pet</Text>
          <Text modifiers={[font({ size: 13 }), foregroundStyle(c.muted)]}>
            {props.ready ? 'Adopt a pet on the Pet tab, and it will live here.' : 'Open Steppa to see your pet.'}
          </Text>
          <Spacer />
        </VStack>
        <Spacer />
      </HStack>
    );
  }

  // A typical iPhone's widget size, to place the tap area and speech bubble on the pet.
  const width = family === 'systemSmall' ? 158 : 338;
  const height = 158;
  const petted = props.pets > 0;
  const spot = picture.spot;
  const said = petted && props.says.length ? props.says[(props.pets - 1) % props.says.length] : null;
  const bubbleWidth = 110;

  // A tiny copy of the Steps widget's ring (see steps-widget.tsx for how the dashes draw the arcs).
  const stepRing = (size: number, stroke: number) => {
    const lap = Math.PI * (size - stroke);
    const capTurn = (stroke / (size - stroke)) * (180 / Math.PI);
    // Clear circles with circular outlines: @expo/ui's strokeBorder outlines a rectangle by default.
    const arc = (part: number, color: string) => (
      <Circle
        modifiers={[
          foregroundStyle('#00000000'),
          strokeBorder({ shape: 'circle', content: color, style: { lineWidth: stroke, lineCap: 'round', dash: [lap, lap], dashPhase: lap - Math.max(0, part * lap - stroke) } }),
          rotationEffect(-90 + capTurn),
          opacity(part > 0 ? 1 : 0),
          frame({ width: size, height: size }),
        ]}
      />
    );
    return (
      <ZStack modifiers={[frame({ width: size, height: size })]}>
        <Circle modifiers={[foregroundStyle('#00000000'), strokeBorder({ shape: 'circle', content: c.trackAlpha < 1 ? `${c.track}${Math.round(c.trackAlpha * 255).toString(16).padStart(2, '0')}` : c.track, style: { lineWidth: stroke } }), frame({ width: size, height: size })]} />
        {arc(Math.min(1, props.progress), props.ringColor ?? c.primary)}
        {arc(Math.min(1, Math.max(0, props.progress - 1)), c.over)}
      </ZStack>
    );
  };

  // The scene fills the widget, edge to edge. Tapping the pet plays with it (iOS 17): it smiles,
  // hearts float up and it says something; anywhere else opens the Pet tab. The name sits on a
  // frosted tag up in the sky, clear of the pet.
  return (
    <ZStack alignment="topLeading" modifiers={[containerBackground(c.background, 'widget'), url]}>
      <Image
        uiImage={petted && picture.happy ? picture.happy : picture.plain}
        modifiers={[resizable(), aspectRatio({ contentMode: 'fill' }), containerRelativeFrame({ axes: 'both' }), clipped()]}
      />
      {spot ? (
        <Button
          target="pet"
          onPress={() => ({ ...props, pets: props.pets + 1 })}
          modifiers={[
            buttonStyle('plain'),
            frame({ width: spot.box.w * width, height: spot.box.h * height }),
            offset({ x: spot.box.x * width, y: spot.box.y * height }),
          ]}>
          <Rectangle modifiers={[foregroundStyle('#FFFFFF01'), contentShape(shapes.rectangle())]} />
        </Button>
      ) : null}
      {said && spot ? (
        // In a widget a Text's modifiers are applied twice (once by the Text, once by the view around
        // it), so padding, backgrounds and offsets would double up. The Text only gets its font; a
        // stack holds the capsule, hugging the words, and another places it, at most bubbleWidth wide.
        <VStack
          modifiers={[
            frame({ width: bubbleWidth }),
            offset({
              x: Math.min(width - bubbleWidth - 6, Math.max(6, spot.head.x * width - bubbleWidth / 2)),
              y: Math.max(54, spot.head.y * height - 44),
            }),
          ]}>
          <HStack modifiers={[padding({ horizontal: 10, vertical: 5 }), background('#FFFFFFEE', shapes.capsule())]}>
            <Text modifiers={[font({ size: 12, weight: 'semibold', design: 'rounded' }), foregroundStyle('#1C1B1F'), lineLimit(1), minimumScaleFactor(0.75)]}>
              {said}
            </Text>
          </HStack>
        </VStack>
      ) : null}
      {/* Up in the sky: the name tag on the left, today's steps on the right. A small widget has
          room for just the name (its face shows how it feels); a long name gives way to the steps. */}
      <HStack alignment="top" modifiers={[padding({ all: 10 })]}>
        <VStack
          alignment="leading"
          spacing={1}
          modifiers={[
            padding({ horizontal: 10, vertical: 6 }),
            background({ type: 'material', material: 'regular' }, shapes.roundedRectangle({ cornerRadius: 12, roundedCornerStyle: 'continuous' })),
          ]}>
          <Text modifiers={[font({ size: 14, weight: 'semibold', design: 'rounded' }), foregroundStyle(c.text), lineLimit(1)]}>{props.name}</Text>
          {family === 'systemSmall' ? null : (
            <Text modifiers={[font({ size: 12 }), foregroundStyle(c.muted), lineLimit(1)]}>{petted ? 'Loved that' : props.feeling}</Text>
          )}
        </VStack>
        <Spacer minLength={6} />
        {props.ready ? (
          <HStack
            spacing={4}
            modifiers={[
              padding({ horizontal: 8, vertical: 5 }),
              background({ type: 'material', material: 'regular' }, shapes.capsule()),
              layoutPriority(1),
            ]}>
            {stepRing(12, 2.5)}
            <Text modifiers={[font({ size: 12, weight: 'semibold', design: 'rounded' }), foregroundStyle(c.text), monospacedDigit(), lineLimit(1), contentTransition('numericText')]}>
              {props.stepsText}
            </Text>
          </HStack>
        ) : null}
      </HStack>
    </ZStack>
  );
};

export default createWidget('PetWidget', PetWidget);
