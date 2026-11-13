// The step ring as an SVG, in whichever style, colour and thickness the app's ring wears (Settings),
// for the widgets: Android draws it as it is; iOS turns it into a picture. It follows the app's
// Skia rings (src/components/skia-ring.tsx) shape for shape. SVG has no blur or sweep gradient that
// every widget host draws, so glows are stacked soft strokes and gradients are short arcs in turn.

import { CAT_COATS, shade } from '@/components/character/scene-common';
import { THICKNESS_SCALE, type RingSettings } from '@/lib/ring-style';

export type RingColors = { primary: string; over: string; track: string };

/** The app's Home ring is 176 across with a 14 stroke; widget rings keep that proportion. */
const STROKE_SHARE = 14 / 176;

const n = (v: number) => Math.round(v * 100) / 100;

/** A point on the circle about (c, c), `f` of the way round clockwise from twelve o'clock. */
function at(c: number, r: number, f: number): [number, number] {
  const a = -Math.PI / 2 + f * 2 * Math.PI;
  return [c + r * Math.cos(a), c + r * Math.sin(a)];
}

/** An arc from `from` to `to` (shares of a lap, clockwise from twelve); a whole lap is two halves. */
function arc(c: number, r: number, from: number, to: number): string {
  if (to - from >= 0.9999) {
    const [x0, y0] = at(c, r, from);
    const [x1, y1] = at(c, r, from + 0.5);
    return `M${n(x0)} ${n(y0)}A${n(r)} ${n(r)} 0 1 1 ${n(x1)} ${n(y1)}A${n(r)} ${n(r)} 0 1 1 ${n(x0)} ${n(y0)}`;
  }
  const [x0, y0] = at(c, r, from);
  const [x1, y1] = at(c, r, to);
  return `M${n(x0)} ${n(y0)}A${n(r)} ${n(r)} 0 ${to - from > 0.5 ? 1 : 0} 1 ${n(x1)} ${n(y1)}`;
}

type Line = { width: number; cap?: 'round' | 'butt'; dash?: number[]; opacity?: number };

function strokePath(d: string, color: string, { width, cap = 'round', dash, opacity }: Line): string {
  return (
    `<path d="${d}" fill="none" stroke="${color}" stroke-width="${n(width)}" stroke-linecap="${cap}"` +
    (dash ? ` stroke-dasharray="${dash.map(n).join(' ')}"` : '') +
    (opacity !== undefined && opacity < 1 ? ` stroke-opacity="${n(opacity)}"` : '') +
    `/>`
  );
}

/** A soft glow along `d`, like a blurred stroke: wider, fainter strokes stacked under narrower ones. */
function halo(d: string, color: string, width: number, opacity: number, blur: number): string {
  const layers = 9;
  // Where they all overlap, the layers add up to about the blurred stroke's peak.
  const each = 1 - Math.pow(1 - Math.min(0.95, opacity * 0.85), 1 / layers);
  let out = '';
  for (let i = layers; i >= 1; i--) out += strokePath(d, color, { width: width + blur * 2.8 * (i / layers), opacity: each });
  return out;
}

function lerpColor(a: string, b: string, t: number): string {
  const x = parseInt(a.slice(1), 16);
  const y = parseInt(b.slice(1), 16);
  const ch = [16, 8, 0].map((s) => Math.round(((x >> s) & 255) + (((y >> s) & 255) - ((x >> s) & 255)) * t));
  return '#' + ch.map((v) => v.toString(16).padStart(2, '0')).join('');
}

/** The colour `f` of the way round a sweep of evenly spaced `colors`. */
function sweepColor(colors: readonly string[], f: number): string {
  const x = Math.min(0.9999, Math.max(0, f)) * (colors.length - 1);
  const i = Math.floor(x);
  return lerpColor(colors[i], colors[i + 1], x - i);
}

/** An arc 0 → `share` coloured by a sweep round the whole lap, with round ends. */
function sweepArc(c: number, r: number, share: number, width: number, colors: readonly string[]): string {
  if (share <= 0) return '';
  const pieces = Math.max(1, Math.ceil(share * 90));
  let out = '';
  for (let j = 0; j < pieces; j++) {
    const from = (share * j) / pieces;
    const to = Math.min(share, (share * (j + 1)) / pieces + 0.002);
    out += strokePath(arc(c, r, from, to), sweepColor(colors, (from + to) / 2), { width, cap: 'butt' });
  }
  if (share < 0.9999) {
    const [x0, y0] = at(c, r, 0);
    const [x1, y1] = at(c, r, share);
    out += `<circle cx="${n(x0)}" cy="${n(y0)}" r="${n(width / 2)}" fill="${colors[0]}"/>`;
    out += `<circle cx="${n(x1)}" cy="${n(y1)}" r="${n(width / 2)}" fill="${sweepColor(colors, share)}"/>`;
  }
  return out;
}

