import type { PointerEvent as ReactPointerEvent } from 'react';
import {
  defaultFillColor,
  defaultStrokeColor,
  defaultTextAlign,
  defaultTextColor,
  type Anchor,
  type BoxedElement,
  type TextSize,
} from '@livediagram/diagram';
import type { DragMode } from '@/lib/canvas';
import {
  FixedSizeLabel,
  LockBadge,
  MultilineLabel,
  MultilineLabelEditor,
  ResizeHandles,
  ScalingLabel,
  SingleLineLabelEditor,
} from './element-parts';

type BoxedElementViewProps = {
  element: BoxedElement;
  isSelected: boolean;
  isEditing: boolean;
  isPaintMode: boolean;
  showHandles: boolean;
  showAnchors: boolean;
  zoom: number;
  onBeginDrag: (id: string, mode: DragMode, e: ReactPointerEvent) => void;
  onBeginAnchorDrag: (id: string, anchor: Anchor, e: ReactPointerEvent) => void;
  onBeginEdit: () => void;
  onCommitLabel: (label: string) => void;
  onCancelEdit: () => void;
};

export function BoxedElementView({
  element,
  isSelected,
  isEditing,
  isPaintMode,
  showHandles,
  showAnchors,
  zoom,
  onBeginDrag,
  onBeginAnchorDrag,
  onBeginEdit,
  onCommitLabel,
  onCancelEdit,
}: BoxedElementViewProps) {
  const isLocked = element.locked === true;
  const label = element.label ?? '';
  const textSize: TextSize = element.textSize ?? 'scale';
  const defaultAlign = defaultTextAlign(element);
  const alignX = element.textAlignX ?? defaultAlign.x;
  const alignY = element.textAlignY ?? defaultAlign.y;
  const textColor = element.textColor ?? defaultTextColor(element);

  const handleShapeDown = (e: ReactPointerEvent) => {
    if (isEditing) return;
    e.stopPropagation();
    onBeginDrag(element.id, 'move', e);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isEditing) return;
    // Don't gate on isPaintMode here — the page-level beginEdit decides whether
    // edit can start (it rejects during format painter, and exits group mode).
    onBeginEdit();
  };

  const cursor = isPaintMode
    ? 'cursor-copy'
    : isEditing
      ? 'cursor-text'
      : isLocked
        ? 'cursor-default'
        : 'cursor-move';

  const variant = describeVariant(element, isSelected);

  return (
    <div
      onPointerDown={handleShapeDown}
      onDoubleClick={handleDoubleClick}
      className={`absolute touch-none select-none ${variant.className} ${cursor}`}
      style={{
        left: element.x,
        top: element.y,
        width: element.width,
        height: element.height,
        color: textColor,
        opacity: element.opacity ?? 1,
        ...variant.style,
      }}
    >
      {element.type === 'shape' && element.shape === 'diamond' ? (
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden
        >
          <polygon
            points="50,0 100,50 50,100 0,50"
            fill={element.fillColor ?? defaultFillColor(element)}
            stroke={element.strokeColor ?? defaultStrokeColor(element)}
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
          />
        </svg>
      ) : null}

      {renderLabel(element, label, textSize, alignX, alignY, isEditing, onCommitLabel, onCancelEdit)}

      {isLocked ? <LockBadge zoom={zoom} /> : null}

      {showHandles ? (
        <ResizeHandles elementId={element.id} zoom={zoom} onBeginDrag={onBeginDrag} />
      ) : null}

      {showAnchors ? (
        <>
          <AnchorDot anchor="n" elementId={element.id} zoom={zoom} onBeginAnchorDrag={onBeginAnchorDrag} />
          <AnchorDot anchor="e" elementId={element.id} zoom={zoom} onBeginAnchorDrag={onBeginAnchorDrag} />
          <AnchorDot anchor="s" elementId={element.id} zoom={zoom} onBeginAnchorDrag={onBeginAnchorDrag} />
          <AnchorDot anchor="w" elementId={element.id} zoom={zoom} onBeginAnchorDrag={onBeginAnchorDrag} />
        </>
      ) : null}
    </div>
  );
}

const ANCHOR_STYLE: Record<'n' | 'e' | 's' | 'w', React.CSSProperties> = {
  n: { top: 0, left: '50%' },
  e: { top: '50%', left: '100%' },
  s: { top: '100%', left: '50%' },
  w: { top: '50%', left: 0 },
};

