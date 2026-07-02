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
// element: its fixed preset size, centred in the glyph band (the band
// opposite the caption's vertical alignment when labelled, the whole box
// when not), clamped to the box. One implementation shared by the export
// renderer (svgIconShape) and the connector geometry (arrows attach to the
// mark, not the element box — the box can be much larger than the chip).
export function techIconMarkBounds(el: {
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  textAlignY?: 'top' | 'middle' | 'bottom';
  iconSize?: IconSize;
}): { x: number; y: number; width: number; height: number } {
  const hasLabel = !!el.label;
  const labelBottom = (el.textAlignY ?? 'bottom') === 'bottom';
  const bandY = hasLabel ? el.y + el.height * (labelBottom ? 0.06 : 0.36) : el.y;
  const bandH = hasLabel ? el.height * 0.58 : el.height;
  const size = iconSizePx(el.iconSize, el.width, bandH);
  return {
    x: el.x + (el.width - size) / 2,
    y: bandY + (bandH - size) / 2,
    width: size,
    height: size,
  };
}
