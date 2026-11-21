# Vector PDF blueprint

Implements [vector-pdf.md](../vector-pdf.md). Code in `packages/vector-export`.

## Domain and naming

- **Page**: one `SvgPdfPage` `{ svg, links?, raster? }`: the SVG a product's SVG export makes, its link areas in PDF
  points, and the product's canvas render for a page the writer can't draw.
- **Mounted SVG**: the page parsed with `parseInert` and placed in a 0x0, `overflow: hidden`, `opacity: 0` host so
  the browser lays out its text and computes its styles. Never `visibility: hidden`: it is inherited, and hidden text
  is skipped.
- **Root space**: the SVG root's user space. Each page stream starts with `cm rootToPage`
  (`[sx 0 0 -sy -vbX*sx mediaH+vbY*sy]`), so everything after is drawn in root units, y down.
- **Glyph form**: one glyph of one face at one size, a Form XObject in font units, placed by `q <matrix> cm /Xn Do Q`.
- **Fallback picture**: one element drawn alone by the browser (an isolated SVG of its ancestor chain and the
  definitions it uses, through `Image` onto a canvas) and placed as an image with a soft mask.

## Files

| File                          | Holds                                                                                                    |
| ----------------------------- | -------------------------------------------------------------------------------------------------------- |
| `src/pdf/svg-to-pdf.ts`       | `svgPagesToPdf(pages, opts)`: mounting, faces, the per-page vector try and raster catch, the catalog     |
| `src/pdf/svg-walk.ts`         | `drawElement`: fallback reasons, opacity groups, transforms, viewports, clips, knockouts, shapes, text   |
| `src/pdf/svg-paint.ts`        | `paintPath`: colours, alphas, blend, line style, paint order; `filled` for glyph forms                   |
| `src/pdf/svg-paint-server.ts` | gradients as shading patterns (Type 2/3, stitched Type 3 functions), user-space tiling patterns          |
| `src/pdf/svg-mask.ts`         | `knockoutClip`: a white-minus-black mask as an even-odd clip                                             |
| `src/pdf/svg-raster.ts`       | `rasterElement`: the isolated SVG, its crop (filter region or padding), MAX_RASTER_PIXELS                |
| `src/pdf/svg-image.ts`        | `<image>`: JPEG passthrough or pixels, shared by address and size, IMAGE_MAX_SCALE                       |
| `src/pdf/svg-text.ts`         | text items for the layer, outlines through `outline-text/outline-element.ts`                             |
| `src/pdf/glyph-forms.ts`      | `glyphOps`, `placeGlyphs`                                                                                |
| `src/pdf/fallback-face.ts`    | `withFallbackFace`: text in a stack with no embedded face set in Inter                                   |
| `src/pdf/text-layer.ts`       | `InvisibleFonts` (Type 3, 255 codes a font, ToUnicode), `readingOrder`, `mergeLines`, `textLayerOps`     |
| `src/pdf/struct-tree.ts`      | `StructTree`: Document over the tag paths' elements and Figures, MCIDs, the parent tree, page rollback   |
| `src/pdf/pdf-file.ts`         | `PdfFile`: objects, `CompressionStream` deflate, xref, trailer                                           |
| `src/pdf/pdf-resources.ts`    | the one resource dictionary every page, form and pattern shares                                          |
| `src/pdf/pdf-image.ts`        | RGB plus DeviceGray soft mask, `jpegInfo`, `dataUrlBytes`, `loadPixels`                                  |
| `src/pdf/pdf-links.ts`        | `PdfLink`, `linkAnnotation` (moved from livedocuments)                                                   |
| `src/pdf/pdf-page-size.ts`    | `PT_PER_PX`, `MAX_PDF_PAGE_PT`, `pageMedia`, `singlePageMedia`                                           |
| `src/outline-text/*`          | the Logo Kit outliner (Work Tracker 860), moved from livedesign; `outline-svg.ts` is the Logo Kit's door |
| `src/lazy-guard.ts`           | `staticLazyImports`: the first-load guard each app's tests run                                           |

Exports: `./pdf`, `./pdf-links`, `./pdf-page-size`, `./outline-svg`, `./outline-error`, `./lazy-guard`.

## Behaviour and state

1. For each page: mount it, take its `@font-face` CSS out, add Inter (`withFallbackFace`) when text has no face of its
   own and the caller gives `fallbackFontCss`, register the faces (fontkit loads only now, once per export), wait for
   `document.fonts.ready`.
