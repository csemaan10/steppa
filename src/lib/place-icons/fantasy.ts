// Icons for the places in the pet's fantasy lands (src/lib/fantasy-lands.ts), and the lands' own emblems.

import { at, circle, ellipse, line, n, poly, roundRect, star, type IconPart } from '@/lib/icon-art';

/** A flat list of points (x, y, x, y…) turned `deg` clockwise about (cx, cy). */
function turn(deg: number, cx: number, cy: number, ...pts: number[]): number[] {
  const a = (deg * Math.PI) / 180;
  const out: number[] = [];
  for (let i = 0; i < pts.length; i += 2) {
    const [x, y] = [pts[i]! - cx, pts[i + 1]! - cy];
    out.push(cx + x * Math.cos(a) - y * Math.sin(a), cy + x * Math.sin(a) + y * Math.cos(a));
  }
  return out;
}

/** A closed shape of cubic curves: a start point, then three points (two handles and an end) per curve. */
function curves(...pts: number[]): string {
  let d = `M${n(pts[0]!)} ${n(pts[1]!)}`;
  for (let i = 2; i < pts.length; i += 6) d += `C${pts.slice(i, i + 6).map(n).join(' ')}`;
  return `${d}Z`;
}

/** An ellipse turned `deg` clockwise. */
function oval(cx: number, cy: number, rx: number, ry: number, deg: number): string {
  const [x0, y0, x1, y1] = turn(deg, cx, cy, cx - rx, cy, cx + rx, cy) as [number, number, number, number];
  const a = `A${n(rx)} ${n(ry)} ${n(deg)} 1 0`;
  return `M${n(x0)} ${n(y0)}${a} ${n(x1)} ${n(y1)}${a} ${n(x0)} ${n(y0)}Z`;
}

/** A strip `w` wide following a circle (or a spiral, if r0 and r1 differ) from `from` to `to` degrees. */
function swirl(cx: number, cy: number, r0: number, r1: number, from: number, to: number, w: number): string {
  const steps = Math.ceil(Math.abs(to - from) / 8);
  const out: number[] = [];
  const back: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const r = r0 + (r1 - r0) * t;
    out.push(...at(cx, cy, r + w / 2, from + (to - from) * t));
    back.unshift(...at(cx, cy, r - w / 2, from + (to - from) * t));
  }
  return poly(...out, ...back);
}

/** A leaf from (x1, y1) to (x2, y2), about `w` wide, bowed `bend` to its left. */
function leaf(x1: number, y1: number, x2: number, y2: number, w: number, bend = 0): string {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const [nx, ny] = [(y2 - y1) / len, -(x2 - x1) / len];
  const [mx, my] = [(x1 + x2) / 2 + nx * bend, (y1 + y2) / 2 + ny * bend];
  return (
    `M${n(x1)} ${n(y1)}Q${n(mx + nx * w)} ${n(my + ny * w)} ${n(x2)} ${n(y2)}` +
    `Q${n(mx - nx * w)} ${n(my - ny * w)} ${n(x1)} ${n(y1)}Z`
  );
}

/** A convex shape pulled in by `g` all round, so cut facets drawn side by side have a gap between them. */
function facet(g: number, ...pts: number[]): string {
  const p: [number, number][] = [];
  for (let i = 0; i < pts.length; i += 2) p.push([pts[i]!, pts[i + 1]!]);
  const [mx, my] = [p.reduce((s, q) => s + q[0], 0) / p.length, p.reduce((s, q) => s + q[1], 0) / p.length];
  // Each side, moved inward: a point on it and its direction.
  const sides = p.map(([x, y], i) => {
    const [x2, y2] = p[(i + 1) % p.length]!;
    const len = Math.hypot(x2 - x, y2 - y);
    let [nx, ny] = [-(y2 - y) / len, (x2 - x) / len];
    if (nx * (mx - x) + ny * (my - y) < 0) [nx, ny] = [-nx, -ny];
    return [x + nx * g, y + ny * g, x2 - x, y2 - y] as const;
  });
  // Each corner is where its two moved sides meet.
  const out = sides.flatMap(([bx, by, ex, ey], i) => {
    const [ax, ay, dx, dy] = sides[(i + sides.length - 1) % sides.length]!;
    const t = ((bx - ax) * ey - (by - ay) * ex) / (dx * ey - dy * ex);
    return [ax + dx * t, ay + dy * t];
  });
  return poly(...out);
}

