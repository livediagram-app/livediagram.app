# Board scene: blueprint

Derived from [Board scene](../board-scene.md), with the element-model delta it needs from
[Whiteboard](../../023-whiteboard/whiteboard.md) "Imported and pasted content". The spec's mapping
table is not restated; this file fixes the modules, types, constants, algorithms, wiring and tests.
Defaults are ledgered in [DEFAULTS.md](DEFAULTS.md) (rows `B1` onwards).

Scope, by file:

| File                                                                      | Role                                                                                              |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `apps/live/lib/board-scene/scene.ts`                                      | The contract: scene types only                                                                    |
| `apps/live/lib/board-scene/colour.ts`                                     | `createColourResolver`, fields per role, `resolveFill`, `resolveStickyFill`, the colour constants |
| `apps/live/lib/board-scene/context.ts`                                    | `LandContext`: the memoised resolver and the landing's own rules (`LANDING_RULES`)                |
| `apps/live/lib/board-scene/common.ts`                                     | rotation, lock, safe link, opacity; `boxOfPoints`, `limitPoints`, `turnPoints`, `endsMeet`        |
| `apps/live/lib/board-scene/test-scenes.ts`                                | Typed scene builders for tests (synthesised content)                                              |
| `apps/live/lib/board-scene/width.ts`                                      | `markerWidthPx`, `borderStrokeOf`, `arrowWidthPx`                                                 |
| `apps/live/lib/board-scene/text.ts`                                       | `textBoxFields`, `labelFields`, the font table                                                    |
| `apps/live/lib/board-scene/land-marks.ts`                                 | ink, polyline (whiteboard profile)                                                                |
| `apps/live/lib/board-scene/land-boxes.ts`                                 | shape, text, sticky, image, frame (whiteboard profile)                                            |
| `apps/live/lib/board-scene/land-connectors.ts`                            | connector and headed polyline to an arrow (both profiles)                                         |
| `apps/live/lib/board-scene/land-diagram.ts`                               | the diagram profile's per-kind mapping                                                            |
| `apps/live/lib/board-scene/placement.ts`                                  | `sceneBounds`, `placementOffset`                                                                  |
| `apps/live/lib/board-scene/report.ts`                                     | `BoardSceneReport`, `mergeNotes`, the copy per landed kind                                        |
| `apps/live/lib/board-scene/land.ts`                                       | `landBoardScene`: validation, limits, ordering, ids, tab patch, logging                           |
| `apps/live/lib/board-scene/attach.ts`                                     | `sceneImageSource`: a `SceneAsset` as an `ImportImageSource`                                      |
| `apps/live/hooks/canvas/useBoardSceneInsert.ts`                           | Paste / drop: land at a point, images, one commit, select, notice state                           |
| `apps/live/lib/board-scene-import.ts`                                     | `importBoardsAsDocuments`, `finishLanding`: the new-document target, editor-free                  |
| `apps/live/hooks/persistence/useBoardSceneImport.ts`                      | Import commit paths: replace-tab, new-document                                                    |
| `apps/live/lib/board-scene-hug.ts`                                        | `hugLandedText`, `landedTextFonts`: re-hugs landed text boxes                                     |
| `apps/live/lib/board-scene-browser.ts`                                    | The browser seams: `browserImageSession`, `browserHugText` (fonts loaded first)                   |
| `apps/live/components/dialogs/ImportImageReport.tsx`                      | The dialog's result view: scene report, board failures, images                                    |
| `apps/live/lib/quick-style-applicability.ts`                              | `quickStyleApplicability`, `quickStyleCaption`                                                    |
| `apps/live/lib/reset-colours.ts`                                          | "Reset to theme" per element, named colours included                                              |
| `apps/live/components/canvas/BoardSceneNotice.tsx`                        | The paste notice                                                                                  |
| `apps/live/components/dialogs/BoardSceneReportList.tsx`                   | The report's rows, shared by the notice and the Import dialog                                     |
| `packages/document/src/element-types.ts`, `arrow-types.ts`, `validate.ts` | `penTextColour` on text, shape, sticky and arrow; `penColour` on path                             |
| `packages/document/src/pen-colours.ts`                                    | `hexOklch` for the colour rules                                                                   |
| `packages/document/src/whiteboard.ts`                                     | `projectWhiteboardElement` draws `penTextColour`                                                  |
| `apps/live/lib/quick-style-pen.ts`                                        | `tabCustomColours` reads text, path and arrow colours too                                         |

