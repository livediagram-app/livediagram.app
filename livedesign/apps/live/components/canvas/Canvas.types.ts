import type { PenInk } from '@/hooks/canvas/commit-freehand';
import type { SnapGuideStore } from '@/hooks/canvas/useSnapGuideState';
import type { CombineOp } from '@/lib/combine/combine';
import type { RemoteSelector } from '@/lib/presence-rows';
import type { Dispatch, SetStateAction } from 'react';
// Prop contract for the Canvas component, split out of Canvas.tsx
// (it was a 320-line inline type). Most field types are referenced
// via inline import('...') so this file only needs the bare-named
// types as top-level imports.
import type { PointerEvent as ReactPointerEvent, Ref } from 'react';
import type { EmbedProvider, Finish, FrameHandle } from '@livedesign/design';
import type {
  BackgroundPattern,
  EditorMode,
  Element,
  Layer,
  IconPosition,
  ShapeKind,
  TextAlignX,
  TextAlignY,
  TextRun,
} from '@livedesign/design';
import type { ArrowEnd, DragMode, QuickConnectDirection, QuickConnectKind } from '@/lib/canvas';
import type { PendingDraw } from '@/lib/draw-mode';
import type { UserPreferences } from '@/lib/user-preferences';
import type { CanvasTool } from '@/components/palette/palette.types';
import type { WorkspaceFrameHooks } from '@/components/providers/workbench-session-context';

// A connection-point marker shown while dragging an arrow endpoint: the
// world-space position of a nearby shape's anchor, with `active` set on the
// one the endpoint is currently snapped to. Rendered by CanvasChrome.
export type SnapTarget = { x: number; y: number; active: boolean };

