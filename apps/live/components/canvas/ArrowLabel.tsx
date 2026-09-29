import {
  useEffect,
  useEffectEvent,
  useRef,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  BLANK_LINE,
  LABEL_PAD_X_PX,
  LABEL_PAD_Y_PX,
  type ArrowLabelLayout,
} from '@livediagram/document';
import { BRAND_600 } from './arrow-handle-style';

// Browsers and the canvas measure text a hair apart; the editor gets this
// much extra width so it never wraps a line the layout kept whole.
const EDITOR_SLACK_PX = 2;

type ArrowLabelProps = {
  // Where and how the label renders (docs/specs/008-canvas/arrow-labels.md), from the
  // shared layout engine. While editing, the layout of the draft text.
  layout: ArrowLabelLayout;
  text: string;
  color: string;
  isEditing: boolean;
  // Caret at end instead of select-all on focus (type-to-edit, docs/specs/008-canvas/canvas-and-palette.md).
  cursorAtEnd?: boolean;
  // Resolved CSS font-family for the label text + editor (docs/specs/004-interface-design/fonts.md).
  fontFamily?: string;
  textBold?: boolean;
  textItalic?: boolean;
  textUnderline?: boolean;
  textStrikethrough?: boolean;
  // The plate behind the text (docs/specs/008-canvas/canvas-and-palette.md "Caption"). Absent / transparent
  // leaves the label on the canvas, framed by the line's knockout.
  fill?: string;
  // When true (arrow selected + editable) the label shows a dashed
  // box + move cursor and can be dragged along / across the line.
  draggable?: boolean;
  onStartDrag?: (e: ReactPointerEvent) => void;
  // Records the press; true when it completed a double-press, which opens
  // the editor (docs/specs/008-canvas/arrow-bending.md), so nothing else may happen.
  guardPress?: (e: ReactPointerEvent) => boolean;
  // Every keystroke, so the arrow can re-lay out the label (and its knockout) live.
  onDraft?: (text: string) => void;
  onCommit: (label: string) => void;
  onCancel: () => void;
  // Left-click the label to select the arrow (when it isn't draggable yet),
  // and right-click to open the arrow's context menu — without these the
  // click falls through to the canvas.
  onSelect?: (e: ReactPointerEvent) => void;
  onContextMenu?: (e: ReactMouseEvent) => void;
};

// The label lives inside the per-arrow SVG so it stays in canvas space (and
// inherits the zoom/pan transform). Editing swaps in an HTML textarea via
// <foreignObject>, for native selection / IME / caret behaviour, sized and
// wrapped exactly as the label will render so committing never jumps.
export function ArrowLabel({
  layout,
  text,
  color,
  isEditing,
  cursorAtEnd = false,
  fontFamily,
  textBold,
  textItalic,
  textUnderline,
  textStrikethrough,
  fill,
  draggable = false,
  onStartDrag,
  guardPress,
  onDraft,
  onCommit,
  onCancel,
  onSelect,
  onContextMenu,
}: ArrowLabelProps) {
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  // cursorAtEnd is fixed for the lifetime of an edit session, so it is read
  // once, when editing begins: an effect event keyed on isEditing.
  const focusForEditing = useEffectEvent(() => {
    if (inputRef.current) {
      const node = inputRef.current;
      node.focus();
      if (cursorAtEnd) {
        const end = node.value.length;
        node.setSelectionRange(end, end);
      } else {
        node.select();
      }
    }
  });
  useEffect(() => {
    if (isEditing) focusForEditing();
  }, [isEditing]);
  const { center, width, height, lines, fontPx, lineHeightPx } = layout;
  const left = center.x - width / 2;
  const top = center.y - height / 2;
  // Underline + strikethrough combine into one text-decoration value.
  const decoration =
    [textUnderline ? 'underline' : '', textStrikethrough ? 'line-through' : '']
      .filter(Boolean)
      .join(' ') || undefined;
  if (isEditing) {
    return (
      <foreignObject
        x={left - EDITOR_SLACK_PX / 2}
        y={top}
        width={width + EDITOR_SLACK_PX}
        height={height}
        style={{ overflow: 'visible', pointerEvents: 'auto' }}
      >
        <textarea
          ref={inputRef}
          defaultValue={text}
          aria-label="Arrow label"
          placeholder="Label"
          rows={1}
          onPointerDown={(e) => e.stopPropagation()}
          onInput={(e) => onDraft?.(e.currentTarget.value)}
          onBlur={(e) => onCommit(e.currentTarget.value.trim())}
          onKeyDown={(e) => {
            // Enter commits; Shift+Enter is a line break. Never mid-composition.
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              onCommit(e.currentTarget.value.trim());
            } else if (e.key === 'Escape') {
              e.preventDefault();
              onCancel();
            }
            e.stopPropagation();
          }}
          style={{
            fontFamily,
            fontSize: fontPx,
            lineHeight: `${lineHeightPx}px`,
            padding: `${LABEL_PAD_Y_PX}px ${LABEL_PAD_X_PX}px`,
            fontWeight: textBold ? 600 : undefined,
            fontStyle: textItalic ? 'italic' : undefined,
            color,
          }}
          className="block h-full w-full resize-none overflow-hidden whitespace-pre-wrap rounded bg-white text-center shadow-sm outline-none ring-2 ring-sky-400 dark:bg-slate-900"
        />
      </foreignObject>
    );
  }
  // A touch of padding so the dashed box + drag area sit just outside the plate.
  const pad = 2;
  const plate = fill && fill !== 'transparent' ? fill : null;
  const firstY = center.y - ((lines.length - 1) * lineHeightPx) / 2;
  return (
    <g>
      {plate ? (
        <rect
          x={left}
          y={top}
          width={width}
          height={height}
          rx={4}
          fill={plate}
          style={{ pointerEvents: 'none' }}
        />
      ) : null}
      <text
        x={center.x}
        y={firstY}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={fontPx}
        fontWeight={textBold ? 600 : undefined}
        fontStyle={textItalic ? 'italic' : undefined}
        textDecoration={decoration}
        fill={color}
        style={{ pointerEvents: 'none', userSelect: 'none', fontFamily }}
      >
        {lines.map((line, i) => (
          // A blank line keeps its height as a no-break space (see svgWrappedLabel).
          <tspan key={i} x={center.x} dy={i === 0 ? 0 : lineHeightPx}>
            {line || BLANK_LINE}
          </tspan>
        ))}
      </text>
      {/* Dashed box signals the label is draggable (only when selected). */}
      {draggable ? (
        <rect
          x={left - pad}
          y={top - pad}
          width={width + pad * 2}
          height={height + pad * 2}
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
          the arrow. A double-press edits, right-click opens the arrow menu, so
          a click on the label never falls through to the canvas. */}
      <rect
        x={left - pad}
        y={top - pad}
        width={width + pad * 2}
        height={height + pad * 2}
        rx={5}
        fill="transparent"
        onPointerDown={(e) => {
          // Never let a press on the label reach the canvas; only the primary
          // button selects or drags (right-click opens the menu below).
          e.stopPropagation();
          if (e.button !== 0) return;
          if (guardPress?.(e)) return;
          if (draggable && onStartDrag) onStartDrag(e);
          else onSelect?.(e);
        }}
        onDoubleClick={(e) => e.stopPropagation()}
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