## Domain and naming

| Term              | Identifier            | Meaning                                                              |
| ----------------- | --------------------- | -------------------------------------------------------------------- |
| Board scene       | `BoardScene`          | The source-neutral board a parser produces                           |
| Item              | `SceneItem`           | One mark of the scene; discriminated by `kind`                       |
| Item key          | `SceneItem.key`       | Unique within its scene; bindings and assets refer to it             |
| Asset             | `SceneAsset`          | Image bytes, by `key`                                                |
| Note              | `SceneNote`           | `{ rule, count, kind? }`: a degraded or skipped rule                 |
| Landing           | `landBoardScene`      | Scene to elements for one profile                                    |
| Profile           | `BoardSceneProfile`   | `'whiteboard' \| 'diagram'`                                          |
| Placement         | `BoardScenePlacement` | `{ kind: 'at', x, y } \| { kind: 'origin' }`                         |
| Landed scene      | `LandedBoardScene`    | `{ elements, imageRequests, report, tabPatch }`                      |
| Rejection         | `BoardSceneRejection` | `'too-many-elements'`                                                |
| Report            | `BoardSceneReport`    | `{ landed, degraded, skipped }`                                      |
| Resolved colour   | `ResolvedColour`      | `{ kind: 'ink' } \| { kind: 'stock', name } \| { kind: 'hex', hex }` |
| Named text colour | `penTextColour`       | A stock colour name for a text box's or shape label's text           |

"Ink" always means the board's own adaptive ink (an unset colour), never black. "Stock colour" is
one of `PEN_COLOUR_NAMES`. Synonyms such as "theme colour" or "default colour" are not used for
either.

## Types

`scene.ts` is the plan's contract verbatim plus these optional fields (announced to the
coordinator; none is required of a parser):

- `ink.streamline?: number`: perfect-freehand streamline the points are drawn with; absent is `0`
  (the points are final geometry).
- `BoardScene.sourceId?: string`: tool plus the tool's board id, for bulk readiness.
- `BoardScene.createdAt?: string` / `modifiedAt?: string`: the board's own dates, ISO 8601; a
  new-document import dates its document with them.
- `BoardScene.background.colour?: SceneColour`: the source's canvas colour (the diagram profile's
  tab background).
- `SceneNote.kind?: 'degraded' | 'skipped'`: absent is `'degraded'`.

`land.ts` exports:

```ts
export type BoardSceneProfile = 'whiteboard' | 'diagram';
export type BoardScenePlacement = { kind: 'at'; x: number; y: number } | { kind: 'origin' };
export type LandOptions = {
  profile: BoardSceneProfile;
  placement: BoardScenePlacement;
  mintId: () => string;
  // Elements the target tab can still take; absent: MAX_ELEMENTS_PER_TAB.
  room?: number;
};
export type BoardSceneTabPatch = {
  kind?: 'whiteboard';
  name: string;
  backgroundPattern?: BackgroundPattern;
  backgroundColor?: string;
};
export type LandedBoardScene = {
  elements: Element[];
  imageRequests: ImportImageRequest[];
  report: BoardSceneReport;
  tabPatch: BoardSceneTabPatch;
};
export type BoardSceneRejection = 'too-many-elements';
export type LandResult =
  | ({ ok: true } & LandedBoardScene)
  | { ok: false; rejection: BoardSceneRejection; message: string };
```

`report.ts`: `BoardSceneReport = { landed: Partial<Record<SceneItem['kind'], number>>; degraded:
{ rule: string; count: number }[]; skipped: { rule: string; count: number }[] }`, rules in first-seen
order, counts summed per rule.

## Constants