export type CanvasProps = {
  tabName: string;
  tabLocked: boolean;
  // True for a view-only ('view' share role) session: the editing chrome
  // (palette, selection + multi-select toolbars) is suppressed.
  readOnly: boolean;
  // A Participant (docs/specs/013-workspace/share-roles.md): read-only for every structural control, with a
  // palette of its own holding only what it may add.
  participantPalette?: boolean;
  // A read-only session that still takes part (a Participant): it casts dots in a vote (docs/specs/013-workspace/share-roles.md).
  takePart?: boolean;
  // Which elements a read-only session may still drag (a Participant's stickies and its own adds); absent, none.
  canMove?: (el: Element) => boolean;
  // Which elements' words a read-only session may still write (a Participant's); absent, none.
  canWriteText?: (el: Element) => boolean;
  // Which elements a read-only session may still resize (a Participant's); absent, none.
  canResize?: (el: Element) => boolean;
  designName: string;
  tabBackgroundPattern: BackgroundPattern;
  tabBackgroundColor: string;
  tabBackgroundOpacity: number;
  // Pattern tile scale (the canvas pattern-size slider); defaults to 1.
  tabBackgroundPatternScale: number;
  // Motion rate for an animated background pattern (docs/specs/008-canvas/canvas-and-palette.md); 1 = normal.
  tabBackgroundAnimationSpeed: number;
  tabPatternColor: string;
  // The active tab's default font id (docs/specs/004-interface-design/fonts.md). Elements without their
  // own `font` render in this; undefined = the editor default. Used by
  // the inline label editor (CanvasElementsLayer) for font inheritance.
  tabFont?: string;
  // The tab's finish (docs/specs/008-canvas/finish.md); undefined is Flexible.
  tabFinish?: Finish;
  mainRef: Ref<HTMLElement>;
  setViewportOffset: (offset: { x: number; y: number }) => void;
  // The view itself is not a prop: it lives in the viewport store, read where it shows
  // (docs/specs/008-canvas/blueprints/viewport-store.md "Inside the canvas").
  setViewportZoom: Dispatch<SetStateAction<number>>;
  onFitToScreen: () => void;
  isPinchingRef?: React.RefObject<boolean>;
  elements: Element[];
  // The active tab's raw layers array (docs/specs/006-design/layers.md), undefined until the tab
  // materialises one. Drives the band-aware paint order + hidden-layer
  // filtering in CanvasElementsLayer and the Minimap.
  tabLayers?: Layer[];
  // The viewer's editor mode on the tab (docs/specs/007-editor/pages-mode.md "One mode"): Pages.
  editorMode?: EditorMode;
  // The tab's pages and their edits (docs/specs/007-editor/pages-mode.md "The pages").
  pagesMode?: import('@/hooks/editor/usePagesMode').PagesModeView | null;
  // The canvas ink for this appearance: what a marker's stroke and the logo page's guides draw in.
  whiteboardInk?: string;
  // Element ids on a hidden or locked layer (docs/specs/006-design/layers.md) — inert to every
  // selection surface, including the right-click context menu.
  layerInertIds: Set<string>;
  // Dragged element ids to render translucent while a shift-duplicate is
  // in progress (docs/specs/008-canvas/shift-drag-duplicate.md): the materialised copies already sit at the
  // start position, so the set under the cursor shows as a ghost. Null
  // outside a shift-held move drag.
  shiftDupGhostIds: ReadonlySet<string> | null;
  // The active move / resize drag's snap guides (alignment lines, equal-spacing gaps, arrow-endpoint
  // markers; see docs/specs/008-canvas/canvas-and-palette.md), in the editor's store. Only CanvasChrome,
  // which draws them, reads it, so a new set renders the chrome and not the canvas.
  snapGuideStore: SnapGuideStore;
  onSelectMarquee: (ids: Set<string>) => void;
  canvasTool: CanvasTool;
  onSetCanvasTool: (tool: CanvasTool) => void;
  // Follow-me (docs/specs/012-collaboration/follow-me-viewport.md): the name of whoever we are following, for the pill,
  // and the way out of it. Null / absent = not following anybody.
  followingName?: string | null;
  onStopFollowing?: () => void;
  // The laser pen (docs/specs/008-canvas/spotlight-panel.md). Owned in editor state, not here: the broadcaster
  // stamps it onto every sample and the trail rows carry it, both of which sit
  // above Canvas — so Canvas forwards it to the panel rather than owning it.
  laserConfig?: import('@/lib/laser-config').LaserConfig;
  onChangeLaserField?: <K extends keyof import('@/lib/laser-config').LaserConfig>(
    field: K,
    value: import('@/lib/laser-config').LaserConfig[K],
  ) => void;
  // Laser Panel (docs/specs/008-canvas/spotlight-panel.md): where it sits.
  laserPanelPosition?: { x: number; y: number } | null;
  onMoveLaserPanel?: (x: number, y: number) => void;
  onResetLaserPanel?: () => void;
  // Spotlight Panel (docs/specs/008-canvas/spotlight-panel.md): where it sits.
  spotlightPanelPosition?: { x: number; y: number } | null;
  onMoveSpotlightPanel?: (x: number, y: number) => void;
  onResetSpotlightPanel?: () => void;
  // The eraser's settings (docs/specs/008-canvas/eraser-panel.md). Owned in editor state, where the erase
  // gesture lives; Canvas forwards them to the panel.
  eraserConfig?: import('@/lib/eraser-config').EraserConfig;
  onChangeEraserField?: <K extends keyof import('@/lib/eraser-config').EraserConfig>(
    field: K,
    value: import('@/lib/eraser-config').EraserConfig[K],
  ) => void;
  // The format painter's settings (docs/specs/008-canvas/format-panel.md) and what its brush holds. Owned
  // in editor state, where the paint happens; Canvas forwards them.
  formatConfig?: import('@liveworkspace/workbench/lib/format-config').FormatConfig;
  onToggleFormatGroup?: (
    group: import('@liveworkspace/workbench/lib/format-config').FormatGroup,
  ) => void;
  onSetFormatMode?: (mode: import('@liveworkspace/workbench/lib/format-config').FormatMode) => void;
  formatBrushSource?: import('@/components/panels/FormatPanel').FormatBrushSource | null;
  formatPanelPosition?: { x: number; y: number } | null;
  onMoveFormatPanel?: (x: number, y: number) => void;
  onResetFormatPanel?: () => void;
  // Eraser Panel (docs/specs/008-canvas/eraser-panel.md): where it sits.
  eraserPanelPosition?: { x: number; y: number } | null;
  onMoveEraserPanel?: (x: number, y: number) => void;
  onResetEraserPanel?: () => void;
  // Map of elementId -> remote participants currently focused on that
  // element. Drives a small badge ring on each element so participants
  // can see in real time what others are working on.
  remoteSelectionsByElement: Map<string, RemoteSelector[]>;
  // Live cursor positions for remote participants — canvas-coords +
  // participant identity. Rendered inside the transformed wrapper so
  // they pan and zoom with the canvas.
  remoteCursors: { id: string; name: string; color: string; x: number; y: number }[];
  // Laser-pointer trails for the LaserOverlay — local user first
  // followed by any peers laser-pointing on the active tab. The
  // overlay handles fading and cleanup; Canvas just renders.
  laserTrails: {
    participantId: string;
    color: string;
    points: { x: number; y: number; t: number }[];
  }[];
  // `target` is what the pointer is over, so a paste can tell the canvas from
  // a floating panel lying on top of it (@liveworkspace/workbench/lib/canvas-pointer.ts).
  onCanvasPointerMove: (
    canvasX: number | null,
    canvasY: number | null,
    target?: EventTarget | null,
  ) => void;
  onDuplicateMultiSelected: () => void;
  // Combine (docs/specs/007-editor/logo-pages.md "Combine"): offered while the multi-selection
  // is combinable shapes on one logo page.
  canCombine?: () => boolean;
  onCombine?: (op: CombineOp) => void;
  onDeleteMultiSelected: () => void;
  onToggleLockMultiSelected: () => void;
  // Narrows the multi-selection to just `ids` (Filter Selection menu).
  onFilterMultiSelected: (ids: Set<string>) => void;
  // Opens the Export dialog scoped to just the multi-selection.
  onExportMultiSelected: () => void;
  editingId: string | null;
  // True when the active label edit began via type-to-edit (docs/specs/008-canvas/canvas-and-palette.md):
  // the editor places the caret at the end instead of select-all so the
  // seeded first character isn't replaced by the next keystroke.
  editCursorAtEnd?: boolean;
  formatSourceId: string | null;
  canUndo: boolean;
  canRedo: boolean;
  onAddShape: (kind: ShapeKind) => void;
  onAddIcon: (iconId: string) => void;
  // Sticker (docs/specs/010-palette/stickers.md): its own kind, its own handler.
  onAddSticker: (stickerId: string) => void;
  // Add a Technology (brand) icon as a standalone element (docs/specs/010-palette/technology-icons.md).
  onAddTechIcon: (iconId: string) => void;
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
  onAddAvatar: () => void;
  onAddText: () => void;
  onAddSticky: () => void;
  // Any other file dropped on the canvas, at its canvas point (an image lands there). Absent where files are
  // refused.
  onDropFile?: (file: File, at: { x: number; y: number }) => void;
  // Spawn an empty image placeholder + open the picker. Optional so
  // view-role visitors / no-R2 deployments can simply omit it; the
  // Palette's Image entry hides when missing (docs/specs/009-elements/images.md).
  onAddImage?: () => void;
  // `ends`: the Arrow tool's pointer at its end by default, `'none'` for the Line tool.
  onAddArrow: (ends?: import('@livedesign/design').ArrowEnds) => void;
  // The arrow whose shape a handle drag is changing (a bend, curve, elbow or endpoint): its
  // selection frame stands down until the drag ends (docs/specs/008-canvas/arrow-bending.md).
  reshapingArrowId?: string | null;
  onBeginFreehand: () => void;
  // Highlighter variant of the pencil (docs/specs/008-canvas/highlighter.md) + the polygon
  // click-to-place tool (docs/specs/008-canvas/polygon-tool.md), armed from the palette tiles.
  onBeginHighlighter: () => void;
  // One of the markers, picked up from a logo page's Draw or the Toolbar strip's Search.
  // `once`: picked up for one stroke (a logo page's palette), else held until put down.
  onBeginMarker: (penId: import('@/lib/whiteboard-prefs').WhiteboardPenId, once?: boolean) => void;
  onBeginShapePen: () => void;
  onBeginPolygon: () => void;
  // The Path tool (docs/specs/023-draw-mode/path-tool.md), a logo page's Pen in the palette.
  onBeginPath: () => void;
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
  // preference — the toggle that used to set it is gone. A whiteboard pen's points are its raw
  // samples, landed as they are with their `ink` (pressures, streamline; lib/live-stroke).
  onCommitFreehand: (
    points: { x: number; y: number }[],
    recogniseShapes: boolean,
    // `snapped`: the shape a held-still stroke locked to, as the pen reshaped it (lib/live-stroke);
    // `keepInk`: the stroke was broken out of a shape, so it lands as drawn.
    ink?: PenInk,
  ) => void;
  // Polygon commit (docs/specs/008-canvas/polygon-tool.md). Receives the deliberately clicked
  // vertices in canvas coords (no simplification — the user placed
  // each one) plus whether the loop closed on the start vertex.
  onCommitPolygon: (vertices: { x: number; y: number }[], closed: boolean) => void;
  // The Path tool (docs/specs/023-draw-mode/path-tool.md): a drawn or continued path lands, an
  // edit-mode gesture lands, and how a new path is dressed (style memory), so the path being
  // drawn shows the style it will land with.
  onCommitPath: (commit: import('@/components/canvas/path/usePathDrawGesture').PathCommit) => void;
  onCommitPathEdit: (
    id: string,
    next: { anchors: import('@livedesign/design').PathAnchor[]; closed: boolean },
    kind: import('@/hooks/canvas/usePathCommits').PathEditKind,
  ) => void;
  onDressPath?: <T extends import('@livedesign/design').Element>(el: T) => T;
  // The line or arrow a draw would land if released now, as the canvas would show it, drawn in
  // place of a stand-in while the drag is in flight. From lib/drawn-arrow-preview.
  previewDrawnArrow?: (
    intent: Extract<PendingDraw, { type: 'arrow' }>,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
  ) => import('@livedesign/design').ArrowElement;
  // The user preferences (docs/specs/007-editor/user-preferences.md) the chrome reads.
  settings: UserPreferences;
  onCancelDraw: () => void;
  onUndo: () => void;
  onRedo: () => void;
  // Lightweight id + name of this design's tabs, so a link badge's
  // hover card can name the tab/element a link points at (docs/specs/008-canvas/canvas-and-palette.md). Kept
  // minimal + memoised by the caller so element edits don't churn it.
  tabSummaries: { id: string; name: string }[];
  // Which tab is showing. Optional so read-only / embed mounts can omit it.
  activeTabId?: string;
  // False while the active tab's content is still on its way (a tab never opened before): its elements arrive with
  // the board once it lands, not as additions. Omitted, the tab is loaded.
  activeTabLoaded?: boolean;
  // Map panel (docs/specs/008-canvas/minimap.md) position + move/reset, shared with the other panels.
  mapPosition: { x: number; y: number } | null;
  onMoveMap: (x: number, y: number) => void;
  onResetMap: () => void;
  // Layers panel (docs/specs/006-design/layers.md). `layers` is the NORMALISED stack (bottom ->
  // top, never empty) the panel renders; `tabLayers` above stays the raw
  // field for the render-order helpers. A popover over its bottom-right
  // cluster button.
  layers: Layer[];
  activeLayerId: string;
  layerCounts: Map<string, number>;
  // Per-user preferences (docs/specs/007-editor/user-preferences.md): where the Contents panel sits.
  userPreferences: UserPreferences;
  // Bottom-dock "Theme & canvas" button (docs/specs/011-theme/canvas-and-theme-dialog.md): opens the
  // CanvasThemeDialog. Omitted in read-only / embed sessions (no button).
  onOpenCanvasTheme?: () => void;
  onSelectLayer: (layerId: string) => void;
  onAddLayer: () => void;
  onRemoveLayer: (layerId: string) => void;
  onRenameLayer: (layerId: string, name: string) => void;
  onToggleLayerVisibility: (layerId: string) => void;
  onToggleLayerLock: (layerId: string) => void;
  onReorderLayer: (layerId: string, toIndex: number) => void;
  onMergeLayer: (direction: 'above' | 'below') => void;
  onSetLayerOpacity: (layerId: string, opacity: number) => void;
  onClearLayer: (layerId: string) => void;
  onHideOtherLayers: (layerId: string) => void;
  // Hover-to-solo (docs/specs/006-design/layers.md): while set, the canvas renders ONLY this
  // layer. Driven by hovering a Layers-panel row; pure view state.
  layerPreviewId: string | null;
  onPreviewLayer: (layerId: string | null) => void;
  // Floating Comments panel. Only mounted when commentRows is
  // non-empty: the panel exists to list discussion that already
  // exists, so on designs without it the panel stays out of the
  // chrome entirely.
  commentRows: import('@/components/panels/CollaboratePanel').CommentRow[];
  commentsPanelPosition: { x: number; y: number } | null;
  onMoveCommentsPanel: (x: number, y: number) => void;
  onResetCommentsPanel: () => void;
  // Row click: editor selects the element + opens its thread popover.
  onOpenCommentsForElement: (elementId: string) => void;
  // Floating Actions panel (docs/specs/012-collaboration/assigned-actions.md). Mirrors the Comments panel: only
  // mounted when actionRows is non-empty (at least one OPEN action on
  // the active tab).
  actionRows: import('@/components/panels/CollaboratePanel').ActionRow[];
  // Row click: editor selects the element + opens its action popover.
  onOpenActionForElement: (elementId: string) => void;
  // The Collaborate panel row's round check (docs/specs/012-collaboration/assigned-actions.md §5): complete
  // (done) or reopen the action in place. Absent for a read-only visitor.
  onToggleActionDone?: (elementId: string, done: boolean, actionId: string) => void;
  currentDesignId: string | null;
  // The link this session came in on, so the Explorer panel reads the open design as the link allows.
  currentShareCode?: string | null;
  // The open design renamed from the Explorer panel: the editor's title follows at once.
  onRenameCurrentDesign?: (name: string) => void;
  onNewDesign: () => void;
  // The Explorer panel's ⋯ menu verbs beyond new / open (docs/specs/013-workspace/folders.md).
  explorerMenuActions?: import('@/components/panels/Explorer.types').ExplorerMenuActions;
  onDeselect: () => void;
  onSelect: (id: string) => void;
  // Right-click on the canvas background. Receives the cursor's
  // screen coords so the caller can open a "current tab" context
  // menu anchored under it. Distinct from element right-clicks
  // (those go through BoxedElementView's onContextSelect).
  onCanvasContextMenu?: (screenX: number, screenY: number) => void;
  // Eraser tool (docs/specs/008-canvas/canvas-and-palette.md): a primary-button press while the eraser is
  // active. The canvas intercepts it in the capture phase (before element
  // select/drag) and hands the screen coords here to start an erase
  // gesture; the gesture's move/release are tracked by useCanvasEraser.
  onEraseStart?: (clientX: number, clientY: number) => void;
  // Right-click on an element. Forwarded from BoxedElementView's
  // own context handler — the canvas selects the element and the
  // page opens an element context menu.
  onElementContextMenu?: (id: string, screenX: number, screenY: number) => void;
  // Right-click on a multi-selection or group: open a selection-wide menu
  // (the page sets a 'multi' context-menu mode). Always OPENS at the cursor —
  // mirrors onElementContextMenu, so re-right-clicking repositions rather than
  // toggling closed.
  onMultiContextMenu?: (screenX: number, screenY: number) => void;
  // Toggle variant for the selection toolbar's "More" ellipsis: opens the
  // 'multi' menu, or closes it if already open (mirrors onOpenElementContextMenu
  // for the single-element ellipsis).
  onOpenMultiContextMenu?: (screenX: number, screenY: number) => void;
  onBeginDrag: (id: string, mode: DragMode, e: ReactPointerEvent) => void;
  // The armed action a press on an element takes instead of selecting it (an arrow armed to connect, the
  // format painter): true when it took it. For a touch press that panned instead of dragging, whose tap
  // must still connect or paint (docs/specs/008-canvas/canvas-and-palette.md "Touch (iOS / iPad)").
  onPressArmedAction?: (id: string) => boolean;
  onBeginEdit: (id: string) => void;
  onCommitLabel: (id: string, label: string, runs?: TextRun[]) => void;
  // Inline label-editor (rich-text) alignment control, threaded through
  // CanvasElementsLayer to the in-place editor on the selected element.
  onSetTextAlign: (x: TextAlignX, y: TextAlignY) => void;
  // Single combined table commit (cells + the parallel colWidths /
  // rowHeights / cellStyles arrays) applied in ONE commit, so structural
  // ops can't drop a side array or clobber each other off a stale base.
  onCommitTable: (
    id: string,
    patch: Partial<
      Pick<
        import('@livedesign/design').TableElement,
        'cells' | 'colWidths' | 'rowHeights' | 'cellStyles'
      >
    >,
  ) => void;
  onCancelEdit: () => void;
  // Table quick-connect ring (docs/specs/008-canvas/canvas-and-palette.md): append a row / column to the
  // selected table from the bottom / right plus.
  onAddTableRow: () => void;
  onAddTableColumn: () => void;
  // Toggle one checklist row's done state (docs/specs/009-elements/checklist.md). Omitted in read-only.
  onToggleChecklistItem?: (elementId: string, index: number) => void;
  // The Page masthead (docs/specs/009-elements/page-element.md): its heading and subtitle are their own
  // fields, so they commit through here rather than the label editor.
  onSetPageHeading: (elementId: string, field: 'pageTitle' | 'pageSubtitle', value: string) => void;
  // The web components (docs/specs/009-elements/web-components-and-no-groups.md): a row edited in place, one more row from
  // the quick-connect ring, and a hero's caption line. Omitted in read-only.
  onSetWebRows?: (elementId: string, rows: import('@livedesign/design').WebRows) => void;
  // A pointer note's tip let go at a canvas point (docs/specs/009-elements/pointer-note.md). Omitted in read-only.
  onSetPointerTip?: (elementId: string, tipAbs: { x: number; y: number }) => void;
  onAppendWebRow?: (elementId: string) => void;
  onSetHeroCaptionLine?: (
    elementId: string,
    field: keyof import('@livedesign/design').HeroCaption,
    value: string,
  ) => void;
  // Default chart slice colours derived from the active theme (docs/specs/009-elements/pie-chart.md), used
  // by pie charts for slices without an explicit colour.
  chartPalette: readonly string[];
  onBeginEndpointDrag: (arrowId: string, end: ArrowEnd, e: ReactPointerEvent) => void;
  onBeginArrowCurveDrag: (arrowId: string, e: ReactPointerEvent) => void;
  onBeginArrowCurvePointDrag: (arrowId: string, index: number, e: ReactPointerEvent) => void;
  onBeginArrowBend: (arrowId: string, e: ReactPointerEvent<SVGElement>) => void;
  // Scale a selected free arrow from its frame handles (docs/specs/008-canvas/arrow-bending.md).
  onBeginArrowScale: (arrowId: string, handle: FrameHandle, e: ReactPointerEvent) => void;
  onDeleteCurvePoint: (arrowId: string, index: number) => void;
  onBeginArrowElbowDrag: (arrowId: string, e: ReactPointerEvent) => void;
  onBeginArrowLabelDrag: (arrowId: string, e: ReactPointerEvent) => void;
  onBeginArrowTranslate: (arrowId: string, e: ReactPointerEvent) => void;
  onShiftSelect: (id: string) => void;
  // Wrap up the Format canvas tool (the palette tool): drops back to the
  // tool active before it. Drives the format-tool mode banner's "Done" button.
  onExitFormatTool: () => void;
  // The Format tool's press on a page's paper (docs/specs/007-editor/pages-mode.md
  // "Copying a background"): arms or paints that page's background. Absent where pages cannot be
  // painted (another mode, a person who may not edit them), so such a press is an empty-canvas one.
  onFormatPagePress?: (pageId: string) => void;
  onFollowLink: (link: import('@livedesign/design').ElementLink) => void;
  onOpenComments: (elementId: string) => void;
  // Open the element's assigned-action popover (docs/specs/012-collaboration/assigned-actions.md). Available in
  // read-only sessions too — visitors may read an action; the popover
  // gates its mutations itself.
  onOpenAction: (elementId: string) => void;
  onOpenNote?: (elementId: string) => void;
  // Drop a palette icon onto a shape: set its inline iconId and the
  // position (which side of the text) derived from where it was dropped.
  // Optional so read-only / pre-identity Canvas mounts can omit it.
  onDropIcon?: (elementId: string, iconId: string, position: IconPosition) => void;
  // Open the link picker for a specific table cell. Optional so read-
  // only / pre-identity Canvas mounts can omit it.
  onLinkCell?: (tableId: string, r: number, c: number) => void;
  // Open the link picker for a link-card element (docs/specs/009-elements/link-cards.md), on double-click.
  // Omitted for read-only viewers.
  onEditLink?: (id: string) => void;
  // Open an element's own edit dialog on double-click: a code block's code (docs/specs/009-elements/code-block.md),
  // a Sankey's flows (docs/specs/009-elements/sankey.md). Omitted for read-only viewers.
  onOpenEditDialog?: (id: string) => void;
  // Per-render context for image elements: identity + auth bits the
  // ImageElementView needs to fetch bitmap bytes. Optional so the
  // welcome / new-design surface (where Canvas mounts before
  // identity / share-code are settled) can omit it.
  imageContext?: {
    ownerId: string;
    designId: string;
    shareCode: string | null;
    onOpenPicker?: (elementId: string) => void;
  };
  // Touch-friendly fallback for right-click: a SelectionPopover
  // ellipsis button opens the same context menu under the cursor.
  onOpenElementContextMenu?: (elementId: string, screenX: number, screenY: number) => void;
  // The visitor name prompt (IdentityPrompt).
  showIdentityPrompt: boolean;
  // True after the page has resolved its initial identity + design
  // fetch. Used to suppress the empty-state card during the brief
  // window between "loader dropped" and "welcome modal mounted" so
  // a fresh New Design doesn't flash the Empty Canvas message.
  hydrated: boolean;
  // When non-null, the visitor is signed in to an account and their
  // display name is fixed to their account name: IdentityPrompt
  // locks the input.
  identityLockedName?: string | null;
  // Hides the floating chrome (palette, explorer, zoom + history dock,
  // plus buttons, selection popover) while the first-run welcome modal
  // is taking the user through identity / template / theme selection.
  // Keeps the canvas surface visible (so the modal isn't floating on a
  // blank page) but free of distracting controls.
  welcomeOpen: boolean;
  selfParticipant: import('@/lib/identity').Participant;
  // The name prompt's Join (the name typed) and Cancel.
  onConfirmIdentity: (name: string) => void;
  onCancelIdentity: () => void;
  tabThemeId: import('@/lib/themes').ThemeId;
  // Set the active tab's default font (docs/specs/004-interface-design/fonts.md); null clears it.
  // Set the active tab's default text size for new palette elements.
  // File I/O for the current tab — moved here so the Current Tab
  // section (right-hand inspector) houses them next to theme +
  // canvas, where the user is editing the tab anyway. Optional so
  // welcome-flow surfaces with no tab loaded yet can omit them.
  // Recent-images list for the Current Tab "Images" accordion (docs/specs/009-elements/images.md).
  // Forwarded through to TabSection unchanged.
  onToggleAspectLock: () => void;
  // Quick add + connect (docs/specs/008-canvas/canvas-and-palette.md). The radial ring on each element edge
  // spawns a connected element (Duplicate / Square / Circle), starts an
  // arrow from that side (drag on desktop, tap-target on mobile — the
  // handler branches on the pointer type), or enters freehand draw.
  onSpawnConnect: (direction: QuickConnectDirection, kind: QuickConnectKind) => void;
  // Drag-from-palette drop: a palette tile dropped on the canvas places that
  // element kind centred on the drop point. `art` carries the catalogue id
  // for the two catalogue-driven kinds — `iconId` for an icon or brand mark,
  // `stickerId` for a sticker (docs/specs/010-palette/stickers.md).
  onDropPalette?: (
    kind: ShapeKind | 'sticky',
    canvasX: number,
    canvasY: number,
    // `choice` is the creation-time value a split tile carries (which session
    // tool, reaction, mode or estimate scale), so a DRAG places what the tile
    // says it places rather than the kind's default.
    art?: { iconId?: string; stickerId?: string; choice?: string },
  ) => void;
  onStartArrow: (direction: QuickConnectDirection, e: ReactPointerEvent) => void;
  onStartPencil: () => void;
  onToggleLockSelected: () => void;
  onDeleteSelected: () => void;
  // Duplicate the selected element. Surfaced as a one-click button in
  // the selection toolbar (SelectionPopover); previously context-menu only.
  // True while an element context menu is open, so the selection popover
  // can stand down (one gesture, one answer).
  elementMenuOpen?: boolean;
  onDuplicateSelected: () => void;
  // Intra-LAYER z-order from the selection popover (docs/specs/006-design/layers.md): stack the
  // selection within its own band, never between layers.
  onBringSelectedToFront: () => void;
  onSendSelectedToBack: () => void;
  onCanvasDoubleClick: (x: number, y: number) => void;
  // Lazy per-tab load (docs/specs/006-design/per-tab-storage.md). While the active tab's content is being
  // fetched ('loading') or after that fetch failed ('error'), Canvas
  // renders a blocking TabLoadOverlay so the user never edits a blank
  // placeholder whose autosave would wipe the real server row. 'ready'
  // (or undefined) renders the canvas normally. `onRetryTabLoad`
  // re-issues the fetch from the error card.
  tabLoadState?: import('@/app/design/[id]/editor-page-helpers').TabLoadState;
  onRetryTabLoad?: () => void;
  // Zen / focus mode (docs/specs/007-editor/zen-mode.md). When true, CanvasChrome hides every
  // floating panel + the history dock + the owner badge, keeping only
  // the canvas content and the zoom controls (which grow an exit
  // button). `onToggleZen` flips it — wired to the palette enter
  // button, the zoom-dock exit button, and the Z shortcut.
  zenMode?: boolean;
  onToggleZen?: () => void;
  // The editor in a workbench (docs/specs/013-workspace/blueprints/workbench-embeds.md, Surface table)
  // has no Explorer: neither the floating panel nor the Toolbar layout's menu button.
  explorerHidden?: boolean;
  // A workspace frame's Back (docs/specs/013-workspace/blueprints/workbench-embeds.md, WB59), in the menu button's
  // place at the canvas's top left.
  workbenchBack?: Pick<WorkspaceFrameHooks, 'back' | 'backTitle'> | null;
};
