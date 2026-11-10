import type { PenColour } from '@livediagram/document';
import type { WhiteboardPenId } from '@/lib/whiteboard-prefs';
import type { EmbedProvider, EventStormingNoteKind } from '@livediagram/document';
import type {
  ComponentKind,
  EstimateScale,
  Reaction,
  SelectionMode,
  SessionTool,
  ShapeKind,
} from '@livediagram/document';

// Every palette tile glyph is drawn at this size (docs/specs/004-interface-design/iconography.md), so a strip of
// tiles reads as one set.
export const TILE_GLYPH_PX = 18;

// 'icons' and 'technology' exist only on DYNAMIC tiles (individual catalogue
// icons on the Toolbar strip, palette-dynamic-tiles.tsx) — no PALETTE_TILES entry carries
// them, so tilesInSection never returns them.
export type PaletteTileSection =
  | 'shapes'
  // Structure (docs/specs/010-palette/build-category.md): the elements you lay a diagram OUT with rather than
  // draw on it — a mind node, a lane, a frame, a timeline, a table. They were
  // scattered across Write, Draw, Data and Components, filed by what they look
  // like; what they have in common is that they hold other work.
  | 'build'
  // The Event Storming notation (docs/specs/021-event-storming/event-storming.md): a top-level category of the
  // eight workshop note kinds, each an ordinary sticky in its semantic
  // colour.
  | 'event-storming'
  | 'tools'
  | 'data'
  // 'collaborate' is GONE (docs/specs/010-palette/palette-top-level-categories.md). The collaboration family (docs/specs/012-collaboration/estimate-card.md to
  // docs/specs/012-collaboration/roll-call.md) had its own category on the reasoning that Behaviour is
  // "pressing this does something to your session" while these are "the canvas
  // is collecting an answer from everybody". In the picker that line never
  // held: both are elements whose content arrives at runtime, both are reached
  // for while facilitating, and a user looking for the Done check found it in
  // one and the Estimate card in the other with nothing to tell them which.
  // They are now Collaborate elements, offered as six categories: see COLLABORATE_CATEGORY_GROUPS.
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
  // `session` / `reaction` are creation-time choices, not separate kinds: both
  // elements are ONE kind with a mode field, and the palette offers a tile per
  // mode inside an accordion (docs/specs/012-collaboration/session-button.md, docs/specs/009-elements/reaction-pad.md) the way Media does for embed
  // providers. Placing "Poll" has to place a poll, not a timer to reconfigure.
  | {
      type: 'shape';
      kind: ShapeKind;
      session?: SessionTool;
      reaction?: Reaction;
      mode?: SelectionMode;
      estimateScale?: EstimateScale;
      // A creation-time variant of the kind (packages/document shape-variants.ts): the Callout card, a Funnel.
      variant?: string;
    }
  | { type: 'text' }
  // An opener (palette-openers): stands for a category, or one group of a catalogue, and opens it; places nothing.
  | { type: 'open'; category: string; group?: string }
  | { type: 'freehand' }
  // Marker variant of the pencil (docs/specs/008-canvas/highlighter.md), the recognising pen
  // (docs/specs/008-canvas/two-pens.md) and the click-to-place vertex tool (docs/specs/008-canvas/polygon-tool.md)
  // are separate action types, so each tile maps to its own arm-handler and pressed state.
  | { type: 'highlighter' }
  | { type: 'shape-pen' }
  | { type: 'video'; provider?: EmbedProvider }
  | { type: 'sticker'; stickerId: string }
  | { type: 'polygon' }
  // `ends`: the Line tile's `'none'`; the Arrow tile leaves it to the tool's pointer at its end.
  | { type: 'arrow'; ends?: import('@livediagram/document').ArrowEnds }
  // `fill` rides the sticky action for the Event Storming tiles (docs/specs/021-event-storming/event-storming.md):
  // eight semantic colours over the one sticky type, one tile per note kind.
  // `fill` + `esKind` ride the sticky action for the Event Storming tiles
  // (docs/specs/021-event-storming/event-storming.md): eight semantic colours over the one sticky type, one tile
  // per note kind. The kind lets the commit path route the note onto its
  // workshop stage's layer on event-storming boards.
  | { type: 'sticky'; fill?: string; esKind?: EventStormingNoteKind }
  | { type: 'table' }
  | { type: 'image' }
  | { type: 'annotation' }
  | { type: 'link-card' }
  | { type: 'component'; kind: ComponentKind }
  // Dynamic icon tiles (palette-dynamic-tiles.tsx): a single line-art /
  // Technology catalogue entry as a tile.
  | { type: 'icon'; iconId: string }
  | { type: 'tech-icon'; iconId: string }
  // One of Draw mode's markers (docs/specs/023-draw-mode/draw-mode.md "Pens"), offered by the
  // Toolbar strip's Search in the other modes (palette-marker-tiles.tsx): picked up as the dock
  // picks it up, in its colour and width. Never in PALETTE_TILES: a marker's colour and width are
  // the person's own, read when the Search opens.
  | {
      type: 'marker';
      penId: WhiteboardPenId;
      colour: PenColour | null;
      width: number;
    };

// Themed sub-groups within the Tools section (docs/specs/008-canvas/canvas-and-palette.md "Sub-categories"):
// the Tools tab renders one labelled grid per group instead of a flat
// sixteen-tile wall. Group membership is metadata on the tile — ids stay
// stable, so palette layouts and search are untouched.
export type ToolGroupId = 'write' | 'draw' | 'behaviour';

// Display order, headings, and a one-line "what's in here" for the Tools tab's
// groups. The description is what the category tile's hover card says: a count
// ("6 tools") tells you nothing you can act on, whereas naming the contents
// answers the actual question — is the thing I want in this box?
// Label + membership only. These groups render through PaletteToolRows /
// PaletteTileGroup, each carrying its own title, and a title shows a label
// rather than a blurb —
// the browsable category descriptions live in PALETTE_CATEGORIES. A
// `description` field here went unread for long enough to drift out of step
// with the live one for `behaviour`, which is why it is gone.
export const TOOL_GROUPS: { id: ToolGroupId; label: string }[] = [
  {
    id: 'write',
    label: 'Write',
  },
  {
    // Split back out from a combined "Write & Draw" (docs/specs/010-palette/palette-top-level-categories.md): once both were
    // one click from the category picker rather than two inside Tools, the
    // pairing bought nothing and the combined list ran to eight rows.
    id: 'draw',
    label: 'Draw',
  },
  // Behaviour (docs/specs/009-elements/mode-button.md): elements that DO something when someone interacts
  // with them, rather than elements that say something. Last, because a
  // diagram is drawn before it is wired up.
  {
    id: 'behaviour',
    label: 'Behaviour',
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
  // providers; 'web' = the Components tab's website composites; 'session' and
  // 'reaction' = the Behaviour tab's session tools and reactions; 'mode' its
  // selection-mode buttons; 'move' / 'tools' the rest of Behaviour; and
  // 'ask' / 'record' the two halves of Collaborate.
  // 'event-storming' = the Write tab's sticky-notation group (docs/specs/021-event-storming/event-storming.md).
  tileGroup?:
    'embed' | 'web' | 'session' | 'reaction' | 'mode' | 'move' | 'tools' | 'ask' | 'record';
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
