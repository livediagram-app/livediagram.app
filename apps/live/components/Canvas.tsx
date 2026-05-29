import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type Ref,
} from 'react';
import {
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
import { ArrowDefs, ArrowView } from './ArrowView';
import { BoxedElementView } from './BoxedElementView';
import { CommandPalette, type SelectedElementControls } from './CommandPalette';
import { ModeBanner } from './ModeBanner';
import { PlusButton } from './PlusButton';
import { SelectionPopover } from './SelectionPopover';

type CanvasProps = {
  tabName: string;
  tabBackgroundPattern: BackgroundPattern;
  mainRef: Ref<HTMLElement>;
  viewportOffset: { x: number; y: number };
  setViewportOffset: (offset: { x: number; y: number }) => void;
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
  onSetBackgroundPattern: (pattern: BackgroundPattern) => void;
  onToggleAspectLock: () => void;
  onDuplicateConnect: (direction: 'right' | 'below') => void;
  onToggleLockSelected: () => void;
  onDeleteSelected: () => void;
  onCanvasDoubleClick: (x: number, y: number) => void;
};

export function Canvas(props: CanvasProps) {
  const {
    tabName,
    tabBackgroundPattern,
    mainRef,
    viewportOffset,
    setViewportOffset,
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
    onSetBackgroundPattern,
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
      const dx = e.clientX - pan.startClientX;
      const dy = e.clientY - pan.startClientY;
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
  }, [pan, onDeselect, setViewportOffset]);

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
        onBringToFront,
        onSendToBack,
        onSetTextSize,
        onSetTextAlign,
        onSetTextColor,
        onSetFillColor,
        onSetStrokeColor,
      }
    : null;

  const tabSection = {
    backgroundPattern: tabBackgroundPattern,
    onSetBackgroundPattern,
  };

  return (
    <main
      ref={mainRef}
      tabIndex={-1}
      className="relative flex-1 overflow-hidden bg-white outline-none"
      style={tabBackgroundStyle(tabBackgroundPattern, viewportOffset)}
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
          onCanvasDoubleClick(e.clientX - rect.left, e.clientY - rect.top);
        }}
        className={`absolute inset-0 ${cursorClass}`}
        style={{
          transform: `translate(${viewportOffset.x}px, ${viewportOffset.y}px)`,
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
              onClick={() => onDuplicateConnect('right')}
            />
            <PlusButton
              x={selectionBounds.x + selectionBounds.width / 2}
              y={selectionBounds.y + selectionBounds.height}
              placement="below"
              onClick={() => onDuplicateConnect('below')}
            />
          </>
        ) : null}

        {showPopover && selectionBounds ? (
          <SelectionPopover
            bounds={selectionBounds}
            canvasOffset={viewportOffset}
            locked={selectedLocked}
            aspectLocked={selectedAspectLocked}
            onCopyFormat={selectedIsBoxed ? onBeginFormatPainter : undefined}
            onGroup={selectedIsBoxed && !selectedIsGrouped ? onBeginGroup : undefined}
            onUngroup={selectedIsGrouped ? onUngroup : undefined}
            onToggleAspectLock={selectedIsBoxed ? onToggleAspectLock : undefined}
            onToggleLock={onToggleLockSelected}
            onDelete={onDeleteSelected}
          />
        ) : null}
      </div>

      {elements.length === 0 ? (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 text-center">
          <p className="text-sm font-medium text-slate-500">{tabName}</p>
          <p className="text-xs text-slate-400">
            Use the palette or double-click the canvas. Drag anchor dots to connect elements.
          </p>
        </div>
      ) : null}

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
        canUndo={canUndo}
        canRedo={canRedo}
        selection={paletteSelection}
        tab={tabSection}
        onMoveTo={onMovePalette}
        onToggleMinimized={onToggleMinimized}
        onAddShape={onAddShape}
        onAddText={onAddText}
        onAddSticky={onAddSticky}
        onUndo={onUndo}
        onRedo={onRedo}
      />
    </main>
  );
}

// Compose the canvas main element's background pattern + pan offset so the
// pattern persists indefinitely as the user pans (it tiles forever, just
// shifting its phase by the canvas-coord offset).
function tabBackgroundStyle(
  pattern: BackgroundPattern,
  offset: { x: number; y: number },
): React.CSSProperties {
  const px = offset.x;
  const py = offset.y;
  if (pattern === 'blank') return {};
  if (pattern === 'lines') {
    return {
      backgroundImage:
        'repeating-linear-gradient(0deg, transparent 0, transparent 23px, rgb(203 213 225) 23px, rgb(203 213 225) 24px)',
      backgroundPosition: `0px ${py}px`,
    };
  }
  // grid (default)
  return {
    backgroundImage: 'radial-gradient(circle, rgb(203 213 225) 1px, transparent 1px)',
    backgroundSize: '24px 24px',
    backgroundPosition: `${px}px ${py}px`,
  };
}
