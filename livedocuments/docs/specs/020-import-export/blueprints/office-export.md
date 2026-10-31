# PowerPoint and Word export: blueprint

Derived from [PowerPoint and Word export](../office-export.md). The spec decides; this file only adds engineering
precision. Defaults are ledgered in [DEFAULTS.md](DEFAULTS.md) and cited as `Dn`.

Scope, by file (under `apps/editor/lib/office-export/` unless marked):

| File                                              | Role                                                                                            |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `ooxml.ts`                                        | `writeOoxmlPackage`: content types, relationships, core and app properties, then the zip        |
| `ooxml-colour.ts`                                 | `ooxmlColour`: a CSS colour as six hex digits and an alpha, `NO_PAINT`, or null; `fontFaceName` |
| `ooxml-theme.ts`                                  | The one theme part both files carry                                                             |
| `pptx-types.ts`, `docx-types.ts`                  | What each writer takes, already in the file's units                                             |
| `pptx-native.ts`                                  | `nativeSlideItem`: a text element or basic shape as a native shape, or null for a picture       |
| `pptx-build.ts`                                   | `buildDeck`: the tab's pages into slides, through a `PageDrawer` for pictures                   |
| `pptx-slide-xml.ts`, `pptx-parts.ts`              | A slide's and its notes' XML; the presentation, master, layout, notes master and properties     |
| `pptx-write.ts`                                   | `writePptx`: the deck as a `.pptx`                                                              |
| `docx-build.ts`                                   | `buildDocx`: the tab's articles into blocks, each zone an image                                 |
| `docx-styles.ts`, `docx-body.ts`                  | Styles, numbering, settings and footer; the body's paragraphs, runs, links and images           |
| `docx-write.ts`                                   | `writeDocx`: the document as a `.docx`                                                          |
| `page-drawer.ts`                                  | `pageDrawer`: pictures of some of a page's elements, or its background, as PNG bytes            |
| `progress.ts`                                     | `ExportProgress`, `ExportCancelled`, `yieldToBrowser`                                           |
| `summary.ts`                                      | The card offered (`officeFormatFor`), the panel's copy, `slideOfPage`                           |
| `index.ts`                                        | `exportOfficeFile`: tab to file, the panel's one entry                                          |
| `test-tabs.ts`                                    | Fixture tabs: every element kind, every block kind, long decks and articles; a fake drawer      |
| `components/dialogs/office/OfficeExportPanel.tsx` | The panel, loaded lazily with the writers                                                       |
| `components/dialogs/office/useOfficeExport.ts`    | The making: progress, Cancel, failure, download, telemetry                                      |
| `lib/export-tab.ts`                               | `renderTabToCanvas` takes `only` (element ids) and `crop` (a canvas rect)                       |

Only `page-drawer.ts` and the panel touch the DOM; every other module runs in Node under Vitest.

## Domain and naming

| Term       | Identifier            | Meaning                                                                                   |
| ---------- | --------------------- | ----------------------------------------------------------------------------------------- |
| Format     | `OfficeFormat`        | `'pptx' \| 'docx'`, the card chosen                                                       |
| Drawer     | `PageDrawer`          | `{ region(page, ids, rect), background(page) }` → PNG bytes                               |
| Placement  | `SlidePlacement`      | `{ emuPerPx, ox, oy }`: canvas px to slide EMU, the page fitted and centred               |
| Deck       | `PptxDeck`            | `{ title, cx, cy, slides }`, each slide a background, items in paint order, notes, hidden |
| Item       | `PptxItem`            | `PptxShape` (a text box, a preset or a custom outline) or `PptxPicture`                   |
| Word block | `DocxBlock`           | An `ArticleBlock` without its zone, or `DocxImage` (`png`, size, `wrap`, `align`)         |
| Look       | `DocxLook`            | The article style resolved: faces, sizes in px, six-digit colours, rules, page numbers    |
| Failure    | `OfficeExportFailure` | `draw`, `gone`, `failed`                                                                  |

## Constants and configuration

