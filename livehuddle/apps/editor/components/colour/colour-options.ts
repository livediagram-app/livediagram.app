// What a colour picker offers (docs/specs/004-interface-design/colour-picker.md "The colours"): the
// option shape every surface hands the one picker, and builders for the standard colours, no
// colour, and custom colours.
import {
  colourWords,
  standardColours,
  type Appearance,
  type StandardTone,
} from '@livehuddle/document';
import {
  type ColourGroup,
  type ColourOption,
} from '@liveworkspace/workbench/components/colour/colour-options';

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

/** A theme's colours as the Theme Palette: each its hex, named by a colour word, never two alike. */
export function themeOptions(presets: readonly string[]): ColourOption[] {
  const words = colourWords(presets);
  return presets.map((c, i) => ({ id: c, colour: c, label: words[i]! }));
}
