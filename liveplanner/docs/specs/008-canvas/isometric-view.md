# Isometric export

liveplanner has **no isometric canvas tool**: the canvas tools are Hand and Select
([Plan mode](../026-plan/plan-mode.md#tools)). What is left of the isometric view is the
image export's option, which tilts a picture of the tab and leaves the tab alone.

The Export dialog ([Editor app](../007-editor/editor-app.md) `ExportTabDialog`) carries an **Isometric view**
iOS-style toggle, **off by default**. When on, the image exports (PNG / SVG /
PDF) tilt the rendered scene into an isometric projection; JSON / Markdown ignore it. The export applies the projection's 2D affine
(`isoCanvasMatrix` in `lib/isometric.ts` — an in-plane rotation by the azimuth
then a `cos(elevation)` vertical squash, a parallel projection, never a perspective one) and sizes the canvas / SVG viewBox to the
projected footprint (`isoProjectBounds`) so nothing clips. Each element also
gets a **voxel extrusion**: a stack of its
silhouette stepped along the projected depth axis (`isoDepthLayers` /
`isoLayerBrightness`), dimmed toward the floor, behind the element body — so the
export reads with depth, not as a flat tilted plane.


**What extrudes.** Each boxed element (shapes, tables, images, stickies, annotations) gets a column in its own
colour (its stroke, else its fill, else neutral), dimmed toward the floor and clipped to the shape's silhouette
(`isoShapeSilhouette`). Three kinds stay flat on the base plane, all decided by one predicate (`isoExtrudes`,
`lib/isometric.ts`): **frames** (a section backdrop, not a block), **plain text** (an extrusion would put a slab
behind bare words) and **icon shapes** (a slab under a glyph buries it). Arrows, freehand strokes and labels have no
box to extrude and ride the tilt.

**Out:** an isometric floor grid, a perspective camera, per-element heights, 3D arrows.

See also [Editor app](../007-editor/editor-app.md) (the export dialog) and
[Project structure](../006-project/project-structure.md) (the 2D element model this projects).
