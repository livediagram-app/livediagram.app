// A tag's colour as drawn (docs/specs/013-workspace/tags.md "A tag"): a standard colour by name in its strong-tone
// version for the page's appearance, or a custom `#rrggbb` as it is. Pure.
import {
  STANDARD_COLOUR_NAMES,
  isHexColour,
  penColourHex,
  type Appearance,
  type StandardColourName,
} from '@liveplanner/project';

const isStandard = (v: string): v is StandardColourName =>
  (STANDARD_COLOUR_NAMES as readonly string[]).includes(v);

// Anything unreadable (a value from a newer client) draws as Grey rather than vanishing.
export function tagColourHex(colour: string, appearance: Appearance): string {
  if (isHexColour(colour)) return colour.toLowerCase();
  return penColourHex(isStandard(colour) ? colour : 'grey', appearance);
}

// The faint wash a chip sits on and its hairline: the colour at low alpha, so any colour reads on either appearance
// and the chip's text stays the page's own.
export function tagWash(hex: string): { background: string; borderColor: string } {
  return { background: `${hex}1f`, borderColor: `${hex}59` };
}
