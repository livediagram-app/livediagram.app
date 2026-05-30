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

const positionClasses: Record<HandlePosition, string> = {
  nw: '-top-1.5 -left-1.5 cursor-nwse-resize',
  ne: '-top-1.5 -right-1.5 cursor-nesw-resize',
  sw: '-bottom-1.5 -left-1.5 cursor-nesw-resize',
  se: '-bottom-1.5 -right-1.5 cursor-nwse-resize',
};

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
          className={`absolute h-3 w-3 rounded-sm border border-brand-600 bg-white ${positionClasses[pos]}`}
        />
      ))}
    </>
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
export type LabelTextStyle = {
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
  alignX: TextAlignX;
  onCommit: (label: string) => void;
  onCancel: () => void;
  textClassName?: string;
};

export function SingleLineLabelEditor({
  initial,
  placeholder,
  alignX,
  onCommit,
  onCancel,
  textClassName = 'text-brand-800 placeholder:text-brand-300',
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
      node.select();
    }
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

  return (
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
      style={{ textAlign: TEXT_ALIGN[alignX] }}
      className={`absolute inset-1.5 w-[calc(100%-0.75rem)] bg-transparent text-base font-medium outline-none ${textClassName}`}
    />
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
  onCommit: (label: string) => void;
  onCancel: () => void;
  textClassName?: string;
};

export function MultilineLabelEditor({
  initial,
  placeholder,
  textSize,
  alignX,
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
      style={{ fontSize: `${MULTI_FONT_PX[textSize]}px`, textAlign: TEXT_ALIGN[alignX] }}
      className={`absolute inset-3 w-[calc(100%-1.5rem)] resize-none bg-transparent outline-none ${textClassName}`}
    />
  );
}
