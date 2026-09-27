# draw.io import: blueprint

Derived from [draw.io import](../drawio-import.md). The spec decides; this file only adds engineering
precision. Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and
cited as `Dn`.

Scope, by file (all under `apps/live/` unless stated):

| File                                     | Role                                                                                      |
| ---------------------------------------- | ----------------------------------------------------------------------------------------- |
| `lib/drawio/limits.ts`                   | Named constants of this blueprint                                                         |
| `lib/drawio/inflate.ts`                  | `inflateBytes`, `decompressDiagram`, `ByteBudget`: DecompressionStream with a byte budget |
| `lib/drawio/png.ts`                      | `extractPngDiagram`: the embedded XML from a `.drawio.png`                                |
| `lib/drawio/envelope.ts`                 | `readDrawioPages`: input sniffing, `mxfile` / `mxGraphModel` / SVG / PNG to page sources  |
| `lib/drawio/style.ts`                    | `parseStyle`, `DrawioStyle`: style string plus the built-in named styles                  |
| `lib/drawio/colour.ts`                   | `readColour`: `#hex` / `none` / `default` / `light-dark()`                                |
| `lib/drawio/cells.ts`                    | `readGraph`: the cell tree, layers, absolute geometry                                     |
| `lib/drawio/label.ts`                    | `readLabel`: plain and HTML labels to text and `TextRun[]`                                |
| `lib/drawio/stencils.ts`                 | Pure data: stencil and library-image names to icon ids                                    |
| `lib/drawio/shapes.ts`                   | `classifyVertex`: the shape mapping table                                                 |
| `lib/drawio/vertex-props.ts`             | `boxedProps`, `textProps`: the property maps shared by every vertex                       |
| `lib/drawio/containers.ts`               | `buildLane`, `buildEntity`, `buildTable`                                                  |
| `lib/drawio/edges.ts`                    | `buildArrow`: endpoints, route, heads, labels                                             |
| `lib/drawio/convert-page.ts`             | `convertPage`: one page's graph to elements, layers, background                           |
| `lib/drawio/import.ts`                   | `importDrawio`: the entry point                                                           |
| `lib/import-report.ts`                   | `ImportReport`, `ImportNoteKind`, `ReportTally`, `PendingImage`, `describeImportNote`     |
| `lib/import-tab.ts`                      | `pickFile` (a `File`), `pickTabFile` on top of it; `ImportOutcome.done` gains `report`    |
| `hooks/persistence/useTabImport.ts`      | The `drawio` format: multi-page apply, one undo step, telemetry, log                      |
| `hooks/persistence/drawio-apply.ts`      | `applyDrawioPages`: pure `Tab[]` transform the hook commits                               |
| `components/dialogs/ImportTabDialog.tsx` | The draw.io card; routes a reported outcome to the summary                                |
| `components/dialogs/TextImportPanel.tsx` | `onDone(outcome)`                                                                         |
| `components/dialogs/ImportSummary.tsx`   | The summary view                                                                          |
| `lib/drawio/__fixtures__/`               | The corpus and its generator                                                              |

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
| Report        | `ImportReport`         | `{ source, pages, elements, notes: ImportNote[] }`                                       |
| Note          | `ImportNote`           | `{ kind: ImportNoteKind, count, names? }`                                                |
| Pending image | `PendingImage`         | `{ tabId, elementId, source }`, `source` a `data-url` or a `url`                         |
| Byte budget   | `ByteBudget`           | Remaining inflate allowance for one import                                               |

Banned synonyms: "diagram" for a page (a livediagram diagram is the whole document; say page), "shape"
for an edge, "warning" for a note, "stencil" for a named style (`ellipse` is a named style,
`mxgraph.aws4.s3` is a stencil).

## Behaviour

### 1. Entry

`importDrawio(input, { tabIdForPage }) => Promise<DrawioImportResult>`:

1. `bytes` longer than `DRAWIO_MAX_FILE_BYTES` (or `text` longer, in UTF-16 units) → refuse
   `too-large`.
