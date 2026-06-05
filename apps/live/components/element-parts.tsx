// Shared building blocks used by all boxed element views (shape, text, sticky).
// Kept here to avoid duplication across the three view components.

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { TextAlignX, TextAlignY, TextSize } from '@livediagram/diagram';
import type { DragMode } from '@/lib/canvas';
import {
  FLOATING_CONTROL_CLASS,
  FLOATING_CONTROL_GAP,
  FLOATING_CONTROL_HOVER_CLASS,
} from './PlusButton';

// --- Lock badge ------------------------------------------------------------

export function LockBadge({ zoom = 1 }: { zoom?: number }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute -left-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-brand-500 text-white shadow-sm"
      style={{ transform: `scale(${1 / zoom})`, transformOrigin: 'center' }}
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
      >
        <rect x="3" y="7.5" width="10" height="6.5" rx="1.25" />
        <path d="M5.25 7.5V5a2.75 2.75 0 0 1 5.5 0v2.5" />
      </svg>
    </div>
  );
}

// --- Resize handles --------------------------------------------------------

type HandlePosition = 'nw' | 'ne' | 'sw' | 'se';

// -2 (8px) offset centres a 16px (h-4) handle on the corner. Same round
// white style as the plus buttons (FLOATING_CONTROL_CLASS), but a touch
// smaller so the four corner grips stay unobtrusive.
const positionClasses: Record<HandlePosition, string> = {
  nw: '-top-2 -left-2 cursor-nwse-resize',
  ne: '-top-2 -right-2 cursor-nesw-resize',
  sw: '-bottom-2 -left-2 cursor-nesw-resize',
  se: '-bottom-2 -right-2 cursor-nwse-resize',
};

// Pseudo-element that extends each handle's pointer-capture region on
// touch devices without altering the visual size of the white-fill
// square. A fingertip needs roughly 44 px to land reliably (iOS HIG);
// the visible square stays 12 px so the selection chrome doesn't get
// clunky, but on `(pointer: coarse)` an invisible ::before pad fans
// out 16 px on every side, giving a 44 x 44 hit target. Desktop mice
// keep the unchanged 12 x 12 hit area, so precise corner-resize on a
// trackpad doesn't suddenly start snagging adjacent handles.
const HIT_PAD_CLASSES =
  "pointer-coarse:before:absolute pointer-coarse:before:-inset-[16px] pointer-coarse:before:content-['']";

type ResizeHandlesProps = {
  elementId: string;
  zoom: number;
  onBeginDrag: (id: string, mode: DragMode, e: ReactPointerEvent) => void;
};

export function ResizeHandles({ elementId, zoom, onBeginDrag }: ResizeHandlesProps) {
  return (
    <>
      {(Object.keys(positionClasses) as HandlePosition[]).map((pos) => (
        <div
          key={pos}
          onPointerDown={(e) => {
            e.stopPropagation();
            onBeginDrag(elementId, `resize-${pos}`, e);
          }}
          style={{ transform: `scale(${1 / zoom})`, transformOrigin: 'center' }}
          className={`absolute h-4 w-4 opacity-70 hover:opacity-100 ${FLOATING_CONTROL_CLASS} ${FLOATING_CONTROL_HOVER_CLASS} ${positionClasses[pos]} ${HIT_PAD_CLASSES}`}
        />
      ))}
    </>
  );
}

// --- Rotate handle ---------------------------------------------------------

type RotateHandleProps = {
  elementId: string;
  zoom: number;
  onBeginRotate: (
    elementId: string,
    centerClientX: number,
    centerClientY: number,
    e: ReactPointerEvent,
  ) => void;
};

