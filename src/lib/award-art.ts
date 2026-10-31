// Medals, the trophy and the streak flame, drawn on the icon grid (see src/lib/icon-art.ts) in the
// colours they're given: the podium's medal colours, the streak flame's tiers.

import { arc, circle, n, poly, rect, roundRect, star, type ColorPart } from '@/lib/icon-art';

type MedalColors = { disc: string; rim: string; straps: readonly [string, string] };

/** A medal on its ribbon: two straps meeting behind the disc, a star struck in it and a glint. */
export function medalIcon(c: MedalColors): ColorPart[] {
  return [
    { d: poly(8, 3, 17, 3, 27, 23, 19, 26), color: c.straps[0] },
    { d: poly(40, 3, 31, 3, 21, 23, 29, 26), color: c.straps[1] },
    { d: circle(24, 32, 13), color: c.rim },
    { d: circle(24, 32, 10.2), color: c.disc },
    { d: star(24, 32.6, 6), color: c.rim },
    { d: arc(24, 32, 7.6, 195, 245), stroke: 2, faint: true, color: '#FFFFFF' },
  ];
}

/** A cup on a stem and a stepped base, with a star on the cup. */
export function trophyIcon(c: { disc: string; rim: string }): ColorPart[] {
  return [
    { d: 'M14 11C6 11 6.5 24 17.5 25M34 11C42 11 41.5 24 30.5 25', stroke: 3.4, color: c.rim },
    { d: 'M12 5H36V13.5C36 23 31 29 24 29C17 29 12 23 12 13.5Z', color: c.disc },
    { d: rect(21.5, 28, 5, 6) + roundRect(16, 33, 16, 4.5, 1.5), color: c.rim },
    { d: roundRect(12.5, 37, 23, 7, 2.2), color: c.rim },
    { d: star(24, 15.5, 6), color: c.rim },
    { d: 'M16.5 10V14.5C16.5 18 17.5 20.5 19 22', stroke: 2, faint: true, color: '#FFFFFF' },
  ];
}

/**
 * A teardrop of fire standing on (24, 45): a round base of radius `r`, the tip `h` up and `lean` to
 * the side. The same shape as the streak flame's layers (src/components/streak-flame.tsx), held still.
 */
function flameLayer(r: number, h: number, lean: number): string {
  const [cx, by] = [24, 45];
  const k = (h - r) * 0.35;
  return (
    `M${n(cx - r)} ${n(by - r)}A${n(r)} ${n(r)} 0 0 0 ${n(cx + r)} ${n(by - r)}` +
    `C${n(cx + r)} ${n(by - r - k)} ${n(cx + r * 0.3 + lean * 0.5)} ${n(by - h * 0.7)} ${n(cx + lean)} ${n(by - h)}` +
    `C${n(cx - r * 0.3 + lean * 0.5)} ${n(by - h * 0.7)} ${n(cx - r)} ${n(by - r - k)} ${n(cx - r)} ${n(by - r)}Z`
  );
}

/** The streak flame, still: three layers of fire, outermost first, in the colours given. */
export function flameIcon(outer: string, middle: string, inner: string): ColorPart[] {
  return [
    { d: flameLayer(14.5, 42, 2.5), color: outer },
    { d: flameLayer(10, 30, -1.5), color: middle },
    { d: flameLayer(5.8, 18.5, 1), color: inner },
  ];
}
