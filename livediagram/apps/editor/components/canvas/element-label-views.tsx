// The four display label renderers (docs/specs/008-canvas/canvas-and-palette.md): the auto-scaling single-line SVG
// label, the fixed-size single-line label and the sticky multi-line label are the shared ones
// (@liveworkspace/workbench/components/canvas/element-label-views), made once here around this editor's typography
// and Text animation units; the per-range RichLabel is this editor's own. renderLabel (the dispatcher the element
// views call) stays in element-labels.tsx and picks between them.

import { renderUnits } from './animated-words';
import type { TextAnimView } from './useTextAnimation';
import type { TextAnimPlan } from './animated-words';
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
  TEXT_ALIGN,
  type LabelPadding,
  type LabelTextStyle,
} from '@/components/canvas/label-style';
import { createLabelViews } from '@liveworkspace/workbench/components/canvas/element-label-views';

export const { ScalingLabel, FixedSizeLabel, MultilineLabel } = createLabelViews<
  LabelTextStyle,
  TextAnimPlan
>({ labelTextStyleCss, renderUnits });

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
  // Wordmark type (docs/specs/007-editor/editor-modes.md "Pages moved to livedocuments"): tracking, weight and case on the wrapper.
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
        // Animated, the text is drawn in pieces: read it as one labelled picture, never letter by letter.
        role={textAnim?.ariaLabel ? 'img' : undefined}
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