2. Walk the root (`drawElement`). Per element: skip what isn't rendered, ask `fallbackReason`; a reason draws a
   fallback picture (text inside still goes to the text layer). Otherwise push `q`, its transform, its clip, knockout
   or viewport clip; a translucent group (or a group with a blend) draws into a transparency-group form.
3. Text: `outlineTextElement` gives outlined paths with their glyph placements; a solid fill with no stroke places glyph
   forms, anything else paints the path. The text's runs, in page points, go to the text layer.
4. Figures, during the walk of a tagged PDF: an element with `data-pdf-alt` closes the drawing's artifact, draws
   inside `/Figure << /MCID n >> BDC ... EMC` and reopens it. Inside a figure, a translucent group's form or a
   fallback picture no new figure opens: the alt texts met there join the one outside it (a group or picture drawn
   straight on the page becomes the Figure of the alt texts inside it). A pattern's tile is never a figure.
5. After the walk: `mergeLines(readingOrder(items))` into `3 Tr` text objects; when the PDF is tagged (a page has
   `data-pdf-tag` or `data-pdf-alt`), each line is marked content of its tag path's leaf element and the drawing is
   wrapped in `/Artifact BMC ... EMC`. `endPage` puts the page's new top-level elements in the Document, each Figure
   before the first that starts below its top (EX6).
