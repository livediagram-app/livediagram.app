// Shared label typography helpers used by both the display renderers
// (element-labels.tsx) and the contentEditable rich-text editor
// (RichTextEditor.tsx). Extracted so the editor can reuse the exact font
// tables + per-run style resolution without an import cycle through
// element-labels.tsx (which imports the editor).

import { LABEL_FONT_PX, NOTE_FONT_PX, RUN_XS_PX } from '@livediagram/document';
import type {
  BoxedElement,
  RunSize,
  TextAlignX,
  TextAlignY,
  TextRun,
  TextSize,
  RunHeading,
} from '@livediagram/document';
import type { RunDefaults } from '@/components/rich-text/rich-text-format';

// The base a label run's unset deltas inherit: the element's whole-element
// text fields. Notes have no such base and use PLAIN_RUN_DEFAULTS instead.
export function elementRunDefaults(el: BoxedElement): RunDefaults {
  return {
    bold: !!el.textBold,
    italic: !!el.textItalic,
    underline: !!el.textUnderline,
    strikethrough: !!el.textStrikethrough,
    color: el.textColor ?? null,
  };
}

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

// The label px tables live in @livediagram/document, because the EXPORTERS
// need the same numbers: they kept their own set (12 / 14 / 20 / 18 against
// these) and every exported label came out about two thirds the size it was
// drawn at. Re-exported here so the canvas's label renderers keep importing
// them from the module they always have.
export const FIXED_FONT_PX: Record<
  Exclude<import('@livediagram/document').TextSize, 'scale'>,
  number
> = LABEL_FONT_PX;

export const MULTI_FONT_PX: Record<import('@livediagram/document').TextSize, number> = NOTE_FONT_PX;

// Per-run sm/md/lg map to the same px table the element's base size uses,
// so a run's size override reads consistently against its neighbours; xs is RUN_XS_PX on every
// scale (docs/specs/008-canvas/canvas-and-palette.md "Extra-small runs").
export const MULTI_RUN_PX: Record<RunSize, number> = {
  xs: RUN_XS_PX,
  sm: MULTI_FONT_PX.sm,
  md: MULTI_FONT_PX.md,
  lg: MULTI_FONT_PX.lg,
};

// The base px a label is drawn at: a note's scale for a multi-line label, else the single-line
// scale, where 'scale' is a middling fixed size (only a note fits its text to its box). A
// Shift-resized text box multiplies it by its own scale (docs/specs/023-whiteboard/whiteboard.md).
export function labelBasePx(multiline: boolean, textSize: TextSize): number {
  return multiline ? MULTI_FONT_PX[textSize] : LABEL_FONT_PX[textSize];
}

// The px a run's own size override draws at, scaled with the label.
export function labelRunPx(multiline: boolean, scale = 1): Record<RunSize, number> {
  const table = multiline ? MULTI_RUN_PX : FIXED_FONT_PX;
  return {
    xs: RUN_XS_PX * scale,
    sm: table.sm * scale,
    md: table.md * scale,
    lg: table.lg * scale,
  };
}

// A label's inset: px on every side, or a CSS padding (a whiteboard text box's 2px 4px).
export type LabelPadding = number | string;

// Inline label-style props applied by every label renderer (scaling,
// fixed, multiline). Stored independently so any combination, e.g.
// bold + italic + strikethrough, works.
export type LabelTextStyle = {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  // Resolved CSS font-family stack (docs/specs/004-interface-design/fonts.md). Undefined = inherit the
  // editor default. Applied to both the committed label and its live
  // editor so there's no font jump on commit.
  fontFamily?: string;
  // Paint in capitals whatever was typed (an event-storming note,
  // docs/specs/021-event-storming/event-storming.md). A CSS transform, not a rewrite: the stored label keeps the
  // author's casing, and the live editor wears the same rule so typing
  // shows the note as it will read.
  uppercase?: boolean;
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
    textTransform: style.uppercase ? 'uppercase' : undefined,
  };
}

// Resolve one run ⊕ the element's whole-element defaults into a span
// style. Boolean attrs inherit the element field when the run leaves them
// unset (runs are deltas). Colour + size are only emitted when the run
// overrides them — otherwise the span inherits the wrapper's base font and
// the element's resolved text colour (set as `color`/currentColor on the
// parent element view, same as the legacy label path).
// Heading levels as multipliers on the inherited size (docs/specs/009-elements/block-type-picker.md).
const HEADING_SCALE: Record<RunHeading, { scale: number; weight: number }> = {
  1: { scale: 1.7, weight: 700 },
  2: { scale: 1.35, weight: 700 },
  3: { scale: 1.15, weight: 600 },
};

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
  // Headings (docs/specs/009-elements/block-type-picker.md). Expressed as `em` rather than px so a heading scales
  // with whatever base size the element carries — a label, a sticky and a
  // page all have different bases, and pinning heading px like the note
  // renderer does would make an H1 smaller than the body on a large element.
  if (run.heading) {
    const h = HEADING_SCALE[run.heading];
    css.fontSize = `${h.scale}em`;
    css.fontWeight = h.weight;
    css.lineHeight = '1.25';
  }
  return css;
}

// The typography a label wears, display and editor alike. They MUST agree:
// the display label and the inline editor occupy the same box, so any
// difference in leading or weight moves the glyphs (and can re-wrap a
// multi-line label) the moment editing starts — a layout shift on the most
// common interaction there is. Single-line labels run tight + medium; a
// multi-line label (sticky, page) keeps the element's own line-height.
export function labelTypographyClass(multiline: boolean): string {
  return multiline ? '' : 'font-medium leading-tight';
}
