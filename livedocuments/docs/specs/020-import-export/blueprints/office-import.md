# Word and PowerPoint import: blueprint

Derived from [Word and PowerPoint import](../office-import.md). The spec decides; this file only adds engineering
precision. Defaults are ledgered in [DEFAULTS.md](DEFAULTS.md) and cited as `Dn`.

Scope, by file (under `apps/editor/lib/office-import/` unless marked):

| File                                            | Role                                                                                       |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `limits.ts`                                     | Every number the import uses, named                                                        |
| `errors.ts`                                     | `OfficeImportError`, `OfficeImportFailure`, `officeErrorMessage`                           |
| `zip.ts`                                        | `openZip`: the central directory read, entries unpacked on demand under one budget         |
| `xml.ts`                                        | `parseXml`: the bounded XML reader (no DTD), namespaces folded to canonical prefixes       |
| `package.ts`                                    | `openOfficePackage`: zip + content types + relationships, the main part, `OfficePackage`   |
| `tally.ts`                                      | `SkipTally`: counts of what was left out                                                   |
| `docx-styles.ts`                                | Paragraph styles, numbering and run properties of a Word package                           |
| `docx.ts`                                       | `readDocx`: the body walked into `DocxBlock`s and the pictures they name                   |
| `pptx-shapes.ts`                                | Placeholders, transforms and a text body into a slide's items                              |
| `pptx.ts`                                       | `readPptx`: slides, their items, notes and hidden flags, the deck size                     |
| `store-images.ts`                               | `storePictures`: each picture once, three at a time, through an `ImportImageSession`       |
| `build-article.ts`                              | `buildArticleTab`: blocks + stored images into an article tab (zones parked off the page)  |
| `build-deck.ts`                                 | `buildDeckTab`: slides + stored images into a tab of slide pages, with each page's notes   |
| `report.ts`                                     | `officeImportReport`: the tally and image outcomes as the dialog's report lines            |
| `index.ts`                                      | `importOfficeFile`: the whole import, file to tab, the one entry the editor imports lazily |
| `test-fixtures.ts`                              | A zip writer and Word, Google Docs, PowerPoint and Google Slides package builders (tests)  |
| `components/dialogs/FileImportPanel.tsx`        | The file panel: drop area, Choose a File, stage line, error                                |
| `lib/drop-import-hint.ts`                       | A `.docx` / `.pptx` dropped on the canvas points to Import in the tab menu                 |
| `hooks/persistence/useTabImport.ts`             | `importFileIntoActiveTab(format, file, onStage)`: runs the import and replaces the tab     |
| `@livedocuments/document` `slide-deck-pages.ts` | `deckWithPageSlideDetails`: imported notes and hidden flags onto the page slides           |

Only `index.ts` (through the session factory it is handed) and the panel touch the DOM; every other module runs in
Node under Vitest (`DecompressionStream`, `Blob` and `TextDecoder` are Node globals).

## Domain and naming

| Term          | Identifier            | Meaning                                                                                                                                |
| ------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| File format   | `FileImportFormat`    | `'word' \| 'powerpoint'`, the card chosen                                                                                              |
| Text format   | `TextImportFormat`    | `'json' \| 'markdown'`                                                                                                                 |
| Import format | `ImportFormat`        | `TextImportFormat \| FileImportFormat`                                                                                                 |
| Package       | `OfficePackage`       | An opened file: `format`, `mainPath`, `readXml(path)`, `readBytes(path, max)`, `rels(path)`                                            |
| Part          | (a zip entry path)    | One file inside the package, named by its normalised path (`word/document.xml`)                                                        |
| Relationship  | `OfficeRel`           | `{ id, type, target, external }`, `target` resolved against the part's folder                                                          |
| Picture       | `OfficePicture`       | `{ path, widthPx, heightPx, alt?, cropped? }`: a picture part an item shows                                                            |
| Docx block    | `DocxBlock`           | An `ArticleBlock` without its zone, or `{ type: 'picture', picture }`                                                                  |
| Slide item    | `SlideItem`           | `{ kind: 'text', box, label, sizePt, alignX, alignY, bold, italic }` or `{ kind: 'picture', box, picture }`                            |
| Box           | `EmuBox`              | `{ x, y, cx, cy }` in EMU on the deck's slide                                                                                          |
| Skip tally    | `SkipTally`           | `Partial<Record<SkipKind, number>>`                                                                                                    |
| Stage         | `OfficeImportStage`   | `{ stage: 'reading' } \| { stage: 'images', done, total }`                                                                             |
| Failure       | `OfficeImportFailure` | `too-large`, `legacy`, `not-a-package`, `wrong-format`, `unpacks-too-large`, `too-many-slides`, `too-many-blocks`, `too-large-for-tab` |

