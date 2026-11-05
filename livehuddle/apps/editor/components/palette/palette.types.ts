import type { EmbedProvider } from '@livehuddle/document';
import type { ShapeKind } from '@livehuddle/document';
import type { PendingDraw } from '@/lib/draw-mode';
import type { PaletteTint } from '@/components/palette/palette-controls';

export type CanvasTool =
  | 'pan'
  | 'select'
  // Avatar mode (docs/specs/008-canvas/avatar-mode.md): a walking pixel character, read-only canvas.
  | 'avatar'
  | 'eraser'
  | 'format';

// The palette strip's inputs (docs/specs/007-editor/toolbar-layout.md): the canvas tool, the add
// handlers every tile calls, and the tab's state the tiles read.
export type PaletteProps = {
  canvasTool: CanvasTool;
  onSetCanvasTool: (tool: CanvasTool) => void;
  // Leaves Avatar mode (docs/specs/008-canvas/avatar-mode.md) for whichever tool preceded it. Fired when
  // the user picks any palette tile while walking, so the add lands instead of
  // being swallowed by the read-only canvas. Omit outside the editor.
  onExitAvatarMode?: () => void;
  // True when the active tab has no elements. Disables the canvas tools that
  // need existing content (Eraser / Format).
  canvasEmpty?: boolean;
  // `opts` carries the creation-time choice for the kinds that have one
  // (docs/specs/009-elements/mode-button.md modes), so a tile per choice places
  // that choice rather than the factory default.
  onAddShape: (
    kind: ShapeKind,
    opts?: {
      mode?: import('@livehuddle/document').SelectionMode;
      plan?: string;
      variant?: string;
    },
  ) => void;
  // Sticker (docs/specs/010-palette/stickers.md): its own element kind, so its own handler; it never folds into the
  // selected shape. No icon handlers: livehuddle adds no icon (docs/specs/002-project-scope/not-in-livehuddle.md "Icons").
  onAddSticker: (stickerId: string) => void;
  onAddText: () => void;
  onAddSticky: () => void;
  // Drop a 3x3 editable table at the viewport centre.
  onAddTable: () => void;
  // Drop a note marker (annotation) at the viewport centre. See docs/specs/009-elements/annotations.md.
  onAddAnnotation: () => void;
  // Drop a link-card / bookmark at the viewport centre. See docs/specs/009-elements/link-cards.md.
  onAddLinkCard: () => void;
  onAddVideo: (provider?: EmbedProvider) => void;
  // Composite "Components" (docs/specs/008-canvas/canvas-and-palette.md): each arms the tap-or-drag draw gesture.
  // Banner / Callout / Stat row / Process need no image and always show; Hero
  // / Header (and the Tools-tab Avatar) carry an image, so they're gated on
  // image upload being available (onAddImage present).
  onAddBanner: () => void;
  onAddHero: () => void;
  onAddHeader: () => void;
  onAddCallout: () => void;
  onAddStatRow: () => void;
  onAddProcess: () => void;
  onAddAvatar: () => void;
  // Spawn an image placeholder + open the picker. Optional so
  // deployments without R2 (or view-role visitors) can omit it; the
  // Image palette entry hides when the handler is missing. See
  // docs/specs/009-elements/images.md.
  onAddImage?: () => void;
  // Drops a horizontal arrow at the viewport centre with no pointers
  // on either end by default (i.e. a plain line). Users can flip the
  // arrowEnds afterwards via the Pointer accordion.
  // `ends`: the Arrow tool's pointer at its end by default, `'none'` for the Line tool.
  onAddArrow: (ends?: import('@livehuddle/document').ArrowEnds) => void;
  // Pencil tool: enters one-shot freehand draw mode. Unlike the
  // other add-element callbacks, this never drops at the viewport
  // centre, the pencil is gestural by design. See docs/specs/008-canvas/canvas-and-palette.md Pencil
  // (freehand) subsection.
  onBeginFreehand: () => void;
  // Highlighter (docs/specs/008-canvas/highlighter.md): the pencil gesture with the marker
  // variant. Same one-shot arm semantics as onBeginFreehand.
  onBeginHighlighter: () => void;
  // Picks up one of Draw mode's markers outside Draw mode (the Toolbar strip's Search,
  // docs/specs/007-editor/toolbar-layout.md "Search: every element type").
  // `once`: picked up for one stroke (a logo page's palette), else held until put down.
  onBeginMarker: (penId: import('@/lib/whiteboard-prefs').WhiteboardPenId) => void;
  onBeginShapePen: () => void;
  // Disarm the armed tool: its tile pressed again (docs/specs/008-canvas/canvas-and-palette.md "Placement on add").
  onCancelDraw?: () => void;
  // Polygon tool (docs/specs/008-canvas/polygon-tool.md): arms the click-to-place-vertices mode.
  onBeginPolygon: () => void;
  // The Room Builder (docs/specs/009-elements/room-builder.md): arms the room-walls gesture.
  onBeginRoomWalls?: () => void;
  // Currently-queued draw-to-size intent, or null. When set, the
  // matching palette button (shape, text, sticky, image, arrow)
  // renders pressed so the user can see what's queued for the next
  // canvas drag. Only populated when user-preferences.drawToAdd is
  // on; otherwise null and no button shows the pressed treatment.
  pendingDraw?: PendingDraw | null;
  // Fired after a tile is used, so a surface that hangs the palette in a
  // popover (the Toolbar strip's More) can put it away.
  onTileUsed?: () => void;
  // Active tab theme's element colours, so the palette tiles preview the
  // theme: shape / device / annotation tiles render filled in the theme's
  // fill + stroke, line-art tools + icons tint to the stroke. Undefined (the
  // Default theme) leaves the palette in its default slate look. See docs/specs/008-canvas/canvas-and-palette.md.
  themeTint?: PaletteTint;
};