// Custom cursor for the rotate handle. CSS has no "rotate" cursor, so
// we inline a small circular-arrow SVG (drawn twice: a fat white halo
// under a dark glyph so it reads on any canvas colour) with the hotspot
// centred at 12,12 and `grab` as the fallback.
const ROTATE_CURSOR =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M19.5 12a7.5 7.5 0 1 1-2.2-5.3' stroke='%23ffffff' stroke-width='4'/%3E%3Cpath d='M19.5 4v4h-4' stroke='%23ffffff' stroke-width='4'/%3E%3Cpath d='M19.5 12a7.5 7.5 0 1 1-2.2-5.3' stroke='%231e293b' stroke-width='2'/%3E%3Cpath d='M19.5 4v4h-4' stroke='%231e293b' stroke-width='2'/%3E%3C/svg%3E\") 12 12, grab";

// A circular handle (same size + style as the plus buttons) whose
// centre lines up with the bottom + right plus buttons: anchored at the
// element's SE corner (left/top 100%) and nudged out by the same
// FLOATING_CONTROL_GAP the plus buttons use, so the four edge plusses
// and this corner handle form one tidy ring well clear of the resize
// handles. Dragging it spins the element about its centre, which is
// read from the wrapper's bounding rect at grab time (rotation is about
// the centre, so that rect's centre is the pivot at any angle).
export function RotateHandle({ elementId, zoom, onBeginRotate }: RotateHandleProps) {
  return (
    <div
      onPointerDown={(e) => {
        e.stopPropagation();
        const wrapper = (e.currentTarget as HTMLElement).closest('[data-element-id]');
        const rect = wrapper?.getBoundingClientRect();
        if (!rect) return;
        onBeginRotate(elementId, rect.left + rect.width / 2, rect.top + rect.height / 2, e);
      }}
      style={{
        left: '100%',
        top: '100%',
        transform: `translate(${FLOATING_CONTROL_GAP / zoom}px, ${FLOATING_CONTROL_GAP / zoom}px) scale(${1 / zoom})`,
        transformOrigin: 'top left',
        cursor: ROTATE_CURSOR,
      }}
      className={`absolute flex h-6 w-6 items-center justify-center opacity-70 hover:opacity-100 ${FLOATING_CONTROL_CLASS} ${FLOATING_CONTROL_HOVER_CLASS} ${HIT_PAD_CLASSES}`}
      aria-hidden
    >
      <RotateIcon />
    </div>
  );
}

function RotateIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      {/* Three-quarter circular arrow — the conventional "rotate" glyph. */}
      <path
        d="M12.5 5.5A5 5 0 1 0 13 8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M12.8 2.5v3.2h-3.2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// --- Union resize handles (for multi-selection + group resize) ------------

type UnionResizeHandlesProps = {
  // Canvas-space bounds of the union (selection bounding box).
  bounds: { x: number; y: number; width: number; height: number };
  // The id we hand back to onBeginDrag — typically the primary
  // (currently-selected) element. The drag effect picks up every
  // other member from the captured startBounds so they all scale
  // proportionally.
  primaryId: string;
  zoom: number;
  onBeginDrag: (id: string, mode: DragMode, e: ReactPointerEvent) => void;
};

// Renders the same 4 corner handles as ResizeHandles, but positioned
// in canvas-space at the union bounding box of a multi-selection /
// group. Mounted inside the viewport-transformed wrapper so its
// coordinates pan + zoom with the canvas; the handles themselves are
// counter-scaled so they remain a constant on-screen size.
export function UnionResizeHandles({
  bounds,
  primaryId,
  zoom,
  onBeginDrag,
}: UnionResizeHandlesProps) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute"
      style={{
        left: bounds.x,
        top: bounds.y,
        width: bounds.width,
        height: bounds.height,
      }}
    >
      {(Object.keys(positionClasses) as HandlePosition[]).map((pos) => (
        <div
          key={pos}
          onPointerDown={(e) => {
            e.stopPropagation();
            onBeginDrag(primaryId, `resize-${pos}`, e);
          }}
          style={{ transform: `scale(${1 / zoom})`, transformOrigin: 'center' }}
          className={`pointer-events-auto absolute h-3 w-3 rounded-sm border border-brand-600 bg-white dark:border-brand-300 dark:bg-slate-900 ${positionClasses[pos]} ${HIT_PAD_CLASSES}`}
        />
      ))}
    </div>
  );
}