`SkipKind`, in report order: `tables`, `footnotes`, `comments`, `headersFooters`, `textBoxes`, `charts`,
`diagrams`, `equations`, `media`, `embedded`, `linkedImages`, `shapes`, `crowded`, `longText`.

## Constants and configuration

| Constant                        | Value               | Provenance                                    | Safe range       |
| ------------------------------- | ------------------- | --------------------------------------------- | ---------------- |
| `OFFICE_MAX_FILE_BYTES`         | `50 * 1024 * 1024`  | Spec: 50 MB (the image pipeline's source cap) | 10 MB to 100 MB  |
| `OFFICE_MAX_ZIP_ENTRIES`        | `4000`              | Spec                                          | 1,000 to 20,000  |
| `OFFICE_MAX_PART_BYTES`         | `32 * 1024 * 1024`  | Spec: one XML part                            | 8 MB to 64 MB    |
| `OFFICE_MAX_UNPACKED_BYTES`     | `256 * 1024 * 1024` | Spec: everything one import unpacks           | 64 MB to 512 MB  |
| `OFFICE_INFLATE_SLICE_BYTES`    | `16 * 1024`         | D60: input fed to the inflater per write      | 4 KB to 64 KB    |
| `OFFICE_XML_MAX_DEPTH`          | `256`               | Spec                                          | 64 to 1,024      |
| `OFFICE_XML_MAX_ELEMENTS`       | `1_000_000`         | Spec                                          | 100k to 4M       |
| `OFFICE_MAX_IMAGES`             | `100`               | Spec: the hosted gallery's count              | 20 to 500        |
| `OFFICE_MAX_SLIDE_ITEMS`        | `300`               | Spec                                          | 100 to 1,000     |
| `OFFICE_NOTES_MAX`              | `20_000`            | D61: one slide's notes, characters            | 2,000 to 100,000 |
| `MAX_PAGES` (document)          | `100`               | A tab's page cap                              | shared, not ours |
| `MAX_ARTICLE_BLOCKS` (document) | `5000`              | An article's block cap                        | shared, not ours |
| `MAX_TAB_BYTES` (api-schema)    | `1.99 MB`           | A saved tab's cap                             | shared, not ours |
| `EMU_PER_PX`                    | `9525`              | OOXML: 914,400 EMU an inch, 96 px an inch     | fixed            |
| `EMU_PER_PT`                    | `12700`             | OOXML                                         | fixed            |

## Behaviour and state

### `openZip(bytes)` → `ZipArchive` or throws `OfficeImportError`

1. Find the end-of-central-directory record (`0x06054b50`) scanning back from the end, at most 65,557 bytes
   (22 + the longest comment). None: `not-a-package`.
2. A ZIP64 marker (entry count `0xffff` or offset `0xffffffff`) is `not-a-package` (D62: a file under 50 MB never
   needs ZIP64). More than `OFFICE_MAX_ZIP_ENTRIES` entries: `unpacks-too-large`.
3. Walk the central directory, bounds-checked against the buffer at every read; a header out of bounds or with
   the wrong signature: `not-a-package`. Each entry keeps `{ method, flags, compressedSize, size, localOffset }`
   under its name, normalised (backslashes to `/`, no leading `/`), compared case-insensitively (OPC); the first
   of two same-named entries wins.
4. `read(name, max)`: the local header's name and extra lengths locate the data. An encrypted entry (flag bit 0)
   or a method other than 0 (stored) and 8 (deflate) is `not-a-package`. A stored entry larger than `max` is
   `unpacks-too-large`. A deflated one is inflated through `DecompressionStream('deflate-raw')`, fed
   `OFFICE_INFLATE_SLICE_BYTES` at a time while its output is read, counted as it arrives: past `max`, or past
   what is left of the archive's `OFFICE_MAX_UNPACKED_BYTES`, both streams are cancelled and the read is
   `unpacks-too-large`. A stream error is `not-a-package`. The declared sizes are never trusted.

### `parseXml(text)` → `XmlElement` or throws

- `<!DOCTYPE`, `<!ENTITY` or any other `<!` that is not a comment or CDATA throws `not-a-package` before anything
  is expanded. Processing instructions and comments are skipped.
- Entities: the five predefined and numeric references; anything else is kept as written.
- Each element's prefixes resolve through the `xmlns` declarations in scope; a known namespace (transitional
  and strict OOXML URIs alike) is renamed to its canonical prefix (`w`, `r`, `a`, `p`, `wp`, `pic`, `mc`, `v`,
  `m`, `c`, `dgm`, `wps`, `pr` for package relationships, `ct` for content types), on elements and attributes, so
  readers match `w:p` whatever the file's prefixes. Unknown namespaces keep their prefix.
