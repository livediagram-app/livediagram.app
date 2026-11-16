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
| `src/pdf/struct-tree.ts`      | `StructTree`: Document over H1 to H6 and P, MCIDs, the parent tree                                       |
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
4. After the walk: `mergeLines(readingOrder(items))` into `3 Tr` text objects; when the SVG has `data-pdf-tag`, each
   line is marked content of its block's element and the drawing is wrapped in `/Artifact BMC ... EMC`.
5. Any throw on a page: that page becomes `raster()` composited on white (no `raster`: the error is the caller's).
6. Fonts, resources, tree, pages, catalog (`/MarkInfo`, `/StructTreeRoot`, `/Lang`, `/ViewerPreferences`), info
   (`/Title`), then the bytes.

The products: each `export-tab-pdf.ts` dynamic-imports `@liveworkspace/vector-export/pdf`, builds the SVG with its
`exportTabAsSvg`, passes `raster: () => renderTabToCanvas(...)`, `title: tab.name` and
`fallbackFontCss: () => embeddedFontFaceCss(['inter'])`. livedocuments adds `pdfLinksFor` and tags
(`blockTagger` in `article-snapshot.ts`, written as `data-pdf-tag`/`data-pdf-block` by `articleOpsToSvg`).

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

Tags in the SVG: `data-pdf-tag` (H1 to H6, else read as P) with `data-pdf-block` (an integer, reading order) on a
`<text>` or an ancestor.

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
- O(n) in elements and characters: `mergeLines` and `readingOrder` are linear (a stable sort of tagged runs).

## Accessibility

Text in render mode 3 with ToUnicode, in reading order, joined into lines with spaces; tagged H1 to H6/P where the
writing knows them (EX4), `/Tabs /S`, `/Lang` (EX3), `/Title` with `DisplayDocTitle`.

## Observability

`console.warn('[pdf] ...')` for a page drawn as a picture and a picture that failed; `[outline]` for letters outside
the embedded faces. No telemetry.

## Testing

- `src/pdf/core.test.ts`: matrices, transforms, path data, shapes, the file, resources, pictures, the text layer,
  tags, glyph forms, links, page size (read back with `src/test-pdf.ts`).
- `src/pdf/svg-to-pdf.test.ts` (jsdom, `src/test-dom.ts` standing in for layout, canvas, `Image`, `FontFace`): every
  SVG feature, the fallbacks, text, tags, the fallback face, fontkit loading.
- `src/lazy-guard.test.ts`; the outliner's own tests in `src/outline-text/`.
- Each product: `lib/export-tab-pdf.test.ts` (the caller and the first-load guard); livedocuments and livedesign
  `export-tab-page-motion.test.ts`; livedocuments `article-snapshot-tags.test.ts` and `article-draw-ops.test.ts`.
- In a browser (the PR): a long article and a big diagram through the real export, text extracted with pdf.js in
  reading order, contents links landing, sizes against the raster PDF, page 1 beside the PNG, a 4x render.

## Constants and configuration

`DEFAULT_RASTER_SCALE` 3, `MAX_RASTER_PIXELS` 8,000,000, `IMAGE_MAX_SCALE` 3, `PT_PER_PX` 0.75, `MAX_PDF_PAGE_PT`
14400, Type 3 `ADVANCE` 500 and 255 codes a font, `MIN_DEFLATE` 64 bytes, colour cache 512, `FALLBACK_FAMILY` Inter.

## Assets and external resources

fontkit 2.0.4 (with dfa 1.2.0 and brotli 1.3.3), lazy; their licence texts are `VECTOR_EXPORT_OVERRIDES` in
`packages/licences/src/tables.ts`, spread into every product's overrides. Inter from Google Fonts through each product's
`embeddedFontFaceCss`.

## Defaults ledger

EX1, EX2, EX3, EX4, EX5 ([DEFAULTS.md](DEFAULTS.md)).
