// What a colour picker offers (docs/specs/004-interface-design/colour-picker.md "The colours"): the
// option shape every surface hands the one picker, and builders for the standard colours, no
// colour, and custom colours.
import {
  colourWords,
  isHexColour,
  standardColourAt,
  standardColours,
  type Appearance,
  type StandardTone,
} from '@livediagram/document';

export type ColourOption = {
  // What a pick hands back: a surface's own id (a stock name, a slot, 'transparent'), or a hex.
  id: string;
  // What the swatch shows.
  colour: string;
  // Its tooltip and accessible name: a colour word, or a custom colour's hex.
  label: string;
  // Drawn as no colour (a white swatch with a slash), whatever the surface calls it.
  none?: boolean;
};

export type ColourGroup = { heading: string; options: readonly ColourOption[] };

/**
 * The ten standard colours in a tone, drawn for a surface. `by: 'name'` picks hand back the stock
 * name (a canvas line or text stores it, adaptive per board); `by: 'hex'` the hex itself.
 */
export function standardOptions(
  tone: StandardTone,
  appearance: Appearance,
  by: 'hex' | 'name',
): ColourOption[] {
  return standardColours(tone, appearance).map((c) => ({
    id: by === 'name' ? c.name : c.hex,
    colour: c.hex,
    label: c.label,
  }));
}

/** The one standard row a picker shows under "Colours". */
export function standardGroup(
  tone: StandardTone,
  appearance: Appearance,
  by: 'hex' | 'name',
): ColourGroup {
  return { heading: 'Standard Colours', options: standardOptions(tone, appearance, by) };
}

/** No colour, under the name the surface gives it ("None", "No fill", "Paper"). */
export function noColour(id: string, label: string): ColourOption {
  return { id, colour: 'transparent', label, none: true };
}

/** A colour word for a hex: the standard colour it is, else "#rrggbb". */
export function colourName(hex: string): string {
  return standardColourAt(hex)?.label ?? hex.toLowerCase();
}

/** A custom colour as an option, picked by its hex. */
export function hexOption(hex: string): ColourOption {
  const id = hex.toLowerCase();
  return { id, colour: id, label: colourName(id) };
}

/**
 * Whether a swatch is the value in force: the same id, or, for a hex value, the same colour in any
 * case (a colour stored by name arrives as the hex it is drawn in).
 */
export function optionMatches(option: ColourOption, value: string | null | undefined): boolean {
  if (value === null || value === undefined) return false;
  if (option.id === value) return true;
  return (
    isHexColour(value) &&
    isHexColour(option.colour) &&
    option.colour.toLowerCase() === value.toLowerCase()
  );
}

/**
 * Custom colours in a stable order while a picker is open (docs/specs/004-interface-design/
 * colour-picker.md "Custom colours"). A hover preview rewrites the document,
 * which would move the hovered colour to the front (or drop one it painted over) and slide the
 * swatches under the pointer. So a colour already shown keeps its slot, and only a colour new to the
 * list (a pick from the custom editor) joins, at the front. Returns `shown` itself when nothing new
 * arrived, so a caller can compare by identity.
 */
export function stableColours(
  shown: readonly string[],
  next: readonly string[],
  max: number,
): readonly string[] {
  const added = next.filter((c) => !shown.includes(c));
  if (added.length === 0) return shown;
  return [...added, ...shown].slice(0, max);
}

/** A theme's colours as the Theme Palette: each its hex, named by a colour word, never two alike. */
export function themeOptions(presets: readonly string[]): ColourOption[] {
  const words = colourWords(presets);
  return presets.map((c, i) => ({ id: c, colour: c, label: words[i]! }));
}