- Whitespace-only text is kept only inside `w:t`, `a:t` and `w:instrText`, where it is content.
- Deeper than `OFFICE_XML_MAX_DEPTH` or more than `OFFICE_XML_MAX_ELEMENTS` elements: `unpacks-too-large`.
  Unclosed or mismatched tags: `not-a-package`.

### `openOfficePackage(bytes, format)`

1. The first eight bytes `D0 CF 11 E0 A1 B1 1A E1` (a compound file: `.doc`, `.ppt`, or any password-protected
   Office file): `legacy`. Not starting `PK`: `not-a-package`.
2. `openZip`; `_rels/.rels`'s `officeDocument` relationship names the main part (absent: `not-a-package`).
3. The main part's content type (`[Content_Types].xml` override, else its folder: `word/` or `ppt/`) decides the
   package's own format: `wordprocessingml` / `ms-word` is Word, `presentationml` / `ms-powerpoint` PowerPoint,
   anything else `not-a-package`. A package of the other format than the card's: `wrong-format`.
4. Relationship types are matched by their last path segment (`/image`, `/hyperlink`, `/slide`, ...) so
   transitional and strict files read the same. `TargetMode="External"` marks an external relationship, which
   is never read, only reported where it names a picture.

### `readDocx(pkg)` → `{ blocks, pictures, tally }`

Follows the spec's table. Precisely:

- Paragraph style: the paragraph's `w:pStyle`, its `basedOn` chain followed at most 10 deep, by style **name**
  (`title`, `subtitle`, `heading N`, `quote`, `intense quote`, a code name: `code`, `html preformatted`,
  `source code`, `macro text`), else an `w:outlineLvl` (0 is Heading 1), else the style id read as a name (no
  styles part).
- List: `w:numPr` on the paragraph, else on its style chain; `numId` `0` is none; the level's `w:numFmt`:
  `bullet` is bulleted, `none` is no list, anything else numbered (D63: a level the numbering part lacks is
  bulleted). Level capped at `ARTICLE_LIST_MAX_LEVEL`.
- Runs: `w:b`, `w:i`, `w:strike` / `w:dstrike`, `w:u` (not `none`), `w:vertAlign`; a toggle is off when its
  `w:val` is `0`, `false` or `off`. A run's character style adds its own `b` / `i` and the names `strong` and
  `emphasis`. A run in a monospace font (`w:rFonts` ascii or hAnsi, or its character style's) is `code` (D64:
  the font list in `docx-styles.ts`). A paragraph is a code block when its style is a code style or every run
  with text is monospace; consecutive code paragraphs join with `\n`.
- Containers walked into: `w:hyperlink`, `w:ins`, `w:moveTo`, `w:smartTag`, `w:customXml`, `w:sdt` /
  `w:sdtContent`, `w:fldSimple`, `w:dir`, `w:bdo`, `mc:AlternateContent` (its first `mc:Choice` only). Skipped:
  `w:del`, `w:moveFrom`, `w:proofErr`, bookmarks, permissions.