// Back to red at the end, so a full lap joins up (as the app's Rainbow ring).
const RAINBOW = ['#E53935', '#FB8C00', '#FDD835', '#43A047', '#00ACC1', '#1E88E5', '#8E24AA', '#E53935'];

const LANTERN = { dim: '#1F4A2E', charged: '#2E7D32', bright: '#00E676', core: '#CCFFE0', over: '#B9F6CA' };

const RACE = { asphalt: '#3A3D42', kerbRed: '#E53935', kerbWhite: '#FFFFFF', dark: '#1E1E1E', helmet: '#FDD835' };

type Trail = 'cat' | 'dog' | 'horse' | 'stars' | 'hearts';

/** Print size (× the stroke), spacing (× the print) and in/out stagger (× the print), as the app's. */
const TRAIL_LAYOUT: Record<Trail, { size: number; gap: number; stagger: number }> = {
  cat: { size: 1.05, gap: 1.15, stagger: 0.14 },
  dog: { size: 1.25, gap: 1.15, stagger: 0.14 },
  horse: { size: 1.15, gap: 1.2, stagger: 0.14 },
  stars: { size: 1.1, gap: 1.25, stagger: 0 },
  hearts: { size: 1.05, gap: 1.25, stagger: 0 },
};

/** An ellipse filling the box x, y, w, h (Skia's oval in a rect). */
const oval = (x: number, y: number, w: number, h: number, fill?: string) =>
  `<ellipse cx="${n(x + w / 2)}" cy="${n(y + h / 2)}" rx="${n(w / 2)}" ry="${n(h / 2)}"${fill ? ` fill="${fill}"` : ''}/>`;
const dot = (x: number, y: number, r: number, fill?: string) =>
  `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}"${fill ? ` fill="${fill}"` : ''}/>`;
const box = (x: number, y: number, w: number, h: number, fill?: string) =>
  `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}"${fill ? ` fill="${fill}"` : ''}/>`;

/** One print, centred at the origin and pointing up, `k` wide, in the fill of its group. */
function print(kind: Trail, k: number): string {
  if (kind === 'cat' || kind === 'dog') {
    return (
      oval(-0.42 * k, -0.11 * k, 0.84 * k, 0.72 * k) +
      dot(-0.42 * k, -0.28 * k, 0.16 * k) +
      dot(-0.15 * k, -0.48 * k, 0.17 * k) +
      dot(0.15 * k, -0.48 * k, 0.17 * k) +
      dot(0.42 * k, -0.28 * k, 0.16 * k)
    );
  }
  if (kind === 'horse') {
    // A horseshoe open at the heel: round the outer edge from 125° to 55°, back along the inner one.
    const pt = (cx: number, cy: number, rx: number, ry: number, deg: number) => {
      const a = (deg * Math.PI) / 180;
      return `${n(cx + rx * Math.cos(a))} ${n(cy + ry * Math.sin(a))}`;
    };
    const [ocx, ocy, orx, ory] = [0, -0.02 * k, 0.45 * k, 0.5 * k];
    const [icx, icy, irx, iry] = [0, -0.02 * k, 0.27 * k, 0.32 * k];
    return (
      `<path d="M${pt(ocx, ocy, orx, ory, 125)}A${n(orx)} ${n(ory)} 0 1 1 ${pt(ocx, ocy, orx, ory, 55)}` +
      `L${pt(icx, icy, irx, iry, 55)}A${n(irx)} ${n(iry)} 0 1 0 ${pt(icx, icy, irx, iry, 125)}Z"/>`
    );
  }
  if (kind === 'stars') {
    let d = '';
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = (i % 2 ? 0.24 : 0.56) * k;
      d += `${i ? 'L' : 'M'}${n(r * Math.cos(a))} ${n(r * Math.sin(a))}`;
    }
    return `<path d="${d}Z"/>`;
  }
  const p = (x: number, y: number) => `${n(x * k)} ${n(y * k)}`;
  return (
    `<path d="M${p(0, -0.2)}C${p(0.1, -0.45)} ${p(0.5, -0.45)} ${p(0.5, -0.12)}C${p(0.5, 0.12)} ${p(0.2, 0.28)} ${p(0, 0.45)}` +
    `C${p(-0.2, 0.28)} ${p(-0.5, 0.12)} ${p(-0.5, -0.12)}C${p(-0.5, -0.45)} ${p(-0.1, -0.45)} ${p(0, -0.2)}Z"/>`
  );
}

