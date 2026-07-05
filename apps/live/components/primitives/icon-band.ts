// The CSS glyph band inside a captioned icon element (spec/41): the region
// OPPOSITE the caption, so moving the text never stacks it over the glyph.
// These Tailwind classes mirror iconBandBounds in @livediagram/diagram
// (the export renderer + connector geometry), and are shared by BOTH icon
// kinds — TechIconGlyph centres its fixed-size mark in the band, IconGlyph
// scales its line art to fill it.

import type { TextAlignX, TextAlignY } from '@livediagram/diagram';

export function iconBandClass(labelAlignX: TextAlignX, labelAlignY: TextAlignY): string {
  // A horizontally-centred caption flips the glyph vertically; a left/right
  // caption flips it horizontally instead and shares the caption's row so
  // the pair lines up (spec/41). Same geometry as iconBandBounds.
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
// iconCaptionBand in @livediagram/diagram (the export renderer reads the
// same geometry). Confining the caption here — instead of aligning it over
// the whole box — is what keeps a centre/middle caption off the glyph and a
// long left/right caption from running under the mark. Pair with
// captionBandAlignY below for the vertical alignment INSIDE the band.
export function captionBandClass(labelAlignX: TextAlignX, labelAlignY: TextAlignY): string {
  if (labelAlignX === 'center') {
    // Top caption → the top 36%; bottom → the bottom 36%; middle → the top
    // 36% too, but bottom-anchored (captionBandAlignY) so the text sits
    // directly above the glyph band instead of overlapping it.
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
// edge (middle hugs the glyph via the bottom anchor); side captions centre
// on the glyph's row.
export function captionBandAlignY(labelAlignX: TextAlignX, labelAlignY: TextAlignY): TextAlignY {
  if (labelAlignX !== 'center') return 'middle';
  return labelAlignY === 'top' ? 'top' : 'bottom';
}