- Fields: a stack across the body; between `begin` and `separate` the run text is instructions, never shown;
  a `HYPERLINK "address"` field links its result. `w:fldSimple`'s `w:instr` the same.
- Breaks: `w:br` `type="page"` ends the paragraph and adds a page break (the rest continues as a new paragraph of
  the same style); `w:pageBreakBefore` adds one before the paragraph; other `w:br` and `w:cr` are `\n`; `w:tab`
  a space; `w:noBreakHyphen` `-`.
- Pictures: `w:drawing` → `wp:inline` or `wp:anchor`, `wp:extent` (EMU) is its size, `wp:docPr` `descr` (else
  `title`) its alt text; `pic:pic` with `a:blip r:embed` is a picture (the paragraph splits round it), `r:link`
  is `linkedImages`; a chart `charts`, a diagram `diagrams`, a `wps`/`wpg` shape `textBoxes`. `w:pict`'s
  `v:imagedata r:id` is a picture, a `v:textbox` `textBoxes`. `w:object` is `embedded`.
- Counted: `w:footnoteReference` / `w:endnoteReference` (`footnotes`), `w:commentReference` (`comments`),
  `m:oMath` / `m:oMathPara` (`equations`), `w:altChunk` (`embedded`), a header or footer reference in any
  `w:sectPr` (`headersFooters`, once), each `w:tbl` (`tables`).
- A table: each `w:tr` a bulleted item (level 0) whose runs are its cells' runs, the cells joined by `" · "`;
  pictures and breaks inside are dropped. Nested tables add their text to the cell.
- A paragraph whose text is empty after trimming and that holds no picture is left out. Runs pass through
  `normaliseRuns`; text cut by its 20,000-character cap counts `longText`.
- More than `MAX_ARTICLE_BLOCKS` blocks: `too-many-blocks` (with the count).

### `readPptx(pkg)` → `{ size, slides, tally }`

- `p:sldSz` gives the deck's EMU size (absent: 12,192,000 x 6,858,000). `p:sldIdLst` order, each `r:id` through
  the presentation's relationships. More than `MAX_PAGES` slides: `too-many-slides` (with the count).
- Per slide: `show="0"` is hidden. Its `slideLayout` relationship, and that layout's `slideMaster`, are read once
  each and cached by path.
- `p:sp` with text: a text item. Its box is its own `a:xfrm`, else its placeholder's on the layout, else on the
  master. A placeholder matches on the layout by `idx`, else by type; on the master by type. Types normalise:
  `ctrTitle` is `title`; `subTitle`, `obj` and no type are `body`. A shape with no box anywhere is left out (D65).
- A text body: each `a:p` a line; runs' `a:t`, `a:fld`'s text, `a:br` a line break. A paragraph's bullet: its own
  `a:buNone` none, `a:buChar` "• ", `a:buAutoNum` its number counted along consecutive numbered paragraphs at that
  level ("1. "); else the level's `a:buNone` / `a:buChar` in the shape's, layout's and master placeholder's
  `a:lstStyle` (nearest first), then the master's `bodyStyle` for a body placeholder (a subtitle's layout sets
  `buNone`, so a subtitle is not bulleted); else a body placeholder's paragraphs are bulleted and every other
  shape's are not; empty paragraphs never. Two spaces of indent a level (`lvl`). Leading and trailing empty lines are trimmed.
- Size: the first run's `sz`, else the shape's, layout's and master placeholder's `a:lstStyle` level-1
  `a:defRPr sz`, else the master's `p:txStyles` (`titleStyle` for a title, `bodyStyle` for a body,
  `otherStyle` else), else 44 / 28 / 18 pt; times `a:normAutofit fontScale`. As px:
  `pt * EMU_PER_PT * scale` through `slideTextSize`: at least 8, an exact `textSize` up to `TEXT_PX_MAX` (48),
  past it `textSize: 48` with `textScale: px / 48` (at most `TEXT_SCALE_MAX`).