2. `readDrawioPages(input, budget)` → page sources, or a refusal.
3. Pages beyond `DRAWIO_MAX_PAGES` are dropped: note `content-truncated` += dropped count.
4. `pageTabIds = pages.map((_, i) => tabIdForPage(i))`; `pageIdToTab` maps each page's `id` to its tab.
5. Per page, in order: `readGraph(page.model)` then `convertPage(graph, ctx)`.
6. Result `{ ok: true, pages, images, report }` with `report.pages = pages.length` and
   `report.elements` the sum of element counts.

`DrawioImportResult = { ok: true; pages: ImportedPage[]; images: PendingImage[]; report: ImportReport } | { ok: false; error: string }`.
Never throws: any exception inside is caught and refused as `unreadable`, logged (see Observability).

### 2. Envelope (`readDrawioPages`)

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
  `decodeURIComponent`; if that throws, the Latin-1 text itself (an unencoded payload, D11). Finally
  remove C0 control characters other than tab, LF, CR (draw.io's `zapGremlins`).
- `inflateBytes(bytes, format, budget)`: pipe a one-chunk `ReadableStream` through
  `new DecompressionStream(format)`; accumulate chunks; after each, `budget.take(chunk.length)`,
  which throws `BudgetExceeded` when the remaining allowance goes below zero. `BudgetExceeded` is
  refused `too-large`; any other stream error is `inflate-failed` (the caller decides the message).
- One `ByteBudget(DRAWIO_MAX_INFLATED_BYTES)` per import, shared by every page and the PNG chunk.

### 4. PNG (`extractPngDiagram(bytes, budget)`)

Walk chunks from offset 8: `length` (u32 BE), `type` (4 ASCII), data, CRC (not checked, D12). Stop at
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
lower-cased; `rgb(...)` / `rgba(...)` → `{ kind: 'hex' }` of its RGB; anything else → `unset` (D13).

### 7. Cells (`readGraph(model)`)

1. Background: `model.getAttribute('background')` through `readColour`; `hex` kept.
   `backgroundImage` present → `backgroundImage: true`.
2. Walk `root`'s element children in order. `mxCell` is a cell; `UserObject` / `object` wraps one
   `mxCell` child: the wrapper's `id` is the cell's id, its `label` the value, `link`, `tooltip`,
   `placeholders` read, every other attribute a custom property (in attribute order).
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

### 8. Label (`readLabel(value, html, baseFontPx)`)

- Not `html`: `{ plain: value }` (newlines kept, `\r\n` normalised to `\n`).
- `html`: parse with `DOMParser('text/html')`; walk `body` depth-first carrying a format:
  - `b`, `strong`, `font-weight` ≥ 600 or `bold` → bold; `i`, `em`, `font-style: italic` → italic;
    `u`, `text-decoration` containing `underline` → underline; `s`, `strike`, `del`,
    `line-through` → strikethrough; `font color`, CSS `color` → `readColour`, hex only → color;
    `a href` with `http:`, `https:`, `mailto:` → link; `h1`..`h3` → heading 1..3 (`h4`..`h6` bold).
  - `br` → `\n`. Block elements (`div`, `p`, `li`, `h1`..`h6`, `tr`, `blockquote`, `pre`) start on a
    new line when text precedes them. `li` inside `ul` prefixes `• `, inside `ol` `n. `. `td` / `th`
    after the first in a row prefix a tab.
  - Text nodes: whitespace runs collapse to one space (not inside `pre`), `&nbsp;` is a space.
  - Lines are trimmed at both ends; leading and trailing empty lines dropped; more than one empty
    line between blocks collapses to one.
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
7. The shape table (spec "Vertices: shapes") by exact name → `{ shape, fidelity }`; `text`,
   `edgeLabel` → `text`; `note` → `sticky`; `line` → `line`; `umlFrame` → `frame`.
8. Otherwise → `unmatched` with `name = shapeName` (`stencil(...)` names reduce to `custom stencil`).

`triangle`'s rotation: `direction` `east` (default) 90, `south` 180, `west` 270, `north` 0; a 90 or 270
turn swaps width and height about the centre so the turned box matches draw.io's. Any other shape
with `direction` other than `east`, or `flipH` / `flipV`, on a kind that is not symmetric under that
flip (every kind except `square`, `circle`, `diamond`, `hexagon`, `cylinder`, `cloud`, `stadium`,
`star`) is counted `shape-approximated` once.

### 10. Vertex properties (`boxedProps`, `textProps`)

1. `fillColor`: `hex` → value; `none` → `'transparent'`; `unset` → omitted.
2. `strokeColor`: `hex` → value; `none` → `strokeWidth: 'none'`.
3. `strokeWidth` px → nearest of `BORDER_STROKE_PX` (`thin` 1, `medium` 2, `thick` 4,
   `extra-thick` 7), ties to the thinner (D14); `0` → `'none'`. Absent → `thin` (draw.io's 1 px, D15).
4. `dashed=1` → `dashed`; with `dashPattern` `"a b ..."` where every dash ≤ its gap → `dotted`.
5. `rounded=1` on `square`: radius = `absoluteArcSize=1` ? `arcSize` px : `arcSize` (default
   `DRAWIO_DEFAULT_ARC_SIZE`) % of `min(width, height)`; nearest of `BORDER_RADIUS_PX` excluding
   `full`, and `full` when radius ≥ half the shorter side. `rounded` absent → `none`.
6. `opacity` → `/100`, omitted at 100. `rotation` → degrees mod 360, omitted at 0.
7. `shadow=1` → `DRAWIO_SHADOW`. `locked=1` → `locked: true`.
8. Link (`cell.link`): `http:`, `https:`, `mailto:` → `{ kind: 'url', url }`; `data:page/id,<id>` →
   `{ kind: 'tab', tabId: pageIdToTab.get(id) }` when known; else dropped, `link-dropped`.
9. Note: `tooltip` then each custom property as `name: value`, lines joined by `\n`, omitted when
   empty.
10. Text: `readLabel`; `label = plain` (omitted when empty); `richText = runs` when the kind carries
    rich text (shape, text, sticky). `fontStyle` bits → `textBold` / `textItalic` / `textUnderline` /
    `textStrikethrough`. `fontColor` hex → `textColor`. `fontSize` → nearest preset on the scale
    (`LABEL_FONT_PX` for shapes and text, `NOTE_FONT_PX` for stickies, `arrowLabelFontSize` for
    arrows), over `sm`, `md`, `lg` only, ties to the smaller. `fontFamily` → `fontIdFor(family)`.
    `align` → `textAlignX`; `verticalAlign` → `textAlignY` (`middle` kept as `middle`).
11. Label outside: `labelPosition` `left` / `right` or `verticalLabelPosition` `top` / `bottom` on a
    non-icon kind: alignment set towards that side (`textAlignX: 'left'|'right'`, `textAlignY:
'top'|'bottom'`), `label-moved` += 1 when the label is non-empty.

`fontIdFor(family)`: lower-case the first family in the list, trimmed of quotes; a `FONTS` id or
label equal to it → that id; contains `mono`, `courier`, `consol` → `roboto-mono`; `comic`,
`architects daughter`, `xkcd`, `caveat`, `indie flower` → `caveat`; else `undefined`.

### 11. Containers

1. **Lane** (`buildLane`): `shape: 'lane'`, box from the cell, `headerSize = startSize` (23 when
   absent), `horizontal=0` → `textAlignX 'left'`, else `textAlignX 'center'`, `textAlignY 'top'`.
   `fillColor` → `headerFill` (per step 10.1); `swimlaneFillColor` → `fillColor`, absent or `none`
   → `'transparent'`. Children convert as normal elements after the lane.
2. **Entity** (`buildEntity`): a swimlane with `childLayout=stackLayout` and at least one child,
   every child a vertex whose `shapeName` is `''` with named style `text`, or `line`, and none with
   children of its own. `shape: 'entity'`, label = the swimlane's plain label, `entityFields` = the
   text rows in order: plain text split at the last `:` into `name` (trimmed) and `type` (trimmed,
   omitted when empty); rows over `ENTITY_MAX_FIELDS` dropped and text over `ENTITY_MAX_TEXT` cut,
   each counted `text-truncated`. Rows and lines are consumed, forwarding to the entity.
3. **Table** (`buildTable`): rows = the children whose `shapeName` is `tableRow`, cells = each row's
   children, in order. `cells[r][c]` = plain label; rows padded to the widest with `''`.
   `rowHeights` = row heights; `colWidths` = the first row's cell widths. The grid's box starts
   `startSize` below the table's top. Non-empty table label → a `text` element above the grid box
   (`y = table.y`, height `startSize`), `shape-approximated`. Cell `fillColor` hex → `cellStyles`
   `bg`. Rows and cells are consumed, forwarding to the table.

### 12. Edges (`buildArrow`)

1. **Ends.** `endpoint(cellId, side)`: `resolveTarget(cellId)` follows `forward` until an element id
   is found. Found → pinned. An `exitX`/`exitY` (source) or `entryX`/`entryY` (target) pair →
   the nearest offered anchor to `(x + fx * w, y + fy * h)`. Otherwise floating: the reference point
   is the first waypoint (source) / last waypoint (target), else the other end's centre (or its free
   point); take the point where the segment from the element's centre towards it crosses the
   element's box: for an angled route, the middle of the side it crosses (`n`, `e`, `s`, `w`) when the shape offers it; otherwise the nearest offered anchor to that point. Not found and the id was non-empty → free at the geometry point (`sourcePoint` /
   `targetPoint` in the edge parent's origin, else the cell's box centre if the cell exists) and
   `connection-loosened` += 1. Empty id → free at the geometry point.
