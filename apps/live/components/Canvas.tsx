import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type Ref,
} from 'react';
import {
  arrowThicknessOf,
  DEFAULT_BACKGROUND_COLOR,
  DEFAULT_PATTERN_COLOR,
  defaultFillColor,
  defaultPadding,
  defaultStrokeColor,
  defaultTextAlign,
  defaultTextColor,
  elementBounds,
  isBoxed,
  selectionMembers,
  supportsColours,
  unionBoxedBounds,
  type Anchor,
  type BackgroundPattern,
  type Element,
  type ShapeKind,
  type Tab,
  type TextAlignX,
  type TextAlignY,
  type TextSize,
} from '@livediagram/diagram';
import type { ArrowEnd, DragMode } from '@/lib/canvas';
import type { TemplateKind } from '@/lib/templates';
import { ArrowDefs, ArrowView } from './ArrowView';
import { BoxedElementView } from './BoxedElementView';
import { CommandPalette, type SelectedElementControls } from './CommandPalette';
import { ActivityIcon, ActivityPanel } from './ActivityPanel';
import { Explorer, ExplorerIcon, PaletteIcon } from './Explorer';
import { getTheme } from '@/lib/themes';
import type { ChangeLogEntry } from '@/lib/api-client';
import { DockButton } from './MovablePanel';
import { MultiSelectionToolbar } from './MultiSelectionToolbar';
import { ModeBanner } from './ModeBanner';
import { PlusButton } from './PlusButton';
import { SelectionPopover } from './SelectionPopover';
import { TemplatePicker } from './TemplatePicker';
import { ZoomControls } from './ZoomControls';