/** The pet's face at the front of a paw or hoof trail, `h` its head's radius. */
function face(pet: 'cat' | 'dog' | 'horse', h: number, cat: RingSettings['cat']): string {
  if (pet === 'horse') {
    const head = '#9A6235';
    return (
      `<path fill="${head}" d="M${n(-h * 0.62)} ${n(-h * 0.55)}L${n(-h * 0.52)} ${n(-h * 1.28)}L${n(-h * 0.18)} ${n(-h * 0.78)}Z` +
      `M${n(h * 0.62)} ${n(-h * 0.55)}L${n(h * 0.52)} ${n(-h * 1.28)}L${n(h * 0.18)} ${n(-h * 0.78)}Z"/>` +
      oval(-h * 0.7, -h * 0.95, h * 1.4, h * 1.85, head) +
      oval(-h * 0.26, -h * 1.05, h * 0.52, h * 0.45, '#4A2C14') +
      oval(-h * 0.1, -h * 0.55, h * 0.2, h * 0.75, '#FFFFFF') +
      oval(-h * 0.55, h * 0.3, h * 1.1, h * 0.62, '#C9A27A') +
      oval(-h * 0.32, h * 0.5, h * 0.16, h * 0.2, '#222222') +
      oval(h * 0.16, h * 0.5, h * 0.16, h * 0.2, '#222222') +
      dot(-h * 0.42, -h * 0.15, h * 0.12, '#222222') +
      dot(h * 0.42, -h * 0.15, h * 0.12, '#222222')
    );
  }
  const coat = CAT_COATS[cat];
  const colors =
    pet === 'cat'
      ? { head: coat.base, ear: coat.base, nose: '#D98A94', eye: cat === 'blackcat' ? coat.eye : '#222222', stripes: coat.stripes ? coat.dark : null }
      : { head: '#D9A441', ear: '#9C6B22', nose: '#222222', eye: '#222222', stripes: null };
  const ears =
    pet === 'cat'
      ? `<path fill="${colors.ear}" d="M${n(-h * 0.95)} ${n(-h * 0.25)}L${n(-h * 0.7)} ${n(-h * 1.25)}L${n(-h * 0.15)} ${n(-h * 0.8)}Z` +
        `M${n(h * 0.95)} ${n(-h * 0.25)}L${n(h * 0.7)} ${n(-h * 1.25)}L${n(h * 0.15)} ${n(-h * 0.8)}Z"/>`
      : oval(-h * 1.25, -h * 0.75, h * 0.6, h * 1.3, colors.ear) + oval(h * 0.65, -h * 0.75, h * 0.6, h * 1.3, colors.ear);
  const stripes = colors.stripes
    ? [-0.28, 0, 0.28].map((x) => oval(h * (x - 0.06), -h * 0.92, h * 0.12, h * 0.36, colors.stripes!)).join('')
    : '';
  return (
    ears +
    dot(0, 0, h, colors.head) +
    stripes +
    dot(-h * 0.38, -h * 0.12, h * 0.13, colors.eye) +
    dot(h * 0.38, -h * 0.12, h * 0.13, colors.eye) +
    oval(-h * 0.16, h * 0.18, h * 0.32, h * 0.22, colors.nose)
  );
}

