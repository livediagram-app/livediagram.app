import type { SnapGuideStore } from '@/hooks/canvas/useSnapGuideState';
import type { Dispatch, SetStateAction } from 'react';
// Prop contract for the Canvas component, split out of Canvas.tsx
// (it was a 320-line inline type). Most field types are referenced
// via inline import('...') so this file only needs the bare-named
// types as top-level imports.
import type { PointerEvent as ReactPointerEvent, Ref } from 'react';
import type { Finish } from '@livediagram/document';
import type {
  BackgroundPattern,
  TabKind,
  EditorMode,
  Element,
  Layer,
  ShapeKind,
} from '@livediagram/document';
import type { QuickConnectDirection, QuickConnectKind } from '@/lib/canvas';
import type { CanvasTool } from '@/components/palette/palette.types';
import type { WorkspaceFrameHooks } from '@/components/providers/workbench-session-context';
import type { CanvasAddProps } from './Canvas.add.types';
import type { CanvasEditProps } from './Canvas.edit.types';
import type { CanvasPanelProps } from './Canvas.panels.types';
import type { CanvasSessionProps } from './Canvas.session.types';

// A connection-point marker shown while dragging an arrow endpoint: the
// world-space position of a nearby shape's anchor, with `active` set on the
// one the endpoint is currently snapped to. Rendered by CanvasChrome.
export type SnapTarget = { x: number; y: number; active: boolean };

// The props no one group holds: the tab and its view, selection, menus, the Explorer and the chrome's gates.
type CanvasCoreProps = {
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
  documentName: string;
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
  // The active tab's raw layers array (docs/specs/006-document/layers.md), undefined until the tab
  // materialises one. Drives the band-aware paint order + hidden-layer
  // filtering in CanvasElementsLayer and the Minimap.
  tabLayers?: Layer[];
  // The tab’s tab kind (docs/specs/021-event-storming/event-storming.md), which decides whether this canvas
  // presents as an event-storming board.
  tabKind?: TabKind;
  // The viewer's editor mode on the tab (docs/specs/007-editor/editor-modes.md): Draw trades the
  // palette, the strip and the tool panels for the dock, and keeps the canvas still.
  editorMode?: EditorMode;
  // The whiteboard dock's model and the board's ink for this appearance
  // (docs/specs/023-draw-mode/draw-mode.md), present on a whiteboard tab.
  whiteboardDock?: import('@/hooks/canvas/useWhiteboard').WhiteboardDockModel;
  whiteboardInk?: string;
  // The tab's timeline lane stack (docs/specs/021-event-storming/event-storming.md Phase 6) when lanes are on, else
  // undefined: a note dragged in from the palette snaps onto it, and the
  // overlay lights the lane it is landing on.
  // Element ids on a hidden or locked layer (docs/specs/006-document/layers.md) — inert to every
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
  // `target` is what the pointer is over, so a paste can tell the canvas from
  // a floating panel lying on top of it (@liveworkspace/workbench/lib/canvas-pointer.ts).
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
  canUndo: boolean;
  canRedo: boolean;
  // Lightweight id + name of this document's tabs, so a link badge's
  // hover card can name the tab/element a link points at (docs/specs/008-canvas/canvas-and-palette.md). Kept
  // minimal + memoised by the caller so element edits don't churn it.
  tabSummaries: { id: string; name: string }[];
  // Portals (docs/specs/009-elements/portal-element.md) link ACROSS tabs, so the canvas needs every tab's
  // elements to resolve where one leads, plus which tab is showing. Optional so
  // read-only / embed mounts that never travel can omit them.
  portalTabs?: import('@livediagram/document').Tab[];
  activeTabId?: string;
  // False while the active tab's content is still on its way (a tab never opened before): its elements arrive with
  // the board once it lands, not as additions. Omitted, the tab is loaded.
  activeTabLoaded?: boolean;
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
  // Eraser tool (docs/specs/008-canvas/canvas-and-palette.md): a primary-button press while the eraser is
  // active. The canvas intercepts it in the capture phase (before element
  // select/drag) and hands the screen coords here to start an erase
  // gesture; the gesture's move/release are tracked by useCanvasEraser.
  // `frame`: reads where the canvas sits on screen, per sample of the sweep (the whiteboard's
  // geometric erase, docs/specs/023-draw-mode/draw-mode.md; lib/erase-frame).
  onEraseStart?: (
    clientX: number,
    clientY: number,
    frame?: import('@/lib/erase-frame').EraseFrameReader,
  ) => void;
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
  // Intra-LAYER z-order from the selection popover (docs/specs/006-document/layers.md): stack the
  // selection within its own band, never between layers.
  onBringSelectedToFront: () => void;
  onSendSelectedToBack: () => void;
  onCanvasDoubleClick: (x: number, y: number) => void;
  // Lazy per-tab load (docs/specs/006-document/per-tab-storage.md). While the active tab's content is being
  // fetched ('loading') or after that fetch failed ('error'), Canvas
  // renders a blocking TabLoadOverlay so the user never edits a blank
  // placeholder whose autosave would wipe the real server row. 'ready'
  // (or undefined) renders the canvas normally. `onRetryTabLoad`
  // re-issues the fetch from the error card.
  tabLoadState?: import('@/app/document/[id]/editor-page-helpers').TabLoadState;
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

// The whole contract, one group per file beside this one.
export type CanvasProps = CanvasCoreProps &
  CanvasSessionProps &
  CanvasPanelProps &
  CanvasAddProps &
  CanvasEditProps;
