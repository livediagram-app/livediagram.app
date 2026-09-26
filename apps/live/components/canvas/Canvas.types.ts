// Prop contract for the Canvas component, split out of Canvas.tsx
// (it was a 320-line inline type). Most field types are referenced
// via inline import('...') so this file only needs the bare-named
// types as top-level imports.
import type { PointerEvent as ReactPointerEvent, Ref } from 'react';
import type { EmbedProvider, EsSide, EventStormingNoteKind } from '@livediagram/diagram';
import type {
  AlignmentGuide,
  BackgroundPattern,
  DistributionGuide,
  TabKind,
  Element,
  Layer,
  IconPosition,
  ShapeKind,
  TextAlignX,
  TextAlignY,
  TextRun,
} from '@livediagram/diagram';
import type { ArrowEnd, DragMode, QuickConnectDirection, QuickConnectKind } from '@/lib/canvas';
import type { PendingDraw } from '@/lib/draw-mode';
import type { TemplateKind } from '@livediagram/templates';
import type { UserPreferences } from '@/lib/user-preferences';
import type { ChangeLogEntry, DiagramListItem, Folder, SharedWithItem } from '@/lib/api-client';
import type { TeamFolderHandlers } from '@/components/panels/Explorer.types';
import type { TeamDiagramRow, TeamFolderRow } from '@/hooks/persistence/useTeamLibrariesSweep';
import type { CanvasTool } from '@/components/palette/CommandPalette';
import type { EsBoardControls } from '@/components/palette/EventStormingBoardRows';

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
  // Motion rate for an animated background pattern (docs/specs/008-canvas/canvas-and-palette.md); 1 = normal.
  tabBackgroundAnimationSpeed: number;
  tabPatternColor: string;
  // The active tab's default font id (docs/specs/004-interface-design/fonts.md). Elements without their
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
  // The active tab's raw layers array (docs/specs/006-diagram/layers.md), undefined until the tab
  // materialises one. Drives the band-aware paint order + hidden-layer
  // filtering in CanvasElementsLayer and the Minimap.
  tabLayers?: Layer[];
  // The tab’s board kind (docs/specs/021-event-storming/event-storming.md), which decides whether this canvas
  // presents as an event-storming board.
  tabKind?: TabKind;
  // The tab's timeline lane stack (docs/specs/021-event-storming/event-storming.md Phase 6) when lanes are on, else
  // undefined: a note dragged in from the palette snaps onto it, and the
  // overlay lights the lane it is landing on.
  // Element ids on a hidden or locked layer (docs/specs/006-diagram/layers.md) — inert to every
  // selection surface, including the right-click context menu.
  layerInertIds: Set<string>;
  // Dragged element ids to render translucent while a shift-duplicate is
  // in progress (docs/specs/008-canvas/shift-drag-duplicate.md): the materialised copies already sit at the
  // start position, so the set under the cursor shows as a ghost. Null
  // outside a shift-held move drag.
  shiftDupGhostIds: ReadonlySet<string> | null;
  // Faint alignment guides for the active move / resize drag (the edge
  // / centre lines the dragged element shares with neighbours). Empty
  // when no snap is in effect. Rendered by CanvasChrome. See docs/specs/008-canvas/canvas-and-palette.md.
  snapGuides: AlignmentGuide[];
  // Equal-spacing guides: the gap segments shown when a moved element
  // snaps to even spacing with its neighbours. Rendered by CanvasChrome.
  distGuides: DistributionGuide[];
  // Connection-point markers revealed while dragging an arrow endpoint near
  // a shape, so the user can see exactly where it will snap. Empty otherwise.
  snapTargets: SnapTarget[];
  selectedId: string | null;
  multiSelectedIds: Set<string>;
  onSelectMarquee: (ids: Set<string>) => void;
  canvasTool: CanvasTool;
  onSetCanvasTool: (tool: CanvasTool) => void;
  // Press a Mode Button element (docs/specs/009-elements/mode-button.md): hands the LOCAL participant the
  // mode the element carries. Optional — the read-only embed has no tool picker
  // to drive, so its buttons render inert.
  onPressModeButton?: (element: import('@livediagram/diagram').ShapeElement) => void;
  // Bring Focus (docs/specs/012-collaboration/bring-focus.md): ask everyone else in the room to come and look at
  // this element. Absent on a surface with nobody to ask (an export, a solo
  // board), which renders the face inert.
  onPressFocusButton?: (element: import('@livediagram/diagram').ShapeElement) => void;
  // Session button (docs/specs/012-collaboration/session-button.md): starts the tool the pressed element carries.
  onPressSessionButton?: (element: import('@livediagram/diagram').ShapeElement) => void;
  // True when this viewer can't start session tools (view role): the button
  // renders inert and says why instead of failing silently on press.
  sessionStartBlocked?: boolean;
  // The tab timer's state for the session button's face (docs/specs/012-collaboration/session-button.md).
  timerState?: import('@/components/canvas/SessionButtonFace').TimerState;
  // Reveal zones (docs/specs/009-elements/reveal-zone.md) this viewer has lifted for themselves. Ephemeral
  // and local — the shared state is `revealed` on the element.
  revealedIds?: ReadonlySet<string>;
  onToggleReveal?: (elementId: string) => void;
  // Per-element session settings from the element's own `…` menu (docs/specs/012-collaboration/session-button.md):
  // the timer's length, the vote's dots, the poll's question and answers.
  // Absent on a read-only surface, which renders the menu's trigger not at all.
  // Comment panel (docs/specs/012-collaboration/comment-pin.md): who I am, plus the thread mutators, so a panel
  // shows and edits its thread in place. All keyed by element id, which is how
  // the anchored popover already drives them.
  commentSelfId?: string;
  commentPanelActions?: {
    add: (elementId: string, text: string) => void;
    remove: (elementId: string, commentId: string) => void;
    resolve: (elementId: string) => void;
    unresolve: (elementId: string) => void;
  };
  // Action panel (docs/specs/012-collaboration/action-panel.md): who I am (for "Assigned to you"), plus the
  // docs/specs/012-collaboration/assigned-actions.md action mutators, keyed by element id like everything else that
  // drives an action. Absent on a read-only surface: the card renders inert.
  actionSelfId?: string | null;
  actionPanelActions?: {
    configure: (elementId: string) => void;
    complete: (elementId: string) => void;
    reopen: (elementId: string) => void;
  };
  onSetSessionConfig?: (
    element: import('@livediagram/diagram').ShapeElement,
    config: import('@livediagram/diagram').SessionButtonConfig,
  ) => void;
  // Open an element's own context menu from the `…` on its face, anchored at
  // the trigger's screen position (docs/specs/008-canvas/canvas-and-palette.md). Absent on a read-only surface,
  // where there is nothing to configure.
  onOpenElementSettings?: (elementId: string) => void;
  // Picker (docs/specs/012-collaboration/picker.md): the candidates a roll can land on, and the roll itself.
  // `shared` says whether this viewer's roll is written back (and so reaches
  // the room), which is how the face tells its own landing apart from a peer's.
  onRollPicker?: (element: import('@livediagram/diagram').ShapeElement) => {
    candidates: import('@/lib/picker').PickerCandidate[];
    shared: boolean;
    roll: () => import('@/lib/picker').PickerCandidate | null;
  };
  // The collaboration elements (docs/specs/012-collaboration/estimate-card.md to docs/specs/012-collaboration/roll-call.md): the viewer's identity,
  // the room, and the writes they may make — one prop for all five faces.
  collab?: import('@/components/canvas/collab/CollabFaceRouter').CollabApi;
  // Follow-me (docs/specs/012-collaboration/follow-me-viewport.md): the name of whoever we are following, for the pill,
  // and the way out of it. Null / absent = not following anybody.
  followingName?: string | null;
  onStopFollowing?: () => void;
  // Chair (docs/specs/009-elements/chair.md): who presence says is seated on a given chair.
  chairSitters?: (
    elementId: string,
  ) => import('@/components/canvas/collab/ChairView').ChairSitter[];
  // Portal (docs/specs/009-elements/portal-element.md): resolve a portal's pairing — the paired portal's name and, when
  // it has one, the action that travels there.
  onEnterPortal?: (element: import('@livediagram/diagram').ShapeElement) => {
    targetName: string | null;
    travel?: () => void;
  };
  // Reaction pad (docs/specs/009-elements/reaction-pad.md): set one off. Absent on a read-only surface, which
  // renders the pad inert rather than hiding it.
  onFireReaction?: (element: import('@livediagram/diagram').ShapeElement) => void;
  // The bursts currently playing, keyed by the pad's element id, plus the way
  // to retire one when its animation ends. Ephemeral: never document state.
  reactionBursts?: Map<string, { reaction: import('@livediagram/diagram').Reaction; seed: number }>;
  onReactionBurstDone?: (elementId: string) => void;
  // Leaves Avatar mode (docs/specs/008-canvas/avatar-mode.md) for the tool that preceded it. Wired to the
  // palette (any tile pick) and to a palette drag-drop, both of which are
  // edits the read-only mode would otherwise swallow.
  onExitAvatarMode?: () => void;
  // Avatar Panel placement (docs/specs/008-canvas/avatar-mode.md + docs/specs/007-editor/panel-docking.md). Position is null until the
  // user drags it; the panel itself only exists while the mode is active.
  avatarPanelPosition?: { x: number; y: number } | null;
  onMoveAvatarPanel?: (x: number, y: number) => void;
  onResetAvatarPanel?: () => void;
  // The laser pen (docs/specs/008-canvas/spotlight-panel.md). Owned in editor state, not here: the broadcaster
  // stamps it onto every sample and the trail rows carry it, both of which sit
  // above Canvas — so Canvas forwards it to the panel rather than owning it.
  laserConfig?: import('@/lib/laser-config').LaserConfig;
  onChangeLaserField?: <K extends keyof import('@/lib/laser-config').LaserConfig>(
    field: K,
    value: import('@/lib/laser-config').LaserConfig[K],
  ) => void;
  // Laser Panel (docs/specs/008-canvas/spotlight-panel.md): where it sits, same as the avatar's above.
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
  formatConfig?: import('@/lib/format-config').FormatConfig;
  onToggleFormatGroup?: (group: import('@/lib/format-config').FormatGroup) => void;
  onSetFormatMode?: (mode: import('@/lib/format-config').FormatMode) => void;
  formatBrushSource?: { name: string; fill?: string; stroke?: string; textColor?: string } | null;
  formatPanelPosition?: { x: number; y: number } | null;
  onMoveFormatPanel?: (x: number, y: number) => void;
  onResetFormatPanel?: () => void;
  // Eraser Panel (docs/specs/008-canvas/eraser-panel.md): where it sits.
  eraserPanelPosition?: { x: number; y: number } | null;
  onMoveEraserPanel?: (x: number, y: number) => void;
  onResetEraserPanel?: () => void;
  // Highlighter Panel (docs/specs/008-canvas/highlighter.md): where it sits. Its two settings ride
  // highlighterColor / highlighterWidth below, which already crossed this
  // boundary for the mode banner the panel replaced.
  highlighterPanelPosition?: { x: number; y: number } | null;
  onMoveHighlighterPanel?: (x: number, y: number) => void;
  onResetHighlighterPanel?: () => void;
  // Slide Deck panel (docs/specs/012-collaboration/presentation-mode.md): the deck builder, present only while its tool
  // is picked. The deck itself rides `slideDeck`.
  slideDeckPanelPosition?: { x: number; y: number } | null;
  onMoveSlideDeckPanel?: (x: number, y: number) => void;
  onResetSlideDeckPanel?: () => void;
  slideDeck?: import('@/app/diagram/[id]/useSlideDeck').SlideDeckState;
  // Map of elementId -> remote participants currently focused on that
  // element. Drives a small badge ring on each element so participants
  // can see in real time what others are working on.
  remoteSelectionsByElement: Map<string, { id: string; name: string; color: string }[]>;
  // Live cursor positions for remote participants — canvas-coords +
  // participant identity. Rendered inside the transformed wrapper so
  // they pan and zoom with the canvas.
  remoteCursors: { id: string; name: string; color: string; x: number; y: number }[];
  // Peers' Avatar-mode characters (docs/specs/008-canvas/avatar-mode.md) on the active tab, with their
  // name + presence colour. Rendered inside the transformed wrapper beside the
  // local character, so everyone sees everyone walking around.
  remoteAvatars: {
    id: string;
    name: string;
    color: string;
    avatar: import('@livediagram/api-schema').AvatarPresence;
  }[];
  // Publishes the local character to the room (null when leaving the mode).
  // Optional: a private, un-shared diagram has no room to publish to.
  onAvatarPresence?: (avatar: import('@livediagram/api-schema').AvatarPresence | null) => void;
  // Shove a peer's character (docs/specs/008-canvas/avatar-mode.md): sent when our character finishes
  // walking up to the one we clicked. Optional — no room, no push.
  onAvatarPush?: (targetId: string, dx: number, dy: number) => void;
  // A shove somebody sent US, as a direction plus a sequence number so the same
  // push isn't replayed on every render. Null until someone pushes.
  avatarShove?: { dx: number; dy: number; seq: number } | null;
  // Laser-pointer trails for the LaserOverlay — local user first
  // followed by any peers laser-pointing on the active tab. The
  // overlay handles fading and cleanup; Canvas just renders.
  laserTrails: {
    participantId: string;
    color: string;
    points: { x: number; y: number; t: number }[];
  }[];
  // `target` is what the pointer is over, so a paste can tell the canvas from
  // a floating panel lying on top of it (lib/canvas-pointer.ts).
  onCanvasPointerMove: (
    canvasX: number | null,
    canvasY: number | null,
    target?: EventTarget | null,
  ) => void;
  onDuplicateMultiSelected: () => void;
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
  palettePosition: { x: number; y: number } | null;
  explorerPosition: { x: number; y: number } | null;
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
  // Optional fill + kind: an Event Storming note (docs/specs/021-event-storming/event-storming.md).
  onAddSticky: (fill?: string, esKind?: EventStormingNoteKind) => void;
  // True when the active tab is an event-storming board (docs/specs/021-event-storming/event-storming.md) — the
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
  // True when a new element cannot land at all: a locked tab, a view-only
  // session, or a hidden / locked active layer (docs/specs/006-diagram/layers.md). The insert-between
  // preview reads it so it never offers a slot the drop would refuse.
  createBlocked?: boolean;
  // Spawn an empty image placeholder + open the picker. Optional so
  // view-role visitors / no-R2 deployments can simply omit it; the
  // Palette's Image entry hides when missing (docs/specs/009-elements/images.md).
  onAddImage?: () => void;
  onAddArrow: () => void;
  onBeginFreehand: () => void;
  // Highlighter variant of the pencil (docs/specs/008-canvas/highlighter.md) + the polygon
  // click-to-place tool (docs/specs/008-canvas/polygon-tool.md), armed from the palette tiles.
  onBeginShapePen: () => void;
  onBeginPolygon: () => void;
  // Highlighter banner settings (docs/specs/008-canvas/highlighter.md): the colour + stroke width the
  // next marker strokes commit with, plus their setters for the banner's
  // two popovers. Session-local editor state, not a persisted preference.
  highlighterColor: string;
  highlighterWidth: number;
  onSetHighlighterColor: (color: string) => void;
  onSetHighlighterWidth: (width: number) => void;
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
  // preference — the toggle that used to set it is gone.
  onCommitFreehand: (points: { x: number; y: number }[], recogniseShapes: boolean) => void;
  // Polygon commit (docs/specs/008-canvas/polygon-tool.md). Receives the deliberately clicked
  // vertices in canvas coords (no simplification — the user placed
  // each one) plus whether the loop closed on the start vertex.
  onCommitPolygon: (vertices: { x: number; y: number }[], closed: boolean) => void;
  // Minimal panel layout preference (docs/specs/007-editor/user-preferences.md). When true, the floating
  // panels render as dock popovers on desktop too (always on mobile).
  minimalPanels?: boolean;
  // Toolbar layout (docs/specs/007-editor/toolbar-layout.md): the Palette as a top strip and a menu button
  // in place of the Explorer. Implies `minimalPanels` for every other panel.
  // Desktop only; the chrome falls back to the mobile dock below `sm`.
  toolbarLayout?: boolean;
  // Toggle the minimal-panel layout. Surfaced in the Palette header
  // (desktop) as the one-click normal <-> minimal switch.
  onToggleMinimalPanels?: () => void;
  // Lifted user preferences + a write-through setter, forwarded to the
  // Palette settings popover (docs/specs/007-editor/user-preferences.md). Holds the canvas-behaviour
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
  // tooltip can name the tab/element a link points at (docs/specs/008-canvas/canvas-and-palette.md). Kept
  // minimal + memoised by the caller so element edits don't churn it.
  tabSummaries: { id: string; name: string }[];
  // Portals (docs/specs/009-elements/portal-element.md) link ACROSS tabs, so the canvas needs every tab's
  // elements to resolve where one leads, plus which tab is showing. Optional so
  // read-only / embed mounts that never travel can omit them.
  portalTabs?: import('@livediagram/diagram').Tab[];
  activeTabId?: string;
  folders: Folder[];
  // Shared-with-you list. Empty by default so legacy callers can
  // omit it.
  sharedDiagrams?: SharedWithItem[];
  onDismissShared?: (diagramId: string) => void;
  // Teams the signed-in user belongs to + their swept libraries
  // (docs/specs/013-workspace/team-shared-diagrams.md), forwarded to the floating Explorer panel for its Teams
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
  // Map panel (docs/specs/008-canvas/minimap.md) position + move/reset, shared with the other panels.
  mapPosition: { x: number; y: number } | null;
  onMoveMap: (x: number, y: number) => void;
  onResetMap: () => void;
  onMoveActivity: (x: number, y: number) => void;
  onToggleActivityMinimized: () => void;
  onResetActivity: () => void;
  // Layers panel (docs/specs/006-diagram/layers.md). `layers` is the NORMALISED stack (bottom ->
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
  // Live poll (docs/specs/012-collaboration/live-poll.md). The panel exists only while a poll is running,
  // so `poll` null means it isn't rendered at all — there is no minimised
  // state to keep, unlike Layers / Activity.
  pollPanel: {
    poll: import('@livediagram/api-schema').LivePoll;
    answers: Map<string, string | null>;
    isHost: boolean;
    onEnd: () => void;
    // Keep the tallies so far on the canvas as a chart, without ending the
    // poll (docs/specs/012-collaboration/poll-result-capture.md). Absent for a viewer who can't add elements.
    onKeepResults?: () => void;
    onDismiss: () => void;
  } | null;
  pollPanelPosition: { x: number; y: number } | null;
  onMovePollPanel: (x: number, y: number) => void;
  onResetPollPanel: () => void;
  // Live vote panel (docs/specs/012-collaboration/session-tools.md): turnout while casting is open, then the
  // clickable ranked results. Null when no vote is running on this tab.
  // Per-user preferences (docs/specs/007-editor/user-preferences.md) + the Recent exclusion toggle
  // (docs/specs/013-workspace/hide-from-recent.md), for the Explorer panel's Recent list.
  userPreferences: import('@/lib/user-preferences').UserPreferences;
  onToggleRecentExclusion: (diagramId: string) => void;
  // Per-user stars (docs/specs/013-workspace/favourites.md).
  favouriteIds: Set<string>;
  onToggleFavourite: (diagramId: string) => void;
  votePanelPosition: { x: number; y: number } | null;
  onMoveVotePanel: (x: number, y: number) => void;
  onResetVotePanel: () => void;
  voteResults: { id: string; votes: number }[];
  onJumpToVoteResult: (index: number) => void;
  // Whether the local participant started the running vote — the only
  // one who may end / reveal / clear it or move the results focus.
  isVoteHost: boolean;
  // Everyone in the room right now (remote presence + you), the turnout
  // denominator.
  participantCount: number;
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
  // Hover-to-solo (docs/specs/006-diagram/layers.md): while set, the canvas renders ONLY this
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
  // Floating Actions panel (docs/specs/012-collaboration/assigned-actions.md). Mirrors the Comments panel: only
  // mounted when actionRows is non-empty (at least one OPEN action on
  // the active tab).
  actionRows: import('@/components/panels/CollaboratePanel').ActionRow[];
  // Row click: editor selects the element + opens its action popover.
  onOpenActionForElement: (elementId: string) => void;
  onRevertChange: (entry: ChangeLogEntry) => void;
  // Hover-to-preview for a row's Revert (docs/specs/012-collaboration/activity-and-audit.md): enter shows the
  // revert result live on the canvas, leave restores. Nothing commits.
  onPreviewRevert: (entry: ChangeLogEntry) => void;
  onClearRevertPreview: () => void;
  onActivityRowClick: (entry: ChangeLogEntry) => void;
  onClearActivity?: () => void;
  saveStatus: import('@/components/chrome/EditorHeader').SaveStatus;
  savedAt: number | null;
  currentDiagramId: string | null;
  onOpenDiagram: (id: string, shareCode?: string) => void;
  onNewDiagram: () => void;
  // The Explorer panel's ⋯ menu verbs beyond new / open (docs/specs/013-workspace/folders.md).
  explorerMenuActions?: import('@/components/panels/Explorer.types').ExplorerMenuActions;
  onRenameCurrent: (name: string) => void;
  onDeleteDiagram: (id: string) => void;
  onDuplicateDiagram: (id: string) => void;
  onCreateFolder: (input: { name: string; parentId: string | null }) => Promise<Folder | void>;
  onRenameFolder: (id: string, name: string) => void;
  onDeleteFolder: (id: string) => void;
  // Team-library folder mutations for the Explorer panel's team tree
  // (docs/specs/013-workspace/team-shared-diagrams.md); absent while signed out or without teams.
  onTeamFolders?: TeamFolderHandlers;
  onMoveDiagramToFolder: (diagramId: string, folderId: string | null) => void;
  // Scope-crossing move (docs/specs/013-workspace/team-shared-diagrams.md): the Explorer panel's move picker routes
  // any pick that involves a team (either side) here — re-folder within a
  // team, personal -> team, or team -> personal.
  onMoveDiagramTo?: (
    diagramId: string,
    dest: { teamId: string | null; folderId: string | null },
    // Where the diagram is coming from (null = the personal tree), so a
    // personal -> team move counts as Team·Added·Diagram (docs/specs/017-telemetry/telemetry.md).
    fromTeamId?: string | null,
  ) => void;
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
  onBeginEdit: (id: string) => void;
  onCommitLabel: (id: string, label: string, runs?: TextRun[]) => void;
  // Inline label-editor (rich-text) alignment control, threaded through
  // CanvasElementsLayer to the in-place editor on the selected element.
  onSetTextAlign: (x: TextAlignX, y: TextAlignY) => void;
  // Single combined table commit (cells + the parallel colWidths /
  // rowHeights / cellStyles arrays) applied in ONE commit, so structural
  // ops can't drop a side array or clobber each other off a stale base.
  // A lane's title gutter, resized by dragging its seam (docs/specs/009-elements/lane.md). One
  // commit per gesture, so a drag is one undo step.
  onCommitHeaderSize?: (elementId: string, px: number) => void;
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
  // Append a point to the selected timeline rail (docs/specs/009-elements/timeline-rail.md) — the rail's
  // "Add point" action on the quick-connect "+".
  onAddRailPoint: () => void;
  // Table quick-connect ring (docs/specs/008-canvas/canvas-and-palette.md): append a row / column to the
  // selected table from the bottom / right plus.
  onAddTableRow: () => void;
  onAddTableColumn: () => void;
  // Edit one timeline-rail point's label (docs/specs/009-elements/timeline-rail.md). Omitted in read-only.
  onSetRailLabel?: (elementId: string, index: number, text: string) => void;
  // Toggle one checklist row's done state (docs/specs/009-elements/checklist.md). Omitted in read-only.
  onToggleChecklistItem?: (elementId: string, index: number) => void;
  // The Page masthead (docs/specs/009-elements/page-element.md): its heading and subtitle are their own
  // fields, so they commit through here rather than the label editor.
  // Mind map (docs/specs/009-elements/mind-node.md): grows the next node from the label editor.
  onGrowMindNode: (id: string, kind: 'child' | 'sibling') => void;
  onSetPageHeading: (elementId: string, field: 'pageTitle' | 'pageSubtitle', value: string) => void;
  // The web components (docs/specs/009-elements/web-components-and-no-groups.md): a row edited in place, one more row from
  // the quick-connect ring, and a hero's caption line. Omitted in read-only.
  onSetWebRows?: (elementId: string, rows: import('@livediagram/diagram').WebRows) => void;
  onAppendWebRow?: (elementId: string) => void;
  onSetHeroCaptionLine?: (
    elementId: string,
    field: keyof import('@livediagram/diagram').HeroCaption,
    value: string,
  ) => void;
  // Default chart slice colours derived from the active theme (docs/specs/009-elements/pie-chart.md), used
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
  onFollowLink: (link: import('@livediagram/diagram').ElementLink) => void;
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
  // Open the code edit dialog for a code-block shape (docs/specs/009-elements/code-block.md), on
  // double-click. Omitted for read-only viewers.
  onEditCode?: (id: string) => void;
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
    // theme id (docs/specs/011-theme/custom-themes.md).
    themeId: string,
  ) => void;
  onSkipTemplatePicker: () => void;
  onOpenTemplatePicker: () => void;
  tabThemeId: import('@/lib/themes').ThemeId;
  // Set the active tab's default font (docs/specs/004-interface-design/fonts.md); null clears it.
  // Set the active tab's default text size for new palette elements.
  // File I/O for the current tab — moved here so the Current Tab
  // section (right-hand inspector) houses them next to theme +
  // canvas, where the user is editing the tab anyway. Optional so
  // welcome-flow surfaces with no tab loaded yet can omit them.
  // "Auto align" cleanup pass on the current tab's elements. See
  // CommandPalette's Cleanup accordion + lib/auto-align.ts.
  // Live session tools (docs/specs/012-collaboration/session-tools.md): the active tab's timer / vote state +
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
  // Change a running / paused countdown's length, restarting it at the new
  // one (docs/specs/012-collaboration/session-button.md). Driven by the Timer element's own `…` menu.
  onSetTimerDuration?: (durationMs: number) => void;
  onStartVote: (votesPerPerson: number, privacy?: import('@livediagram/diagram').VoteSetup) => void;
  onEndVote: () => void;
  onRevealVote: () => void;
  onClearVote: () => void;
  onCastVote: (elementId: string) => void;
  onRetractVote: (elementId: string) => void;
  // Vote-results walkthrough (docs/specs/012-collaboration/session-tools.md): the currently-reviewed top pick
  // (pulsed on the canvas, described in the vote banner) and the banner's
  // Previous / Next / Done controls. Null when not reviewing.
  voteReview: import('@/hooks/canvas/useVoteReview').VoteReview | null;
  onNextVoteResult: () => void;
  onPrevVoteResult: () => void;
  onDoneVoteReview: () => void;
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
  // Intra-LAYER z-order from the selection popover (docs/specs/006-diagram/layers.md): stack the
  // selection within its own band, never between layers.
  onBringSelectedToFront: () => void;
  onSendSelectedToBack: () => void;
  onCanvasDoubleClick: (x: number, y: number) => void;
  // Lazy per-tab load (docs/specs/006-diagram/per-tab-storage.md). While the active tab's content is being
  // fetched ('loading') or after that fetch failed ('error'), Canvas
  // renders a blocking TabLoadOverlay so the user never edits a blank
  // placeholder whose autosave would wipe the real server row. 'ready'
  // (or undefined) renders the canvas normally. `onRetryTabLoad`
  // re-issues the fetch from the error card.
  tabLoadState?: import('@/app/diagram/[id]/editor-page-helpers').TabLoadState;
  onRetryTabLoad?: () => void;
  // Zen / focus mode (docs/specs/007-editor/zen-mode.md). When true, CanvasChrome hides every
  // floating panel + the history dock + the owner badge, keeping only
  // the canvas content and the zoom controls (which grow an exit
  // button). `onToggleZen` flips it — wired to the palette enter
  // button, the zoom-dock exit button, and the Z shortcut.
  zenMode?: boolean;
  onToggleZen?: () => void;
};
