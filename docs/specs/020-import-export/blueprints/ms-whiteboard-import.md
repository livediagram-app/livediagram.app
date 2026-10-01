# Microsoft Whiteboard import: blueprint

Derived from [Microsoft Whiteboard import](../whiteboard-import.md). The parser turns board exports
into [Board scenes](../board-scene.md); the landing, the new-tab commit path and the image pipeline
are the board scene's and the [Import image pipeline](import-image-pipeline.md)'s and are not
restated. Defaults are ledgered in [DEFAULTS.md](DEFAULTS.md).

Scope, by file (all under `apps/live/lib/ms-whiteboard/` unless a path says otherwise):

| File                                                       | Role                                                                     |
| ---------------------------------------------------------- | ------------------------------------------------------------------------ |
| `format.ts`                                                | The type, trait and command ids (`MSWB`), and the enum value tables      |
| `values.ts`                                                | Payload readers: number, ARGB colour, pen colour, text, varint, doubles  |
| `tree.ts`                                                  | `WbNode`, building nodes from JSON, the id index, single-value reads     |
| `replay.ts`                                                | Change ordering, undo and redo, applying edits: `replayBoard`            |
| `pen-stroke.ts`                                            | `decodePenStroke`: the packed stroke payload to points                   |
| `elements.ts`                                              | `readBoard`: the replayed tree to typed `WbElement`s                     |
| `colours.ts`                                               | Appearance, colour normalisation to light-reference                      |
| `to-scene.ts`                                              | `boardToScene`: `WbBoard` to `BoardScene`                                |
| `ink-scene.ts`                                             | Ink groups, strokes, presets and arrowheads to scene `ink` items         |
| `board-export.ts`                                          | Finding boards in a file set; reading one board's files                  |
| `import.ts`                                                | `listBoards`, `importBoard`: the card's two steps                        |
| `ms-whiteboard-fixtures.ts`                                | Test-only encoder: readable board descriptions to export files           |
| `apps/live/lib/zip-reader.ts`                              | Generic Zip reading (stored and deflated entries, byte budget)           |
| `apps/live/lib/pick-folder.ts`                             | A folder pick or drop to a file set                                      |
| `apps/live/components/dialogs/MsWhiteboardImportPanel.tsx` | The card's panel: pick, list, progress, result                           |
| `apps/live/hooks/persistence/useMsWhiteboardImport.ts`     | Runs the import and commits each board as a new whiteboard tab           |
| `scripts/ms-whiteboard-verify.ts` (in `apps/live`)         | Local verification over real exports (path argument; prints counts only) |

## Domain and naming

| Term          | Identifier      | Meaning                                                               |
| ------------- | --------------- | --------------------------------------------------------------------- |
| Board export  | `BoardFiles`    | One board's files: manifest, metadata, session, changes, objects      |
| File set      | `ExportFileSet` | `Map<path, () => Promise<Uint8Array>>`: a Zip's or a folder's entries |
| Node          | `WbNode`        | `{ id?, type, payload?, traits: Map<traitId, WbNode[]>, seq }`        |
| Change        | `WbChange`      | One record of `changes.json`                                          |
| Replayed tree | `ReplayedBoard` | `{ root, canvas, stats: ReplayStats }`                                |
| Element       | `WbElement`     | A decoded board item (union by `kind`, below)                         |
| Board         | `WbBoard`       | `{ background, appearance, elements }`                                |
| Board summary | `BoardSummary`  | `{ path, title, modified, elementCount }` for the dialog's list       |
| Pen stroke    | `PenStroke`     | `{ unitScale, width, pressureMax, points: { x, y, p? }[] }`           |

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
     and unknown commands are counted in `stats.ignoredCommands`.
