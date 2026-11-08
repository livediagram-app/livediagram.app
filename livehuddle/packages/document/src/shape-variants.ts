// Creation-time variants (docs/specs/009-elements/office.md "Room presets", room-builder.md "Door types"): one shape
// kind placed as a particular variant, because the
// palette offers a tile per variant ("the variant is the decision"). The tile's `variant` rides the draw intent and is
// applied here to the factory's fresh element, so every placement path (tap, drag, drop, an article's Insert) lands
// the same thing.
//
// A LEAF module: types only from './index', and the leaf tables of the presets (piece-variants, room-preset-shapes).

import type { ShapeElement } from './index';
import { PIECE_VARIANT_SIZES, storesVariant, variantsOf } from './piece-variants';
import { roomAsPreset, roomPreset } from './room-preset-shapes';

/** The Restroom room preset's variant (docs/specs/009-elements/office-amenities.md "The Restroom preset"): the Room
 *  is named Restroom, and its pieces come with it (room-presets.ts). */
export const RESTROOM_VARIANT = 'restroom';

/** `el` placed as `variant`, or `el` itself when the kind has no such variant. */
export function applyShapeVariant(el: ShapeElement, variant: string | undefined): ShapeElement {
  if (!variant) return el;
  if (el.shape === 'room' && variant === RESTROOM_VARIANT) return { ...el, label: 'Restroom' };
  // The Room tile's presets (docs/specs/009-elements/office.md "Room presets"): a size, a name, a shaped one's walls.
  const preset = el.shape === 'room' ? roomPreset(variant) : null;
  if (preset) return roomAsPreset(el, preset);
  // A Door's, Rug's or Corridor's type (room-builder.md "Door types", office.md "Rug types", corridor.md): stored,
  // because its drawing reads it, with the type's size.
  if (storesVariant(el.shape) && variantsOf(el.shape).includes(variant)) {
    const size = PIECE_VARIANT_SIZES[el.shape]?.[variant];
    const typed: ShapeElement = { ...el, variant, ...size };
    // A Long Table is drawn to its width, so it takes any (office.md "Long Table").
    if (el.shape === 'meeting-table' && variant === 'long') {
      const { aspectLocked: _held, ...long } = typed;
      return long;
    }
    if (el.shape !== 'rug') return typed;
    // A Round rug stays a circle; the other patterned rugs are drawn to their box, so they take any.
    if (variant === 'round') return { ...typed, aspectLocked: true };
    const { aspectLocked: _locked, ...free } = typed;
    return free;
  }
  return el;
}