- Alignment: the first paragraph's `algn` (`ctr` centre, `r` right, else left), else the level-1 `algn` of the
  shape's, layout's and master placeholder's `a:lstStyle`, else the master's `p:txStyles` for its type, else left;
  `a:bodyPr anchor` (`ctr` middle, `b` bottom, else top), inherited like the box.
- Bold or italic when every run with text has `b="1"` / `i="1"`.
- `p:pic`: a picture item (`a:srcRect` with any edge set: `cropped`); a picture carrying `a:videoFile` /
  `a:audioFile` / a media extension is `media`, not a picture; `r:link` `linkedImages`.
- `p:grpSp`: its children mapped through `a:off`, `a:ext`, `a:chOff`, `a:chExt`.
- `p:graphicFrame`: by `a:graphicData uri`: a table `tables`, a chart `charts`, a diagram `diagrams`, an OLE
  object `embedded`. `p:cxnSp`, `p:contentPart` and text-less `p:sp` (not a placeholder) are `shapes`.
- Past `OFFICE_MAX_SLIDE_ITEMS` items on a slide the rest count `crowded`.
- Notes: the `notesSlide` relationship's body placeholder's text, lines joined with `\n`, cut at
  `OFFICE_NOTES_MAX`.

### `storePictures(pkg, pictures, session, onProgress)` → `Map<path, ImportImageOutcome | 'over-cap'>`

- Unique paths in first-seen order; past `OFFICE_MAX_IMAGES` each is `'over-cap'`.
- Three workers (`IMPORT_IMAGE_CONCURRENCY`) each take the next path, read its bytes (`readBytes(path,
IMPORT_IMAGE_MAX_SOURCE_BYTES)`, an over-cap read is `too-large`, any other read error `missing-bytes`), give
  them a MIME type by extension (`png`, `jpg`/`jpeg`, `gif`, `bmp`, `webp`, `svg`, `tif`/`tiff`, `emf`, `wmf`;
  unknown `application/octet-stream`, which the pipeline names `unsupported`) and `session.store` them with the
  picture's size as the display hint. `onProgress(done, total)` after each. At most three pictures' bytes are
  held at once.

### `buildArticleTab(blocks, outcomes, tabName)` → `Tab`

1. A blank tab whose first page becomes an article (`withPageKindChosen`), as Markdown import builds it; an empty
   document is one empty paragraph.
