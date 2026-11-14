// A lane's title on the canvas (docs/specs/009-elements/lane.md "A title wraps in its gutter", "Upright titles"; Work
// Tracker 877): no Plan surface places a lane, but a tab can still carry one, and the canvas draws it as every export
// does, read-only. A title reading across a side strip lays out in the strip in whole words, stepping down a size or
// two for a long word, at most three lines; an upright one turns in its strip. The frame and the layout are the ones
// livediagram's canvas uses (@liveworkspace/workbench lane-title-frame), from the same helpers as the export.
import {
  PADDING_PX,
  acrossTitlePadding,
  acrossTitleStrip,
  defaultPadding,
  hasRichFormatting,
  isUprightTitle,
  labelFontPx,
  uprightTitleStrip,
  type BoxedElement,
  type TextAlignX,
  type TextAlignY,
  type TextRun,
  type TextSize,
} from '@liveplanner/project';
import {
  laneTitleFrame,
  laneTitleText,
  type LabelFrame,
} from '@liveworkspace/workbench/components/canvas/lane-title-frame';

export type LaneTitle = {
  // Where the label lays out (and, upright, turns), or null when the element is no lane or its title is a band's.
  frame: LabelFrame | null;
  // The label as shown: a plain across title at rest arrives laid out in whole words, one line per line.
  label: string;
  // Its size: a px size when a long word stepped the title down, else the element's own.
  textSize: TextSize;
  padding: number;
  alignX: TextAlignX;
  alignY: TextAlignY;
};

export function laneTitleOf(
  element: BoxedElement,
  label: string,
  textSize: TextSize,
  alignX: TextAlignX,
  alignY: TextAlignY,
  isEditing: boolean,
  fontFamily: string | undefined,
): LaneTitle {
  const padding = PADDING_PX[element.padding ?? defaultPadding(element)];
  const plain = { frame: null, label, textSize, padding, alignX, alignY };
  if (element.type !== 'shape' || element.shape !== 'lane') return plain;
  const upright = isUprightTitle(element)
    ? uprightTitleStrip(element, element.width, element.height)
    : null;
  if (upright) {
    // Inside the turned frame the title reads along the strip, centred across it; a one-line strip keeps at most the
    // small padding.
    return {
      frame: laneTitleFrame(element, upright, isEditing, false),
      label,
      textSize,
      padding: Math.min(PADDING_PX.sm, padding),
      alignX: upright.alongAlign,
      alignY: 'middle',
    };
  }
  const across = acrossTitleStrip(element, element.width, element.height);
  if (!across) return plain;
  const stripPadding = acrossTitlePadding(padding);
  // A plain title at rest is laid out here, in whole words; a formatted one (its runs) is clamped by CSS.
  const fits =
    !isEditing &&
    textSize !== 'scale' &&
    !hasRichFormatting((element as { richText?: TextRun[] }).richText);
  const fitted = fits
    ? laneTitleText(label, across, stripPadding, {
        px: labelFontPx(textSize),
        bold: !!element.textBold,
        italic: !!element.textItalic,
        fontFamily,
      })
    : null;
  return {
    frame: laneTitleFrame(element, null, isEditing, fits),
    label: fitted?.text ?? label,
    textSize: fitted && fitted.px !== labelFontPx(textSize) ? fitted.px : textSize,
    padding: stripPadding,
    alignX,
    // An across title being edited hangs from the strip's top, so it grows down into view.
    alignY: isEditing ? 'top' : alignY,
  };
}
