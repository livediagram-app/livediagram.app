# Microsoft Whiteboard import: blueprint

Derived from [Microsoft Whiteboard import](../whiteboard-import.md). The parser turns board exports
into [Board scenes](../board-scene.md); the landing, the new-tab commit path and the image pipeline
are the board scene's and the [Import image pipeline](import-image-pipeline.md)'s and are not
restated. Defaults are ledgered in [DEFAULTS.md](DEFAULTS.md).

Scope, by file (all under `apps/live/lib/ms-whiteboard/` unless a path says otherwise):

| File                                                            | Role                                                                                      |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `format.ts`                                                     | The ids (`MSWB_COMMAND`, `MSWB_COMMAND_TRAIT`, `MSWB_TYPE`, `MSWB_TRAIT`) and enum tables |
| `values.ts`                                                     | Payload readers: number, ARGB colour, pen colour, text, varint, doubles                   |
| `tree.ts`                                                       | `WbNode`, building nodes from JSON, the id index, single-value reads                      |
| `replay.ts`                                                     | Change ordering, undo and redo, applying edits: `replayBoard`                             |
| `pen-stroke.ts`                                                 | `decodePenStroke`: the packed stroke payload to points                                    |
| `elements.ts`                                                   | `readBoard`: the replayed tree to typed `WbElement`s                                      |
| `colours.ts`                                                    | Appearance, colour normalisation to light-reference                                       |
| `to-scene.ts`                                                   | `boardToScene`: `WbBoard` to `BoardScene`                                                 |
| `ink-scene.ts`                                                  | Ink groups, strokes, presets and arrowheads to scene `ink` items                          |
| `board-export.ts`                                               | Finding boards in a file set; reading one board's files                                   |
| `import.ts`                                                     | `listBoards`, `boardSceneOf`: the card's two steps                                        |
| `board-identity.ts`                                             | `boardDocumentName`, `boardDates`: the document's name and dates from the board record    |
| `ms-whiteboard-fixtures.ts`                                     | Test-only encoder: readable board descriptions to export files                            |
| `apps/live/lib/zip-reader.ts`                                   | Generic Zip reading (stored and deflated entries, byte budget)                            |
| `apps/live/lib/zip-writer-fixture.ts`                           | Test-only Zip writer (Node)                                                               |
| `apps/live/lib/pick-folder.ts`                                  | A folder pick or drop to a file set                                                       |
| `apps/live/components/dialogs/MsWhiteboardImportPanel.tsx`      | The card's panel: pick, list, progress, result                                            |
| `apps/live/hooks/persistence/useMsWhiteboardImport.ts`          | The card's flow: read, list, build scenes, commit through `importScenesAsNewWhiteboards`  |
| `apps/live/components/dialogs/MsWhiteboardImportDialog.tsx`     | The "Import from Microsoft Whiteboard" dialog hosting the panel                           |
| `apps/live/hooks/persistence/useMsWhiteboardImportLauncher.tsx` | `openMicrosoftWhiteboardImport` and the dialog element, for any host                      |
| `apps/live/app/explorer/import-sources.tsx`                     | `IMPORT_SOURCES`: the shipped sources (id, name, icon), one entry each                    |
| `apps/live/app/explorer/ImportFromToolbar.tsx`                  | The page header's "Import from" toolbar                                                   |
| `apps/live/app/explorer/ExplorerPane.tsx`                       | Mounts the toolbar beside New document and the launcher over the commit                   |
| `apps/live/e2e/ms-whiteboard-board.ts`                          | The synthesised export the end-to-end spec imports                                        |
| `apps/live/scripts/ms-whiteboard-verify.mts`                    | Local verification over real exports (path argument; prints counts only)                  |
| `file-sets.ts`                                                  | A `.zip` or a folder pick as an `ExportFileSet` (`MAX_IMPORT_BYTES`)                      |

## Domain and naming