2. An end whose cell is an edge → free at that edge's midpoint (its resolved from/to midpoint),
   `connection-loosened` += 1.
3. **Route.** `edgeStyle` in `DRAWIO_ANGLED_EDGE_STYLES` → `angled`; `curved=1` → `curved`; else
   `straight`. Waypoints (absolute: points + the edge parent's origin):
   - none: `angled` / `curved` / `straight` with no `curvePoints`;
   - `curved`: `curvePoints` = the waypoints;
   - `straight`: `arrowStyle: 'angled'` and `curvePoints` = the waypoints;
   - `angled`: `curvePoints` = the orthogonal expansion of `[from, ...waypoints, to]`: between
     consecutive points `p`, `q` that differ in both axes, insert `(q.x, p.y)` when the previous
     segment was vertical (the first segment counts as vertical when `from`'s anchor is `n` or `s`),
     else `(p.x, q.y)`; then drop the first and last point.
     `curvePoints` are stored as `{ dx, dy }` from the midpoint of the resolved `from` and `to`
     positions (`anchorPosition` for pinned ends).
4. **Heads.** `startArrow` / `endArrow` through `DRAWIO_MARKERS`: `none` / `''` → no head; a known
   marker → `{ shape, exact }`; unknown → `{ shape: 'line', exact: false }`. `startFill=0` /
   `endFill=0` turn `triangle`, `circle`, `diamond` hollow. `arrowEnds` from which ends carry a head;
   `arrowheadShape` = the end's shape, else the start's; omitted when `triangle`. `arrowheadSize` =
   nearest `ARROWHEAD_SIZE_PX` to `endSize` (else `startSize`, default 6), omitted at `medium`.
   `arrowhead-approximated` += 1 when either head is not exact, or both ends carry heads of
   different shapes.
5. **Stroke.** `strokeColor` hex → `strokeColor` (`none` → `opacity: 0`, D16); `strokeWidth` px →
   `strokeWidth` (number, omitted at 2, the default). `dashed` / `dashPattern` as vertices.
   `opacity` as vertices.
6. **Labels.** Parts: the edge's own plain label, then each child vertex's with `edgeLabel` or
   `text` named style (in order). Joined with `\n`; more than one non-empty part →
   `label-moved` += 1. Font props as step 10.10 on the arrow scale, from the edge's style (or the
   first child's, when the edge's value is empty). The first label cell's geometry `x` (−1..1) with
   `|x| > DRAWIO_LABEL_CENTRE_EPSILON` → `labelOffset: { t: (x + 1) / 2, offset: geometry.y }`.
7. An edge-label child vertex's absolute position (for step 7's `absoluteRect`) is the point at
   `t = (x + 1) / 2` along the edge's resolved polyline plus its `offset`.

