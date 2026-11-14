// Whether the strip reaches into a top-corner panel stack, horizontally, with
// `gap` to spare. An empty corner (zero width) never counts. The canvas chrome
// then starts its top corner stacks below the strip (docs/specs/007-editor/toolbar-layout.md).
export type Span = { left: number; right: number };
export function stripCrowdsCorners(strip: Span, corners: Span[], gap = 8): boolean {
  return corners.some(
    (c) => c.right - c.left > 0 && strip.left < c.right + gap && strip.right > c.left - gap,
  );
}
