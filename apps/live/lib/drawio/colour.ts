// A draw.io colour value (docs/specs/020-import-export/blueprints/drawio-import.md
// step 6). `default` and absence are deliberately UNSET, not white or black:
// the element then takes the tab's theme like anything drawn in livediagram.

import { INK_MAX_CHROMA, INK_MAX_LIGHTNESS, sceneOklch } from '@/lib/board-scene/colour';

export type DrawioColour = { kind: 'unset' } | { kind: 'none' } | { kind: 'hex'; value: string };

const UNSET: DrawioColour = { kind: 'unset' };
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
// The light value: everything up to the first comma, trimmed by the caller (no overlapping quantifiers).
const LIGHT_DARK = /^light-dark\(([^,]*),/i;
const RGB = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,[^)]*)?\)$/i;

const byte = (v: string) => Math.min(255, Number(v)).toString(16).padStart(2, '0');

export function readColour(value: string | undefined): DrawioColour {
  const v = value?.trim() ?? '';
  if (v === '' || v === 'default' || v === 'inherit') return UNSET;
  if (v === 'none') return { kind: 'none' };
  if (HEX.test(v)) return { kind: 'hex', value: v.toLowerCase() };
  const lightDark = LIGHT_DARK.exec(v);
  if (lightDark) return readColour(lightDark[1]!.trim());
  const rgb = RGB.exec(v);
  if (rgb) return { kind: 'hex', value: `#${byte(rgb[1]!)}${byte(rgb[2]!)}${byte(rgb[3]!)}` };
  return UNSET;
}

/** The hex value, when there is one. */
export const hexOf = (value: string | undefined): string | undefined => {
  const c = readColour(value);
  return c.kind === 'hex' ? c.value : undefined;
};

// draw.io diagrams are drawn on white paper, so authors pick near-black ink and near-white panels
// as if they were the defaults. Both follow the theme, as draw.io's own dark mode turns them (spec
// "Paper colours follow the theme too"). Near-black is the board scene's ink rule; near-white is
// paper (D39): `#f5f5f5` and `#eeeeee` are paper, `#e0e0e0` is a grey someone chose.
export const PAPER_MIN_LIGHTNESS = 0.93;
export const PAPER_MAX_CHROMA = 0.02;

const isInk = (hex: string) => {
  const ok = sceneOklch(hex.slice(0, 7));
  return ok !== null && ok.l <= INK_MAX_LIGHTNESS && ok.c <= INK_MAX_CHROMA;
};
const isPaper = (hex: string) => {
  const ok = sceneOklch(hex.slice(0, 7));
  return ok !== null && ok.l >= PAPER_MIN_LIGHTNESS && ok.c <= PAPER_MAX_CHROMA;
};

/** A text, stroke or arrow colour: near-black is unset (the theme's ink). */
export function readInk(value: string | undefined): DrawioColour {
  const c = readColour(value);
  return c.kind === 'hex' && isInk(c.value) ? UNSET : c;
}

/** A fill: near-white is unset (the theme's surface). */
export function readFill(value: string | undefined): DrawioColour {
  const c = readColour(value);
  return c.kind === 'hex' && isPaper(c.value) ? UNSET : c;
}

/** The hex of an ink colour that stays, when there is one. */
export const hexInk = (value: string | undefined): string | undefined => {
  const c = readInk(value);
  return c.kind === 'hex' ? c.value : undefined;
};

/** The hex of a fill that stays, when there is one. */
export const hexFill = (value: string | undefined): string | undefined => {
  const c = readFill(value);
  return c.kind === 'hex' ? c.value : undefined;
};
