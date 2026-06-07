// Prop contract for the Canvas component, split out of Canvas.tsx
// (it was a 320-line inline type). Most field types are referenced
// via inline import('...') so this file only needs the bare-named
// types as top-level imports.
import type { PointerEvent as ReactPointerEvent, Ref } from 'react';
import type {
  Anchor,
  BackgroundPattern,
  Element,
  ShapeKind,
  TextAlignX,
  TextAlignY,
  TextSize,
} from '@livediagram/diagram';
import type { ImageSummary } from '@livediagram/api-schema';
import type { ArrowEnd, DragMode } from '@/lib/canvas';
import type { PendingDraw } from '@/lib/draw-mode';
import type { TemplateKind } from '@/lib/templates';
import type { ChangeLogEntry } from '@/lib/api-client';
import type { CanvasTool } from './CommandPalette';

export type CanvasProps = {
  tabName: string;
  tabLocked: boolean;
  // True for a view-only ('view' share role) session: the editing chrome
  // (command palette, selection + multi-select toolbars) is suppressed.
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
  tabPatternColor: string;
  mainRef: Ref<HTMLElement>;
  viewportOffset: { x: number; y: number };
  setViewportOffset: (offset: { x: number; y: number }) => void;
  viewportZoom: number;
  setViewportZoom: (zoom: number) => void;
  onFitToScreen: () => void;
  isPinchingRef?: React.RefObject<boolean>;
  elements: Element[];
  selectedId: string | null;
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
  editingId: string | null;
  formatSourceId: string | null;
  groupSourceId: string | null;
  palettePosition: { x: number; y: number } | null;
  explorerPosition: { x: number; y: number } | null;
  canUndo: boolean;
  canRedo: boolean;
  onAddShape: (kind: ShapeKind) => void;
  onAddIcon: (iconId: string) => void;
  onAddTable: () => void;
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
  onCancelDraw: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onMovePalette: (x: number, y: number) => void;
  onResetPalette: () => void;
  onMoveExplorer: (x: number, y: number) => void;
  onResetExplorer: () => void;
  diagramList: {
    id: string;
    name: string;
    folderId: string | null;
    savedAt: number;
    shareCode: string | null;
  }[];
  folders: { id: string; parentId: string | null; name: string }[];
  // Shared-with-you list. Empty by default so legacy callers can
  // omit it.
  sharedDiagrams?: {
    id: string;
    name: string;
    savedAt: number;
    role: 'edit' | 'view';
    shareCode: string;
    ownerName: string | null;
    ownerColor: string | null;
  }[];
  onDismissShared?: (diagramId: string) => void;
  // Navigate to the standalone full-page Explorer. Forwarded into
  // the floating Explorer panel's header "expand" button.
  onOpenFullExplorer?: () => void;
  diagramListLoading: boolean;
  changeLog: ChangeLogEntry[];
  changeLogLoading: boolean;
  activityPosition: { x: number; y: number } | null;
  activityMinimized: boolean;
  onMoveActivity: (x: number, y: number) => void;
  onToggleActivityMinimized: () => void;
  onResetActivity: () => void;
  // Floating Comments panel. Only mounted when commentRows is
  // non-empty: the panel exists to list discussion that already
  // exists, so on diagrams without it the panel stays out of the
  // chrome entirely.
  commentRows: import('./CommentsPanel').CommentRow[];
  commentsPanelPosition: { x: number; y: number } | null;
  onMoveCommentsPanel: (x: number, y: number) => void;
  onResetCommentsPanel: () => void;
  // Row click: editor selects the element + opens its thread popover.
  onOpenCommentsForElement: (elementId: string) => void;
  contextPosition: { x: number; y: number } | null;
  onMoveContext: (x: number, y: number) => void;
  onResetContext: () => void;
  // Lifted accordion state for the Editor panel's Current Tab
  // section so external triggers (Activity row click) can pop the
  // matching accordion.
  tabAccordionsOpen: import('./CommandPalette').TabAccordionState;
  setTabAccordionsOpen: React.Dispatch<
    React.SetStateAction<import('./CommandPalette').TabAccordionState>
  >;
  // Counter bumped by editor-page whenever something external (Activity
  // row click, tab-context-menu Change Theme/Canvas) wants the Editor
  // banner expanded. Forwarded through to ContextPanel → MovablePanel.
  editorExpandSignal: number;
  onRevertChange: (entry: ChangeLogEntry) => void;
  onActivityRowClick: (entry: ChangeLogEntry) => void;
  onClearActivity?: () => void;
  saveStatus: import('./EditorHeader').SaveStatus;
  savedAt: number | null;
  currentDiagramId: string | null;
  onOpenDiagram: (id: string, shareCode?: string) => void;
  onNewDiagram: () => void;
  onRenameCurrent: (name: string) => void;
  onDeleteDiagram: (id: string) => void;
  onDuplicateDiagram: (id: string) => void;
  onCreateFolder: (input: {
    name: string;
    parentId: string | null;
  }) => Promise<{ id: string; parentId: string | null; name: string } | void>;
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
  // Right-click on an element. Forwarded from BoxedElementView's
  // own context handler — the canvas selects the element and the
  // page opens an element context menu.
  onElementContextMenu?: (id: string, screenX: number, screenY: number) => void;
  onBeginDrag: (id: string, mode: DragMode, e: ReactPointerEvent) => void;
  onBeginRotate: (
    id: string,
    centerClientX: number,
    centerClientY: number,
    e: ReactPointerEvent,
  ) => void;
  onBeginAnchorDrag: (id: string, anchor: Anchor, e: ReactPointerEvent) => void;
  onBeginEdit: (id: string) => void;
  onCommitLabel: (id: string, label: string) => void;
  onCommitCells: (id: string, cells: string[][]) => void;
  onCancelEdit: () => void;
  onBeginEndpointDrag: (arrowId: string, end: ArrowEnd, e: ReactPointerEvent) => void;
  onBeginArrowCurveDrag: (arrowId: string, e: ReactPointerEvent) => void;
  onBeginArrowElbowDrag: (arrowId: string, e: ReactPointerEvent) => void;
  onBeginArrowTranslate: (arrowId: string, e: ReactPointerEvent) => void;
  onShiftSelect: (id: string) => void;
  onBeginFormatPainter: () => void;
  onCancelFormatPainter: () => void;
  onBeginGroup: () => void;
  onCancelGroup: () => void;
  onUngroup: () => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onSetTextSize: (size: TextSize) => void;
  onSetTextAlign: (x: TextAlignX, y: TextAlignY) => void;
  onToggleTextBold: () => void;
  onToggleTextItalic: () => void;
  onToggleTextUnderline: () => void;
  onToggleTextStrikethrough: () => void;
  onSetFillColor: (color: string) => void;
  onSetStrokeColor: (color: string) => void;
  onSetTextColor: (color: string) => void;
  onSetOpacity: (opacity: number) => void;
  onResetColors: () => void;
  onSetPadding: (padding: import('@livediagram/diagram').Padding) => void;
  onSetArrowEnds: (ends: import('@livediagram/diagram').ArrowEnds) => void;
  onSetArrowThickness: (thickness: import('@livediagram/diagram').ArrowThickness) => void;
  onSetArrowheadSize: (size: import('@livediagram/diagram').ArrowheadSize) => void;
  onSetArrowheadShape: (shape: import('@livediagram/diagram').ArrowheadShape) => void;
  onSetArrowStyle: (style: import('@livediagram/diagram').ArrowStyle) => void;
  onSetArrowStrokeStyle: (style: import('@livediagram/diagram').BorderStyle) => void;
  onSetShapeKind: (kind: ShapeKind) => void;
  onSetBorderStroke: (value: import('@livediagram/diagram').BorderStroke) => void;
  onSetBorderStyle: (value: import('@livediagram/diagram').BorderStyle) => void;
  onSetBorderRadius: (value: import('@livediagram/diagram').BorderRadius) => void;
  onFollowLink: (link: import('@livediagram/diagram').ElementLink) => void;
  onOpenComments: (elementId: string) => void;
  onOpenNote?: (elementId: string) => void;
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
    themeId: import('@/lib/themes').ThemeId,
  ) => void;
  onSkipTemplatePicker: () => void;
  onOpenTemplatePicker: () => void;
  tabThemeId: import('@/lib/themes').ThemeId;
  onSetBackgroundPattern: (pattern: BackgroundPattern) => void;
  onSetBackgroundColor: (color: string) => void;
  onSetBackgroundOpacity: (opacity: number) => void;
  onSetTheme: (id: import('@/lib/themes').ThemeId) => void;
  onResetElementsToTheme: () => void;
  // File I/O for the current tab — moved here so the Current Tab
  // section (right-hand inspector) houses them next to theme +
  // canvas, where the user is editing the tab anyway. Optional so
  // welcome-flow surfaces with no tab loaded yet can omit them.
  onExportTab?: () => void;
  onImportTab?: () => void;
  importError?: string | null;
  // "Auto align" cleanup pass on the current tab's elements. See
  // CommandPalette's Cleanup accordion + lib/auto-align.ts.
  onAutoAlign?: () => void;
  canAutoAlign?: boolean;
  aiPanel?: {
    position: { x: number; y: number } | null;
    onMove: (x: number, y: number) => void;
    onReset: () => void;
    contextElements: Element[];
    focusIds: string[];
    onApplyElements: (elements: Element[], mode: 'generate' | 'clean') => void;
    ownerId: string;
  };
  // Recent-images list for the Current Tab "Images" accordion (spec/19).
  // Forwarded through to TabSection unchanged.
  recentImages?: ImageSummary[];
  imageOwnerId?: string;
  imageDiagramId?: string;
  imageShareCode?: string | null;
  onAddImageFromGallery?: (image: ImageSummary) => void;
  onSetPatternColor: (color: string) => void;
  onToggleAspectLock: () => void;
  onDuplicateConnect: (direction: 'right' | 'below' | 'left' | 'above') => void;
  onToggleLockSelected: () => void;
  onDeleteSelected: () => void;
  onCanvasDoubleClick: (x: number, y: number) => void;
};