/** A trail of prints that fill in with the steps, and for the pets, the pet's face at the front. */
function trailRing(kind: Trail, size: number, stroke: number, p1: number, p2: number, color: string, colors: RingColors, cat: RingSettings['cat']) {
  const layout = TRAIL_LAYOUT[kind];
  const paw = stroke * layout.size;
  const bleed = Math.ceil(paw * 0.4);
  const r = size / 2 - paw * 0.7;
  const c = size / 2;
  const count = Math.max(10, Math.floor((2 * Math.PI * r) / (paw * layout.gap)));
  const shape = print(kind, paw);
  let body = '';
  for (let i = 0; i < count; i++) {
    const a = -Math.PI / 2 + ((i + 0.5) / count) * 2 * Math.PI;
    const rr = r + (i % 2 ? -1 : 1) * paw * layout.stagger;
    const share = (i + 0.5) / count;
    const fill = share <= p2 ? colors.over : share <= p1 ? color : colors.track;
    body += `<g fill="${fill}" transform="translate(${n(c + rr * Math.cos(a))} ${n(c + rr * Math.sin(a))}) rotate(${n(((a + Math.PI / 2) * 180) / Math.PI)})">${shape}</g>`;
  }
  const tip = p2 > 0 ? p2 : p1;
  if ((kind === 'cat' || kind === 'dog' || kind === 'horse') && tip > 0.001) {
    const [x, y] = at(c, r, tip);
    body += `<g transform="translate(${n(x)} ${n(y)})">${face(kind, paw * 0.62, cat)}</g>`;
  }
  return { bleed, body };
}

/** The race track with its car going round, and the racing line behind it. */
function raceRing(size: number, stroke: number, p1: number, p2: number, color: string, colors: RingColors) {
  const track = stroke * 1.6;
  const kerb = track * 0.13;
  const r = (size - track) / 2;
  const c = size / 2;
  const outer = r + track / 2 - kerb / 2;
  const inner = r - track / 2 + kerb / 2;
  const blocks = (radius: number, edge: number) => {
    const lap = 2 * Math.PI * edge;
    const dash = lap / Math.max(8, Math.round(lap / (kerb * 4.4)));
    return strokePath(arc(c, radius, 0, 1), RACE.kerbRed, { width: kerb, cap: 'butt', dash: [dash / 2, dash / 2] });
  };
  let body =
    strokePath(arc(c, r, 0, 1), RACE.asphalt, { width: track, cap: 'butt' }) +
    strokePath(arc(c, outer, 0, 1), RACE.kerbWhite, { width: kerb, cap: 'butt' }) +
    strokePath(arc(c, inner, 0, 1), RACE.kerbWhite, { width: kerb, cap: 'butt' }) +
    blocks(outer, r + track / 2) +
    blocks(inner, r - track / 2);
  // The chequered start line across the track at twelve.
  const rows = 4;
  const q = (track - kerb * 2) / rows;
  const top = c - r - track / 2 + kerb;
  body += box(c - q, top, q * 2, q * rows, RACE.kerbWhite);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < 2; col++) if ((row + col) % 2) body += box(c - q + col * q, top + row * q, q, q, RACE.dark);
  }
  if (p1 > 0) body += strokePath(arc(c, r, 0, p1), color, { width: track * 0.2, opacity: 0.55 });
  if (p2 > 0) body += strokePath(arc(c, r, 0, p2), colors.over, { width: track * 0.2, opacity: 0.7 });
  // The car, a little narrower than the track, facing clockwise at the front of the line.
  const k = track * 0.85;
  const a = -Math.PI / 2 + (p2 > 0 ? p2 : p1) * 2 * Math.PI;
  const body_ =
    `M0 ${n(-0.9 * k)}` +
    [
      [0.07, -0.5], [0.16, -0.1], [0.2, 0.15], [0.14, 0.6], [0.1, 0.84],
      [-0.1, 0.84], [-0.14, 0.6], [-0.2, 0.15], [-0.16, -0.1], [-0.07, -0.5],
    ]
      .map(([x, y]) => `L${n(x * k)} ${n(y * k)}`)
      .join('') +
    'Z';
  body +=
    `<g transform="translate(${n(c + r * Math.cos(a))} ${n(c + r * Math.sin(a))}) rotate(${n(((a + Math.PI) * 180) / Math.PI)})">` +
    `<g fill="${RACE.dark}">` +
    box(-0.37 * k, -0.62 * k, 0.16 * k, 0.26 * k) +
    box(0.21 * k, -0.62 * k, 0.16 * k, 0.26 * k) +
    box(-0.41 * k, 0.38 * k, 0.2 * k, 0.32 * k) +
    box(0.21 * k, 0.38 * k, 0.2 * k, 0.32 * k) +
    box(-0.34 * k, -0.95 * k, 0.68 * k, 0.1 * k) +
    box(-0.32 * k, 0.78 * k, 0.64 * k, 0.14 * k) +
    `</g>` +
    `<path d="${body_}" fill="none" stroke="${RACE.kerbWhite}" stroke-width="${n(0.06 * k)}" stroke-linejoin="round"/>` +
    `<path d="${body_}" fill="${p2 > 0 ? colors.over : color}"/>` +
    box(-0.025 * k, -0.8 * k, 0.05 * k, 1.55 * k, RACE.kerbWhite) +
    dot(0, 0.02 * k, 0.075 * k, RACE.dark) +
    dot(0, 0.02 * k, 0.05 * k, RACE.helmet) +
    `</g>`;
  return { bleed: 0, body };
}