| Constant                  | Value                                                       | Safe range          | Provenance                                                                                                                  |
| ------------------------- | ----------------------------------------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `INK_MAX_LIGHTNESS`       | `0.35` (OKLCH L)                                            | 0.25 to 0.45        | Excalidraw's ink `#1e1e1e` is L 0.235; dark greys past 0.45 (`#495057`) are deliberate greys                                |
| `INK_MAX_CHROMA`          | `0.04` (OKLCH C)                                            | 0.02 to 0.06        | `#1e1e1e` is C 0; navy `#1e3a8a` (C 0.15) must stay a colour                                                                |
| `STOCK_MIN_CHROMA`        | `0.07`                                                      | 0.05 to 0.08        | Stock teal's own light version is C 0.080; Excalidraw bronze `#846358` (C 0.046) stays a custom colour                      |
| `STOCK_LIGHTNESS_RANGE`   | `[0.3, 0.8]`                                                | 0.25-0.4, 0.78-0.85 | Stock versions sit at L 0.47-0.68; Excalidraw orange `#f08c00` is 0.731; pastels (0.86 and over) are fills                  |
| `STOCK_HUE_TOLERANCE_DEG` | `18`                                                        | 13 to 19            | Excalidraw orange is 12.6 deg from stock orange, pink `#c2255c` 16.5 from pink; teal `#099268` (19 from green) stays custom |
| `SCENE_DEFAULT_TITLE`     | `'Whiteboard'`                                              | n/a                 | The whiteboard template's title                                                                                             |
| `TEXT_SCALE_EPSILON`      | `0.005`                                                     | 0.001 to 0.02       | A scale this close to 1 is omitted (no visible difference at 64 px)                                                         |
| `CLOSED_END_EPSILON_PX`   | `1`                                                         | 0.5 to 2            | The Excalidraw importer's closure test: ends within 1 px coincide                                                           |
| `SCENE_FONTS`             | hand `caveat`, mono `roboto-mono`, serif `lora`, sans unset | n/a                 | `fonts.ts` catalogue; Excalifont / Virgil / Whiteboard ink fonts read as hand                                               |
| Marker widths             | `WHITEBOARD_PEN_WIDTHS`                                     | as defined          | `apps/live/lib/whiteboard-prefs.ts` (1, 1.5, 2.5 px)                                                                        |
| Border widths             | `BORDER_STROKE_PX`                                          | as defined          | `nearestBorderStroke` in `packages/document/src/whiteboard.ts`                                                              |
| Text presets              | `LABEL_FONT_PX` sm/md/lg                                    | as defined          | 14 / 22 / 32 px                                                                                                             |
| Text scale limits         | `TEXT_SCALE_MIN..MAX`                                       | as defined          | 0.1 to 40, `validate.ts`                                                                                                    |
| Element limit             | `MAX_ELEMENTS_PER_TAB`                                      | as defined          | 10,000, `validate.ts`                                                                                                       |

The diagram profile reuses the existing Excalidraw importer's buckets: stroke `<= 1` thin, `<= 2.5`
medium, else thick; text `<= 16` sm, `<= 22` md, else lg.

## Algorithms

### Colour (`colour.ts`)

`createColourResolver()` returns `(colour: SceneColour | 'ink' | undefined) => ResolvedColour | null`
(the landing reads it through `LandContext.colour`, which turns `unreadable` into ink and counts it)

1. `undefined` → `null` (no colour); `'ink'` → `{ kind: 'ink' }`.
2. A hex that is not `#rrggbb` (case-insensitive; `#rgb` expanded first) → `{ kind: 'unreadable' }`;
   `LandContext.colour` counts it under "Colours that couldn't be read were drawn in ink" (degraded)
   and lands it as ink.
3. OKLCH of the hex. `L <= INK_MAX_LIGHTNESS && C <= INK_MAX_CHROMA` → ink.
4. `C >= max(STOCK_MIN_CHROMA, PEN_NEUTRAL_CHROMA)` and `L` inside `STOCK_LIGHTNESS_RANGE`: the
   nearest stock colour `penColourAtHue(h)` (the snap's own, `packages/document/src/pen-colours.ts`;
   ties to the earlier); when `penColourHueDistance(h, it) <= STOCK_HUE_TOLERANCE_DEG` →
   `{ kind: 'stock', name }`. No colour maths of its own: `hexOklch` (via `sceneOklch`, which first
   expands `#rgb`), `penColourAtHue` and `penColourHueDistance` are the document package's.
5. Else `{ kind: 'hex', hex: lower-case }`.

Results are memoised per hex within one landing (a `Map`), so a 10,000-item scene computes each
distinct colour once.

`colourAlpha(colour)`: `colour.alpha` clamped to 0..1, default 1. An element's opacity is
`stroke.opacity ?? 1` times the stroke colour's alpha (for a shape with no stroke, the fill's
alpha); `1` is omitted.

`resolveFill(fill?: SceneColour)`: absent or alpha 0 → `undefined` (unfilled); else its hex
lower-case (fills never become ink or stock names).

`resolveStickyFill(fill: SceneColour)`: the `STICKY_PRESETS` entry with the smallest OKLab
Euclidean distance to the fill (an unreadable fill: the first preset) → `{ fillColor: preset.fill,
textColor: preset.text, presetId: preset.id }`; stickies carry no preset binding, so only the two
colours are written.

