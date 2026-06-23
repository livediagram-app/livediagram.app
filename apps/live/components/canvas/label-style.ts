// Shared label typography helpers used by both the display renderers
// (element-labels.tsx) and the contentEditable rich-text editor
// (RichTextEditor.tsx). Extracted so the editor can reuse the exact font
// tables + per-run style resolution without an import cycle through
// element-labels.tsx (which imports the editor).

import type { BoxedElement, RunSize, TextAlignX, TextAlignY, TextRun } from '@livediagram/diagram';

export const ALIGN_ITEMS: Record<TextAlignY, 'flex-start' | 'center' | 'flex-end'> = {
  top: 'flex-start',
  middle: 'center',
  bottom: 'flex-end',
};

export const TEXT_ALIGN: Record<TextAlignX, 'left' | 'center' | 'right'> = {
  left: 'left',
  center: 'center',
  right: 'right',
};

// Fixed pixel sizes for the sm/md/lg buckets (single-line shapes + text).
export const FIXED_FONT_PX: Record<
  Exclude<import('@livediagram/diagram').TextSize, 'scale'>,
  number
> = {
  sm: 14,
  md: 22,
  lg: 32,
};

// Sticky notes run smaller; 'scale' here means a sensible multi-line base.
export const MULTI_FONT_PX: Record<import('@livediagram/diagram').TextSize, number> = {
  scale: 14,
  sm: 12,
  md: 16,
  lg: 22,
};

// Per-run sm/md/lg map to the same px table the element's base size uses,
// so a run's size override reads consistently against its neighbours.
export const MULTI_RUN_PX: Record<RunSize, number> = {
  sm: MULTI_FONT_PX.sm,
  md: MULTI_FONT_PX.md,
  lg: MULTI_FONT_PX.lg,
};

// Inline label-style props applied by every label renderer (scaling,
// fixed, multiline). Stored independently so any combination, e.g.
// bold + italic + strikethrough, works.
export type LabelTextStyle = {
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
export function labelTextStyleCss(style: LabelTextStyle): React.CSSProperties {
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

// Resolve one run ⊕ the element's whole-element defaults into a span
// style. Boolean attrs inherit the element field when the run leaves them
// unset (runs are deltas). Colour + size are only emitted when the run
// overrides them — otherwise the span inherits the wrapper's base font and
// the element's resolved text colour (set as `color`/currentColor on the
// parent element view, same as the legacy label path).
export function effectiveRunStyle(
  run: TextRun,
  el: BoxedElement,
  runSizePx: Record<RunSize, number>,
): React.CSSProperties {
  const css = labelTextStyleCss({
    bold: run.bold ?? el.textBold,
    italic: run.italic ?? el.textItalic,
    underline: run.underline ?? el.textUnderline,
    strikethrough: run.strikethrough ?? el.textStrikethrough,
    // fontFamily is applied once on the wrapper, not per span.
  });
  if (run.color) css.color = run.color;
  if (run.size) css.fontSize = `${runSizePx[run.size]}px`;
  return css;
}
