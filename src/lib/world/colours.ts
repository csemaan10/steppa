// Colours to wear things in: any unlocked or bought thing in a colourable slot can be switched from
// its own colours to one of these. A colour turns the thing's main colour family (and shades of it)
// to the new colour, keeping its lights and darks; accents in other colours (gold trim, a white
// pompom) stay as they are. Saved in a pet's picks as `colour.<slot>.<choice>`, so each thing keeps
// its own colour.

/** The slots whose things can be recoloured: not the pet itself, its yard, the sky or a flag. */
export const COLOURABLE_SLOTS = [
  'collar',
  'hat',
  'glasses',
  'outfit',
  'kicks',
  'toy',
  'bed',
  'bowl',
  'buddy',
  'house',
  'fun',
  'party',
  'season',
  'keepsake',
];

export type ItemColour = {
  id: string;
  label: string;
  /** What its swatch shows. */
  swatch: string;
  /** The hue it turns the main colour to (degrees), or a shade without one. */
  hue?: number;
  shade?: 'black' | 'white';
};

export const ITEM_COLOURS: ItemColour[] = [
  { id: 'red', label: 'Red', swatch: '#E5534B', hue: 3 },
  { id: 'orange', label: 'Orange', swatch: '#F2994A', hue: 28 },
  { id: 'yellow', label: 'Yellow', swatch: '#F2C94C', hue: 46 },
  { id: 'green', label: 'Green', swatch: '#5FB36B', hue: 128 },
  { id: 'teal', label: 'Teal', swatch: '#3FB8AF', hue: 175 },
  { id: 'blue', label: 'Blue', swatch: '#4C8FE0', hue: 213 },
  { id: 'purple', label: 'Purple', swatch: '#8E6CD9', hue: 262 },
  { id: 'pink', label: 'Pink', swatch: '#F07AAE', hue: 332 },
  { id: 'black', label: 'Black', swatch: '#2F2B36', shade: 'black' },
  { id: 'white', label: 'White', swatch: '#F4F2EE', shade: 'white' },
];

const BY_ID = new Map(ITEM_COLOURS.map((c) => [c.id, c]));

export function itemColour(id: string | undefined): ItemColour | undefined {
  return id ? BY_ID.get(id) : undefined;
}

/** The picks key for one thing's colour. */
export const colourKey = (slot: string, choice: string) => `colour.${slot}.${choice}`;
/** The resolved picks key for the colour of whatever's in a slot. */
export const slotColourKey = (slot: string) => `colour.${slot}`;

// ---------- Recolouring ----------

type Hsl = { h: number; s: number; l: number };

function toHsl(hex: string): Hsl | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return null;
  const v = parseInt(m[1]!, 16);
  const r = ((v >> 16) & 255) / 255;
  const g = ((v >> 8) & 255) / 255;
  const b = (v & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) * 60 : max === g ? ((b - r) / d + 2) * 60 : ((r - g) / d + 4) * 60;
  return { h, s, l };
}

function toHex({ h, s, l }: Hsl): string {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const hex = (x: number) => Math.round(Math.max(0, Math.min(1, x)) * 255).toString(16).padStart(2, '0');
  return `#${hex(f(0))}${hex(f(8))}${hex(f(4))}`;
}

/** How far apart two hues are, the short way round. */
const hueGap = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

/** Colourful enough to count as a colour (not a grey, black or white). */
const SATURATED = 0.12;
/** Shades within this many degrees of the main colour count as part of it. */
const FAMILY = 40;

/**
 * What a thing's main colour is: a hue, or, for something grey or black all over (frames, a top
 * hat), its greys.
 */
export type ColourBase = { hue: number } | { grey: true };

/** The main colour of something whose first colourful paint is `color`, if it tells us yet. */
export function baseOf(color: string): ColourBase | null {
  const hsl = toHsl(color);
  if (!hsl) return null;
  if (hsl.s >= SATURATED) return { hue: hsl.h };
  if (hsl.l > 0.04 && hsl.l < 0.85) return { grey: true };
  // White doesn't say what it is: wait for the next paint.
  return null;
}

/** `color`, painted in `colour` if it's part of the main colour family `base`. */
export function recolour(color: string, colour: ItemColour, base: ColourBase): string {
  const hsl = toHsl(color);
  if (!hsl) return color;
  if ('hue' in base) {
    if (hsl.s < SATURATED || hueGap(hsl.h, base.hue) > FAMILY) return color;
    if (colour.shade === 'black') return toHex({ h: hsl.h, s: hsl.s * 0.18, l: 0.12 + hsl.l * 0.24 });
    if (colour.shade === 'white') return toHex({ h: hsl.h, s: hsl.s * 0.15, l: 0.86 + hsl.l * 0.12 });
    return toHex({ h: (colour.hue! + hsl.h - base.hue + 360) % 360, s: hsl.s, l: hsl.l });
  }
  if (hsl.s >= SATURATED || hsl.l >= 0.85) return color;
  if (colour.shade === 'black') return color;
  if (colour.shade === 'white') return toHex({ h: 0, s: 0, l: 0.8 + hsl.l * 0.15 });
  return toHex({ h: colour.hue!, s: 0.5, l: 0.22 + hsl.l * 0.6 });
}