function AnchorDot({
  anchor,
  elementId,
  zoom,
  onBeginAnchorDrag,
}: {
  anchor: 'n' | 'e' | 's' | 'w';
  elementId: string;
  zoom: number;
  onBeginAnchorDrag: (id: string, anchor: Anchor, e: ReactPointerEvent) => void;
}) {
  return (
    <div
      role="button"
      aria-label={`Create arrow from ${anchor} anchor`}
      onPointerDown={(e) => {
        e.stopPropagation();
        onBeginAnchorDrag(elementId, anchor, e);
      }}
      style={{
        ...ANCHOR_STYLE[anchor],
        // Counter-scale so the dot stays the same on-screen size at any zoom.
        transform: `translate(-50%, -50%) scale(${1 / zoom})`,
      }}
      className="absolute h-2.5 w-2.5 cursor-crosshair rounded-full border-2 border-white bg-brand-500 shadow-sm transition"
    />
  );
}

function describeVariant(
  element: BoxedElement,
  isSelected: boolean,
): { className: string; style: React.CSSProperties } {
  switch (element.type) {
    case 'shape': {
      const ring = isSelected ? 'ring-2 ring-brand-200' : '';
      // Diamond is drawn via an inner SVG overlay (see below); the wrapper
      // div carries no border/background, just the selection ring.
      if (element.shape === 'diamond') {
        return {
          className: `text-brand-800 ${ring}`,
          style: { borderRadius: '4px' },
        };
      }
      return {
        className: `border-2 text-brand-800 shadow-sm ${ring}`,
        style: {
          borderRadius: element.shape === 'circle' ? '50%' : '8px',
          backgroundColor: element.fillColor ?? defaultFillColor(element),
          borderColor: element.strokeColor ?? defaultStrokeColor(element),
        },
      };
    }
    case 'text': {
      const ring = isSelected
        ? 'ring-2 ring-brand-300 ring-offset-2 ring-offset-white'
        : 'ring-1 ring-dashed ring-slate-300';
      return {
        className: `text-slate-800 rounded-sm ${ring}`,
        style: {},
      };
    }
    case 'sticky': {
      const ring = isSelected ? 'ring-2 ring-brand-200' : '';
      return {
        className: `border text-amber-950 shadow-md ${ring}`,
        style: {
          borderRadius: '4px',
          backgroundColor: element.fillColor ?? defaultFillColor(element),
          borderColor: element.strokeColor ?? defaultStrokeColor(element),
        },
      };
    }
  }
}

function renderLabel(
  element: BoxedElement,
  label: string,
  textSize: TextSize,
  alignX: import('@livediagram/diagram').TextAlignX,
  alignY: import('@livediagram/diagram').TextAlignY,
  isEditing: boolean,
  onCommitLabel: (label: string) => void,
  onCancelEdit: () => void,
) {
  const isSticky = element.type === 'sticky';
  const placeholder = element.type === 'text' ? 'Text' : isSticky ? 'Note' : 'Label';

  if (isEditing) {
    if (isSticky) {
      return (
        <MultilineLabelEditor
          initial={label}
          placeholder={placeholder}
          textSize={textSize}
          alignX={alignX}
          onCommit={onCommitLabel}
          onCancel={onCancelEdit}
          textClassName="text-amber-950 placeholder:text-amber-700/50"
        />
      );
    }
    const textClass =
      element.type === 'text'
        ? 'text-slate-800 placeholder:text-slate-400'
        : 'text-brand-800 placeholder:text-brand-300';
    return (
      <SingleLineLabelEditor
        initial={label}
        placeholder={placeholder}
        alignX={alignX}
        onCommit={onCommitLabel}
        onCancel={onCancelEdit}
        textClassName={textClass}
      />
    );
  }

  if (isSticky) {
    return (
      <MultilineLabel
        text={label}
        placeholder={placeholder}
        textSize={textSize}
        alignX={alignX}
        alignY={alignY}
        className="text-amber-950"
      />
    );
  }

  if (textSize === 'scale') {
    if (!label) return null;
    return <ScalingLabel text={label} alignX={alignX} alignY={alignY} />;
  }

  return <FixedSizeLabel text={label} size={textSize} alignX={alignX} alignY={alignY} />;
}