4. Any edit whose parent, sibling or run is missing is counted in `stats.skippedEdits` and
   skipped. Every built node gets `seq` from a counter.
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
  arrowhead: boolean;
};
type WbText = { text: string; fontPx: number; bold: boolean; colour: SceneColour };
```

Defaults: scale 1, rotation 0, width factor 1, translation 0. A stroke whose payload does not
decode is dropped and counted (`unreadableStrokes`).

### Colours (`colours.ts`)

- `appearanceOf(background?)`: OKLCH lightness of the background below
  `DARK_BACKGROUND_MAX_LIGHTNESS` → `'dark'`, else `'light'`; none → `'light'`.
- `lineColour(colour, appearance, background)`: `'skip'` when dark and within `INVISIBLE_DISTANCE`
  (OKLab) of the background; `'ink'` when dark, lightness ≥ `INK_MIN_LIGHTNESS_ON_DARK` and chroma ≤
  `INK_MAX_CHROMA`; else the colour.

### To scene (`to-scene.ts`, `ink-scene.ts`)

- Ink group: each stroke's points `x = gx + s·(px·u + dx)`, `y = gy + s·(py·u + dy)` where `g` is
  the group's position, `s` its scale, `u` the stroke's unit scale; then the group's rotation turns
  every point about the centre of the group's unrotated bounds. `widthPx = width · u · s · factor`.
  Pressure kept when every point has one.
- Presets: highlighter → `highlighter: true`, opacity from alpha; rainbow → `stops` `RAINBOW_STOPS`,
  colour the first stop; galaxy → `stops` `GALAXY_STOPS`.
- Arrowhead: an extra `ink` V at the last point: arms of `ARROWHEAD_LENGTH_FACTOR · widthPx` at
  ±`ARROWHEAD_ANGLE_DEG` from the reversed direction of the last `ARROWHEAD_TANGENT_PX` of the
  stroke; note `RULES.arrowheads`.
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

| Key           | Kind     | Copy                                                    |
| ------------- | -------- | ------------------------------------------------------- |
| `arrowheads`  | degraded | "Arrowheads on pen strokes were redrawn"                |
| `tables`      | degraded | "Tables became rectangles"                              |
| `invisible`   | skipped  | "Strokes drawn in the board's own colour were left out" |
| `unreadable`  | skipped  | "Pen strokes that couldn't be read were skipped"        |
| `unsupported` | skipped  | "Unsupported Whiteboard items were skipped"             |
| `missingImg`  | skipped  | "Images missing from the export were skipped"           |

### Board export (`board-export.ts`)

- `findBoards(fileSet): BoardRef[]`: every directory prefix holding `manifest.json`,
  `session.json` and `changes.json` (path separators normalised to `/`). Sorted by path.
- `readBoardFiles(fileSet, ref)`: parses the three JSON files and `metadata.json` (optional);
  any parse failure or a missing `treeInit` → `board-unreadable`.

### Import (`import.ts`)

- `listBoards(fileSet)`: summaries (title, `lastModifiedTime`, element count after replay) newest
  first; `no-boards` when empty.
- `importBoard(fileSet, ref) → { scene } | { error }`: read, replay, read the board, to scene,
  assets from `objects/`.

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

- The largest real board (4,330 changes, about 2 MB) replays and decodes in under
  `BOARD_DECODE_BUDGET_MS` (500 ms) in Node; the verification script prints timings.
- Replay is linear in edits; sibling lookups are linear in the trait's length.

## Observability

- `[ms-whiteboard] boards found` (count), `[ms-whiteboard] replayed` (changes, applied, skipped
  edits, ignored commands, ms), `[ms-whiteboard] board failed` (rejection), `[ms-whiteboard]
