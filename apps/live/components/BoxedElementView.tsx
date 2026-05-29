import type { PointerEvent as ReactPointerEvent } from 'react';
import {
  activeCommentCount,
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
import { initialsOf } from '@/lib/identity';
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
  onOpenComments: () => void;
  // Other participants whose realtime selection is currently on this
  // element. Rendered as a small initial-badge stack at the top-left
  // (opposite the link / comment badges).
  remoteSelectors: { id: string; name: string; color: string }[];
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
  onOpenComments,
  remoteSelectors,
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

  // When at least one remote participant has selected this element, the
  // border / stroke colour is overridden with the first remote selector's
  // colour so the realtime "X is here" signal is glanceable from anywhere
  // on the canvas — not just from the small initial-badge.
  const remoteBorderColor = remoteSelectors.length > 0 ? remoteSelectors[0]!.color : null;
  const variant = describeVariant(element, isSelected, remoteBorderColor);

  const commentCount = activeCommentCount(element.commentThread);
  const linked = element.link !== undefined && element.link.kind === 'tab';

  return (
    <div
      data-element-id={element.id}
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
          stroke={remoteBorderColor ?? element.strokeColor ?? defaultStrokeColor(element)}
          strokeWidth={remoteBorderColor ? 3 : 2}
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

      {remoteSelectors.length > 0 ? (
        <RemoteSelectorsStrip zoom={zoom} selectors={remoteSelectors} />
      ) : null}

      {linked || commentCount > 0 ? (
        <BadgeStrip
          zoom={zoom}
          linked={linked}
          commentCount={commentCount}
          onFollowLink={() =>
            element.link && element.link.kind === 'tab' ? onFollowLink(element.link.tabId) : null
          }
          onOpenComments={onOpenComments}
        />
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
// on the wrapper's border/background. The CSS-rendered set are the ones
// where a border + border-radius produces the right geometry at any
// aspect ratio without distortion:
//   - square: rounded rectangle
//   - circle: border-radius 50% (forced 1:1 so it stays a circle)
//   - stadium: border-radius 9999px → always semicircular ends
function isSvgRenderedShape(kind: ShapeKind): boolean {
  return kind !== 'square' && kind !== 'circle' && kind !== 'stadium';
}

function ShapeSvgOverlay({
  shape,
  fill,
  stroke,
  strokeWidth = 2,
}: {
  shape: ShapeKind;
  fill: string;
  stroke: string;
  strokeWidth?: number;
}) {
  const common = {
    fill,
    stroke,
    strokeWidth,
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

// Stack of small circular avatars pinned to the element's top-left. Each
// avatar shows another participant who currently has this element
// selected (per the realtime `select` op). The first avatar is fully
// visible; subsequent ones overlap with a small negative margin so a
// busy element doesn't push the stack across the canvas. Counter-scaled
// like the other badges so the on-screen size doesn't change with zoom.
function RemoteSelectorsStrip({
  zoom,
  selectors,
}: {
  zoom: number;
  selectors: { id: string; name: string; color: string }[];
}) {
  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      style={{ transform: `scale(${1 / zoom})`, transformOrigin: 'left top' }}
      className="pointer-events-none absolute -left-1 -top-1 flex"
    >
      {selectors.map((p, i) => (
        <div
          key={p.id}
          title={`${p.name} is here`}
          aria-label={`${p.name} is here`}
          style={{
            backgroundColor: p.color,
            marginLeft: i === 0 ? 0 : -6,
            zIndex: selectors.length - i,
          }}
          className="flex h-5 w-5 items-center justify-center rounded-full border border-white text-[9px] font-semibold text-white shadow-sm"
        >
          {initialsOf(p.name)}
        </div>
      ))}
    </div>
  );
}

// Floating cluster at the top-right of the element. Holds the link badge
// (if linked) and the comment badge (if there are unresolved comments) as
// individual buttons inside a single rounded card — same shape language as
// ZoomControls. Counter-scaled so the badges keep their on-screen size at
// any canvas zoom.
function BadgeStrip({
  zoom,
  linked,
  commentCount,
  onFollowLink,
  onOpenComments,
}: {
  zoom: number;
  linked: boolean;
  commentCount: number;
  onFollowLink: () => void;
  onOpenComments: () => void;
}) {
  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      style={{ transform: `scale(${1 / zoom})`, transformOrigin: 'right top' }}
      className="pointer-events-auto absolute -right-1 -top-1 flex items-center gap-0.5 rounded-full border border-slate-200 bg-white p-0.5 shadow-sm"
    >
      {linked ? (
        <BadgeButton label="Follow link" onClick={onFollowLink}>
          <LinkBadgeIcon />
        </BadgeButton>
      ) : null}
      {commentCount > 0 ? (
        <BadgeButton
          label={`Open ${commentCount} comment${commentCount === 1 ? '' : 's'}`}
          onClick={onOpenComments}
          dataAttr="data-comment-trigger"
        >
          <CommentBadgeIcon />
          <span className="absolute -right-1 -top-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-semibold leading-none text-white">
            {commentCount}
          </span>
        </BadgeButton>
      ) : null}
    </div>
  );
}

function BadgeButton({
  label,
  onClick,
  dataAttr,
  children,
}: {
  label: string;
  onClick: () => void;
  dataAttr?: string;
  children: React.ReactNode;
}) {
  const extra = dataAttr ? { [dataAttr]: '' } : {};
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="relative flex h-5 w-5 items-center justify-center rounded-full bg-brand-500 text-white shadow-sm transition hover:bg-brand-600"
      {...extra}
    >
      {children}
    </button>
  );
}

function LinkBadgeIcon() {
  return (
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
  );
}

function CommentBadgeIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2.5 4a1.5 1.5 0 0 1 1.5-1.5h8A1.5 1.5 0 0 1 13.5 4v5A1.5 1.5 0 0 1 12 10.5H7l-3 2.5V10.5A1.5 1.5 0 0 1 2.5 9z" />
    </svg>
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
  remoteBorderColor: string | null,
): { className: string; style: React.CSSProperties } {
  // When a remote participant has this element selected, draw a thicker
  // 3-pixel border in their colour so the realtime signal is glanceable.
  // We apply it as a box-shadow inset on text (which has no real border)
  // and as an actual border on shape / sticky. The local selection ring
  // stays on top so the active user still sees their own selection.
  const remoteBorderWidth = remoteBorderColor ? 3 : 0;
  switch (element.type) {
    case 'shape': {
      const ring = isSelected ? 'ring-2 ring-brand-200' : '';
      // SVG-rendered shapes (diamond, cylinder, parallelogram, hexagon,
      // document) draw themselves via an inner SVG overlay; the wrapper div
      // carries no border/background, just the selection ring. The
      // border colour for those propagates through ShapeSvgOverlay's
      // `stroke` prop, not this style block.
      if (isSvgRenderedShape(element.shape)) {
        return {
          className: `text-brand-800 ${ring}`,
          style: { borderRadius: '4px' },
        };
      }
      return {
        className: `border-2 text-brand-800 shadow-sm ${ring}`,
        style: {
          borderRadius:
            element.shape === 'circle' ? '50%' : element.shape === 'stadium' ? '9999px' : '8px',
          backgroundColor: element.fillColor ?? defaultFillColor(element),
          borderColor: remoteBorderColor ?? element.strokeColor ?? defaultStrokeColor(element),
          borderWidth: remoteBorderColor ? remoteBorderWidth : undefined,
        },
      };
    }
    case 'text': {
      const ring = isSelected
        ? 'ring-2 ring-brand-300 ring-offset-2 ring-offset-white'
        : 'ring-1 ring-dashed ring-slate-300';
      return {
        className: `text-slate-800 rounded-sm ${ring}`,
        // Text elements have no real border; render the remote-selector
        // halo as an outline so it shows up regardless of the element
        // having transparent fill.
        style: remoteBorderColor
          ? { outline: `${remoteBorderWidth}px solid ${remoteBorderColor}`, outlineOffset: 2 }
          : {},
      };
    }
    case 'sticky': {
      const ring = isSelected ? 'ring-2 ring-brand-200' : '';
      return {
        className: `border text-amber-950 shadow-md ${ring}`,
        style: {
          borderRadius: '4px',
          backgroundColor: element.fillColor ?? defaultFillColor(element),
          borderColor: remoteBorderColor ?? element.strokeColor ?? defaultStrokeColor(element),
          borderWidth: remoteBorderColor ? remoteBorderWidth : undefined,
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
