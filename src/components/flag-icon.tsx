import { useId } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from 'react-native-paper';
import Svg, { ClipPath, Defs, G, LinearGradient, Path, Stop } from 'react-native-svg';

import { ColorPaths, GlyphPaths } from '@/components/glyph';
import { COUNTRY_FLAGS, FLAG, FLAG_OUTLINE, LAND_SKIES } from '@/lib/flag-art';
import { roundRect } from '@/lib/icon-art';
import { SKIES } from '@/lib/journeys';
import { placeIconFor } from '@/lib/place-icons';

const RIM = roundRect(FLAG.x + 0.5, FLAG.y + 0.5, FLAG.w - 1, FLAG.h - 1, FLAG.r - 0.5);

/**
 * A country's flag (src/lib/flag-art.ts), or a fantasy land's: its sky with its emblem in white.
 * `size` is the square it sits in; the flag is 7/8 of that wide. Falls back to the emoji.
 */
export function FlagIcon({ flag, size = 24 }: { flag: string; size?: number }) {
  const theme = useTheme();
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const country = COUNTRY_FLAGS[flag];
  const sky = LAND_SKIES[flag];
  const emblem = sky ? placeIconFor(flag) : undefined;

  if (!country && !(sky && emblem)) {
    return (
      <View style={[styles.box, { width: size, height: size }]}>
        <Text style={{ fontSize: size * 0.72, lineHeight: size }}>{flag}</Text>
      </View>
    );
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Defs>
        <ClipPath id={`flag${id}`}>
          <Path d={FLAG_OUTLINE} />
        </ClipPath>
        {sky ? (
          <LinearGradient id={`sky${id}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={SKIES[sky][0]} />
            <Stop offset="1" stopColor={SKIES[sky][1]} />
          </LinearGradient>
        ) : null}
      </Defs>
      <G clipPath={`url(#flag${id})`}>
        {country ? (
          <ColorPaths parts={country} />
        ) : (
          <>
            <Path d={FLAG_OUTLINE} fill={`url(#sky${id})`} />
            {/* The emblem at half size, in the middle of the flag. */}
            <G transform="translate(12 12) scale(0.5)">
              <GlyphPaths parts={emblem!} color="#FFFFFF" />
            </G>
          </>
        )}
      </G>
      {/* A faint edge, so a white flag still has one on white glass. */}
      <Path d={RIM} fill="none" stroke={theme.dark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.12)'} strokeWidth={1} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
});
