import type { PenInk } from '@/hooks/canvas/commit-freehand';
import type { ShapeLibraryItem } from '@livediagram/api-schema';
import type { LibraryShapeRef } from '@/lib/shape-library-dnd';
import type { EmbedProvider, EsSide, EventStormingNoteKind } from '@livediagram/document';
import type { ShapeKind } from '@livediagram/document';
import type { PendingDraw } from '@/lib/draw-mode';
import type { UserPreferences } from '@/lib/user-preferences';
import type { EsBoardControls } from '@/components/palette/EventStormingBoardRows';

// The Canvas's add and draw props (CanvasProps in Canvas.types.ts is the whole contract): the palette's
// adds, the draw-to-size, freehand, polygon and path gestures, and undo / redo.
export type CanvasAddProps = {
  onAddShape: (kind: ShapeKind) => void;
  onAddIcon: (iconId: string) => void;
  // Sticker (docs/specs/010-palette/stickers.md): its own kind, its own handler.
  onAddSticker: (stickerId: string) => void;
  // Add a Technology (brand) icon as a standalone element (docs/specs/010-palette/technology-icons.md).
  onAddTechIcon: (iconId: string) => void;
  // Places a shape from the palette's My shapes (docs/specs/013-workspace/shape-libraries.md) at the
  // middle of the view.
  onInsertLibraryShape: (item: ShapeLibraryItem) => void;
  onAddTable: () => void;
  onAddAnnotation: () => void;
  onAddLinkCard: () => void;
  onAddVideo: (provider?: EmbedProvider) => void;
  // Composite "Components" (docs/specs/008-canvas/canvas-and-palette.md), dropped at the viewport centre. Hero /
  // Header / Avatar carry an image and open the picker on drop.
  onAddBanner: () => void;
  onAddHero: () => void;
  onAddHeader: () => void;
  onAddCallout: () => void;
  onAddStatRow: () => void;
  onAddProcess: () => void;
  onAddFlowchart: () => void;
  onAddAvatar: () => void;
  onAddText: () => void;
  // Optional fill + kind: an Event Storming note (docs/specs/021-event-storming/event-storming.md).
  onAddSticky: (fill?: string, esKind?: EventStormingNoteKind) => void;
  // True when the active tab is an event-storming board (docs/specs/021-event-storming/event-storming.md), the
  // palette opens on the Event Storming category instead of Favourites, and
  // a palette drag can offer to insert BETWEEN two notes.
  esBoard?: boolean;
  // Board-level switches for the palette's Event Storming category
  // (docs/specs/021-event-storming/event-storming.md Phase 6: timeline lanes). Supplied only on such a board.
  esBoardControls?: EsBoardControls;
  // Add the next note beside a note (docs/specs/021-event-storming/event-storming.md Phase 7), from its next-note
  // button. Absent when the session cannot create.
  onAddNextNote?: (fromId: string, side: EsSide) => void;
  // Read a photograph of the wall dropped on the canvas (docs/specs/021-event-storming/event-storming.md Phase 8).
  // Present only on an event-storming board with the model configured.
  onDropPhoto?: (file: File) => void;
  // Any other file dropped on the canvas, at its canvas point (an Excalidraw file or export,
  // docs/specs/020-import-export/excalidraw-import-export.md "Paste"). Absent where files are refused.
  onDropFile?: (file: File, at: { x: number; y: number }) => void;
  // A shape dragged from My shapes, at its canvas point (docs/specs/013-workspace/shape-libraries.md).
  // Absent where nothing can be placed.
  onDropLibraryShape?: (ref: LibraryShapeRef, at: { x: number; y: number }) => void;
  // True when a new element cannot land at all: a locked tab, a view-only
  // session, or a hidden / locked active layer (docs/specs/006-document/layers.md). The insert-between
  // preview reads it so it never offers a slot the drop would refuse.
  createBlocked?: boolean;
  // Spawn an empty image placeholder + open the picker. Optional so
  // view-role visitors / no-R2 deployments can simply omit it; the
  // Palette's Image entry hides when missing (docs/specs/009-elements/images.md).
  onAddImage?: () => void;
  // `ends`: the Arrow tool's pointer at its end by default, `'none'` for the Line tool.
  onAddArrow: (ends?: import('@livediagram/document').ArrowEnds) => void;
  // The arrow whose shape a handle drag is changing (a bend, curve, elbow or endpoint): its
  // selection frame stands down until the drag ends (docs/specs/008-canvas/arrow-bending.md).
  reshapingArrowId?: string | null;
  onBeginFreehand: () => void;
  // Highlighter variant of the pencil (docs/specs/008-canvas/highlighter.md) + the polygon
  // click-to-place tool (docs/specs/008-canvas/polygon-tool.md), armed from the palette tiles.
  onBeginHighlighter: () => void;
  // One of Draw mode's markers, picked up from the Toolbar strip's Search in another mode.
  onBeginMarker: (penId: import('@/lib/whiteboard-prefs').WhiteboardPenId) => void;
  onBeginShapePen: () => void;
  onBeginPolygon: () => void;
  // Draw-to-size mode. Picking any palette element except the annotation
  // (docs/specs/008-canvas/canvas-and-palette.md "Placement on add") stashes the intent here; the canvas then
  // enters a drag-to-define gesture. pointer-up calls onCommitDraw with the start + end
  // canvas-coord points (raw, no axis swap) so the editor can decide
  // how to interpret them per intent: box intents floor to a 16px
  // minimum and convert to top-left + width/height; the arrow intent
  // treats the points as from / to. onCancelDraw backs the Cancel
  // button on the in-canvas ModeBanner (Escape calls it from the
  // keyboard hook too).
  pendingDraw: PendingDraw | null;
  onCommitDraw: (
    intent: PendingDraw,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
  ) => void;
  // Freehand commit (pen intent). Receives the raw pointer-sample
  // polyline in canvas coords. The editor applies RDP simplification
  // and Catmull-Rom-to-Bezier smoothing before minting the
  // FreehandElement, both for storage size and visual smoothness.
  // `recogniseShapes` says whether this stroke came from the Shape Pen
  // (docs/specs/010-palette/stickers.md); when true the caller (commitFreehand) runs the polyline
  // through recogniseShape and may mint a real shape primitive instead of a
  // FreehandElement. It reads off the armed intent's variant, not a
  // preference, the toggle that used to set it is gone. A whiteboard pen's points are its raw
  // samples, landed as they are with their `ink` (pressures, streamline; lib/live-stroke).
  onCommitFreehand: (
    points: { x: number; y: number }[],
    recogniseShapes: boolean,
    // `snapped`: the shape a held-still stroke locked to, as the pen reshaped it (lib/live-stroke);
    // `keepInk`: the stroke was broken out of a shape, so it lands as drawn.
    ink?: PenInk,
  ) => void;
  // Polygon commit (docs/specs/008-canvas/polygon-tool.md). Receives the deliberately clicked
  // vertices in canvas coords (no simplification, the user placed
  // each one) plus whether the loop closed on the start vertex.
  onCommitPolygon: (vertices: { x: number; y: number }[], closed: boolean) => void;
  // The Path tool (docs/specs/023-draw-mode/path-tool.md): a drawn or continued path lands, an
  // edit-mode gesture lands, and how a new path is dressed (style memory), so the path being
  // drawn shows the style it will land with.
  onCommitPath: (commit: import('@/components/canvas/path/usePathDrawGesture').PathCommit) => void;
  onCommitPathEdit: (
    id: string,
    next: { anchors: import('@livediagram/document').PathAnchor[]; closed: boolean },
    kind: import('@/hooks/canvas/usePathCommits').PathEditKind,
  ) => void;
  onDressPath?: <T extends import('@livediagram/document').Element>(el: T) => T;
  // The line or arrow a draw would land if released now, as the canvas would show it
  // (docs/specs/023-draw-mode/draw-mode.md "Shapes"), drawn in place of a stand-in while the drag
  // is in flight. From lib/drawn-arrow-preview.
  previewDrawnArrow?: (
    intent: Extract<PendingDraw, { type: 'arrow' }>,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
  ) => import('@livediagram/document').ArrowElement;
  // The user preferences (docs/specs/007-editor/user-preferences.md) the chrome reads.
  settings: UserPreferences;
  onCancelDraw: () => void;
  // The Fill tool's press (docs/specs/023-draw-mode/fill-tool.md), at a canvas point.
  onPaintBucket?: (point: { x: number; y: number }) => void;
  onUndo: () => void;
  onRedo: () => void;
};
