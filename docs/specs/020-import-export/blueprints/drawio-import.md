# draw.io import: blueprint

Derived from [draw.io import](../drawio-import.md). The spec decides; this file only adds engineering
precision. Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and
cited as `Dn`.

Scope, by file (all under `apps/live/` unless stated):

| File                                            | Role                                                                                                                             |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `lib/drawio/limits.ts`                          | Named constants of this blueprint                                                                                                |
| `lib/drawio/inflate.ts`                         | `inflateBytes`, `decompressDiagram`, `ByteBudget`: DecompressionStream with a byte budget                                        |
| `lib/drawio/png.ts`                             | `extractPngDiagram`: the embedded XML from a `.drawio.png`                                                                       |
| `lib/drawio/refusals.ts`                        | `DrawioRefused`, `refusalMessage`: the named refusals and their copy                                                             |
| `lib/drawio/envelope.ts`                        | `readDrawioSource`, `sniffDrawio`: content sniffing; `mxfile` / `mxGraphModel` / SVG / PNG to page sources and the file's `meta` |
| `lib/drawio/style.ts`                           | `parseStyle`, `DrawioStyle`: style string plus the built-in named styles                                                         |
| `lib/drawio/colour.ts`                          | `readColour`: `#hex` / `none` / `default` / `light-dark()`                                                                       |
| `lib/drawio/cells.ts`                           | `readGraph`: the cell tree, layers, absolute geometry                                                                            |
| `lib/drawio/label.ts`                           | `readLabel`: plain and HTML labels to text and `TextRun[]`                                                                       |
| `lib/drawio/stencils.ts`                        | Pure data: stencil and library-image names to icon ids                                                                           |
| `lib/drawio/shapes.ts`                          | `classifyVertex`: the shape mapping table                                                                                        |
| `lib/drawio/vertex-props.ts`                    | `boxedProps`, `textProps`: the property maps shared by every vertex                                                              |
| `lib/drawio/text-size.ts`                       | `elementTextSize`, `runTextSize`, `htmlFontSizePx`: every font size the importer sets                                            |
| `lib/drawio/nearest.ts`                         | `nearest`: the nearest preset to a px value                                                                                      |
| `lib/drawio/vertices.ts`                        | `buildVertex`, `captionBox`: shapes, text, notes, lines, images, icons, frames, labelled boxes                                   |
| `lib/drawio/containers.ts`                      | `buildLane`, `buildEntity`, `buildTable`                                                                                         |
| `lib/drawio/edges.ts`                           | `buildArrow`: endpoints, route, heads, labels                                                                                    |
| `lib/drawio/convert-page.ts`                    | `convertPage`: one page's graph to elements, layers, background                                                                  |
| `lib/drawio/import.ts`                          | `importDrawio`: the entry point                                                                                                  |
| `lib/drawio/json-export.ts`                     | `readJsonExport`, `jsonLabelText`, `jsonPageElements`: draw.io's JSON export, its `data` file or its graph laid out              |
| `lib/drawio/library.ts`                         | `importDrawioLibrary`: an `<mxlibrary>` decoded into items (read, then left out until shape libraries exist)                     |
| `lib/drawio/files.ts`                           | `readDrawioFiles`, `drawioFileTitle`, `drawioFileDates`, `drawioLibraryTitle`: picked files by content, named and dated          |
| `lib/drawio/notes.ts`                           | `DrawioReport`, `ImportNoteKind`, `ImportNote`, `ReportTally`: what changed, tallied by kind                                     |
| `lib/drawio/report.ts`                          | `DRAWIO_RULES`, `drawioSceneReport`, `drawioOutcome`: the notes as the one shared import report                                  |
| `lib/drawio/new-document.ts`                    | `drawioDocumentSource`: a file's pages as the ready tabs of its own document                                                     |
| `lib/board-scene-import.ts`                     | `importDocuments`: the foundation's new-document target, taking ready tabs (each source prepared, oversized tabs named)          |
| `lib/drawio/images.ts`                          | `attachDrawioImages`: every page's image requests through one pipeline pass                                                      |
| `lib/import-tab.ts`                             | `pickTabFile` also returns the picked `File`; the shared `ImportOutcome` (`images`, `scene`, `failures`, `documents`)            |
| `hooks/persistence/useTabImport.ts`             | The `drawio` format: multi-page apply, one undo step, telemetry, log                                                             |
| `hooks/persistence/drawio-apply.ts`             | `applyDrawioPages`: pure `Tab[]` transform the hook commits                                                                      |
| `hooks/persistence/useDrawioFileImport.ts`      | The Explorer flow: read, list, import the ticked diagrams and libraries, report                                                  |
| `hooks/persistence/useDrawioImportLauncher.tsx` | `useDrawioImportLauncher`: the dialog, loaded on first open                                                                      |
| `components/dialogs/DrawioImportDialog.tsx`     | The Explorer dialog: title, subtitle, help link                                                                                  |
| `components/dialogs/DrawioImportPanel.tsx`      | Pick (files, folder, drop), list, progress, report; `filesOfPick`                                                                |
| `components/dialogs/ImportChecklist.tsx`        | The list step every many-file import shares                                                                                      |
| `components/dialogs/ImportDropZone.tsx`         | The drop area every file import's pick step shares                                                                               |
| `lib/import-selection.ts`                       | `toggled`, `toggledAll`: what a list has ticked                                                                                  |
| `app/explorer/import-sources.tsx`               | The `drawio` source in the Explorer's Import from group                                                                          |
| `scripts/drawio-verify.mts`                     | Real files through the importer, aggregates only (never content)                                                                 |
| `scripts/drawio-compare.mts`                    | Real files beside draw.io's own render, page by page, written outside the repo                                                   |
| `components/dialogs/ImportTabDialog.tsx`        | The draw.io card; routes a reported outcome to the summary                                                                       |
| `components/dialogs/TextImportPanel.tsx`        | `onDone(outcome)`                                                                                                                |
| `lib/drawio/__fixtures__/`                      | The corpus and its generator                                                                                                     |
| `lib/drawio/test-support.ts`                    | DOM test helpers: a model from XML, a vertex, fixture bytes                                                                      |
| `e2e/drawio-import.spec.ts`                     | The corpus through the real dialog on the production build, persistence and undo                                                 |

## Domain and naming

| Term          | Identifier             | Meaning                                                                                  |
| ------------- | ---------------------- | ---------------------------------------------------------------------------------------- |
| Input         | `DrawioInput`          | `{ kind: 'text'; text }` or `{ kind: 'bytes'; bytes: Uint8Array }`                       |
| Page source   | `DrawioPageSource`     | `{ id, name, model }`: `model` the page's `mxGraphModel`, or null when the page is empty |
| Style         | `DrawioStyle`          | Named styles plus key/value pairs of one cell, built-ins merged under                    |
| Cell          | `DrawioCell`           | One `mxCell` (unwrapped from `UserObject` / `object`) with resolved facts                |
| Graph         | `DrawioGraph`          | A page's cells by id, the root, the layers, the background                               |
| Layer cell    | `DrawioGraph.layerIds` | The root's children, bottom to top                                                       |
| Vertex class  | `VertexClass`          | What `classifyVertex` decided a vertex becomes                                           |
| Consumed cell | `ConvertState.forward` | A cell whose element is another cell's (entity row, table cell, group)                   |
| Imported page | `ImportedPage`         | `{ tabId, name, elements, layers?, backgroundColor? }`                                   |
| Report        | `DrawioReport`         | `{ pages, elements, notes: ImportNote[] }`, shown through the shared `BoardSceneReport`  |
| Note          | `ImportNote`           | `{ kind: ImportNoteKind, count, names? }`                                                |
| Image request | `ImportImageRequest`   | The import image pipeline's `{ elementId, key, source, hint }`                           |
| Byte budget   | `ByteBudget`           | Remaining inflate allowance for one import                                               |

Banned synonyms: "diagram" for a page (a livediagram diagram is the whole document; say page), "shape"
for an edge, "warning" for a note, "stencil" for a named style (`ellipse` is a named style,
`mxgraph.aws4.s3` is a stencil).

## Behaviour

### 1. Entry

`importDrawio(input, { tabIdForPage }) => Promise<DrawioImportResult>`:

1. `bytes` longer than `DRAWIO_MAX_FILE_BYTES` (or `text` longer, in UTF-16 units) → refuse
   `too-large`.
2. `readDrawioSource(input, budget)` → `{ pages, meta }`, or a refusal.
3. Pages beyond `DRAWIO_MAX_PAGES` are dropped: note `content-truncated` += dropped count.
4. `pageTabIds = pages.map((_, i) => tabIdForPage(i))`; `pageIdToTab` maps each page's `id` to its tab.
5. Per page, in order: `readGraph(page.model)` then `convertPage(graph, ctx)`.
6. Result `{ ok: true, pages, images, report }` with `report.pages = pages.length` and
   `report.elements` the sum of element counts.

`DrawioImportResult = { ok: true; pages: ImportedPage[]; images: ImportImageRequest[]; report: DrawioReport } | { ok: false; error: string }`.
Never throws: any exception inside is caught and refused as `unreadable`, logged (see Observability).

### 2. Envelope (`readDrawioSource`)

1. `bytes` starting with the PNG signature `89 50 4E 47 0D 0A 1A 0A` → `extractPngDiagram`; `null` →
   refuse `png-without-diagram`; else continue with that text.
2. Other `bytes` → `new TextDecoder('utf-8').decode(bytes)`; continue as text.
3. Text: strip a leading BOM and whitespace. Not starting with `<` → refuse `not-xml`.
4. `new DOMParser().parseFromString(text, 'application/xml')`; a `parsererror` element anywhere →
   refuse `not-xml`.
