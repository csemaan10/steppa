import Svg, { Path } from 'react-native-svg';

import type { ColorPart, IconPart } from '@/lib/icon-art';

/** One of the app's drawn icons (src/lib/icon-art.ts) in a single colour, `size` across. */
export function Glyph({ parts, size = 24, color }: { parts: readonly IconPart[]; size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <GlyphPaths parts={parts} color={color} />
    </Svg>
  );
}

/** A drawn icon in its own colours (flags, medals), `size` across. */
export function ColorGlyph({ parts, size = 24 }: { parts: readonly ColorPart[]; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <ColorPaths parts={parts} />
    </Svg>
  );
}

/** A coloured icon's shapes, for drawing inside another picture. */
export function ColorPaths({ parts }: { parts: readonly ColorPart[] }) {
  return parts.map((part, i) => <GlyphPath key={i} part={part} color={part.color} />);
}

/** An icon's shapes in one colour, for drawing inside another picture. */
export function GlyphPaths({ parts, color }: { parts: readonly IconPart[]; color: string }) {
  return parts.map((part, i) => <GlyphPath key={i} part={part} color={color} />);
}

function GlyphPath({ part, color }: { part: IconPart; color: string }) {
  const opacity = part.faint ? 0.45 : 1;
  return part.stroke ? (
    <Path
      d={part.d}
      fill="none"
      stroke={color}
      strokeWidth={part.stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={opacity}
    />
  ) : (
    <Path d={part.d} fill={color} fillRule={part.holes ? 'evenodd' : 'nonzero'} opacity={opacity} />
  );
}
