// Line weight of a placed line-art icon (docs/specs/004-interface-design/iconography.md, "Canvas icons").
// On-screen px: the editor draws it non-scaling, the exporter divides by the glyph's scale, so a
// thin / regular / bold icon reads the same at any size and zoom. `regular` matches the chrome weight.

export type IconWeight = 'thin' | 'regular' | 'bold';

export const ICON_WEIGHTS: readonly IconWeight[] = ['thin', 'regular', 'bold'];

export const ICON_WEIGHT_PX: Record<IconWeight, number> = {
  thin: 0.75,
  regular: 1.25,
  bold: 2,
};

export const DEFAULT_ICON_WEIGHT: IconWeight = 'regular';

// The stroke a remote participant's selection highlight draws on an icon they hold.
export const ICON_REMOTE_HIGHLIGHT_PX = 3;

// On-screen px for a stored weight; unset or unknown (hand-edited data) reads as regular. An own-key
// check, so a stored `"constructor"` or `"toString"` is unknown too, never the object's inherited member.
export function iconWeightPx(weight: IconWeight | undefined): number {
  return weight !== undefined && Object.hasOwn(ICON_WEIGHT_PX, weight)
    ? ICON_WEIGHT_PX[weight]
    : ICON_WEIGHT_PX[DEFAULT_ICON_WEIGHT];
}