2. Text width: the article page's width less twice `articleMarginPx(undefined)`.
3. Each picture block becomes an in-line object zone (`zone: 'object'`) sized to the picture (its extent, else
   the stored image's size, else 320 x 240) scaled to at most the text width, each side clamped to
   `ARTICLE_ZONE_MIN..ARTICLE_ZONE_MAX`, and an image element of exactly that box (`imageId` the stored id or
   `null`, `naturalWidth/Height` when stored, `alt`, `aspectLocked: true`).
4. **Parking** (D66): each zone's `at` is set on the article's first page at a slot left of it,
   `x = -(ARTICLE_ZONE_MAX + 400)`, `y = i * (ARTICLE_ZONE_MAX + 200)`, and its image sits exactly there. Slots
   never overlap, so each zone owns exactly its image; the editor's first layout (`withZonesSettled`) moves each
   zone to where the writing puts it and its image with it. The page `at` names always exists.

### `buildDeckTab(read, outcomes, tabName)` → `{ tab, slides: { pageId, notes?, hidden? }[] }`

- One `newSlidePage(nextPageId(...), size)` per slide; size `slide` when the deck's ratio is nearer 16:9 than
  4:3, else `slide-classic`. Pages laid out by `layOutPages`.
- Scale `min(pageW / cx, pageH / cy)`, the deck centred on the page. A text item becomes a text element
  (`textSize` px, `textAlignX`, `textAlignY`, `textBold`, `textItalic`, `label`); a picture an image element as
  above, `objectFit: 'cover'` when cropped. Elements in the slide's paint order.
- The tab: `{ elements, pages, articles: {}, templateChosen: true }`.

### `deckWithPageSlideDetails(deck, tabId, details)` (document package)

For each `{ pageId, notes?, hidden? }`: the slide `pageSlideIdFor(tabId, pageId)` takes the notes and hidden flag,
or is appended with them (`elementIds: []`, `pageId`) when the deck has none yet; `deckFollowingPages` then puts
it in page order. The same deck back when nothing is given.

### `importOfficeFile(file, format, deps)` → `OfficeImportResult`

`deps`: `{ tabName, offline, createSession, onStage }`. Order: the file size (`too-large`, before reading), the
bytes, `onStage({ stage: 'reading' })`, the package, the reader, then (only when there are pictures) a session
from `createSession()` and `storePictures` with `onStage({ stage: 'images', done, total })`, then the build, then
the tab's size: `JSON.stringify({ elements, pages, articles })` encoded as UTF-8 over `MAX_TAB_BYTES` is
`too-large-for-tab` (not checked for an Offline Mode document, whose images are embedded and whose tab never
reaches the api). Returns `{ ok: true, tab, slides?, failures }` or `{ ok: false, failure, count? }`.
Every `OfficeImportError` becomes its failure; anything else thrown is `not-a-package`.

## Interfaces and contracts

- `useTabImport` gains `importFileIntoActiveTab(format: FileImportFormat, file: File, onStage)`, returning the
  dialog's `ImportOutcome`; it refuses a locked tab like the others, lazily imports `@/lib/office-import`, creates
  the session through `@/lib/import-images/browser` (lazily), replaces the tab with `replaceActiveTabContent`,
  hands the deck's details to `onSlidesImported(tabId, slides)`, and tracks `Tab · Imported · Word` /
  `PowerPoint`.
- `useTabActions` passes `ownerId`, `documentId` and `onSlidesImported` through; `useEditorState` wires
  `onSlidesImported` to `slideDeck.adoptImportedSlides`, which commits `deckWithPageSlideDetails`.
- `replaceActiveTabContent` marks each imported article with `markArticleSettle(tabId, flow)`
  (`lib/article/article-grow-store.ts`); `useArticles.onLayout` treats a layout as local while
  `isArticleSettleClaimed` (3 s from the first layout), so the importer adds the pages and settles the parked zones.
- `ImportTabDialog` takes `onImportFileFormat(format, file, onStage)`; the Word and PowerPoint cards open
  `FileImportPanel`.

## Data and persistence

Nothing new is stored. The article tab holds `pages`, `articles` and elements as an article made by hand; the deck
tab slide pages and elements; the deck its slides' `notes` and `hidden`, as the Slide Deck panel writes them.

## Errors and edge cases

| Case                                      | Handling                                              |
| ----------------------------------------- | ----------------------------------------------------- |
| File over 50 MB                           | `too-large`, never read                               |
| `.doc` / `.ppt` / password protected      | `legacy`                                              |
| Not a zip, truncated zip, bad headers     | `not-a-package`                                       |
| A spreadsheet or other package            | `not-a-package`                                       |
| The other card's format                   | `wrong-format`                                        |
| Zip bomb, lying sizes, too many entries   | `unpacks-too-large`                                   |
| DTD, entity declarations, malformed XML   | `not-a-package`                                       |
| Deeply nested or enormous XML             | `unpacks-too-large`                                   |
| Over 100 slides / over 5,000 blocks       | `too-many-slides` / `too-many-blocks`, with the count |
| Finished tab over `MAX_TAB_BYTES` (cloud) | `too-large-for-tab`                                   |
| A picture part missing                    | Placeholder, `missing-bytes`, reported                |
| EMF / WMF / TIFF picture                  | Placeholder, `unsupported`, reported                  |
| More than 100 pictures                    | The rest placeholders, reported                       |
| An empty document / a deck with no slides | One empty paragraph / one empty slide page (D67)      |
| A locked tab                              | Refused before reading, as every import               |
| The dialog closed mid-import              | The import finishes and replaces the tab (D68)        |

## Security and trust

The trust boundary is the file. Every size is bounded before or while work is done (above); the XML reader never
expands an entity or loads anything; no relationship marked external is followed; only http, https and mailto
links survive (`isSafeArticleHref`); macros (`vbaProject.bin`), embedded objects, ActiveX and custom XML parts are
never opened; picture bytes are re-encoded by the image pipeline (metadata stripped, SVG rasterised through an
`<img>`). Nothing in the file reaches the DOM as markup.

## Performance and limits

- The reader is one lazily imported chunk (`@/lib/office-import`), reached only from `importFileIntoActiveTab`.
- Unpacking is native; a part is unpacked only when read; pictures three at a time.
- Measured on the 100-page and 50-slide fixtures (`office-import.perf.test.ts` holds a CPU budget). See the PR
  for the numbers.

## Presentation and UX

- `FileImportPanel`: the `BackBar` (absent when the dialog offers one format), then the drop area: a rounded-xl,
  2 px dashed slate border, min-height 13 rem, centred: the format's document glyph in a soft brand tile, the line
  "Drop a Word document here" / "Drop a PowerPoint deck here" (semibold), "or choose one from your computer"
  (muted) and the primary **Choose a File** button. Drag over: brand border and a brand-50 wash (dark: brand-500
  at 10%). Busy: the glyph becomes a spinner, the line the stage ("Reading the document…" / "Reading the deck…",
  "Saving images (3 of 12)…"), the sub-line "This can take a moment for a large file.", the button disabled.
- On a coarse pointer (`pointer-coarse:`) the drop lines read "Choose a Word document" / "Choose a PowerPoint
  deck" over "It is read on this device."
- Footer row: left, the Google route (`Glyph` + "From Google Docs: File › Download › Microsoft Word" /
  "From Google Slides: File › Download › Microsoft PowerPoint"); right, the help link.
- Error: under the drop area, the dialog's rose error box, `role="alert"`.
- The format grid gains the Word and PowerPoint cards, after Markdown; their glyph boxes read `docx` and `pptx`.

## Accessibility

- The drop area is not a button of its own: **Choose a File** is the keyboard and screen reader route (a real
  `<button>` opening a hidden `<input type="file">` with the format's `accept`); the drop area is a labelled
  region (`aria-label` "Drop a Word document here").
- The stage line is a polite live region (`aria-live="polite"`), so progress is announced without stealing focus.
- Colours meet AA in both themes (slate-600 on white, slate-300 on slate-900 for the muted line); the spinner
  stops under `prefers-reduced-motion` (`motion-safe:animate-spin`).

## Observability

`debugLog('[office-import]', …)` at: package opened (`format`, entry count), refused (`failure`), read (blocks or
slides, pictures, tally), images stored (counts by outcome), tab built (bytes). Each picture's own outcome is
logged by the pipeline as `[import-images]`.

## Testing

| Rule                                           | Test                                                   |
| ---------------------------------------------- | ------------------------------------------------------ |
| Zip read, stored and deflated, bounds          | `zip.test.ts`                                          |
| Zip bomb and lying sizes stop at the cap       | `zip.test.ts`                                          |
| DTD refused, entities, namespaces, caps        | `xml.test.ts`                                          |
| Legacy, wrong format, not a package            | `package.test.ts`                                      |
| Word mapping (spec table), Google Docs flavour | `docx.test.ts`                                         |
| PowerPoint placeholders, groups, notes, Google | `pptx.test.ts`                                         |
| Pictures once each, cap, failures              | `store-images.test.ts`                                 |
| Zones parked and settled by the editor's pass  | `build-article.test.ts`                                |
| Slide pages, scale, sizes                      | `build-deck.test.ts`                                   |
| Report lines                                   | `report.test.ts`                                       |
| End to end, sizes, errors                      | `index.test.ts`                                        |
| 100-page and 50-slide budgets                  | `office-import.perf.test.ts`                           |
| Deck details                                   | `slide-deck-pages.test.ts` (document)                  |
| Panel states, drop, choose, errors             | `FileImportPanel.test.tsx`, `ImportTabDialog.test.tsx` |

## Assets and external resources

No dependency is added: unzipping is the platform's `DecompressionStream`, the XML reader is our own. Test
fixtures are built by `test-fixtures.ts` at test time, so no binary is committed; they mimic what Word,
PowerPoint, Google Docs and Google Slides write (the differences each reader branch covers are named there).
