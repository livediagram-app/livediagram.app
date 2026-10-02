// A draw.io colour value (docs/specs/020-import-export/blueprints/drawio-import.md
// step 6). `default` and absence are deliberately UNSET, not white or black:
// the element then takes the tab's theme like anything drawn in livediagram.

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
