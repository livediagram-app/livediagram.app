import {
  useEffect,
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
  endpointPosition,
  isBoxed,
  selectionMembers,
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
import type { ArrowEnd, DragMode } from '@/lib/canvas';
import type { TemplateKind } from '@/lib/templates';
import { ArrowDefs, ArrowView } from './ArrowView';
import { BoxedElementView } from './BoxedElementView';
import { CommandPalette, type CanvasTool, type SelectedElementControls } from './CommandPalette';
import { UnionResizeHandles } from './element-parts';
import { ActivityIcon, ActivityPanel, RedoIcon, UndoIcon } from './ActivityPanel';
import { ContextIcon, ContextPanel } from './ContextPanel';
import { Explorer, ExplorerIcon, PaletteIcon } from './Explorer';
import { LaserOverlay } from './LaserOverlay';
import { getTheme } from '@/lib/themes';
import type { ChangeLogEntry } from '@/lib/api-client';
import { DockButton } from './MovablePanel';
import { MultiSelectionToolbar } from './MultiSelectionToolbar';
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
import { Tooltip } from './Tooltip';
import { ZoomControls } from './ZoomControls';

type CanvasProps = {
  tabName: string;
  tabLocked: boolean;
  // True for a view-only ('view' share role) session: the editing chrome
  // (command palette, selection + multi-select toolbars) is suppressed.
  readOnly: boolean;
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
  paletteMinimized: boolean;
  explorerPosition: { x: number; y: number } | null;
  explorerMinimized: boolean;
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
  onUndo: () => void;
  onRedo: () => void;
  onMovePalette: (x: number, y: number) => void;
  onToggleMinimized: () => void;
  onResetPalette: () => void;
  onMoveExplorer: (x: number, y: number) => void;
  onToggleExplorerMinimized: () => void;
  onResetExplorer: () => void;
  diagramList: { id: string; name: string; folderId: string | null; savedAt: number }[];
  folders: { id: string; parentId: string | null; name: string }[];
  // Shared-with-you list. Empty by default so legacy callers can
  // omit it.
  sharedDiagrams?: {
    id: string;
    name: string;
    savedAt: number;
    role: 'edit' | 'view';
    shareCode: string;
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
  contextPosition: { x: number; y: number } | null;
  contextMinimized: boolean;
  onMoveContext: (x: number, y: number) => void;
  onToggleContextMinimized: () => void;
  onResetContext: () => void;
  // Lifted accordion state for the Editor panel's Current Tab
  // section so external triggers (Activity row click) can pop the
  // matching accordion.
  tabAccordionsOpen: import('./CommandPalette').TabAccordionState;
  setTabAccordionsOpen: React.Dispatch<
    React.SetStateAction<import('./CommandPalette').TabAccordionState>
  >;
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
  onBeginAnchorDrag: (id: string, anchor: Anchor, e: ReactPointerEvent) => void;
  onBeginEdit: (id: string) => void;
  onCommitLabel: (id: string, label: string) => void;
  onCancelEdit: () => void;
  onBeginEndpointDrag: (arrowId: string, end: ArrowEnd, e: ReactPointerEvent) => void;
  onBeginArrowCurveDrag: (arrowId: string, e: ReactPointerEvent) => void;
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
    diagramName,
    tabBackgroundPattern,
    tabBackgroundColor,
    tabBackgroundOpacity,
    tabPatternColor,
    mainRef,
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
    paletteMinimized,
    explorerPosition,
    explorerMinimized,
    canUndo,
    canRedo,
    onAddShape,
    onAddText,
    onAddSticky,
    onAddImage,
    onAddArrow,
    onUndo,
    onRedo,
    onMovePalette,
    onToggleMinimized,
    onResetPalette,
    onMoveExplorer,
    onToggleExplorerMinimized,
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
    contextPosition,
    contextMinimized,
    tabAccordionsOpen,
    setTabAccordionsOpen,
    onMoveContext,
    onToggleContextMinimized,
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
    onBeginAnchorDrag,
    onBeginEdit,
    onCommitLabel,
    onCancelEdit,
    onBeginEndpointDrag,
    onBeginArrowCurveDrag,
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
    onSetBackgroundPattern,
    onSetBackgroundColor,
    onSetBackgroundOpacity,
    onSetPatternColor,
    onToggleAspectLock,
    onDuplicateConnect,
    onToggleLockSelected,
    onDeleteSelected,
    onCanvasDoubleClick,
  } = props;

  const wrapperRef = useRef<HTMLDivElement>(null);

  const isPaintMode = formatSourceId !== null;
  const isGroupMode = groupSourceId !== null;

  // Pan tracking. viewportOffset is owned by the page (so element placement
  // can reason about the visible viewport); we just read/write through props.
  // Palette's rendered height. The ContextPanel uses this to stack
  // dynamically below the Palette as accordions open / close;
  // MovablePanel publishes its bounding box via onSize.
  const [paletteHeight, setPaletteHeight] = useState<number>(0);

  const [pan, setPan] = useState<{
    startClientX: number;
    startClientY: number;
    startOffsetX: number;
    startOffsetY: number;
    movedRef: { current: boolean };
  } | null>(null);

  // Marquee box-select state. Stored in client (screen) coords; only
  // converted to canvas coords on release for the intersection test.
  const [marquee, setMarquee] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);

  // Held-Space modifier turns canvas drag into a pan instead of a marquee
  // (same vocabulary as Figma / Excalidraw). Tracked via a ref so the
  // pointerdown handler always sees the current value without re-binding.
  const spaceHeldRef = useRef(false);
  useEffect(() => {
    const isTypingTarget = (t: EventTarget | null) =>
      t instanceof HTMLInputElement ||
      t instanceof HTMLTextAreaElement ||
      (t instanceof HTMLElement && t.isContentEditable);
    const down = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      if (isTypingTarget(e.target)) return;
      // Stop the page from scroll-jumping while space is held over the
      // canvas. Doesn't affect inputs because we return above for those.
      e.preventDefault();
      spaceHeldRef.current = true;
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      spaceHeldRef.current = false;
    };
    document.addEventListener('keydown', down);
    document.addEventListener('keyup', up);
    return () => {
      document.removeEventListener('keydown', down);
      document.removeEventListener('keyup', up);
    };
  }, []);

  useEffect(() => {
    if (!pan) return;
    const onMove = (e: PointerEvent) => {
      // Pan offset is stored in canvas-coords; mouse delta is screen-coords.
      // Divide by zoom so a 100px screen drag = 100/zoom canvas-pixels pan.
      const dx = (e.clientX - pan.startClientX) / viewportZoom;
      const dy = (e.clientY - pan.startClientY) / viewportZoom;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) pan.movedRef.current = true;
      setViewportOffset({ x: pan.startOffsetX + dx, y: pan.startOffsetY + dy });
    };
    const onUp = () => {
      if (!pan.movedRef.current) onDeselect();
      setPan(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [pan, onDeselect, setViewportOffset, viewportZoom]);

  // Marquee drag: track the current pointer position and, on release,
  // convert the screen-coord rect to canvas coords and test each boxed
  // element's bounding box for intersection. Sub-4-pixel marquees are
  // treated as plain clicks (just deselect).
  useEffect(() => {
    if (!marquee) return;
    const onMove = (e: PointerEvent) => {
      setMarquee((m) => (m ? { ...m, currentX: e.clientX, currentY: e.clientY } : null));
    };
    const onUp = () => {
      const m = marquee;
      if (!m) return;
      const dragWidth = Math.abs(m.currentX - m.startX);
      const dragHeight = Math.abs(m.currentY - m.startY);
      if (dragWidth < 4 && dragHeight < 4) {
        onDeselect();
        setMarquee(null);
        return;
      }
      const wrapper = wrapperRef.current;
      if (wrapper) {
        const rect = wrapper.getBoundingClientRect();
        // Wrapper has `transform: scale(z) translate(ox, oy)` with
        // origin: center. getBoundingClientRect returns the
        // post-transform box, which ALREADY accounts for the
        // translate. Working through the matrix:
        //   screen.x = rect.left + z * cx
        // so the inverse is just (screen.x - rect.left) / z — no
        // extra `- ox`. The old version subtracted the offset on
        // top of the rect that already had it baked in, throwing
        // intersection bounds off by the pan amount and making the
        // marquee silently miss every element on a panned canvas.
        const toCanvasX = (sx: number) => (sx - rect.left) / viewportZoom;
        const toCanvasY = (sy: number) => (sy - rect.top) / viewportZoom;
        const minX = Math.min(toCanvasX(m.startX), toCanvasX(m.currentX));
        const maxX = Math.max(toCanvasX(m.startX), toCanvasX(m.currentX));
        const minY = Math.min(toCanvasY(m.startY), toCanvasY(m.currentY));
        const maxY = Math.max(toCanvasY(m.startY), toCanvasY(m.currentY));
        const hits = new Set<string>();
        for (const el of elements) {
          if (el.type === 'arrow') {
            // Arrow AABB: bounds of the (from, to) segment. Good
            // enough for marquee inclusion — connecting two selected
            // shapes always intersects the marquee they sit inside,
            // and lone arrows are caught when their bbox overlaps.
            const from = endpointPosition(el.from, elements);
            const to = endpointPosition(el.to, elements);
            const aMinX = Math.min(from.x, to.x);
            const aMaxX = Math.max(from.x, to.x);
            const aMinY = Math.min(from.y, to.y);
            const aMaxY = Math.max(from.y, to.y);
            if (aMinX < maxX && aMaxX > minX && aMinY < maxY && aMaxY > minY) {
              hits.add(el.id);
            }
            continue;
          }
          if (!isBoxed(el)) continue;
          // Standard rect-rect intersection test (open intervals).
          if (el.x < maxX && el.x + el.width > minX && el.y < maxY && el.y + el.height > minY) {
            hits.add(el.id);
          }
        }
        onSelectMarquee(hits);
      }
      setMarquee(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [marquee, elements, viewportZoom, viewportOffset, onSelectMarquee, onDeselect]);

  const zoomStep = 0.1;
  const clampZoom = (z: number) => Math.max(0.1, Math.min(5, z));
  const handleZoomIn = () => setViewportZoom(clampZoom(viewportZoom + zoomStep));
  const handleZoomOut = () => setViewportZoom(clampZoom(viewportZoom - zoomStep));
  const handleResetZoom = () => setViewportZoom(1);

  // Group-aware selection. `selected` is the editor's primary
  // element (single-click, group root, or first member of a marquee
  // multi-selection). Multi-select promotes the first selected
  // boxed element so the Editor panel can read shared properties
  // from it; setters in the editor bulk-apply across all selected
  // members.
  const memberIds = selectedId
    ? new Set(selectionMembers(elements, selectedId))
    : new Set<string>();
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

  // Cached counts only. Render loops iterate `elements` directly so
  // arrows and boxed elements interleave in z-order (see render
  // block below); the only thing we still need eagerly is "are
  // there any arrows" to decide whether to mount the ArrowDefs.
  const arrowCount = elements.reduce((n, el) => (el.type === 'arrow' ? n + 1 : n), 0);

  const cursorClass = pan
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
        borderStroke: selected.type === 'shape' ? (selected.strokeWidth ?? 'medium') : null,
        borderStyle: selected.type === 'shape' ? (selected.strokeStyle ?? 'solid') : null,
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
        if (e.target !== e.currentTarget) return;
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
      className="relative flex-1 overflow-hidden outline-none"
      style={tabBackgroundStyle(
        tabBackgroundPattern,
        viewportOffset,
        tabBackgroundColor,
        tabPatternColor,
        tabBackgroundOpacity,
      )}
    >
      <div
        ref={wrapperRef}
        onPointerDown={(e) => {
          if (e.target !== e.currentTarget) return;
          // Tool decides the gesture:
          //  - Pan tool / Space / Laser tool → drag scrolls. Laser
          //    drags pan because mid-presentation a click-drag is far
          //    more often "I want to reposition the canvas" than "I
          //    want to multi-select", and a pan is the safe no-op
          //    when the presenter is just steadying their hand. The
          //    trail keeps capturing pointer-moves throughout, so
          //    the pan reads as a sweeping laser to peers.
          //  - Select tool → drag draws a marquee for multi-select.
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
        className={`absolute inset-0 origin-center ${cursorClass}`}
        style={{
          // Translate is in canvas-coords (applied first); scale is centred
          // on the wrapper so zooming keeps the viewport centre stable.
          transform: `scale(${viewportZoom}) translate(${viewportOffset.x}px, ${viewportOffset.y}px)`,
        }}
      >
        {/* Shared arrowhead defs. Multiple per-arrow <svg>s below
            all reference url(#arrowhead) — defs are document-scoped
            in SVG so a single defs node lets every arrow render
            with the same marker. */}
        {arrowCount > 0 ? (
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
                  onSelect={(e) => {
                    // Mirror the boxed-element click semantics so arrows
                    // can be included in marquee multi-selections via
                    // plain click (when one is active) or Shift-click.
                    const isMember = multiSelectedIds.has(element.id);
                    if (e.shiftKey || (multiSelectedIds.size > 0 && !isMember)) {
                      onShiftSelect(element.id);
                      return;
                    }
                    onSelect(element.id);
                  }}
                  onBeginEndpointDrag={(end, e) => onBeginEndpointDrag(element.id, end, e)}
                  onBeginEdit={() => onBeginEdit(element.id)}
                  onCommitLabel={(label) => onCommitLabel(element.id, label)}
                  onCancelEdit={onCancelEdit}
                  onBeginTranslate={(e) => onBeginArrowTranslate(element.id, e)}
                  onBeginCurveDrag={(e) => onBeginArrowCurveDrag(element.id, e)}
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
              remoteSelectors={remoteSelectionsByElement.get(element.id) ?? []}
              isEditing={element.id === editingId}
              isPaintMode={isPaintMode || isGroupMode}
              showHandles={showHandles(element.id)}
              showAnchors={showAnchorsFor(element.id)}
              zoom={viewportZoom}
              badgeColor={badgeColor}
              tabLocked={tabLocked}
              onBeginDrag={onBeginDrag}
              onShiftSelect={onShiftSelect}
              onBeginAnchorDrag={onBeginAnchorDrag}
              onBeginEdit={() => onBeginEdit(element.id)}
              onCommitLabel={(label) => onCommitLabel(element.id, label)}
              onCancelEdit={onCancelEdit}
              onFollowLink={onFollowLink}
              onOpenComments={() => onOpenComments(element.id)}
              onOpenNote={onOpenNote ? () => onOpenNote(element.id) : undefined}
              imageContext={imageContext}
              onContextSelect={(sx, sy) => {
                onSelect(element.id);
                onElementContextMenu?.(element.id, sx, sy);
              }}
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

        {showPopover && selectionBounds ? (
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
        ) : null}
      </div>

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

      {/* Explorer is the one piece of chrome that stays visible during
          the welcome flow — the sign-up nudge is genuinely useful there
          and lives outside the diagram's controls. */}
      <Explorer
        position={explorerPosition}
        minimized={explorerMinimized}
        diagrams={diagramList}
        folders={folders}
        loading={diagramListLoading}
        shared={sharedDiagrams}
        onDismissShared={onDismissShared}
        onOpenFullExplorer={onOpenFullExplorer}
        currentDiagramId={currentDiagramId}
        onMoveTo={onMoveExplorer}
        onToggleMinimized={onToggleExplorerMinimized}
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
      />

      {/* Activity panel — per-diagram audit log + Undo/Redo. Hidden
          during the welcome flow because there's nothing to audit
          yet and Undo/Redo would target an empty history. */}
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

      {readOnly && (
        <div className="pointer-events-none absolute left-1/2 top-3 z-30 -translate-x-1/2 rounded-full bg-slate-900/80 px-3 py-1 text-xs font-medium text-white shadow-sm">
          View only
        </div>
      )}
      {welcomeOpen || readOnly ? null : (
        <CommandPalette
          position={palettePosition}
          minimized={paletteMinimized}
          canvasTool={canvasTool}
          onSetCanvasTool={onSetCanvasTool}
          onMoveTo={onMovePalette}
          onToggleMinimized={onToggleMinimized}
          onReset={onResetPalette}
          onAddShape={onAddShape}
          onAddText={onAddText}
          onAddSticky={onAddSticky}
          onAddImage={onAddImage}
          onAddArrow={onAddArrow}
          onSize={(size) => setPaletteHeight(size.height)}
        />
      )}

      {welcomeOpen || readOnly ? null : (
        <ContextPanel
          position={contextPosition}
          minimized={contextMinimized}
          selection={paletteSelection}
          selectionScope={selectionScope}
          tab={tabSection}
          tabAccordionsOpen={tabAccordionsOpen}
          setTabAccordionsOpen={setTabAccordionsOpen}
          onMoveTo={onMoveContext}
          onToggleMinimized={onToggleContextMinimized}
          onReset={onResetContext}
          // Palette's bottom edge: its top corner (top-4 = 16) plus
          // its measured height. ContextPanel adds another 16px gap.
          // When paletteHeight is 0 (first paint, before the observer
          // fires) MovablePanel falls back to its legacy static
          // top-[15rem] so the panel never lands at 0,0.
          stackBelowY={paletteMinimized || paletteHeight === 0 ? undefined : 16 + paletteHeight}
        />
      )}

      {/* Bottom dock. Order, left → right: minimised Explorer (if any),
          minimised Palette (if any), Zoom controls, History controls.
          During the welcome flow only the minimised Explorer dock button
          is rendered — Palette / Zoom / History are all suppressed. */}
      <div className="pointer-events-none absolute bottom-4 right-4 z-10 flex items-center gap-2">
        {explorerMinimized ? (
          <DockButton
            label="Open Explorer"
            description="Expand the Explorer panel back to its full size."
            icon={<ExplorerIcon />}
            onClick={onToggleExplorerMinimized}
          />
        ) : null}
        {welcomeOpen ? null : (
          <>
            {paletteMinimized ? (
              <DockButton
                label="Open palette"
                description="Expand the Palette."
                icon={<PaletteIcon />}
                onClick={onToggleMinimized}
              />
            ) : null}
            {contextMinimized && !readOnly ? (
              <DockButton
                label="Open Editor"
                description="Expand the Editor panel."
                icon={<ContextIcon />}
                onClick={onToggleContextMinimized}
              />
            ) : null}
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
                      className="flex h-11 w-11 items-center justify-center border-r border-slate-200 text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
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

// Compose the canvas main element's background pattern + pan offset so the
// pattern persists indefinitely as the user pans (it tiles forever, just
// shifting its phase by the canvas-coord offset).
// Confetti uses a fixed multi-colour SVG so the pattern reads as "fun"
// regardless of the user's pattern colour. # is URL-encoded as %23.
const CONFETTI_BG =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='60' height='60'>" +
  "<circle cx='8' cy='12' r='2' fill='%23f87171'/>" +
  "<circle cx='25' cy='8' r='1.5' fill='%2360a5fa'/>" +
  "<circle cx='42' cy='15' r='2' fill='%23facc15'/>" +
  "<circle cx='52' cy='5' r='1.5' fill='%2334d399'/>" +
  "<circle cx='5' cy='30' r='1.5' fill='%23a78bfa'/>" +
  "<circle cx='20' cy='38' r='2' fill='%23fb923c'/>" +
  "<circle cx='38' cy='32' r='1.5' fill='%23ec4899'/>" +
  "<circle cx='50' cy='42' r='2' fill='%2334d399'/>" +
  "<circle cx='10' cy='50' r='2' fill='%2360a5fa'/>" +
  "<circle cx='30' cy='52' r='1.5' fill='%23facc15'/>" +
  "<circle cx='45' cy='55' r='2' fill='%23f87171'/>" +
  '</svg>")';

// Apply the user-controlled tab background opacity by converting the
// `#rrggbb` colour to `rgba(...)` with the supplied alpha. Hex parsing
// is permissive — anything else falls back to the colour as-is so a
// theme that ships a CSS keyword doesn't break.
function applyAlpha(color: string, alpha: number): string {
  if (alpha >= 1) return color;
  const match = /^#?([0-9a-f]{6})$/i.exec(color);
  if (!match) return color;
  const hex = match[1]!;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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

function tabBackgroundStyle(
  pattern: BackgroundPattern,
  offset: { x: number; y: number },
  backgroundColor: string,
  patternColor: string,
  backgroundOpacity = 1,
): React.CSSProperties {
  const base: React.CSSProperties = {
    backgroundColor: applyAlpha(backgroundColor, backgroundOpacity),
  };
  // Apply the same alpha to the pattern colour so the lines / dots /
  // crosshatch fade in lockstep with the backdrop. Without this the
  // slider visually "stops working" before the pattern lines do — they
  // remain at full opacity over a faded background, which reads as a
  // bug. Confetti uses a precomposed inline SVG so it's unaffected.
  const fadedPatternColor = applyAlpha(patternColor, backgroundOpacity);
  const px = offset.x;
  const py = offset.y;
  switch (pattern) {
    case 'blank':
      return base;
    case 'lines':
      return {
        ...base,
        backgroundImage: `repeating-linear-gradient(0deg, transparent 0 23px, ${fadedPatternColor} 23px 24px)`,
        backgroundPosition: `0px ${py}px`,
      };
    case 'crosshatch':
      return {
        ...base,
        backgroundImage:
          `repeating-linear-gradient(45deg, transparent 0 17px, ${fadedPatternColor} 17px 18px), ` +
          `repeating-linear-gradient(-45deg, transparent 0 17px, ${fadedPatternColor} 17px 18px)`,
        backgroundPosition: `${px}px ${py}px, ${px}px ${py}px`,
      };
    case 'graph':
      return {
        ...base,
        backgroundImage:
          `repeating-linear-gradient(0deg, transparent 0 23px, ${fadedPatternColor} 23px 24px), ` +
          `repeating-linear-gradient(90deg, transparent 0 23px, ${fadedPatternColor} 23px 24px)`,
        backgroundPosition: `0px ${py}px, ${px}px 0px`,
      };
    case 'confetti':
      return {
        ...base,
        backgroundImage: CONFETTI_BG,
        backgroundSize: '60px 60px',
        backgroundPosition: `${px}px ${py}px`,
      };
    case 'stripes':
      // Vertical lines counterpart to the existing horizontal 'lines'.
      return {
        ...base,
        backgroundImage: `repeating-linear-gradient(90deg, transparent 0 23px, ${fadedPatternColor} 23px 24px)`,
        backgroundPosition: `${px}px 0px`,
      };
    case 'diagonal':
      // Single-direction 45° lines — distinct from crosshatch's two.
      return {
        ...base,
        backgroundImage: `repeating-linear-gradient(45deg, transparent 0 17px, ${fadedPatternColor} 17px 18px)`,
        backgroundPosition: `${px}px ${py}px`,
      };
    case 'waves':
      // Gentle sinusoidal stripes via inline SVG. Reads as a soft
      // texture, not a structural grid.
      return {
        ...base,
        backgroundImage: wavesBg(fadedPatternColor),
        backgroundSize: '48px 24px',
        backgroundPosition: `${px}px ${py}px`,
      };
    case 'bricks':
      // Staggered horizontal lines + alternating vertical separators
      // give a brick masonry impression without an SVG. Even rows
      // use full-cell separators; we fake the staggered offset by
      // tiling at 2x the cell height.
      return {
        ...base,
        backgroundImage:
          `repeating-linear-gradient(0deg, ${fadedPatternColor} 0 1px, transparent 1px 18px), ` +
          `repeating-linear-gradient(90deg, ${fadedPatternColor} 0 1px, transparent 1px 36px)`,
        backgroundSize: '36px 18px',
        backgroundPosition: `${px}px ${py}px, ${(px + 18) % 36}px ${py}px`,
      };
    case 'plus':
      // Sprinkled + signs via inline SVG. Uses currentColor would
      // require additional wrapping; we inline the patternColor.
      return {
        ...base,
        backgroundImage: plusBg(fadedPatternColor),
        backgroundSize: '32px 32px',
        backgroundPosition: `${px}px ${py}px`,
      };
    case 'stars':
      // Sprinkled stars via inline SVG.
      return {
        ...base,
        backgroundImage: starBg(fadedPatternColor),
        backgroundSize: '48px 48px',
        backgroundPosition: `${px}px ${py}px`,
      };
    case 'grid':
    default:
      return {
        ...base,
        backgroundImage: `radial-gradient(circle, ${fadedPatternColor} 1px, transparent 1px)`,
        backgroundSize: '24px 24px',
        backgroundPosition: `${px}px ${py}px`,
      };
  }
}

// Inline-SVG backgrounds for the patterns whose glyphs can't be built
// from linear-gradient stripes. URL-encoded so they can sit inside a
// CSS `url(...)` value — `#` MUST become `%23`. Both patterns pick up
// the tab's `patternColor` (already alpha-adjusted by the caller).
function plusBg(stroke: string): string {
  const enc = stroke.replace(/#/g, '%23');
  return (
    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32'>" +
    `<path d='M16 10 L16 22 M10 16 L22 16' stroke='${enc}' stroke-width='1.5' stroke-linecap='round' fill='none'/>` +
    '</svg>")'
  );
}

function wavesBg(stroke: string): string {
  const enc = stroke.replace(/#/g, '%23');
  // Sine wave tile — quadratic peaks/troughs across a 48-wide span
  // so the pattern reads as gentle horizontal ripples. Stroke width
  // is intentionally light so the texture stays subtle.
  return (
    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='48' height='24'>" +
    `<path d='M0 12 Q12 4 24 12 T48 12' fill='none' stroke='${enc}' stroke-width='1'/>` +
    '</svg>")'
  );
}

function starBg(stroke: string): string {
  const enc = stroke.replace(/#/g, '%23');
  // Five-point star path centred at (24, 24) with radius ~5.
  return (
    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48'>" +
    `<path d='M24 19 L25.5 22.5 L29 23 L26.5 25.5 L27 29 L24 27.5 L21 29 L21.5 25.5 L19 23 L22.5 22.5 Z' fill='${enc}'/>` +
    '</svg>")'
  );
}
