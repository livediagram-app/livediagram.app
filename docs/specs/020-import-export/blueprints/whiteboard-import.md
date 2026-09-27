# Microsoft Whiteboard import: blueprint

Derived from [Microsoft Whiteboard import](../whiteboard-import.md), on the stages of
[Board import](../board-import.md). The spec decides; this file adds engineering precision. Defaults
applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and cited as `Dn`. Markup
facts carry their evidence: **E-5** (read from Whiteboard's shipped bundle) or **E-C1** (confirmed
from real exports). A row marked _pending E-C1_ is not built until a real export shows the markup.

Scope, by file (all under `apps/live/` unless stated):

| File                                                | Role                                                                                      |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `lib/board-import/whiteboard/limits.ts`             | Named constants of this blueprint                                                         |
| `lib/board-import/whiteboard/refusals.ts`           | `WhiteboardRefusal`, `refusalMessage`: the named rejections and their copy                |
| `lib/board-import/whiteboard/zip.ts`                | `readZip`: central directory, stored and deflated entries, byte budget                    |
| `lib/board-import/whiteboard/envelope.ts`           | `readWhiteboardFile`: sniff Zip / HTML / picture, find the board                          |
| `lib/board-import/whiteboard/matrix.ts`             | `Matrix`, `parseCssTransform`, `parseSvgTransform`, `compose`, `apply`                    |
| `packages/diagram/src/svg-path-outline.ts`          | `flattenSvgPath`: SVG path data to polylines, shared with shape outlines                  |
| `lib/board-import/whiteboard/colour.ts`             | `readColour`: `rgba()` / `rgb()` / hex / named to `{ hex, alpha }`                        |
| `lib/board-import/whiteboard/placement.ts`          | `anchorMatrix`, `innerMatrix`, `inlineStyle`, `px`: markup to board px                    |
| `lib/board-import/whiteboard/canvas.ts`             | `readBoard`, `isWhiteboardCanvas`: the canvas root, anchors in stacking order, background |
| `lib/board-import/whiteboard/ink.ts`                | `readInk`: strokes of one ink anchor, centreline or outline, width, pen                   |
| `lib/board-import/whiteboard/items.ts`              | `readItem`: notes, text, shapes, connectors, images, reactions (E-C1)                     |
| `lib/board-import/whiteboard/fit.ts`                | `fitToTab`: the tab budget loop over the shared `simplifyPolyline`                        |
| `lib/board-import/whiteboard/convert.ts`            | `convertBoard`: board to elements and stroke drafts, per-kind tally                       |
| `lib/board-import/whiteboard/import.ts`             | `importWhiteboard`: the entry point                                                       |
| `lib/fnv1a.ts`                                      | `fnv1a32`: the hash behind `sourceId` (shared with `identity.ts`)                         |
| `lib/board-import/whiteboard/__fixtures__/`         | Fixtures and their generator                                                              |
| `lib/board-import/whiteboard/test-support.ts`       | DOM test helpers: a board document from markup, fixture bytes                             |
| `hooks/persistence/useTabImport.ts`                 | The `whiteboard` format: bytes in, a new whiteboard tab in one commit, telemetry, log     |
| `components/dialogs/ImportTabDialog.tsx`            | The Microsoft Whiteboard card (file only) and its report                                  |
| `apps/help/app/…/import-from-microsoft-whiteboard/` | The help article                                                                          |
| `e2e/whiteboard-import.spec.ts`                     | Fixtures through the real dialog on the production build, persistence and undo            |