Writing a resolved colour onto an element, per role:

| Role | ink     | stock                 | hex                |
| ---- | ------- | --------------------- | ------------------ |
| line | nothing | `penColour: name`     | `strokeColor: hex` |
| text | nothing | `penTextColour: name` | `textColor: hex`   |

### Widths (`width.ts`)

- `markerWidthPx(px)`: the `WHITEBOARD_PEN_WIDTHS` px with the smallest `|ln(px / preset)|`; ties
  go to the thicker. A non-positive or non-finite px → Medium.
- `borderStrokeOf(px)`: `nearestBorderStroke(px)`; `px <= 0` → `'none'`.
- `arrowWidthPx(px)`: `ARROW_THICKNESS_PX[borderStrokeOf(px)]`, `'none'` reading as thin.

### Text (`text.ts`)

- `textPreset(fontPx)`: the `TextSize` among `sm`, `md`, `lg` with the smallest
  `|ln(fontPx / LABEL_FONT_PX[size])|`, ties to the larger.
- `textBoxFields(t: SceneText)`: `textSize = presetOf(fontPx)`; `scale = fontPx / LABEL_FONT_PX[size]`
  clamped to `TEXT_SCALE_MIN..MAX`; `textScale` written only when `|scale - 1| > TEXT_SCALE_EPSILON`;
  `font` from `SCENE_FONTS`; `textAlignX`, `textAlignY` as given (`'center'` kept, top / middle /
  bottom as given); `textBold`, `textItalic`, `textUnderline`, `textStrikethrough` written only when
  true; `label` the text with `\r\n` normalised to `\n`; the text colour per the role table.
- `labelFields(t, ctx, { onFill })`: the same without `textScale`; with `onFill` (a shape with a fill,
  a sticky note) the text colour is `textColor: hex` whatever it resolves to (the ink keyword
  writes nothing), so text stays readable on a fill that does not adapt.
- Empty text (after trimming) on a text item: the item is skipped ("Empty text boxes were skipped").

### Per kind, whiteboard profile

Every element gets `id: mintId()` and, where present, `rotation` (normalised into `[0, 360)`, `0`
omitted), `locked: true`, `link` (see Security), `opacity`.

- **ink** → `FreehandElement` via the absolute points: box = their bounds (each side at least 1),
  `points` normalised, `closed: false`; when `closed` the first point is appended unless the ends
  already coincide (`CLOSED_END_EPSILON_PX`). `penWidth: markerWidthPx(widthPx)`, `streamline` (absent: 0), `pressures` when every point has a finite `p` (clamped 0..1), else absent. More
  points than `MAX_FREEHAND_POINTS` (paths: `MAX_PATH_NODES`) are sampled evenly with both ends
  kept (`limitPoints`), degraded "Very long strokes were simplified". Colour:
  `stops` present with the stroke colour `'ink'` (no representative picked) → the first stop, note
  degraded "Multicolour ink drawn in one colour"; else the stroke colour (with `stops`, the
  parser's representative pick, no landing note). `highlighter: true` → `pen: 'highlighter'`, `penWidth: widthPx` (the highlighter
  keeps its px), `strokeColor` the hex of the resolved colour (a stock name lands as its light
  version: the highlighter has no named field). `fill` → dropped, degraded "Filled pen strokes drawn
  without their fill". `dash` other than solid → degraded "Dashed pen strokes drawn solid".
- **polyline** with a head at either end → as a connector without bindings (below).
- **polyline**, two points, no heads → `ArrowElement` with `arrowEnds: 'none'`, free ends.
- **polyline**, three or more points → `PathElement` through `pathGeometry(anchors, closed)`:
  `curved` false → corner nodes, no handles; `curved` true → `mirrored` nodes with Catmull-Rom
  handles (tension 1/6 of the neighbours' chord; an open path's end nodes get one handle each);
  `closed` with `fill` → `fillColor`; stroke colour per the line role, `strokeWidth:
borderStrokeOf`, `strokeStyle` from `dash`. A duplicated closing point is dropped first.
- **shape** → `ShapeElement`: `shape` rectangle `square`, ellipse `circle`, diamond `diamond`,
  triangle `triangle`; `borderRadius: 'md'` when `rounded`; `stroke: null` → `strokeWidth: 'none'`;
  else line colour and `strokeWidth`, `strokeStyle`; `fillColor` from `resolveFill` (unset when
  unfilled, so the board draws it unfilled); `label` via `labelFields`.
