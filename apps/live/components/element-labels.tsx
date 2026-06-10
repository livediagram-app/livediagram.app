// Label rendering primitives used inside boxed element views (shape,
// text, sticky). Five renderers and two editors covering the four
// committed sizes (scale / sm / md / lg) and both single-line and
// multi-line layouts. Lifted out of element-parts.tsx (was 643 lines,
// two-thirds of it labels) so the parts file is scoped to selection
// chrome (lock badge, resize / rotate handles) and labels live with
// their own shared CSS / font tables.
//
// The split lines up cleanly: nothing in the selection-chrome half
// referenced any of these symbols (alignment constants, font tables,
// the label style type, the SVG preserveAspectRatio helper, the
// renderers themselves), and BoxedElementView was the single consumer
// of every exported label. The element-parts.tsx import block in
// BoxedElementView is split here in the same change.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { BoxedElement, TextAlignX, TextAlignY, TextSize } from '@livediagram/diagram';

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
// fixed, multiline). Stored independently so any combination, e.g.
// bold + italic + strikethrough, works.
type LabelTextStyle = {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  // Resolved CSS font-family stack (spec/28). Undefined = inherit the
  // editor default. Applied to both the committed label and its live
  // editor so there's no font jump on commit.
  fontFamily?: string;
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
    fontFamily: style.fontFamily,
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
          fontFamily={style?.fontFamily ?? 'ui-sans-serif, system-ui, sans-serif'}
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
          {text.split('\n').map((line, i) => (
            // One tspan per line so multi-line labels (Enter inserts a
            // newline now) lay out as separate lines; getBBox below
            // unions them, so the auto-fit still scales the whole block.
            <tspan key={i} x="0" dy={i === 0 ? 0 : '1.2em'}>
              {line || ' '}
            </tspan>
          ))}
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
        className="w-full whitespace-pre-wrap break-words"
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
  // Skip when the value hasn't changed from `initial`, this avoids a
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
      <textarea
        ref={ref}
        value={value}
        placeholder={placeholder}
        // rows track the line count so the box grows as the user adds
        // lines (Enter inserts a newline now instead of committing) and
        // the flex container keeps it vertically aligned.
        rows={Math.max(1, value.split('\n').length)}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleCommit}
        onKeyDown={(e) => {
          // Enter inserts a newline (textarea default); Escape cancels;
          // committing happens on blur / clicking away.
          if (e.key === 'Escape') {
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
        className={`pointer-events-auto w-full resize-none overflow-hidden whitespace-pre-wrap break-words bg-transparent font-medium leading-tight outline-none ${textClassName}`}
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

export function renderLabel(
  element: BoxedElement,
  label: string,
  textSize: TextSize,
  alignX: import('@livediagram/diagram').TextAlignX,
  alignY: import('@livediagram/diagram').TextAlignY,
  padding: number,
  isEditing: boolean,
  onCommitLabel: (label: string) => void,
  onCancelEdit: () => void,
  editCursorAtEnd: boolean,
  fontFamily?: string,
) {
  const isSticky = element.type === 'sticky';
  // Shape elements don't carry a placeholder during edit. The user
  // is already mid-double-click on a visible shape, so the empty
  // input doesn't need "Label" filler nudging them; the surrounding
  // shape silhouette communicates context already. Sticky notes
  // and standalone text elements DO get a placeholder because their
  // pre-edit affordance is just an empty rectangle / nothing.
  const placeholder = element.type === 'text' ? 'Text' : isSticky ? 'Note' : '';

  const textStyle = {
    bold: element.textBold,
    italic: element.textItalic,
    underline: element.textUnderline,
    strikethrough: element.textStrikethrough,
    fontFamily,
  };

  if (isEditing) {
    if (isSticky) {
      return (
        <MultilineLabelEditor
          initial={label}
          placeholder={placeholder}
          textSize={textSize}
          alignX={alignX}
          style={textStyle}
          onCommit={onCommitLabel}
          onCancel={onCancelEdit}
          textClassName="text-amber-950 placeholder:text-amber-700/50"
        />
      );
    }
    // Only the placeholder colour is pinned; the typed text inherits
    // the element's resolved textColor (set as `color` on the wrapper)
    // via currentColor, so editing shows the same colour as the
    // committed label instead of snapping to black / brand.
    const textClass =
      element.type === 'text' ? 'placeholder:text-slate-400' : 'placeholder:text-brand-300';
    return (
      <SingleLineLabelEditor
        initial={label}
        placeholder={placeholder}
        textSize={textSize}
        alignX={alignX}
        alignY={alignY}
        padding={padding}
        style={textStyle}
        onCommit={onCommitLabel}
        onCancel={onCancelEdit}
        textClassName={textClass}
        cursorAtEnd={editCursorAtEnd}
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
        padding={padding}
        className="text-amber-950"
        style={textStyle}
      />
    );
  }

  if (textSize === 'scale') {
    if (!label) return null;
    return (
      <ScalingLabel
        text={label}
        alignX={alignX}
        alignY={alignY}
        padding={padding}
        style={textStyle}
      />
    );
  }

  return (
    <FixedSizeLabel
      text={label}
      size={textSize}
      alignX={alignX}
      alignY={alignY}
      padding={padding}
      style={textStyle}
    />
  );
}

// Renders a FreehandElement's stored polyline as a smooth SVG path.
// Points are stored normalised into [0..1] within the element's
// bounding box (see createFreehand), so the renderer maps them into
// viewBox [0..100] and lets `preserveAspectRatio="none"` stretch the
// curve when the user resizes. The stroke colour comes from theme
// (with the per-element override), matching how other boxed elements
// pick their accent.