/** A ringed planet tipped `tilt` degrees: the ball is cut where the ring passes in front of it. */
function planet(tilt: number): IconPart[] {
  const [cx, cy, r, rx, ry, w, gap] = [24, 24, 11.5, 20, 5, 3, 1.5];
  const h = w / 2 + gap;
  // How far below the middle the ring (an ellipse rx by ry) runs at x.
  const under = (a: number, b: number, x: number) => (Math.abs(x) >= a ? 0 : b * Math.sqrt(1 - (x / a) ** 2));
  const top: number[] = [];
  const upper: number[] = [];
  const capTop: number[] = [];
  const capBottom: number[] = [];
  for (let i = 0; i <= 40; i++) {
    const x = -r + (2 * r * i) / 40;
    const edge = Math.sqrt(Math.max(0, r * r - x * x));
    top.push(x, -edge);
    upper.unshift(x, Math.min(edge, under(rx - h, ry - h, x)));
    const below = under(rx + h, ry + h, x);
    if (edge > below) {
      capTop.push(x, below);
      capBottom.unshift(x, edge);
    }
  }
  const ring: number[] = [];
  for (let a = 0; a < 360; a += 8) ring.push(Math.cos((a * Math.PI) / 180) * rx, Math.sin((a * Math.PI) / 180) * ry);
  const place = (pts: number[]) => poly(...turn(tilt, cx, cy, ...pts.map((v, i) => v + (i % 2 ? cy : cx))));
  return [{ d: place([...top, ...upper]) }, { d: place([...capTop, ...capBottom]) }, { d: place(ring), stroke: w }];
}

