// The four display label renderers (docs/specs/008-canvas/canvas-and-palette.md), split out of
// element-labels.tsx: the auto-scaling single-line SVG label, the
// fixed-size single-line label, the sticky multi-line label, and the
// per-range RichLabel. renderLabel (the dispatcher the element views
// call) stays in element-labels.tsx and picks between them.

import { useLayoutEffect, useRef, useState } from 'react';
import { renderUnits } from './animated-words';
import type { TextAnimView } from './useTextAnimation';
import {
  type BoxedElement,
  type TextAlignX,
  type TextAlignY,
  type TextRun,
  type TextSize,
} from '@livediagram/document';
import {
  ALIGN_ITEMS,
  effectiveRunStyle,
  labelTypographyClass,
  labelBasePx,
  labelRunPx,
  labelTextStyleCss,
  wordmarkTextCss,
  MULTI_FONT_PX,
  TEXT_ALIGN,
  type LabelPadding,
  type LabelTextStyle,
} from '@/components/canvas/label-style';

function svgPreserve(alignX: TextAlignX, alignY: TextAlignY): string {
  const ax = alignX === 'left' ? 'xMin' : alignX === 'right' ? 'xMax' : 'xMid';
  const ay = alignY === 'top' ? 'YMin' : alignY === 'bottom' ? 'YMax' : 'YMid';
  return `${ax}${ay} meet`;
}

// --- Auto-scaling single-line label (SVG fit-to-bounds) --------------------

