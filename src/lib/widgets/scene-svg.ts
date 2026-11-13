// A pet's world (src/lib/world) as one still SVG, for widgets: Android draws the SVG itself, iOS gets
// a PNG of it. Moving things sit where they rest on the Pet tab with motion turned off.

import { WORLD_HEIGHT, WORLD_WIDTH, type Layer, type WorldArt } from '@/lib/world';
import { heart } from '@/lib/world/common';

/** A part of the scene, in scene units: [x, y, width, height]. */
export type Crop = readonly [number, number, number, number];

/** How tall a squarish crop is: a little in from the full height, so the pet reads bigger. */
const CLOSE_HEIGHT = 210;

/**
 * The part of the scene to show at `aspect` (width / height), always down to the ground: the full
 * width for a wide widget, otherwise a closer view centred on the pet. There's sky left at the top
 * for the name tag.
 */
export function cropAround(art: WorldArt, aspect: number): Crop {
  const wide = Math.round(WORLD_WIDTH / aspect);
  if (wide <= CLOSE_HEIGHT) return [0, WORLD_HEIGHT - wide, WORLD_WIDTH, wide];
  const height = CLOSE_HEIGHT;
  const width = Math.min(WORLD_WIDTH, Math.round(height * aspect));
  const box = art.pet?.box;
  const centre = box ? box[0] + box[2] / 2 : WORLD_WIDTH / 2;
  const x = Math.min(Math.max(0, Math.round(centre - width / 2)), WORLD_WIDTH - width);
  return [x, WORLD_HEIGHT - height, width, height];
}

/** How a moving layer sits at rest, as the Pet tab shows it with motion off. */
function rest(layer: Layer): { transform?: string; opacity?: number } {
  const m = layer.motion;
  if (!m) return {};
  switch (m.type) {
    case 'cross':
      return { transform: `translate(${(m.phase ?? 0) * m.dx} 0)` };
    case 'rise': {
      const v = m.phase ?? 0;
      return {
        transform: `translate(0 ${-v * m.dy})`,
        opacity: v < 0.12 ? v / 0.12 : v > 0.66 ? (1 - v) / 0.34 : 1,
      };
    }
    case 'twinkle':
      return { opacity: (m.min + 1) / 2 };
    default:
      return {};
  }
}

const attr = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** A point in the scene as shares of `crop` (0–1 across and down). */
export function inCrop(crop: Crop, x: number, y: number): { x: number; y: number } {
  return { x: (x - crop[0]) / crop[2], y: (y - crop[1]) / crop[3] };
}

/**
 * Where the pet is in `crop`, as shares: the box to tap (a little bigger than the pet, so it's easy
 * to hit) and the top of its head, for its speech bubble.
 */
export function petSpot(art: WorldArt, crop: Crop): { box: { x: number; y: number; w: number; h: number }; head: { x: number; y: number } } | null {
  if (!art.pet) return null;
  const [x, y, w, h] = art.pet.box;
  const pad = Math.max(w, h) * 0.2;
  const from = inCrop(crop, x - pad, y - pad);
  const to = inCrop(crop, x + w + pad, y + h + pad);
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  const box = { x: clamp(from.x), y: clamp(from.y), w: clamp(to.x) - clamp(from.x), h: clamp(to.y) - clamp(from.y) };
  return { box, head: inCrop(crop, art.pet.head[0], art.pet.head[1]) };
}

/**
 * The scene as an SVG document showing `crop`, `width` × `height` pixels when drawn. `happy` draws
 * the pet enjoying itself, as when you play with it on the Pet tab: its happy face and two hearts.
 */
