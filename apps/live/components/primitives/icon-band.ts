// The CSS glyph band inside a captioned icon element (docs/specs/010-palette/technology-icons.md): the region
// OPPOSITE the caption, so moving the text never stacks it over the glyph.
// These Tailwind classes mirror iconBandBounds in @liveplanner/document
// (the export renderer + connector geometry), and are shared by BOTH icon
// kinds — TechIconGlyph centres its fixed-size mark in the band, IconGlyph
// scales its line art to fill it.

import { isOnGlyphLabel, type TextAlignX, type TextAlignY } from '@liveplanner/document';

export function iconBandClass(labelAlignX: TextAlignX, labelAlignY: TextAlignY): string {
  // Middle-centre puts the label ON the glyph (isOnGlyphLabel), so the glyph keeps the whole box.
  if (isOnGlyphLabel({ textAlignX: labelAlignX, textAlignY: labelAlignY })) return 'inset-0';
  // A horizontally-centred caption flips the glyph vertically; a left/right
  // caption flips it horizontally instead and shares the caption's row so
  // the pair lines up (docs/specs/010-palette/technology-icons.md). Same geometry as iconBandBounds.
  const vBand = labelAlignY === 'bottom' ? 'top-[6%] h-[58%]' : 'bottom-[6%] h-[58%]';
  const vRow =
    labelAlignY === 'top'
      ? 'top-[6%] h-[58%]'
      : labelAlignY === 'bottom'
        ? 'bottom-[6%] h-[58%]'
        : 'inset-y-0';
  return labelAlignX === 'left'
    ? `left-1/2 right-[6%] ${vRow}`
    : labelAlignX === 'right'
      ? `left-[6%] right-1/2 ${vRow}`
      : `inset-x-0 ${vBand}`;
}

// The CAPTION's band: the complement of the glyph band above, mirroring
// iconCaptionBand in @liveplanner/document (the export renderer reads the
// same geometry). Confining the caption here — instead of aligning it over
// the whole box — is what keeps a centre/middle caption off the glyph and a
// long left/right caption from running under the mark. Pair with
// captionBandAlignY below for the vertical alignment INSIDE the band.
export function captionBandClass(labelAlignX: TextAlignX, labelAlignY: TextAlignY): string {
  // Middle-centre: on the glyph, over the whole box.
  if (isOnGlyphLabel({ textAlignX: labelAlignX, textAlignY: labelAlignY })) return 'inset-0';
  if (labelAlignX === 'center') {
    // Top caption → the top 36%; bottom → the bottom 36%.
    return labelAlignY === 'bottom' ? 'inset-x-0 bottom-0 h-[36%]' : 'inset-x-0 top-0 h-[36%]';
  }
  // Side captions get their half of the box, on the glyph's row (the same
  // rows iconBandClass uses), so the pair always shares a line.
  const vRow =
    labelAlignY === 'top'
      ? 'top-[6%] h-[58%]'
      : labelAlignY === 'bottom'
        ? 'bottom-[6%] h-[58%]'
        : 'inset-y-0';
  return labelAlignX === 'left' ? `left-0 right-1/2 ${vRow}` : `left-1/2 right-0 ${vRow}`;
}

// How the caption anchors vertically INSIDE its band (the effective alignY
// handed to the label renderers / inline editor): centre captions keep their
// edge, a label on the glyph centres over it, and side captions centre on the
// glyph's row.
export function captionBandAlignY(labelAlignX: TextAlignX, labelAlignY: TextAlignY): TextAlignY {
  if (labelAlignX !== 'center') return 'middle';
  return labelAlignY;
}

// Whether an icon's glyph makes room for its label: once the label has text, and
// from the moment it is being typed, so the inline editor sits where the text
// will land (docs/specs/010-palette/technology-icons.md "While a label is typed").
export function iconMakesRoomForLabel(label: string | undefined, isEditing: boolean): boolean {
  return isEditing || (label ?? '').trim().length > 0;
}