6. Any throw on a page: that page becomes `raster()` composited on white (no `raster`: the error is the caller's),
   and `resetPage` takes back every element, kid and MCID the page had added.
7. Fonts, resources, tree, pages, catalog (`/MarkInfo`, `/StructTreeRoot`, `/Lang`, `/ViewerPreferences`), info
   (`/Title`), then the bytes.

The products: each `export-tab-pdf.ts` dynamic-imports `@liveworkspace/vector-export/pdf`, builds the SVG with its
`exportTabAsSvg`, passes `raster: () => renderTabToCanvas(...)`, `title: tab.name` and
`fallbackFontCss: () => embeddedFontFaceCss(['inter'])`. livedocuments adds `pdfLinksFor` and tags
(`blockTagger` in `article-pdf-tags.ts`, its lists rebuilt from the flat writing, written as `data-pdf-tag`/`data-pdf-block` by `articleOpsToSvg`). Every
product's image export (`svgImageShape` in `@liveworkspace/element-model`) puts the picture's alt text on its clip
group as `data-pdf-alt`.

## Interfaces and contracts

```ts
type SvgPdfPage = {
  svg: string;
  links?: readonly PdfLink[];
  raster?: () => Promise<HTMLCanvasElement>;
};
type SvgPdfOptions = {
  title?: string;
  rasterScale?: number; // default 3
  fallbackFontCss?: () => Promise<string>;
  loadFontkit?: () => Promise<Fontkit>; // tests
};
function svgPagesToPdf(pages: readonly SvgPdfPage[], opts?: SvgPdfOptions): Promise<Blob>; // application/pdf
```

Tags in the SVG: `data-pdf-tag` with `data-pdf-block` (an integer, reading order) on a `<text>` or an ancestor. The
tag is a path of segments `Tag#key` split by `/`, outermost first: `L#l0/LI#i4/LBody` is the words of list item 4,
`L#l0/LI#i4/Lbl#m4` its marker, `Table#t0/TR#r2/TH` a header cell. Each segment's key names one element across the
document (a segment with no key is keyed by its path); the last segment's key defaults to the block, so a container
`LBody#4` is the same element as block 4's leaf `LBody` (a nested list sits in its item's body). Tags known: H1 to H6,
P, BlockQuote, L, LI, Lbl, LBody, Table, TR, TH, TD; an unknown leaf reads as P, an unknown container is skipped.
`data-pdf-alt` on any element makes it (and what it draws) a Figure with that `/Alt`. An element with `data-pdf-empty`
(and a tag and block; livedocuments writes one per empty table cell, an `empty` draw op, at the cell's top left) draws
nothing: it is a text-layer item with no text, read in its block's order, that `textLayerOps` hands to
`StructTree.declare`, an element with no content.

## Errors and edge cases

- A page that isn't an SVG throws (no fallback can size it). A drawing error falls back per page.
- A picture that fails to load is left out, logged `[pdf]` (EX5). A fallback picture that fails to draw is left out.
- Glyphs whose `codePoints` are empty (fontkit caches a glyph by id; one first made by a substitution keeps none) are
  mapped to characters one-to-one when the counts match, else one character each (`glyphStarts`).
- A knockout is accepted only with `maskUnits="userSpaceOnUse"`, user-space content, a white shape inside the region
  and black holes inside it that don't overlap; anything else is a picture.
- Invalid transform lists are ignored whole; path data keeps segments up to the first error; arcs with a zero radius
  are lines.

## Security and trust

The page is parsed with `parseInert` (Trusted Types), never `DOMParser` directly. Fallback pictures are data: URLs of
the page's own SVG; nothing is fetched except pictures the SVG already names and, by the product, Inter's faces.

## Performance and limits

- Lazy: `./pdf` only by dynamic `import()`; fontkit only when a page has text with faces; Inter only when a page has
  system-stack text. `staticLazyImports` in each app's `export-tab-pdf.test.ts` fails a static import.
- Glyph forms: each glyph written once (a nine-page article: 176 KB, against 3.7 MB with every outline inline).
- Fallback pictures at EX1, cropped to the page and to their filter region; images capped at IMAGE_MAX_SCALE (3)
  device px per CSS px and shared across pages; MAX_RASTER_PIXELS 8,000,000.
- O(n) in elements and characters: `mergeLines` and `readingOrder` are linear (a stable sort of tagged runs); each
  line's tag path is parsed once per distinct path and its elements found by key; a page's figures are sorted once
  and merged with its blocks in one pass; alt texts inside a fallback picture are gathered once per picture, which
  never overlap. `src/pdf/struct-tree.test.ts` holds a CPU-time budget for 20,000 tagged lines and 2,000 figures (measured 75 to 170 ms under load); livedocuments' `article-pdf-tags.test.ts` one for tagging 6,000 list items and a 1,000-row table in one pass (31 ms).

## Accessibility

Text in render mode 3 with ToUnicode, in reading order, joined into lines with spaces; tagged headings, paragraphs,
quotes, lists (L, LI, Lbl, LBody) and tables (Table, TR, TH with `/Scope`, TD) where the writing knows them (EX4);
described pictures as Figures with `/Alt`, undescribed ones artifacts (EX6); `/Tabs /S`, `/Lang` (EX3), `/Title` with
`DisplayDocTitle`.

## Observability

`console.warn('[pdf] ...')` for a page drawn as a picture and a picture that failed; `[outline]` for letters outside
the embedded faces. No telemetry.

## Testing

- `src/pdf/core.test.ts`: matrices, transforms, path data, shapes, the file, resources, pictures, the text layer,
  tags, glyph forms, links, page size (read back with `src/test-pdf.ts`).
- `src/pdf/struct-tree.test.ts`: tag paths, lists, tables, figures in reading order, rollback, the structure tree
  dumped and checked whole, and the CPU-time budget.
- `src/pdf/svg-to-pdf.test.ts` (jsdom, `src/test-dom.ts` standing in for layout, canvas, `Image`, `FontFace`): every
  SVG feature, the fallbacks, text, tags, the fallback face, fontkit loading.
- `src/lazy-guard.test.ts`; the outliner's own tests in `src/outline-text/`.
- Each product: `lib/export-tab-pdf.test.ts` (the caller and the first-load guard); livedocuments and livedesign
  `export-tab-page-motion.test.ts`; livedocuments `article-pdf-tags.test.ts` and `article-draw-ops.test.ts`.
- In a browser (the PR): a long article and a big diagram through the real export, text extracted with pdf.js in
  reading order, contents links landing, sizes against the raster PDF, page 1 beside the PNG, a 4x render.

## Constants and configuration

`DEFAULT_RASTER_SCALE` 3, `MAX_RASTER_PIXELS` 8,000,000, `IMAGE_MAX_SCALE` 3, `PT_PER_PX` 0.75, `MAX_PDF_PAGE_PT`
14400, Type 3 `ADVANCE` 500 and 255 codes a font, `MIN_DEFLATE` 64 bytes, colour cache 512, `FALLBACK_FAMILY` Inter.

## Assets and external resources

fontkit 3.0.0 (with dfa 2.0.0 and brotli 2.1.0), lazy. fontkit ships its own LICENSE; dfa and brotli ship none, so
their licence texts are `VECTOR_EXPORT_OVERRIDES` in `packages/licences/src/tables.ts`, spread into every product's
overrides. Inter from Google Fonts through each product's
`embeddedFontFaceCss`.

## Defaults ledger

EX1, EX2, EX3, EX4, EX5, EX6 ([DEFAULTS.md](DEFAULTS.md)).