// Where `preserveAspectRatio="… meet"` puts the measured box inside the svg: its scale and the
// offset of its top-left corner from the label's own (padding included). Measured when the box or
// the svg's size changes; only while a Text animation needs it.
function useSvgFit(
  svg: React.RefObject<SVGSVGElement | null>,
  bbox: { w: number; h: number } | null,
  alignX: TextAlignX,
  alignY: TextAlignY,
  padding: number,
  active: boolean,
): { scale: number; x: number; y: number } | null {
  const [fit, setFit] = useState<{ scale: number; x: number; y: number } | null>(null);
  useLayoutEffect(() => {
    const node = svg.current;
    if (!active || !node || !bbox) return;
    const measure = () => {
      const w = node.clientWidth;
      const h = node.clientHeight;
      if (!w || !h) return;
      const scale = Math.min(w / bbox.w, h / bbox.h);
      const fx = alignX === 'left' ? 0 : alignX === 'right' ? 1 : 0.5;
      const fy = alignY === 'top' ? 0 : alignY === 'bottom' ? 1 : 0.5;
      setFit({
        scale,
        x: padding + (w - bbox.w * scale) * fx,
        y: padding + (h - bbox.h * scale) * fy,
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [svg, bbox, alignX, alignY, padding, active]);
  return active ? fit : null;
}

export function ScalingLabel({
  text,
  alignX,
  alignY,
  padding,
  style,
  animClass,
  textAnim,
}: {
  text: string;
  alignX: TextAlignX;
  alignY: TextAlignY;
  padding: number;
  style?: LabelTextStyle;
  // Text animation (docs/specs/028-animation/element-animations.md). SVG <text> letters cannot move
  // on their own, so an animated label keeps the <text> only to measure the fit (painted
  // transparent) and draws its words as HTML over it, placed and scaled exactly as the view box
  // fits the <text> (useSvgFit). Plain HTML rather than a foreignObject, which WebKit renders
  // without the SVG's scaling once its content is positioned or composited.
  textAnim?: TextAnimView;
  // Text-native animation class (docs/specs/008-canvas/canvas-and-palette.md). Only the drop-shadow variants
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
    // Tracking, weight and case change the glyphs' extent too.
  }, [text, style?.letterSpacing, style?.weight, style?.uppercase, style?.lowercase]);

  const viewBox = bbox ? `${bbox.x} ${bbox.y} ${bbox.w} ${bbox.h}` : '0 0 100 24';
  const svgRef = useRef<SVGSVGElement>(null);
  const fit = useSvgFit(svgRef, bbox, alignX, alignY, padding, !!textAnim);

  return (
    <div className="pointer-events-none absolute inset-0 flex" style={{ padding }}>
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        viewBox={viewBox}
        preserveAspectRatio={svgPreserve(alignX, alignY)}
        className={textAnim ? undefined : animClass}
        overflow="visible"
      >
        <text
          ref={textRef}
          x="0"
          y="0"
          dominantBaseline="hanging"
          fontFamily={style?.fontFamily ?? 'ui-sans-serif, system-ui, sans-serif'}
          fontWeight={style?.weight ?? (style?.bold ? 700 : 500)}
          style={{
            letterSpacing: style?.letterSpacing ? `${style.letterSpacing}em` : undefined,
            textTransform: style?.uppercase
              ? 'uppercase'
              : style?.lowercase
                ? 'lowercase'
                : undefined,
          }}
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
          fill={textAnim ? 'transparent' : 'currentColor'}
          aria-hidden={textAnim ? true : undefined}
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
      {textAnim && bbox && fit ? (
        <div
          key={textAnim.className}
          className={`absolute left-0 top-0 origin-top-left ${textAnim.className}`}
          aria-label={textAnim.ariaLabel}
          style={{
            ...textAnim.style,
            translate: `${fit.x}px ${fit.y}px`,
            scale: String(fit.scale),
            width: bbox.w,
            fontSize: 20,
            lineHeight: 1.2,
            whiteSpace: 'pre',
            fontFamily: style?.fontFamily ?? 'ui-sans-serif, system-ui, sans-serif',
            fontWeight: style?.weight ?? (style?.bold ? 700 : 500),
            fontStyle: style?.italic ? 'italic' : undefined,
            letterSpacing: style?.letterSpacing ? `${style.letterSpacing}em` : undefined,
            textTransform: style?.uppercase
              ? 'uppercase'
              : style?.lowercase
                ? 'lowercase'
                : undefined,
            textDecoration:
              [style?.underline && 'underline', style?.strikethrough && 'line-through']
                .filter(Boolean)
                .join(' ') || undefined,
          }}
        >
          {renderUnits(text, textAnim.plan, { next: 0 })}
        </div>
      ) : null}
    </div>
  );
}

// --- Fixed-size single-line label (sm/md/lg) -------------------------------

export function FixedSizeLabel({
  text,
  px,
  alignX,
  alignY,
  padding,
  style,
  animClass,
  textAnim,
}: {
  text: string;
  // The label's font px: its size preset's, times a text box's Shift-resize scale.
  px: number;
  alignX: TextAlignX;
  alignY: TextAlignY;
  // A number of px on every side, or a CSS padding (a whiteboard text box's 2px 4px).
  padding: LabelPadding;
  style?: LabelTextStyle;
  // Text-native animation class for the glyphs (docs/specs/008-canvas/canvas-and-palette.md); see renderLabel.
  animClass?: string;
  // Text animation (docs/specs/028-animation/element-animations.md): the words split into units.
  textAnim?: TextAnimView;
}) {
  if (!text) return null;
  return (
    <div
      className="pointer-events-none absolute inset-0 flex overflow-hidden font-medium leading-tight"
      style={{
        fontSize: `${px}px`,
        alignItems: ALIGN_ITEMS[alignY],
        padding,
      }}
    >
      <div
        // Keyed by the animation, so picking another restarts it: reveals share a keyframe name, and a
        // finished play-once would otherwise stay finished.
        key={textAnim?.className}
        className={`w-full whitespace-pre-wrap break-words ${textAnim?.className ?? animClass ?? ''}`}
        style={{
          textAlign: TEXT_ALIGN[alignX],
          ...labelTextStyleCss(style ?? {}),
          ...textAnim?.style,
        }}
        aria-label={textAnim?.ariaLabel}
      >
        {textAnim ? renderUnits(text, textAnim.plan, { next: 0 }) : text}
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
  // Auto-fit size (docs/specs/021-event-storming/event-storming.md): when the element's size is 'scale', the
  // caller measures the text against the box and passes the px it fits at,
  // so 'scale' means fill-the-note rather than a fixed small size. The
  // editor is handed the SAME number, or the text jumps on double-click.
  fitPx?: number;
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
  fitPx,
  textAnim,
}: MultilineLabelProps & {
  padding: number;
  style?: LabelTextStyle;
  // Text animation (docs/specs/028-animation/element-animations.md): the note's words split into units.
  textAnim?: TextAnimView;
}) {
  const fontSize = `${fitPx ?? MULTI_FONT_PX[textSize]}px`;
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
      <div
        // Keyed by the animation, so picking another restarts it: reveals share a keyframe name, and a
        // finished play-once would otherwise stay finished.
        key={textAnim?.className}
        className={`w-full whitespace-pre-wrap ${textAnim?.className ?? ''}`}
        style={{ ...innerStyle, ...textAnim?.style }}
        aria-label={textAnim?.ariaLabel}
      >
        {textAnim ? renderUnits(text, textAnim.plan, { next: 0 }) : text}
      </div>
    </div>
  );
}

// --- Per-range rich label (docs/specs/008-canvas/canvas-and-palette.md) ---------------------------------------

// Display renderer for a label carrying per-range formatting. Mirrors the
// FixedSizeLabel / MultilineLabel wrapper (alignment + padding + base font
// + family) and lays the runs out as styled <span>s. Applying any per-run
// override opts the label out of SVG auto-fit (`scale`) into fixed-px
// rendering — mixing per-run sizes with whole-element auto-fit is
// contradictory; see docs/specs/008-canvas/canvas-and-palette.md.
export function RichLabel({
  runs,
  element,
  textSize,
  alignX,
  alignY,
  padding,
  textScale = 1,
  fontFamily,
  multiline,
  uppercase,
  wordmark,
  className = '',
  animClass,
  textAnim,
}: {
  runs: TextRun[];
  element: BoxedElement;
  textSize: TextSize;
  alignX: TextAlignX;
  alignY: TextAlignY;
  padding: LabelPadding;
  // A Shift-resized text box's scale on every size (docs/specs/023-draw-mode/draw-mode.md).
  textScale?: number;
  fontFamily?: string;
  multiline: boolean;
  // Paint in capitals (an event-storming note, docs/specs/021-event-storming/event-storming.md) — whole-label, so
  // it sits on the wrapper rather than on each run's style.
  uppercase?: boolean;
  // Wordmark type (docs/specs/007-editor/logo-pages.md): tracking, weight and case on the wrapper.
  wordmark?: LabelTextStyle;
  className?: string;
  // Text-native animation class for the glyphs (docs/specs/008-canvas/canvas-and-palette.md); see renderLabel.
  animClass?: string;
  // Text animation (docs/specs/028-animation/element-animations.md): each run splits in turn, the
  // unit index running through the whole label.
  textAnim?: TextAnimView;
}) {
  const counter = { next: 0 };
  const basePx = labelBasePx(multiline, textSize) * textScale;
  const runSizePx = labelRunPx(multiline, textScale);
  return (
    <div
      className={`pointer-events-none absolute inset-0 flex overflow-hidden ${labelTypographyClass(
        multiline,
      )} ${className}`}
      style={{ fontSize: `${basePx}px`, alignItems: ALIGN_ITEMS[alignY], padding }}
    >
      <div
        // Keyed by the animation, so picking another restarts it: reveals share a keyframe name, and a
        // finished play-once would otherwise stay finished.
        key={textAnim?.className}
        className={`w-full whitespace-pre-wrap break-words ${textAnim?.className ?? animClass ?? ''}`}
        aria-label={textAnim?.ariaLabel}
        style={{
          ...textAnim?.style,
          textAlign: TEXT_ALIGN[alignX],
          fontFamily,
          ...(wordmark ? wordmarkTextCss(wordmark) : {}),
          textTransform:
            uppercase || wordmark?.uppercase
              ? 'uppercase'
              : wordmark?.lowercase
                ? 'lowercase'
                : undefined,
        }}
      >
        {runs.map((run, i) => (
          <span key={i} style={effectiveRunStyle(run, element, runSizePx)}>
            {textAnim ? renderUnits(run.text, textAnim.plan, counter, `${i}:`) : run.text}
          </span>
        ))}
      </div>
    </div>
  );
}
