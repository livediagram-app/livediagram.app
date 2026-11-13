// A typed or pasted hex colour, as the custom colour editor takes it (docs/specs/004-interface-design/colour-picker.md):
// #RGB or #RRGGBB, with or without the hash, any case, returned as lower-case #rrggbb; null for anything else.
const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function normaliseHex(value: string): string | null {
  const m = HEX.exec(value.trim());
  if (!m) return null;
  const digits = m[1]!.toLowerCase();
  const full = digits.length === 3 ? [...digits].map((d) => d + d).join('') : digits;
  return `#${full}`;
}