type CanvasProps = {
  tabName: string;
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
  canvasTool: import('./CommandPalette').CanvasTool;
  onSetCanvasTool: (tool: import('./CommandPalette').CanvasTool) => void;
  // Map of elementId -> remote participants currently focused on that
  // element. Drives a small badge ring on each element so participants
  // can see in real time what others are working on.
  remoteSelectionsByElement: Map<string, { id: string; name: string; color: string }[]>;
  // Live cursor positions for remote participants — canvas-coords +
  // participant identity. Rendered inside the transformed wrapper so
  // they pan and zoom with the canvas.
  remoteCursors: { id: string; name: string; color: string; x: number; y: number }[];
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
  paletteSize: { width: number; height: number } | null;
  explorerPosition: { x: number; y: number } | null;
  explorerMinimized: boolean;
  explorerSize: { width: number; height: number } | null;
  canUndo: boolean;
  canRedo: boolean;
  onAddShape: (kind: ShapeKind) => void;
  onAddText: () => void;
  onAddSticky: () => void;
  onAddArrow: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onMovePalette: (x: number, y: number) => void;
  onToggleMinimized: () => void;
  onResizePalette: (size: { width: number; height: number }) => void;
  onMoveExplorer: (x: number, y: number) => void;
  onToggleExplorerMinimized: () => void;
  onResizeExplorer: (size: { width: number; height: number }) => void;
  diagramList: { id: string; name: string; savedAt: number }[];
  diagramListLoading: boolean;
  changeLog: ChangeLogEntry[];
  changeLogLoading: boolean;
  activityPosition: { x: number; y: number } | null;
  activityMinimized: boolean;
  activitySize: { width: number; height: number } | null;
  onMoveActivity: (x: number, y: number) => void;
  onToggleActivityMinimized: () => void;
  onResizeActivity: (size: { width: number; height: number }) => void;
  onRevertChange: (entry: ChangeLogEntry) => void;
  onClearActivity: () => void;
  saveStatus: import('./EditorHeader').SaveStatus;
  savedAt: number | null;
  currentDiagramId: string | null;
  onOpenDiagram: (id: string) => void;
  onNewDiagram: () => void;
  onDeselect: () => void;
  onSelect: (id: string) => void;
  onBeginDrag: (id: string, mode: DragMode, e: ReactPointerEvent) => void;
  onBeginAnchorDrag: (id: string, anchor: Anchor, e: ReactPointerEvent) => void;
  onBeginEdit: (id: string) => void;
  onCommitLabel: (id: string, label: string) => void;
  onCancelEdit: () => void;
  onBeginEndpointDrag: (arrowId: string, end: ArrowEnd, e: ReactPointerEvent) => void;
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
  onSetShapeKind: (kind: ShapeKind) => void;
  onDuplicateSelected: () => void;
  tabs: Tab[];
  currentTabId: string;
  onSetLink: (tabId: string) => void;
  onClearLink: () => void;
  onFollowLink: (tabId: string) => void;
  onOpenComments: (elementId: string) => void;
  showTemplatePicker: boolean;
  templatePickerMode: 'welcome' | 'templates' | 'identity';
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
    paletteSize,
    explorerPosition,
    explorerMinimized,
    explorerSize,
    canUndo,
    canRedo,
    onAddShape,
    onAddText,
    onAddSticky,
    onAddArrow,
    onUndo,
    onRedo,
    onMovePalette,
    onToggleMinimized,
    onResizePalette,
    onMoveExplorer,
    onToggleExplorerMinimized,
    onResizeExplorer,
    diagramList,
    diagramListLoading,
    changeLog,
    changeLogLoading,
    activityPosition,
    activityMinimized,
    activitySize,
    onMoveActivity,
    onToggleActivityMinimized,
    onResizeActivity,
    onRevertChange,
    onClearActivity,
    saveStatus,
    savedAt,
    currentDiagramId,
    onOpenDiagram,
    onNewDiagram,
    onDeselect,
    onSelect,
    onBeginDrag,
    onBeginAnchorDrag,
    onBeginEdit,
    onCommitLabel,
    onCancelEdit,
    onBeginEndpointDrag,
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
    onSetShapeKind,
    onDuplicateSelected,
    tabs,
    currentTabId,
    onSetLink,
    onClearLink,
    onFollowLink,
    onOpenComments,
    showTemplatePicker,
    templatePickerMode,
    welcomeOpen,
    selfParticipant,
    onChooseTemplate,
    onSkipTemplatePicker,
    onOpenTemplatePicker,
    tabThemeId,
    onSetTheme,
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
        // Transform is `scale(z) translate(ox, oy)`. Screen-x of canvas
        // point cx = rect.left + (cx + ox) * z. Invert:
        //   cx = (screen-x - rect.left) / z - ox
        const toCanvasX = (sx: number) => (sx - rect.left) / viewportZoom - viewportOffset.x;
        const toCanvasY = (sy: number) => (sy - rect.top) / viewportZoom - viewportOffset.y;
        const minX = Math.min(toCanvasX(m.startX), toCanvasX(m.currentX));
        const maxX = Math.max(toCanvasX(m.startX), toCanvasX(m.currentX));
        const minY = Math.min(toCanvasY(m.startY), toCanvasY(m.currentY));
        const maxY = Math.max(toCanvasY(m.startY), toCanvasY(m.currentY));
        const hits = new Set<string>();
        for (const el of elements) {
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

  // Group-aware selection.
  const memberIds = selectedId
    ? new Set(selectionMembers(elements, selectedId))
    : new Set<string>();
  const selected = selectedId ? (elements.find((el) => el.id === selectedId) ?? null) : null;
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
  const selectedAspectLocked =
    selected && isBoxed(selected) ? selected.aspectLocked === true : false;
  // Single-selection popover hides when a marquee multi-selection is active
  // (a per-element popover doesn't make sense for many elements at once).
  const showPopover =
    selected &&
    editingId !== selected.id &&
    !isPaintMode &&
    !isGroupMode &&
    multiSelectedIds.size === 0;
  const showPlus =
    selected && selectedIsBoxed && editingId !== selected.id && !isPaintMode && !isGroupMode;
  const showHandles = (id: string) =>
    selectedIsBoxed &&
    id === selectedId &&
    memberIds.size === 1 &&
    editingId !== id &&
    !isPaintMode &&
    !isGroupMode &&
    !selectedLocked;
  const showAnchorsFor = (id: string) =>
    selectedIsBoxed &&
    id === selectedId &&
    memberIds.size === 1 &&
    editingId !== id &&
    !isPaintMode &&
    !isGroupMode &&
    !selectedLocked;

  const boxed = elements.filter(isBoxed);
  const arrows = elements.filter((el) => el.type === 'arrow');

  const cursorClass = pan
    ? 'cursor-grabbing'
    : marquee
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
        textSize: isBoxed(selected) ? (selected.textSize ?? 'md') : null,
        textAlignX:
          selected && isBoxed(selected) && selectedDefaultAlign
            ? (selected.textAlignX ?? selectedDefaultAlign.x)
            : null,
        textAlignY:
          selected && isBoxed(selected) && selectedDefaultAlign
            ? (selected.textAlignY ?? selectedDefaultAlign.y)
            : null,
        textColor: isBoxed(selected) ? (selected.textColor ?? defaultTextColor(selected)) : null,
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
        textBold: isBoxed(selected) ? (selected.textBold ?? false) : null,
        textItalic: isBoxed(selected) ? (selected.textItalic ?? false) : null,
        textUnderline: isBoxed(selected) ? (selected.textUnderline ?? false) : null,
        textStrikethrough: isBoxed(selected) ? (selected.textStrikethrough ?? false) : null,
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
        shapeKind: selected.type === 'shape' ? selected.shape : null,
        onSetShapeKind,
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
          // Tool decides the gesture: Pan tool = drag scrolls. Select
          // tool = drag draws a marquee. Holding Space pans regardless
          // (Figma-style override), so power users in Select mode can
          // still scroll without switching tools.
          const wantsPan = spaceHeldRef.current || canvasTool === 'pan';
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
        {boxed.map((element) => (
          <BoxedElementView
            key={element.id}
            element={element}
            isSelected={memberIds.has(element.id) || multiSelectedIds.has(element.id)}
            isMultiSelected={multiSelectedIds.has(element.id)}
            remoteSelectors={remoteSelectionsByElement.get(element.id) ?? []}
            isEditing={element.id === editingId}
            isPaintMode={isPaintMode || isGroupMode}
            showHandles={showHandles(element.id)}
            showAnchors={showAnchorsFor(element.id)}
            zoom={viewportZoom}
            badgeColor={badgeColor}
            onBeginDrag={onBeginDrag}
            onBeginAnchorDrag={onBeginAnchorDrag}
            onBeginEdit={() => onBeginEdit(element.id)}
            onCommitLabel={(label) => onCommitLabel(element.id, label)}
            onCancelEdit={onCancelEdit}
            onFollowLink={onFollowLink}
            onOpenComments={() => onOpenComments(element.id)}
            onContextSelect={() => onSelect(element.id)}
          />
        ))}

        {arrows.length > 0 ? (
          <svg
            className="absolute inset-0 h-full w-full"
            style={{ pointerEvents: 'none', overflow: 'visible' }}
          >
            <ArrowDefs />
            {arrows.map((arrow) => (
              <ArrowView
                key={arrow.id}
                arrow={arrow}
                elements={elements}
                isSelected={arrow.id === selectedId}
                isPaintMode={isPaintMode || isGroupMode}
                onSelect={() => onSelect(arrow.id)}
                onBeginEndpointDrag={(end, e) => onBeginEndpointDrag(arrow.id, end, e)}
              />
            ))}
          </svg>
        ) : null}

        {remoteCursors.map((c) => (
          <RemoteCursor key={c.id} cursor={c} zoom={viewportZoom} />
        ))}

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
            locked={selectedLocked}
            aspectLocked={selectedAspectLocked}
            tabs={tabs}
            currentTabId={currentTabId}
            linkedTabId={
              selected && selected.link && selected.link.kind === 'tab' ? selected.link.tabId : null
            }
            onCopyFormat={
              // Format painter is available for boxed elements (copies
              // width / height) AND arrows (copies stroke / opacity /
              // arrowEnds).
              selected && (isBoxed(selected) || selected.type === 'arrow')
                ? onBeginFormatPainter
                : undefined
            }
            onGroup={selectedIsBoxed && !selectedIsGrouped ? onBeginGroup : undefined}
            onUngroup={selectedIsGrouped ? onUngroup : undefined}
            onToggleAspectLock={selectedIsBoxed ? onToggleAspectLock : undefined}
            onToggleLock={onToggleLockSelected}
            onDuplicate={onDuplicateSelected}
            onSetLink={onSetLink}
            onClearLink={onClearLink}
            onOpenComments={selected ? () => onOpenComments(selected.id) : undefined}
            onDelete={onDeleteSelected}
          />
        ) : null}
      </div>

      {elements.length === 0 && !showTemplatePicker ? (
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
            <p className="mt-3 text-xs leading-relaxed text-slate-600">
              Click an element in the Palette to start building your diagram, double-click anywhere
              to drop text, or connect elements by dragging from their anchor dots.
            </p>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={onOpenTemplatePicker}
              className="pointer-events-auto mt-4 inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
            >
              Browse templates
            </button>
          </div>
        </div>
      ) : null}

      {showTemplatePicker ? (
        <TemplatePicker
          mode={templatePickerMode}
          participant={selfParticipant}
          currentThemeId={tabThemeId}
          onPick={onChooseTemplate}
          onSkip={onSkipTemplatePicker}
        />
      ) : null}

      {multiSelectedIds.size >= 2 ? (
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
        size={explorerSize}
        diagrams={diagramList}
        loading={diagramListLoading}
        currentDiagramId={currentDiagramId}
        onMoveTo={onMoveExplorer}
        onToggleMinimized={onToggleExplorerMinimized}
        onResize={onResizeExplorer}
        onOpenDiagram={onOpenDiagram}
        onNewDiagram={onNewDiagram}
      />

      {/* Activity panel — per-diagram audit log + Undo/Redo. Hidden
          during the welcome flow because there's nothing to audit
          yet and Undo/Redo would target an empty history. */}
      {welcomeOpen ? null : (
        <ActivityPanel
          position={activityPosition}
          minimized={activityMinimized}
          size={activitySize}
          entries={changeLog}
          loading={changeLogLoading}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={onUndo}
          onRedo={onRedo}
          onRevert={onRevertChange}
          onClearActivity={onClearActivity}
          saveStatus={saveStatus}
          savedAt={savedAt}
          onMoveTo={onMoveActivity}
          onResize={onResizeActivity}
          onToggleMinimized={onToggleActivityMinimized}
        />
      )}

      {welcomeOpen ? null : (
        <CommandPalette
          position={palettePosition}
          minimized={paletteMinimized}
          size={paletteSize}
          selection={paletteSelection}
          tab={tabSection}
          canvasTool={canvasTool}
          onSetCanvasTool={onSetCanvasTool}
          onMoveTo={onMovePalette}
          onToggleMinimized={onToggleMinimized}
          onResize={onResizePalette}
          onAddShape={onAddShape}
          onAddText={onAddText}
          onAddSticky={onAddSticky}
          onAddArrow={onAddArrow}
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
                description="Expand the palette back to its full panel."
                icon={<PaletteIcon />}
                onClick={onToggleMinimized}
              />
            ) : null}
            {activityMinimized ? (
              <DockButton
                label="Open Activity"
                description="Expand the Activity panel: changelog, Undo, Redo."
                icon={<ActivityIcon />}
                onClick={onToggleActivityMinimized}
              />
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

// re-export for callers that haven't migrated to specifying default colour.
export { DEFAULT_BACKGROUND_COLOR, DEFAULT_PATTERN_COLOR };
