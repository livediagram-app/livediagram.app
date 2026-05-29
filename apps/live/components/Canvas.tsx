import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type Ref,
} from 'react';
import {
  DEFAULT_BACKGROUND_COLOR,
  DEFAULT_PATTERN_COLOR,
  defaultFillColor,
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
  type TextAlignX,
  type TextAlignY,
  type TextSize,
} from '@livediagram/diagram';
import type { ArrowEnd, DragMode } from '@/lib/canvas';
import type { TemplateKind } from '@/lib/templates';
import { ArrowDefs, ArrowView } from './ArrowView';
import { BoxedElementView } from './BoxedElementView';
import { CommandPalette, type SelectedElementControls } from './CommandPalette';
import { HistoryControls } from './HistoryControls';
import { ModeBanner } from './ModeBanner';
import { PlusButton } from './PlusButton';
import { SelectionPopover } from './SelectionPopover';
import { TemplatePicker } from './TemplatePicker';
import { ZoomControls } from './ZoomControls';

type CanvasProps = {
  tabName: string;
  tabBackgroundPattern: BackgroundPattern;
  tabBackgroundColor: string;
  tabPatternColor: string;
  mainRef: Ref<HTMLElement>;
  viewportOffset: { x: number; y: number };
  setViewportOffset: (offset: { x: number; y: number }) => void;
  viewportZoom: number;
  setViewportZoom: (zoom: number) => void;
  onFitToScreen: () => void;
  elements: Element[];
  selectedId: string | null;
  editingId: string | null;
  formatSourceId: string | null;
  groupSourceId: string | null;
  palettePosition: { x: number; y: number } | null;
  paletteMinimized: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onAddShape: (kind: ShapeKind) => void;
  onAddText: () => void;
  onAddSticky: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onMovePalette: (x: number, y: number) => void;
  onToggleMinimized: () => void;
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
  onSetFillColor: (color: string) => void;
  onSetStrokeColor: (color: string) => void;
  onSetTextColor: (color: string) => void;
  onSetOpacity: (opacity: number) => void;
  onDuplicateSelected: () => void;
  showTemplatePicker: boolean;
  onChooseTemplate: (kind: TemplateKind) => void;
  onSetBackgroundPattern: (pattern: BackgroundPattern) => void;
  onSetBackgroundColor: (color: string) => void;
  onSetPatternColor: (color: string) => void;
  onClearTabContent: () => void;
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
    tabPatternColor,
    mainRef,
    viewportOffset,
    setViewportOffset,
    viewportZoom,
    setViewportZoom,
    onFitToScreen,
    elements,
    selectedId,
    editingId,
    formatSourceId,
    groupSourceId,
    palettePosition,
    paletteMinimized,
    canUndo,
    canRedo,
    onAddShape,
    onAddText,
    onAddSticky,
    onUndo,
    onRedo,
    onMovePalette,
    onToggleMinimized,
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
    onSetFillColor,
    onSetStrokeColor,
    onSetTextColor,
    onSetOpacity,
    onDuplicateSelected,
    showTemplatePicker,
    onChooseTemplate,
    onSetBackgroundPattern,
    onSetBackgroundColor,
    onSetPatternColor,
    onClearTabContent,
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
  const [pan, setPan] = useState<
    | {
        startClientX: number;
        startClientY: number;
        startOffsetX: number;
        startOffsetY: number;
        movedRef: { current: boolean };
      }
    | null
  >(null);

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

  const zoomStep = 0.1;
  const clampZoom = (z: number) => Math.max(0.1, Math.min(5, z));
  const handleZoomIn = () => setViewportZoom(clampZoom(viewportZoom + zoomStep));
  const handleZoomOut = () => setViewportZoom(clampZoom(viewportZoom - zoomStep));
  const handleResetZoom = () => setViewportZoom(1);

  // Group-aware selection.
  const memberIds = selectedId ? new Set(selectionMembers(elements, selectedId)) : new Set<string>();
  const selected = selectedId ? elements.find((el) => el.id === selectedId) ?? null : null;
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
  const selectedAspectLocked = selected && isBoxed(selected) ? selected.aspectLocked === true : false;
  const showPopover = selected && editingId !== selected.id && !isPaintMode && !isGroupMode;
  const showPlus = selected && selectedIsBoxed && editingId !== selected.id && !isPaintMode && !isGroupMode;
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
    : isPaintMode
      ? 'cursor-copy'
      : isGroupMode
        ? 'cursor-crosshair'
        : 'cursor-grab';

  const selectionSupportsColours = selected ? supportsColours(selected) : false;
  const selectedDefaultAlign = selected && isBoxed(selected) ? defaultTextAlign(selected) : null;
  const paletteSelection: SelectedElementControls | null = selected
    ? {
        textSize: isBoxed(selected) ? selected.textSize ?? 'md' : null,
        textAlignX:
          selected && isBoxed(selected) && selectedDefaultAlign
            ? selected.textAlignX ?? selectedDefaultAlign.x
            : null,
        textAlignY:
          selected && isBoxed(selected) && selectedDefaultAlign
            ? selected.textAlignY ?? selectedDefaultAlign.y
            : null,
        textColor: isBoxed(selected)
          ? selected.textColor ?? defaultTextColor(selected)
          : null,
        fillColor:
          selectionSupportsColours && isBoxed(selected)
            ? selected.fillColor ?? defaultFillColor(selected)
            : null,
        strokeColor:
          selectionSupportsColours && isBoxed(selected)
            ? selected.strokeColor ?? defaultStrokeColor(selected)
            : null,
        opacity: selected.opacity ?? 1,
        onBringToFront,
        onSendToBack,
        onSetTextSize,
        onSetTextAlign,
        onSetTextColor,
        onSetFillColor,
        onSetStrokeColor,
        onSetOpacity,
      }
    : null;

  const tabSection = {
    backgroundPattern: tabBackgroundPattern,
    backgroundColor: tabBackgroundColor,
    patternColor: tabPatternColor,
    hasContent: elements.length > 0,
    onSetBackgroundPattern,
    onSetBackgroundColor,
    onSetPatternColor,
    onClearTabContent,
  };

  return (
    <main
      ref={mainRef}
      tabIndex={-1}
      className="relative flex-1 overflow-hidden outline-none"
      style={tabBackgroundStyle(tabBackgroundPattern, viewportOffset, tabBackgroundColor, tabPatternColor)}
    >
      <div
        ref={wrapperRef}
        onPointerDown={(e) => {
          if (e.target !== e.currentTarget) return;
          setPan({
            startClientX: e.clientX,
            startClientY: e.clientY,
            startOffsetX: viewportOffset.x,
            startOffsetY: viewportOffset.y,
            movedRef: { current: false },
          });
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
            isSelected={memberIds.has(element.id)}
            isEditing={element.id === editingId}
            isPaintMode={isPaintMode || isGroupMode}
            showHandles={showHandles(element.id)}
            showAnchors={showAnchorsFor(element.id)}
            zoom={viewportZoom}
            onBeginDrag={onBeginDrag}
            onBeginAnchorDrag={onBeginAnchorDrag}
            onBeginEdit={() => onBeginEdit(element.id)}
            onCommitLabel={(label) => onCommitLabel(element.id, label)}
            onCancelEdit={onCancelEdit}
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
          </>
        ) : null}

        {showPopover && selectionBounds ? (
          <SelectionPopover
            bounds={selectionBounds}
            canvasOffset={viewportOffset}
            zoom={viewportZoom}
            locked={selectedLocked}
            aspectLocked={selectedAspectLocked}
            onCopyFormat={selectedIsBoxed ? onBeginFormatPainter : undefined}
            onGroup={selectedIsBoxed && !selectedIsGrouped ? onBeginGroup : undefined}
            onUngroup={selectedIsGrouped ? onUngroup : undefined}
            onToggleAspectLock={selectedIsBoxed ? onToggleAspectLock : undefined}
            onToggleLock={onToggleLockSelected}
            onDuplicate={onDuplicateSelected}
            onDelete={onDeleteSelected}
          />
        ) : null}
      </div>

      {elements.length === 0 && !showTemplatePicker ? (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 text-center">
          <p className="text-sm font-medium text-slate-500">{tabName}</p>
          <p className="text-xs text-slate-400">
            Use the palette or double-click the canvas. Drag anchor dots to connect elements.
          </p>
        </div>
      ) : null}

      {showTemplatePicker ? <TemplatePicker onSelect={onChooseTemplate} /> : null}

      {isPaintMode ? (
        <ModeBanner
          icon={
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
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
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden>
              <rect x="2.25" y="2.25" width="8" height="8" rx="1.25" />
              <rect x="5.75" y="5.75" width="8" height="8" rx="1.25" fill="white" />
            </svg>
          }
          message="Click another element to add to the group"
          actionLabel="Done"
          onAction={onCancelGroup}
        />
      ) : null}

      <CommandPalette
        position={palettePosition}
        minimized={paletteMinimized}
        selection={paletteSelection}
        tab={tabSection}
        onMoveTo={onMovePalette}
        onToggleMinimized={onToggleMinimized}
        onAddShape={onAddShape}
        onAddText={onAddText}
        onAddSticky={onAddSticky}
      />

      <div className="pointer-events-none absolute bottom-4 right-4 z-10 flex items-center gap-2">
        <ZoomControls
          zoom={viewportZoom}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onReset={handleResetZoom}
          onFitToScreen={onFitToScreen}
        />
        <HistoryControls
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={onUndo}
          onRedo={onRedo}
        />
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

function tabBackgroundStyle(
  pattern: BackgroundPattern,
  offset: { x: number; y: number },
  backgroundColor: string,
  patternColor: string,
): React.CSSProperties {
  const base: React.CSSProperties = { backgroundColor };
  const px = offset.x;
  const py = offset.y;
  switch (pattern) {
    case 'blank':
      return base;
    case 'lines':
      return {
        ...base,
        backgroundImage: `repeating-linear-gradient(0deg, transparent 0 23px, ${patternColor} 23px 24px)`,
        backgroundPosition: `0px ${py}px`,
      };
    case 'crosshatch':
      return {
        ...base,
        backgroundImage:
          `repeating-linear-gradient(45deg, transparent 0 17px, ${patternColor} 17px 18px), ` +
          `repeating-linear-gradient(-45deg, transparent 0 17px, ${patternColor} 17px 18px)`,
        backgroundPosition: `${px}px ${py}px, ${px}px ${py}px`,
      };
    case 'graph':
      return {
        ...base,
        backgroundImage:
          `repeating-linear-gradient(0deg, transparent 0 23px, ${patternColor} 23px 24px), ` +
          `repeating-linear-gradient(90deg, transparent 0 23px, ${patternColor} 23px 24px)`,
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
        backgroundImage: `radial-gradient(circle, ${patternColor} 1px, transparent 1px)`,
        backgroundSize: '24px 24px',
        backgroundPosition: `${px}px ${py}px`,
      };
  }
}

// re-export for callers that haven't migrated to specifying default colour.
export { DEFAULT_BACKGROUND_COLOR, DEFAULT_PATTERN_COLOR };
