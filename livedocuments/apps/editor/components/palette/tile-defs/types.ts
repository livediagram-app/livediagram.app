import type { EmbedProvider } from '@livedocuments/document';
import type { ComponentKind, ShapeKind } from '@livedocuments/document';

// Every palette tile glyph is drawn at this size (docs/specs/004-interface-design/iconography.md), so a strip of
// tiles reads as one set.
export const TILE_GLYPH_PX = 18;

// 'icons' and 'technology' exist only on DYNAMIC tiles (individual catalogue
// icons on the Toolbar strip, palette-dynamic-tiles.tsx) — no PALETTE_TILES entry carries
// them, so tilesInSection never returns them.
export type PaletteTileSection =
  | 'shapes'
  // Structure (docs/specs/010-palette/build-category.md): the elements you lay a diagram OUT with rather than
  // draw on it — a frame, a stack, a table, a Sankey. They were
  // scattered across Write, Draw, Data and Components, filed by what they look
  // like; what they have in common is that they hold other work.
  | 'build'
  | 'tools'
  | 'data'
  | 'media'
  | 'components'
  // Concept graphics (docs/specs/009-elements/concept-graphics.md).
  | 'concepts'
  | 'devices'
  | 'stickers'
  | 'icons'
  | 'technology';

// What clicking (or drag-dropping) the tile does. 'shape' descriptors also
// drive the tile's drag-to-place payload + pending-draw highlight; the
// singleton tools map one-to-one onto the editor's add-handlers.
type PaletteTileAction =
  | {
      type: 'shape';
      kind: ShapeKind;
      // A creation-time variant of the kind (packages/document shape-variants.ts): the Callout card, a Funnel.
      variant?: string;
    }
  // A Write text style (docs/specs/008-canvas/canvas-and-palette.md "Text styles").
  | { type: 'text'; preset?: import('@livedocuments/document').TextPresetId }
  | { type: 'video'; provider?: EmbedProvider }
  | { type: 'sticker'; stickerId: string }
  | { type: 'polygon' }
  // `ends`: the Line tile's `'none'`; the Arrow tile leaves it to the tool's pointer at its end.
  | { type: 'arrow'; ends?: import('@livedocuments/document').ArrowEnds }
  | { type: 'sticky' }
  | { type: 'table' }
  | { type: 'image' }
  | { type: 'link-card' }
  | { type: 'component'; kind: ComponentKind }
  // Dynamic icon tiles (palette-dynamic-tiles.tsx): a single line-art /
  // Technology catalogue entry as a tile.
  | { type: 'icon'; iconId: string }
  | { type: 'tech-icon'; iconId: string };

// Themed sub-groups within the Tools section (docs/specs/008-canvas/canvas-and-palette.md "Sub-categories"):
// the Tools tab renders one labelled grid per group instead of a flat
// sixteen-tile wall. Group membership is metadata on the tile — ids stay
// stable, so palette layouts and search are untouched.
export type ToolGroupId = 'write' | 'draw';

// Display order, headings, and a one-line "what's in here" for the Tools tab's
// groups. The description is what the category tile's hover card says: a count
// ("6 tools") tells you nothing you can act on, whereas naming the contents
// answers the actual question — is the thing I want in this box?
// Label + membership only. These groups render through PaletteToolRows /
// PaletteTileGroup, each carrying its own title, and a title shows a label
// rather than a blurb —
// the browsable category descriptions live in PALETTE_CATEGORIES.
export const TOOL_GROUPS: { id: ToolGroupId; label: string }[] = [
  {
    id: 'write',
    label: 'Write',
  },
  {
    // Split back out from a combined "Write & Draw" (docs/specs/010-palette/palette-top-level-categories.md): once both were
    // one click from the palette's categories rather than two inside Tools, the
    // pairing bought nothing and the combined list ran to eight rows.
    id: 'draw',
    label: 'Draw',
  },
];

export type PaletteTileDef = {
  // Stable id: palette layouts (palette-layouts.ts) and the Search panel address tiles by it, so
  // renaming one means renaming it there too.
  id: string;
  section: PaletteTileSection;
  // Which Tools-tab group the tile renders under. Required exactly when
  // `section === 'tools'` (a test pins this); meaningless elsewhere.
  toolGroup?: ToolGroupId;
  // Collapses this tile into a named group inside its category, rather than
  // showing it as a top-level row (docs/specs/009-elements/embed-providers.md). 'embed' = the Media tab's embed
  // providers; 'web' = the Components tab's website composites.
  tileGroup?: 'embed' | 'web';
  label: string;
  // Overrides the caption derived from `label` where that runs too long
  // for the tile (see IconButton).
  caption?: string;
  description: string;
  // A short line rendered UNDER the tile in list layouts (the Tools tab).
  // Separate from `description`, which is the fuller hover card / search text:
  // this one has to fit a palette-width row, so it is a clause, not a
  // sentence, and it says what the tool IS rather than how to use it.
  blurb?: string;
  icon: React.ReactNode;
  shortcut?: string;
  // IconButton flags (docs/specs/008-canvas/canvas-and-palette.md theme tinting): `filled` tiles preview the
  // theme's element fill; `noTint` tiles keep fixed colours.
  filled?: boolean;
  noTint?: boolean;
  // Tile only renders when the editor supplies onAddImage (image uploads
  // available) — the Image / Avatar / Hero / Header tiles.
  needsImage?: boolean;
  // Greyed out with its reason (no press, no drag, the reason in its hover card).
  disabled?: { reason: string };
  // Ends a group of related tiles in its category: a fixed divider follows it on the Toolbar
  // strip, between it and the next tile shown (docs/specs/007-editor/toolbar-layout.md "Fixed
  // dividers"). Never more than two per category.
  dividerAfter?: true;
  // Presets of this tile's element (docs/specs/009-elements/card.md "Card presets"): on the Toolbar strip the tile is
  // drawn as an opener (its glyph with a caret) whose popover offers them; elsewhere the tile places its own element.
  variants?: readonly PaletteTileDef[];
  // The line under the presets popover's title: what can still change after one is placed.
  variantsHint?: string;
  action: PaletteTileAction;
};