- **connector** (and headed polyline) → `ArrowElement`: `from` / `to` from the first and last
  point; an end whose key (`from` / `to`) names an item landed as a boxed element is
  `{ kind: 'pinned', elementId, anchor: nearestAnchor(target, point) }`, else free (a key that names
  nothing is free, silently: Excalidraw leaves stale bindings). Heads: `arrowEnds` from which ends
  have one (`'none'` with neither); `arrowheadShape` from the end head, else the start head:
  arrow `line`, bar `line` (degraded "Bar arrowheads drawn as open arrowheads"), the rest by name;
  `triangle` omitted (the default). Different start and end heads → degraded "Arrows with two
  different heads use one". Intermediate points → `arrowStyle: 'curved'`, `curvePoints` as deltas
  from the chord midpoint; if `curved` is false and there are intermediate points → degraded "Bent
  arrows drawn as curves". `rotationDeg` turns every point about the points' bounds centre first.
  `strokeWidth: arrowWidthPx`, `strokeStyle`, line colour; `label` text and, for a non-ink label
  colour, the text role.
- **text** → `TextElement`: `x, y, width, height`, `autoWidth` as given, `textBoxFields`.
- **sticky** → `StickyElement`: box, `resolveStickyFill(fill)`, `labelFields(text)` with the
  preset's text colour unless the text names its own non-ink colour.
- **image** → `ImageElement` `imageId: null`, box, `objectFit: 'cover'` when `crop`; one
  `ImportImageRequest` `{ elementId, key: asset, source: sceneImageSource(asset) or null, hint:
{ width, height } }`.
- **frame** → `createShape('frame', x, y)` (its title look: `textAlignX: 'right'`, `textAlignY: 'top'`,
  `padding: 'lg'`, `textSize: 'md'`) with the box, `label: name` when non-empty, else the factory's "Frame".

Boxed elements land before connectors resolve their ends: a first pass lands every item except
connectors and headed polylines into a `Map<key, landedElement>` while reserving their index; the
second pass lands the arrows; the output keeps the scene's order.

- **Text on a fill**: a shape with a fill lands its label with `labelFields(.., { onFill: true })`; a
  sticky always does, and its text takes the preset's ink unless it names a colour of its own.

### Per kind, diagram profile (`land-diagram.ts`)

The existing converter's rules, expressed on scene items. Line and text colours through
`diagramColourHex(colour, ctx)`: `'ink'` and near-black ink (the ink rule) unset, so the theme's ink
shows; every other hex as given, never a stock name; an unreadable one counted and unset. Fills
verbatim; `fillColor: 'transparent'` when unfilled; widths by the diagram buckets;
text by the diagram text buckets (no `textScale`, no `autoWidth`); ink → a pencil freehand (no
`penWidth`), closed when the parser says so; a two-point unheaded polyline → arrow `arrowEnds:
'none'`; three or more → freehand `straightEdges: true`; connectors as above with `strokeWidth:
widthPx` verbatim; shapes, stickies (fill verbatim), images and frames as above.

### Placement (`placement.ts`)

- `sceneBounds(items)`: the union of every item's box; point items by their points; a rotated box
  by its rotated corners. Empty scene → `null`.
- `at`: offset = point minus the bounds centre, applied to every coordinate before landing.
- `origin`: no offset.

### Tab patch

- Whiteboard: `{ kind: 'whiteboard', name: title?.trim() || SCENE_DEFAULT_TITLE,
backgroundPattern }` with plain `blank`, dots `grid`, grid `graph`, absent
  `WHITEBOARD_DEFAULT_PATTERN`.
- Diagram: `{ name: title?.trim() || SCENE_DEFAULT_TITLE }` plus `backgroundColor` from
  `background.colour` (its hex) when present.

### `landBoardScene`

1. `room = options.room ?? MAX_ELEMENTS_PER_TAB`; `items.length > room` → `{ ok: false,
rejection: 'too-many-elements', message: "This board has more than the 10,000 elements a tab can
hold." }` (the number is `MAX_ELEMENTS_PER_TAB`), logged `[board-scene] rejected`.
2. Drop unusable items into the skipped rule "Elements without a size were skipped": a non-finite
   coordinate anywhere, a point item with no points (a connector or polyline with fewer than two),
   a boxed item with width or height `<= 0`.
3. Placement offset; land per profile; merge notes (parser notes then landing notes, by rule and
   kind); count `landed` per scene kind of the items that produced an element.
