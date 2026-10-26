# Technology icons

A **Technology icon** is a full-colour brand mark for an infrastructure service (AWS S3, Lambda, Azure Functions,
Kubernetes, Postgres, ...) on an `icon` element. liveplanner shows no palette, so nothing places one; it arrives with a
tab (an import, a paste, an agent's elements). The catalogue is the platform's (`@liveworkspace/icons`), the geometry
is `@liveworkspace/model-core/icon-size`, and liveplanner's parts are the element model, the export render, the
element menu's size presets and the captioned-glyph bands. The canvas has no face for a standalone `icon` element
([Elements](../009-elements/README.md)): it shows as an empty box with its selection ring, while every export draws it.

## The element

A Technology icon is the same **`shape: 'icon'`** element a line-art icon is; `element.iconId` keys it, and the id
resolves in the technology catalogue instead of the line-art one. `isTechIconId(iconId)` (`@liveworkspace/icons`,
answered from a first-load id set) picks the coloured renderer, otherwise the stroke-tinted line one. A brand mark is
never recoloured by the element's stroke: an orange Lambda is only recognisable orange.

### iconId stays a plain string

`iconId` is a plain string in the model, so a new icon needs no migration and an id in neither catalogue renders the
placeholder glyph. **A key that is not text is refused on the way in**: validation (`validate.ts`) refuses an
`iconId`, `stickerId` or `flowchartId` that is not a string of at most 256 characters, and one that arrives anyway (a
stored tab, a peer's op, a file) is dropped as it enters (`malformed-ids.ts`), so the element reads as one with a key
this build does not know.

## A fixed tile size

The mark renders at a **fixed pixel size**, not scaled to the element box, so a plan's brand marks read as a uniform
set of chips. The size is the element's `iconSize` preset (`IconSize`: `sm`, `md`, `lg`, `xl` → 32, 48, 64, 96 px,
`ICON_SIZE_PX`), defaulting to `md`, clamped to the box when the box is smaller. The element menu's **Icon** category
offers the four presets as tiles (`context-menu-tiles.tsx`; Small, Medium, Large, Huge) for one Technology icon or a
multi-selection of them, with the usual hover preview and click commit (`useElementStyle`, `useStylePreview`,
`style-presets.ts`).

## The caption's alignment

With a label, the mark (or a line-art glyph, which keeps scaling with its box) sits in the **band opposite the
caption's alignment**, so moving the text never stacks it over the art: a bottom caption (the icon default) puts it in
the top band, a top caption in the bottom band, and a left or right caption in the other half, on the caption's row.
Without a label it centres in the whole box. The caption is confined to the complement band: a centre caption keeps
the full width, a side caption is confined to its half and centred on the glyph's row.

`iconBandBounds`, `techIconMarkBounds` and `iconCaptionBand` (`icon-size.ts`) are the single geometry; the editor's
CSS bands (`iconBandClass`, `captionBandClass` in `components/primitives/icon-band.ts`) mirror their numbers, and the
export renderer (`svg-render-describe.ts`, `svg-render-image-icon.ts`) applies them, so a captioned icon exports as
drawn.

### Middle-centre puts the label on the glyph

The centre of the alignment grid has no side to sit on, so it means _on the art_: the glyph keeps the whole box and
the label is centred over it (`isOnGlyphLabel`). That is how a number goes in a circle.

### While a label is typed

The glyph takes its band from the moment editing starts, so the inline editor sits where the text will land
(`icon-band.ts`).

A caption never disappears into its band: on a small icon the caption draws past its band, over the art, rather than
being clipped.

## Connectors attach to the mark

Arrow anchors on a Technology icon sit on the mark's rectangle (`techIconMarkBounds`, `shape-outline.ts`), not the
element box, so a pinned end touches the chip. On the caption's side the anchors push out to the element edge, so a
connector leaving towards the caption starts beyond the text instead of crossing it
([Arrow anchors and auto-rebind](../008-canvas/arrow-anchors.md)).

## The UML theme

The UML theme gives each shape kind its own colours (`shapeColors`: a new diamond takes its decision colour,
`themes.test.ts`), the architecture-diagram counterpart of the brand marks; a Technology mark keeps its brand colours
on every theme.

## Telemetry

An added Technology icon counts as `Element·Added·TechIcon` (`lib/element-telemetry.ts`).

## Testing

`packages/project/src/svg-render.test.ts` (the fixed size and every band), `geometry.test.ts` (anchoring on the mark),
`malformed-ids.test.ts` (keys are text), `collab-shapes.test.ts` (alignment places the caption),
`apps/editor/components/primitives/icon-band.test.ts` (the CSS bands match the export).
