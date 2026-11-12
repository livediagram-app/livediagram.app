# Import and export

Follow the references below only as needed; never upfront.

- ./import-image-pipeline.md - when working on storing outside pictures (a picked image search result, an import's images): the shared browser-side resize (2048 px, WebP) + gallery upload, Offline Mode embedding, named failures (gallery full, unsupported, too large, no image storage) and the import report
- ./export-fidelity.md - when working on Export fidelity: An exported image is a picture of the design: whatever the canvas draws, every export draws. Three renderers for the same content (canvas, SVG emitters, PNG canvas-2D drawers) had each drifted, so labels exported two thirds of their size and twenty-two kinds exported as an empty labelled box. Held by one definition per decision in @livedesign/design, imported by both sides, plus the list of kinds the PNG path must rasterise
- ./blueprints/README.md - when implementing from a blueprint: the import image pipeline

## The dialogs' header

The Export and Import dialogs wear the [dialog hero
header](../../../../liveworkspace/docs/specs/004-index/dialog-hero-header.md), their title (**Export Tab** or **Export
Selection**, **Import to Tab**) and its one line in the band, then **Help** and the close. Export draws the tab
leaving as files: a page in the bottom left, a dashed line along the foot to format tiles fanned in the bottom right,
the file going out in front in the accent; an arrow rising out of a tray is its mark. Import draws files coming in:
two files in the bottom left, a dashed line along the foot to a dashed frame in the bottom right, a file dropping
in over its edge; an arrow into a tray is its mark. Both arts are shared
(`@liveworkspace/ui/dialog-hero-art/export`, `/import`), so every product's pair reads alike.
