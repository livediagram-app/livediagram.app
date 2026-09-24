// The user's own colour palette (spec/09 Colours): the colours they have
// actually used that the theme did not already offer.
//
// A theme's presets answer "what goes with this diagram"; this answers "what
// did I just use on the last three elements". Without it, giving a second
// element the exact colour of the first means re-picking it off the OS colour
// wheel and matching by eye, which nobody does accurately.

/** Most colours worth remembering, newest first. Older ones fall off. */
export const MAX_CUSTOM_SWATCHES = 12;

const isHex = (c: string): boolean => /^#[0-9a-f]{6}$/i.test(c);

/**
 * Add a used colour to the personal palette, unless the theme already offers
 * it (no point remembering what is already one click away) or it is not a
 * plain hex: `transparent` and the like are always-present options, not
 * colours to collect.
 *
 * Newest first, de-duplicated case-insensitively, capped.
 */
export function addCustomSwatch(
  existing: string[] | undefined,
  color: string,
  presets: string[],
): string[] {
  const current = existing ?? [];
  if (!isHex(color)) return current;
  const lower = color.toLowerCase();
  if (presets.some((p) => p.toLowerCase() === lower)) return current;
  const withoutDupe = current.filter((c) => c.toLowerCase() !== lower);
  return [color, ...withoutDupe].slice(0, MAX_CUSTOM_SWATCHES);
}

/** Drop one, for the right-click-to-bin affordance. */
export function removeCustomSwatch(existing: string[] | undefined, color: string): string[] {
  const lower = color.toLowerCase();
  return (existing ?? []).filter((c) => c.toLowerCase() !== lower);
}
