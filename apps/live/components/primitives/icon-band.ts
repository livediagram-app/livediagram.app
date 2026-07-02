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
