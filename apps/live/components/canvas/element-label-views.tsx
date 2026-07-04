// The four display label renderers (spec/09), split out of
// element-labels.tsx: the auto-scaling single-line SVG label, the
// fixed-size single-line label, the sticky multi-line label, and the
// per-range RichLabel. renderLabel (the dispatcher the element views
// call) stays in element-labels.tsx and picks between them.

import { useLayoutEffect, useRef, useState } from 'react';
import {
  type BoxedElement,
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
} from '@/components/canvas/label-style';

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
  animClass,
}: {
  text: string;
  alignX: TextAlignX;
  alignY: TextAlignY;
  padding: number;
  style?: LabelTextStyle;
  // Text-native animation class (spec/09). Only the drop-shadow variants
  // (glow / pulse / trace) reach here — see renderLabel — since drop-shadow
  // follows the SVG glyph alpha; the background-clip gradient can't paint SVG
  // <text> fill, so it's withheld for the auto-fit (`scale`) renderer.
  animClass?: string;
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
        className={animClass}
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

export function FixedSizeLabel({
  text,
  size,
  alignX,
  alignY,
  padding,
  style,
  animClass,
}: {
  text: string;
  size: Exclude<TextSize, 'scale'>;
  alignX: TextAlignX;
  alignY: TextAlignY;
  padding: number;
  style?: LabelTextStyle;
  // Text-native animation class for the glyphs (spec/09); see renderLabel.
  animClass?: string;
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
        className={`w-full whitespace-pre-wrap break-words ${animClass ?? ''}`}
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

// --- Per-range rich label (spec/09) ---------------------------------------

// Display renderer for a label carrying per-range formatting. Mirrors the
// FixedSizeLabel / MultilineLabel wrapper (alignment + padding + base font
// + family) and lays the runs out as styled <span>s. Applying any per-run
// override opts the label out of SVG auto-fit (`scale`) into fixed-px
// rendering — mixing per-run sizes with whole-element auto-fit is
// contradictory; see spec/09.
export function RichLabel({
  runs,
  element,
  textSize,
  alignX,
  alignY,
  padding,
  fontFamily,
  multiline,
  className = '',
  animClass,
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
  // Text-native animation class for the glyphs (spec/09); see renderLabel.
  animClass?: string;
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
        className={`w-full whitespace-pre-wrap break-words ${animClass ?? ''}`}
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