The shared image pipeline (`lib/import-images/`, [import image pipeline](../import-image-pipeline.md))
and the shared import report (`lib/import-report.ts`, [draw.io import](../drawio-import.md) "The
import report") are adopted when they reach `main`; this importer defines no image or report
machinery of its own.

## Domain and naming

| Term            | Identifier          | Meaning                                                                                              |
| --------------- | ------------------- | ---------------------------------------------------------------------------------------------------- |
| Whiteboard file | `WhiteboardFile`    | What the envelope found: `{ route: 'board', title, html, comments }` or `{ route: 'picture', blob }` |
| Board           | `WhiteboardBoard`   | `{ title, items: BoardItem[], background }` read from one HTML document                              |
| Board item      | `BoardItem`         | One anchor: `{ id, kind, schema, placement, node }`                                                  |
| Item kind       | `BoardItemKind`     | The anchor's `data-whiteboard-type`, or the schema the content reveals (below)                       |
| Placement       | `Placement`         | The anchor's board matrix: `left` / `top` then its CSS `transform`                                   |
| Ink stroke      | `InkStroke`         | `{ outline: Point[][]; centreline: Point[] \| null; widthPx; colour: { hex, alpha }; pen; effect }`  |
| Stroke draft    | `StrokeDraft`       | `{ raw: Point[]; closed; props }`: a stroke before the fit stage simplifies and builds it            |
| Tally           | `WhiteboardTally`   | `{ rows: { kind, imported, degraded: { reason: n }, skipped }[] }`, one row per kind                 |
| Pen             | `InkPen`            | `'pen'` or `'highlighter'`                                                                           |
| Board px        | (unit)              | A CSS pixel of the board; one board px is one canvas unit                                            |
| Source id       | `sourceId`          | `mswb:<title>:<hash>`, the hash an FNV-1a of the sorted item ids                                     |
| Refusal         | `WhiteboardRefusal` | A named rejection (Errors)                                                                           |

Banned synonyms: "page" (a board is one canvas), "drawing" for a single stroke (a Whiteboard
"Drawing" is an ink group), "sticky" for the Whiteboard item (it is a **note**; the livediagram
element is a **sticky**).

## Behaviour

### 1. Entry

`importWhiteboard(file: { name: string; bytes: Uint8Array<ArrayBuffer> }) => Promise<WhiteboardImportResult>`:

1. `bytes.length > WHITEBOARD_MAX_FILE_BYTES` → refuse `too-large`.
2. `readWhiteboardFile(file)` → a `WhiteboardFile` or a refusal.
3. Picture route: result `{ ok: true, route: 'picture', title, blob, mimeType }`.
4. Board route: `readBoard(doc)`, then `convertBoard(board)`, then `fitToTab(items)`.
5. Result `{ ok: true, route: 'board', title, sourceId, elements, tally, simplified, backgroundColor? }`;
   `simplified` is true when the fit took more than one round. Image requests and comments join
   the result with E-C1.

Never throws: an exception inside is caught, logged, and refused as `unreadable`.

### 2. Envelope (`readWhiteboardFile`)

Sniff the first bytes, never the name:

- `50 4B 03 04` or `50 4B 05 06` (Zip) → `readZip`. Candidate entries: names ending `.html`
  (case-insensitive), not under `__MACOSX/`. Each candidate is decoded (UTF-8) and kept when it
  holds a Whiteboard canvas (below). None → refuse `not-whiteboard`; more than one →
  refuse `several-boards`. The comments entry is `<stem>-comments.json` beside it; absent or not
  JSON → `comments: null` (no refusal; comments are optional).
- PNG (`89 50 4E 47`), JPEG (`FF D8 FF`), WebP (`RIFF….WEBP`) → picture route.
- Otherwise decode as UTF-8; a Whiteboard canvas → board route with `comments: null`; anything
  else → refuse `not-whiteboard`.

A **Whiteboard canvas** is a document with an element whose class list contains `canvasContent`
and at least one descendant with class `canvasChildElement` (E-5). An empty canvas (no
`canvasChildElement`) is refused `empty-board`.

`title`: the HTML entry's base name without `.html`; for a bare HTML or picture, the file name
without its extension; empty → `Whiteboard` (D40).

### 3. Zip (`readZip`)

- Find the end-of-central-directory record: scan back from the end, at most 65,557 bytes, for
  `50 4B 05 06`. Missing → refuse `zip-damaged`.
- Zip64 markers (`0xFFFFFFFF` sizes or offsets) → refuse `zip-damaged` (Whiteboard never writes
  them; its files are far below 4 GB).
- Walk the central directory: per entry the general-purpose flag, method, sizes, name (UTF-8 when
  flag bit 11, else CP437 read as Latin-1), local-header offset.
- Flag bit 0 (encrypted) on a candidate → refuse `zip-encrypted`.
- Method 0 (stored, what Whiteboard writes, E-5): the bytes as they are. Method 8 (deflate, a
  user's re-zip): `DecompressionStream('deflate-raw')` with the import's `ByteBudget`. Any other
  method on a candidate → refuse `zip-damaged`.
- Only candidate entries and their comments entries are read; other entries are never inflated.
- The byte budget (`WHITEBOARD_MAX_INFLATED_BYTES`) spans the whole import: exceeding it refuses
  `too-large`.

### 4. Board (`readBoard`)

1. `new DOMParser().parseFromString(html, 'text/html')`. Scripts never run (DOMParser), and no
   resource loads: the document is never attached.
2. Root: the first `.canvasContent`. Anchors: every `.canvasChildElement` in document order, which
   is Whiteboard's stacking order (later is on top, E-5). An anchor nested inside another anchor is
   read by its parent's reader, not as a board item (_pending E-C1_: note grids, lists).
3. Per anchor: `id` = `data-apikey`, else the inner `.canvasChild`'s `id`, else `item-<n>`;
   `kind` = `data-whiteboard-type` (may be absent); `placement` = the anchor matrix (§5).
4. Background: `.canvasBackground` (E-5) is removed by the export and re-emitted as
   `svg.canvasBackground`; its first `rect` `fill` is the board colour. Missing → none.
5. Items off to the side need no special case: the clone holds every mounted child (_pending E-C1_:
   whether unmounted off-screen items are missing, which the report cannot know).

### 5. Placement

- An element's matrix is `translate(left, top) · T`, where `left` / `top` are the style's px values
  (absent = 0) and `T` the style's `transform` (identity when absent). Transform origin is `0 0`
  (the anchor's `align` class, E-5; confirmed from the export's own `<style>` in E-C1).
- `parseCssTransform` accepts `matrix(a, b, c, d, e, f)`, `translate(x[px], y[px])`,
  `translateX/Y`, `scale(s[, t])`, `rotate(θdeg|rad|turn)`, space-separated and composed left to
  right. Any other function → identity for that function, logged once per import (`unknown-transform`).
- Inside an item, positions compose down the tree: each descendant with `position: absolute`
  contributes its `left` / `top`; each CSS `transform` and SVG `transform` attribute composes; an
  `svg` with a `viewBox` and explicit `width` / `height` contributes the viewBox scale and offset.
- A point's board position is `apply(anchorMatrix · innerMatrix, p)`.
- Rotation: `θ = atan2(b, a)` of the composed matrix, in degrees, normalised to (−180, 180];
  livediagram elements carry it as `rotation` about their centre, so a rotated box's centre is
  mapped, then width and height are scaled by `hypot(a, b)` and `hypot(c, d)`. Ink ignores
  `rotation`: its points are mapped, so it is always axis-aligned.

### 6. Ink (`readInk`)

Per `g.inkStroke` inside the anchor (E-5):

- `outline`: every `path` `d` flattened (`flattenSvgPath`, curves at `WHITEBOARD_BEZIER_STEP_PX`),
  mapped to board px.
- `centreline`: the sibling `polyline.inkHitTestOverlay` `points`, mapped; empty or absent → null.
- `colour`, `alpha`: the last `path`'s `fill` (`rgba(r,g,b,a)`, E-5); a `url(#…)` pattern fill
  (galaxy, rainbow and other effect pens) → the pattern's first `image` or `use` colour is not
  recoverable: black at the path's `opacity`, degraded `effect-pen` (D41).
- `pen`: `'highlighter'` when the `g` style has `mix-blend-mode: darken`, else `'pen'` (E-5).
- `widthPx`: with a centreline, `area(outline) / length(centreline)` (polygon area by the shoelace
  formula, summed over sub-paths), clamped to `[WHITEBOARD_MIN_WIDTH_PX, WHITEBOARD_MAX_WIDTH_PX]`.
  Without one, `2 · area / perimeter` of the outline (a thin shape's width).

Element per stroke:

- **Centreline known** → `freehand`, `closed: false`, points the simplified centreline (§8),
  `strokeColor` the hex, `opacity` the alpha when below 1. Pen: `strokeWidth` the nearest
  `BORDER_STROKE_PX` preset (ties to the thinner, D42); `widthPx` above
  `WHITEBOARD_CLAMP_WARN_PX` → degraded `width-clamped`. Highlighter: `pen: 'highlighter'`,
  `penWidth` = `round(widthPx)` clamped to 1..100.
- **Centreline unknown** → `freehand`, `closed: true`, `straightEdges: true`, points the simplified
  outline, `fillColor` and `strokeColor` the hex, `strokeWidth: 'thin'`, degraded `ink-outline`.
  A multi-sub-path outline (a stroke crossing itself) becomes one element per sub-path.

_Pending E-C1 and the operator's call (spec open question 4): whether pens keep pixel widths via a
generalised `penWidth`, and whether the outline route is acceptable or centrelines should be
derived from outlines._

### 7. Other items (`readItem`)

| Item            | Recognised by                                             | Status                                                |
| --------------- | --------------------------------------------------------- | ----------------------------------------------------- |
| Ink group       | contains `g.inkStroke`                                    | E-5                                                   |
| Ink shape kind  | ink group's accessible name, `Canvas.Entity.InkShapes.*`  | pending E-C1                                          |
| Note            | `data-whiteboard-type="Note"`                             | pending E-C1                                          |
| Note grid       | schema `ListContainer`, subtype `GridList`                | pending E-C1                                          |
| Text            | `data-whiteboard-type="PlainText"`, schema `TextBox`      | pending E-C1                                          |
| Shape with text | `data-whiteboard-type="Shape"`, schema `ShapeWithTextBox` | pending E-C1                                          |
| Connector       | schema `Connector`                                        | pending E-C1                                          |
| Image           | an `img` with a `data:` `src`                             | pending E-C1                                          |
| Reaction        | schema `Image`, subtype `ReactionStickers`                | pending E-C1                                          |
| Link preview    | schema `PreviewCard`                                      | pending E-C1                                          |
| Loop, app frame | the export's placeholder markup                           | pending E-C1                                          |
| Anything else   | —                                                         | skipped, named by `data-whiteboard-type` or `unknown` |

### 8. Simplify and fit (`fit.ts`)

- `simplifyPolyline(points, tolerancePx)` is the shared Ramer-Douglas-Peucker of
  `packages/diagram/src/polyline.ts` (iterative, endpoints kept).
- Freehand points are normalised to the element's box and rounded to `WHITEBOARD_POINT_DECIMALS`.
- `fitToTab(elements)`: tolerance starts at `WHITEBOARD_SIMPLIFY_TOLERANCE_PX`; while
  `JSON.stringify` of the elements exceeds `WHITEBOARD_TAB_BYTES_BUDGET`, multiply the tolerance by
  `WHITEBOARD_SIMPLIFY_GROWTH` and re-simplify from the original points, at most
  `WHITEBOARD_SIMPLIFY_ROUNDS` times. Any round past the first adds degraded `ink-simplified` for
  every stroke. Still over budget, or more than `MAX_ELEMENTS_PER_TAB` elements → refuse
  `board-too-large`.

### 9. Convert (`convertBoard`)

- Walk items in order; an anchor holding `g.inkStroke` is read as ink, any other kind is skipped
  and counted under its `data-whiteboard-type` (`unknown` when absent) until its reader lands
  (E-C1). Each reader returns elements or stroke drafts and tally entries.
- Translate every element and draft by `(−minX, −minY)` of their top-left corners (draft points,
  element `x` / `y`), rounded to whole px. Every element the converter makes is boxed
  (`BoxedElement`); arrows join with connectors (E-C1).
- Ids are minted fresh (`crypto.randomUUID()`); a map from item id to element id lets connectors
  and comments find their item.
- Images become `image` elements with `imageId: null` plus an image request `{ elementId, key,
source: { kind: 'data-url', dataUrl }, hint }`, key an FNV-1a hash of the data URL
  (identical pictures share a key, the pipeline stores them once).
- Background: `backgroundColor` = the board colour hex, when not white (D43).

### 10. Commit (`useTabImport`)

Not a replace: the `whiteboard` format never calls `replaceActiveTabContent`. Sequence: pick a file
(`.zip,.html,.htm,.png,.jpg,.jpeg,.webp`), read its bytes, `importWhiteboard`, store images through
the shared pipeline (on adoption), then commit the new tab, select nothing, open the new tab, request
a fit, `track`, log `applied`. A refusal returns `{ status: 'error', error }` and commits nothing. A
locked active tab does not block the import (nothing on it changes).

## Interfaces and contracts

```ts
type WhiteboardImportResult =
  | {
      ok: true;
      route: 'board';
      title: string;
      sourceId: string;
      elements: Element[];
      tally: WhiteboardTally;
      simplified: boolean;
      backgroundColor?: string;
    }
  | { ok: true; route: 'picture'; title: string; blob: Blob; mimeType: AcceptedImageType }
  | { ok: false; refusal: WhiteboardRefusal; error: string };
```

- Every returned element passes `isValidElement` (`packages/diagram/src/validate.ts`); a unit test
  holds this over every fixture.
- On adoption of the shared pipeline and report, image requests are `ImportImageRequest`s and the
  tally maps onto `ImportReport`: its `source` gains `'microsoft-whiteboard'` and its note kinds
  gain `ink-outline`, `ink-simplified`, `width-clamped`, `effect-pen`, `item-skipped` (with
  names), `comment-unanchored`.

## Data and persistence

- Nothing is persisted by the importer; the commit goes through `commitTabs` like every import.
- The import adds a tab `{ id: crypto.randomUUID(), name: title, kind: 'whiteboard', elements,
backgroundColor? }`, spliced in right after the active tab, in **one** `commitTabs` call (one undo
  step). The new tab is marked loaded (the per-tab loader must not fetch it) and made active; the
  active tab is untouched. `tabKindOf` reads `'whiteboard'` (`packages/diagram/src/tab-kind.ts`).
- Picture route: the same new tab holding one `image` element at the origin, sized to the picture.
- Comment threads are written on the anchored element with `authorName` from the comments file,
  `authorColor` a fixed neutral (D44), no `authorId`, `createdAt` from the file or the import time.
  Email fields are never read.

## Errors and edge cases

| Refusal           | When                                               | Copy                                                                                             |
| ----------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `too-large`       | file or inflated bytes past the limits             | "This file is too large to import (over 200 MB)."                                                |
| `not-whiteboard`  | no Whiteboard canvas and not a picture             | "This isn't a Microsoft Whiteboard export. Choose the Zip from Export, Full export, or the PNG." |
| `several-boards`  | more than one board HTML in a Zip                  | "This Zip holds more than one board. Import them one at a time."                                 |
| `zip-damaged`     | no EOCD, Zip64, unknown method, truncated entry    | "This Zip is damaged. Export the board again."                                                   |
| `zip-encrypted`   | encrypted candidate entry                          | "This Zip is password-protected. Unzip it and import the .html file inside."                     |
| `empty-board`     | a canvas with no items                             | "This board is empty."                                                                           |
| `board-too-large` | over the tab's element or byte limit after fitting | "This board is too big for one tab. Import its PNG instead."                                     |
| `unreadable`      | any unexpected exception                           | "This file couldn't be read."                                                                    |

Edge cases with their handling: a stroke with fewer than two distinct points becomes a dot (a
two-point `freehand` of length `widthPx`); a zero-area outline is skipped and counted; `NaN` in
path data ends that sub-path; duplicate `data-apikey` values: the last wins the id map, both items
are imported; a comment on a skipped item counts `comment-unanchored`.

## Security and trust

- Input is untrusted. HTML is parsed, never attached, never rendered; no `script`, `iframe`,
  `style` or `on*` attribute survives into elements (only text content and numbers are read).
- Text is read with `textContent`; URLs (link previews) must be `http:` or `https:`, else dropped
  and counted.
- The Zip reader bounds every offset against the buffer and inflates only candidate entries under
  a shared budget (zip bombs).
- Data URLs go to the image pipeline, which sniffs bytes and caps sizes; nothing is fetched from
  the network.

## Performance and limits

- Worst case accepted: a 200 MB Zip (stored), parsed once. DOMParser on a ~50 MB HTML with
  inlined images takes seconds on a laptop; the dialog shows a busy state (§ Presentation).
- Tab budget: `WHITEBOARD_TAB_BYTES_BUDGET` leaves headroom under `MAX_TAB_BYTES` for layers and
  metadata; a freehand point costs about 25 bytes of JSON at 4 decimals.
- Parsing runs on the main thread in v1 (D45); the stages are pure so a Worker can host them later.

## Presentation and UX

- Card: title **Microsoft Whiteboard**, description "A board exported from Microsoft Whiteboard:
  the Full export Zip, or its PNG. Adds a whiteboard tab with ink, notes, text, shapes and images
  kept editable.", file only, icon label `mswb`.
- The replace warning is not shown for this card; its panel instead says "Adds a new whiteboard tab
  named after the board. Your current tab stays as it is."
- While importing: the card's panel shows "Reading the board…" then "Storing images (n of m)…",
  in space reserved before the import starts.
- Result: the shared import summary; for the picture route the line from the spec.
- Errors: inline in the panel, the refusal copy above.

## Accessibility

- The card is a `button` with its title as the accessible name; progress is an `aria-live="polite"`
  status; the summary's Done button takes focus (shared summary).

## Web Experience

- The importer is lazy-loaded when the card is used; nothing lands in the editor's first bundle
  (LCP unaffected). Long parses yield to the event loop between items (`WHITEBOARD_YIELD_EVERY`
  items) so the dialog stays responsive (INP). The reserved panel space keeps CLS at zero.

## Observability

Fingerprint `[whiteboard-import]`, `console.info` for decisions, `console.warn` for failures:
`envelope` (route, entry count, bytes), `refused` (refusal, detail), `board` (item counts by kind),
`unknown-transform`, `fit` (rounds, bytes), `applied` (elements, notes, images). Never content.

## Testing

- Unit (node, jsdom where DOM is needed): zip (stored, deflated, encrypted, damaged, Zip64,
  `__MACOSX`), envelope sniffing, matrix parsing and composition, path flattening, colour, ink
  width estimate against synthetic strokes of known width, outline fallback, simplify and fit,
  every refusal, every fixture's elements valid.
- Fixtures: `__fixtures__/generate.ts` writes synthesised exports mimicking E-5 (stored Zip, HTML
  wrapper, anchors, ink groups); real exports join once the operator permits.
- e2e: the fixtures through the real dialog on the production build, reload persistence, undo.

## Constants and configuration

| Constant                           | Value   | Provenance and safe range                                 |
| ---------------------------------- | ------- | --------------------------------------------------------- |
| `WHITEBOARD_MAX_FILE_BYTES`        | 200 MiB | high-resolution boards with photos; 50 to 500 MiB         |
| `WHITEBOARD_MAX_INFLATED_BYTES`    | 400 MiB | twice the file cap, zip-bomb guard; ≥ file cap            |
| `WHITEBOARD_BEZIER_STEP_PX`        | 2       | sub-pixel fidelity at 100 %; 1 to 4                       |
| `WHITEBOARD_MIN_WIDTH_PX`          | 0.5     | thinnest visible stroke; 0.25 to 1                        |
| `WHITEBOARD_MAX_WIDTH_PX`          | 100     | `penWidth` validator's upper bound                        |
| `WHITEBOARD_CLAMP_WARN_PX`         | 9       | `extra-thick` (7 px) plus a tolerance; 7 to 12            |
| `WHITEBOARD_POINT_DECIMALS`        | 4       | 0.2 px on a 2,000 px stroke; 3 to 5                       |
| `WHITEBOARD_SIMPLIFY_TOLERANCE_PX` | 0.35    | invisible at 100 %; 0.2 to 0.5                            |
| `WHITEBOARD_SIMPLIFY_GROWTH`       | 1.6     | reaches 4 px in six rounds; 1.3 to 2                      |
| `WHITEBOARD_SIMPLIFY_ROUNDS`       | 6       | bounds the loop; 3 to 10                                  |
| `WHITEBOARD_TAB_BYTES_BUDGET`      | 3.5 MiB | `MAX_TAB_BYTES` (4 MiB) less headroom; must stay below it |
| `WHITEBOARD_YIELD_EVERY`           | 200     | items between yields; 50 to 1,000                         |

## Assets and external resources

- Fixtures are synthesised by `generate.ts` (MIT, this repo). Real exports are committed only with
  the operator's permission, noted in `__fixtures__/README.md` with their origin.
- No third-party code: the Zip reader and path flattener are this repo's; `DecompressionStream` is
  the platform's.