| Term          | Identifier      | Meaning                                                                          |
| ------------- | --------------- | -------------------------------------------------------------------------------- |
| Board export  | `BoardFiles`    | One board's files: manifest, metadata, session, changes, objects                 |
| File set      | `ExportFileSet` | `Map<path, () => Promise<Uint8Array>>`: a Zip's or a folder's entries            |
| Node          | `WbNode`        | `{ id?, type, payload?, traits: Map<traitId, WbNode[]>, seq }`                   |
| Replayed tree | `ReplayedBoard` | `{ root, canvas, index, stats: ReplayStats, imageObjects }`                      |
| Element       | `WbElement`     | A decoded board item (union by `kind`, below)                                    |
| Board         | `WbBoard`       | `{ background?, pattern, elements }`                                             |
| Board summary | `BoardSummary`  | `{ dir, name, dates: BoardDates, elementCount, prepared }` for the dialog's list |
| Board dates   | `BoardDates`    | `{ createdAt?, modifiedAt? }`: validated ISO strings                             |
| Pen stroke    | `PenStroke`     | `{ originPx, unitScale, width, pressureMax, points: { x, y, p? }[] }`            |

Ids are compared in full; the tables below abbreviate to the first 8 hex digits, `format.ts`
holds the full UUIDs.

## Format ids

Commands (group tree nodes): insert `441c00a9`, delete `bbb1ac6a`, replace `bb723ce4`, move
`03e9f4ba`, tag `749ebcf1` (ignored). Command traits: parent `892b5431`, trait (the child's type
names it) `e5c7f972`, after-sibling `1cb61f46`, before-sibling `c3936e38`, first `a1056e79`, last
`846bc9a6`, content `3792af56`, move source parent `4947a929`, source trait `de3d4416`, source
first `854606b9`, source last `da7f7bc8`. A node reference is any node carrying `fuid`.

Tree: root `0d9fce78` → children `3792af56` → `07025d3c` → children → canvas `45c4a855`. Canvas:
elements `3792af56`, background colour `655716c0`, pattern `722196e3` (plain `260365d4`, dots
`4d3677ad`, grid `9c59a5b7`, grid `6abe2936`).

Common traits: position `9f0a1333` (point), size `8a6fd24a` (point), scale `e2bdf131`, rotation
`3ab7c67b` (degrees). Values: number `aca37c68`, point `b97b9a09` (two numbers in `3792af56`),
size `3482e3ec`, ARGB colour `070d4707`, string `09b0b613`.

