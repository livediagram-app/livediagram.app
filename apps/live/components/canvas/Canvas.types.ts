// Prop contract for the Canvas component, split out of Canvas.tsx
// (it was a 320-line inline type). Most field types are referenced
// via inline import('...') so this file only needs the bare-named
// types as top-level imports.
import type { PointerEvent as ReactPointerEvent, Ref } from 'react';
import type {
  AlignmentGuide,
  BackgroundPattern,
  DistributionGuide,
  Element,
  Layer,
  IconPosition,
  ShapeKind,
  TextAlignX,
  TextAlignY,
  TextRun,
  TextSize,
} from '@livediagram/diagram';
import type { ArrowEnd, DragMode, QuickConnectDirection, QuickConnectKind } from '@/lib/canvas';
import type { PendingDraw } from '@/lib/draw-mode';
import type { TemplateKind } from '@livediagram/templates';
import type { UserPreferences } from '@/lib/user-preferences';
import type { ChangeLogEntry, DiagramListItem, Folder, SharedWithItem } from '@/lib/api-client';
import type { TeamDiagramRow, TeamFolderRow } from '@/hooks/persistence/useTeamLibrariesSweep';
import type { CanvasTool } from '@/components/palette/CommandPalette';

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
  // Owner of the diagram, looked up by the page (selfParticipant when
  // the viewer is the owner; the live-presence row for the owner-id
  // otherwise). `null` when the owner is not currently in the room,
  // in which case the owner half of the top-middle badge is hidden.
  ownerParticipant: import('@/lib/identity').Participant | null;
  isOwner: boolean;
  diagramName: string;
  tabBackgroundPattern: BackgroundPattern;
  tabBackgroundColor: string;
  tabBackgroundOpacity: number;
  // Pattern tile scale (the canvas pattern-size slider); defaults to 1.
  tabBackgroundPatternScale: number;
  tabPatternColor: string;
  // The active tab's default font id (spec/28). Elements without their
  // own `font` render in this; undefined = the editor default. Used by
  // the inline label editor (CanvasElementsLayer) for font inheritance.
  tabFont?: string;
  mainRef: Ref<HTMLElement>;
  viewportOffset: { x: number; y: number };
  setViewportOffset: (offset: { x: number; y: number }) => void;
  viewportZoom: number;
  setViewportZoom: (zoom: number) => void;
  onFitToScreen: () => void;
  isPinchingRef?: React.RefObject<boolean>;
  elements: Element[];
  // The active tab's raw layers array (spec/74), undefined until the tab
  // materialises one. Drives the band-aware paint order + hidden-layer
  // filtering in CanvasElementsLayer and the Minimap.
  tabLayers?: Layer[];
  // Element ids on a hidden or locked layer (spec/74) — inert to every
  // selection surface, including the right-click context menu.
  layerInertIds: Set<string>;
  // Faint alignment guides for the active move / resize drag (the edge
  // / centre lines the dragged element shares with neighbours). Empty
  // when no snap is in effect. Rendered by CanvasChrome. See spec/09.
  snapGuides: AlignmentGuide[];
  // Equal-spacing guides: the gap segments shown when a moved element
  // snaps to even spacing with its neighbours. Rendered by CanvasChrome.
  distGuides: DistributionGuide[];
  // Connection-point markers revealed while dragging an arrow endpoint near
  // a shape, so the user can see exactly where it will snap. Empty otherwise.
  snapTargets: SnapTarget[];
  selectedId: string | null;
  // Drill-in selection (spec/09 groups): when equal to selectedId the
  // selection is just that member, not its whole group.
  soloSelectedId: string | null;
  multiSelectedIds: Set<string>;
  onSelectMarquee: (ids: Set<string>) => void;
  canvasTool: CanvasTool;
  onSetCanvasTool: (tool: CanvasTool) => void;
  // Map of elementId -> remote participants currently focused on that
  // element. Drives a small badge ring on each element so participants
  // can see in real time what others are working on.
  remoteSelectionsByElement: Map<string, { id: string; name: string; color: string }[]>;
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
  onCanvasPointerMove: (canvasX: number | null, canvasY: number | null) => void;
  onDuplicateMultiSelected: () => void;
  onDeleteMultiSelected: () => void;
  onGroupMultiSelected: () => void;
  onToggleLockMultiSelected: () => void;
  // Narrows the multi-selection to just `ids` (Filter Selection menu).
  onFilterMultiSelected: (ids: Set<string>) => void;
  // Opens the Export dialog scoped to just the multi-selection.
  onExportMultiSelected: () => void;
  editingId: string | null;
  // True when the active label edit began via type-to-edit (spec/09):
  // the editor places the caret at the end instead of select-all so the
  // seeded first character isn't replaced by the next keystroke.
  editCursorAtEnd?: boolean;
  formatSourceId: string | null;
  groupSourceId: string | null;
  palettePosition: { x: number; y: number } | null;
  explorerPosition: { x: number; y: number } | null;
  canUndo: boolean;
  canRedo: boolean;
  onAddShape: (kind: ShapeKind) => void;
  onAddIcon: (iconId: string) => void;
  // Add a Technology (brand) icon as a standalone element (spec/41).
  onAddTechIcon: (iconId: string) => void;
  onAddTable: () => void;
  onAddAnnotation: () => void;
  onAddLinkCard: () => void;
  // Composite "Components" (spec/09), dropped at the viewport centre. Hero /
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
  // Spawn an empty image placeholder + open the picker. Optional so
  // view-role visitors / no-R2 deployments can simply omit it; the
  // Palette's Image entry hides when missing (spec/19).
  onAddImage?: () => void;
  onAddArrow: () => void;
  onBeginFreehand: () => void;
  // Draw-to-size mode. When user-preferences.drawToAdd is on,
  // picking any palette element (shape, text, sticky, image, arrow)
  // stashes the intent here; the canvas then enters a drag-to-define
  // gesture. pointer-up calls onCommitDraw with the start + end
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
  // `recogniseShapes` is the user-preference toggle exposed via the
  // pencil ModeBanner; when true, the caller (editor-page
  // commitFreehand) runs the polyline through recogniseShape and may
  // mint a real shape primitive instead of a FreehandElement.
  onCommitFreehand: (points: { x: number; y: number }[], recogniseShapes: boolean) => void;
  // Lifted recogniseShapes preference. Lives in editor-page's
  // userPreferences state (spec/20) so flipping the banner toggle
  // persists across pencil sessions and across devices for signed-
  // in users. Canvas reads the value to drive the toggle button's
  // pressed state and passes it through to onCommitFreehand; the
  // setter writes through writeUserPreferences so D1 syncs.
  recogniseShapes: boolean;
  onToggleRecogniseShapes: () => void;
  // Minimal panel layout preference (spec/20). When true, the floating
  // panels render as dock popovers on desktop too (always on mobile).
  minimalPanels?: boolean;
  // Toggle the minimal-panel layout. Surfaced in the Palette header
  // (desktop) as the one-click normal <-> minimal switch.
  onToggleMinimalPanels?: () => void;
  // Lifted user preferences + a write-through setter, forwarded to the
  // Palette settings popover (spec/20). Holds the canvas-behaviour
  // toggles (auto-attach arrows, alignment guides) that the popover edits.
  settings: UserPreferences;
  onChangeSettings: (next: UserPreferences) => void;
  onCancelDraw: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onMovePalette: (x: number, y: number) => void;
  onResetPalette: () => void;
  onMoveExplorer: (x: number, y: number) => void;
  onResetExplorer: () => void;
  diagramList: DiagramListItem[];
  // Lightweight id + name of this diagram's tabs, so a link badge's
  // tooltip can name the tab/element a link points at (spec/09). Kept
  // minimal + memoised by the caller so element edits don't churn it.
  tabSummaries: { id: string; name: string }[];
  folders: Folder[];
  // Shared-with-you list. Empty by default so legacy callers can
  // omit it.
  sharedDiagrams?: SharedWithItem[];
  onDismissShared?: (diagramId: string) => void;
  // Teams the signed-in user belongs to + their swept libraries
  // (spec/35), forwarded to the floating Explorer panel for its Teams
  // accordion, team rows in Recent, and the current team diagram.
  // Empty by default so guest / legacy callers can omit them.
  teams?: { id: string; name: string }[];
  teamFolders?: TeamFolderRow[];
  teamDiagrams?: TeamDiagramRow[];
  diagramListLoading: boolean;
  changeLog: ChangeLogEntry[];
  changeLogLoading: boolean;
  activityPosition: { x: number; y: number } | null;
  activityMinimized: boolean;
  // Map panel (spec/59) position + move/reset, shared with the other panels.
  mapPosition: { x: number; y: number } | null;
  onMoveMap: (x: number, y: number) => void;
  onResetMap: () => void;
  onMoveActivity: (x: number, y: number) => void;
  onToggleActivityMinimized: () => void;
  onResetActivity: () => void;
  // Layers panel (spec/74). `layers` is the NORMALISED stack (bottom ->
  // top, never empty) the panel renders; `tabLayers` above stays the raw
  // field for the render-order helpers. Minimised by default into a
  // bottom-right dock button, mirroring Activity.
  layers: Layer[];
  activeLayerId: string;
  layerCounts: Map<string, number>;
  layersPanelPosition: { x: number; y: number } | null;
  layersMinimized: boolean;
  onMoveLayersPanel: (x: number, y: number) => void;
  onResetLayersPanel: () => void;
  onToggleLayersMinimized: () => void;
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
  // Hover-to-solo (spec/74): while set, the canvas renders ONLY this
  // layer. Driven by hovering a Layers-panel row; pure view state.
  layerPreviewId: string | null;
  onPreviewLayer: (layerId: string | null) => void;
  // Floating Comments panel. Only mounted when commentRows is
  // non-empty: the panel exists to list discussion that already
  // exists, so on diagrams without it the panel stays out of the
  // chrome entirely.
  commentRows: import('@/components/panels/CollaboratePanel').CommentRow[];
  commentsPanelPosition: { x: number; y: number } | null;
  onMoveCommentsPanel: (x: number, y: number) => void;
  onResetCommentsPanel: () => void;
  // Row click: editor selects the element + opens its thread popover.
  onOpenCommentsForElement: (elementId: string) => void;
  // Floating Actions panel (spec/68). Mirrors the Comments panel: only
  // mounted when actionRows is non-empty (at least one OPEN action on
  // the active tab).
  actionRows: import('@/components/panels/CollaboratePanel').ActionRow[];
  // Row click: editor selects the element + opens its action popover.
  onOpenActionForElement: (elementId: string) => void;
  onRevertChange: (entry: ChangeLogEntry) => void;
  onActivityRowClick: (entry: ChangeLogEntry) => void;
  onClearActivity?: () => void;
  saveStatus: import('@/components/chrome/EditorHeader').SaveStatus;
  savedAt: number | null;
  currentDiagramId: string | null;
  onOpenDiagram: (id: string, shareCode?: string) => void;
  onNewDiagram: () => void;
  onRenameCurrent: (name: string) => void;
  onDeleteDiagram: (id: string) => void;
  onDuplicateDiagram: (id: string) => void;
  onCreateFolder: (input: { name: string; parentId: string | null }) => Promise<Folder | void>;
  onRenameFolder: (id: string, name: string) => void;
  onDeleteFolder: (id: string) => void;
  onMoveDiagramToFolder: (diagramId: string, folderId: string | null) => void;
  onDeselect: () => void;
  onSelect: (id: string) => void;
  // Right-click on the canvas background. Receives the cursor's
  // screen coords so the caller can open a "current tab" context
  // menu anchored under it. Distinct from element right-clicks
  // (those go through BoxedElementView's onContextSelect).
  onCanvasContextMenu?: (screenX: number, screenY: number) => void;
  // Eraser tool (spec/09): a primary-button press while the eraser is
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
  onBeginEdit: (id: string) => void;
  onCommitLabel: (id: string, label: string, runs?: TextRun[]) => void;
  // Inline label-editor (rich-text) controls, threaded through
  // CanvasElementsLayer to the in-place editor on the selected element.
  onSetTextSize: (size: TextSize) => void;
  onSetTextAlign: (x: TextAlignX, y: TextAlignY) => void;
  onSetFont: (font: string | null) => void;
  onSetPadding: (padding: import('@livediagram/diagram').Padding) => void;
  // Single combined table commit (cells + the parallel colWidths /
  // rowHeights / cellStyles arrays) applied in ONE commit, so structural
  // ops can't drop a side array or clobber each other off a stale base.
  onCommitTable: (
    id: string,
    patch: Partial<
      Pick<
        import('@livediagram/diagram').TableElement,
        'cells' | 'colWidths' | 'rowHeights' | 'cellStyles'
      >
    >,
  ) => void;
  onCancelEdit: () => void;
  // Append a point to the selected timeline rail (spec/51) — the rail's
  // "Add point" action on the quick-connect "+".
  onAddRailPoint: () => void;
  // Table quick-connect ring (spec/09): append a row / column to the
  // selected table from the bottom / right plus.
  onAddTableRow: () => void;
  onAddTableColumn: () => void;
  // Edit one timeline-rail point's label (spec/51). Omitted in read-only.
  onSetRailLabel?: (elementId: string, index: number, text: string) => void;
  // Default chart slice colours derived from the active theme (spec/53), used
  // by pie charts for slices without an explicit colour.
  chartPalette: readonly string[];
  onBeginEndpointDrag: (arrowId: string, end: ArrowEnd, e: ReactPointerEvent) => void;
  onBeginArrowCurveDrag: (arrowId: string, e: ReactPointerEvent) => void;
  onBeginArrowCurvePointDrag: (arrowId: string, index: number, e: ReactPointerEvent) => void;
  onAddCurvePoint: (arrowId: string, canvasX: number, canvasY: number) => void;
  onDeleteCurvePoint: (arrowId: string, index: number) => void;
  onBeginArrowElbowDrag: (arrowId: string, e: ReactPointerEvent) => void;
  onBeginArrowLabelDrag: (arrowId: string, e: ReactPointerEvent) => void;
  onBeginArrowTranslate: (arrowId: string, e: ReactPointerEvent) => void;
  onShiftSelect: (id: string) => void;
  onBeginFormatPainter: () => void;
  onCancelFormatPainter: () => void;
  // Wrap up the persistent Format canvas tool (the palette tool, not the
  // single-shot painter): drops back to the Select tool. Drives the
  // format-tool mode banner's "Done" button.
  onExitFormatTool: () => void;
  onBeginGroup: () => void;
  onCancelGroup: () => void;
  onUngroup: () => void;
  onFollowLink: (link: import('@livediagram/diagram').ElementLink) => void;
  onOpenComments: (elementId: string) => void;
  // Open the element's assigned-action popover (spec/68). Available in
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
  // Open the link picker for a link-card element (spec/40), on double-click.
  // Omitted for read-only viewers.
  onEditLink?: (id: string) => void;
  // Per-render context for image elements: identity + auth bits the
  // ImageElementView needs to fetch bitmap bytes. Optional so the
  // welcome / new-diagram surface (where Canvas mounts before
  // identity / share-code are settled) can omit it.
  imageContext?: {
    ownerId: string;
    diagramId: string;
    shareCode: string | null;
    onOpenPicker?: (elementId: string) => void;
  };
  // Touch-friendly fallback for right-click: a SelectionPopover
  // ellipsis button opens the same context menu under the cursor.
  onOpenElementContextMenu?: (elementId: string, screenX: number, screenY: number) => void;
  showTemplatePicker: boolean;
  // True after the page has resolved its initial identity + diagram
  // fetch. Used to suppress the empty-state card during the brief
  // window between "loader dropped" and "welcome modal mounted" so
  // a fresh New Diagram doesn't flash the Empty Canvas message.
  hydrated: boolean;
  templatePickerMode: 'welcome' | 'templates' | 'identity';
  // When non-null, the visitor is signed in via Clerk and their
  // display name is fixed to their account name — TemplatePicker
  // locks the input. Only relevant in 'identity' mode; ignored
  // otherwise.
  templatePickerLockedName?: string | null;
  // Hides the floating chrome (palette, explorer, zoom + history dock,
  // plus buttons, selection popover) while the first-run welcome modal
  // is taking the user through identity / template / theme selection.
  // Keeps the canvas surface visible (so the modal isn't floating on a
  // blank page) but free of distracting controls.
  welcomeOpen: boolean;
  selfParticipant: import('@/lib/identity').Participant;
  onChooseTemplate: (
    kind: TemplateKind,
    name: string,
    // string, not ThemeId: the picker can hand back a custom `custom:<uuid>`
    // theme id (spec/44).
    themeId: string,
  ) => void;
  onSkipTemplatePicker: () => void;
  onOpenTemplatePicker: () => void;
  tabThemeId: import('@/lib/themes').ThemeId;
  // Set the active tab's default font (spec/28); null clears it.
  // Set the active tab's default text size for new palette elements.
  // File I/O for the current tab — moved here so the Current Tab
  // section (right-hand inspector) houses them next to theme +
  // canvas, where the user is editing the tab anyway. Optional so
  // welcome-flow surfaces with no tab loaded yet can omit them.
  // "Auto align" cleanup pass on the current tab's elements. See
  // CommandPalette's Cleanup accordion + lib/auto-align.ts.
  // Live session tools (spec/39): the active tab's timer / vote state +
  // the facilitator controls (Tab Settings) and the per-element dot
  // cast/retract used by the canvas vote interaction. State is read off
  // the tab; handlers no-op when edits are blocked.
  tabTimer?: import('@livediagram/diagram').TabTimer;
  tabVote?: import('@livediagram/diagram').TabVote;
  onStartTimer: (mode: import('@livediagram/diagram').TimerMode, durationMs?: number) => void;
  onPauseTimer: () => void;
  onResumeTimer: () => void;
  onResetTimer: () => void;
  onClearTimer: () => void;
  onStartVote: (votesPerPerson: number) => void;
  onEndVote: () => void;
  onRevealVote: () => void;
  onClearVote: () => void;
  onCastVote: (elementId: string) => void;
  onRetractVote: (elementId: string) => void;
  aiPanel?: {
    position: { x: number; y: number } | null;
    onMove: (x: number, y: number) => void;
    onReset: () => void;
    contextElements: Element[];
    focusIds: string[];
    onApplyElements: (elements: Element[], mode: 'clean') => void;
    ownerId: string;
    // The active tab's ID — the conversation-reset key. The NAME must
    // not be the key: renaming a tab would wipe the conversation, and
    // two same-named tabs wouldn't reset on switch (cross-tab history
    // contamination).
    tabId: string;
  };
  // Recent-images list for the Current Tab "Images" accordion (spec/19).
  // Forwarded through to TabSection unchanged.
  onToggleAspectLock: () => void;
  // Quick add + connect (spec/09). The radial ring on each element edge
  // spawns a connected element (Duplicate / Square / Circle), starts an
  // arrow from that side (drag on desktop, tap-target on mobile — the
  // handler branches on the pointer type), or enters freehand draw.
  onSpawnConnect: (direction: QuickConnectDirection, kind: QuickConnectKind) => void;
  // Drag-from-palette drop: a palette tile dropped on the canvas places that
  // element kind centred on the drop point (iconId set for icon tiles).
  onDropPalette?: (kind: ShapeKind, canvasX: number, canvasY: number, iconId?: string) => void;
  onStartArrow: (direction: QuickConnectDirection, e: ReactPointerEvent) => void;
  onStartPencil: () => void;
  onToggleLockSelected: () => void;
  onDeleteSelected: () => void;
  // Duplicate the selected element. Surfaced as a one-click button in
  // the selection toolbar (SelectionPopover); previously context-menu only.
  onDuplicateSelected: () => void;
  onCanvasDoubleClick: (x: number, y: number) => void;
  // Lazy per-tab load (spec/13). While the active tab's content is being
  // fetched ('loading') or after that fetch failed ('error'), Canvas
  // renders a blocking TabLoadOverlay so the user never edits a blank
  // placeholder whose autosave would wipe the real server row. 'ready'
  // (or undefined) renders the canvas normally. `onRetryTabLoad`
  // re-issues the fetch from the error card.
  tabLoadState?: import('@/app/diagram/[id]/editor-page-helpers').TabLoadState;
  onRetryTabLoad?: () => void;
  // Zen / focus mode (spec/26). When true, CanvasChrome hides every
  // floating panel + the history dock + the owner badge, keeping only
  // the canvas content and the zoom controls (which grow an exit
  // button). `onToggleZen` flips it — wired to the palette enter
  // button, the zoom-dock exit button, and the Z shortcut.
  zenMode?: boolean;
  onToggleZen?: () => void;
};