4. Log `[board-scene] landed` and return.

## Editor wiring

### `useBoardSceneInsert` (paste and drop)

Deps (`BoardSceneInsertDeps`): `activeTab`, `editsBlocked`, `commit`, `setSelectedId`,
`setMultiSelectedIds`, `canvasPointerRef` (canvas coords, `null` off the canvas),
`getViewportCenter`, `ownerId`, `documentId`, and the seams `createImageSession` and `hugText`.
Returns `{ insertScene(scene, at?), notice, dismissNotice }`; composed in `useEditorState` beside
`useClipboard` and returned as `boardSceneInsert`, its notice rendered by `EditorView`.
`BoardSceneNoticeState` is `progress` `{ done, total }`, `report` `{ report, images? }` or `refused`
`{ message }`, each with its `source`.

`insertScene(scene)`:

1. Read-only or a locked tab → no-op, returns `false`.
2. Profile from `isWhiteboardTab(activeTab)`; placement at `at`, else the pointer, else the viewport centre;
   `room = MAX_ELEMENTS_PER_TAB - activeTab.elements.length`.
3. `landBoardScene`; a rejection sets the notice to the rejection message and returns.
4. Images: when there are requests, the notice shows "Pasting images {done} of {total}…" while
   `attachImportImages` runs through `createImageSession` (default `browserImageSession`; insert
   mode: nothing replaced).
5. Whiteboard profile: every landed text box is re-hugged (`hugText`: their faces loaded, then
   `hugTextSize` with `measureDrawnText`).
6. The active tab changed meanwhile: nothing lands (`[board-scene] insert dropped`).
7. One `commit(els => [...els, ...landed])`; selection set to the landed ids (a single element
   through `setSelectedId`, several through `setMultiSelectedIds`).
8. Notice: the report when it has degraded or skipped rows or image placeholders, else cleared.
   The active tab changing clears it.

### `useBoardSceneImport` (Import dialog)