| Kind        | Type                   | Traits used                                                                                                                                                                      |
| ----------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ink group   | `b411b923`             | position, scale, rotation, strokes `ba630533`                                                                                                                                    |
| Pen         | `a8d76e89`             | colour `2af15da5`→`b64896c8`, width factor `267ca674`→`00d4ac68`, transform `c19b7df9`→`6a076eb4`, arrowhead `c3bc3cdf`→`fb367356`; current: `631ec18f`, `8815b5e4`, `6cee8f0f`  |
| Highlighter | `b4d5e6bc`, `6a4b5280` | as pen                                                                                                                                                                           |
| Rainbow     | `c9bcc8ed`             | as pen, no colour                                                                                                                                                                |
| Galaxy      | `85ca93c8`             | as pen, no colour                                                                                                                                                                |
| Shape       | `ff42e2b3`             | position, size, scale, rotation, border width `aa928acd`, dash `d65544d0`, border `62e5abb3`, fill `e74bfd74`, font size `40c74b3e`, weight `812d483d`, text `3792af56`          |
| Sticky note | `5513b186`             | position, size, scale, rotation, colour `a0c280c8`, font size, weight, text                                                                                                      |
| Text box    | `e2eb1352`             | position, size (absent: auto width), scale, rotation, colour `0f583d72`, font size, weight, text                                                                                 |
| Image       | `755697df`             | position, size, scale, rotation, image node `3792af56`→`05c5ba36` (its id named by the change's `deferred`)                                                                      |
| Polygon     | `5d2a5253`             | position (centre), corners `37d84524`→`34a5476c`→`0a88f78d` (point), colour `408bc500`                                                                                           |
| Line        | `346f7b83`             | position, width `aa928acd`, dash `d65544d0`, colour `62e5abb3`, start `09c872f3`, end `1b229c3e`, start head `2ba03b2d`, end head `fdf5881e`                                     |
| Table       | `2475d295`             | position, rows `243dd2a3`→`a5eed8a8` (height `e2924564`, cells `a7f5ea95`→`50e641e8`→`e49ea96b` ink groups), columns `e6567acf`→`76849568` (width `e2924564`), colour `a700d4b8` |

Text body: paragraphs `6f1f81ab` in `3792af56`, runs `e5bf7079`, strings `09b0b613`. Weight:
`96ea80cb` bold; `a9ce3216`, `1c8ea95a` regular. Text colours (`0f583d72`): `23e4c5b5` black
`#000000`, `e080b312` white `#ffffff`, `11a3662a` orange `#f6630c`, `c3b75d94` yellow `#ffc114`,
`990619c3` green `#02a556`, `5b8ca61a` blue `#0069bf`; absent: black. Sticky colours
(`a0c280c8`): `5dfbbf5b` yellow `#f6dc67`; any other value: yellow (default M2). Observed and
ignored: `8bc6f101`, `1fe6230b` (no visible effect), alignment `0e85cebd`, `99e03b8b` (only one
value each: centre, middle), fit `95034a7c`, `38b2b070`, `48348267`, polygon style `04481317`,
`e2d24112`, `83ca0015`, `afc28513`, `58df3591`.

## Behaviour and state

### Values (`values.ts`)

- `readNumber(bytes)`: length 1 → int8, 2 → int16 LE, 4 → int32 LE, 8 → float64 LE; other → `null`.
- `readArgb(bytes)`: 4 bytes → `{ hex: '#rrggbb', alpha: a/255 }` (alpha omitted at 1); 1 byte
  `FF` → white; other → `null`.
- `readPenColour(bytes)`: `bytes[0] === 1`, then a varint, zig-zag decoded, as uint32 `B G R A`;
  else `null`.
- `readVarint`, `zigzag`, `readPackedDouble(bytes, at) → [value, next]` per the spec.
- `base64ToBytes`; `utf8(bytes)`.

### Replay (`replay.ts`)

1. Sort changes by `gch.dtu` (string compare of the ISO stamp), then `changeOrder`.
2. Walk the sorted list: `FchUndo` adds each of `gch.fuids` to `undone`; `FchRedo` names an undo
   (removes that undo's targets from `undone`) or a change (removes it).
3. Apply every change that is neither undo, redo nor undone, in order:
   - `FchInsert`: build `insertTrees`, place in `fuidnParentDst`'s `traitDst` after
     `fuidncBeforeDst`, or before `fuidncAfterDst`, else first.
   - `FchDelete` / `FchReplace`: the run `fuidncFirstDst..fuidncLastDst`; replace splices in the
     built `insertTrees`. Removed nodes leave the index.
   - `FchMove`: the run from the source place to the destination place.
   - `FchGroup`: each group tree in order, by command type (insert, delete, replace, move); tag
     commands change nothing; unknown commands are counted in `stats.ignoredCommands`.
4. Missing references: an insert whose parent is gone, a delete whose run is gone, and a move
   whose run is gone are counted in `stats.skippedEdits` and skipped; an insert whose sibling is
   gone lands last (`stats.misplacedInserts`); a replace whose run is gone inserts its new nodes
   first (`stats.staleReplaces`); a move whose destination is gone puts the run back. Nodes are
   built only once their place is known, so a skipped edit leaves the index untouched. Every
   built node gets `seq` from a counter.
5. `single(node, trait)`: the child with the highest `seq`.

### Pen strokes (`pen-stroke.ts`)

`decodePenStroke(bytes): PenStroke | null` per the spec's layout. Points accumulate zig-zag
deltas; `p = pressure / pressureMax` when flag `0x10` is set, else absent. Returns `null` when the
payload ends inside the header, a double, or with a partial point record, or the width or the
pressure maximum is 0 where required.

### Elements (`elements.ts`)

`readBoard(replayed): WbBoard`. Each canvas child by type to a `WbElement`:

```ts
type WbElement =
  | { kind: 'ink'; x; y; scale; rotationDeg; strokes: WbStroke[] }
  | {
      kind: 'shape';
      x;
      y;
      width;
      height;
      scale;
      rotationDeg;
      borderWidth;
      dashed;
      border?;
      fill?;
      text?: WbText;
    }
  | { kind: 'sticky'; x; y; width; height; scale; rotationDeg; fill: SceneColour; text?: WbText }
  | { kind: 'text'; x; y; width?: number; height?: number; scale; rotationDeg; text: WbText }
  | { kind: 'image'; x; y; width; height; scale; rotationDeg; imageNodeId?: string }
  | { kind: 'polygon'; cx; cy; corners: Point[]; colour?: SceneColour }
  | { kind: 'line'; x; y; from: Point; to: Point; width; dashed; colour?; heads: { start; end } }
  | { kind: 'table'; x; y; rows: { height; cells: WbElement[] }[]; columns: number[]; colour? }
  | { kind: 'unknown'; type: string };
type WbStroke = {
  preset: 'pen' | 'highlighter' | 'rainbow' | 'galaxy';
  stroke: PenStroke;
  colour?: SceneColour;
  widthFactor: number;
  dx: number;
  dy: number;
  arrowheads: PenStroke[];
  unreadableArrowheads: number;
};
type WbText = { text: string; fontPx: number; bold: boolean; colour: SceneColour };
```

Defaults: scale 1, rotation 0, width factor 1, translation 0. A stroke whose payload does not
decode is dropped and counted (the group's `unreadable` count).

### Colours (`colours.ts`)

- `appearanceOf(background?)`: OKLCH lightness of the background below
  `DARK_BACKGROUND_MAX_LIGHTNESS` → `'dark'`, else `'light'`; none → `'light'`.
- `lineColour(colour, appearance, background)`: `'skip'` when dark and within `INVISIBLE_DISTANCE`
  (OKLab) of the background; `'ink'` when dark, lightness ≥ `INK_MIN_LIGHTNESS_ON_DARK` and chroma ≤
  `INK_MAX_CHROMA`; else the colour.

### To scene (`to-scene.ts`, `ink-scene.ts`)

- Ink group: each stroke's points `x = gx + s·(px·u + dx)`, `y = gy + s·(py·u + dy)` where `g` is
  the group's position, `s` its scale, `u` the stroke's unit scale; then the group's rotation turns
  every point clockwise about the group's position. `widthPx = width · u · s · factor`.
  Pressure kept when every point has one.
- Presets: highlighter → `highlighter: true`, opacity from alpha; rainbow → colour `RAINBOW_COLOUR`
  (stock pink's light-board version), `stops` `RAINBOW_STOPS`, counted in `notes.rainbow`; galaxy →
  `GALAXY_COLOUR` (stock violet's), `GALAXY_STOPS`, `notes.galaxy`. The landing resolves both
  colours to their stock names.
- Arrowhead: decoded with `decodePenStroke` (flags `0xff`/`0xef`: origin, width channel); an extra
  `ink` item keyed `…-head`, its points `g + s·(origin + p·u + d)`, same colour, its own width; one
  that does not decode counts as unreadable.
- Boxes: `x, y` the position, `width, height` size × scale; text `fontPx` × scale.
- Image: `asset` key = the object id found by the image node's id in the changes' `deferred`;
  the bytes from `objects/<file>` per `manifest.objects`; MIME from the file's magic bytes
  (PNG, JPEG, GIF, WebP), else skipped (`RULES.missingImages`).
- Polygon: closed `polyline` through `centre + corner`, `widthPx` `POLYGON_WIDTH_PX`.
- Line: `polyline` `[pos + from, pos + to]`, heads: value 0 none, any other `'arrow'`.
- Table: cells as rectangles from the running row and column offsets, cell ink as ink groups
  offset to the cell; note `RULES.tables`.
- Unknown: `RULES.unsupported`. Skipped strokes: `RULES.invisible`, `RULES.unreadable`.

Rules (`RULES`, user-facing):

| Key             | Kind     | Copy                                                    |
| --------------- | -------- | ------------------------------------------------------- |
| `rainbow`       | degraded | "Rainbow ink drawn in pink"                             |
| `galaxy`        | degraded | "Galaxy ink drawn in violet"                            |
| `tables`        | degraded | "Tables became rectangles"                              |
| `invisible`     | skipped  | "Strokes drawn in the board's own colour were left out" |
| `unreadable`    | skipped  | "Pen strokes that couldn't be read were skipped"        |
| `unsupported`   | skipped  | "Unsupported Whiteboard items were skipped"             |
| `missingImages` | skipped  | "Images missing from the export were skipped"           |

### Board export (`board-export.ts`)

- `findBoards(fileSet): BoardRef[]`: every directory prefix holding `manifest.json`,
  `session.json` and `changes.json` (path separators normalised to `/`). Sorted by path.
- `readBoardFiles(fileSet, ref)`: parses the three JSON files and `metadata.json` (optional);
  any parse failure or a missing `treeInit` → `board-unreadable`.

### Import (`import.ts`)

- `listBoards(fileSet)`: summaries (title, `lastModifiedTime`, element count after replay) newest
  first; `no-boards` when empty.
- `boardSceneOf(fileSet, summary) → BoardScene`: the listed board's decoded elements to a scene,
  its images read from `objects/` (only the ones the board uses), MIME by magic bytes.
- A board that fails to read is listed as a failure (`board-unreadable`) and left out; the others
  import. Failures join the commit's own in the result.

## Interfaces and contracts

- Every reader takes untrusted input and returns `null` or a named result, never throws; the
  import's top level catches anything unexpected as `board-unreadable` and logs it.
- `ExportFileSet` reads lazily so a 245 MB Zip does not inflate images until a board imports.

## Errors and edge cases

- Missing or extra trait children: single reads take the latest; lists may be empty.
- Non-finite numbers drop the element (counted as unsupported).
- Empty board (no elements): a tab with only its background; the report says 0 elements.
- Duplicate `fuid` on insert: the newer node replaces the index entry.

## Security and trust

- The export is untrusted: sizes are checked before inflating (`MAX_IMPORT_BYTES`,
  `MAX_BOARD_JSON_BYTES` per board file), JSON parsed once per file, Zip offsets bounds-checked.
- Images reach the canvas only through the image pipeline (decoded, re-encoded).
- Text lands as plain text; links are not imported.

## Performance and limits

- The largest real board (4,330 changes, about 2 MB) replays and decodes in about 100 ms in Node;
  all 83 real boards list and land in about 1 s (the verification script prints timings), and
  import through the dialog in under 4 s.
- Replay is linear in edits; sibling lookups are linear in the trait's length.

## Observability

- `[ms-whiteboard] boards found` (count), `[ms-whiteboard] replayed` (changes, applied, skipped
  edits, ignored commands, ms), `[ms-whiteboard] board failed` (rejection), `[ms-whiteboard]
scene` (items per kind, notes), `[ms-whiteboard] import failed` (an unexpected throw, the panel
  back on its pick step).

## Constants and configuration

| Constant                        | Value                                     | Provenance                                            | Safe range    |
| ------------------------------- | ----------------------------------------- | ----------------------------------------------------- | ------------- |
| `DARK_BACKGROUND_MAX_LIGHTNESS` | 0.5                                       | Real backgrounds: `#1f1f1f` 0.24, `#e1e1e1` 0.91      | 0.3 to 0.7    |
| `INK_MIN_LIGHTNESS_ON_DARK`     | 0.8                                       | Whiteboard's dark-board ink `#ebebeb` is 0.94         | 0.7 to 0.95   |
| `INK_MAX_CHROMA`                | 0.04                                      | Same as the landing's                                 | 0.02 to 0.06  |
| `INVISIBLE_DISTANCE`            | 0.03                                      | OKLab; `#1f1f1f` and `#000000` on `#1f1f1f`           | 0.01 to 0.06  |
| `RAINBOW_STOPS`                 | e71224 f6630c ffc114 02a556 0069bf 8a2be2 | Measured on screenshots                               | n/a           |
| `GALAXY_STOPS`                  | 881f7c 3a9fb4                             | Measured on screenshots                               | n/a           |
| `MSWB_STICKY_YELLOW`            | `#f6dc67`                                 | Measured                                              | n/a           |
| `BOARD_DATES_FLOOR`             | `2016-01-01T00:00:00.000Z`                | Whiteboard's first preview was 2017                   | 2010 to 2017  |
| `UNTITLED_DOCUMENT`             | "Whiteboard"                              | The tab kind's own name                               | n/a           |
| `POLYGON_WIDTH_PX`              | 4                                         | Whiteboard's default pen                              | 1 to 8        |
| `MAX_IMPORT_BYTES`              | 512 MB                                    | The real 83-board export is 245 MB                    | 64 MB to 1 GB |
| `MAX_BOARD_JSON_BYTES`          | 64 MB                                     | Largest real `changes.json` about 2 MB; frames larger | 8 to 256 MB   |

## Presentation and UX

- Entry point: the Explorer page header's "Import from" toolbar (`ImportFromToolbar`, from
  `IMPORT_SOURCES`), rendered through `PaneHeader`'s `headerActions` (so it sits left of Help)
  wherever the section passes `onCreateDocument`. Group: `role="toolbar"`, `aria-label="Import from"`,
  Help's outline style (`rounded-lg border px-1 py-0.5 text-xs`, the same height), the muted label
  hidden below `sm`. Each button: 24 px icon, `aria-label="Import from <name>"`, the `Tooltip` with
  `<name>`, `focus-visible` ring; it calls the source's open (`openMicrosoftWhiteboardImport`).
  Icon: `MsWhiteboardSourceIcon`, an original glyph (white board with a stroke on a `#2b6fd6` tile).
- Dialog: title "Import from Microsoft Whiteboard", subtitle "Each board becomes its own document,
  named and dated as the board." The panel has no back bar there (nothing to go back to).
- Panel: the intro "Pick a Microsoft Whiteboard board export: a board folder, a folder of boards,
  or their .zip.", a drop
  zone that is also a button ("Drop a board folder or .zip here, or choose a folder"), and two
  buttons "Choose a .zip" and "Choose a folder". Reading: "Reading boards…". Pick errors show
  under the drop zone (`role="alert"`): the Errors table's copy, or "Couldn't import that. Check
  the export and try again." for anything unexpected.
- One board imports straight away, without the list.
- List (several boards): a checkbox per board, label the document name, secondary line "Edited 12 Mar 2026
  · 140 items"; a "Select all" checkbox; primary button "Import 12 boards" (count follows the
  ticks; disabled at 0), "Back"; under the list, "2 boards couldn't be read and will be left out."
  when listing failed for some.
- Progress (`role="status"`): "Importing board 3 of 12…" ("Importing board…" for one), then
  "Importing images 3 of 12…".
- Result: the panel's own report (the shared `ImportImageReport`: landed counts, notes, image
  counts, boards left out), always shown, its "Done" handing back to the host.
- The panel is self-contained (`MsWhiteboardImportPanel`: `importScenes`, `onClose`, optional
  `onBack: { label, onClick }` drawn as the house back bar), so any host mounts it; the editor's
  Explorer's dialog mounts it with no way back.

## Accessibility

- The dialog is the house `Dialog` (focus trapped, Escape closes, labelled by its
  title).
- The list is a `fieldset` with a `legend` ("Boards to import"); checkboxes are native.
- Progress text in a `role="status"` region; errors in `role="alert"`.
- Buttons are native buttons with visible focus; the drop zone is also a button.

## Web Experience

- The import code is lazy-loaded when the card is picked; nothing joins the editor's first load.

## Testing

| Rule                                                                                         | Test file                           |
| -------------------------------------------------------------------------------------------- | ----------------------------------- |
| Number, colour, pen colour, varint, packed double                                            | `values.test.ts`                    |
| Encoder round trip of every value and stroke                                                 | `ms-whiteboard-fixtures.test.ts`    |
| Stroke layouts (current, older, extension bits)                                              | `pen-stroke.test.ts`                |
| Replay: insert, delete, replace, move, group, order, undo, redo, missing nodes, latest value | `replay.test.ts`                    |
| Each element kind read                                                                       | `elements.test.ts`                  |
| Appearance, ink on dark, invisible strokes                                                   | `colours.test.ts`                   |
| Scene mapping per kind (ink placement, presets, arrowheads, rotation), notes                 | `to-scene.test.ts`                  |
| Zip and folder picks as file sets                                                            | `file-sets.test.ts`                 |
| The card's flow: single board, list, ticks, zip, errors, failures, telemetry                 | `useMsWhiteboardImport.test.ts`     |
| The dialog (title, panel, close) and the launcher                                            | `MsWhiteboardImportDialog.test.tsx` |
| The toolbar: label, one named button per source, tooltip, opening                            | `ImportFromToolbar.test.tsx`        |
| End to end in the browser, synthesised export                                                | `e2e/ms-whiteboard-import.spec.ts`  |
| Board finding, rejections                                                                    | `board-export.test.ts`              |
| Zip reading                                                                                  | `zip-reader.test.ts`                |
| Listing and importing                                                                        | `import.test.ts`                    |
| Document name and dates (blank and null titles, invalid, future, reversed dates)             | `board-identity.test.ts`            |
| Panel states                                                                                 | `MsWhiteboardImportPanel.test.tsx`  |

## Assets and external resources

- No assets ship. Fixtures are generated by `ms-whiteboard-fixtures.ts` in the tests; no real
  export is committed.

## Defaults

See DEFAULTS.md rows M1 to M5.
