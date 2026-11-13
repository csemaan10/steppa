// iOS Steps widget: today's ring on the home screen, and a ring, bar or line on the Lock Screen.
// The function below runs in the widget's own runtime (see expo-widgets' 'widget' directive): it
// can't see anything outside itself, so every helper and constant lives inside it.

import { Circle, Gauge, HStack, Image, Rectangle, Spacer, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import {
  containerBackground,
  contentTransition,
  font,
  foregroundStyle,
  frame,
  gaugeStyle,
  lineLimit,
  minimumScaleFactor,
  monospacedDigit,
  opacity,
  padding,
  resizable,
  rotationEffect,
  strokeBorder,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

import type { WidgetColors } from '@/lib/widgets/data';

export type StepsWidgetProps = {
  ready: boolean;
  stepsText: string;
  shortSteps: string;
  goalText: string;
  /** "of 10,000", under the number in the small ring. */
  ofGoal: string;
  progress: number;
  over: boolean;
  streak: number;
  /** The app's ring colour (Settings), or null for the theme's; and its thickness, × the usual. */
  ringColor: string | null;
  ringScale: number;
  /**
   * A picture of the ring in the app's style, in each scheme, for every style but Classic (which is
   * drawn here, so it can sweep). Null for Classic.
   */
  ringImage: { light: string; dark: string } | null;
  light: WidgetColors;
  dark: WidgetColors;
};

const StepsWidget = (props: StepsWidgetProps, env: WidgetEnvironment) => {
  'widget';
  const c = env.colorScheme === 'dark' ? props.dark : props.light;
  const family = env.widgetFamily;
  // No timeline yet (the widget gallery, or before Steppa first runs): just the name.
  if (!c) {
    return <Text modifiers={[containerBackground(env.colorScheme === 'dark' ? '#191C1A' : '#F6FBF6', 'widget'), widgetURL('steppa://')]}>Steppa</Text>;
  }
  const share = Math.min(1, props.progress);
  const percent = `${Math.round(props.progress * 100)}%`;
  const numberColor = props.over ? c.overText : c.primary;
  const url = widgetURL('steppa://');
  // New counts roll into place, digit by digit, when the widget updates.
  const rolls = contentTransition('numericText');

  if (family === 'accessoryInline') {
    return <Text modifiers={[url]}>{props.ready ? `${props.stepsText} steps · ${percent}` : 'Steppa'}</Text>;
  }

  if (family === 'accessoryCircular') {
    return (
      <Gauge
        value={share}
        modifiers={[gaugeStyle('circularCapacity'), url]}
        currentValueLabel={<Text modifiers={[font({ size: 13, weight: 'semibold', design: 'rounded' }), minimumScaleFactor(0.6), rolls]}>{props.shortSteps}</Text>}>
        <Text>Steps</Text>
      </Gauge>
    );
  }

  if (family === 'accessoryRectangular') {
    return (
      <VStack alignment="leading" spacing={3} modifiers={[url]}>
        <Text modifiers={[font({ size: 17, weight: 'semibold', design: 'rounded' }), monospacedDigit(), lineLimit(1), rolls]}>
          {props.ready ? `${props.stepsText} steps` : 'Steps today'}
        </Text>
        <Gauge value={share} modifiers={[gaugeStyle('linearCapacity')]} />
        <Text modifiers={[font({ size: 13 }), lineLimit(1)]}>{props.ready ? props.goalText : 'Open Steppa to sync'}</Text>
      </VStack>
    );
  }

  // The app's screen background: the theme colour with three soft glows (screenBackground). Sizes
  // are a typical iPhone's; the glows are soft enough that a few points either way don't show.
  const width = family === 'systemMedium' ? 338 : 158;
  const height = 158;
  const backdrop = c.glows.map((g, i) => {
    const cx = g.x * width;
    const cy = g.y * height;
    const reach = g.reach * Math.hypot(Math.max(cx, width - cx), Math.max(cy, height - cy));
    const alpha = Math.round(g.alpha * 255).toString(16).padStart(2, '0');
    return (
      <Rectangle
        key={i}
        modifiers={[
          foregroundStyle({ type: 'radialGradient', colors: [`${g.color}${alpha}`, `${g.color}00`], center: { x: g.x, y: g.y }, startRadius: 0, endRadius: reach }),
        ]}
      />
    );
  });

  // The ring. Each arc is one long dash on a circle, slid round by its phase so exactly its share
  // shows; changing only the phase lets SwiftUI sweep the arc to a new value when the widget updates.
  // A circle starts at three o'clock, so it's turned back a quarter (less half a round cap) to start
  // at twelve, like the app's ring.
  const ringColor = props.ringColor ?? c.primary;
  const ring = (size: number) => {
    if (props.ringImage) {
      return (
        <Image
          uiImage={env.colorScheme === 'dark' ? props.ringImage.dark : props.ringImage.light}
          modifiers={[resizable(), frame({ width: size, height: size })]}
        />
      );
    }
    // The app's Home ring's proportions: a 14 stroke on 176.
    const stroke = ((size * 14) / 176) * props.ringScale;
    const lap = Math.PI * (size - stroke);
    const capTurn = (stroke / (size - stroke)) * (180 / Math.PI);
    // @expo/ui's strokeBorder lays the outline over the view, a rectangle unless it's told otherwise,
    // so each ring is a clear circle with a circular outline.
    const arc = (part: number, color: string) => (
      <Circle
        modifiers={[
          foregroundStyle('#00000000'),
          strokeBorder({
            shape: 'circle',
            content: color,
            style: { lineWidth: stroke, lineCap: 'round', dash: [lap, lap], dashPhase: lap - Math.max(0, part * lap - stroke) },
          }),
          rotationEffect(-90 + capTurn),
          opacity(part > 0 ? 1 : 0),
          frame({ width: size, height: size }),
        ]}
      />
    );
    return (
      <ZStack modifiers={[frame({ width: size, height: size })]}>
        <Circle modifiers={[foregroundStyle('#00000000'), strokeBorder({ shape: 'circle', content: c.trackAlpha < 1 ? `${c.track}${Math.round(c.trackAlpha * 255).toString(16).padStart(2, '0')}` : c.track, style: { lineWidth: stroke } }), frame({ width: size, height: size })]} />
        {arc(share, ringColor)}
        {arc(Math.min(1, Math.max(0, props.progress - 1)), c.over)}
      </ZStack>
    );
  };

  const content = !props.ready ? (
    <HStack modifiers={[padding({ all: 16 })]}>
      <VStack alignment="leading" spacing={6}>
        <Text modifiers={[font({ size: 15, weight: 'semibold' }), foregroundStyle(c.text)]}>Steps today</Text>
        <Text modifiers={[font({ size: 13 }), foregroundStyle(c.muted)]}>Open Steppa to sync your steps.</Text>
        <Spacer />
      </VStack>
      <Spacer />
    </HStack>
  ) : family === 'systemMedium' ? (
    <HStack spacing={18} modifiers={[padding({ all: 16 })]}>
      <ZStack>
        {ring(112)}
        <Text modifiers={[font({ size: 22, weight: 'bold', design: 'rounded' }), foregroundStyle(numberColor), monospacedDigit(), rolls]}>{percent}</Text>
      </ZStack>
      <VStack alignment="leading" spacing={2}>
        <Text modifiers={[font({ size: 13, weight: 'medium' }), foregroundStyle(c.muted)]}>Steps today</Text>
        <Text
          modifiers={[
            font({ size: 34, weight: 'bold', design: 'rounded' }),
            foregroundStyle(numberColor),
            monospacedDigit(),
            lineLimit(1),
            minimumScaleFactor(0.6),
            rolls,
          ]}>
          {props.stepsText}
        </Text>
        <Text modifiers={[font({ size: 13 }), foregroundStyle(c.muted), lineLimit(1), rolls]}>{props.goalText}</Text>
        {props.streak > 1 ? (
          <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle(c.text), lineLimit(1)]}>
            {`${props.streak}-day streak`}
          </Text>
        ) : null}
      </VStack>
      <Spacer />
    </HStack>
  ) : (
    // Small: the ring with the count inside.
    <ZStack>
      {ring(112)}
      <VStack spacing={0}>
        <Text
          modifiers={[
            font({ size: 26, weight: 'bold', design: 'rounded' }),
            foregroundStyle(numberColor),
            monospacedDigit(),
            lineLimit(1),
            minimumScaleFactor(0.5),
            frame({ maxWidth: 90 }),
            rolls,
          ]}>
          {props.stepsText}
        </Text>
        <Text modifiers={[font({ size: 12 }), foregroundStyle(c.muted), lineLimit(1), minimumScaleFactor(0.7), frame({ maxWidth: 86 })]}>
          {props.ofGoal}
        </Text>
      </VStack>
    </ZStack>
  );

  // Content margins are off (app.json) so the glows reach the widget's edges; the content pads itself.
  return (
    <ZStack modifiers={[containerBackground(c.background, 'widget'), url]}>
      {backdrop}
      {content}
    </ZStack>
  );
};

export default createWidget('StepsWidget', StepsWidget);