export function sceneSvg(art: WorldArt, crop: Crop, width: number, height: number, happy = false): string {
  const defs: string[] = [
    `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${attr(art.sky[0])}"/><stop offset="1" stop-color="${attr(art.sky[1])}"/></linearGradient>`,
  ];
  const body: string[] = [`<rect x="0" y="0" width="${WORLD_WIDTH}" height="${WORLD_HEIGHT}" fill="url(#sky)"/>`];
  art.layers.forEach((layer, i) => {
    const { transform, opacity } = rest(layer);
    if (opacity !== undefined && opacity <= 0) return;
    const shapes = happy && layer.happy?.length ? [...layer.shapes, ...layer.happy] : layer.shapes;
    const paths = shapes
      .map(
        (s) =>
          `<path d="${attr(s.d)}" fill="${attr(s.fill)}"${s.opacity !== undefined && s.opacity < 1 ? ` opacity="${s.opacity}"` : ''}/>`
      )
      .join('');
    let group = `<g${transform ? ` transform="${transform}"` : ''}${opacity !== undefined && opacity < 1 ? ` opacity="${opacity.toFixed(3)}"` : ''}>${paths}</g>`;
    // The clip stays put while the layer moves inside it (fish in their tank).
    if (layer.clip) {
      const [x, y, w, h] = layer.clip;
      defs.push(`<clipPath id="c${i}"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath>`);
      group = `<g clip-path="url(#c${i})">${group}</g>`;
    }
    body.push(group);
  });
  if (happy && art.pet) {
    const [hx, hy] = art.pet.head;
    body.push(`<path d="${heart(hx - 14, hy - 12, 6)}" fill="#FF6B8A"/>`, `<path d="${heart(hx + 12, hy - 20, 4.5)}" fill="#FF8FA3" opacity="0.9"/>`);
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${crop.join(' ')}" preserveAspectRatio="xMidYMid slice">` +
    `<defs>${defs.join('')}</defs>${body.join('')}</svg>`
  );
}

/**
 * The step ring as an SVG, matching the Today ring: the goal's share in `primary`, and past the goal
 * a full ring with the extra lap over it in `over`. `size` is the drawn width in pixels.
 */
export function ringSvg(progress: number, size: number, colors: { primary: string; over: string; track: string }, stroke = 0.1): string {
  const width = size * stroke;
  const r = (size - width) / 2;
  const c = size / 2;
  const lap = 2 * Math.PI * r;
  const arc = (share: number, color: string) => {
    // Round caps add half a stroke at each end; take them back off (and start half a stroke in) so
    // the arc runs from twelve o'clock to exactly its share.
    const length = Math.max(0.001, Math.min(1, share) * lap - width);
    return share <= 0
      ? ''
      : `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-dasharray="${length} ${lap}" stroke-dashoffset="${-width / 2}" transform="rotate(-90 ${c} ${c})"/>`;
  };
  const first = progress >= 1 ? `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${colors.primary}" stroke-width="${width}"/>` : arc(progress, colors.primary);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${colors.track}" stroke-width="${width}"/>` +
    first +
    (progress > 1 ? arc(progress - 1, colors.over) : '') +
    `</svg>`
  );
}

/**
 * The app's screen background as an SVG, `width` × `height`: the theme's background colour with its
 * three glows. Each glow reaches a share of the distance to its farthest corner, as CSS's
 * `radial-gradient(circle at …)` does on the app's screens.
 */
export function backgroundSvg(background: string, glows: readonly { color: string; alpha: number; x: number; y: number; reach: number }[], width: number, height: number): string {
  const defs: string[] = [];
  const fills: string[] = [];
  glows.forEach((g, i) => {
    const cx = g.x * width;
    const cy = g.y * height;
    const r = g.reach * Math.hypot(Math.max(cx, width - cx), Math.max(cy, height - cy));
    defs.push(
      `<radialGradient id="g${i}" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${cy}" r="${r}"><stop offset="0" stop-color="${g.color}" stop-opacity="${g.alpha}"/><stop offset="1" stop-color="${g.color}" stop-opacity="0"/></radialGradient>`
    );
    fills.push(`<rect width="${width}" height="${height}" fill="url(#g${i})"/>`);
  });
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">` +
    `<defs>${defs.join('')}</defs><rect width="${width}" height="${height}" fill="${background}"/>${fills.join('')}</svg>`
  );
}