// --- Alignment helpers -----------------------------------------------------

const ALIGN_ITEMS: Record<TextAlignY, 'flex-start' | 'center' | 'flex-end'> = {
  top: 'flex-start',
  middle: 'center',
  bottom: 'flex-end',
};

const TEXT_ALIGN: Record<TextAlignX, 'left' | 'center' | 'right'> = {
  left: 'left',
  center: 'center',
  right: 'right',
};

// Inline label-style props applied by every label renderer (scaling,
// fixed, multiline). Stored independently so any combination — e.g.
// bold + italic + strikethrough — works.
type LabelTextStyle = {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
};

// Build the CSS payload for a LabelTextStyle. text-decoration combines
// underline + line-through into a single value (a space-separated list
// is the canonical multi-decoration syntax).
function labelTextStyleCss(style: LabelTextStyle): React.CSSProperties {
  const decorations: string[] = [];
  if (style.underline) decorations.push('underline');
  if (style.strikethrough) decorations.push('line-through');
  return {
    fontStyle: style.italic ? 'italic' : undefined,
    fontWeight: style.bold ? 700 : undefined,
    textDecoration: decorations.length > 0 ? decorations.join(' ') : undefined,
  };
}

function svgPreserve(alignX: TextAlignX, alignY: TextAlignY): string {
  const ax = alignX === 'left' ? 'xMin' : alignX === 'right' ? 'xMax' : 'xMid';
  const ay = alignY === 'top' ? 'YMin' : alignY === 'bottom' ? 'YMax' : 'YMid';
  return `${ax}${ay} meet`;
}

// --- Auto-scaling single-line label (SVG fit-to-bounds) --------------------