export const FANTASY_ICONS: Record<string, IconPart[]> = {
  // A wrapped sweet, its wrapper twisted shut at both ends.
  '🍬': (() => {
    // Drawn lying flat, then tipped up to the right; `x` flips the left end round to the right.
    const tip = (...pts: number[]) => turn(-30, 24, 24, ...pts);
    const end = (x: (v: number) => number) => {
      const [a, b, c, d] = tip(x(11.5), 23, x(5), 17.5);
      const [e, f, g, h] = tip(x(11.5), 25, x(5), 30.5);
      return (
        curves(
          ...tip(x(13.5), 22.5, x(10.2), 19.3, x(6.8), 16.2, x(3.5), 13),
          ...tip(x(1.5), 20, x(1.5), 28, x(3.5), 35),
          ...tip(x(6.8), 31.8, x(10.2), 28.7, x(13.5), 25.5)
        ) +
        leaf(a!, b!, c!, d!, 1.8) +
        leaf(e!, f!, g!, h!, 1.8)
      );
    };
    return [
      { d: oval(24, 24, 11, 9.5, -30) + swirl(24, 24, 6, 6, 185, 240, 2.4), holes: true },
      { d: end((v) => v) + end((v) => 48 - v), holes: true },
    ];
  })(),
  // A lollipop with a swirl, on its stick.
  '🍭': [
    { d: line(24, 28, 24, 45), stroke: 3.4 },
    { d: circle(24, 17, 13.5) + swirl(24, 17, 1.8, 10.2, -90, 450, 2.6), holes: true },
  ],
  // A bar of chocolate, its wrapper torn back to show the squares.
  '🍫': (() => {
    const tip = (...pts: number[]) => poly(...turn(20, 24, 25, ...pts));
    const square = (x: number, y: number) => tip(x, y, x + 10.5, y, x + 10.5, y + 7.5, x, y + 7.5);
    return [
      { d: square(12.5, 7) + square(25, 7) + square(12.5, 16.5) + square(25, 16.5) },
      { d: tip(11, 43, 11, 28, 14.3, 26, 17.5, 29.5, 20.8, 26, 24, 29.5, 27.3, 26, 30.5, 29.5, 33.8, 26, 37, 28, 37, 43) },
    ];
  })(),
  // A cupcake: a pleated case, swirled icing and a cherry on top.
  '🧁': [
    {
      d:
        poly(10, 30, 38, 30, 34, 44, 14, 44) +
        poly(16.2, 32.5, 18, 32.5, 19.6, 41.5, 18.2, 41.5) +
        poly(23.1, 32.5, 24.9, 32.5, 24.7, 41.5, 23.3, 41.5) +
        poly(30, 32.5, 31.8, 32.5, 29.8, 41.5, 28.4, 41.5),
      holes: true,
    },
    { d: ellipse(24, 24.5, 15.5, 4) + ellipse(24, 19, 11.5, 4) + ellipse(24, 14, 7, 3.5) },
    { d: circle(24, 6.5, 3.4) },
  ],
  // A cut gem, its facets catching the light.
  '💎': [
    { d: facet(0.9, 13, 8, 35, 8, 30, 19, 18, 19) + facet(0.9, 18, 19, 30, 19, 24, 42) },
    { d: facet(0.9, 13, 8, 18, 19, 4, 19) + facet(0.9, 4, 19, 18, 19, 24, 42) },
    { d: facet(0.9, 35, 8, 44, 19, 30, 19) + facet(0.9, 30, 19, 44, 19, 24, 42), faint: true },
  ],
  // A wizard's pointed hat, its tip flopped over, with stars on it.
  '🧙': [
    { d: ellipse(24, 40, 20, 4.5) },
    {
      d:
        'M11 35C15 27 19 17 22 10C24 5 29 2.5 35 4C31 5.5 28.5 8 28 12C30 20 33 28 37 35Q24 31 11 35Z' +
        star(22.5, 26, 4.8) +
        star(25.5, 15.5, 3),
      holes: true,
    },
  ],
  // An island with a palm tree, floating in the sky.
  '🏝️': [
    { d: 'M4 28C12 25.5 36 25.5 44 28C41 32 36 33.5 32 36.5C29 39 27 43 24 45C21.5 42 19 39 15.5 37C10.5 34.5 6.5 32 4 28Z' },
    { d: 'M21 28C21 21 23 16 27 12', stroke: 3.2 },
    { d: leaf(27, 12, 41, 16, 5, 3) + leaf(27, 12, 39, 5, 5, 1.5) + leaf(27, 12, 13, 14, 5, -3) + leaf(27, 12, 17, 4.5, 5, -1.5) },
  ],
  // A branching coral on the seabed.
  '🪸': [
    { d: ellipse(24, 43.5, 10, 2.5) },
    { d: line(24, 43, 24, 30), stroke: 4.6 },
    {
      d:
        'M24 33C19 31 15.5 27 15 21C14.8 17.5 13.5 14 11 11' +
        'M24 31C29 29 32.5 25 33 19C33.2 15.5 34.5 12.5 37 10' +
        'M24 31C24 25 24.5 19 23.5 13C23.2 11 23.2 9 23.5 7' +
        'M15.2 23.5C11.5 23 8.5 21 7 17.5' +
        'M32.8 21.5C36.5 21 39.5 19 41 15.5' +
        'M23.9 22C27 20.5 28.5 18 28.7 14.5' +
        'M20 31.5C16 33 11.5 32.5 8.5 29.5',
      stroke: 3.4,
    },
    { d: [[11, 11], [37, 10], [23.5, 7], [7, 17.5], [41, 15.5], [28.7, 14.5], [8.5, 29.5]].map(([x, y]) => circle(x!, y!, 2.5)).join('') },
  ],
  // A tent, its door open, its poles crossed at the top.
  '🏕️': [
    { d: line(3, 42.5, 45, 42.5), stroke: 2.2, faint: true },
    { d: poly(24, 8, 43, 40, 29.5, 40, 24, 27, 18.5, 40, 5, 40) },
    { d: line(24, 9, 20, 3.5) + line(24, 9, 28, 3.5), stroke: 2.6 },
  ],
  // A rocket heading up and away, with a porthole and a flame.
  '🚀': (() => {
    const up = (...pts: number[]) => turn(45, 24, 24.5, ...pts);
    return [
      {
        d:
          curves(
            ...up(24, 3, 30, 8, 31.5, 14, 31.5, 20, 31.5, 25, 31.5, 29, 31.5, 33),
            ...up(26.5, 33, 21.5, 33, 16.5, 33, 16.5, 29, 16.5, 25, 16.5, 20, 16.5, 14, 18, 8, 24, 3)
          ) +
          circle(...(up(24, 18) as [number, number]), 3.6),
        holes: true,
      },
      { d: poly(...up(16.5, 23, 10, 31, 10, 38, 16.5, 34)) + poly(...up(31.5, 23, 38, 31, 38, 38, 31.5, 34)) },
      { d: curves(...up(19.5, 35, 19.5, 39, 22, 42.5, 24, 46, 26, 42.5, 28.5, 39, 28.5, 35)) },
    ];
  })(),
  // A planet with a ring round it.
  '🪐': planet(-20),
  // A crystal ball with a shine on it, in its stand.
  '🔮': [
    { d: circle(24, 19, 14.5) + swirl(24, 19, 9.5, 9.5, 200, 250, 2.6) + circle(...at(24, 19, 9.5, 268), 1.5), holes: true },
    { d: 'M14.8 32.1A16 16 0 0 0 33.2 32.1C33.5 37 36 40 40 41V43C40 44 39 44.5 38 44.5H10C9 44.5 8 44 8 43V41C12 40 14.5 37 14.8 32.1Z' },
  ],
  // A spotted toadstool.
  '🍄': [
    {
      d:
        'M4.5 26C4.5 13 13.5 5 24 5C34.5 5 43.5 13 43.5 26C43.5 28.5 42 29.5 39.5 29.5H8.5C6 29.5 4.5 28.5 4.5 26Z' +
        circle(15, 16, 3.4) +
        circle(27, 11, 2.8) +
        circle(34.5, 19.5, 3.2) +
        circle(23.5, 22, 2.6) +
        circle(9.5, 24, 1.8),
      holes: true,
    },
    { d: 'M17.5 31H30.5C31 36 32 40.5 33 44H15C16 40.5 17 36 17.5 31Z' },
  ],
  // A fairy with see-through wings, holding up her wand, and a sparkle or two.
  '🧚': [
    {
      d:
        'M22 21C17 13 9 6 5 9C2 12 6 20 22 23Z' +
        'M26 21C31 13 39 6 43 9C46 12 42 20 26 23Z' +
        'M22 24C14 25 8 29 9 33C10 36.5 17 33 22.5 26Z' +
        'M26 24C34 25 40 29 39 33C38 36.5 31 33 25.5 26Z',
      faint: true,
    },
    { d: circle(24, 10.5, 4.6) },
    { d: 'M24 16C27 16 28 18.5 28.5 21.5L32.5 38C33 40 32 41.5 30 41.5H18C16 41.5 15 40 15.5 38L19.5 21.5C20 18.5 21 16 24 16Z' },
    { d: line(27.5, 20.5, 34, 14), stroke: 2.6 },
    { d: star(36.5, 11, 4.6) },
    { d: star(9, 40.5, 3.2, 4, 0.35) + star(40, 39, 2.6, 4, 0.35) },
  ],
  // A wishing well: a little roof, a bucket on a rope and a stone wall.
  '🪙': [
    { d: poly(4, 17, 24, 5, 44, 17) },
    { d: line(10, 17, 10, 30) + line(38, 17, 38, 30), stroke: 3.2 },
    { d: line(10, 19.5, 38, 19.5) + line(24, 19.5, 24, 23), stroke: 2.2 },
    { d: poly(19.5, 23, 28.5, 23, 27.5, 29, 20.5, 29) },
    { d: roundRect(5, 30, 38, 4, 2) },
    {
      d:
        roundRect(7, 35.5, 10, 3.8, 1) +
        roundRect(18.5, 35.5, 11, 3.8, 1) +
        roundRect(31, 35.5, 10, 3.8, 1) +
        roundRect(7, 40.5, 5, 3.8, 1) +
        roundRect(13.5, 40.5, 11, 3.8, 1) +
        roundRect(26, 40.5, 15, 3.8, 1),
    },
  ],
  // A unicorn's head side on, with its horn and a flowing mane.
  '🦄': [
    { d: leaf(29, 12, 38, 17, 6, 1) + leaf(31, 18, 41, 25, 6, 1) + leaf(32.5, 25, 43, 33, 6, 1) + leaf(33.5, 32, 43, 41, 6, 1) },
    { d: poly(24, 12.5, 27.5, 3.5, 30, 13) },
    { d: poly(18.5, 13, 13, 2, 23, 11.5) },
    {
      d:
        'M33 44C33 34 33 24 30 15C28.5 11.5 24 10.5 20 12C15 14 10 19 6.5 24C4.5 27 5.5 31 9 31.5C12 32 15 31 17.5 31.5C20 32 21 35 20 44Z' +
        circle(16, 19, 1.8),
      holes: true,
    },
  ],
  // A fluffy cloud.
  '☁️': [
    { d: circle(13.5, 28, 9) + circle(25, 19.5, 12) + circle(36, 26, 8.5) },
    { d: roundRect(4, 25, 40, 13, 6.5) },
  ],
  // A mermaid's tail rising out of the waves.
  '🧜': [
    { d: 'M9 44.5Q14 41.5 19 44.5T29 44.5T39 44.5', stroke: 2.6, faint: true },
    { d: 'M4 39Q9 36 14 39T24 39T34 39T44 39', stroke: 3 },
    {
      d:
        'M14.5 37C15 30 19 26 23 22C25 20 25.5 18.5 25.5 17H29.5C30 19.5 29.5 22.5 28.5 25.5C27.5 29 28.5 33 30.5 37Z' +
        swirl(19.8, 34, 2.3, 2.3, 200, 340, 1.5) +
        swirl(25.2, 34, 2.3, 2.3, 200, 340, 1.5) +
        swirl(23.2, 29, 2.3, 2.3, 200, 340, 1.5),
      holes: true,
    },
    { d: 'M27.5 19C22 18 12.5 14.5 7.5 5C15 5.5 22 8 27.5 13C33 8 40 5.5 45 5.5C40.5 14.5 33 18 27.5 19Z' },
  ],
};
