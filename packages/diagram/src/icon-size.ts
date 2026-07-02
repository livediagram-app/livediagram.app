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
