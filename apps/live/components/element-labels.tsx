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

import { useLayoutEffect, useRef, useState } from 'react';
import {
  hasRichFormatting,
  type BoxedElement,
  type Padding,
  type TextAlignX,
  type TextAlignY,
  type TextRun,
  type TextSize,
} from '@livediagram/diagram';
import {
  ALIGN_ITEMS,
  effectiveRunStyle,
  FIXED_FONT_PX,
  labelTextStyleCss,
  MULTI_FONT_PX,
  MULTI_RUN_PX,
  TEXT_ALIGN,
  type LabelTextStyle,
} from './label-style';
import { RichTextEditor } from './RichTextEditor';

function svgPreserve(alignX: TextAlignX, alignY: TextAlignY): string {
  const ax = alignX === 'left' ? 'xMin' : alignX === 'right' ? 'xMax' : 'xMid';
  const ay = alignY === 'top' ? 'YMin' : alignY === 'bottom' ? 'YMax' : 'YMid';
  return `${ax}${ay} meet`;
}

// --- Auto-scaling single-line label (SVG fit-to-bounds) --------------------

function ScalingLabel({
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

function FixedSizeLabel({
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

// --- Multi-line display (used by sticky) -----------------------------------

type MultilineLabelProps = {
  text: string;
  placeholder: string;
  textSize: TextSize;
  alignX: TextAlignX;
  alignY: TextAlignY;
  className?: string;
};

function MultilineLabel({
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

// --- Per-range rich label (spec/09) ---------------------------------------

// Display renderer for a label carrying per-range formatting. Mirrors the
// FixedSizeLabel / MultilineLabel wrapper (alignment + padding + base font
// + family) and lays the runs out as styled <span>s. Applying any per-run
// override opts the label out of SVG auto-fit (`scale`) into fixed-px
// rendering — mixing per-run sizes with whole-element auto-fit is
// contradictory; see spec/09.
function RichLabel({
  runs,
  element,
  textSize,
  alignX,
  alignY,
  padding,
  fontFamily,
  multiline,
  className = '',
}: {
  runs: TextRun[];
  element: BoxedElement;
  textSize: TextSize;
  alignX: TextAlignX;
  alignY: TextAlignY;
  padding: number;
  fontFamily?: string;
  multiline: boolean;
  className?: string;
}) {
  const basePx = multiline
    ? MULTI_FONT_PX[textSize]
    : textSize === 'scale'
      ? 16
      : FIXED_FONT_PX[textSize];
  const runSizePx = multiline ? MULTI_RUN_PX : FIXED_FONT_PX;
  return (
    <div
      className={`pointer-events-none absolute inset-0 flex overflow-hidden ${
        multiline ? '' : 'font-medium leading-tight'
      } ${className}`}
      style={{ fontSize: `${basePx}px`, alignItems: ALIGN_ITEMS[alignY], padding }}
    >
      <div
        className="w-full whitespace-pre-wrap break-words"
        style={{ textAlign: TEXT_ALIGN[alignX], fontFamily }}
      >
        {runs.map((run, i) => (
          <span key={i} style={effectiveRunStyle(run, element, runSizePx)}>
            {run.text}
          </span>
        ))}
      </div>
    </div>
  );
}

export function renderLabel(
  element: BoxedElement,
  label: string,
  textSize: TextSize,
  alignX: TextAlignX,
  alignY: TextAlignY,
  padding: number,
  isEditing: boolean,
  // Commits the edited label: the plain-text mirror plus the per-range
  // runs (spec/09). Runs are normalized + may be empty for plain text.
  onCommitLabel: (label: string, runs: TextRun[]) => void,
  onCancelEdit: () => void,
  editCursorAtEnd: boolean,
  // Canvas zoom, so the floating edit toolbar counter-scales to a constant
  // on-screen size inside the world transform.
  zoom: number,
  fontFamily?: string,
  // Whole-element alignment + padding setters surfaced in the edit toolbar
  // (spec/09). Operate on the current selection = the editing element.
  onSetAlign?: (x: TextAlignX, y: TextAlignY) => void,
  onSetPadding?: (padding: Padding) => void,
  // Whole-element font + size setters (the toolbar's Font submenu + the
  // Scale size option).
  onSetFont?: (font: string | null) => void,
  onSetTextSize?: (size: TextSize) => void,
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

  const richText = (element as { richText?: TextRun[] }).richText;

  if (isEditing) {
    // Per-element placeholder colour: typed text inherits the element's
    // resolved textColor via currentColor (set on the parent view), so the
    // editor matches the committed label instead of snapping to a default.
    const textClass = isSticky
      ? 'text-amber-950'
      : element.type === 'text'
        ? 'placeholder:text-slate-400'
        : 'placeholder:text-brand-300';
    return (
      <RichTextEditor
        element={element}
        initialLabel={label}
        initialRuns={richText}
        placeholder={placeholder}
        textSize={textSize}
        alignX={alignX}
        alignY={alignY}
        padding={padding}
        fontFamily={fontFamily}
        multiline={isSticky}
        cursorAtEnd={editCursorAtEnd}
        zoom={zoom}
        textClassName={textClass}
        onCommit={onCommitLabel}
        onCancel={onCancelEdit}
        onSetAlign={onSetAlign}
        onSetPadding={onSetPadding}
        onSetFont={onSetFont}
        onSetTextSize={onSetTextSize}
        currentFont={(element as { font?: string }).font ?? null}
      />
    );
  }

  // Per-range formatting (spec/09): once a label carries non-trivial
  // runs, render them as styled spans regardless of size (the `scale`
  // auto-fit opt-out). Empty / single override-free runs fall through to
  // the legacy whole-element renderers below.
  if (hasRichFormatting(richText)) {
    return (
      <RichLabel
        runs={richText!}
        element={element}
        textSize={textSize}
        alignX={alignX}
        alignY={alignY}
        padding={padding}
        fontFamily={fontFamily}
        multiline={isSticky}
        className={isSticky ? 'text-amber-950' : ''}
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