/** The ring of green light that charges up with the steps. Always green, as in the app. */
function lanternRing(size: number, stroke: number, p1: number, p2: number) {
  const bleed = Math.ceil(stroke * 2.6);
  const r = (size - stroke) / 2;
  const c = size / 2;
  const charge = p1 + 0.5 * p2;
  const full = arc(c, r, 0, 1);
  let body =
    halo(full, lerpColor(LANTERN.charged, LANTERN.bright, Math.min(1, charge)), stroke * 1.7, 0.1 + 0.55 * charge, stroke * (0.3 + 0.9 * charge)) +
    strokePath(full, lerpColor(LANTERN.dim, LANTERN.charged, Math.min(1, charge)), { width: stroke, cap: 'butt' });
  if (p1 > 0) body += strokePath(arc(c, r, 0, p1), LANTERN.bright, { width: stroke }) + strokePath(arc(c, r, 0, p1), LANTERN.core, { width: stroke * 0.3 });
  if (p2 > 0) body += strokePath(arc(c, r, 0, p2), LANTERN.over, { width: stroke }) + strokePath(arc(c, r, 0, p2), '#FFFFFF', { width: stroke * 0.3 });
  return { bleed, body };
}

/**
 * The ring for `progress` (a share of the goal; past 1 a second lap in the accent colour) in the
 * app's chosen `look`, `size` across. Rings whose glow or prints spread past the ring line are drawn
 * a little smaller so it all fits.
 */
export function styledRingSvg(progress: number, size: number, look: RingSettings, colors: RingColors): string {
  const p1 = Math.min(Math.max(progress, 0), 1);
  const p2 = Math.min(Math.max(progress - 1, 0), 1);
  const color = look.color ?? colors.primary;
  const base = size * STROKE_SHARE * THICKNESS_SCALE[look.thickness];
  const style = look.style;

  let drawn: { bleed: number; body: string };
  if (style === 'racecar') drawn = raceRing(size, base, p1, p2, color, colors);
  else if (style === 'lantern') drawn = lanternRing(size, base, p1, p2);
  else if (style === 'cat' || style === 'dog' || style === 'horse' || style === 'stars' || style === 'hearts')
    drawn = trailRing(style, size, base, p1, p2, color, colors, look.cat);
  else {
    const width = style === 'thin' ? Math.max((3 * size) / 176, base * 0.4) : style === 'dots' ? base * 0.8 : base;
    const r = (size - width) / 2;
    const c = size / 2;
    const lap = 2 * Math.PI * r;
    const dash = style === 'segments' ? [lap / 30 - width * 0.45, width * 0.45] : style === 'dots' ? [0.01, lap / 40] : undefined;
    const cap = style === 'segments' ? 'butt' : 'round';
    const line = { width, cap, dash } as const;
    let body = strokePath(arc(c, r, 0, 1), colors.track, line);
    if (style === 'glow' && p1 > 0) body += halo(arc(c, r, 0, p1), color, width * 1.6, 0.55, width * 0.7);
    if (p1 > 0) {
      if (style === 'gradient') body += sweepArc(c, r, p1, width, [shade(color, -0.35), color, shade(color, 0.45), colors.over]);
      else if (style === 'rainbow') body += sweepArc(c, r, p1, width, RAINBOW);
      else body += strokePath(arc(c, r, 0, p1), color, line);
    }
    if (p2 > 0) body += strokePath(arc(c, r, 0, p2), colors.over, line);
    drawn = { bleed: style === 'glow' ? Math.ceil(width * 2.4) : 0, body };
  }

  const b = drawn.bleed;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${n(size)}" height="${n(size)}" viewBox="${n(-b)} ${n(-b)} ${n(size + b * 2)} ${n(size + b * 2)}">` +
    drawn.body +
    `</svg>`
  );
}
