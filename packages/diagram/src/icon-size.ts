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
export function iconSizePx(size: IconSize | undefined, maxW: number, maxH: number): number {
  return Math.max(0, Math.min(ICON_SIZE_PX[size ?? DEFAULT_ICON_SIZE], maxW, maxH));
}

// The rectangle the mark actually occupies inside a Technology icon
// element: its fixed preset size, centred in the glyph band, clamped to the
// box. The band sits OPPOSITE the caption (spec/41), so moving the text
// never stacks it over the mark: a horizontally-centred caption flips the
// mark vertically (bottom caption → top band, top/middle → bottom band); a
// left/right caption flips it horizontally instead (left caption → right
// half, right → left half) and keeps the mark on the caption's row (top /
// middle / bottom of the box) so the two line up side by side. No label =
// centred in the whole box. One implementation shared by the export
// renderer (svgIconShape), the editor overlay (TechIconGlyph's CSS bands
// mirror these numbers), and the connector geometry (arrows attach to the
// mark, not the element box — the box can be much larger than the chip).
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
  const hasLabel = !!el.label;
  const ax = el.textAlignX ?? 'center';
  const ay = el.textAlignY ?? 'bottom';
  let bandX = el.x;
  let bandW = el.width;
  let bandY = el.y;
  let bandH = el.height;
  if (hasLabel && ax === 'center') {
    // Vertical inverse: the caption owns its band, the mark the other.
    bandY = el.y + el.height * (ay === 'bottom' ? 0.06 : 0.36);
    bandH = el.height * 0.58;
  } else if (hasLabel) {
    // Horizontal inverse: caption left → mark in the right half (and vice
    // versa), sharing the caption's row so the pair reads as one line.
    bandX = ax === 'left' ? el.x + el.width * 0.5 : el.x + el.width * 0.06;
    bandW = el.width * 0.44;
    if (ay !== 'middle') {
      bandY = el.y + el.height * (ay === 'top' ? 0.06 : 0.36);
      bandH = el.height * 0.58;
    }
  }
  const size = iconSizePx(el.iconSize, bandW, bandH);
  return {
    x: bandX + (bandW - size) / 2,
    y: bandY + (bandH - size) / 2,
    width: size,
    height: size,
  };
}
