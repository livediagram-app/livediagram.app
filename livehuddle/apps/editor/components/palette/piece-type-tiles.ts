import { changesType, variantsOf, type Element, type ShapeElement } from '@livehuddle/document';
import {
  CORRIDOR_PRESET_TILES,
  DOOR_PRESET_TILES,
  RUG_PRESET_TILES,
} from './palette-floor-presets';
import { ROOM_TILES } from './tile-defs/room-tiles';
import type { PaletteTileDef } from './tile-defs/types';
import { tileDisplayName } from './palette-tile-defs';

// The element menu's Type section's choices (docs/specs/009-elements/office.md "A piece's type"): a kind's palette
// cards, so the menu names and draws each type exactly as the palette does, in the palette's order.

const TABLE_TILES = ['tools:meeting-table', 'tools:long-table'].map((id) =>
  ROOM_TILES.find((t) => t.id === id)!,
);

const TYPE_TILES: Readonly<Record<string, readonly PaletteTileDef[]>> = {
  door: DOOR_PRESET_TILES,
  rug: RUG_PRESET_TILES,
  corridor: CORRIDOR_PRESET_TILES,
  'meeting-table': TABLE_TILES,
};

/** One type a piece can take: its stored name, and the caption and glyph its palette card shows. */
export type PieceTypeChoice = { type: string; label: string; icon: React.ReactNode };

/** The types a kind's Type section offers, in palette order; none for a kind whose type the menu does not change. */
export function pieceTypeChoices(kind: string): PieceTypeChoice[] {
  if (!changesType(kind)) return [];
  const first = variantsOf(kind)[0]!;
  return TYPE_TILES[kind]!.map((tile) => {
    // Every Type tile places a shape; its `variant` is the type, absent for the first.
    const { variant } = tile.action as { variant?: string };
    return { type: variant ?? first, label: tileDisplayName(tile), icon: tile.icon };
  });
}

/**
 * The piece whose Type the selection menu offers (office.md "A piece's type"): the right-clicked one when its kind
 * changes type, else, opened from the selection's toolbar with no piece clicked, the one kind every retyped piece in the
 * selection shares. Null when none of the selection retypes, or it mixes two such kinds with none clicked.
 */
export function selectionTypeTarget(
  selection: readonly Element[],
  clickedId?: string,
): ShapeElement | null {
  const retyped = selection.filter(
    (el): el is ShapeElement => el.type === 'shape' && changesType(el.shape),
  );
  const clicked = retyped.find((el) => el.id === clickedId);
  if (clicked) return clicked;
  const first = retyped[0];
  return first && retyped.every((el) => el.shape === first.shape) ? first : null;
}