export function ScalingLabel({
  text,
  alignX,
  alignY,
  padding,
  style,
}: {
  text: string;
  alignX: TextAlignX;
  alignY: TextAlignY;
  padding: number;
  style?: LabelTextStyle;
}) {
  const textRef = useRef<SVGTextElement>(null);
  const [bbox, setBBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  useLayoutEffect(() => {
    const node = textRef.current;
    if (!node) return;
    const b = node.getBBox();
    setBBox({ x: b.x, y: b.y, w: b.width || 1, h: b.height || 1 });
  }, [text]);

  const viewBox = bbox ? `${bbox.x} ${bbox.y} ${bbox.w} ${bbox.h}` : '0 0 100 24';

  return (
    <div className="pointer-events-none absolute inset-0 flex" style={{ padding }}>
      <svg
        width="100%"
        height="100%"
        viewBox={viewBox}
        preserveAspectRatio={svgPreserve(alignX, alignY)}
      >
        <text
          ref={textRef}
          x="0"
          y="0"
          dominantBaseline="hanging"
          fontFamily="ui-sans-serif, system-ui, sans-serif"
          fontWeight={style?.bold ? 700 : 500}
          fontStyle={style?.italic ? 'italic' : undefined}
          textDecoration={
            style?.underline && style?.strikethrough
              ? 'underline line-through'
              : style?.underline
                ? 'underline'
                : style?.strikethrough
                  ? 'line-through'
                  : undefined
          }
          fontSize="20"
          fill="currentColor"
        >
          {text}
        </text>
      </svg>
    </div>
  );
}

// --- Fixed-size single-line label (sm/md/lg) -------------------------------

const FIXED_FONT_PX: Record<Exclude<TextSize, 'scale'>, number> = {
  sm: 14,
  md: 22,
  lg: 32,
};

export function FixedSizeLabel({
  text,
  size,
  alignX,
  alignY,
  padding,
  style,
}: {
  text: string;
  size: Exclude<TextSize, 'scale'>;
  alignX: TextAlignX;
  alignY: TextAlignY;
  padding: number;
  style?: LabelTextStyle;
}) {
  if (!text) return null;
  return (
    <div
      className="pointer-events-none absolute inset-0 flex overflow-hidden font-medium leading-tight"
      style={{
        fontSize: `${FIXED_FONT_PX[size]}px`,
        alignItems: ALIGN_ITEMS[alignY],
        padding,
      }}
    >
      <div
        className="w-full"
        style={{ textAlign: TEXT_ALIGN[alignX], ...labelTextStyleCss(style ?? {}) }}
      >
        {text}
      </div>
    </div>
  );
}

// --- Single-line editor (used by shape and text) ---------------------------

type SingleLineLabelEditorProps = {
  initial: string;
  placeholder: string;
  // The committed label's typography, threaded through so the live
  // editor renders the text identically to how it'll look on commit
  // (no size / weight / position jump when the user finishes typing).
  textSize: TextSize;
  alignX: TextAlignX;
  alignY: TextAlignY;
  padding: number;
  style?: LabelTextStyle;
  onCommit: (label: string) => void;
  onCancel: () => void;
  textClassName?: string;
  // When true, place the caret at the END on focus instead of
  // selecting all. Used by type-to-edit (spec/09 Labels), where the
  // label was just seeded with the first typed character: select-all
  // would let the next keystroke replace that seed, dropping the first
  // letter. Defaults to false so normal edit (double-click / Space)
  // keeps its select-all-then-retype behaviour.
  cursorAtEnd?: boolean;
};

export function SingleLineLabelEditor({
  initial,
  placeholder,
  textSize,
  alignX,
  alignY,
  padding,
  style,
  onCommit,
  onCancel,
  textClassName = 'text-brand-800 placeholder:text-brand-300',
  cursorAtEnd = false,
}: SingleLineLabelEditorProps) {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  const valueRef = useRef(value);
  const onCommitRef = useRef(onCommit);
  const settled = useRef(false);

  valueRef.current = value;
  onCommitRef.current = onCommit;

  useEffect(() => {
    const node = ref.current;
    if (node) {
      node.focus();
      if (cursorAtEnd) {
        const end = node.value.length;
        node.setSelectionRange(end, end);
      } else {
        node.select();
      }
    }
    // cursorAtEnd is fixed for the lifetime of an edit session (the
    // editor remounts per session), so reading it once on mount is
    // correct; intentionally not a dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Safety net: if the editor unmounts without an explicit commit/cancel
  // (e.g. clicking the non-focusable canvas, which can skip the blur event),
  // commit the latest value so the user's typing isn't lost.
  // Skip when the value hasn't changed from `initial` — this avoids a
  // spurious commit during React StrictMode's mount-unmount-mount cycle
  // (Next.js dev defaults to strict mode), which would otherwise clear
  // editingId before the editor truly mounts.
  useEffect(() => {
    const original = initial;
    return () => {
      if (settled.current) return;
      if (valueRef.current === original) return;
      onCommitRef.current(valueRef.current);
    };
  }, [initial]);

  const handleCommit = () => {
    if (settled.current) return;
    settled.current = true;
    onCommit(valueRef.current);
  };

  const handleCancel = () => {
    settled.current = true;
    onCancel();
  };

  // Match the committed label's font size. 'scale' has no fixed px
  // (the renderer auto-fits an SVG to the box, which a live input
  // can't replicate), so it falls back to a sensible mid size.
  const fontSizePx = textSize === 'scale' ? 16 : FIXED_FONT_PX[textSize];

  // Mirror FixedSizeLabel's layout (flex box with the element's
  // padding + vertical alignment) so the caret sits exactly where the
  // committed text will. pointer-events stay off the padding so a
  // click outside the input still falls through to the shape (commit
  // via blur), matching the previous behaviour.
  return (
    <div
      className="pointer-events-none absolute inset-0 flex overflow-hidden"
      style={{ alignItems: ALIGN_ITEMS[alignY], padding }}
    >
      <input
        ref={ref}
        value={value}
        placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleCommit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleCommit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            handleCancel();
          }
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        style={{
          fontSize: `${fontSizePx}px`,
          textAlign: TEXT_ALIGN[alignX],
          ...labelTextStyleCss(style ?? {}),
        }}
        className={`pointer-events-auto w-full bg-transparent font-medium leading-tight outline-none ${textClassName}`}
      />
    </div>
  );
}

// --- Multi-line display + editor (used by sticky) --------------------------

const MULTI_FONT_PX: Record<TextSize, number> = {
  scale: 14,
  sm: 12,
  md: 16,
  lg: 22,
};

type MultilineLabelProps = {
  text: string;
  placeholder: string;
  textSize: TextSize;
  alignX: TextAlignX;
  alignY: TextAlignY;
  className?: string;
};

export function MultilineLabel({
  text,
  placeholder,
  textSize,
  alignX,
  alignY,
  padding,
  className = '',
  style,
}: MultilineLabelProps & { padding: number; style?: LabelTextStyle }) {
  const fontSize = `${MULTI_FONT_PX[textSize]}px`;
  const outerStyle = {
    fontSize,
    alignItems: ALIGN_ITEMS[alignY],
    padding,
  };
  const innerStyle = { textAlign: TEXT_ALIGN[alignX], ...labelTextStyleCss(style ?? {}) };
  if (!text) {
    return (
      <div
        style={outerStyle}
        className={`pointer-events-none absolute inset-0 flex overflow-hidden opacity-50 ${className}`}
      >
        <div className="w-full whitespace-pre-wrap" style={innerStyle}>
          {placeholder}
        </div>
      </div>
    );
  }
  return (
    <div
      style={outerStyle}
      className={`pointer-events-none absolute inset-0 flex overflow-hidden ${className}`}
    >
      <div className="w-full whitespace-pre-wrap" style={innerStyle}>
        {text}
      </div>
    </div>
  );
}

type MultilineLabelEditorProps = {
  initial: string;
  placeholder: string;
  textSize: TextSize;
  alignX: TextAlignX;
  style?: LabelTextStyle;
  onCommit: (label: string) => void;
  onCancel: () => void;
  textClassName?: string;
};

export function MultilineLabelEditor({
  initial,
  placeholder,
  textSize,
  alignX,
  style,
  onCommit,
  onCancel,
  textClassName = '',
}: MultilineLabelEditorProps) {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLTextAreaElement>(null);
  const valueRef = useRef(value);
  const onCommitRef = useRef(onCommit);
  const settled = useRef(false);

  valueRef.current = value;
  onCommitRef.current = onCommit;

  useEffect(() => {
    const node = ref.current;
    if (node) {
      node.focus();
      node.select();
    }
  }, []);

  // See SingleLineLabelEditor for the rationale; same fix here.
  useEffect(() => {
    const original = initial;
    return () => {
      if (settled.current) return;
      if (valueRef.current === original) return;
      onCommitRef.current(valueRef.current);
    };
  }, [initial]);

  const handleCommit = () => {
    if (settled.current) return;
    settled.current = true;
    onCommit(valueRef.current);
  };

  const handleCancel = () => {
    settled.current = true;
    onCancel();
  };

  return (
    <textarea
      ref={ref}
      value={value}
      placeholder={placeholder}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleCommit}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          handleCancel();
        }
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      style={{
        fontSize: `${MULTI_FONT_PX[textSize]}px`,
        textAlign: TEXT_ALIGN[alignX],
        ...labelTextStyleCss(style ?? {}),
      }}
      className={`absolute inset-3 w-[calc(100%-1.5rem)] resize-none bg-transparent outline-none ${textClassName}`}
    />
  );
}
