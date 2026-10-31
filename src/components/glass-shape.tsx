import { useId, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { glassTokens, useAppTheme } from '@/theme';

/** A few of Material 3 Expressive's shapes: scalloped, lobed and starry rounds. */
export type ExpressiveShape = 'cookie' | 'clover' | 'flower' | 'puffy' | 'sunny' | 'burst';

export const EXPRESSIVE_SHAPES: ExpressiveShape[] = ['cookie', 'clover', 'flower', 'puffy', 'sunny', 'burst'];

/**
 * Each is a circle whose edge ripples: `lobes` bumps, `depth` deep (as a share of the radius). `point`
 * below 1 sharpens the bumps into soft points, for the sunny and burst shapes.
 */
const WAVES: Record<ExpressiveShape, { lobes: number; depth: number; point?: number }> = {
  cookie: { lobes: 9, depth: 0.06 },
  clover: { lobes: 4, depth: 0.16 },
  flower: { lobes: 8, depth: 0.1 },
  puffy: { lobes: 6, depth: 0.08 },
  sunny: { lobes: 8, depth: 0.07, point: 0.55 },
  burst: { lobes: 12, depth: 0.08, point: 0.6 },
};

const STEPS = 144;

/** Outlines already worked out: there are only a few shapes and sizes, and a screen can show dozens. */
const outlines = new Map<string, string>();

/** The shape's outline, `size` across, inset by `inset` all round (so a stroke stays inside the box). */
function shapePath(shape: ExpressiveShape, size: number, inset = 0): string {
  const key = `${shape}:${size}:${inset}`;
  const known = outlines.get(key);
  if (known) return known;
  const { lobes, depth, point = 1 } = WAVES[shape];
  const c = size / 2;
  const outer = c - inset;
  let d = '';
  for (let i = 0; i < STEPS; i++) {
    const a = (i / STEPS) * Math.PI * 2;
    const wave = Math.cos(lobes * a);
    const shaped = Math.sign(wave) * Math.pow(Math.abs(wave), point);
    // From the top, clockwise, with a bump at the top.
    const r = outer * (1 - depth + depth * shaped);
    const x = c + r * Math.sin(a);
    const y = c - r * Math.cos(a);
    d += `${i ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  outlines.set(key, `${d}Z`);
  return `${d}Z`;
}

/**
 * Frosted glass cut into an expressive shape, with something (a flag, an emoji) in the middle: the
 * app's glass (the tab bar's even frost and hairline rim) for icons that aren't rectangles.
 * Give it a `tint` and that colour shows through the frost, like coloured glass.
 */
export function GlassShape({
  shape,
  size,
  tint,
  ring,
  wash,
  dim,
  children,
  style,
}: {
  shape: ExpressiveShape;
  size: number;
  /** Colours seen through the glass, top to bottom (a fantasy land's sky). */
  tint?: readonly [string, string];
  /** A coloured rim instead of the glass one, e.g. for a stamp that's been inked. */
  ring?: string;
  /** A faint wash of colour over the glass, e.g. for a finished stamp. */
  wash?: string;
  /** Fainter all round, for something not reached yet. */
  dim?: boolean;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useAppTheme();
  const g = glassTokens(theme);
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const rim = ring ? 2 : tint ? 1.2 : 1;
  const outline = shapePath(shape, size);

  return (
    <View style={[{ width: size, height: size }, styles.box, style]}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          {tint ? (
            <LinearGradient id={`tint${id}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={tint[0]} />
              <Stop offset="1" stopColor={tint[1]} />
            </LinearGradient>
          ) : null}
        </Defs>
        {/* A tight shadow under the edge, offset a touch, like the app's small glass panes. */}
        <Path d={outline} fill="#000000" opacity={theme.dark ? 0.22 : 0.06} transform="translate(0 1.2)" />
        {tint ? <Path d={outline} fill={`url(#tint${id})`} opacity={dim ? 0.35 : 0.9} /> : null}
        {/* The frost: milky over clear glass, a lighter veil over tinted glass so its colour shows. */}
        <Path d={outline} fill={tint ? 'rgba(255, 255, 255, 0.22)' : g.fill} />
        {wash ? <Path d={outline} fill={wash} opacity={0.16} /> : null}
        <Path
          d={shapePath(shape, size, rim / 2)}
          fill="none"
          stroke={ring ?? (tint ? 'rgba(255, 255, 255, 0.4)' : g.border)}
          strokeWidth={rim}
        />
      </Svg>
      <View style={[styles.content, dim && styles.dim]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
  content: { alignItems: 'center', justifyContent: 'center' },
  dim: { opacity: 0.35 },
});
