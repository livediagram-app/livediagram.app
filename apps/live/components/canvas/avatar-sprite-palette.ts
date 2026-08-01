// The Avatar sprite's colour palette (spec/101), shared by the sprite body and
// the head-and-hair views next door. Colour is the one thing every part of the
// figure has to agree on, so it lives in one file rather than being threaded
// between them or duplicated per view.
//
// Sprite palette. Warm skin + brown hair, with one darker tone per material
// for the shaded edge that gives pixel art its volume. The shirt is the
// participant's presence colour (brand cyan when there isn't one).
export const SKIN = '#f4c99b';
export const SKIN_DARK = '#d9a674';
export const HAIR = '#6b4423';
export const HAIR_DARK = '#4a2e17';
const DEFAULT_SHIRT = '#0ea5e9';
export const TROUSERS = '#3f4c63';
export const TROUSERS_DARK = '#2c3648';
export const SHOE = '#1e293b';
export const EYE = '#243044';
export const SHIRT_WHITE = '#f8fafc';
export const FLAG_POLE = '#b8845a';
export const FLAG_CLOTH = '#f43f5e';
// Tones the later outfits need beyond the shirt colour: denim for overalls, a
// clinical white-coat body, and a leather-ish apron.
export const DENIM = '#41597f';
export const DENIM_DARK = '#2f4260';
export const COAT = '#eef2f6';
export const COAT_DARK = '#cfd8e3';
export const APRON = '#8b5e34';

// A darker companion to an arbitrary shirt colour, for the shaded side. Mixes
// the hex toward black; falls back to the default pair when the colour isn't a
// plain 6-digit hex (a CSS name or rgb() string from an older presence packet).
export function shade(hex: string | undefined): { base: string; dark: string } {
  const base = hex ?? DEFAULT_SHIRT;
  const m = /^#([0-9a-f]{6})$/i.exec(base);
  if (!m) return { base, dark: base };
  const n = parseInt(m[1] ?? '', 16);
  const mix = (c: number) => Math.round(c * 0.78);
  const dark =
    '#' +
    [mix((n >> 16) & 255), mix((n >> 8) & 255), mix(n & 255)]
      .map((c) => c.toString(16).padStart(2, '0'))
      .join('');
  return { base, dark };
}
