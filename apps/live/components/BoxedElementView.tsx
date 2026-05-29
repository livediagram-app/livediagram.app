import type { PointerEvent as ReactPointerEvent } from 'react';
import {
  defaultFillColor,
  defaultStrokeColor,
  defaultTextAlign,
  defaultTextColor,
  type Anchor,
  type BoxedElement,
  type ShapeKind,
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
  onFollowLink: (tabId: string) => void;
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
  onFollowLink,
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
      className={`absolute origin-center animate-pop-in touch-none select-none ${variant.className} ${cursor}`}
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
      {element.type === 'shape' && isSvgRenderedShape(element.shape) ? (
        <ShapeSvgOverlay
          shape={element.shape}
          fill={element.fillColor ?? defaultFillColor(element)}
          stroke={element.strokeColor ?? defaultStrokeColor(element)}
        />
      ) : null}

      {renderLabel(
        element,
        label,
        textSize,
        alignX,
        alignY,
        isEditing,
        onCommitLabel,
        onCancelEdit,
      )}

      {isLocked ? <LockBadge zoom={zoom} /> : null}

      {element.link && element.link.kind === 'tab' ? (
        <LinkBadge zoom={zoom} onFollow={() => onFollowLink(element.link!.tabId)} />
      ) : null}

      {showHandles ? (
        <ResizeHandles elementId={element.id} zoom={zoom} onBeginDrag={onBeginDrag} />
      ) : null}

      {showAnchors ? (
        <>
          <AnchorDot
            anchor="n"
            elementId={element.id}
            zoom={zoom}
            onBeginAnchorDrag={onBeginAnchorDrag}
          />
          <AnchorDot
            anchor="e"
            elementId={element.id}
            zoom={zoom}
            onBeginAnchorDrag={onBeginAnchorDrag}
          />
          <AnchorDot
            anchor="s"
            elementId={element.id}
            zoom={zoom}
            onBeginAnchorDrag={onBeginAnchorDrag}
          />
          <AnchorDot
            anchor="w"
            elementId={element.id}
            zoom={zoom}
            onBeginAnchorDrag={onBeginAnchorDrag}
          />
        </>
      ) : null}
    </div>
  );
}

// Shapes that draw themselves via an inner SVG overlay rather than relying
// on the wrapper's border/background. Square and circle are the only ones
// rendered purely through CSS (border + border-radius).
function isSvgRenderedShape(kind: ShapeKind): boolean {
  return kind !== 'square' && kind !== 'circle';
}

function ShapeSvgOverlay({
  shape,
  fill,
  stroke,
}: {
  shape: ShapeKind;
  fill: string;
  stroke: string;
}) {
  const common = {
    fill,
    stroke,
    strokeWidth: 2,
    vectorEffect: 'non-scaling-stroke' as const,
    strokeLinejoin: 'round' as const,
  };
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
    >
      {shape === 'diamond' ? <polygon points="50,0 100,50 50,100 0,50" {...common} /> : null}
      {shape === 'parallelogram' ? <polygon points="20,0 100,0 80,100 0,100" {...common} /> : null}
      {shape === 'hexagon' ? (
        <polygon points="25,0 75,0 100,50 75,100 25,100 0,50" {...common} />
      ) : null}
      {shape === 'document' ? (
        <path d="M 0 0 L 100 0 L 100 78 C 80 95, 65 65, 50 80 C 35 95, 20 65, 0 80 Z" {...common} />
      ) : null}
      {shape === 'cylinder' ? (
        <g>
          <path d="M 0 15 L 100 15 L 100 85 A 50 12 0 0 1 0 85 Z" {...common} />
          <ellipse cx={50} cy={15} rx={50} ry={12} {...common} />
        </g>
      ) : null}
    </svg>
  );
}

const ANCHOR_STYLE: Record<'n' | 'e' | 's' | 'w', React.CSSProperties> = {
  n: { top: 0, left: '50%' },
  e: { top: '50%', left: '100%' },
  s: { top: '100%', left: '50%' },
  w: { top: '50%', left: 0 },
};

function LinkBadge({ zoom, onFollow }: { zoom: number; onFollow: () => void }) {
  return (
    <button
      type="button"
      aria-label="Follow link"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onFollow();
      }}
      style={{ transform: `scale(${1 / zoom})`, transformOrigin: 'center' }}
      className="pointer-events-auto absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-brand-500 text-white shadow-sm transition hover:bg-brand-600"
    >
      <svg
        width="11"
        height="11"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M7 4.5l1.5-1.5a3.25 3.25 0 0 1 4.6 4.6L11 9.5" />
        <path d="M9 11.5l-1.5 1.5a3.25 3.25 0 0 1-4.6-4.6L5 7" />
        <line x1="6" y1="10" x2="10" y2="6" />
      </svg>
    </button>
  );
}

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
      // SVG-rendered shapes (diamond, cylinder, parallelogram, hexagon,
      // document) draw themselves via an inner SVG overlay; the wrapper div
      // carries no border/background, just the selection ring.
      if (isSvgRenderedShape(element.shape)) {
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