scene` (items per kind, notes).

## Constants and configuration

| Constant                        | Value                                     | Provenance                                            | Safe range    |
| ------------------------------- | ----------------------------------------- | ----------------------------------------------------- | ------------- |
| `DARK_BACKGROUND_MAX_LIGHTNESS` | 0.5                                       | Real backgrounds: `#1f1f1f` 0.24, `#e1e1e1` 0.91      | 0.3 to 0.7    |
| `INK_MIN_LIGHTNESS_ON_DARK`     | 0.8                                       | Whiteboard's dark-board ink `#ebebeb` is 0.94         | 0.7 to 0.95   |
| `INK_MAX_CHROMA`                | 0.04                                      | Same as the landing's                                 | 0.02 to 0.06  |
| `INVISIBLE_DISTANCE`            | 0.03                                      | OKLab; `#1f1f1f` and `#000000` on `#1f1f1f`           | 0.01 to 0.06  |
| `RAINBOW_STOPS`                 | e71224 f6630c ffc114 02a556 0069bf 8a2be2 | Measured on screenshots                               | n/a           |
| `GALAXY_STOPS`                  | 881f7c 3a9fb4                             | Measured on screenshots                               | n/a           |
| `STICKY_YELLOW`                 | `#f6dc67`                                 | Measured                                              | n/a           |
| `POLYGON_WIDTH_PX`              | 4                                         | Whiteboard's default pen                              | 1 to 8        |
| `ARROWHEAD_LENGTH_FACTOR`       | 4                                         | Hand-drawn heads on real boards                       | 2 to 8        |
| `ARROWHEAD_ANGLE_DEG`           | 30                                        | Open V                                                | 20 to 45      |
| `ARROWHEAD_TANGENT_PX`          | 6                                         | Ignores the last wobble of a stroke                   | 2 to 20       |
| `MAX_IMPORT_BYTES`              | 512 MB                                    | The real 83-board export is 245 MB                    | 64 MB to 1 GB |
| `MAX_BOARD_JSON_BYTES`          | 64 MB                                     | Largest real `changes.json` about 2 MB; frames larger | 8 to 256 MB   |

## Presentation and UX

- Card: title "Microsoft Whiteboard", description "Board exports from Microsoft Whiteboard: a board
  folder, a folder of boards, or their .zip. Each board becomes a whiteboard tab." No replace
  warning (nothing is replaced).
- Panel: two buttons "Choose a .zip" and "Choose a folder", and a drop zone ("Or drop a board
  folder or .zip here"). Reading: "Reading boards…".
- List (several boards): a checkbox per board, label the title, secondary line "Edited 12 Mar 2026
  · 140 items"; a "Select all" checkbox; primary button "Import 12 boards" (count follows the
  ticks; disabled at 0), "Back".
- Progress: "Importing board 3 of 12…", then the pipeline's images progress.
- Result: "Imported 12 boards" with the shared report (landed counts, notes) and failures, button
  "Done".

## Accessibility

- The list is a `fieldset` with a `legend` ("Boards to import"); checkboxes are native.
- Progress text in a `role="status"` region; errors in `role="alert"`.
- Buttons are native buttons with visible focus; the drop zone is also a button.

## Web Experience

- The import code is lazy-loaded when the card is picked; nothing joins the editor's first load.

## Testing

| Rule                                                                                         | Test file                               |
| -------------------------------------------------------------------------------------------- | --------------------------------------- |
| Number, colour, pen colour, varint, packed double                                            | `values.test.ts`                        |
| Encoder round trip of every value and stroke                                                 | `ms-whiteboard-fixtures.test.ts`        |
| Stroke layouts (current, older, extension bits)                                              | `pen-stroke.test.ts`                    |
| Replay: insert, delete, replace, move, group, order, undo, redo, missing nodes, latest value | `replay.test.ts`                        |
| Each element kind read                                                                       | `elements.test.ts`                      |
| Appearance, ink on dark, invisible strokes                                                   | `colours.test.ts`                       |
| Scene mapping per kind, notes                                                                | `to-scene.test.ts`, `ink-scene.test.ts` |
| Board finding, rejections                                                                    | `board-export.test.ts`                  |
| Zip reading                                                                                  | `zip-reader.test.ts`                    |
| Listing and importing                                                                        | `import.test.ts`                        |
| Panel states                                                                                 | `MsWhiteboardImportPanel.test.tsx`      |

## Assets and external resources

- No assets ship. Fixtures are generated by `ms-whiteboard-fixtures.ts` in the tests; no real
  export is committed.

## Defaults

See DEFAULTS.md rows M1 to M5.
