// Chromium paints every text baseline on a whole CSS pixel of the untransformed layout, at any pixel
// density, and no CSS opts out; transforms move it after (docs/specs/004-interface-design/
// optical-alignment.md, "Why"). optical-snap.spec.ts holds the browser to this.
export const paintedBaseline = (layoutBaseline: number): number => Math.round(layoutBaseline);

// The part of a text's baseline snap that a shape inherits from its fractional position, not from its
// own size and type: the snap where the shape sits, less the snap it would get on a whole pixel. The ink
// audit subtracts it, so a verdict never turns on unrelated content above the shape.
export function inheritedSnap(baseline: number, shapeTop: number): number {
  const local = baseline - shapeTop;
  return paintedBaseline(baseline) - baseline - (paintedBaseline(local) - local);
}