5. By root local name:
   - `mxfile`: every child `diagram` element, in order. None → refuse `no-pages`.
   - `mxGraphModel`: one page `{ id: 'page-1', name: '', model: root }`.
   - `svg`: `content` attribute; absent → refuse `svg-without-diagram`. Value starting with `<` →
     recurse at step 3 (once); otherwise base64-decode it (`atob`, UTF-8), and recurse if that starts
     with `<`, else refuse `svg-without-diagram`.
   - anything else → refuse `not-drawio`.
6. Per `diagram`: `id` attribute (else `page-<n>`), `name` attribute (else `''`). A child
   `mxGraphModel` element is the model. Else its text content trimmed: empty → an empty page (no
   cells); otherwise `decompressDiagram(text, budget)`, parse as step 4, root must be `mxGraphModel`.
   A failure refuses `page-unreadable` naming the page ("Page 'Network' couldn't be decoded.").

### 3. Inflate

- `decompressDiagram(text, budget)`: remove whitespace, `atob` → bytes, `inflateBytes(bytes,
'deflate-raw', budget)`, decode as Latin-1 (the payload is URI-encoded ASCII), then
  `decodeURIComponent`; if that throws, the Latin-1 text itself (an unencoded payload, D14). Finally
  remove C0 control characters other than tab, LF, CR (draw.io's `zapGremlins`).
- `inflateBytes(bytes, format, budget)`: pipe a one-chunk `ReadableStream` through
  `new DecompressionStream(format)`; accumulate chunks; after each, `budget.take(chunk.length)`,
  which throws `BudgetExceeded` when the remaining allowance goes below zero. `BudgetExceeded` is
  refused `too-large`; any other stream error is `inflate-failed` (the caller decides the message).
- One `ByteBudget(DRAWIO_MAX_INFLATED_BYTES)` per import, shared by every page and the PNG chunk.

### 4. PNG (`extractPngDiagram(bytes, budget)`)

Walk chunks from offset 8: `length` (u32 BE), `type` (4 ASCII), data, CRC (not checked, D15). Stop at
`IDAT`, `IEND`, or a chunk running past the end. For each:

- `tEXt`: split at the first `0`; keyword `mxfile` or `mxGraphModel` → value as Latin-1.
- `zTXt`: keyword as above, then one method byte, then the stream: `inflateBytes(..., 'deflate')`,
  falling back to `'deflate-raw'` (draw.io's own CLI once wrote raw), UTF-8 decoded; then replace
  `+` with space (Java's URL encoder).
- `iTXt`: keyword, compression flag, method, language `\0`, translated keyword `\0`, text (UTF-8,
  inflated with `'deflate'` when the flag is 1).

The first match wins. Its value: while it starts with `%`, `decodeURIComponent` (at most twice).

### 5. Style (`parseStyle(raw, isEdge)`)

- Split at `;`, drop empties. A token with `=` is `key=value` (split at the first `=`); one without is
  a named style, kept in order in `names`.
- Built-in named styles (from draw.io's default stylesheet) merge first, in `names` order, then the
  explicit pairs override:
  - `text`: `fillColor=none; strokeColor=none; align=left; verticalAlign=top`
  - `edgeLabel`: as `text`, plus `fontSize=11`
  - `label`: `fontStyle=1; align=left; rounded=1`
  - `icon`: as `label`, plus `align=center; verticalLabelPosition=bottom; verticalAlign=top; fontStyle=0`
  - `swimlane`: `shape=swimlane; fontStyle=1; startSize=23`
  - `group`: `verticalAlign=top; fillColor=none; strokeColor=none`
  - `ellipse` / `rhombus` / `triangle` / `line` / `image` / `arrow`: `shape=<name>`; `line` adds
    `strokeWidth=4`; `image` adds `verticalLabelPosition=bottom; verticalAlign=top`
- Edge defaults (`isEdge`): `endArrow=classic; fontSize=11` under everything.
- Vertex defaults: `fontSize=12` under everything.
- Accessors: `str(key)`, `num(key)` (finite or `undefined`), `flag(key)` (`'1'` or `'true'`),
  `has(name)` for named styles.
- `shapeName(style)`: `str('shape')`, else the first name that is not a known non-shape name
  (`text`, `edgeLabel`, `label`, `icon`, `group`, `html`), else `''` (the plain rectangle).

### 6. Colour (`readColour(value)`)

`undefined`, `''`, `default`, `inherit` → `{ kind: 'unset' }`; `none` → `{ kind: 'none' }`;
`light-dark(a, b)` → `readColour(a)`; `#rgb`, `#rrggbb`, `#rrggbbaa` → `{ kind: 'hex', value }`
lower-cased; `rgb(...)` / `rgba(...)` → `{ kind: 'hex' }` of its RGB; anything else → `unset` (D16).

### 7. Cells (`readGraph(model)`)

1. Background: `model.getAttribute('background')` through `readColour`; `hex` kept.
   `backgroundImage` present → `backgroundImage: true`.
2. Walk `root`'s element children in order. `mxCell` is a cell; `UserObject` / `object` wraps one
   `mxCell` child: the wrapper's `id` is the cell's id, its `label` the value, `link`, `tooltip`,
   `placeholders` read, every other attribute a custom property (in attribute order). Properties named
   in `DRAWIO_PROVENANCE_ATTRIBUTES` fill placeholders but are flagged `provenance` and never reach a
   note (step 10.9).
3. Per cell: `id`, `parent`, `value` (attribute, `''` when absent), `style` (`parseStyle` with
   `isEdge`), `vertex="1"` / `edge="1"`, `visible` (`!== '0'`), `collapsed` (`=== '1'`), `source`,
   `target`, and its `mxGeometry` (`as="geometry"`): `x`, `y`, `width`, `height` (absent = 0),
   `relative="1"`, `Array as="points"` children (`x`, `y` absent = 0), `mxPoint as="sourcePoint"`,
   `as="targetPoint"`, `as="offset"`.
4. `html`: `style.str('html') === '1'`.
5. Placeholders: when `placeholders="1"`, every `%name%` in the value whose name is a custom
   property is replaced by its value; unknown names stay as written.
6. Children lists are built in document order. The root is the cell with no parent (else id `0`).
   `layerIds` are the root's children.
7. `absoluteRect(graph, id)`: memoised. For a vertex whose parent is a layer or the root: its own
   geometry. For a vertex inside a vertex: parent origin + own `x`, `y`; with `relative="1"`:
   parent origin + (`x * parent.width + offset.x`, `y * parent.height + offset.y`). Inside an edge:
   the edge-label position (step 10.7). `originOf(parentId)` is `(0, 0)` for a layer or the root,
   else `absoluteRect(parentId)`'s top-left.

### 8. Label (`readLabel(value, html, sizeOf?)`)

- Not `html`: `{ plain: value }` (newlines kept, `\r\n` normalised to `\n`).
- `html`: parse with `DOMParser('text/html')`; walk `body` depth-first carrying a format:
  - `b`, `strong`, `font-weight` ≥ 600 or `bold` → bold; `i`, `em`, `font-style: italic` → italic;
    `u`, `text-decoration` containing `underline` → underline; `s`, `strike`, `del`,
    `line-through` → strikethrough; `font color`, CSS `color` → `readColour`, hex only → color;
    `a href` with `http:`, `https:`, `mailto:` → link; `h1`..`h3` → heading 1..3 (`h4`..`h6` bold);
    CSS `font-size: <n>px` and `font size="1"`..`"7"` (`htmlFontSizePx`: 10, 13, 16, 18, 24, 32,
    48 px) → a span px, made a run `size` by `sizeOf` (step 10) at the end; no `sizeOf`, no sizes.
  - `br` → `\n`. Block elements (`div`, `p`, `li`, `h1`..`h6`, `tr`, `blockquote`, `pre`) start on a
    new line when text precedes them. `li` inside `ul` prefixes `• `, inside `ol` `n. `. `td` / `th`
    after the first in a row prefix a tab.
  - Text nodes: whitespace runs collapse to one space (not inside `pre`), `&nbsp;` is a space.
  - Lines are trimmed at both ends; leading and trailing empty lines dropped. A block holding only
    a `br` (or nothing) is one empty line, so `<div>a</div><div><br></div><div>b</div>` is
    `a\n\nb`; empty lines between text are kept as written.
- Returns `{ plain, runs }`, `runs` via `normalizeRuns`; `runs` omitted when no run carries a format
  (so an unformatted HTML label is a plain label).

### 9. Vertex classification (`classifyVertex(cell, graph)`)

In order, first match wins:

1. `shapeName` is `swimlane` → `lane`, unless it is an entity stack (step 11.2) → `entity`.
2. `table` → `table`. `tableRow` / `partialRectangle` inside a table → consumed.
3. `image` → `image` unless its `image` path matches the Azure table in `stencils.ts` → `icon`
   (tech).
4. The stencil tables (AWS, Kubernetes, Network) → `icon` with `iconId`, `tech` per table.
5. `mxgraph.aws4.group` / `groupCenter` / a `mxgraph.gcp2.*` whose name ends `group` or
   `container` → `frame`, approximated.
6. The named-style `group` with no `shape`, empty value, and children → `group` (dropped).
7. The shape table (spec "Vertices: shapes") by exact name → `{ shape, fidelity }`; `text`
   (unless `isBoxedText`: a hex `fillColor` or `strokeColor` of its own → the plain rectangle,
   `square`; also never a container's label), `edgeLabel` → `text`; `note` → `sticky`; `line` → `line`; `umlFrame` → `frame`.
8. Otherwise → `unmatched` with `name = shapeName` (`stencil(...)` names reduce to `custom stencil`).

`triangle`'s rotation: `direction` `east` (default) 90, `south` 180, `west` 270, `north` 0; a 90 or 270
turn swaps width and height about the centre so the turned box matches draw.io's. Any other shape
with `direction` other than `east`, or `flipH` / `flipV`, on a kind that is not symmetric under that
flip (every kind except `square`, `circle`, `diamond`, `hexagon`, `cylinder`, `cloud`, `stadium`,
`star`) is counted `shape-approximated` once.

### 10. Vertex properties (`boxedProps`, `textProps`)

1. `fillColor`: `hex` → `paperColour(hex, 'fill')`; `none` → `'transparent'`; `unset` → omitted. Unset colours stay omitted by the spec's operator decision (default colours and the white page follow the tab theme); this applies to every colour map below.
   `paperColour(hex, role)` (`colour.ts`): OKLCH of the hex (`sceneOklch`); `role` `ink` (text,
   stroke, arrow) with `l ≤ INK_MAX_LIGHTNESS` and `c ≤ INK_MAX_CHROMA` → unset; `role` `fill` with
   `l ≥ PAPER_MIN_LIGHTNESS` and `c ≤ PAPER_MAX_CHROMA` → unset; else the hex. Memoised per hex.
2. `strokeColor`: `hex` → `paperColour(hex, 'ink')`; `none` → `strokeWidth: 'none'`.
3. `strokeWidth` px → nearest of `BORDER_STROKE_PX` (`thin` 1, `medium` 2, `thick` 4,
   `extra-thick` 7), ties to the thinner (D17); `0` → `'none'`. Absent → `thin` (draw.io's 1 px, D18).
4. `dashed=1` → `dashed`; with `dashPattern` `"a b ..."` where every dash (the odd entries) is at
   most `DRAWIO_DOT_MAX_STROKES` × the stroke width (px, default 1) → `dotted`.
5. `rounded=1` on `square`: radius = `absoluteArcSize=1` ? `arcSize` px : `arcSize` (default
   `DRAWIO_DEFAULT_ARC_SIZE`) % of `min(width, height)`; nearest of `BORDER_RADIUS_PX` excluding
   `full`, and `full` when radius ≥ half the shorter side. `rounded` absent → `none`.
6. `opacity` → `/100`, omitted at 100. `rotation` → degrees mod 360, omitted at 0. Opacity over
   paper: `o = min(opacity, fillOpacity) / 100 < 1` on an element with a hex fill → when
   `overlapsOther(cell)` is false, `fillColor = mix(fill, #ffffff, o)` (per channel
   `round(fill·o + 255·(1 − o))`) and `opacity` is omitted; when true, `opacity = o` as before.
   `overlapsOther(cell)`: the cell's absolute rect intersects (area > 0) the rect of another visible
   vertex that is neither its ancestor nor its descendant; checked only for translucent cells.
7. `shadow=1` → `DRAWIO_SHADOW`. `locked=1` → `locked: true`.
8. Link (`cell.link`): `http:`, `https:`, `mailto:` → `{ kind: 'url', url }`; `data:page/id,<id>` →
   `{ kind: 'tab', tabId: pageIdToTab.get(id) }` when known; else dropped, `link-dropped`.
9. Note: `tooltip` then each custom property not flagged `provenance` as `name: value`, lines
   joined by `\n`, omitted when empty.
10. Text: `readLabel`; `label = plain` (omitted when empty); `richText = runs` when the kind carries
    rich text (shape, text, sticky). `fontStyle` bits → `textBold` / `textItalic` / `textUnderline` /
    `textStrikethrough`. `fontColor` hex → `paperColour(hex, 'ink')` → `textColor`. A run colour the
    same way. `overflow` `hidden` or `fill`: the label keeps its first `fitLines(rect, size)`
    lines (`floor((rect.height · scale − 2 · LABEL_PADDING_PX) / lineHeightPx(size))`, at least 1),
    `text-truncated` += 1 when lines were cut. `fontSize` → `elementTextSize`
    (`text-size.ts`): nearest preset on the scale (`LABEL_FONT_PX` for shapes and text,
    `NOTE_FONT_PX` for stickies, `arrowLabelFontSize` for arrows), over `sm`, `md`, `lg` only,
    ties to the smaller. A span's px → `runTextSize(px, fontSize, scale)`: `xs` under
    `DRAWIO_XS_BELOW_PX` (12), else the nearest preset; omitted when it equals the label's own size,
    which is `xs` for a label under 12 px. A label under 12 px on a kind with runs gives every run
    without a size `size: 'xs'` (the plain text becomes one run). Text under `RUN_XS_PX` (10)
    anywhere in a label with runs counts `text-below-xs` once for that label. Arrows have no `xs`
    (no runs). `fontFamily` → `fontIdFor(family)`. `align` → `textAlignX`; `verticalAlign` →
    `textAlignY` (`middle` kept as `middle`).
11. Label outside: `labelPosition` `left` / `right` or `verticalLabelPosition` `top` / `bottom` on a
    kind that is not an icon, an image, or an actor with its name above or below: alignment set towards that
    side (`textAlignX: 'left'|'right'`, `textAlignY: 'top'|'bottom'`), `label-moved` += 1 when the
    label is non-empty.
12. Ink on an own fill (`inkOnFill(fill)`): when the element (shape, text, labelled box, lane title
    on its `headerFill`, entity, table, table cell `bg`) carries a hex fill and the label has no
    `fontColor`, `textColor` = `#1e293b` on a fill `isLightColor` calls light, else `#ffffff` (D29).
    A label that is empty gets none.

`fontIdFor(family)`: lower-case the first family in the list, trimmed of quotes; a `FONTS` id or
label equal to it → that id; contains `mono`, `courier`, `consol` → `roboto-mono`; `comic`,
`architects daughter`, `xkcd`, `caveat`, `indie flower` → `caveat`; else `undefined`.

### 11. Containers

1. **Lane** (`buildLane(cell, rect, graph, ctx, id)`): `shape: 'lane'`, box from the cell,
   `borderRadius: 'none'`. `horizontal=0` → `titleOrientation: 'upright'`, `textAlignX 'left'`,
   `textAlignY 'middle'`; else `textAlignX 'center'`, `textAlignY 'top'`. `headerSize` = `startSize`
   (23 when absent). `fillColor` → `headerFill` (per step 10.1); `swimlaneFillColor` → `fillColor`
   (per step 10.1), absent or `none` → `'transparent'`. Children convert as normal elements after the
   lane, unmoved.
2. **Entity** (`buildEntity`): a swimlane with `childLayout=stackLayout` and at least one child,
   every child a vertex whose `shapeName` is `''` with named style `text`, or `line`, and none with
   children of its own. `shape: 'entity'`, label = the swimlane's plain label, `entityFields` = the
   text rows in order: plain text split at the last `:` into `name` (trimmed) and `type` (trimmed,
   omitted when empty); rows over `ENTITY_MAX_FIELDS` dropped and text over `ENTITY_MAX_TEXT` cut,
   each counted `text-truncated`. Rows and lines are consumed, forwarding to the entity.
3. **Table** (`buildTable`): rows = the children whose `shapeName` is `tableRow`, cells = each row's
   vertex children, in order. `cells[r][c]` = plain label; rows padded to the widest with `''`.
   `rowHeights` = row heights; `colWidths` = the first row's cell widths. The grid's box starts
   `startSize` below the table's top. Non-empty table label → a `text` element above the grid box
   (`y = table.y`, height `startSize`), `shape-approximated`. Per cell, `cellStyles` carries `bg`
   (`fillColor` hex), `textColor` (`fontColor` hex, else step 10.12 on `bg`), `bold` / `italic` /
   `underline` (`fontStyle` bits) and `alignX` (`align` other than centre); `cellStyles` is omitted
   when every cell is `null`. No rows → a `square` with the table's label, `shape-approximated`.
   Rows and cells are consumed, forwarding to the table.

### 12. Edges (`route/`, `buildArrow`)

The route is draw.io's own, computed by a TypeScript port of draw.io's view geometry
(`lib/drawio/route/`, from jgraph/drawio v31.7.0 `mxgraph/src/view`, Apache-2.0). Everything in
draw.io units, before the page scale.

1. **Terminal states** (`route/state.ts`): per edge end, the terminal is the source / target cell
   itself (consumed or not: draw.io routes to the cell it drew) with its absolute rect
   (`absoluteRect`), its parsed style, and its `rotation`. A terminal that is an edge has the
   state of its computed route (edges route in dependency order; a cycle routes its later member
   as if that end were free).
2. **View** (`route/view.ts`, port of `mxGraphView`): `updateFixedTerminalPoints` (a constraint
   from `exitX` / `exitY` / `exitDx` / `exitDy` / `exitPerimeter` and the `entry*` twins, through
   `getConnectionPoint` with the terminal's perimeter and rotation), `updatePoints` (the edge style
   function with the waypoints, or the waypoints as given when there is none), `updateFloatingTerminalPoints`
   (`getPerimeterPoint` towards `getNextPoint`, orthogonal projection when the style is orthogonal,
   `perimeterSpacing` / `sourcePerimeterSpacing` / `targetPerimeterSpacing`), loops
   (`isLoopStyleEnabled`), and a free end at `sourcePoint` / `targetPoint`. draw.io's `Graph`
   defaults apply (`Graph.prototype.defaultEdgeStyle`, the `orthogonal` rule of `isOrthogonal`).
3. **Edge styles** (`route/edge-styles.ts`, port of `mxEdgeStyle`): `orthogonalEdgeStyle` →
   `OrthConnector` (with `getJettySize`, `getRoutePattern`), `elbowEdgeStyle` → `ElbowConnector`
   (`SideToSide` / `TopToBottom` by `elbow`), `sideToSideEdgeStyle`, `topToBottomEdgeStyle`,
   `entityRelationEdgeStyle` → `EntityRelation`, `segmentEdgeStyle` → `SegmentConnector`,
   `isometricEdgeStyle` → `ElbowConnector` (the isometric skew is not drawn), `loopEdgeStyle` /
   a self-loop → `Loop`.
4. **Perimeters** (`route/perimeters.ts`, port of `mxPerimeter` and `Graph.js`'s registered ones):
   rectangle (default), ellipse (`ellipse`, `doubleEllipse`, `endState`, `startState`, `umlActor`'s
   head excluded: a rectangle), rhombus, triangle, hexagon, parallelogram, trapezoid, step; the
   `perimeter` style key wins over the shape's default.
5. The result per edge: `route: Point[]` (absolute, both terminal points included) and its total
   length.
6. **Ends** (`buildArrow`): a terminal that became an element (directly or by `forward`) → pinned
   to the offered anchor nearest the route's terminal point (`anchorPosition` on the element's box
   in draw.io units). A terminal that is an edge which became an arrow → `{ kind: 'on-arrow',
arrowId, t }`, `t` the parameter of the nearest point on that arrow's route. No terminal → free
   at the route's terminal point. A terminal that was a cell but has nowhere to pin → free at the
   route's terminal point, `connection-loosened` += 1.
7. **Snap the route to the anchors** (`snapRouteEnds`): replace the first point by the source anchor
   point; when the first segment was horizontal (equal y), set the second point's y to the anchor's,
   when vertical (equal x) its x; the same at the target end. A two-point orthogonal route whose
   snapped ends differ in both axes gains two corners at the mid x (the first segment's direction
   kept), so it stays orthogonal. Then drop consecutive duplicates and collinear interior points.
8. **Style.** `curved=1` → `curved`; else an edge style → `angled`; else `straight` with interior
   points → `angled` (a polyline), without → `straight`. `curvePoints` = the interior points as
   `{ dx, dy }` from the midpoint of the snapped first and last points.
9. `exactStart: true` on a pinned start, `exactEnd: true` on a pinned end; `routeBehind: false`.
10. **Heads.** `startArrow` / `endArrow` through `DRAWIO_MARKERS`: `none` / `''` → no head; a known
    marker → `{ shape, exact }`; unknown → `{ shape: 'line', exact: false }`. `startFill` /
    `endFill` read as `'0'` (string) turn `triangle`, `circle`, `diamond` hollow (`-hollow`).
    `arrowEnds` from which ends carry a head; `arrowheadShape` = the end's shape, else the start's;
    omitted when `triangle`. `arrowheadSize`: draw.io's head length `L = (endSize ?? startSize ??
DRAWIO_DEFAULT_MARKER_SIZE) + strokeWidth`; the preset whose `arrowheadLengthPx(preset,
strokeWidth)` (`@livediagram/document`, the canvas marker's own size) is nearest `L`, omitted at
    `medium`. `arrowhead-approximated` += 1 when either head is not exact, or both ends carry heads
    of different shapes.
11. **Stroke.** `strokeColor` hex → `paperColour(hex, 'ink')` (`none` → `opacity: 0`, D19);
    `strokeWidth` px → `strokeWidth` (number, default 1, omitted at 2). `dashed` / `dashPattern` as
    vertices. `opacity` as vertices (no paper blend: an arrow has no fill). `link` as step 10.8.
12. **Labels.** Parts: the edge's own label, then each visible child vertex's with `edgeLabel` or
    `text` named style (in order), as rich lines: runs kept (colour through `paperColour`). Joined
    with `\n`; more than one non-empty part → `label-moved` += 1. Font props as step 10.10 on the
    arrow scale. Position (`route/label.ts`, port of `mxGraphView.updateEdgeLabelOffset` and
    `getPoint`): the first labelled part's geometry (the edge's own when it has a value) gives
    `x` (−1..1) and `y`, plus `offset`; the point on the route at `(x + 1) / 2` of its length,
    moved `y` along the segment's normal, plus `offset`. `labelOffset = { t, offset }`: `t` the
    length fraction of that point's projection on the snapped route, `offset` its signed
    perpendicular distance; omitted when `t` is within `DRAWIO_LABEL_CENTRE_EPSILON` of 0.5 and
    `offset` within 1 px. `labelMaxWidth` = the widest label line's width at the label's preset
    (`LABEL_EM_ADVANCE` × preset px × characters), in livediagram px.
13. A child vertex of an edge that is not a label is built as its own element at the route point of
    step 12, right after the arrow.

### 13. Images

`image` class: `{ type: 'image', imageId: null, x, y, width, height, alt?: plain label }`.
`style.str('image')`: starts with `data:` → an image request `{ elementId, key, source: { kind:
'data-url', dataUrl }, hint: { width, height } }` (a base64 payload without `;base64`, as draw.io
writes it, gains the marker; a percent-encoded or raw payload stays; `key` is `drawio-image-<n>`,
one per distinct data URL across the import; how it came across is the pipeline's report, not a
note); any other value (a web or
library URL) or none → placeholder only, `image-unavailable` += 1. A non-image kind whose style
carries `image=` → `image-unavailable` += 1. A page with `backgroundImage` → `image-unavailable`
+= 1.

### 14. Icons, actors and frames

`icon` class → `{ type: 'shape', shape: 'icon', iconId, x, y, width, height }`, caption = label
(plain; the kind's name from the table when empty and the table gives one), no `textColor` (vendor stencils hard-code one for white paper),
`textSize` from `fontSize`. Tech icons: `iconSize` = nearest of `ICON_SIZE_PX` to
`min(width, height)`, omitted at `md`; line-art icons keep a hex `strokeColor`.
`icon-substituted` += 1.

`captionBox(cell, rect, label)` places a caption draw.io draws outside the figure:

- no label → the box as it is, `textAlignX: 'center'`, `textAlignY: 'bottom'`;
- `labelPosition` `left` / `right` → `textAlignX` that side, `textAlignY: 'middle'`, the box
  widens towards it by `captionWidth(lines)`;
- otherwise the box grows by `DRAWIO_CAPTION_LINE_PX` per line, downwards (`textAlignY:
'bottom'`) or, for `verticalLabelPosition=top`, upwards (`'top'`), and widens about its centre to
  `captionWidth(lines)` when that is wider.

Icons and images always use it; an `actor` shape with `verticalLabelPosition` `top` / `bottom` uses
it too and does not count `label-moved`. `captionWidth(lines)` is the longest line's characters ×
`LABEL_EM_ADVANCE` × the caption preset's px, divided by the page scale (the box is in draw.io
units until step 15.9), plus `DRAWIO_CAPTION_PADDING_PX`. An image's caption is its `label` and
`alt`.

Marks: `mxgraph.basic.x` → line-art `x`, `mxgraph.basic.tick` → `check`, `strokeColor` (else
`fillColor`) hex as the icon's stroke, `icon-substituted` += 1. `endState` → `circle`, `fillColor`
(default `#000000` → `paperColour`), `strokeColor` the ring, `strokeWidth: 'thick'`. `curlyBracket`
→ a headless `arrow` along the brace's spine (vertical through the box's middle, or horizontal
when `direction` is `north` / `south`), `shape-approximated` += 1.

`frame` class (`umlFrame`, AWS / GCP groups): boxed props without the fill, the plain label,
`textAlignX: 'right'` when `align=right` else `'left'`, `textAlignY: 'top'`, `padding: 'lg'` (as the
palette's frame); the AWS / GCP groups count `shape-approximated`.

### 15. Page conversion (`convertPage(graph, ctx)`)

0. **Page scale** (`pageScale(graph)`): over visible cells with a non-empty label, `px` = the
   commonest `fontSize` (default `DRAWIO_DEFAULT_FONT_PX`, ties to the smaller) and `w` = the median
   width of the labelled vertices (`DRAWIO_DEFAULT_BOX_PX` without any). With `L` =
   `LABEL_FONT_PX[elementTextSize(px)]`: the width ratio `rw = L · LABEL_EM_ADVANCE / (px ·
HELVETICA_EM_ADVANCE)`, the line ratio `rh = L · LABEL_LINE_HEIGHT / (px · DRAWIO_LINE_HEIGHT)`, the
   padded ratio `rp = (rw · (w − 2 · DRAWIO_LABEL_SPACING) + 2 · PADDING_PX.sm) / w`;
   `scale = clamp(max(rw, rh, rp), 1, DRAWIO_MAX_PAGE_SCALE)`, 1 for a page with no labels. `ctx.scale` carries it; preset choices that read a px size (border radius, icon size,
   overflow lines, caption width) read it scaled.
1. State: `cellToElement` (cell id → the boxed element it became), `forward` (consumed cell id →
   the cell that owns its element, `''` for none), `visited`, `slots` (elements and queued edges in
   paint order), the import's `tally`, `images` and `imageKeys` from `ctx`.
2. Layers: `layerIds.length >= 2` → `Tab.layers` = one per layer cell: first `DEFAULT_LAYER_ID`, the
   rest `layer:<uuid>`; `name` = plain label, else `DEFAULT_LAYER_NAME` for the first and
   `Layer n` after (D28); `visible: false` when the layer cell is invisible; `locked: true` when its
   style has `locked=1`. A single layer → no `layers`, no `layerId`s.
3. Walk each layer's children depth-first (pre-order). Per cell: invisible → skip the subtree,
   `hidden-skipped` += 1 + descendants; edge → queue in paint order (built in pass 2), its children
   marked visited; vertex without geometry → skipped like a hidden one (D20); vertex → classify and
   build. A `line` vertex becomes an arrow and nothing pins to it.
4. Collapsed vertex: build it, skip descendants, `collapsed-skipped` += descendant count, and forward
   every descendant to it.
5. `group` class: no element; `forward[group] = ''` (connections loosen), children walked,
   `group-flattened` += 1.
6. Elements carry `layerId` of their layer cell when layers were emitted.
7. Pass 2: arrows, built in their queued paint positions, then any shapes riding on them (12.7).
8. Truncation: output beyond `MAX_ELEMENTS_PER_TAB` dropped, `content-truncated` += dropped.
9. **Scale** (`scalePage(elements, scale)`): about the page origin, multiply boxed `x`, `y`, `width`,
   `height`, lane `headerSize`, table `rowHeights` / `colWidths`, arrow `curvePoints`, free
   endpoints and `labelOffset.offset`; `labelMaxWidth` is already in livediagram px. Stroke widths,
   presets and font sizes are untouched. Skipped at scale 1.
10. Result `{ elements, layers?, backgroundColor? }`: `backgroundColor` is the page background unless
    white (`#fff`, `#ffffff`, `#ffffffff`), which stays unset. Pending images carry `ctx.tabId`.

### 16. Apply (`applyDrawioPages(tabs, activeId, pages, createTab)` and the hook)

Pure `Tab[] => Tab[]`; the input returned as it is when the active tab is missing or no page came:

1. Page 0 merges into the active tab through `mergeImportedTab` with `elements`, `layers` and
   `backgroundColor` when present; name: single page → the active tab's name; multi-page → the page
   name (trimmed), else `Page 1` (D27).
2. Pages 1..n → new tabs: `createTab(name)` with `id: page.tabId`, the active tab's `theme`, `font`,
   `defaultTextSize` (else `'sm'`), `backgroundPattern`, `backgroundColor`, `backgroundOpacity`,
   `patternColor`, `backgroundPatternScale`, and its `folder`, then merged with the page like
   page 0; inserted after the active tab in page order.
3. Hook (`importDrawioInput`): `importDrawio` with `tabIdForPage(0) = activeId`,
   `tabIdForPage(i > 0) = crypto.randomUUID()`; a refusal returns `{ status: 'error' }` and touches
   nothing. Then `attachDrawioImages` (step 17), one `commitTabs(ts => applyDrawioPages(...))`
   (one undo step), `markTabLoaded` for each new tab, selection / edit / format source cleared,
   `requestFit()` when page 0 has elements, `track('Tab', 'Imported', 'Drawio')`, log
   `[drawio-import] applied`. The report gains `images` (the pipeline's report) when the file had
   embedded images. Returns `drawioOutcome(report, pages, images)` (step 18): the shared report
   when anything changed or images came along, else `{ status: 'done' }`.
4. Paste goes in as `{ kind: 'text' }`; a picked file as `{ kind: 'bytes' }` from
   `picked.file.arrayBuffer()` (a `.drawio.png` is binary).

### 17. Images through the pipeline

`attachDrawioImages(pages, requests, attach)` (`lib/drawio/images.ts`): no requests → the pages as
they are and `images: undefined` (the pipeline is not loaded). Otherwise ONE `attach` call over every
page's elements concatenated in page order with all the requests, then each page takes back its own
slice. The hook binds `attach` to `attachImportImages(elements, requests, session, onProgress)` with
`session = createBrowserImportImageSession({ ownerId, diagramId })`, both lazy-imported, so every page
shares one session, one concurrency limit, one Offline Mode budget and one progress count, and a
picture repeated across pages is stored once. This runs before the one `commitTabs`.

### 18. The shared report (`lib/drawio/report.ts`)

- `DRAWIO_RULES`: one rule sentence per `ImportNoteKind` (the spec's report table, word for word);
  `hidden-skipped`, `collapsed-skipped` and `content-truncated` are skipped rules, the rest changed.
- `drawioSceneReport(report, pages)` → `BoardSceneReport`: `landed` counts every page's elements by
  kind (`arrow` → connector, `text`, `sticky`, `image`, `freehand` → polyline, a `frame` shape →
  frame, every other element → shape); then the notes in `IMPORT_NOTE_ORDER`, an unmatched-stencil
  note's names appended as ` (router ×3, switch, …)`.
- `drawioOutcome(report, pages, images?)` → `ImportOutcome`: `{ status: 'done' }` when no rule and no
  image counted; else `scene` (when a rule) and `images` (when counted).

### 19. Sniffing and new inputs (`envelope.ts`, `json-export.ts`, `library.ts`)

- `sniffDrawio(input)` → `'diagram' | 'library' | null`, from at most the first 4 KB decoded as
  UTF-8 (bytes: the PNG signature first): `<mxfile`, `<mxGraphModel`, an `<svg` whose `content`
  attribute is present, the PNG signature, or a JSON object whose first keys include `pages` →
  `diagram`; `<mxlibrary` → `library`; anything else → null. Leading whitespace and a BOM are skipped.
  No file name is read. The root element comes from `rootTagOf(head)`, a linear scanner: it skips
  whitespace, `<?…?>`, `<!--…-->` and `<!…>` with `indexOf` (null when one never closes), then
  reads the tag name and the rest of its opening tag; no regular expression backtracks over the head.
- **JSON export** (`readJsonExport(text)`): `JSON.parse` (throw → refusal `not-xml`); an object with
  a `pages` array, else `not-xml`. A string `data` starting `<mxfile` → that text through the XML
  path, its result returned as is. Otherwise per page (`jsonPageElements(page, { tally,
pageIdToTab })`): nodes (`type: 'node'`) to a graph (`id` minted, `label` from `jsonLabelText`
  unless `html` is `0`, `'0'` or `false`), laid out by `layoutClusteredGraph` (`packages/document`,
  `graphToElements` plus the layout); node links by `elementLink` (`vertex-props.ts`, the XML
  path's rule: `http`, `https`, `mailto`, and `data:page/id,<id>` of a page in the export as a
  `tab` link; else `link-dropped`). Edges with both ends on nodes are connections; one end on a node
  → an arrow pinned on that node's east (free target) or west (free source) side, its free end
  `DRAWIO_JSON_LOOSE_EDGE_PX` out at the node's middle height, label kept, `connection-loosened`
  += 1; neither end → left out, `connection-loosened` += 1. `auto-layout` counted once per page
  with any node.
- `jsonLabelText(html)` = `readLabel(html, true).plain` (step 8): the inert `DOMParser('text/html')`
  walk every label takes, so entities decode exactly once, `&lt;script&gt;` stays the literal text
  `<script>`, a `script` or `style` element's content is skipped, and malformed HTML reads as a
  browser would. Never a regex over tags.
- `ImportNoteKind` gains `auto-layout` (after `text-truncated`) and `library-item-unreadable` (after
  `collapsed-skipped`, left out).
- **Libraries** (`library.ts`, `importDrawioLibrary(input)` → `{ ok: true, items, images, report }`
  or a refusal): `<mxlibrary>` text (BOM and outer whitespace trimmed, the body between the opening
  tag's `>` and the final `</mxlibrary>`, found with `indexOf`) → `JSON.parse` of its body (an
  array, else `not-library`); per
  item: `xml` decoded with `decompressDiagram` when it does not start with `<`, read as one
  `mxGraphModel`, converted by `convertPage` into elements normalised to the item's top-left at
  (0, 0); an image item (`data` a `data:` URL) → one `image` element `w` × `h` plus an image request;
  `{ title (string, may be empty), width: w, height: h, elements }`. An item that fails is counted
  `library-item-unreadable`; none readable → refusal `empty-library`. At most
  `DRAWIO_MAX_LIBRARY_ITEMS`, the rest `content-truncated`.
- `importDrawio` given a library → refusal `library` ("This is a draw.io shape library. Import it with
  Import from draw.io on the Explorer page to add it to My shapes.").
- `importDrawio`'s success gains `meta: { name?: string; modified?: string }`: the `mxfile`'s `name`
  and `modified` attributes when present (the JSON path: those of its `data` file, else none).

### 20. Files to documents (`files.ts`)

- `drawioFileTitle(fileName, meta, firstPageName, modified)`: strip the first matching extension
  (`DRAWIO_EXTENSIONS`, longest first, any case); generic (`DRAWIO_GENERIC_NAME`) → `meta.name` when
  not generic → the first page's name when not `Page n` → `"draw.io diagram, 12 Apr 2026"` by the date
  (`en-GB`, day month year, UTC) → `"draw.io diagram"`.
- `drawioFileDates(meta.modified, file.lastModified)` → ISO `{ createdAt, modifiedAt }`: the
  `modified` attribute when it parses, else `lastModified` when finite and positive; created equals
  modified. Checked downstream by `boardDocumentDates`.
- `readDrawioFiles(files)` → `{ diagrams, libraries, failures }` (`DrawioDocumentFile[]`,
  `DrawioLibraryFile[]`, `{ title, message }[]`), pick order, never throws. Per file: `sniffDrawio` null → failure
  "This file isn't a draw.io diagram or library."; `diagram` → `importDrawio` (fresh tab ids) →
  `{ name, createdAt, modifiedAt, pages, images, report }` or failure; `library` →
  `importDrawioLibrary` → `{ name, items, images, report }` (`drawioLibraryTitle`: the file name,
  or "draw.io library" when `DRAWIO_GENERIC_LIBRARY_NAME` matches) or failure. A failure's title is
  the file name without its extension (the whole name for a file that is not draw.io's).
- The commit: diagrams through `importDocuments` (`lib/board-scene-import.ts`, the foundation's
  new-document target for ready tabs) with `drawioDocumentSource` (`new-document.ts`: each page a diagram tab named after its page, oversized pages
  left out and named, images through one pipeline pass per document). Libraries, after the diagrams, through
  the host's `importLibraries` ([Shape libraries blueprint](../../013-workspace/blueprints/shape-libraries.md)
  "Behaviour and state" 1): each its own shape library, its failures listed with the files left out.
  One `track('Tab', 'Imported', 'Drawio')` per document made.

### 21. The Explorer source (`useDrawioFileImport`, `DrawioImportPanel`, `DrawioImportDialog`)

- `IMPORT_SOURCES` gains `{ id: 'drawio', name: 'draw.io', icon: <DrawioSourceIcon /> }` after
  Excalidraw; `useExplorerImport` maps it to `useDrawioImportLauncher(importDocuments)`.
- The flow mirrors the Microsoft Whiteboard panel, on the same shared `ImportDropZone` and
  `ImportChecklist`: pick (files: `multiple`, no `accept` filter, as Drive saves have no
  extension; a folder: `pickExport('folder')`; drop: files and folders through `readDrop`, each
  named after its path by `filesOfPick`) → "Reading files…" → list (legend "Files to import"; one row
  per diagram, "Edited 12 Mar 2026 · 3 pages", and per library, "Shape library · 14 shapes", all ticked;
  "1 file will be left out; the report says why."; button "Import 3 files"; one readable file and
  nothing left out skips the list) → importing ("Importing 3 of 12…",
  then "Importing images 3 of 12…") → the shared report (`ImportImageReport`, documents and libraries as
  links, failures listed). One `track('Tab', 'Imported', 'Drawio')` per document made.
- `DrawioImportDialog`: title "Import from draw.io", subtitle "Each diagram becomes its own document,
  named and dated after the file.", its help link the `drawioImport` article
  (`explorer/drawio-import`, Explorer category).
- `DrawioSourceIcon` (`import-source-icons.tsx`): an original glyph, a box joined by an elbow
  connector to a decision diamond, white on `#c2410c` (5.2:1).

## Interfaces and contracts

```ts
// lib/drawio/notes.ts
export type ImportNoteKind =
  | 'shape-unmatched'
  | 'shape-approximated'
  | 'icon-substituted'
  | 'image-unavailable'
  | 'arrowhead-approximated'
  | 'connection-loosened'
  | 'label-moved'
  | 'group-flattened'
  | 'hidden-skipped'
  | 'collapsed-skipped'
  | 'link-dropped'
  | 'text-truncated'
  | 'text-below-xs'
  | 'auto-layout'
  | 'library-item-unreadable'
  | 'content-truncated';
export const IMPORT_NOTE_ORDER: readonly ImportNoteKind[]; // the spec table's order
export type ImportNote = {
  kind: ImportNoteKind;
  count: number;
  names?: { name: string; count: number }[];
  moreNames?: number; // names left out of `names`
};
export type DrawioReport = { pages: number; elements: number; notes: ImportNote[] };
export class ReportTally {
  constructor(namesMax?: number);
  add(kind: ImportNoteKind, count?: number): void;
  name(kind: ImportNoteKind, name: string): void;
  notes(): ImportNote[];
}

// lib/drawio/report.ts
export const DRAWIO_RULES: Readonly<Record<ImportNoteKind, string>>;
export function drawioSceneReport(
  report: DrawioReport,
  pages: readonly ImportedPage[],
): BoardSceneReport;
export function drawioOutcome(
  report: DrawioReport,
  pages: readonly ImportedPage[],
  images?: ImportImageReport,
): ImportOutcome;

// lib/drawio/images.ts
export type AttachImages = (
  elements: Element[],
  requests: ImportImageRequest[],
) => Promise<{ elements: Element[]; report: ImportImageReport }>;
export function attachDrawioImages<P extends { elements: Element[] }>(
  pages: P[],
  requests: ImportImageRequest[],
  attach: AttachImages,
): Promise<{ pages: P[]; images: ImportImageReport | undefined }>;

// lib/drawio/import.ts
export type DrawioInput = { kind: 'text'; text: string } | { kind: 'bytes'; bytes: Uint8Array };
export type ImportedPage = {
  tabId: string;
  name: string;
  elements: Element[];
  layers?: Layer[];
  backgroundColor?: string;
};
export type DrawioImportResult =
  | {
      ok: true;
      pages: ImportedPage[];
      images: ImportImageRequest[];
      report: DrawioReport;
      meta: DrawioMeta;
    }
  | { ok: false; error: string };
export function importDrawio(
  input: DrawioInput,
  options: { tabIdForPage: (index: number) => string },
): Promise<DrawioImportResult>;

// lib/drawio/envelope.ts
export type DrawioMeta = { name?: string; modified?: string };
export function readDrawioSource(
  input: DrawioInput,
  budget: ByteBudget,
): Promise<{ pages: DrawioPageSource[]; meta: DrawioMeta }>;
export function sniffDrawio(input: DrawioInput): 'diagram' | 'library' | null;

// lib/drawio/json-export.ts
export function readJsonExport(
  text: string,
): { kind: 'xml'; text: string } | { kind: 'graph'; pages: JsonExportPage[] };
export function jsonLabelText(html: string): string;
export function jsonPageElements(page: JsonExportPage, tally: ReportTally): Element[];

// lib/drawio/library.ts
export type ImportedLibraryItem = {
  title: string;
  width: number;
  height: number;
  elements: Element[];
};
export function importDrawioLibrary(
  input: DrawioInput,
): Promise<
  | { ok: true; items: ImportedLibraryItem[]; images: ImportImageRequest[]; report: DrawioReport }
  | { ok: false; error: string }
>;

// lib/drawio/files.ts
export function drawioFileTitle(
  fileName: string,
  meta: DrawioMeta,
  firstPageName: string,
  modified: string | undefined,
): string;
export function drawioLibraryTitle(fileName: string): string;
export function drawioFileDates(
  modified: string | undefined,
  lastModified: number,
): { createdAt?: string; modifiedAt?: string };
export function readDrawioFiles(files: readonly File[]): Promise<{
  diagrams: DrawioDocumentFile[];
  libraries: {
    name: string;
    items: ImportedLibraryItem[];
    images: ImportImageRequest[];
    report: DrawioReport;
  }[];
  failures: { title: string; message: string }[];
}>;

// lib/drawio/new-document.ts
export type DrawioDocumentFile = {
  name: string;
  createdAt?: string;
  modifiedAt?: string;
  pages: ImportedPage[];
  images: ImportImageRequest[];
  report: DrawioReport;
};
export function drawioDocumentSource(
  file: DrawioDocumentFile,
  o: { ownerId: string; offline: boolean; createImageSession?: CreateImageSession },
): ImportDocumentSource;

// lib/import-tab.ts (the foundation's, shared by every importer)
export type ImportOutcome =
  | {
      status: 'done';
      images?: ImportImageReport;
      scene?: BoardSceneReport;
      failures?: { title: string; message: string }[];
      documents?: { id: string; name: string }[];
    }
  | { status: 'cancelled' }
  | { status: 'error'; error: string };
export type PickedTabFile = { name: string; text: string; file: File };
export function pickTabFile(accept?: string): Promise<PickedTabFile | null>;

// hooks/persistence/useTabImport.ts
export type ImportFormat = 'json' | 'markdown' | 'mermaid' | 'excalidraw' | 'drawio';

// hooks/persistence/drawio-apply.ts
export function applyDrawioPages(
  tabs: Tab[],
  activeId: string,
  pages: ImportedPage[],
  createTab: (name: string) => Tab,
): Tab[];
```

`notes()` returns only non-zero kinds, in `IMPORT_NOTE_ORDER`; `names` sorted by count descending,
then name, capped at `DRAWIO_REPORT_NAMES_MAX` with the rest counted in `moreNames`.

Refusals (the `error` string, final copy):

| Reason                | Copy                                                                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `too-large`           | "This file is too large to import (the limit is 50 MB)."                                                                                         |
| `not-xml`             | "This isn't a draw.io file: it isn't a .drawio, a .drawio.png, a .drawio.svg or a draw.io JSON export." (also JSON that is not a draw.io export) |
| `not-drawio`          | "This XML isn't a draw.io diagram (expected an mxfile or mxGraphModel)."                                                                         |
| `no-pages`            | "This draw.io file has no pages."                                                                                                                |
| `png-without-diagram` | "This PNG has no draw.io diagram inside. In draw.io, export as PNG with 'Include a copy of my diagram' ticked."                                  |
| `svg-without-diagram` | "This SVG has no draw.io diagram inside. In draw.io, export as SVG with 'Include a copy of my diagram' ticked."                                  |
| `page-unreadable`     | "Page '<name>' couldn't be decoded." (`Page <n>` when unnamed)                                                                                   |
| `library`             | "This is a draw.io shape library. Import it with Import from draw.io on the Explorer page to add it to My shapes."                               |
| `not-library`         | "This isn't a draw.io library (expected an mxlibrary holding a list of shapes)."                                                                 |
| `empty-library`       | "None of this library's shapes could be read."                                                                                                   |
| `unreadable`          | "Couldn't read this draw.io file."                                                                                                               |

## Data and persistence

- Nothing new is persisted: the output is ordinary `Element`s, `Layer`s and `Tab`s, each passing
  `isValidElement` / `isValidTab`, saved by the existing per-tab storage.
- Image bytes are never written into elements (a data URL in a tab would breach `MAX_TAB_BYTES`);
  they live only in the in-memory pending list for the seam.
- No D1 migration, no api change, no `api-schema` change.
- Undo: the import is one `commitTabs` entry; undo removes the new tabs and restores the active tab.

## Errors and edge cases

| Case                                        | Handling                                                          |
| ------------------------------------------- | ----------------------------------------------------------------- |
| Empty text / only whitespace                | Refused `not-xml` (the dialog's Import button is disabled anyway) |
| A `diagram` with no content                 | An empty page: an empty tab, counted in `pages`                   |
| A cell with no geometry                     | Vertex: skipped, `hidden-skipped` += 1 (D20); edge: fine          |
| Zero or negative width / height             | Clamped to 1                                                      |
| Duplicate cell ids                          | Last one wins in the map; both walk (D21)                         |
| A parent id that does not exist             | Treated as a child of the first layer                             |
| A cycle in parents                          | The walk visits each id once; the cycle is broken                 |
| Edge source = target (self-loop)            | Both ends pinned to the element, different anchors kept as mapped |
| Non-finite numbers in geometry              | Treated as 0                                                      |
| An entity with no text rows                 | Not an entity: an ordinary lane                                   |
| A table with no rows                        | A `square` with the table's label, `shape-approximated`           |
| `DecompressionStream` missing (old browser) | Compressed pages refused `page-unreadable`; uncompressed import   |
| A locked active tab                         | Refused before reading, as every format                           |

## Security and trust

- The file is untrusted. XML parses with `DOMParser('application/xml')`, which loads no external
  entities and runs nothing; HTML labels parse with `DOMParser('text/html')`, an inert document:
  scripts do not run, images and styles do not load. Only text and a closed set of attributes are
  read; no markup reaches the canvas. HTML is never converted to text by regex (tags stripped, then
  entities decoded, would turn `&lt;script&gt;` into markup).
- No regular expression over file content can backtrack super-linearly: envelopes, comments and
  payloads are found with `indexOf` scanners (`rootTagOf`, the library body, Excalidraw's SVG
  payload), and the remaining patterns are anchored with no overlapping quantifiers. Hostile heads
  are unit tested against a time bound.
- Links: only `http:`, `https:`, `mailto:` become URL links (label runs and element links alike);
  `javascript:`, `data:` (other than page links) and everything else are dropped and counted.
- No network: nothing is fetched while importing; web image URLs are only listed.
- Size: 50 MB input, 100 MB inflated in total (zip bombs), 100 pages, 10 000 elements a page,
  entity rows and text to their validate limits.
- Hosted cost: zero server work until the image pipeline uploads.

## Performance and limits

- Work is linear in cells: one DOM walk, one pass per page, a map lookup per edge end, 16 anchors
  per pinned end. A 2 000-cell page converts in well under 200 ms on a mid laptop (measured on the
  generated `stress` fixture in the unit suite at under 1 s on CI hardware, as a smoke bound).
- HTML labels parse per label (`DOMParser` per call, ~20 µs); plain labels skip the parser.
- The importer is one lazy chunk (`import('@/lib/drawio/import')`), not in the editor's first load.
- Worst case memory: 50 MB input + 100 MB inflated text + its DOM, transient, released after import.

## Presentation and UX

- Card (`FORMATS` entry `drawio`): title `draw.io`, description "A .drawio file, or a PNG / SVG with
  the diagram inside. Keeps shapes, text, connections and pages. Multi-page files add a tab for each
  further page.", placeholder `<mxfile>\n  <diagram name="Page-1">\n    <mxGraphModel>…</mxGraphModel>\n  </diagram>\n</mxfile>`,
  format icon label `drawio`, `note` linking the `importTabs` help article, label "See what carries
  over from draw.io".
- File picker `accept`: `DRAWIO_TAB_FILE_ACCEPT` (`limits.ts`).
- `TextImportPanel.onDone(outcome)`; `ImportTabDialog` closes on `done` without `scene` or counted
  `images`, else shows the shared report view (`ImportImageReport`: `data-testid="import-image-report"`,
  `role="status"`, heading "Import complete", the landed counts and rules through
  `BoardSceneReportList`, the images block, a **Done** button focused on mount) in place of the panel;
  the subtitle reads "Here's how your board came across." ("Here's how your images came across."
  when only images had news). While images store the panel counts them (the pipeline's progress
  label).
- Rule copy: `DRAWIO_RULES` (step 18), the spec's report table word for word.

## Accessibility

- The summary is a region labelled by its heading (`aria-labelledby`); the list is a `ul`; the Done
  button takes focus on mount so keyboard and screen reader users land on the result; Escape and the
  close button behave as before.
- Counts are text, not colour; the dialog's existing contrast tokens are reused (WCAG 2.2 AA).
- No motion is added.

## Web Experience

- LCP: none of this is in the first load (dialog and importer both lazy).
- INP: the import runs after the button press, awaiting between pages
  (`await` per page yields to the event loop) so a many-page import does not block input for its
  whole length; the button shows "Importing…" at once.
- CLS: the summary replaces the panel inside the dialog body; nothing outside the dialog moves.

## Observability

| Fingerprint                               | Level                | When                                                                                                                    |
| ----------------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `[drawio-import] refused`                 | `warn`               | Any refusal: `{ reason, detail?, cause? }` (`cause` only for an unexpected error; never file content)                   |
| `[drawio-import] page`                    | `trace` (`debugLog`) | Each page converted: `{ index, cells, elements }`                                                                       |
| `[drawio-import] applied`                 | `trace` (`debugLog`) | The hook applied: `{ pages, elements, notes: kind→count, images? }` (the pipeline logs each image as `[import-images]`) |
| `[drawio-import] json export laid out`    | `trace` (`debugLog`) | A graph-only JSON export laid out: `{ pages }`                                                                          |
| `[drawio-import] library read`            | `trace` (`debugLog`) | A library decoded: `{ items, unreadable }`                                                                              |
| `[drawio-import] library refused`         | `warn`               | A library refused: `{ reason: 'not-library'                                                                             | 'empty-library', items? }` |
| `[drawio-import] library item unreadable` | `trace` (`debugLog`) | One library item left out: `{ cause }` (the error name and message, never content)                                      |
| `[drawio-import] files`                   | `trace` (`debugLog`) | The Explorer read its picks: `{ files, diagrams, libraries, failures }`                                                 |
| `[drawio-import] file unreadable`         | `warn`               | A picked file threw while reading: `{ error }`                                                                          |
| `[drawio-import] import failed`           | `warn`               | The Explorer flow hit an unexpected error: `{ error }`; the panel shows the pick step with a message                    |

## Testing

Unit tests (Vitest), files beside their modules; the DOM ones carry `// @vitest-environment jsdom`.

| Rule (spec)                                                                                                                  | Test                                                                                                |
| ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Inputs table                                                                                                                 | `envelope.test.ts`: each input form from the fixtures, each refusal                                 |
| Compressed decode + zip-bomb guard                                                                                           | `inflate.test.ts`                                                                                   |
| PNG chunks (tEXt, zTXt zlib + raw, iTXt, none)                                                                               | `png.test.ts`                                                                                       |
| Style parsing and named styles                                                                                               | `style.test.ts`                                                                                     |
| Colours                                                                                                                      | `colour.test.ts`                                                                                    |
| Cell tree, geometry, layers, UserObject, placeholders                                                                        | `cells.test.ts`                                                                                     |
| Labels, plain and HTML                                                                                                       | `label.test.ts`                                                                                     |
| Shape table, stencils, unmatched                                                                                             | `shapes.test.ts`                                                                                    |
| Vertex properties                                                                                                            | `vertex-props.test.ts`                                                                              |
| Lanes (upright titles, square corners), entities, tables                                                                     | `containers.test.ts`                                                                                |
| Edges                                                                                                                        | `edges.test.ts`                                                                                     |
| Images, groups, hidden, collapsed, truncation, report                                                                        | `convert-page.test.ts`                                                                              |
| Pages to tabs, page links, refusals, size limit                                                                              | `fixtures.test.ts` (via `importDrawio`)                                                             |
| Every fixture valid + expected report                                                                                        | `fixtures.test.ts`                                                                                  |
| Apply to tabs: names, folder, look, layers                                                                                   | `drawio-apply.test.ts`                                                                              |
| Page images through one pipeline pass, split back per page                                                                   | `images.test.ts`                                                                                    |
| One commit, new tabs marked loaded, telemetry, refusal and lock, embedded images stored (pipeline faked at its browser seam) | `useTabImport.drawio.test.ts`                                                                       |
| Report tally                                                                                                                 | `notes.test.ts`                                                                                     |
| The shared report: landed counts, rules in order, stencil names, outcome                                                     | `report.test.ts`                                                                                    |
| Sniffing: every form, Drive saves without an extension, libraries, other files                                               | `envelope.test.ts`                                                                                  |
| JSON export: the `data` path, the laid-out graph, labels, links, auto-layout rule                                            | `json-export.test.ts`                                                                               |
| Libraries: items, image items, unreadable items, refusals, the tab dialog refusal                                            | `library.test.ts`                                                                                   |
| Pages as the tabs of a new document, images in one pass                                                                      | `new-document.test.ts`                                                                              |
| New documents from ready tabs: oversized tabs named, empty documents failed, per-source failures, offline                    | `board-scene-import.test.ts`                                                                        |
| Files to documents: names, dates, kinds, failures, pick order                                                                | `files.test.ts`                                                                                     |
| The Explorer flow and panel                                                                                                  | `useDrawioFileImport.test.ts`, `DrawioImportPanel.test.tsx`                                         |
| Dialog routing (close vs summary)                                                                                            | `ImportTabDialog.test.tsx`                                                                          |
| Page scale: ratios, clamp, no labels                                                                                         | `scale.test.ts`                                                                                     |
| Paper colours: ink, paper, kept hex, run colours, arrows                                                                     | `colour.test.ts`                                                                                    |
| Opacity over paper, overlap keeps opacity                                                                                    | `vertex-props.test.ts`                                                                              |
| Provenance attributes, blank lines, clipped labels, dot rule                                                                 | `cells.test.ts`, `label.test.ts`, `vertex-props.test.ts`                                            |
| Upright lanes, square lane corners                                                                                           | `containers.test.ts`                                                                                |
| Ported routes against draw.io's own (OrthConnector, Elbow, EntityRelation, Segment, Loop, perimeters, constraints)           | `route/*.test.ts`, expected points taken from draw.io's CLI export of each fixture page (SVG paths) |
| Snapped ends, shared ends exact, no route behind, on-arrow ends, free ends, heads, label position and width                  | `edges.test.ts`                                                                                     |
| Captions below actors, icons, images; marks; endState; curlyBracket                                                          | `shapes.test.ts`, `convert-page.test.ts`                                                            |

End to end: `e2e/drawio-import.spec.ts` on the production build (`scripts/e2e-stack.mjs`) picks each fixture form through the Import dialog, checks the summary, the tabs and what the api stored, and that one undo removes the new tabs. Its Explorer case picks a synthesised Drive save (no extension, three compressed pages), a JSON export and a text file through Import from draw.io, checks the list, the report and the stored tabs of the new document. `DRAWIO_SHOTS=<dir>` also saves screenshots.

## Constants and configuration

| Constant                                        | Value                                                                                                                                                       | Provenance / safe range                                                                                                                       |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `DRAWIO_MAX_FILE_BYTES`                         | 50 MiB                                                                                                                                                      | Spec; 10 to 200 MiB                                                                                                                           |
| `DRAWIO_MAX_INFLATED_BYTES`                     | 100 MiB                                                                                                                                                     | Spec; at least the file limit                                                                                                                 |
| `DRAWIO_MAX_PAGES`                              | 100                                                                                                                                                         | Spec; 1 to 500                                                                                                                                |
| `MAX_ELEMENTS_PER_TAB`                          | 10 000                                                                                                                                                      | `@livediagram/document` validate.ts                                                                                                           |
| `DRAWIO_DEFAULT_ARC_SIZE`                       | 10 (%)                                                                                                                                                      | draw.io's `mxConstants.RECTANGLE_ROUNDING_FACTOR`                                                                                             |
| `DRAWIO_SHADOW`                                 | `{2, 3, 3, 0.25}`                                                                                                                                           | draw.io's shadow offset (2, 3) and opacity, D22                                                                                               |
| `DRAWIO_CAPTION_LINE_PX`                        | 18                                                                                                                                                          | One `sm` caption line with leading, D23; 14 to 24                                                                                             |
| `DRAWIO_CAPTION_PADDING_PX`                     | 16                                                                                                                                                          | The icon caption area's inner padding, both sides, D23; 8 to 24                                                                               |
| `INK_ON_LIGHT`, `INK_ON_DARK` (vertex-props.ts) | `#1e293b`, `#ffffff`                                                                                                                                        | The editor's light-paper text ink and dark-paper text, D29                                                                                    |
| `WHITE` (convert-page.ts)                       | `#fff`, `#ffffff`, `#ffffffff`                                                                                                                              | draw.io's default page                                                                                                                        |
| `DRAWIO_LABEL_CENTRE_EPSILON`                   | 0.05                                                                                                                                                        | D24; 0 to 0.2                                                                                                                                 |
| `DRAWIO_REPORT_NAMES_MAX`                       | 5                                                                                                                                                           | D25; 3 to 10                                                                                                                                  |
| `DRAWIO_ANGLED_EDGE_STYLES`                     | `orthogonalEdgeStyle`, `elbowEdgeStyle`, `entityRelationEdgeStyle`, `segmentEdgeStyle`, `isometricEdgeStyle`, `sideToSideEdgeStyle`, `topToBottomEdgeStyle` | draw.io's `mxEdgeStyle` routers                                                                                                               |
| `DRAWIO_EXTENSIONS`                             | `.drawio.svg`, `.drawio.png`, `.drawio`, `.xml`, `.json`, `.svg`, `.png`                                                                                    | The spec's names rule                                                                                                                         |
| `DRAWIO_GENERIC_NAME`                           | `untitled`, `untitled diagram`, `diagram` or `drawing`, any case, with an optional ` (n)` or `-n`                                                           | draw.io's default names; the spec                                                                                                             |
| `DRAWIO_GENERIC_LIBRARY_NAME`                   | `untitled library`, any case, with an optional ` (n)` or `-n`                                                                                               | draw.io's default library name                                                                                                                |
| `DRAWIO_MAX_LIBRARY_ITEMS`                      | 1 000                                                                                                                                                       | Spec "Shape libraries" (the shape library item cap); 100 to 10 000                                                                            |
| `DRAWIO_JSON_LOOSE_EDGE_PX`                     | 80                                                                                                                                                          | About half a default box's width (D34); 40 to 160                                                                                             |
| `DRAWIO_XS_BELOW_PX`                            | 12                                                                                                                                                          | Text under it reads closer to `xs` (10) than `sm`; draw.io's 12 px body stays `sm` (D37); 11 to 12                                            |
| `RUN_XS_PX`                                     | 10                                                                                                                                                          | `@livediagram/document` label-font.ts: the extra-small run size                                                                               |
| `DRAWIO_SNIFF_CHARS`                            | 4096                                                                                                                                                        | Room for a BOM, an XML declaration and the root element                                                                                       |
| `DRAWIO_TAB_FILE_ACCEPT`                        | `.drawio,.xml,.json,.svg,.png` and their MIME types                                                                                                         | The spec (the Import dialog card); the Explorer picker sets no filter, Drive saves have no extension                                          |
| `DRAWIO_MARKERS`                                | the table in step 12.4                                                                                                                                      | draw.io's marker names                                                                                                                        |
| `DRAWIO_PROVENANCE_ATTRIBUTES`                  | `lucidchartObjectId`, `visioObjectId`, `gliffyId`                                                                                                           | Ids other tools write when converting into draw.io (seen: Lucidchart); extend as met                                                          |
| `INK_MAX_LIGHTNESS`, `INK_MAX_CHROMA`           | 0.35, 0.04 (OKLCH)                                                                                                                                          | `lib/board-scene/colour.ts`, the board scene ink rule (shared, not copied)                                                                    |
| `PAPER_MIN_LIGHTNESS`, `PAPER_MAX_CHROMA`       | 0.93, 0.02 (OKLCH)                                                                                                                                          | D39: `#eeeeee` (L 0.95) and `#f5f5f5` are paper, `#e0e0e0` (L 0.91) a grey; 0.9 to 0.97, 0.01 to 0.04                                         |
| `DRAWIO_DOT_MAX_STROKES`                        | 2                                                                                                                                                           | D38: a dash at most twice the stroke width reads as a dot; 1 to 3                                                                             |
| `DRAWIO_MAX_PAGE_SCALE`                         | 1.6                                                                                                                                                         | D40: the largest scale a page of tiny draw.io text gets; 1.3 to 2                                                                             |
| `DRAWIO_DEFAULT_FONT_PX`                        | 12                                                                                                                                                          | draw.io's default stylesheet font size                                                                                                        |
| `DRAWIO_DEFAULT_BOX_PX`                         | 120                                                                                                                                                         | draw.io's default vertex width                                                                                                                |
| `DRAWIO_LABEL_SPACING`                          | 2                                                                                                                                                           | draw.io's default label `spacing`                                                                                                             |
| `DRAWIO_LINE_HEIGHT`                            | 1.2                                                                                                                                                         | `mxConstants.LINE_HEIGHT`                                                                                                                     |
| `LABEL_LINE_HEIGHT`                             | 1.25                                                                                                                                                        | The canvas label line height (17.5 px at 14 px)                                                                                               |
| `LABEL_EM_ADVANCE`                              | 0.4785                                                                                                                                                      | Mean advance per em of the reference text in the canvas label face (system UI stack, weight 500), measured in Chromium on Linux; 0.45 to 0.52 |
| `HELVETICA_EM_ADVANCE`                          | 0.4746                                                                                                                                                      | The same for Helvetica / Arial / Liberation Sans (metric-compatible) at 400                                                                   |
| `DRAWIO_DEFAULT_MARKER_SIZE`                    | 6                                                                                                                                                           | `mxConstants.DEFAULT_MARKERSIZE`                                                                                                              |

## Assets and external resources

- Fixtures in `apps/live/lib/drawio/__fixtures__/`, authored for this repo (MIT, like the codebase):
  hand-written uncompressed sources using draw.io's own library style strings, plus the forms a
  generator derives from them (compressed `.drawio`, `.drawio.svg`, `.drawio.png` with `tEXt` and
  `zTXt`, a `stress` page). `generate.ts` rebuilds them deterministically
  (`node lib/drawio/__fixtures__/generate.ts`); `README.md` there records provenance and licence.
- No vendor artwork is copied: stencil names are identifiers, and icons render from livediagram's
  own catalogues.
- `lib/drawio/route/` ports draw.io's view geometry (jgraph/drawio v31.7.0, `mxGraphView`,
  `mxEdgeStyle`, `mxPerimeter`, parts of `Graph.js`; Apache-2.0). Each ported function names its
  source function; the licences package lists it as an embedded work (`drawio-mxgraph`, triggered by
  `apps/live/lib/drawio/route/`) with draw.io's `LICENSE` text committed under `packages/licences/texts/`.
- New Technology icons for vendor stencils met in real diagrams (`aws-lake-formation`, `aws-msk`) are
  authored in-repo as the catalogue's tile + white glyph (Technology icons spec), not copied.