| Constant           | Value  | Where            | Why                                                             |
| ------------------ | ------ | ---------------- | --------------------------------------------------------------- |
| `SLIDE_EMU_PER_PX` | 6,350  | `pptx-build.ts`  | 1920 px is 12,192,000 EMU, PowerPoint's 13.33 in widescreen     |
| `EMU_PER_PT`       | 12,700 | `pptx-native.ts` | So a 48 px heading is 24 pt                                     |
| `PICTURE_PAD`      | 4 px   | `pptx-build.ts`  | Antialiasing and strokes past the box stay in the picture (D70) |
| `ARROW_PAD`        | 16 px  | `pptx-build.ts`  | An arrow's head and label stay in its picture (D70)             |
| `PICTURE_SCALE`    | 2      | `page-drawer.ts` | Pictures at the PNG export's resolution (D71)                   |
| `BACKGROUND_SCALE` | 1      | `page-drawer.ts` | A whole-page picture, as a JPEG, stays tens of KB (D71)         |
| `DOCX_EMU_PER_PX`  | 9,525  | `docx-body.ts`   | Word's 96 dpi pixel                                             |
| `TWIPS_PER_PX`     | 15     | `docx-styles.ts` | Word's spacing and page units                                   |
| `LIST_LEVELS`      | 5      | `docx-styles.ts` | The article's list levels, 0 to 4                               |

## Behaviour and state

### `buildDeck(input, drawer, progress)` → `PptxDeck`

