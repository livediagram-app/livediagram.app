import {
  useEffect,
  useRef,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { TextSize } from '@livediagram/diagram';
import { arrowLabelFontSize, labelSize } from '@/lib/arrow-label-geometry';
import { BRAND_600 } from './arrow-handle-style';

type ArrowLabelProps = {
  x: number;
  y: number;
  text: string;
  color: string;
  isEditing: boolean;
  // Caret at end instead of select-all on focus (type-to-edit, spec/09).
  cursorAtEnd?: boolean;
  // Resolved CSS font-family for the label text + editor (spec/28).
  fontFamily?: string;
  // Label-text formatting (spec/09): size preset + inline styles, applied
  // to the rendered <text>. Absent → default small / unstyled.
  textSize?: TextSize;
  textBold?: boolean;
  textItalic?: boolean;
  textUnderline?: boolean;
  textStrikethrough?: boolean;
  // The plate behind the text (spec/09 "Caption"). Absent / transparent
  // leaves the label sitting straight on the canvas, which is how it has
  // always drawn.
  fill?: string;
  // When true (arrow selected + editable) the label shows a dashed
  // box + move cursor and can be dragged along / across the line.
  draggable?: boolean;
  onStartDrag?: (e: ReactPointerEvent) => void;
  // Double-click the label to re-edit its text.
  onEdit?: () => void;
  onCommit: (label: string) => void;
  onCancel: () => void;
  // Left-click the label to select the arrow (when it isn't draggable yet),
  // and right-click to open the arrow's context menu — without these the
  // click falls through to the canvas.
  onSelect?: (e: ReactPointerEvent) => void;
  onContextMenu?: (e: ReactMouseEvent) => void;
};

// The label lives inside the per-arrow SVG so it stays in canvas
// space (and therefore inherits the zoom/pan transform). When the
// arrow is in edit mode we render an HTML input via <foreignObject>
// — that gives us native text-selection / IME / cursor behaviour
// instead of reinventing it in pure SVG.
export function ArrowLabel({
  x,
  y,
  text,
  color,
  isEditing,
  cursorAtEnd = false,
  fontFamily,
  textSize,
  textBold,
  textItalic,
  textUnderline,
  textStrikethrough,
  fill,
  draggable = false,
  onStartDrag,
  onEdit,
  onCommit,
  onCancel,
  onSelect,
  onContextMenu,
}: ArrowLabelProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (isEditing && inputRef.current) {
      const node = inputRef.current;
      node.focus();
      if (cursorAtEnd) {
        const end = node.value.length;
        node.setSelectionRange(end, end);
      } else {
        node.select();
      }
    }
    // cursorAtEnd is fixed for the lifetime of an edit session, so
    // reading it once when editing begins is correct; intentionally
    // not a dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing]);
  const fontSize = arrowLabelFontSize(textSize);
  const size = labelSize(text, fontSize);
  // Underline + strikethrough combine into one text-decoration value.
  const decoration =
    [textUnderline ? 'underline' : '', textStrikethrough ? 'line-through' : '']
      .filter(Boolean)
      .join(' ') || undefined;
  if (isEditing) {
    return (
      <foreignObject
        x={x - size.width / 2}
        y={y - size.height / 2}
        width={size.width}
        height={size.height}
        style={{ overflow: 'visible', pointerEvents: 'auto' }}
      >
        <input
          ref={inputRef}
          defaultValue={text}
          onPointerDown={(e) => e.stopPropagation()}
          onBlur={(e) => onCommit(e.currentTarget.value.trim())}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onCommit((e.target as HTMLInputElement).value.trim());
            } else if (e.key === 'Escape') {
              e.preventDefault();
              onCancel();
            }
            e.stopPropagation();
          }}
          style={{ fontFamily }}
          className="h-full w-full rounded bg-white px-1 text-center text-xs text-slate-800 shadow-sm outline-none ring-2 ring-sky-400"
        />
      </foreignObject>
    );
  }
  // A touch of padding so the dashed box + drag area sit just outside
  // the label text.
  const pad = 2;
  const plate = fill && fill !== 'transparent' ? fill : null;
  return (
    <g>
      {/* The plate, when the caption has been given one. Drawn a touch wider
          than the text so the words are not flush against its edge, and only
          when set: with no fill the label sits straight on the canvas, which
          is how it has always drawn. */}
      {plate ? (
        <rect
          x={x - size.width / 2 - 4}
          y={y - size.height / 2 - 1}
          width={size.width + 8}
          height={size.height + 2}
          rx={4}
          fill={plate}
          style={{ pointerEvents: 'none' }}
        />
      ) : null}
      <text
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={fontSize}
        fontWeight={textBold ? 600 : undefined}
        fontStyle={textItalic ? 'italic' : undefined}
        textDecoration={decoration}
        fill={color}
        style={{ pointerEvents: 'none', userSelect: 'none', fontFamily }}
      >
        {text}
      </text>
      {/* Dashed box signals the label is draggable (only when selected). */}
      {draggable ? (
        <rect
          x={x - size.width / 2 - pad}
          y={y - size.height / 2 - pad}
          width={size.width + pad * 2}
          height={size.height + pad * 2}
          rx={5}
          fill="none"
          stroke={BRAND_600}
          strokeWidth={1}
          strokeDasharray="3 2"
          style={{ pointerEvents: 'none' }}
        />
      ) : null}
      {/* Transparent catcher, always on: when draggable it grabs the drag
          (slide the label along / across the line); otherwise a press selects
          the arrow. Double-click edits, right-click opens the arrow menu — so
          a click on the label never falls through to the canvas. */}
      <rect
        x={x - size.width / 2 - pad}
        y={y - size.height / 2 - pad}
        width={size.width + pad * 2}
        height={size.height + pad * 2}
        rx={5}
        fill="transparent"
        onPointerDown={(e) => {
          e.stopPropagation();
          if (draggable && onStartDrag) onStartDrag(e);
          else onSelect?.(e);
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onEdit?.();
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onContextMenu?.(e);
        }}
        style={{ pointerEvents: 'all', cursor: draggable ? 'move' : 'pointer' }}
      />
    </g>
  );
}
