# Corner radius

A rectangle's corners (and the other free-corner boxes: the browser frame, the banner, the
header bar, the callout card, a stat row's cards, an image, a mind node) take a **corner
preset**, `borderRadius`: **None**, **Small** (4 px), **Medium** (12 px), **Large** (24 px) or
**Full** (a pill, or a circle on a square). Unset, each kind keeps its own default corner (8 px
for a shape, 4 px for an image, 12 px for a mind node).

## Corners scale down on small shapes

A preset's radius is the most a corner is rounded, **never more than a quarter of the box's
shorter side**:

- drawn radius = the smaller of the preset's px and 25% of `min(width, height)`;
- the quarter is `CORNER_RADIUS_MAX_SHARE`, Excalidraw's own adaptive rule (25% of the shorter
  side), so a small rounded square stays a rounded square instead of clamping into a circle;
- **Full** is exempt: its meaning is the pill (a circle on a square), so it keeps its huge radius
  and the browser clamps it to half the shorter side, as always;
- **None** stays 0, and an unset corner goes through the same rule with its kind's default px.

A shape whose shorter side is at least four times the preset's px draws exactly as before; only
small shapes change, and only by rounding less. No stored value changes: the rule is applied
where a corner is drawn.

**One definition** draws every corner: `cornerRadiusPx` in `@livediagram/document`, read by the
canvas (shapes, the dashed-border overlay, images, web components, mind nodes, the isometric
view), every export (SVG and PNG, which draws the SVG) and the hit outlines, so what is seen,
exported and clicked always agree.

## Where it is set

- **Diagram tabs:** the context menu's Border category, as before.
- **Whiteboards:** the quick style panel's **Corners** row (None, Small, Medium, Large), see
  [Quick style panel](quick-style-panel.md); a whiteboard's menu does not offer corners.
- **Imports:** Excalidraw's rounded rectangles land as **Large**, which through the quarter rule
  matches Excalidraw's own rounding at every size up to its 32 px cap
  ([Excalidraw import & export](../020-import-export/excalidraw-import-export.md)).