### 13. Images

`image` class: `{ type: 'image', imageId: null, x, y, width, height, alt?: plain label }`.
`style.str('image')`: starts with `data:` → a pending image `{ tabId, elementId, key, source: { kind: 'data-url', dataUrl }, hint: { width, height } }` (a base64 payload without `;base64`, as draw.io writes it, gains the marker; `key` is `drawio-image-<n>`, one per distinct data URL across the import), `image-placeholder` += 1; any other value (a web or library URL) or none → placeholder only, `image-unavailable` += 1. A non-image kind
whose style carries `image=` → `image-unavailable` += 1. A page with `backgroundImage` →
`image-unavailable` += 1.

### 14. Icons

`icon` class → `{ type: 'shape', shape: 'icon', iconId, x, y, width, height }`, caption = label
(plain; the kind's name from the table when empty and the table gives one). Tech icons:
`iconSize` = nearest of `ICON_SIZE_PX` to `min(width, height)`, omitted at `md`. Caption placement:
`verticalLabelPosition` `bottom` (the stencil default) → `textAlignY: 'bottom'`, the box grows by
`DRAWIO_CAPTION_LINE_PX` per caption line downwards; `top` → `textAlignY: 'top'`, grows upwards;
`labelPosition` `left` / `right` → `textAlignX`, grows sideways by the caption's estimated width
(`DRAWIO_CAPTION_CHAR_PX` × longest line). `icon-substituted` += 1.

### 15. Page conversion (`convertPage(graph, ctx)`)

1. `ConvertState`: `idMap` (cell id → element id, minted by `crypto.randomUUID()`), `forward`
   (consumed cell id → cell id), `tally` (the import's), `elements` (output, paint order),
   `layerOf` (element id → layer id).
2. Layers: `layerIds.length >= 2` → `Tab.layers` = one per layer cell: first `DEFAULT_LAYER_ID`, the
   rest `layer:<uuid>`; `name` = plain label, else `DEFAULT_LAYER_NAME` for the first and
   `Layer n` after; `visible: false` when the layer cell is invisible; `locked: true` when its style
   has `locked=1`. A single layer → no `layers`, no `layerId`s.
3. Walk each layer's children depth-first (pre-order). Per cell: invisible → skip the subtree,
   `hidden-skipped` += 1 + descendants; edge → queue in paint order (built in pass 2); vertex →
   classify and build.
4. Collapsed vertex: build it, skip descendants, `collapsed-skipped` += descendant count.
5. `group` class: no element; `forward[group] =` nothing (connections loosen), children walked,
   `group-flattened` += 1.
6. Elements carry `layerId` of their layer cell when layers were emitted.
7. Pass 2: arrows, built in their queued paint positions (the element list is built with arrow
   placeholders so paint order is draw.io's).
8. Truncation: output beyond `MAX_ELEMENTS_PER_TAB` dropped, `content-truncated` += dropped.
9. Result `{ elements, layers?, backgroundColor? }`; pending images carry `ctx.tabId`.

### 16. Apply (`applyDrawioPages(tabs, activeId, pages)` and the hook)

Pure `Tab[] => Tab[]`:

1. Page 0 merges into the active tab through `mergeImportedTab(active, { ...imported })` with
   `elements`, `layers`, `backgroundColor`, `name`: single page → the active tab's name; multi-page
   → the page name, else `Page 1`.
2. Pages 1..n → new tabs `{ ...createTab(name), id: page.tabId, elements, layers, backgroundColor,
theme, font, defaultTextSize, backgroundPattern, patternColor, backgroundOpacity (from the active
tab), templateChosen: true }`, inserted after the active tab in page order.
3. Hook: `commitTabs(ts => applyDrawioPages(ts, activeId, pages))` (one undo step), `markTabLoaded`
   for each new tab, selection / edit / format source cleared, `requestFit()` when page 0 has
   elements, `track('Tab', 'Imported', 'Drawio')`, log `[drawio-import] applied`.
4. Pending images: `onPendingImages(images)` seam (step 17). Returns
   `{ status: 'done', report }`.
5. `tabIdForPage(0) = activeId`; `tabIdForPage(i > 0) = crypto.randomUUID()`.

### 17. The image seam

`useTabImport` calls `resolvePendingImages(images)` from `lib/import-report.ts`, which today returns
`{ placed: 0 }` and leaves every placeholder. The image pipeline replaces that one function: it
uploads, writes `imageId` / `naturalWidth` / `naturalHeight` onto the placeholders through
`commitTabs`, and adjusts the report's `image-placeholder` count to those still unplaced.

## Interfaces and contracts

```ts
// lib/import-report.ts
export type ImportNoteKind =
  | 'shape-unmatched'
  | 'shape-approximated'
  | 'icon-substituted'
  | 'image-placeholder'
  | 'image-unavailable'
  | 'arrowhead-approximated'
  | 'connection-loosened'
  | 'label-moved'
  | 'group-flattened'
  | 'hidden-skipped'
  | 'collapsed-skipped'
  | 'link-dropped'
  | 'text-truncated'
  | 'content-truncated';
export const IMPORT_NOTE_ORDER: readonly ImportNoteKind[]; // the spec table's order
export type ImportNote = {
  kind: ImportNoteKind;
  count: number;
  names?: { name: string; count: number }[];
};
export type ImportSource = 'drawio';
export type ImportReport = {
  source: ImportSource;
  pages: number;
  elements: number;
  notes: ImportNote[];
};
export type PendingImage = {
  tabId: string;
  elementId: string;
  source: { kind: 'data-url'; dataUrl: string } | { kind: 'url'; url: string };
};
export class ReportTally {
  add(kind, count = 1): void;
  name(kind, name): void;
  notes(): ImportNote[];
}
export function describeImportNote(note: ImportNote): string; // the summary copy
export function importSummaryLine(report: ImportReport): string; // "3 pages became 3 tabs, 128 elements"
export function resolvePendingImages(images: PendingImage[]): Promise<{ placed: number }>;

// lib/drawio/import.ts
export type DrawioInput = { kind: 'text'; text: string } | { kind: 'bytes'; bytes: Uint8Array };
export type ImportedPage = {
  tabId: string;
  name: string;
  elements: Element[];
  layers?: Layer[];
  backgroundColor?: string;
};
export function importDrawio(
  input: DrawioInput,
  options: { tabIdForPage: (index: number) => string },
): Promise<DrawioImportResult>;

// lib/import-tab.ts
export type ImportOutcome =
  | { status: 'done'; report?: ImportReport }
  | { status: 'cancelled' }
  | { status: 'error'; error: string };
export function pickFile(accept: string): Promise<File | null>;
```

`notes()` returns only non-zero kinds, in `IMPORT_NOTE_ORDER`; `names` sorted by count descending,
then name, capped at `DRAWIO_REPORT_NAMES_MAX`.

Refusals (the `error` string, final copy):

| Reason                | Copy                                                                                                            |
| --------------------- | --------------------------------------------------------------------------------------------------------------- |
| `too-large`           | "This file is too large to import (the limit is 50 MB)."                                                        |
| `not-xml`             | "This isn't a draw.io file: it isn't XML, a .drawio.png or a .drawio.svg."                                      |
| `not-drawio`          | "This XML isn't a draw.io diagram (expected an mxfile or mxGraphModel)."                                        |
| `no-pages`            | "This draw.io file has no pages."                                                                               |
| `png-without-diagram` | "This PNG has no draw.io diagram inside. In draw.io, export as PNG with 'Include a copy of my diagram' ticked." |
| `svg-without-diagram` | "This SVG has no draw.io diagram inside. In draw.io, export as SVG with 'Include a copy of my diagram' ticked." |
| `page-unreadable`     | "Page '<name>' couldn't be decoded." (`Page <n>` when unnamed)                                                  |
| `unreadable`          | "Couldn't read this draw.io file."                                                                              |

## Data and persistence

- Nothing new is persisted: the output is ordinary `Element`s, `Layer`s and `Tab`s, each passing
  `isValidElement` / `isValidTab`, saved by the existing per-tab storage.
- Image bytes are never written into elements (a data URL in a tab would breach `MAX_TAB_BYTES`);
  they live only in the in-memory pending list for the seam.
- No D11 migration, no api change, no `api-schema` change.
- Undo: the import is one `commitTabs` entry; undo removes the new tabs and restores the active tab.

## Errors and edge cases

| Case                                        | Handling                                                          |
| ------------------------------------------- | ----------------------------------------------------------------- |
| Empty text / only whitespace                | Refused `not-xml` (the dialog's Import button is disabled anyway) |
| A `diagram` with no content                 | An empty page: an empty tab, counted in `pages`                   |
| A cell with no geometry                     | Vertex: skipped, `hidden-skipped` += 1 (D17); edge: fine          |
| Zero or negative width / height             | Clamped to 1                                                      |
| Duplicate cell ids                          | Last one wins in the map; both walk (D18)                         |
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
  read; no markup reaches the canvas.
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
- File picker `accept`: `.drawio,.xml,.svg,.png,application/xml,text/xml,image/svg+xml,image/png`.
- `TextImportPanel.onDone(outcome)`; `ImportTabDialog` closes on `done` without notes, else shows
  `ImportSummary` in place of the panel (the warning banner hides; the header subtitle becomes the
  summary line).
- `ImportSummary`: heading "Imported from draw.io"; summary line from `importSummaryLine`;
  a list, one item per note, `describeImportNote` copy; for `shape-unmatched`, a second line
  listing names `router ×3, switch ×2, …`; a **Done** primary button focused on mount, closing the
  dialog.
- Note copy (`n` the count, singular / plural by `n`):
  - `shape-unmatched`: "n shape(s) had no livediagram match and came in as labelled boxes."
  - `shape-approximated`: "n shape(s) came in as the nearest livediagram shape."
  - `icon-substituted`: "n vendor icon(s) came in as the matching livediagram icon."
  - `image-placeholder`: "n image(s) came in as placeholders. Select one and upload the picture to fill it."
  - `image-unavailable`: "n image(s) link to files outside the diagram and came in as placeholders or were left out."
  - `arrowhead-approximated`: "n connection(s) use arrowheads livediagram doesn't draw; they have the nearest one."
  - `connection-loosened`: "n connection end(s) couldn't stay attached and were left where they were."
  - `label-moved`: "n label(s) were moved inside their shape or merged onto one line."
  - `group-flattened`: "n group(s) were dropped; their shapes kept their places."
  - `hidden-skipped`: "n hidden item(s) were left out."
  - `collapsed-skipped`: "n item(s) inside collapsed containers were left out."
  - `link-dropped`: "n link(s) of a kind livediagram can't follow were dropped."
  - `text-truncated`: "n text(s) were shortened to fit."
  - `content-truncated`: "n page(s) or item(s) beyond the import limits were left out."
- Summary line: single page "Imported n element(s)."; multi-page "p pages became p tabs, n
  element(s)."

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

| Fingerprint                      | Level   | When                                                       |
| -------------------------------- | ------- | ---------------------------------------------------------- |
| `[drawio-import] refused`        | `warn`  | Any refusal: `{ reason, detail? }` (never file content)    |
| `[drawio-import] page`           | `debug` | Each page converted: `{ index, cells, elements, notes }`   |
| `[drawio-import] applied`        | `info`  | The hook applied: `{ pages, elements, notes: kind→count }` |
| `[drawio-import] pending-images` | `info`  | Pending images handed to the seam: `{ count, placed }`     |

## Testing

Unit tests (Vitest), files beside their modules; the DOM ones carry `// @vitest-environment jsdom`.

| Rule (spec)                                           | Test                                                                |
| ----------------------------------------------------- | ------------------------------------------------------------------- |
| Inputs table                                          | `envelope.test.ts`: each input form from the fixtures, each refusal |
| Compressed decode + zip-bomb guard                    | `inflate.test.ts`                                                   |
| PNG chunks (tEXt, zTXt zlib + raw, iTXt, none)        | `png.test.ts`                                                       |
| Style parsing and named styles                        | `style.test.ts`                                                     |
| Colours                                               | `colour.test.ts`                                                    |
| Cell tree, geometry, layers, UserObject, placeholders | `cells.test.ts`                                                     |
| Labels, plain and HTML                                | `label.test.ts`                                                     |
| Shape table, stencils, unmatched                      | `shapes.test.ts`                                                    |
| Vertex properties                                     | `vertex-props.test.ts`                                              |
| Lanes, entities, tables                               | `containers.test.ts`                                                |
| Edges                                                 | `edges.test.ts`                                                     |
| Images, groups, hidden, collapsed, truncation, report | `convert-page.test.ts`                                              |
| Pages to tabs, names, links                           | `import.test.ts`                                                    |
| Every fixture valid + expected report                 | `fixtures.test.ts`                                                  |
| Apply to tabs, one commit                             | `drawio-apply.test.ts`                                              |
| Report tally and copy                                 | `import-report.test.ts`                                             |
| Summary rendering, focus, Done                        | `ImportSummary.test.tsx`                                            |
| Dialog routing (close vs summary)                     | `ImportTabDialog.test.tsx`                                          |

End to end: the live app via PM2, playwright-cli importing every fixture file, screenshots.

## Constants and configuration

| Constant                      | Value                                                                                                                                                       | Provenance / safe range                           |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `DRAWIO_MAX_FILE_BYTES`       | 50 MiB                                                                                                                                                      | Spec; 10 to 200 MiB                               |
| `DRAWIO_MAX_INFLATED_BYTES`   | 100 MiB                                                                                                                                                     | Spec; at least the file limit                     |
| `DRAWIO_MAX_PAGES`            | 100                                                                                                                                                         | Spec; 1 to 500                                    |
| `MAX_ELEMENTS_PER_TAB`        | 10 000                                                                                                                                                      | `@livediagram/diagram` validate.ts                |
| `DRAWIO_DEFAULT_ARC_SIZE`     | 10 (%)                                                                                                                                                      | draw.io's `mxConstants.RECTANGLE_ROUNDING_FACTOR` |
| `DRAWIO_SHADOW`               | `{2, 3, 3, 0.25}`                                                                                                                                           | draw.io's shadow offset (2, 3) and opacity, D19   |
| `DRAWIO_CAPTION_LINE_PX`      | 18                                                                                                                                                          | One `sm` caption line with leading, D20; 14 to 24 |
| `DRAWIO_CAPTION_CHAR_PX`      | 7                                                                                                                                                           | `sm` average glyph width, D20; 6 to 9             |
| `DRAWIO_LABEL_CENTRE_EPSILON` | 0.05                                                                                                                                                        | D21; 0 to 0.2                                     |
| `DRAWIO_REPORT_NAMES_MAX`     | 5                                                                                                                                                           | D22; 3 to 10                                      |
| `DRAWIO_ANGLED_EDGE_STYLES`   | `orthogonalEdgeStyle`, `elbowEdgeStyle`, `entityRelationEdgeStyle`, `segmentEdgeStyle`, `isometricEdgeStyle`, `sideToSideEdgeStyle`, `topToBottomEdgeStyle` | draw.io's `mxEdgeStyle` routers                   |
| `DRAWIO_MARKERS`              | the table in step 12.4                                                                                                                                      | draw.io's marker names                            |

## Assets and external resources

- Fixtures in `apps/live/lib/drawio/__fixtures__/`, authored for this repo (MIT, like the codebase):
  hand-written uncompressed sources using draw.io's own library style strings, plus the forms a
  generator derives from them (compressed `.drawio`, `.drawio.svg`, `.drawio.png` with `tEXt` and
  `zTXt`, a `stress` page). `generate.ts` rebuilds them deterministically
  (`node lib/drawio/__fixtures__/generate.ts`); `README.md` there records provenance and licence.
- No vendor artwork is copied: stencil names are identifiers, and icons render from livediagram's
  own catalogues.
- draw.io's source (Apache 2.0) was read for format facts only; no code is copied.
