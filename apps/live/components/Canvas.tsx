import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type Ref,
} from 'react';
import {
  arrowThicknessOf,
  arrowheadSizeOf,
  arrowStyleOf,
  defaultFillColor,
  defaultPadding,
  defaultStrokeColor,
  defaultTextAlign,
  defaultTextColor,
  elementBounds,
  isBoxed,
  selectionMembers,
  snapResizeBounds,
  supportsBorder,
  supportsColours,
  unionBoxedBounds,
  type Anchor,
  type BackgroundPattern,
  type Element,
  type ShapeKind,
  type TextAlignX,
  type TextAlignY,
  type TextSize,
} from '@livediagram/diagram';
import type { ImageSummary } from '@livediagram/api-schema';
import type { ArrowEnd, DragMode } from '@/lib/canvas';
import { tabBackgroundStyle } from '@/lib/canvas-backgrounds';
import { drawBannerMessage, drawIntentCursor, type PendingDraw } from '@/lib/draw-mode';
import { track } from '@/lib/telemetry';
import type { TemplateKind } from '@/lib/templates';
import { ArrowDefs, ArrowView } from './ArrowView';
import { BoxedElementView } from './BoxedElementView';
import { CommandPalette, type CanvasTool, type SelectedElementControls } from './CommandPalette';
import { isSvgRenderedShape, ShapeSvgOverlay } from './shape-svg-overlay';
import { UnionResizeHandles } from './element-parts';
import { ActivityIcon, ActivityPanel, RedoIcon, UndoIcon } from './ActivityPanel';
// Lazy-load CommentsPanel: only mounts when the active tab has at
// least one element with comments AND the ContextPanel has reported
// its bottom edge (so we don't paint the panel at the legacy fallback
// position). Most diagrams never accumulate comments, so deferring
// the 164-line panel + its formatRelativeTimeShort + useRelativeTimeTick
// dependencies keeps the editor's initial chunk lean.
const CommentsPanel = dynamic(() => import('./CommentsPanel').then((m) => m.CommentsPanel));
import { ParticipantAvatar } from './ParticipantAvatar';
import { ContextPanel } from './ContextPanel';
import { Explorer } from './Explorer';
import { LaserOverlay } from './LaserOverlay';
import { useCanvasPanAndMarquee } from '@/hooks/useCanvasPanAndMarquee';
import { getTheme } from '@/lib/themes';
import type { ChangeLogEntry } from '@/lib/api-client';
import { isMobileViewportSync } from '@/lib/responsive';
import { DockButton, MovablePanel } from './MovablePanel';
import { AiPanelContent } from './AiPanel';
// Lazy-load MultiSelectionToolbar: only mounts when the user has
// drag-marquee'd two or more elements. Most sessions never trigger
// it (single-element edits dominate), so deferring the 172-line
// toolbar + its icon set keeps the editor's initial chunk lean.
// Same pattern as the editor's other gated modals (NotePopover,
// TabLinkPicker, etc.).
const MultiSelectionToolbar = dynamic(() =>
  import('./MultiSelectionToolbar').then((m) => m.MultiSelectionToolbar),
);
import { ModeBanner } from './ModeBanner';
import { PlusButton } from './PlusButton';
import { SelectionPopover } from './SelectionPopover';
// Lazy-load TemplatePicker (1163 lines + its theme / share helpers)
// the same way ExportTabDialog + ShareDialog already are. The picker
// is gated on `showTemplatePicker`, which is false for the common
// path (a returning user opening an existing diagram with tabs that
// already have content). For first-time guests on a fresh diagram
// the gate is true on first paint, but the empty canvas underneath
// has already rendered by then, so the user sees the welcome modal
// fade in a frame later rather than blocking the route on the
// picker's JS. The /live/new entry keeps the static import because
// the picker is the whole UI there.
import dynamic from 'next/dynamic';
const TemplatePicker = dynamic(() => import('./TemplatePicker').then((m) => m.TemplatePicker));

// Stable empty-array constant for the `remoteSelectors` prop on the
// (very common) "no remote participants have this element selected"
// path. A fresh `[]` per render would invalidate BoxedElementView's
// memo (commit e8e34f9) on every editor-page render, defeating the
// memo for every element nobody else is currently selecting. The
// shared constant lets shallow equality see the same reference
// across renders.
const EMPTY_REMOTE_SELECTORS: { id: string; name: string; color: string }[] = [];

// Reused as the excludeIds argument to snapResizeBounds during draw-
// to-size: the new element doesn't exist yet, so there's nothing to
// exclude. A module-level frozen Set keeps the snap effect from
// allocating a new Set on every pointermove.
const EMPTY_ID_SET: Set<string> = new Set();

import { Tooltip } from './Tooltip';
import { ZoomControls } from './ZoomControls';

