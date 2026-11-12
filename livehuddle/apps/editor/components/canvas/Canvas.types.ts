import type { SnapGuideStore } from '@/hooks/canvas/useSnapGuideState';
import type { RemoteSelector } from '@/lib/presence-rows';
import type { Dispatch, SetStateAction } from 'react';
// Prop contract for the Canvas component, split out of Canvas.tsx
// (it was a 320-line inline type). Most field types are referenced
// via inline import('...') so this file only needs the bare-named
// types as top-level imports.
import type { PointerEvent as ReactPointerEvent, Ref } from 'react';
import type { Finish } from '@livehuddle/document';
import type {
  BackgroundPattern,
  Element,
  ShapeKind,
  TextAlignX,
  TextAlignY,
  TextRun,
} from '@livehuddle/document';
import type { DragMode } from '@/lib/canvas';
import type { PendingDraw } from '@/lib/draw-mode';
import type { UserPreferences } from '@/lib/user-preferences';
import type { CanvasTool } from '@/components/palette/palette.types';

// A snap marker drawn by CanvasChrome: a world-space point, with `active` set on the one in use.
export type SnapTarget = { x: number; y: number; active: boolean };

export type CanvasProps = {
  tabName: string;
  // True for a view-only ('view' share role) session: the editing chrome
  // (palette, selection + multi-select toolbars) is suppressed.
  readOnly: boolean;
  // A read-only session that still takes part (a Participant): it comments, reacts and speaks
  // (docs/specs/013-workspace/share-roles.md).
  takePart?: boolean;
  // The session's level and whether it always walks (`can.level`, `can.alwaysWalks`): which palette strip it gets
  // (lib/avatar-palette `stripPaletteFor`, docs/specs/008-canvas/avatar-mode.md "The avatar palette").
  accessLevel?: import('@/lib/editor-capabilities').EditorCapabilities['level'];
  alwaysWalks?: boolean;
  // An Editor: may share a screen in a call (docs/specs/012-collaboration/video-and-screen-bubbles.md "Share roles").
  canShareScreen?: boolean;
  // Which elements a read-only session may still drag (a Participant's stickies and its own adds); absent, none.
  canMove?: (el: Element) => boolean;
  // Which elements a read-only session may still resize (a Participant's); absent, none.
  canResize?: (el: Element) => boolean;
  documentName: string;
  tabBackgroundPattern: BackgroundPattern;
  tabBackgroundColor: string;
  tabBackgroundOpacity: number;
  // Pattern tile scale (the canvas pattern-size slider); defaults to 1.
  tabBackgroundPatternScale: number;
  tabPatternColor: string;
  // The active tab's default font id (docs/specs/004-interface-design/fonts.md). Elements without their
  // own `font` render in this; undefined = the editor default. Used by
  // the inline label editor (CanvasElementsLayer) for font inheritance.
  tabFont?: string;
  // The tab's finish (docs/specs/008-canvas/finish.md); undefined is Flexible.
  tabFinish?: Finish;
  // One element as the canvas draws `elements` (the host's stock-colour projector): an element a drag adds is drawn
  // through it, so a copy in hand looks as it will once dropped (docs/specs/008-canvas/drag-preview.md "A dragged
  // element keeps its look"). Absent, an added element is drawn as stored.
  projectElement?: (el: Element) => Element;
  mainRef: Ref<HTMLElement>;
  setViewportOffset: (offset: { x: number; y: number }) => void;
  // The view itself is not a prop: it lives in the viewport store, read where it shows
  // (docs/specs/008-canvas/blueprints/viewport-store.md "Inside the canvas").
  setViewportZoom: Dispatch<SetStateAction<number>>;
  onFitToScreen: () => void;
  isPinchingRef?: React.RefObject<boolean>;
  elements: Element[];
  // Dragged element ids to render translucent while a shift-duplicate is
  // in progress (docs/specs/008-canvas/shift-drag-duplicate.md): the materialised copies already sit at the
  // start position, so the set under the cursor shows as a ghost. Null
  // outside a shift-held move drag.
  shiftDupGhostIds: ReadonlySet<string> | null;
  // The active move / resize drag's snap guides (alignment lines, equal-spacing gaps; see docs/specs/008-canvas/canvas-and-palette.md), in the editor's store. Only CanvasChrome,
  // which draws them, reads it, so a new set renders the chrome and not the canvas.
  snapGuideStore: SnapGuideStore;
  onSelectMarquee: (ids: Set<string>) => void;
  canvasTool: CanvasTool;
  onSetCanvasTool: (tool: CanvasTool) => void;
  // Press a Mode Button element (docs/specs/009-elements/mode-button.md): hands the LOCAL participant the
  // mode the element carries. Optional — the read-only embed has no tool picker
  // to drive, so its buttons render inert.
  onPressModeButton?: (element: import('@livehuddle/document').ShapeElement) => void;
  // Bring Focus (docs/specs/012-collaboration/bring-focus.md): ask everyone else in the room to come and look at
  // this element. Absent on a surface with nobody to ask (an export, a solo
  // canvas), which renders the face inert.
  onPressFocusButton?: (element: import('@livehuddle/document').ShapeElement) => void;
  // Open an element's own context menu from the `…` on its face, anchored at
  // the trigger's screen position (docs/specs/008-canvas/canvas-and-palette.md). Absent on a read-only surface,
  // where there is nothing to configure.
  onOpenElementSettings?: (elementId: string) => void;
  // Follow-me (docs/specs/012-collaboration/follow-me-viewport.md): the name of whoever we are following, for the pill,
  // and the way out of it. Null / absent = not following anybody.
  followingName?: string | null;
  onStopFollowing?: () => void;
  // Chair (docs/specs/009-elements/chair.md): who presence says is seated on a given chair.
  chairSitters?: (
    elementId: string,
  ) => import('@/components/canvas/collab/FurnitureView').ChairSitter[];
  // Portal (docs/specs/009-elements/portal-element.md): resolve a portal's pairing — the paired portal's name and, when
  // it has one, the action that travels there.
  onEnterPortal?: (element: import('@livehuddle/document').ShapeElement) => {
    targetName: string | null;
    travel?: () => void;
    // The Directory and the Elevator (docs/specs/009-elements/directory.md, elevator.md) read the canvas's
    // wayfinding through the same resolver: set for those two kinds, the same object every call.
    wayfinding?: import('@/components/canvas/wayfinding/wayfinding-store').Wayfinding;
  };
  // Avatar Pad (docs/specs/009-elements/avatar-pad.md "Pressing it"): a click on a pad starts Avatar mode, on that pad.
  onPressAvatarPad?: (element: import('@livehuddle/document').ShapeElement) => void;
  // Enters Avatar mode as the Avatar pick does, for the Directory's Walk There and a ride's arrival
  // (docs/specs/009-elements/directory.md, elevator.md). A no-op while already in it.
  onEnterAvatarMode?: () => void;
  // Switches tab as travel (a Portal, an Elevator, the Directory's Go): through the tab-link path, keeping Avatar mode
  // (docs/specs/008-canvas/avatar-mode.md "Changing tab"). Absent, travel follows the tab link and the mode ends.
  onTravelToTab?: (tabId: string) => void;
  // The tab bar's people on each tab, for the Directory's other floors (docs/specs/009-elements/directory.md).
  tabPresence?: ReadonlyMap<string, readonly { id: string; name: string; color: string }[]>;
  // Leaves Avatar mode (docs/specs/008-canvas/avatar-mode.md) for the tool that preceded it. Wired to the
  // palette (any tile pick) and to a palette drag-drop, both of which are
  // edits the read-only mode would otherwise swallow.
  onExitAvatarMode?: () => void;
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
  // Map of elementId -> remote participants currently focused on that
  // element. Drives a small badge ring on each element so participants
  // can see in real time what others are working on.
  remoteSelectionsByElement: Map<string, RemoteSelector[]>;
  // Peers' live cursors and Avatar-mode characters (docs/specs/008-canvas/avatar-mode.md), as a store the canvas
  // subscribes to where it draws them (hooks/collab/usePeerRows), joined with their name + presence colour and
  // kept to the active tab. Drawn inside the transformed wrapper so they pan and zoom with the canvas. A frame of
  // their movement renders the cursor layer and the canvas, not the editor (canvas-performance.md).
  peers: import('@/lib/peer-motion').PeerRowsSource;
  // Publishes the local character to the room (null when leaving the mode).
  // Optional: a private, un-shared document has no room to publish to.
  onAvatarPresence?: (avatar: import('@livehuddle/api-schema').AvatarPresence | null) => void;
  // How many other people are in the room (the roster, yourself not counted): the standing heartbeat rests
  // while it is 0 (docs/specs/008-canvas/avatar-mode.md "Realtime"). Unset keeps the plain heartbeat.
  avatarPeers?: number;
  // Shove a peer's character (docs/specs/008-canvas/avatar-mode.md): sent when our character finishes
  // walking up to the one we clicked. Optional — no room, no push.
  onAvatarPush?: (targetId: string, dx: number, dy: number) => void;
  // Swing a Door open or shut (docs/specs/009-elements/room-builder.md "Opening and closing"): a walking click on one
  // next to the character. True when it swung; false when the viewer may not (a Viewer), and the click walks instead.
  onToggleDoor?: (doorId: string) => boolean;
  // Say something (docs/specs/008-canvas/avatar-mode.md "Speech bubbles"): sends one message to the room.
  // Optional: with no room the bubble is still drawn for you.
  onAvatarSay?: (say: { id: string; text: string; x: number; y: number }) => void;
  // Proximity audio (docs/specs/012-collaboration/proximity-audio.md): sends a talking level or this browser's
  // microphone locator to the room. Absent without a room, which keeps the audio controls away.
  onCallSignal?: (signal: import('@/lib/calls/proximity-call').CallSignal) => void;
  // A shove somebody sent US, as a direction plus a sequence number so the same
  // push isn't replayed on every render. Null until someone pushes.
  avatarShove?: { dx: number; dy: number; seq: number } | null;
  // Opening walking (docs/specs/008-canvas/avatar-mode.md "Opening walking"): where the character starts on a tab
  // whose way in is a Walk In button, sequenced so each opening is a fresh request. Null until a tab opens walking.
  walkIn?: import('@/app/document/[id]/useOpenWalking').WalkIn | null;
  // Avatar mode's camera (docs/specs/008-canvas/avatar-mode.md "The camera"): the canvas hands the editor a reader
  // of the character's live feet, for Fit, entering the mode and the zoom anchor.
  avatarAtRef?: import('@/hooks/canvas/useAvatarCamera').AvatarAtRef;
  // The Edit | Walk toggle (docs/specs/008-canvas/avatar-mode.md "The Edit | Walk toggle"), an Editor's: on where the
  // surface walks and the session may leave the walk, off in an embed and for a session held walking.
  walkToggle?: boolean;
  // `target` is what the pointer is over, so a paste can tell the canvas from
  // a floating panel lying on top of it (@liveworkspace/workbench/lib/canvas-pointer.ts).
  onCanvasPointerMove: (
    canvasX: number | null,
    canvasY: number | null,
    target?: EventTarget | null,
  ) => void;
  onDuplicateMultiSelected: () => void;
  onDeleteMultiSelected: () => void;
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
  // Sticker (docs/specs/010-palette/stickers.md): its own kind, its own handler.
  onAddSticker: (stickerId: string) => void;
  onAddLinkCard: () => void;
  // Composite "Components" (docs/specs/008-canvas/canvas-and-palette.md), dropped at the viewport centre. Hero /
  // Header / Avatar carry an image and open the picker on drop.
  onAddAvatar: () => void;
  onAddText: () => void;
  onAddSticky: () => void;
  // Any other file dropped on the canvas, at its canvas point: told why it does not land (useClipboard
  // dropBoardFile). Absent in a read-only session.
  onDropFile?: (file: File, at: { x: number; y: number }) => void;
  // Spawn an empty image placeholder + open the picker. Optional so
  // view-role visitors / no-R2 deployments can simply omit it; the
  // Palette's Image entry hides when missing (docs/specs/009-elements/images.md).
  onAddImage?: () => void;
  // The Room Builder (docs/specs/009-elements/room-builder.md): arms the room-walls gesture.
  onBeginRoomWalls?: () => void;
  // Draw-to-size mode. Picking a palette element
  // (docs/specs/008-canvas/canvas-and-palette.md "Placement on add") stashes the intent here; the canvas then
  // enters a drag-to-define gesture. pointer-up calls onCommitDraw with the start + end
  // canvas-coord points (raw, no axis swap) so the editor can decide
  // how to interpret them per intent: box intents floor to a 16px
  // minimum and convert to top-left + width/height. onCancelDraw backs the Cancel
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
  // The Room Builder's commit (docs/specs/009-elements/room-builder.md): the corners placed, closed into a room.
  onCommitRoomWalls?: (corners: { x: number; y: number }[]) => void;
  // The user preferences (docs/specs/007-editor/user-preferences.md) the chrome reads.
  settings: UserPreferences;
  onCancelDraw: () => void;
  onUndo: () => void;
  onRedo: () => void;
  // Lightweight id + name of this document's tabs, so a link badge's
  // hover card can name the tab/element a link points at (docs/specs/008-canvas/canvas-and-palette.md). Kept
  // minimal + memoised by the caller so element edits don't churn it.
  tabSummaries: { id: string; name: string }[];
  // Portals (docs/specs/009-elements/portal-element.md) link ACROSS tabs, so the canvas needs every tab's
  // elements to resolve where one leads, plus which tab is showing. Optional so
  // read-only / embed mounts that never travel can omit them.
  portalTabs?: import('@livehuddle/document').Tab[];
  // Which of portalTabs have their content (lazy tabs, docs/specs/006-document/per-tab-storage.md), and the fetch of
  // the rest, which the Elevator panel asks for on opening (docs/specs/009-elements/elevator.md "The panel").
  portalTabsLoaded?: ReadonlySet<string>;
  onLoadPortalTabs?: () => void;
  activeTabId?: string;
  // False while the active tab's content is still on its way (a tab never opened before): its elements arrive with
  // the board once it lands, not as additions. Omitted, the tab is loaded.
  activeTabLoaded?: boolean;
  // Map panel (docs/specs/008-canvas/minimap.md) position + move/reset, shared with the other panels.
  mapPosition: { x: number; y: number } | null;
  onMoveMap: (x: number, y: number) => void;
  onResetMap: () => void;
  // Per-user preferences (docs/specs/007-editor/user-preferences.md): where Contents sits, among others.
  userPreferences: UserPreferences;

  // Bottom-dock "Theme & canvas" button (docs/specs/011-theme/canvas-and-theme-dialog.md): opens the
  // CanvasThemeDialog. Omitted in read-only / embed sessions (no button).
  onOpenCanvasTheme?: () => void;
  currentDocumentId: string | null;
  // The link this session came in on, so the Explorer panel reads the open document as the link allows.
  currentShareCode?: string | null;
  // The open document renamed from the Explorer panel: the editor's title follows at once.
  onRenameCurrentDocument?: (name: string) => void;
  onNewDocument: () => void;
  // The Explorer panel's ⋯ menu verbs beyond new / open (docs/specs/013-workspace/folders.md).
  explorerMenuActions?: import('@/components/panels/Explorer.types').ExplorerMenuActions;
  onDeselect: () => void;
  onSelect: (id: string) => void;
  // Right-click on the canvas background. Receives the cursor's
  // screen coords so the caller can open a "current tab" context
  // menu anchored under it. Distinct from element right-clicks
  // (those go through BoxedElementView's onContextSelect).
  onCanvasContextMenu?: (screenX: number, screenY: number) => void;
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
  // The armed action a press on an element takes instead of selecting it (the format painter): true when it took it. For a touch press that panned instead of dragging, whose tap
  // must still paint (docs/specs/008-canvas/canvas-and-palette.md "Touch (iOS / iPad)").
  onPressArmedAction?: (id: string) => boolean;
  onBeginEdit: (id: string) => void;
  onCommitLabel: (id: string, label: string, runs?: TextRun[]) => void;
  // Inline label-editor (rich-text) alignment control, threaded through
  // CanvasElementsLayer to the in-place editor on the selected element.
  onSetTextAlign: (x: TextAlignX, y: TextAlignY) => void;
  onCancelEdit: () => void;
  // Delete a retired element from its placeholder (docs/specs/002-project-scope/not-in-livehuddle.md "Deleting it").
  // An Editor's alone: omitted in read-only.
  onDeleteRetired?: (elementId: string) => void;
  onShiftSelect: (id: string) => void;
  // Wrap up the Format canvas tool (the palette tool): drops back to the
  // tool active before it. Drives the format-tool mode banner's "Done" button.
  onExitFormatTool: () => void;
  // The selection toolbar's Format Painter: the painter on, `id` loaded as its brush. Absent where it may not paint.
  onStartFormatPainter?: (id: string) => void;
  onFollowLink: (link: import('@livehuddle/document').ElementLink) => void;
  // Open the link picker for a link-card element (docs/specs/009-elements/link-cards.md), on double-click.
  // Omitted for read-only viewers.
  onEditLink?: (id: string) => void;
  // Per-render context for image elements: identity + auth bits the
  // ImageElementView needs to fetch bitmap bytes. Optional so the
  // welcome / new-document surface (where Canvas mounts before
  // identity / share-code are settled) can omit it.
  imageContext?: {
    ownerId: string;
    documentId: string;
    shareCode: string | null;
    onOpenPicker?: (elementId: string) => void;
  };
  // Touch-friendly fallback for right-click: a SelectionPopover
  // ellipsis button opens the same context menu under the cursor.
  onOpenElementContextMenu?: (elementId: string, screenX: number, screenY: number) => void;
  // The visitor name prompt (IdentityPrompt).
  showIdentityPrompt: boolean;
  // True after the page has resolved its initial identity + document
  // fetch. Used to suppress the empty-state card during the brief
  // window between "loader dropped" and "welcome modal mounted" so
  // a fresh New Document doesn't flash the Empty Canvas message.
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
  onDeleteSelected: () => void;
  // Duplicate the selected element. Surfaced as a one-click button in
  // the selection toolbar (SelectionPopover); previously context-menu only.
  // True while an element context menu is open, so the selection popover
  // can stand down (one gesture, one answer).
  elementMenuOpen?: boolean;
  onDuplicateSelected: () => void;
  // Intra-LAYER z-order from the selection popover (docs/specs/006-document/layers.md): stack the
  // selection within its own band, never between layers.
  onBringSelectedToFront: () => void;
  onSendSelectedToBack: () => void;
  // A quarter turn of every piece of furniture in the selection (docs/specs/009-elements/furniture-facing.md "Turning
  // a placed piece"): +1 clockwise, -1 anticlockwise.
  onTurnSelected?: (quarters: 1 | -1) => void;
  onCanvasDoubleClick: (x: number, y: number) => void;
  // Lazy per-tab load (docs/specs/006-document/per-tab-storage.md). While the active tab's content is being
  // fetched ('loading') or after that fetch failed ('error'), Canvas
  // renders a blocking TabLoadOverlay so the user never edits a blank
  // placeholder whose autosave would wipe the real server row. 'ready'
  // (or undefined) renders the canvas normally. `onRetryTabLoad`
  // re-issues the fetch from the error card.
  tabLoadState?: import('@/app/document/[id]/editor-page-helpers').TabLoadState;
  onRetryTabLoad?: () => void;
  // An embed (docs/specs/013-workspace/embeds.md): CanvasChrome hides every floating panel, the history dock and
  // the owner badge, keeping only the canvas content and the zoom controls.
  chromeAway?: boolean;
  // No Explorer: neither the floating panel nor the Toolbar layout's menu button (a phone held sideways).
  explorerHidden?: boolean;
};