The deck's size is the first page's shape (D69); every page is placed by `placementFor` (one factor, centred). For
each page, its elements are those `layerBands` paints that `pageExportFrame(page).reaches`, in paint order, minus an
article's notes. Each is offered to `nativeSlideItem`; a null makes it a picture of that element alone,
`pictureRect` (its drawn bounds, the arrow route and label, or its shadow, padded) cut to the page by `cutTo`. The
background is `none`, `solid` (the fill's colour) or `picture` (`drawer.background`). Notes and hidden come from
`slideOfPage(deck, tab.id, page.id)`. Progress is reported per slide; the thread yields between slides; a cancel
throws `ExportCancelled` at the next slide.

### `nativeSlideItem(el, ctx, name)` → `PptxShape | 'empty' | null`

Text elements and the shape kinds in `PRESET` (square, stadium, circle, cylinder) and `OUTLINE_KINDS` (diamond,
triangle, hexagon, parallelogram, trapezoid, star, cloud, document) only. Null (a picture) when the element has a
shadow, an accent edge, an icon, the Sketch or any non-flat finish, a marker, a label the boxed drawer would not
draw, or a colour `ooxmlColour` cannot name. `'empty'` for a text element with no text. Colours, faces, sizes and
alignment are `describeBoxedExport`'s, so the deck reads as the PNG does. An outline kind's geometry is its own
silhouette (`shapePolygonVertices`, else `shapePathData`) as a custom path in the shape's own EMU (a renderer that
ignores a path's coordinate space still draws it right).

### `buildDocx(input, drawer, progress)` → `DocxDocument`

`articleFlowsInOrder(tab)` (the page row's order); a page break between articles. Every non-zone block passes
through; a zone becomes a `DocxImage` of `zoneMemberIds` drawn in `zoneCanvasRect`, or nothing when it was never laid
out. The page is the first article page's size; the look is `docxLook(style, themeAccent)`.

### `writeDocx(doc)`

Styles carry the look (Title, Subtitle, Heading 1 to 3 with outline levels, Quote, Code paragraph and character
styles, List Paragraph, Hyperlink). Lists use two abstract numberings, bullets (•, ◦, ▪ in the accent) and numbers
(1, a, i); each numbered run gets its own `w:num` restarting at 1 (D74). To-dos are list paragraphs led by ☐ or ☒
(D75). Empty headings and empty non-body paragraphs are left out (D73). A wrapped zone is a `wp:anchor` with
`wrapSquare`; an inline one an inline picture in its own aligned paragraph.

### `exportOfficeFile(input, progress)` → `OfficeExportResult`

Never throws. No pages → `gone`; `DrawRefused` (a canvas read refused or a null blob) → `draw`; `ExportCancelled` →
`{ cancelled: true }`; anything else → `failed` (logged with `console.warn`).

## Interfaces and contracts

- `ExportTabDialog` takes `deck?: Deck`, passed from `EditorTabDialogs` as `slideDeck?.deck`. Its `Format` gains
  `'pptx' | 'docx'`; `PAGES_FORMATS` lists them after `gif`, filtered by `officeFormatFor(pages)`. The dialog loads
  the images and tab windows for the PowerPoint and Word cards as for the image formats and hands them to the panel
  (`render`), with the first page's preview SVG.
- `renderTabToCanvas(tab, { only, crop })`: with `only`, only those elements are drawn and the page's paper,
  background, motion and pattern are not; with `crop`, the canvas is exactly that rect at the scale.
- `@livedocuments/document` re-exports `borderOf` and `finishOf` from `svg-render`.

## Data and persistence

Nothing is stored. The file is made in memory and downloaded.

## Errors and edge cases

| Case                                      | Handling                                              |
| ----------------------------------------- | ----------------------------------------------------- |
| A canvas read refused, `toBlob` null      | `draw`                                                |
| The tab's pages gone                      | `gone`                                                |
| Anything else thrown                      | `failed`                                              |
| Cancel, or the dialog closed              | Aborted at the next slide or zone; nothing downloads  |
| An element wholly off its page            | Left out of the slide                                 |
| A zone never laid out                     | Left out of the document                              |
| Notes or text with characters XML forbids | Stripped (`xmlText`)                                  |
| A link that is not http, https or mailto  | Never in an article (the article refuses it on entry) |
| A page of another shape than the deck's   | Fitted inside the deck's slide, centred               |

## Security and trust

Nothing leaves the device. Everything written is escaped by `xmlText`; relationship targets are our own part names
or the article's links (already `isSafeArticleHref`), written `TargetMode="External"`.

## Performance and limits

- **Chunk**: the panel and writers are one lazy chunk, `import('./office/OfficeExportPanel')` from the dialog: 42.1 KB
  minified, 15.8 KB gzip (esbuild, the packages the editor already loads left out). The dialog's own chunk gains
  only `summary.ts` and the two card icons.
- **Build and write**, pictures faked (`office-export.perf.test.ts` holds a 200 ms CPU budget each): a 50-slide deck
  (five elements a slide, one a picture) in about 100 ms, a 292 KB file; a 30-page article (a heading, five
  paragraphs, a list item and a zone a page) in 45 to 60 ms, a 115 KB file; measured on a loaded machine (load 16).
- **Pictures** dominate in the browser: each is one `renderTabToCanvas` call at 2x and one PNG encode, the image
  export's own cost per element. They run one at a time with a yield between slides or zones, so the editor stays
  responsive. In Chrome (headless), the six-slide pitch template (20 pictures, a gradient background) took 0.44 to
  0.70 s from Download to the file, 930 KB: about 0.1 s a slide.
- **Backgrounds are JPEG** (quality 0.9): the template's gradient was a 1.43 MB PNG and is a 15 KB JPEG. A picture the
  deck repeats (the same background on every slide) is one media part (`MediaStore`: FNV-1a over the bytes, then a
  full comparison), so a 50-slide deck on one background stores it once.

## Presentation and UX

- The cards: **PowerPoint** (a landscape slide chip in orange, `PPTX`), **Word** (a page chip in blue, `DOCX`).
- The panel: `BackBar` ("All formats" › PowerPoint / Word); the preview box (h-48, the image formats' own); a
  slate-50 box with the summary line (semibold) and the "What stays editable" list, each line led by a brand
  `CheckIcon`; the error box; the footer row: the progress bar and **Cancel** while making, then the primary
  **Download PowerPoint** / **Download Word**, disabled until the preview's images are loaded.

## Accessibility

- The list is a `<ul aria-label="What stays editable">`; the progress bar is `role="progressbar"` with
  `aria-valuenow`, labelled "Making the deck…" / "Making the document…"; the error is `role="alert"`.
- The back bar is disabled while making, so focus stays on Cancel and Download.

## Observability

`debugLog('[office-export]', 'made', { format, pages, bytes, ms })` and `'cancelled'`; a failure is
`console.warn('[office-export] failed', failure, error)`.

## Testing

| Rule                                                   | Test                              |
| ------------------------------------------------------ | --------------------------------- |
| Every element kind, read back by the PowerPoint import | `pptx.test.ts`                    |
| Text box properties, natives vs pictures, backgrounds  | `pptx.test.ts`                    |
| Every block kind, read back by the Word import         | `docx.test.ts`                    |
| Numbering runs, wraps, articles in order, look         | `docx.test.ts`                    |
| Entry, drawer, errors, cancel                          | `index.test.ts`                   |
| `only` and `crop`                                      | `export-tab-page-motion.test.ts`  |
| 50-slide and 30-page budgets                           | `office-export.perf.test.ts`      |
| Cards by kind, panel copy, progress, download, Cancel  | `ExportTabDialog.office.test.tsx` |

The fixture files were also opened with python-pptx and python-docx and rendered by Quick Look while building.

## Assets and external resources

No dependency is added: the zip is `@liveworkspace/workbench/lib/zip-writer`'s, the XML our own strings.