- `importSceneIntoActiveTab(scene, onProgress)`: profile from the active tab, `origin` placement,
  images, then `replaceActiveTabContent` with the landed elements, the tab's own theme and the
  patch's background colour (diagram) or pattern (whiteboard); returns `ImportOutcome` with
  `images` and `scene` (the report).
  Composed in `useTabActions` (with `useTabImport`'s `replaceActiveTabContent`) and returned through
  `useEditorState`.

- `importScenesAsNewDocuments(scenes, onProgress)`: `importBoardsAsDocuments` with the open
  document deciding `offline` (`isOfflineId`).
- `importBoardsAsDocuments(scenes, { ownerId, offline, folderId?, onProgress?, onDocumentsCreated?,
createDocument?, createImageSession?, hugText? })` (`apps/live/lib/board-scene-import.ts`, no editor
  state, so the Explorer page calls it directly): per scene, `boardDocumentDates(scene, now)` and
  `boardDocumentName(scene, createdAt)` (`lib/board-scene/board-document.ts`), the landing
  (`whiteboard` / `origin`), `finishLanding` (images through a session made with `{ ownerId,
documentId: null, offline }`, progress per board: `BoardImportProgress` `{ board, boards, done,
total }`; the text hug), then `createDocument({ id, name, tabs: [tab], folderId?, createdAt?,
savedAt? })` with one tab `{ name: 'Whiteboard', kind, backgroundPattern, elements,
templateChosen: true }`. `createDocument` defaults to `apiCreateDocument` (cloud) or
  `offlineCreateDocument(.., { createdAt, savedAt, folderId })` (offline). Per document:
  `track('Document', 'Created', 'Cloud' | 'Offline')` and `track('Whiteboard', 'Created', 'Import')`.
  A rejected landing or a failed create is listed in `failures` (`{ title: name, message }`; a failed
  create "The document couldn't be created. Try again."), the rest still land; none landing is an
  `error` outcome. Reports and image reports add up (`addReports`, `addImageReports`); unreadable
  dates add the degraded rule `UNREADABLE_DATES_RULE`. Afterwards `onDocumentsCreated`.
- `createBrowserImportImageSession` takes an optional `offline` that overrides the document-id check.
- `boardDocumentDates`: ISO `createdAt` / `modifiedAt` parsed with `Date.parse`, then the api's own
  rule (`documentDates`, `@livediagram/api-schema`): both when both hold; `createdAt` alone when only
  it does (`unreadable` when a modified date was given); none, `unreadable` when any date was given.
- `boardDocumentName`: the trimmed title, else `UNTITLED_BOARD_NAME` ("Whiteboard") and the created
  date as `en-GB` `{ day: 'numeric', month: 'short', year: 'numeric' }` ("Whiteboard, 14 Aug 2020"),
  else "Whiteboard".

`ImportOutcome`'s `done` arm gains `scene?: BoardSceneReport`, `failures?: { title: string;
message: string }[]` and `documents?: { id: string; name: string }[]`; the dialog's result view
(`ImportImageReport`) lists the new documents as links (`/document/<id>`) and shows whenever there
are images, losses, failures or new documents.

### Document dates (api)

`documentDates(body, now)` (`packages/api-schema/src/document-dates.ts`, used by the worker's
`POST /api/documents` and by the editor): `DOCUMENT_DATE_MIN` = 1 January 2000 UTC,
`DOCUMENT_DATE_SKEW_MS` = one day; rules per [the api spec](../../015-api/api.md#document-dates).
The worker refuses invalid dates with 400 "invalid document dates" before any write; a genuine
create stores them (`upsertDocumentMeta`, and `seedTabs(env, id, tabs, savedAt)` keeps
`saved_at`); a re-commit is modified now. The OpenAPI manifest's request schema lists `createdAt`
and `savedAt` (integers). `apiCreateDocument` sends `savedAt` when given.

### `BoardSceneNotice`

A `role="status"` `aria-live="polite"` panel, fixed, bottom centre (`z-[var(--z-overlay)]`), 360 px
max wide. Its `bottom` comes from `useNoticeSlot` (`components/canvas/useNoticeSlot.ts`): the
`[data-whiteboard-dock]` top plus `NOTICE_GAP_PX` (8), or, with no dock, the canvas bottom less
`DOCKLESS_LIFT_PX` (68; `DOCKLESS_WIDE_LIFT_PX` 16 from `DOCKLESS_WIDE_MIN_PX` 1760, mirroring the
dock), via the pure `noticeBottom` (`lib/board-scene-notice-slot.ts`); measured in a layout effect
and on resize (ResizeObserver on the dock and canvas), hidden until measured. The panel dress (border, radius, shadow, light and dark);
heading per the spec, `BoardSceneReportList` rows, the image placeholder sentences, a Close button
(Escape when focus is inside). Never steals focus; reduced motion removes its fade.

## Errors and edge cases

| Case                                         | Handling                                                         |
| -------------------------------------------- | ---------------------------------------------------------------- |
| More items than room                         | `too-many-elements`, nothing lands                               |
| Empty scene                                  | Lands nothing, `ok: true`; the paste notice stays silent         |
| Non-finite coordinate / no points / zero box | Skipped, "Elements without a size were skipped"                  |
| Unreadable colour                            | Ink, degraded "Colours that couldn't be read were drawn in ink"  |
| Binding to a missing or non-boxed key        | A free end                                                       |
| Asset key with no asset                      | Request with `source: null` → `missing-bytes` placeholder        |
| Pressures on some points only                | No pressures (constant width)                                    |
| Font px outside the scale limits             | Clamped to `TEXT_SCALE_MIN..MAX`                                 |
| Duplicate item keys                          | The first keeps the key for bindings; every item still lands     |
| Unsafe link                                  | Dropped, degraded "Links that aren't web addresses were dropped" |

## Security and trust

- Scene content is untrusted (another app's clipboard, a downloaded export). Links pass
  `normaliseUrl` (http, https, mailto only). Text is stored as plain label text and rendered as
  text, never HTML. Images only reach the board through the image pipeline (decoded by the browser,
  re-encoded, stored in the gallery); no URL in a scene is ever fetched.
- The element limit bounds memory; per-input byte caps live in the parsers.

## Performance and limits

- Landing is O(items + points); colour resolution memoised per hex. A 10,000-item, 1,000,000-point
  scene lands in well under a second in Node (benchmarked by the parsers' verification scripts).
- One commit per paste or import, so React renders once.

## Observability

- `[board-scene] landed` `{ source, profile, placement, items, landed, degraded, skipped }`.
- `[board-scene] rejected` `{ rejection, items, room }`.
- `[board-scene] insert` `{ elements, images }` from the hook after commit; `[board-scene] import`
  `{ boards, failures }` from the import hook.

## Element model delta

- `penTextColour?: PenColourName` on `TextElement`, `ShapeElement`, `StickyElement` and
  `ArrowElement`: the text's (label's) stock colour, drawn in its board's version when `textColor`
  is unset.
- `PathElement.penColour?: PenColourName`: as on a stroke, shape and arrow.
- `validate.ts`: `penTextColour` must be a stock name when present (`isPenColourName`), on any
  element, as `penColour` already is.
- `projectWhiteboardElement`: after `penColour` (stroke), `penTextColour` sets `textColor` when unset
  (`penColourHex(name, board)`); then the ink projection. Every renderer that projects (canvas
  through `whiteboard-ink.ts`, SVG and PNG exports through `export-as-seen.ts`) draws it.
- `tabCustomColours`: also reads arrows', paths' and text elements' own custom colours (stroke, or
  text colour for a text element).
- Quick style: a stock name on an element marks no theme swatch; applying a stroke clears
  `penColour`, a text colour clears `penTextColour`; Clear styles clears both (see the quick style
  blueprint's delta). "Reset to theme" (`resetElementColours`) clears them too.

## Testing

| Rule                                                                   | Test                                                                                                                                           |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Import rule beside the snap rule over the whole Excalidraw palette     | `colour.test.ts` "the import rule beside the snap rule"                                                                                        |
| Ink threshold, stock match, hex fallback, every real Excalidraw colour | `colour.test.ts` (table-driven)                                                                                                                |
| Alpha to opacity; fills; sticky fill to nearest preset                 | `colour.test.ts`                                                                                                                               |
| Marker, border and arrow widths                                        | `width.test.ts`                                                                                                                                |
| Font px to size + scale, clamping, families, alignment, styles         | `text.test.ts`                                                                                                                                 |
| ink (pressures, streamline, closed, highlighter, stops, fill, dash)    | `land-marks.test.ts`                                                                                                                           |
| polyline (line, path corners, curved, closed fill, headed)             | `land-marks.test.ts`, `land-connectors.test.ts`                                                                                                |
| shape, text, sticky, image, frame                                      | `land-boxes.test.ts`                                                                                                                           |
| connector ends, heads, bends, label, rotation                          | `land-connectors.test.ts`                                                                                                                      |
| z-order, ids, links, locks, rotation, unusable items                   | `land.test.ts`                                                                                                                                 |
| placement at / origin, tab patch                                       | `placement.test.ts`, `land.test.ts`                                                                                                            |
| report merge                                                           | `report.test.ts`                                                                                                                               |
| diagram profile reproduces the Excalidraw file mapping                 | `land-diagram.test.ts`                                                                                                                         |
| element limit at the boundary                                          | `land.test.ts`                                                                                                                                 |
| `penTextColour` / path `penColour` validation                          | `packages/document/src/validate.test.ts`                                                                                                       |
| projection of named text colours                                       | `packages/document/src/whiteboard.test.ts`, `apps/live/lib/export-as-seen.test.ts` (SVG export)                                                |
| `hexOklch`                                                             | `packages/document/src/pen-colours.test.ts`                                                                                                    |
| reset to theme drops named colours                                     | `apps/live/lib/reset-colours.test.ts`                                                                                                          |
| rotation, links, point helpers                                         | `common.test.ts`                                                                                                                               |
| text hug of landed boxes                                               | `apps/live/lib/board-scene-hug.test.ts`                                                                                                        |
| quick style on a mixed whiteboard selection, dark mode                 | `apps/live/e2e/quick-style-mixed.spec.ts`                                                                                                      |
| insert: one commit, selection, images, notice, point                   | `apps/live/hooks/canvas/useBoardSceneInsert.test.ts` (fakes)                                                                                   |
| board document name and dates                                          | `apps/live/lib/board-scene/board-document.test.ts`                                                                                             |
| document dates rule; the worker's create with dates (real schema)      | `packages/api-schema/src/document-dates.test.ts`, `apps/api/src/routes/document-create-dates.test.ts`, `apps/api/src/routes/documents.test.ts` |
| result view lists new documents and failures                           | `apps/live/components/dialogs/ImportImageReport.test.tsx`                                                                                      |
| import: replace-tab, new documents (cloud and offline), failures       | `apps/live/hooks/persistence/useBoardSceneImport.test.ts` (fakes)                                                                              |
| notice slot above the dock at every width                              | `apps/live/lib/board-scene-notice-slot.test.ts`                                                                                                |
| notice copy and role                                                   | `apps/live/components/canvas/BoardSceneNotice.test.tsx`                                                                                        |