type CanvasProps = {
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

export function Canvas(props: CanvasProps) {
  const {
    tabName,
    tabLocked,
    readOnly,
    ownerParticipant,
    isOwner,
    diagramName,
    tabBackgroundPattern,
    tabBackgroundColor,
    tabBackgroundOpacity,
    tabPatternColor,
    mainRef,
    isPinchingRef,
    viewportOffset,
    setViewportOffset,
    viewportZoom,
    setViewportZoom,
    onFitToScreen,
    elements,
    selectedId,
    multiSelectedIds,
    onSelectMarquee,
    canvasTool,
    onSetCanvasTool,
    remoteSelectionsByElement,
    remoteCursors,
    laserTrails,
    onCanvasPointerMove,
    onDuplicateMultiSelected,
    onDeleteMultiSelected,
    onGroupMultiSelected,
    onToggleLockMultiSelected,
    editingId,
    formatSourceId,
    groupSourceId,
    palettePosition,
    explorerPosition,
    canUndo,
    canRedo,
    onAddShape,
    onAddText,
    onAddSticky,
    onAddImage,
    onAddArrow,
    onBeginFreehand,
    pendingDraw,
    onCommitDraw,
    onCommitFreehand,
    recogniseShapes,
    minimalPanels,
    onToggleRecogniseShapes,
    onCancelDraw,
    onUndo,
    onRedo,
    onMovePalette,
    onResetPalette,
    onMoveExplorer,
    onResetExplorer,
    diagramList,
    folders,
    sharedDiagrams,
    onDismissShared,
    onOpenFullExplorer,
    diagramListLoading,
    changeLog,
    changeLogLoading,
    activityPosition,
    activityMinimized,
    onMoveActivity,
    onToggleActivityMinimized,
    onResetActivity,
    commentRows,
    commentsPanelPosition,
    onMoveCommentsPanel,
    onResetCommentsPanel,
    onOpenCommentsForElement,
    contextPosition,
    tabAccordionsOpen,
    editorExpandSignal,
    setTabAccordionsOpen,
    onMoveContext,
    onResetContext,
    onRevertChange,
    onActivityRowClick,
    onClearActivity,
    saveStatus,
    savedAt,
    currentDiagramId,
    onOpenDiagram,
    onNewDiagram,
    onRenameCurrent,
    onDeleteDiagram,
    onDuplicateDiagram,
    onCreateFolder,
    onRenameFolder,
    onDeleteFolder,
    onMoveDiagramToFolder,
    onDeselect,
    onSelect,
    onCanvasContextMenu,
    onElementContextMenu,
    onBeginDrag,
    onBeginRotate,
    onBeginAnchorDrag,
    onBeginEdit,
    onCommitLabel,
    onCancelEdit,
    onBeginEndpointDrag,
    onBeginArrowCurveDrag,
    onBeginArrowElbowDrag,
    onBeginArrowTranslate,
    onShiftSelect,
    onBeginFormatPainter,
    onCancelFormatPainter,
    onBeginGroup,
    onCancelGroup,
    onUngroup,
    onBringToFront,
    onSendToBack,
    onSetTextSize,
    onSetTextAlign,
    onToggleTextBold,
    onToggleTextItalic,
    onToggleTextUnderline,
    onToggleTextStrikethrough,
    onSetFillColor,
    onSetStrokeColor,
    onSetTextColor,
    onSetOpacity,
    onResetColors,
    onSetPadding,
    onSetArrowEnds,
    onSetArrowThickness,
    onSetArrowheadSize,
    onSetArrowStyle,
    onSetArrowStrokeStyle,
    onSetShapeKind,
    onSetBorderStroke,
    onSetBorderStyle,
    onSetBorderRadius,
    onFollowLink,
    onOpenComments,
    onOpenNote,
    imageContext,
    onOpenElementContextMenu,
    showTemplatePicker,
    hydrated,
    templatePickerMode,
    templatePickerLockedName,
    welcomeOpen,
    selfParticipant,
    onChooseTemplate,
    onSkipTemplatePicker,
    onOpenTemplatePicker,
    tabThemeId,
    onSetTheme,
    onResetElementsToTheme,
    onExportTab,
    onImportTab,
    importError,
    onAutoAlign,
    canAutoAlign,
    recentImages,
    imageOwnerId,
    imageDiagramId,
    imageShareCode,
    onAddImageFromGallery,
    onSetBackgroundPattern,
    onSetBackgroundColor,
    onSetBackgroundOpacity,
    onSetPatternColor,
    onToggleAspectLock,
    onDuplicateConnect,
    onToggleLockSelected,
    onDeleteSelected,
    onCanvasDoubleClick,
    aiPanel,
  } = props;

  const wrapperRef = useRef<HTMLDivElement>(null);

  const isPaintMode = formatSourceId !== null;
  const isGroupMode = groupSourceId !== null;

  // Pan tracking. viewportOffset is owned by the page (so element placement
  // can reason about the visible viewport); we just read/write through props.
  // Palette's bottom-Y (offsetTop + offsetHeight in offsetParent
  // coords). The ContextPanel uses this to stack dynamically below
  // the Palette as accordions open / close and as the banner
  // collapses; MovablePanel publishes it via onSize. The bottom-Y
  // (vs height alone) makes the alignment robust to the upper
  // panel's own top-utility class, the editor lands at
  // paletteBottomY + 16 regardless of whether the palette pins to
  // top-2 (mobile) or top-4 (desktop).
  const [paletteBottomY, setPaletteBottomY] = useState<number>(0);
  // Explorer's measured bottom edge on mobile. The Palette sits BELOW
  // this via its `mobileTopOverridePx` so the diagram switcher fits
  // above the Palette without overlapping. Desktop ignores it (the
  // Explorer pins to top-left there, not as a banner).
  const [explorerBottomY, setExplorerBottomY] = useState<number>(0);
  // ContextPanel's measured bottom edge. Drives the CommentsPanel's
  // top-right-stacked positioning so it lands directly under the
  // Editor pane on first paint and slides when Editor expands /
  // collapses.
  const [contextBottomY, setContextBottomY] = useState<number>(0);
  // Mobile dock: which panel (if any) is open. Compact button row
  // replaces the 4 full-width collapse banners on mobile.
  const [activeMobilePanel, setActiveMobilePanel] = useState<
    'explorer' | 'palette' | 'editor' | 'ai' | null
  >(null);
  const dockButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [activeDockAnchor, setActiveDockAnchor] = useState<{
    left: number;
    top: number;
    arrowOffset: number;
  } | null>(null);
  const POPOVER_WIDTH = 256;
  const handleDockButtonClick = (id: 'explorer' | 'palette' | 'editor' | 'ai') => {
    if (activeMobilePanel === id) {
      setActiveMobilePanel(null);
      setActiveDockAnchor(null);
      return;
    }
    setActiveMobilePanel(id);
    const btn = dockButtonRefs.current[id];
    const canvas = mainRef && 'current' in mainRef ? mainRef.current : null;
    if (btn && canvas) {
      const btnRect = btn.getBoundingClientRect();
      const canvasRect = canvas.getBoundingClientRect();
      const centerX = btnRect.left + btnRect.width / 2 - canvasRect.left;
      const bottomY = btnRect.bottom - canvasRect.top;
      const clampedLeft = Math.max(
        8,
        Math.min(centerX - POPOVER_WIDTH / 2, canvasRect.width - POPOVER_WIDTH - 8),
      );
      setActiveDockAnchor({ left: clampedLeft, top: bottomY, arrowOffset: centerX - clampedLeft });
    }
  };

  // Pan + marquee + held-Space machinery lives in
  // useCanvasPanAndMarquee. The hook owns the pointerdown / move
  // / up listeners and the rect-vs-element marquee intersection,
  // exposes pan / marquee state + setters back so the canvas's
  // own pointerdown handlers can drive it, and exposes the
  // spaceHeldRef the pointerdown reads to decide pan vs marquee.
  const { pan, setPan, marquee, setMarquee, spaceHeldRef } = useCanvasPanAndMarquee({
    viewportZoom,
    setViewportOffset,
    elements,
    wrapperRef,
    onDeselect,
    onSelectMarquee,
    isPinchingRef,
  });

  const zoomStep = 0.1;
  const clampZoom = (z: number) => Math.max(0.1, Math.min(5, z));
  const handleZoomIn = () => {
    setViewportZoom(clampZoom(viewportZoom + zoomStep));
    track('Canvas', 'Zoomed', 'In');
  };
  const handleZoomOut = () => {
    setViewportZoom(clampZoom(viewportZoom - zoomStep));
    track('Canvas', 'Zoomed', 'Out');
  };
  const handleResetZoom = () => {
    setViewportZoom(1);
    track('Canvas', 'Zoomed', 'Reset');
  };

  // Group-aware selection. `selected` is the editor's primary
  // element (single-click, group root, or first member of a marquee
  // multi-selection). Multi-select promotes the first selected
  // boxed element so the Editor panel can read shared properties
  // from it; setters in the editor bulk-apply across all selected
  // members.
  // Memoised: `selectionMembers` walks every element looking for
  // matching groupIds (O(N)), and Set construction allocates fresh
  // memory. Canvas re-renders on every drag tick / pointermove
  // during gestures; recomputing this set on every render is wasted
  // work because the membership only changes when `elements` or
  // `selectedId` does. Stable identity also keeps the downstream
  // consumers (unionBoxedBounds, selectionBounds, selectionScope)
  // from re-deriving on unrelated state changes.
  const memberIds = useMemo(
    () => (selectedId ? new Set(selectionMembers(elements, selectedId)) : new Set<string>()),
    [elements, selectedId],
  );
  const multiPrimaryId =
    multiSelectedIds.size > 0
      ? (elements.find((el) => multiSelectedIds.has(el.id))?.id ?? null)
      : null;
  const selected =
    (selectedId ? (elements.find((el) => el.id === selectedId) ?? null) : null) ??
    (multiPrimaryId ? (elements.find((el) => el.id === multiPrimaryId) ?? null) : null);
  const selectionScope: 'single' | 'multi' | 'group' =
    multiSelectedIds.size > 0 ? 'multi' : selectedId && memberIds.size > 1 ? 'group' : 'single';
  const selectedIsBoxed = selected ? isBoxed(selected) : false;
  const selectedIsGrouped = selected && isBoxed(selected) && selected.groupId !== undefined;

  let selectionBounds: { x: number; y: number; width: number; height: number } | null = null;
  if (selected) {
    if (selectedIsBoxed && memberIds.size > 0) {
      selectionBounds = unionBoxedBounds(elements, memberIds);
    } else {
      selectionBounds = elementBounds(selected, elements);
    }
  }

  const selectedLocked = selected ? selected.locked === true : false;
  // Single-selection popover hides when a marquee multi-selection is active
  // (a per-element popover doesn't make sense for many elements at once).
  // It also hides when the tab itself is locked — no destination for any of
  // the popover's actions.
  const showPopover =
    selected &&
    editingId !== selected.id &&
    !isPaintMode &&
    !isGroupMode &&
    multiSelectedIds.size === 0 &&
    !tabLocked;
  const showPlus =
    selected &&
    selectedIsBoxed &&
    editingId !== selected.id &&
    !isPaintMode &&
    !isGroupMode &&
    !selectedLocked &&
    !tabLocked &&
    !readOnly;
  const showHandles = (id: string) =>
    selectedIsBoxed &&
    id === selectedId &&
    memberIds.size === 1 &&
    editingId !== id &&
    !isPaintMode &&
    !isGroupMode &&
    !selectedLocked &&
    !tabLocked &&
    !readOnly;
  // Union-level resize handles render on the selection bounding box
  // whenever the selection covers more than one boxed element — either
  // via marquee multi-select OR clicking into a group. Multi-select
  // uses multiSelectedIds; group uses memberIds. For a plain single
  // selection, the per-element handles (see ResizeHandles inside
  // BoxedElementView) keep doing their job. Suppressed in the same
  // edit-blocking modes as the single-element handles.
  const unionResizeIds: Set<string> | null =
    multiSelectedIds.size > 1 ? multiSelectedIds : memberIds.size > 1 ? memberIds : null;
  const unionResizeBounds =
    unionResizeIds && selected ? unionBoxedBounds(elements, unionResizeIds) : null;
  const unionResizePrimaryId =
    multiSelectedIds.size > 1
      ? (multiPrimaryId ?? selectedId)
      : memberIds.size > 1
        ? selectedId
        : null;
  const showUnionResize =
    !!unionResizeBounds &&
    !!unionResizePrimaryId &&
    selectedIsBoxed &&
    editingId !== unionResizePrimaryId &&
    !isPaintMode &&
    !isGroupMode &&
    !selectedLocked &&
    !tabLocked &&
    !readOnly;
  const showAnchorsFor = (id: string) =>
    selectedIsBoxed &&
    id === selectedId &&
    memberIds.size === 1 &&
    editingId !== id &&
    !isPaintMode &&
    !isGroupMode &&
    !selectedLocked &&
    !tabLocked &&
    !readOnly;

  // Cached check only. Render loops iterate `elements` directly so
  // arrows and boxed elements interleave in z-order (see render
  // block below); the only thing we still need eagerly is "are
  // there any arrows" to decide whether to mount the ArrowDefs.
  // `some` short-circuits on the first arrow (which is usually
  // near the front of the list once a diagram has any), so the
  // typical render pays O(1); the prior reduce was unconditional
  // O(N) for the sole purpose of computing a boolean.
  const hasArrows = elements.some((el) => el.type === 'arrow');

  const cursorClass = pendingDraw
    ? 'cursor-crosshair'
    : pan
      ? 'cursor-grabbing'
      : marquee
        ? 'cursor-crosshair'
        : canvasTool === 'laser' && !spaceHeldRef.current
          ? 'cursor-crosshair'
          : canvasTool === 'pan' && !spaceHeldRef.current
            ? 'cursor-grab'
            : canvasTool === 'select'
              ? 'cursor-crosshair'
              : isPaintMode
                ? 'cursor-copy'
                : isGroupMode
                  ? 'cursor-crosshair'
                  : 'cursor-grab';

  const selectionSupportsColours = selected ? supportsColours(selected) : false;
  const selectedDefaultAlign = selected && isBoxed(selected) ? defaultTextAlign(selected) : null;
  const paletteSelection: SelectedElementControls | null = selected
    ? {
        // Image elements are boxed but carry no inline text + no
        // colours; nulling these out hides the Text + Colours
        // accordions in the Editor panel for image selections.
        textSize:
          isBoxed(selected) && selected.type !== 'image' ? (selected.textSize ?? 'md') : null,
        textAlignX:
          selected && isBoxed(selected) && selected.type !== 'image' && selectedDefaultAlign
            ? (selected.textAlignX ?? selectedDefaultAlign.x)
            : null,
        textAlignY:
          selected && isBoxed(selected) && selected.type !== 'image' && selectedDefaultAlign
            ? (selected.textAlignY ?? selectedDefaultAlign.y)
            : null,
        textColor:
          isBoxed(selected) && selected.type !== 'image'
            ? (selected.textColor ?? defaultTextColor(selected))
            : null,
        fillColor:
          selectionSupportsColours && isBoxed(selected)
            ? (selected.fillColor ?? defaultFillColor(selected))
            : null,
        strokeColor: selectionSupportsColours
          ? isBoxed(selected)
            ? (selected.strokeColor ?? defaultStrokeColor(selected))
            : selected.type === 'arrow'
              ? (selected.strokeColor ?? 'rgb(51 65 85)') /* slate-700 = default arrow */
              : null
          : null,
        opacity: selected.opacity ?? 1,
        padding: isBoxed(selected) ? (selected.padding ?? defaultPadding(selected)) : null,
        onBringToFront,
        onSendToBack,
        onSetTextSize,
        onSetTextAlign,
        // ImageElement is boxed but carries no inline-text fields,
        // so the text-styling switches surface as null for images
        // (the Editor panel hides the matching accordion rows).
        textBold:
          isBoxed(selected) && selected.type !== 'image' ? (selected.textBold ?? false) : null,
        textItalic:
          isBoxed(selected) && selected.type !== 'image' ? (selected.textItalic ?? false) : null,
        textUnderline:
          isBoxed(selected) && selected.type !== 'image' ? (selected.textUnderline ?? false) : null,
        textStrikethrough:
          isBoxed(selected) && selected.type !== 'image'
            ? (selected.textStrikethrough ?? false)
            : null,
        onToggleTextBold,
        onToggleTextItalic,
        onToggleTextUnderline,
        onToggleTextStrikethrough,
        onSetTextColor,
        onSetFillColor,
        onSetStrokeColor,
        onSetOpacity,
        onResetColors,
        onSetPadding,
        arrowEnds: selected.type === 'arrow' ? (selected.arrowEnds ?? 'to') : null,
        onSetArrowEnds,
        arrowThickness: selected.type === 'arrow' ? arrowThicknessOf(selected) : null,
        onSetArrowThickness,
        arrowheadSize: selected.type === 'arrow' ? arrowheadSizeOf(selected) : null,
        onSetArrowheadSize,
        arrowStyle: selected.type === 'arrow' ? arrowStyleOf(selected) : null,
        onSetArrowStyle,
        arrowStrokeStyle: selected.type === 'arrow' ? (selected.strokeStyle ?? 'solid') : null,
        onSetArrowStrokeStyle,
        shapeKind: selected.type === 'shape' ? selected.shape : null,
        onSetShapeKind,
        aspectLocked: isBoxed(selected) ? (selected.aspectLocked ?? false) : null,
        onToggleAspectLock,
        // Border presets only meaningful for shapes (text has no
        // outline; sticky's amber palette is fixed). Default to
        // medium / solid / sm to match the renderer's fallbacks
        // when the element hasn't been customised yet.
        // Border-stroke + border-style: gated on supportsBorder so
        // every consumer of "is this element border-styleable?"
        // shares one predicate. Today shapes + freehand qualify;
        // a future variant can opt in by changing one function.
        // Border-radius stays shape-only because the freehand path
        // defines its own corners via the polyline.
        borderStroke: supportsBorder(selected) ? (selected.strokeWidth ?? 'medium') : null,
        borderStyle: supportsBorder(selected) ? (selected.strokeStyle ?? 'solid') : null,
        borderRadius: selected.type === 'shape' ? (selected.borderRadius ?? 'sm') : null,
        onSetBorderStroke,
        onSetBorderStyle,
        onSetBorderRadius,
      }
    : null;

  const tabSection = {
    backgroundPattern: tabBackgroundPattern,
    backgroundColor: tabBackgroundColor,
    backgroundOpacity: tabBackgroundOpacity,
    patternColor: tabPatternColor,
    onSetBackgroundOpacity,
    themeId: tabThemeId,
    onSetBackgroundPattern,
    onSetBackgroundColor,
    onSetPatternColor,
    onSetTheme,
    onResetElementsToTheme,
    onExportTab,
    onImportTab,
    importError,
    onAutoAlign,
    canAutoAlign,
    recentImages,
    imageOwnerId,
    imageDiagramId,
    imageShareCode,
    onAddImageFromGallery,
  };

  // Colour for the link / comment badges. The active theme's
  // elementStroke is the obvious "this theme's accent" — it's what
  // arrows and new shape outlines use. The Brand theme has no stroke
  // override, so fall back to brand-500 (the hex behind bg-brand-500).
  const badgeColor = getTheme(tabThemeId).elementStroke ?? '#0ea5e9';

  // Broadcast the local pointer position to peers (canvas-coords).
  // Throttling lives in page.tsx so the Canvas stays prop-driven.
  const handlePointerMoveCanvas = (e: React.PointerEvent) => {
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return;
    const sx = (e.clientX - rect.left) / viewportZoom;
    const sy = (e.clientY - rect.top) / viewportZoom;
    onCanvasPointerMove(sx, sy);
  };
  const handlePointerLeaveCanvas = () => {
    onCanvasPointerMove(null, null);
  };

  // Stable wrapper for the element-right-click flow. BoxedElementView
  // is memoed; passing inline arrows for `onContextSelect` would
  // recreate them per element per render and invalidate the memo.
  // useCallback gives it one identity across renders, so the memoed
  // child sees the same function reference until `onSelect` or
  // `onElementContextMenu` itself changes upstream.
  const handleElementContextSelect = useCallback(
    (id: string, sx: number, sy: number) => {
      onSelect(id);
      onElementContextMenu?.(id, sx, sy);
    },
    [onSelect, onElementContextMenu],
  );

  // Stable wrapper for the arrow click flow. Same rationale as
  // handleElementContextSelect: a per-arrow inline arrow at the
  // call site would defeat ArrowView's memo on every render of the
  // Canvas. Mirrors BoxedElementView's shift-modifier semantics so
  // an arrow can join a marquee multi-selection via plain click
  // (when one is active) or Shift-click. Reading the latest
  // `multiSelectedIds` through a ref keeps this callback stable
  // even as the selection set changes.
  const multiSelectedIdsRef = useRef(multiSelectedIds);
  useEffect(() => {
    multiSelectedIdsRef.current = multiSelectedIds;
  }, [multiSelectedIds]);

  // Draw-to-size gesture state. Set when the user starts a drag on
  // the canvas while pendingDraw is set; cleared on pointer-up
  // (either when onCommitDraw persists the element or the drag was
  // cancelled). Coords are stored as canvas coords (pre-divided by
  // viewportZoom) so the preview renders in the same space as the
  // rest of the canvas content. `current` is the snapped point, not
  // the raw pointer, so preview + commit see the same number.
  const [drawDrag, setDrawDrag] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);

  // Pen gesture state. The freehand intent samples pointer positions
  // for the whole drag (one polyline) rather than start + end like
  // the box / line intents. Stored as a flat array of canvas-coord
  // points; appended to on every pointermove (throttled to one append
  // per frame via requestAnimationFrame so high-DPI / 120 Hz pointers
  // can't push thousands of samples per second through React's
  // reconciliation). Null when no pen drag is active.
  const [penPoints, setPenPoints] = useState<{ x: number; y: number }[] | null>(null);

  // Window-level move + up listeners for the draw gesture. Attached
  // only while a drag is in flight so the canvas pays nothing in the
  // common case (idle, or in pan / marquee mode). pointermove
  // resolves the raw pointer, applies snap (1:1 lock on shift, edge
  // alignment to existing elements via snapResizeBounds for box
  // intents), and stores the snapped point so the preview tracks it.
  // pointerup hands raw start + end to onCommitDraw and lets the
  // editor decide how to interpret them (box vs line). Pointercancel
  // + Escape go through the keyboard hook's onCancelDraw path.
  useEffect(() => {
    if (!drawDrag || !pendingDraw) return;
    const wrapperEl = wrapperRef.current;
    const isBoxIntent = pendingDraw.type !== 'arrow';
    // Snap threshold scales inversely with zoom so the "feel" is
    // consistent: a 6-screen-pixel halo at any zoom level, big enough
    // to grab edges without surprise-snapping while the user is
    // still freely placing.
    const snapPx = 6 / viewportZoom;
    // Local mutable mirror of drawDrag. The effect's setDrawDrag
    // updater used to call onCommitDraw inline, which re-entered
    // the editor's commit handler (a parent setState) from inside
    // React's setState updater path and tripped a "setState during
    // render" warning on LivePage. Keeping the latest gesture state
    // in a closure variable lets onMove update it synchronously and
    // onUp call onCommitDraw cleanly OUTSIDE any setState updater.
    // setDrawDrag is now only used to trigger preview re-renders.
    let latest: { startX: number; startY: number; currentX: number; currentY: number } | null =
      drawDrag;
    const onMove = (e: PointerEvent) => {
      const rect = wrapperEl?.getBoundingClientRect();
      if (!rect || !latest) return;
      const rawX = (e.clientX - rect.left) / viewportZoom;
      const rawY = (e.clientY - rect.top) / viewportZoom;
      let endX = rawX;
      let endY = rawY;
      // 1:1 aspect lock on shift. Mirrors Figma / Photoshop: hold
      // shift while drawing to get a perfect square / circle. Picks
      // the dominant axis (the one the user moved further) and
      // matches the other to it, preserving the drag's direction so
      // the box still grows where the cursor is.
      if (e.shiftKey) {
        const dx = endX - latest.startX;
        const dy = endY - latest.startY;
        const absMax = Math.max(Math.abs(dx), Math.abs(dy));
        endX = latest.startX + (dx === 0 ? absMax : Math.sign(dx) * absMax);
        endY = latest.startY + (dy === 0 ? absMax : Math.sign(dy) * absMax);
      }
      // Element-edge snap for box intents. Arrows skip this: their
      // endpoints don't read as a bounding box (the natural snap
      // there is per-end anchor pinning, handled by the existing
      // arrow drag-handle flow after creation).
      if (isBoxIntent) {
        const x = Math.min(latest.startX, endX);
        const y = Math.min(latest.startY, endY);
        const width = Math.max(1, Math.abs(endX - latest.startX));
        const height = Math.max(1, Math.abs(endY - latest.startY));
        const mode: 'se' | 'sw' | 'ne' | 'nw' =
          endX >= latest.startX
            ? endY >= latest.startY
              ? 'se'
              : 'ne'
            : endY >= latest.startY
              ? 'sw'
              : 'nw';
        const snapped = snapResizeBounds(
          { x, y, width, height },
          mode,
          elements,
          EMPTY_ID_SET,
          snapPx,
          1,
        );
        endX = mode === 'se' || mode === 'ne' ? snapped.x + snapped.width : snapped.x;
        endY = mode === 'se' || mode === 'sw' ? snapped.y + snapped.height : snapped.y;
      }
      latest = { ...latest, currentX: endX, currentY: endY };
      setDrawDrag(latest);
    };
    const onUp = () => {
      const snapshot = latest;
      latest = null;
      setDrawDrag(null);
      if (snapshot) {
        onCommitDraw(
          pendingDraw,
          snapshot.startX,
          snapshot.startY,
          snapshot.currentX,
          snapshot.currentY,
        );
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawDrag !== null, pendingDraw]);

  // Pen-gesture sampling loop. While penPoints is non-null and the
  // freehand intent is the active pendingDraw, accumulate pointer
  // samples into the polyline. Pointermove writes to a local mirror
  // and schedules ONE setPenPoints per requestAnimationFrame, so a
  // 120 Hz pointer doesn't pump thousands of React renders. On
  // pointerup we hand the polyline to onCommitFreehand (which
  // simplifies + smooths it) and clear the gesture state.
  useEffect(() => {
    if (!penPoints || !pendingDraw || pendingDraw.type !== 'freehand') return;
    const wrapperEl = wrapperRef.current;
    let buffer: { x: number; y: number }[] = penPoints;
    let rafId: number | null = null;
    const onMove = (e: PointerEvent) => {
      const rect = wrapperEl?.getBoundingClientRect();
      if (!rect) return;
      const x = (e.clientX - rect.left) / viewportZoom;
      const y = (e.clientY - rect.top) / viewportZoom;
      buffer = [...buffer, { x, y }];
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        setPenPoints(buffer);
      });
    };
    const onUp = () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
      const snapshot = buffer;
      setPenPoints(null);
      if (snapshot.length >= 2) {
        onCommitFreehand(snapshot, recogniseShapes);
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (rafId !== null) window.cancelAnimationFrame(rafId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [penPoints !== null, pendingDraw]);

  // Auto-focus the canvas surface on mount so clipboard paste works
  // before the user has clicked anywhere. The browser only dispatches
  // `paste` events on a focusable element; <main> has tabIndex=-1 to
  // be a valid focus target, but it doesn't grab focus by itself.
  // Without this, a freshly-loaded editor swallows Cmd/Ctrl+V silently
  // until the first canvas click. preventScroll keeps the viewport
  // from jumping if the page was scrolled at load time.
  useEffect(() => {
    const node = mainRef && 'current' in mainRef ? mainRef.current : null;
    node?.focus({ preventScroll: true });
  }, [mainRef]);
  const handleArrowSelect = useCallback(
    (id: string, e: ReactPointerEvent) => {
      const set = multiSelectedIdsRef.current;
      const isMember = set.has(id);
      if (e.shiftKey || (set.size > 0 && !isMember)) {
        onShiftSelect(id);
        return;
      }
      onSelect(id);
    },
    [onSelect, onShiftSelect],
  );

  return (
    <main
      ref={mainRef}
      tabIndex={-1}
      onPointerMove={handlePointerMoveCanvas}
      onPointerLeave={handlePointerLeaveCanvas}
      onContextMenu={(e) => {
        // BoxedElementView's onContextMenu calls e.stopPropagation()
        // for right-clicks on elements, so we only reach here for
        // canvas background clicks. Suppress the browser context
        // menu and open a tab-level context menu instead.
        e.preventDefault();
        onCanvasContextMenu?.(e.clientX, e.clientY);
      }}
      onPointerDown={(e) => {
        // Focus the canvas surface so subsequent Cmd/Ctrl+V dispatches
        // a `paste` event the editor-page-level handler can read. The
        // browser only fires `paste` when something focusable is
        // currently focused; tabIndex={-1} below makes <main> a valid
        // focus target, but a click on a tabIndex=-1 element doesn't
        // auto-focus it (mouse focus is restricted to inputs / hrefs /
        // tabIndex>=0). Calling `.focus()` here closes that loop so
        // clipboard-image paste works after the user has interacted
        // with the canvas at least once.
        const node = mainRef && 'current' in mainRef ? mainRef.current : null;
        node?.focus({ preventScroll: true });
        // Draw-to-size intercept: when an intent is pending, this
        // pointer-down starts the size-drag instead of falling
        // through to pan / marquee. Coords convert immediately to
        // canvas coords so the rest of the gesture (the window-
        // level move + up listeners above) operates in one space.
        if (pendingDraw) {
          const rect = wrapperRef.current?.getBoundingClientRect();
          if (rect) {
            const sx = (e.clientX - rect.left) / viewportZoom;
            const sy = (e.clientY - rect.top) / viewportZoom;
            if (pendingDraw.type === 'freehand') {
              // Pen gesture: start a polyline accumulator. Subsequent
              // pointermoves append to it via the effect below; on
              // release the polyline is handed to onCommitFreehand.
              setPenPoints([{ x: sx, y: sy }]);
            } else {
              setDrawDrag({ startX: sx, startY: sy, currentX: sx, currentY: sy });
            }
            return;
          }
        }
        // Auto-fit on load can scale the wrapper below 1, which
        // shrinks its hit region inside `main`. Without this mirror
        // handler, clicks in the "outside the shrunken wrapper but
        // still on the canvas" gap would never start a marquee.
        // Restrict to direct hits on `main` so element clicks (which
        // bubble up here) don't also trigger.
        //
        // Laser is grouped with pan here (matching the inner wrapper
        // handler below): mid-presentation a click-drag is far more
        // often "reposition the canvas" than "multi-select", and a
        // pan is the safe no-op when the presenter is just steadying
        // their hand. Without this, a laser-mode drag in the outer
        // gap would silently draw a marquee selection box.
        //
        // Touch is the explicit exception (spec/09): a finger drag
        // in laser mode MUST draw the laser, not pan, because touch
        // has no hover. Pan-on-drag would pin the dot in canvas
        // coords (the canvas slides under the finger), defeating
        // the presenter mode entirely on phones / tablets.
        if (e.target !== e.currentTarget) return;
        const laserOnTouch = canvasTool === 'laser' && e.pointerType === 'touch';
        // Touch + Laser is a pure draw gesture: no pan, no marquee.
        // pointermove on <main> keeps broadcasting laser samples via
        // onCanvasPointerMove. Without this short-circuit the drag
        // would fall into the marquee branch below and paint a
        // selection rectangle while the user is presenting.
        if (laserOnTouch) return;
        const wantsPan = spaceHeldRef.current || canvasTool === 'pan' || canvasTool === 'laser';
        if (wantsPan) {
          setPan({
            startClientX: e.clientX,
            startClientY: e.clientY,
            startOffsetX: viewportOffset.x,
            startOffsetY: viewportOffset.y,
            movedRef: { current: false },
          });
        } else {
          setMarquee({
            startX: e.clientX,
            startY: e.clientY,
            currentX: e.clientX,
            currentY: e.clientY,
          });
        }
      }}
      className={`relative flex-1 touch-none select-none overflow-hidden outline-none [-webkit-touch-callout:none] [-webkit-tap-highlight-color:transparent] ${
        pendingDraw ? '' : cursorClass
      }`}
      style={{
        ...tabBackgroundStyle(
          tabBackgroundPattern,
          viewportOffset,
          tabBackgroundColor,
          tabPatternColor,
          tabBackgroundOpacity,
        ),
        // Mirror the inner-wrapper cursor on <main>. The inner div is
        // `absolute inset-0` but its CSS transform scales it (zoom),
        // so when zoom is below 1 the hit area shrinks and the
        // surrounding "letterbox" gap falls through to <main>. Without
        // setting cursor here too, the user would see the OS default
        // arrow in that gap while a draw-to-size intent is pending.
        ...(pendingDraw ? { cursor: drawIntentCursor(pendingDraw) } : null),
      }}
    >
      <div
        ref={wrapperRef}
        onPointerDown={(e) => {
          if (e.target !== e.currentTarget) return;
          // Focus the canvas surface so subsequent Cmd/Ctrl+V
          // dispatches a paste event (see the outer pointerdown
          // handler above for the full rationale). Same call from
          // the inner wrapper so click-on-canvas-content (which
          // doesn't bubble through the outer onPointerDown's
          // currentTarget gate) still leaves the canvas focused.
          const node = mainRef && 'current' in mainRef ? mainRef.current : null;
          node?.focus({ preventScroll: true });
          // Draw-to-size intercept (mirror of the outer handler).
          // Must branch on `freehand` the same way the outer one
          // does: a freehand intent starts a polyline accumulator
          // (penPoints), every other intent starts the box / line
          // drag (drawDrag). The previous version always started a
          // drawDrag, so a pen click landed BOTH a penPoints state
          // (from the outer handler) AND a drawDrag (from this
          // inner one); the drawDrag preview rendered a marquee-
          // like box and its onUp routed the gesture into
          // onCommitDraw, which dropped through commitDraw's
          // ternary fallback to createImage. Three symptoms in
          // one missing branch.
          if (pendingDraw) {
            const rect = wrapperRef.current?.getBoundingClientRect();
            if (rect) {
              const sx = (e.clientX - rect.left) / viewportZoom;
              const sy = (e.clientY - rect.top) / viewportZoom;
              if (pendingDraw.type === 'freehand') {
                setPenPoints([{ x: sx, y: sy }]);
              } else {
                setDrawDrag({ startX: sx, startY: sy, currentX: sx, currentY: sy });
              }
              return;
            }
          }
          // Tool decides the gesture:
          //  - Pan tool / Space / Laser tool → drag scrolls. Laser
          //    drags pan because mid-presentation a click-drag is far
          //    more often "I want to reposition the canvas" than "I
          //    want to multi-select", and a pan is the safe no-op
          //    when the presenter is just steadying their hand. The
          //    trail keeps capturing pointer-moves throughout, so
          //    the pan reads as a sweeping laser to peers.
          //  - Touch + Laser is the exception (spec/09): a finger
          //    drag in laser mode draws the laser, not panning,
          //    because touch has no hover and pan-on-drag would pin
          //    the dot in canvas-coords.
          //  - Select tool → drag draws a marquee for multi-select.
          const laserOnTouch = canvasTool === 'laser' && e.pointerType === 'touch';
          // Touch + Laser: pure draw, no pan, no marquee. Falls
          // through so pointermove on <main> can keep broadcasting
          // laser samples. See the outer handler above for the
          // matching short-circuit.
          if (laserOnTouch) return;
          const wantsPan = spaceHeldRef.current || canvasTool === 'pan' || canvasTool === 'laser';
          if (wantsPan) {
            setPan({
              startClientX: e.clientX,
              startClientY: e.clientY,
              startOffsetX: viewportOffset.x,
              startOffsetY: viewportOffset.y,
              movedRef: { current: false },
            });
          } else {
            setMarquee({
              startX: e.clientX,
              startY: e.clientY,
              currentX: e.clientX,
              currentY: e.clientY,
            });
          }
        }}
        onDoubleClick={(e) => {
          if (e.target !== e.currentTarget) return;
          const rect = wrapperRef.current?.getBoundingClientRect();
          if (!rect) return;
          // rect is post-transform; click position relative to wrapper top-left
          // is in scaled pixels — divide by zoom to recover canvas-coords.
          const sx = (e.clientX - rect.left) / viewportZoom;
          const sy = (e.clientY - rect.top) / viewportZoom;
          onCanvasDoubleClick(sx, sy);
        }}
        className={`absolute inset-0 origin-center touch-none ${pendingDraw ? '' : cursorClass}`}
        style={{
          // Translate is in canvas-coords (applied first); scale is centred
          // on the wrapper so zooming keeps the viewport centre stable.
          transform: `scale(${viewportZoom}) translate(${viewportOffset.x}px, ${viewportOffset.y}px)`,
          // Draw-mode cursor: every intent gets a custom inline-SVG
          // cursor (crosshair at the pointer tip plus a small glyph
          // hinting at what's about to land). Without this, tool
          // intents inherited the default arrow cursor because the
          // wrapper drops its Tailwind cursor- class above when
          // pendingDraw is set, leaving no cursor specified at all.
          ...(pendingDraw ? { cursor: drawIntentCursor(pendingDraw) } : null),
        }}
      >
        {/* Shared arrowhead defs. Multiple per-arrow <svg>s below
            all reference url(#arrowhead) — defs are document-scoped
            in SVG so a single defs node lets every arrow render
            with the same marker. */}
        {hasArrows ? (
          <svg
            className="absolute"
            style={{ width: 0, height: 0, overflow: 'visible' }}
            aria-hidden
          >
            <ArrowDefs />
          </svg>
        ) : null}

        {/* Render elements in their natural array order so
            `bringToFront` / `sendToBack` reorder arrows relative to
            boxed elements (instead of all arrows perpetually stacking
            above all boxes inside a single SVG layer). Each arrow
            gets its own <svg> overlay; pointer events on the SVG are
            disabled in CSS, only the inner arrow line picks them up. */}
        {elements.map((element) => {
          if (element.type === 'arrow') {
            return (
              <svg
                key={element.id}
                className="absolute inset-0 h-full w-full"
                style={{ pointerEvents: 'none', overflow: 'visible' }}
              >
                <ArrowView
                  arrow={element}
                  elements={elements}
                  isSelected={element.id === selectedId || multiSelectedIds.has(element.id)}
                  isPaintMode={isPaintMode || isGroupMode}
                  isEditing={element.id === editingId}
                  tabLocked={tabLocked}
                  readOnly={readOnly}
                  onSelect={handleArrowSelect}
                  onBeginEndpointDrag={onBeginEndpointDrag}
                  onBeginEdit={onBeginEdit}
                  onCommitLabel={onCommitLabel}
                  onCancelEdit={onCancelEdit}
                  onBeginTranslate={onBeginArrowTranslate}
                  onBeginCurveDrag={onBeginArrowCurveDrag}
                  onBeginElbowDrag={onBeginArrowElbowDrag}
                />
              </svg>
            );
          }
          if (!isBoxed(element)) return null;
          return (
            <BoxedElementView
              key={element.id}
              element={element}
              isSelected={memberIds.has(element.id) || multiSelectedIds.has(element.id)}
              isMultiSelected={multiSelectedIds.has(element.id)}
              multiSelectActive={multiSelectedIds.size > 0}
              remoteSelectors={remoteSelectionsByElement.get(element.id) ?? EMPTY_REMOTE_SELECTORS}
              isEditing={element.id === editingId}
              isPaintMode={isPaintMode || isGroupMode}
              showHandles={showHandles(element.id)}
              showAnchors={showAnchorsFor(element.id)}
              zoom={viewportZoom}
              badgeColor={badgeColor}
              tabLocked={tabLocked}
              onBeginDrag={onBeginDrag}
              onBeginRotate={onBeginRotate}
              onShiftSelect={onShiftSelect}
              onBeginAnchorDrag={onBeginAnchorDrag}
              onBeginEdit={onBeginEdit}
              onCommitLabel={onCommitLabel}
              onCancelEdit={onCancelEdit}
              onFollowLink={onFollowLink}
              onOpenComments={onOpenComments}
              onOpenNote={onOpenNote}
              imageContext={imageContext}
              onContextSelect={handleElementContextSelect}
            />
          );
        })}

        {remoteCursors.map((c) => (
          <RemoteCursor key={c.id} cursor={c} zoom={viewportZoom} />
        ))}

        {/* Laser overlay sits inside the viewport-transformed wrapper
            so trail coordinates (canvas-space) pan + zoom with
            elements. The overlay component owns its own RAF loop
            and only runs while there's at least one active trail. */}
        <LaserOverlay trails={laserTrails} zoom={viewportZoom} />

        {showUnionResize && unionResizeBounds && unionResizePrimaryId ? (
          <UnionResizeHandles
            bounds={unionResizeBounds}
            primaryId={unionResizePrimaryId}
            zoom={viewportZoom}
            onBeginDrag={onBeginDrag}
          />
        ) : null}

        {showPlus && selectionBounds ? (
          <>
            <PlusButton
              x={selectionBounds.x + selectionBounds.width}
              y={selectionBounds.y + selectionBounds.height / 2}
              placement="right"
              zoom={viewportZoom}
              onClick={() => onDuplicateConnect('right')}
            />
            <PlusButton
              x={selectionBounds.x + selectionBounds.width / 2}
              y={selectionBounds.y + selectionBounds.height}
              placement="below"
              zoom={viewportZoom}
              onClick={() => onDuplicateConnect('below')}
            />
            <PlusButton
              x={selectionBounds.x}
              y={selectionBounds.y + selectionBounds.height / 2}
              placement="left"
              zoom={viewportZoom}
              onClick={() => onDuplicateConnect('left')}
            />
            <PlusButton
              x={selectionBounds.x + selectionBounds.width / 2}
              y={selectionBounds.y}
              placement="above"
              zoom={viewportZoom}
              onClick={() => onDuplicateConnect('above')}
            />
          </>
        ) : null}
      </div>

      {/* SelectionPopover rides on a sibling wrapper that mirrors
          the canvas transform but lives AFTER the editor panels in
          DOM order. z-40 on every viewport: lifts the toolbar
          above panels (Palette, Editor / Context, Explorer,
          Activity, Zoom / ZoomControls, the TabBar footer) so it
          stays visible whether the selected element sits near a
          panel-pinned corner on desktop OR overlaps the bottom
          dock on mobile. The previous mobile-only z-0 was an
          older design choice that hid the toolbar behind chrome,
          which made multi-select edit ops awkward on a phone.
          Diagram elements stay in the original wrapper at z-auto
          and continue to be visually covered by panels where they
          overlap. */}
      {showPopover && selectionBounds ? (
        <div
          className="pointer-events-none absolute inset-0 z-40 origin-center"
          style={{
            transform: `scale(${viewportZoom}) translate(${viewportOffset.x}px, ${viewportOffset.y}px)`,
          }}
        >
          <SelectionPopover
            bounds={selectionBounds}
            canvasOffset={viewportOffset}
            zoom={viewportZoom}
            // In view-only mode we mount the popover with just
            // `onOpenComments`: visitors should be able to read +
            // post comments on a diagram they don't own, but no
            // other edit affordances apply. Every other handler
            // becomes undefined and the matching button drops out.
            locked={readOnly ? undefined : selectedLocked}
            onCopyFormat={
              readOnly
                ? undefined
                : selected && (isBoxed(selected) || selected.type === 'arrow')
                  ? onBeginFormatPainter
                  : undefined
            }
            onGroup={!readOnly && selectedIsBoxed && !selectedIsGrouped ? onBeginGroup : undefined}
            onUngroup={!readOnly && selectedIsGrouped ? onUngroup : undefined}
            onToggleLock={readOnly ? undefined : onToggleLockSelected}
            onDelete={readOnly ? undefined : onDeleteSelected}
            onOpenComments={selected ? () => onOpenComments(selected.id) : undefined}
            onOpenContextMenu={
              readOnly
                ? undefined
                : selected && onOpenElementContextMenu
                  ? (x, y) => onOpenElementContextMenu(selected.id, x, y)
                  : undefined
            }
            compact={readOnly}
          />
        </div>
      ) : null}

      {hydrated && elements.length === 0 && !showTemplatePicker && !welcomeOpen ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="pointer-events-none flex max-w-sm animate-fly-up-in flex-col items-center rounded-xl border border-slate-200 bg-white px-6 py-5 text-center shadow-md">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-500">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <rect x="3" y="6" width="10" height="10" rx="1.5" />
                <circle cx="16" cy="14" r="5" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-slate-800">{tabName}</p>
            <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Empty canvas
            </p>
            {readOnly ? (
              // View-role visitors can't add elements or browse
              // templates, so the editor copy + CTA would be
              // misleading. Surface a passive "nothing here yet"
              // line so the empty state still reads as intentional
              // rather than broken.
              <p className="mt-3 text-xs leading-relaxed text-slate-600">
                Nothing has been added to this tab yet. The diagram's owner can build it out, and
                your view will update live.
              </p>
            ) : (
              <>
                <p className="mt-3 text-xs leading-relaxed text-slate-600">
                  Click an element in the Palette to start building your diagram, double-click
                  anywhere to drop text, or connect elements by dragging from their anchor dots.
                </p>
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={onOpenTemplatePicker}
                  className="pointer-events-auto mt-4 inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
                >
                  Browse templates
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}

      {showTemplatePicker ? (
        <TemplatePicker
          mode={templatePickerMode}
          participant={selfParticipant}
          currentThemeId={tabThemeId}
          diagramName={diagramName}
          lockedName={templatePickerLockedName}
          onPick={onChooseTemplate}
          onSkip={onSkipTemplatePicker}
        />
      ) : null}

      {multiSelectedIds.size >= 2 && !readOnly ? (
        <MultiSelectionToolbar
          count={multiSelectedIds.size}
          anyLocked={elements.some((el) => multiSelectedIds.has(el.id) && el.locked === true)}
          offsetForOwnerRow={!isOwner}
          onDuplicate={onDuplicateMultiSelected}
          onDelete={onDeleteMultiSelected}
          onGroup={onGroupMultiSelected}
          onToggleLock={onToggleLockMultiSelected}
        />
      ) : null}

      {marquee ? (
        <div
          aria-hidden
          className="pointer-events-none fixed z-30 rounded-sm border border-brand-500 bg-brand-500/10"
          style={{
            left: Math.min(marquee.startX, marquee.currentX),
            top: Math.min(marquee.startY, marquee.currentY),
            width: Math.abs(marquee.currentX - marquee.startX),
            height: Math.abs(marquee.currentY - marquee.startY),
          }}
        />
      ) : null}

      {/* Draw-to-size preview. drawDrag holds canvas coords; convert
          to client coords via the wrapper rect + viewportZoom so the
          overlay aligns with the canvas content under it. The shape
          itself renders via ShapeSvgOverlay (the same primitive
          BoxedElementView uses for committed shapes) with a dashed-
          brand stroke + translucent brand fill, so "draw circle"
          looks like an oval, "draw diamond" like a diamond, etc.
          The three simple kinds (square / circle / stadium) bypass
          SVG and use border-radius on the wrapping div, matching
          how BoxedElementView renders them at rest. */}
      {/* Pen-gesture live preview. While the user is drawing freehand,
          paint the in-progress polyline as a brand-tinted stroke so
          they can see what they're sketching. Sits on the same z-30
          overlay layer as the draw-to-size box preview. Switches to
          the committed FreehandSvg after release (the next render
          tick once the new element lands in `elements`). */}
      {penPoints && pendingDraw?.type === 'freehand' && penPoints.length >= 2
        ? (() => {
            const rect = wrapperRef.current?.getBoundingClientRect();
            if (!rect) return null;
            // Build an SVG polyline string from the sampled canvas-
            // coord points, converted to client coords via the
            // wrapper rect + zoom so the overlay aligns with the
            // canvas content.
            const d = penPoints
              .map(
                (p, i) =>
                  `${i === 0 ? 'M' : 'L'} ${rect.left + p.x * viewportZoom} ${
                    rect.top + p.y * viewportZoom
                  }`,
              )
              .join(' ');
            return (
              <svg aria-hidden className="pointer-events-none fixed inset-0 z-30 h-screen w-screen">
                <path
                  d={d}
                  fill="none"
                  stroke="rgb(14, 165, 233)"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            );
          })()
        : null}

      {drawDrag && pendingDraw
        ? (() => {
            const rect = wrapperRef.current?.getBoundingClientRect();
            if (!rect) return null;
            // Arrow intent: render the drag as a line from the start
            // point to the current point, with a small chevron-like
            // arrowhead near the end so the user sees the direction
            // they've drawn (the committed arrow defaults to no
            // arrowheads; this is just preview chrome).
            if (pendingDraw.type === 'arrow') {
              const x1 = rect.left + drawDrag.startX * viewportZoom;
              const y1 = rect.top + drawDrag.startY * viewportZoom;
              const x2 = rect.left + drawDrag.currentX * viewportZoom;
              const y2 = rect.top + drawDrag.currentY * viewportZoom;
              return (
                <svg
                  aria-hidden
                  className="pointer-events-none fixed inset-0 z-30 h-screen w-screen"
                >
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="rgb(14, 165, 233)"
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                  />
                </svg>
              );
            }
            const canvasMinX = Math.min(drawDrag.startX, drawDrag.currentX);
            const canvasMinY = Math.min(drawDrag.startY, drawDrag.currentY);
            const canvasW = Math.abs(drawDrag.currentX - drawDrag.startX);
            const canvasH = Math.abs(drawDrag.currentY - drawDrag.startY);
            const widthPx = Math.max(canvasW * viewportZoom, 1);
            const heightPx = Math.max(canvasH * viewportZoom, 1);
            const usesSvg = pendingDraw.type === 'shape' && isSvgRenderedShape(pendingDraw.kind);
            // Box intents: square / circle / stadium use border-
            // radius on the wrapping div (matching the BoxedElementView
            // at-rest treatment), every SVG-rendered shape kind
            // delegates to ShapeSvgOverlay, and text / sticky / image
            // fall back to a simple dashed-rect. The text + sticky
            // + image branches use 4px corners; stickies don't get
            // their corner-fold preview here because the preview is
            // very small and a peeled corner just reads as noise.
            const radius =
              pendingDraw.type === 'shape' && pendingDraw.kind === 'circle'
                ? '50%'
                : pendingDraw.type === 'shape' && pendingDraw.kind === 'stadium'
                  ? '9999px'
                  : '4px';
            return (
              <div
                aria-hidden
                className="pointer-events-none fixed z-30"
                style={{
                  left: rect.left + canvasMinX * viewportZoom,
                  top: rect.top + canvasMinY * viewportZoom,
                  width: widthPx,
                  height: heightPx,
                }}
              >
                {usesSvg && pendingDraw.type === 'shape' ? (
                  <ShapeSvgOverlay
                    shape={pendingDraw.kind}
                    fill="rgba(14, 165, 233, 0.10)"
                    stroke="rgb(14, 165, 233)"
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                  />
                ) : (
                  <div
                    className="h-full w-full border border-dashed border-brand-500 bg-brand-500/10"
                    style={{ borderRadius: radius }}
                  />
                )}
              </div>
            );
          })()
        : null}

      {isPaintMode ? (
        <ModeBanner
          icon={
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M13.5 2.5l-6 6" />
              <path d="M7 8l1.5 1.5" />
              <path d="M6.5 9.5a3 3 0 1 0 1 4.5c.5-.6.5-1.4 0-2-.6-.5-1.4-.5-2 0" />
            </svg>
          }
          message="Click an element to apply formatting"
          onAction={onCancelFormatPainter}
        />
      ) : null}

      {isGroupMode ? (
        <ModeBanner
          icon={
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
              aria-hidden
            >
              <rect x="2.25" y="2.25" width="8" height="8" rx="1.25" />
              <rect x="5.75" y="5.75" width="8" height="8" rx="1.25" fill="white" />
            </svg>
          }
          message="Click another element to add to the group"
          actionLabel="Done"
          onAction={onCancelGroup}
        />
      ) : null}

      {pendingDraw ? (
        <ModeBanner
          icon={
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
              aria-hidden
            >
              <rect x="2.5" y="2.5" width="11" height="11" rx="1.5" strokeDasharray="2 1.5" />
              <path d="M5.5 5.5l5 5" />
            </svg>
          }
          message={drawBannerMessage(pendingDraw, isMobileViewportSync())}
          onAction={onCancelDraw}
          // Pen-mode-only extras slot: the "recognise shapes" toggle.
          // Icon-only with a Tooltip (bold title + one-line
          // description) so the symbol's meaning is discoverable
          // without clutter; the pressed state (brand-200 fill)
          // signals when the mode is active so the user always
          // knows whether the next stroke will convert or stay as a
          // sketch. The on/off state is a persisted user preference
          // (spec/20 `recogniseShapes`) lifted to editor-page, so it
          // survives across pencil sessions and across devices.
          extras={
            pendingDraw.type === 'freehand' ? (
              <Tooltip
                title={recogniseShapes ? 'Recognise shapes: on' : 'Recognise shapes: off'}
                description={
                  recogniseShapes
                    ? 'Strokes that resemble rectangles, circles, diamonds, or lines auto-convert. Click to keep sketches as-is.'
                    : 'Click to auto-convert strokes that resemble rectangles, circles, diamonds, or lines.'
                }
              >
                <button
                  type="button"
                  onClick={onToggleRecogniseShapes}
                  aria-label="Toggle shape recognition"
                  aria-pressed={recogniseShapes}
                  className={
                    'flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium transition ' +
                    (recogniseShapes
                      ? 'bg-brand-200 text-brand-900 hover:bg-brand-300'
                      : 'bg-white text-slate-700 hover:bg-slate-50')
                  }
                >
                  {/* Sparkle / magic-wand glyph signals "auto" without
                      being a literal AI motif. Two-star composition
                      so it parses at 14px. */}
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M6 2 L6.9 4.6 L9.5 5.5 L6.9 6.4 L6 9 L5.1 6.4 L2.5 5.5 L5.1 4.6 Z" />
                    <path d="M11.5 9 L12.1 10.4 L13.5 11 L12.1 11.6 L11.5 13 L10.9 11.6 L9.5 11 L10.9 10.4 Z" />
                  </svg>
                </button>
              </Tooltip>
            ) : undefined
          }
        />
      ) : null}

      {/* Mobile dock — replaces the 4 stacked full-width collapse
          banners with a single compact button row at top-right.
          Hidden on sm: where panels render at their own corners. */}
      {!welcomeOpen && (
        <div
          data-mobile-dock
          className={`pointer-events-auto absolute top-2 right-2 z-20 flex items-stretch rounded-lg border border-slate-200 bg-white shadow-md dark:border-slate-800 dark:bg-slate-900${minimalPanels ? '' : ' sm:hidden'}`}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {(
            [
              {
                id: 'explorer',
                label: 'Explorer',
                icon: (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                    <path
                      d="M2 3.5C2 2.67 2.67 2 3.5 2h2.25l1.5 1.5H10.5c.83 0 1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5h-7C2.67 11.5 2 10.83 2 10V3.5z"
                      stroke="currentColor"
                      strokeWidth="1.2"
                      strokeLinejoin="round"
                    />
                  </svg>
                ),
              },
              ...(!readOnly
                ? [
                    {
                      id: 'palette' as const,
                      label: 'Palette',
                      icon: (
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                          <rect
                            x="2"
                            y="2"
                            width="4"
                            height="4"
                            rx="0.8"
                            stroke="currentColor"
                            strokeWidth="1.2"
                          />
                          <rect
                            x="8"
                            y="2"
                            width="4"
                            height="4"
                            rx="2"
                            stroke="currentColor"
                            strokeWidth="1.2"
                          />
                          <rect
                            x="2"
                            y="8"
                            width="4"
                            height="4"
                            rx="0.8"
                            stroke="currentColor"
                            strokeWidth="1.2"
                          />
                          <path
                            d="M10 8v4M8 10h4"
                            stroke="currentColor"
                            strokeWidth="1.2"
                            strokeLinecap="round"
                          />
                        </svg>
                      ),
                    },
                    {
                      id: 'editor' as const,
                      label: 'Editor',
                      icon: (
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                          <path
                            d="M2 10.5V12h1.5l5-5-1.5-1.5-5 5zM10.8 3.7a1 1 0 0 0 0-1.4l-.1-.1a1 1 0 0 0-1.4 0L8 3.5 9.5 5l1.3-1.3z"
                            stroke="currentColor"
                            strokeWidth="1.2"
                            strokeLinejoin="round"
                          />
                        </svg>
                      ),
                    },
                  ]
                : []),
              ...(!readOnly && aiPanel
                ? [
                    {
                      id: 'ai' as const,
                      label: 'AI',
                      icon: (
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                          <path
                            d="M7 2v1.5M7 10.5V12M2 7h1.5M10.5 7H12M3.8 3.8l1 1M9.2 9.2l1 1M3.8 10.2l1-1M9.2 4.8l1-1"
                            stroke="currentColor"
                            strokeWidth="1.2"
                            strokeLinecap="round"
                          />
                          <circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.2" />
                        </svg>
                      ),
                    },
                  ]
                : []),
            ] as {
              id: 'explorer' | 'palette' | 'editor' | 'ai';
              label: string;
              icon: React.ReactNode;
            }[]
          ).map((btn, i, arr) => (
            <button
              key={btn.id}
              ref={(el) => {
                dockButtonRefs.current[btn.id] = el;
              }}
              type="button"
              onClick={() => handleDockButtonClick(btn.id)}
              className={
                'flex flex-1 flex-col items-center gap-0.5 px-2.5 py-1.5 text-[9px] font-semibold tracking-wide transition ' +
                (i === 0 ? 'rounded-l-lg ' : '') +
                (i === arr.length - 1 ? 'rounded-r-lg ' : '') +
                (i > 0 ? 'border-l border-slate-200 dark:border-slate-800 ' : '') +
                (activeMobilePanel === btn.id
                  ? 'bg-brand-500 text-white'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800')
              }
            >
              {btn.icon}
              {btn.label}
            </button>
          ))}
        </div>
      )}

      {/* Explorer is the one piece of chrome that stays visible during
          the welcome flow — the sign-up nudge is genuinely useful there
          and lives outside the diagram's controls. */}
      <Explorer
        position={explorerPosition}
        diagrams={diagramList}
        folders={folders}
        loading={diagramListLoading}
        shared={sharedDiagrams}
        onDismissShared={onDismissShared}
        onOpenFullExplorer={onOpenFullExplorer}
        currentDiagramId={currentDiagramId}
        onMoveTo={onMoveExplorer}
        onReset={onResetExplorer}
        onOpenDiagram={onOpenDiagram}
        onNewDiagram={onNewDiagram}
        onRenameCurrent={onRenameCurrent}
        onDeleteDiagram={onDeleteDiagram}
        onDuplicateDiagram={onDuplicateDiagram}
        onCreateFolder={onCreateFolder}
        onRenameFolder={onRenameFolder}
        onDeleteFolder={onDeleteFolder}
        onMoveDiagramToFolder={onMoveDiagramToFolder}
        onSize={(size) => setExplorerBottomY(size.bottomY)}
        mobileOpenOverride={activeMobilePanel === 'explorer' ? true : false}
        mobileDockAnchor={activeDockAnchor ?? undefined}
        forceDockMode={!!minimalPanels}
        onMobileClose={() => {
          setActiveMobilePanel(null);
          setActiveDockAnchor(null);
        }}
      />

      {/* Activity panel — per-diagram audit log + Undo/Redo. Hidden
          during the welcome flow because there's nothing to audit
          yet and Undo/Redo would target an empty history. */}
      {/* Comments panel is desktop-only chrome: on mobile, the canvas
          is already tight, the per-element comment popover stays
          available for viewing / replying, and a floating cheat
          sheet of threads would crowd the surface that's already
          banner-collapsing the Palette + Editor. Wrapped in
          `hidden sm:contents` so the MovablePanel beneath gets
          `display: none` on phones without changing its props.
          Mount is also gated on contextBottomY > 0 so the panel
          waits until the Editor pane above has reported its size:
          mounting before that would let MovablePanel fall back to
          its static top-[15rem], landing the panel BEHIND the
          Editor pane (Editor renders later in the DOM and wins
          z-order) instead of stacking cleanly under it. */}
      {!welcomeOpen && commentRows.length > 0 && contextBottomY > 0 ? (
        <div className="hidden sm:contents">
          <CommentsPanel
            position={commentsPanelPosition}
            rows={commentRows}
            stackBelowY={contextBottomY}
            onMoveTo={onMoveCommentsPanel}
            onReset={onResetCommentsPanel}
            onRowClick={onOpenCommentsForElement}
          />
        </div>
      ) : null}

      {!welcomeOpen && aiPanel ? (
        <MovablePanel
          title="AI Assistant"
          position={aiPanel.position}
          defaultCorner="top-right-stacked"
          stackBelowY={contextBottomY}
          width="w-auto sm:w-64"
          collapsible
          onReset={aiPanel.onReset}
          onMoveTo={aiPanel.onMove}
          mobileOpenOverride={activeMobilePanel === 'ai' ? true : false}
          mobileDockAnchor={activeDockAnchor ?? undefined}
          forceDockMode={!!minimalPanels}
          onMobileClose={() => {
            setActiveMobilePanel(null);
            setActiveDockAnchor(null);
          }}
        >
          <AiPanelContent
            contextElements={aiPanel.contextElements}
            focusIds={aiPanel.focusIds}
            tabName={tabName}
            ownerId={aiPanel.ownerId}
            onApplyElements={aiPanel.onApplyElements}
          />
        </MovablePanel>
      ) : null}

      {welcomeOpen ? null : (
        <ActivityPanel
          position={activityPosition}
          minimized={activityMinimized}
          tabLocked={tabLocked}
          entries={changeLog}
          loading={changeLogLoading}
          readOnly={readOnly}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={onUndo}
          onRedo={onRedo}
          onRevert={onRevertChange}
          onRowClick={onActivityRowClick}
          onClearActivity={onClearActivity}
          saveStatus={saveStatus}
          savedAt={savedAt}
          onMoveTo={onMoveActivity}
          onReset={onResetActivity}
          onToggleMinimized={onToggleActivityMinimized}
        />
      )}

      {/* Top-middle status row. Only renders for visitors (non-owners):
          owners already know it's their own diagram and that they're
          editing, so the extra chrome is just noise. Visitors see who
          owns it ("Owner: <avatar> <name>", when the owner is in the
          room and so reachable via livePresence) and their own role
          (Viewing in amber, Editing in green). Pointer events stay off
          so the badges don't intercept clicks on the canvas. Hidden
          below sm because the same top-row real estate carries the
          Explorer / Palette / Editor banner pills there, and the
          Owner pill overlaps them. The role is still discoverable
          from the canvas chrome (no-add palette + locked element
          affordances for view-role), so dropping the badge on a
          phone is a small loss for a meaningful layout win. */}
      {!isOwner ? (
        <div className="pointer-events-none absolute left-1/2 top-3 z-30 hidden -translate-x-1/2 items-center gap-2 sm:flex">
          {ownerParticipant ? (
            <div className="flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-medium text-slate-700 shadow-sm dark:bg-slate-900/90 dark:text-slate-200">
              <span className="text-slate-500 dark:text-slate-400">Owner:</span>
              <ParticipantAvatar participant={ownerParticipant} size={14} />
              <span className="max-w-[10rem] truncate">{ownerParticipant.name}</span>
            </div>
          ) : null}
          <div
            className={
              'rounded-full px-2.5 py-1 text-[11px] font-medium shadow-sm ' +
              (readOnly
                ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200'
                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200')
            }
          >
            {readOnly ? 'Viewing' : 'Editing'}
          </div>
        </div>
      ) : null}
      {welcomeOpen || readOnly ? null : (
        <CommandPalette
          position={palettePosition}
          canvasTool={canvasTool}
          onSetCanvasTool={onSetCanvasTool}
          onMoveTo={onMovePalette}
          onReset={onResetPalette}
          onAddShape={onAddShape}
          onAddText={onAddText}
          onAddSticky={onAddSticky}
          onAddImage={onAddImage}
          onAddArrow={onAddArrow}
          onBeginFreehand={onBeginFreehand}
          pendingDraw={pendingDraw}
          onSize={(size) => setPaletteBottomY(size.bottomY)}
          mobileTopOverridePx={explorerBottomY > 0 ? explorerBottomY + 4 : undefined}
          mobileOpenOverride={activeMobilePanel === 'palette' ? true : false}
          mobileDockAnchor={activeDockAnchor ?? undefined}
          forceDockMode={!!minimalPanels}
          onMobileClose={() => {
            setActiveMobilePanel(null);
            setActiveDockAnchor(null);
          }}
        />
      )}

      {welcomeOpen || readOnly ? null : (
        <ContextPanel
          position={contextPosition}
          selection={paletteSelection}
          selectionScope={selectionScope}
          tab={tabSection}
          tabAccordionsOpen={tabAccordionsOpen}
          setTabAccordionsOpen={setTabAccordionsOpen}
          expandSignal={editorExpandSignal}
          onMoveTo={onMoveContext}
          onReset={onResetContext}
          stackBelowY={
            palettePosition !== null || paletteBottomY === 0 ? undefined : paletteBottomY
          }
          onSize={(size) => setContextBottomY(size.bottomY)}
          mobileOpenOverride={activeMobilePanel === 'editor' ? true : false}
          mobileDockAnchor={activeDockAnchor ?? undefined}
          forceDockMode={!!minimalPanels}
          onMobileClose={() => {
            setActiveMobilePanel(null);
            setActiveDockAnchor(null);
          }}
        />
      )}

      {/* Bottom dock. Order, left → right: Zoom controls, History
          controls, and a minimised Activity dock when applicable.
          The Palette + Editor are banner-collapsed in place (spec/09)
          so they're not in the dock cluster; the Explorer is hidden
          on mobile entirely (spec/07) and uses banner-collapse on
          desktop, so it's also not in the dock cluster. */}
      <div className="pointer-events-none absolute bottom-4 right-4 z-10 flex items-center gap-2">
        {welcomeOpen ? null : (
          <>
            {activityMinimized ? (
              // Collapsed Activity dock: a single Open button in
              // view-role mode (visitors can still see the audit
              // trail by opening the panel, just not undo/redo it);
              // a wider strip with inline Undo / Redo for editor
              // sessions so the most common history actions don't
              // require reopening the panel.
              readOnly ? (
                <DockButton
                  label="Open Tab Activity"
                  description="Expand the Tab Activity panel."
                  icon={<ActivityIcon />}
                  onClick={onToggleActivityMinimized}
                />
              ) : (
                <div
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  className="pointer-events-auto flex animate-pop-in items-stretch overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg shadow-slate-900/5 dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/40"
                >
                  <Tooltip title="Open Tab Activity" description="Expand the Tab Activity panel.">
                    <button
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={onToggleActivityMinimized}
                      aria-label="Open Tab Activity"
                      className="hidden h-11 w-11 items-center justify-center border-r border-slate-200 text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 sm:flex dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                    >
                      <ActivityIcon />
                    </button>
                  </Tooltip>
                  <Tooltip title="Undo" description="Undo last edit.">
                    <button
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={onUndo}
                      disabled={!canUndo}
                      aria-label="Undo"
                      className="flex h-11 w-11 items-center justify-center text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white dark:disabled:text-slate-600 dark:disabled:hover:bg-transparent"
                    >
                      <UndoIcon />
                    </button>
                  </Tooltip>
                  <Tooltip title="Redo" description="Redo last undone edit.">
                    <button
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={onRedo}
                      disabled={!canRedo}
                      aria-label="Redo"
                      className="flex h-11 w-11 items-center justify-center border-l border-slate-100 text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white dark:disabled:text-slate-600 dark:disabled:hover:bg-transparent"
                    >
                      <RedoIcon />
                    </button>
                  </Tooltip>
                </div>
              )
            ) : null}
            <ZoomControls
              zoom={viewportZoom}
              onZoomIn={handleZoomIn}
              onZoomOut={handleZoomOut}
              onReset={handleResetZoom}
              onFitToScreen={onFitToScreen}
            />
          </>
        )}
      </div>
    </main>
  );
}

// Floating cursor for a remote participant. Position is in canvas
// coords (so the cursor pans + zooms with the canvas), but the SVG
// + name pill are counter-scaled so they keep their on-screen size
// at any zoom — same trick the badges + plus buttons use.
function RemoteCursor({
  cursor,
  zoom,
}: {
  cursor: { id: string; name: string; color: string; x: number; y: number };
  zoom: number;
}) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute"
      style={{
        left: cursor.x,
        top: cursor.y,
        transform: `scale(${1 / zoom})`,
        transformOrigin: 'top left',
        zIndex: 40,
      }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill={cursor.color}
        stroke="white"
        strokeWidth="1"
      >
        <path d="M2 1 L14 8 L8 9 L11 14 L9 15 L6 10 L2 14 Z" />
      </svg>
      <span
        className="absolute left-3 top-3 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm"
        style={{ backgroundColor: cursor.color }}
      >
        {cursor.name}
      </span>
    </div>
  );
}
