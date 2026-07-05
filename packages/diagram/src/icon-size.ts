// Fixed pixel sizes for Technology icon marks (spec/41). A brand tile
// renders at a preset size regardless of its element's box — resizing the
// element gives the caption room, it doesn't inflate the mark — so a
// diagram's chips stay a uniform set. Shared by the editor renderer
// (TechIconGlyph) and the export / headless renderer (svgIconShape), which
// must agree on the geometry.

export type IconSize = 'sm' | 'md' | 'lg' | 'xl';

export const ICON_SIZES: readonly IconSize[] = ['sm', 'md', 'lg', 'xl'];

export const ICON_SIZE_PX: Record<IconSize, number> = {
  sm: 32,
  md: 48,
  lg: 64,
  xl: 96,
};

export const DEFAULT_ICON_SIZE: IconSize = 'md';

// The preset's pixel size, clamped so the mark never overflows the room it
// renders in (a small element box still shows the whole tile).
function iconSizePx(size: IconSize | undefined, maxW: number, maxH: number): number {
  return Math.max(0, Math.min(ICON_SIZE_PX[size ?? DEFAULT_ICON_SIZE], maxW, maxH));
}

// The glyph BAND inside an icon element: the region of the box the glyph
// may occupy. The band sits OPPOSITE the caption (spec/41), so moving the
// text never stacks it over the glyph: a horizontally-centred caption flips
// the glyph vertically (bottom caption → top band, top/middle → bottom
// band); a left/right caption flips it horizontally instead (left caption →
// right half, right → left half) and keeps the glyph on the caption's row
// (top / middle / bottom of the box) so the two line up side by side. No
// label = the whole box. Shared by BOTH icon kinds: Technology marks centre
// their fixed-size tile in it (techIconMarkBounds below) and line-art
// glyphs scale to fill it (svgIconShape / IconGlyph).
export function iconBandBounds(el: {
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  textAlignX?: 'left' | 'center' | 'right';
  textAlignY?: 'top' | 'middle' | 'bottom';
}): { x: number; y: number; width: number; height: number } {
  const hasLabel = !!el.label;
  const ax = el.textAlignX ?? 'center';
  const ay = el.textAlignY ?? 'bottom';
  let bandX = el.x;
  let bandW = el.width;
  let bandY = el.y;
  let bandH = el.height;
  if (hasLabel && ax === 'center') {
    // Vertical inverse: the caption owns its band, the glyph the other.
    bandY = el.y + el.height * (ay === 'bottom' ? 0.06 : 0.36);
    bandH = el.height * 0.58;
  } else if (hasLabel) {
    // Horizontal inverse: caption left → glyph in the right half (and vice
    // versa), sharing the caption's row so the pair reads as one line.
    bandX = ax === 'left' ? el.x + el.width * 0.5 : el.x + el.width * 0.06;
    bandW = el.width * 0.44;
    if (ay !== 'middle') {
      bandY = el.y + el.height * (ay === 'top' ? 0.06 : 0.36);
      bandH = el.height * 0.58;
    }
  }
  return { x: bandX, y: bandY, width: bandW, height: bandH };
}

// The caption's band inside a captioned icon element: the complement of the
// glyph band above, plus how the text anchors vertically INSIDE it. Keeping
// the caption in its own band (instead of aligning it over the whole box, as
// it used to be) is what stops a centre/middle caption landing on top of the
// glyph and a long left/right caption running under the mark. Shared by the
// editor's CSS bands (captionBandClass mirrors these numbers) and the export
// renderer (describeBoxedExport), so a captioned icon exports exactly as
// drawn.
//
// - Centre captions keep the full width and take the vertical band the glyph
//   doesn't: top → the top 36% (top-anchored), bottom → the bottom 36%
//   (bottom-anchored), middle → the top 36% bottom-anchored, so the text sits
//   directly above the glyph band instead of overlapping it.
// - Left/right captions get their half of the box (text wraps at the half,
//   never under the glyph) and centre vertically on the glyph's row — the
//   same 6–64% / full-height / 36–94% row iconBandBounds uses — so the
//   caption and the mark always share a line.
export function iconCaptionBand(el: {
  x: number;
  y: number;
  width: number;
  height: number;
  textAlignX?: 'left' | 'center' | 'right';
  textAlignY?: 'top' | 'middle' | 'bottom';
}): {
  x: number;
  y: number;
  width: number;
  height: number;
  valign: 'top' | 'middle' | 'bottom';
} {
  const ax = el.textAlignX ?? 'center';
  const ay = el.textAlignY ?? 'bottom';
  if (ax === 'center') {
    return {
      x: el.x,
      width: el.width,
      y: ay === 'bottom' ? el.y + el.height * 0.64 : el.y,
      height: el.height * 0.36,
      valign: ay === 'top' ? 'top' : 'bottom',
    };
  }
  return {
    x: ax === 'left' ? el.x : el.x + el.width * 0.5,
    width: el.width * 0.5,
    y: ay === 'middle' ? el.y : el.y + el.height * (ay === 'top' ? 0.06 : 0.36),
    height: ay === 'middle' ? el.height : el.height * 0.58,
    valign: 'middle',
  };
}

// The rectangle a Technology mark actually occupies inside its element: its
// fixed preset size, centred in the glyph band, clamped to the box. One
// implementation shared by the export renderer (svgIconShape), the editor
// overlay (TechIconGlyph's CSS bands mirror these numbers), and the
// connector geometry (arrows attach to the mark, not the element box — the
// box can be much larger than the chip).
export function techIconMarkBounds(el: {
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  textAlignX?: 'left' | 'center' | 'right';
  textAlignY?: 'top' | 'middle' | 'bottom';
  iconSize?: IconSize;
}): { x: number; y: number; width: number; height: number } {
  const band = iconBandBounds(el);
  const size = iconSizePx(el.iconSize, band.width, band.height);
  return {
    x: band.x + (band.width - size) / 2,
    y: band.y + (band.height - size) / 2,
    width: size,
    height: size,
  };
}
