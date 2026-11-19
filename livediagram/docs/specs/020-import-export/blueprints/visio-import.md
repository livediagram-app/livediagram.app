# Visio import: blueprint

Derived from [Visio and Lucidchart import](../visio-import.md). The spec decides; this file only adds engineering
precision. Every page is built as the draw.io importer's `DrawioGraph` and converted by its `convertPage`, so
everything after step 5 is [draw.io import's blueprint](drawio-import.md) steps 9 to 18.

Scope, by file (all under `apps/editor/` unless stated):

| File                                                                                                                                                   | Role                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `lib/visio/limits.ts`                                                                                                                                  | The named constants and the picker's filter                                                          |
| `lib/visio/refusals.ts`                                                                                                                                | `VisioRefused`, `visioRefusalMessage`: the named refusals and their copy                             |
| `lib/visio/package.ts`                                                                                                                                 | `sniffVisio`, `openVisioPackage`: the zip, its parts parsed inert under caps, relationships, media   |
| `lib/visio/sheet.ts`                                                                                                                                   | `ShapeSheet`: a shape's cells and section rows with its master's under them; `visioColour`           |
| `lib/visio/masters.ts`                                                                                                                                 | `readMasters`: master id to name and shapes                                                          |
| `lib/visio/master-map.ts`                                                                                                                              | Pure data: the Basic and Flowchart master table, `masterStyle(name)`, `normaliseMasterName`          |
| `lib/visio/geometry.ts`                                                                                                                                | `inferGeometry`: a masterless shape's kind; `routePoints`: a connector's interior vertices           |
| `lib/visio/text.ts`                                                                                                                                    | `shapeText`, `textStyle`: a shape's words and the draw.io style pairs of its first run and paragraph |
| `lib/visio/transform.ts`                                                                                                                               | `Frame`: group coordinates to page pixels                                                            |
| `lib/visio/page.ts`                                                                                                                                    | `visioPageGraph`: one page's shapes and connects to a `DrawioGraph`                                  |
| `lib/visio/import.ts`                                                                                                                                  | `importVisio`: the entry point, same result shape as `importDrawio`                                  |
| `lib/drawio/notes.ts`, `lib/drawio/report.ts`                                                                                                          | The `shape-as-text` kind and its rule                                                                |
| `lib/drawio/files.ts`                                                                                                                                  | A zip among the Explorer's files goes through `importVisio`                                          |
| `hooks/persistence/useTabImport.ts`                                                                                                                    | The `visio` format: the shared multi-page apply (`importPages`), telemetry                           |
| `components/dialogs/ImportTabDialog.tsx`                                                                                                               | The Visio card, its icon label, the file-only panel                                                  |
| `components/dialogs/FileImportPanel.tsx`                                                                                                               | The panel of a binary format: drop target, hint, Choose a File, progress, error                      |
| `components/start/StartImportDialog.tsx`, `useStartImport.tsx`, `VisioSourceIcon` (`packages/explorer/src/library/import-source-icons.tsx`, repo root) | The start screen's Visio row and its original mark                                                   |

## Domain and naming

| Term        | Identifier     | Meaning                                                 |
| ----------- | -------------- | ------------------------------------------------------- |
| Package     | `VisioPackage` | The opened zip: its parts by path, read on demand       |
| Part        | `part(path)`   | One XML entry, parsed inert to its root element         |
| Shape sheet | `ShapeSheet`   | A `<Shape>` with its master's shape beneath it          |
| Master      | `VisioMaster`  | A master's id, universal name and shapes by id          |
| Frame       | `Frame`        | An affine map from a group's coordinates to page pixels |
| Refusal     | `VisioRefused` | A named reason the file is refused, with its message    |

## Behaviour

1. **Entry** (`importVisio(bytes, { tabIdForPage })`): refuse over `VISIO_MAX_FILE_BYTES`. `sniffVisio`: `PK\x03\x04`
   is a zip; `D0 CF 11 E0` an OLE file (`vsd`); text starting `<` (after a BOM and whitespace, first 4 KB) holding
   `VisioDocument` is a `vdx`; anything else `not-visio`. Every refusal is caught once and returned with its message;
   any other error is `unreadable`, logged `[visio-import] refused`.
2. **Package** (`openVisioPackage`): `listZip`; more than `VISIO_MAX_ZIP_ENTRIES` entries, or a damaged zip, is
   `damaged`. Entries by name (backslashes to slashes, leading slash dropped). No `visio/pages/pages.xml`:
   `not-visio`. `part(path)`: an entry whose declared size exceeds `VISIO_MAX_PART_BYTES` is `too-large`; it is read
   through `readZipEntry` under one `ByteBudget(VISIO_MAX_INFLATED_BYTES)` (over budget: `too-large`), decoded UTF-8,
   parsed with `parseInert(text, 'application/xml')`; a `parsererror` is `damaged`; more than
   `VISIO_MAX_XML_ELEMENTS` elements is `too-large`. `rels(path)`: the part's `_rels/<name>.rels`, `Id` to the target
   resolved against the part's folder (`..` and `.` segments folded; a target leaving the package is dropped).
   `bytes(path)` reads a media entry under the same budget.
3. **Masters** (`readMasters`): `visio/masters/masters.xml` (absent: none). The first `VISIO_MAX_MASTERS` `<Master>`
   elements: id, `NameU` (else `Name`), and the master part through the rels: its `<Shapes>` shapes by id, depth first,
   and its top shape (the first top-level `<Shape>`). The colour table is `visio/document.xml`'s `<Colors>` rows
   (`IX` to `RGB`).
4. **Pages**: `visio/pages/pages.xml` `<Page>` elements in order (none: `no-pages`); the first `DRAWIO_MAX_PAGES`, the
   rest counted `content-truncated`. Each: `Name` (else `NameU`), `PageHeight` from its `PageSheet` (default 11), the
   page part through `<Rel r:id>` and the pages rels. A page whose part is missing is an empty page.
5. **Page graph** (`visioPageGraph`): the draw.io root (`0`) and layer (`1`) cells, then a depth-first walk of
   `PageContents > Shapes > Shape` in document order with a `Frame` (the page's: x × 96, (height − y) × 96). For each
   shape, its `ShapeSheet` (own element, master shape: `MasterShape` within the enclosing instance's master, else the
   shape's own `Master`'s top shape):
   - Past `MAX_ELEMENTS_PER_TAB` shapes, or deeper than `VISIO_MAX_GROUP_DEPTH`: counted `content-truncated`, subtree
     skipped.
   - **1-D** (`BeginX` and `EndX` both resolve): an edge cell, finished after the walk once glue is known.
   - **Foreign** (`Type="Foreign"`): an image vertex (below).
   - **2-D**: the master's name through `masterStyle`; a hit builds the vertex with that style, tallies
     `shape-approximated` when the row says so, and skips the shape's sub-shapes, recording each sub-shape id as an
     alias of this one. A miss on a shape with a master: a text box, tallied `shape-as-text` and named. No master:
     `inferGeometry` (`ellipse`, `rect`, `rounded`, `diamond`, `text`, `none`); `none` without text is skipped, with
     text a text box; any other unmatched geometry a text box named "Shape".
   - **Group** (`Type="Group"`) not consumed: its own vertex when it has text or visible geometry, else tallied
     `group-flattened`; then its `<Shapes>` with the child frame.
     Vertex box: centre = `frame(pin + R(angle)·(w/2 − locPinX, h/2 − locPinY))`; width and height × 96 × frame scale;
     rotation = −(angle + frame angle) in degrees, normalised to [0, 360); `flipH` / `flipV` from `FlipX` / `FlipY`.
     Style pairs: the named style, `whiteSpace=wrap`, `html=0`, fill (`fillColor` from `FillForegnd` unless
     `FillPattern` 0 or `FillForegndTrans` ≥ 1, then `none`), line (`strokeColor`, `none` for `LinePattern` 0,
     `dashed=1` with a dot `dashPattern=1 2` for 3, `dashed=1` for others above 1, `strokeWidth` px), `rounded=1;
absoluteArcSize=1;arcSize=px` for `Rounding` > 0, and `textStyle`. Values are `encodeURIComponent`-free: a value
     holding `;` or `=` is dropped (a font name never does in practice). Text boxes take `text` with `align` and
     `verticalAlign` always set (Visio's centre / middle defaults).
     **Edges**, after the walk: `Connect` rows with `FromCell` `BeginX` / `EndX` map the connector's ends to `ToSheet`,
     through the alias map; an end on a shape that did not become a cell stays free. Geometry: `relative`, `sourcePoint`
     and `targetPoint` from the frame-mapped begin and end, `points` from `routePoints` (each geometry row's `X`, `Y` in the
     connector's local frame, minus the first and last), `curved=1` when a row is `ArcTo`, `EllipticalArcTo`, `NURBSTo`,
     `SplineStart` or `SplineKnot`. Heads: `BeginArrow` / `EndArrow` to `startArrow` / `endArrow` with `startFill` /
     `endFill` (spec table), an unknown index tallied `arrowhead-approximated`. Label: the connector's text with its
     `textStyle`.
     **Images**: the foreign shape's `ForeignData > Rel r:id` through the page rels; a raster extension
     (`png`, `jpg`, `jpeg`, `gif`, `bmp`, `webp`) under `VISIO_MAX_IMAGE_BYTES` becomes `shape=image;image=data:<type>,
<base64>` (draw.io's form, read by `requestDataUrlImage`); anything else `shape=image;image=unavailable`, which the
     converter counts as `image-unavailable`.
6. **Convert**: `convertPage(graph, { tally, pageIdToTab, images, imageKeys })` per page, yielding to the event loop
   between pages, exactly as `importDrawio`. The result: `{ ok, pages, images, report, meta: {} }`.
7. **Apply**: the hook's draw.io path, generalised as `importPages(read, telemetryType, onProgress)`:
   images through one pipeline pass, `applyDrawioPages` in one `commitTabs`, `track('Tab', 'Imported', 'Visio')`,
   `drawioOutcome`.

## Interfaces and contracts

```ts
importVisio(bytes: Uint8Array<ArrayBuffer>, options: { tabIdForPage(index: number): string }): Promise<
  | { ok: true; pages: ImportedPage[]; images: ImportImageRequest[]; report: DrawioReport; meta: DrawioMeta }
  | { ok: false; error: string }
>;
sniffVisio(bytes: Uint8Array): 'vsdx' | 'vsd' | 'vdx' | null;
```

Refusal reasons: `too-large`, `too-large-unpacked`, `vsd`, `vdx`, `not-visio`, `damaged`, `no-pages`, `unreadable`.

## Data and persistence

Nothing is stored beyond what the draw.io apply stores. Ids are draw.io's re-minted ids.

## Errors and edge cases

Non-finite or missing numbers read as 0 (widths and heights as 0, which `convertPage` clamps to 1). A `Connect` to an
unknown sheet leaves the end free. A connector with fewer than two distinct points is still an edge (draw.io draws a
point). A master id the masters part does not list behaves as no master. Duplicate shape ids: the later wins in the
alias map; cell ids are the walk's own (`v<n>`), so they never collide.

## Security and trust

The zip and every part are untrusted. Only `zip-reader.ts` reads the bytes (bounds-checked offsets, no zip64, budgeted
inflation). XML only through `parseInert`, which resolves no external entity and renders nothing. Relationship targets
are resolved inside the package; an external (`TargetMode="External"`) target is never fetched. Text becomes element
labels, rendered as text. No regex with nested or adjacent repeats: names and numbers are read with `trim`, `split` and
`Number`.

## Performance and limits

Each part is parsed once; a page is one walk with maps by id (shapes, aliases, connects), so the page is linear in its
shapes. The worst case the caps allow, a page of 10 000 shapes and 5 000 glued connectors, is pinned by a CPU-time test
(`cpuMsOf`, `cpuBudgetMs`). The module loads only when the Visio card, its start row or an Explorer zip needs it.

## Presentation and UX

The card, panel and start row copy as in the spec. `FileImportPanel` reuses `ImportDropZone`, `BackBar` and `Button`.

## Accessibility

The drop target is the shared button; the error is the shared `role="alert"`; progress is `aria-live="polite"`, as the
text panel's.

## Observability

`[visio-import] refused { reason }`, `[visio-import] page { index, shapes, elements }` (debug), `Tab·Imported·Visio`.

## Testing

`lib/visio/*.test.ts` (jsdom; packages built in code with `zip-writer-fixture.ts`, no binaries): sniffing and every
refusal, the caps (entries, part size, budget, pages, shapes, depth), masters and inheritance, every master-table row,
masterless geometry, text boxes and their report names, groups (consumed, drawn, flattened, nested frames), rotation and
flips, colours (hex, index, document table, theme), lines and fills, text style, connectors (glue, aliases, free ends,
waypoints, curves, heads), images (raster, metafile, oversize), multi-page apply, and the CPU-time worst case.

## Constants and configuration

`VISIO_MAX_FILE_BYTES` 50 MiB, `VISIO_MAX_INFLATED_BYTES` 100 MiB, `VISIO_MAX_PART_BYTES` 20 MiB,
`VISIO_MAX_ZIP_ENTRIES` 10 000, `VISIO_MAX_XML_ELEMENTS` 400 000, `VISIO_MAX_MASTERS` 2 000, `VISIO_MAX_GROUP_DEPTH`
32, `VISIO_MAX_IMAGE_BYTES` 10 MiB, `VISIO_MAX_TEXT` 5 000, `VISIO_PX_PER_INCH` 96, `VISIO_DEFAULT_PAGE_HEIGHT_IN` 11.

## Defaults ledger

V1 to V4 in [DEFAULTS.md](DEFAULTS.md).
