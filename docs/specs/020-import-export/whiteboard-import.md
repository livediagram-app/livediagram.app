# Microsoft Whiteboard import

A **Microsoft Whiteboard** card in the Import dialog brings boards made in
Microsoft Whiteboard across as **whiteboard tabs**
([Whiteboard](../023-whiteboard/whiteboard.md)): pressure ink as marker
strokes, colours that follow light and dark boards, text, sticky notes, shapes,
lines and images, all editable, so a board survives Microsoft deleting it.
The parser turns each board into a [Board scene](board-scene.md); the shared
landing does the rest. Built on [Board import](board-import.md); background in
[Migration readiness, section C](../../research/migration-readiness.md#c-microsoft-whiteboard-import).

## Decisions

- **Personal-account boards.** Whiteboard for personal Microsoft accounts is
  read-only since 2026-09-25 and permanently deleted on **2026-10-16**. Its own
  exports are a flat picture or a snapshot of rendered markup; neither keeps
  ink editable.
- **The input is a board export: the board's own edit history.** Each board is a
  folder holding the board's change history as the Whiteboard web app syncs it,
  its images, and a screenshot. Replaying the history gives the board exactly
  as it stands, every stroke as data. How a user obtains such a folder is
  outside this repository (the help article describes the layout only).
- **Nothing leaves the browser.** No Microsoft account, no network call, no
  Worker route; works offline and on self-host. Images go through the
  [Import image pipeline](import-image-pipeline.md) like any import's.
- **Each board becomes a new whiteboard tab** in the current document, named
  after the board, so importing never overwrites anything.
- **The picture route is retired.** A flat PNG keeps nothing editable; the
  structured route supersedes it.

## The board export

A **board folder** holds, by name:

| File                 | Contents                                                                                      | Used for                     |
| -------------------- | --------------------------------------------------------------------------------------------- | ---------------------------- |
| `manifest.json`      | `{ id, title, changes, objects: [{ id, file, contentType, bytes }], missingObjects, errors }` | Detection, image files       |
| `metadata.json`      | The board record: `title` (often `null`), `createdTime`, `lastModifiedTime`, ...              | Title and dates for the list |
| `session.json`       | `{ id, treeInit }`: the tree every board starts from                                          | Replay's starting tree       |
| `changes.json`       | The change records, in sync order                                                             | Replay                       |
| `objects/<id>.<ext>` | The board's images (PNG, JPEG)                                                                | Image assets                 |
| `sync-frames.jsonl`  | The raw sync frames the changes came from                                                     | Not read                     |
| `screenshot.png`     | The board as Whiteboard drew it                                                               | Not read                     |

- A folder is a board when it holds `manifest.json`, `session.json` and
  `changes.json`. The card accepts **one board folder**, **a folder of board
  folders**, or a **`.zip`** of either; other files beside the boards are
  ignored.
- The board's **title** is `metadata.json`'s, else `manifest.json`'s; a board
  with neither is "Untitled board".

## The format

Whiteboard keeps a board as a **tree of nodes** and syncs edits to it as
**change records**. Every node has a **type**, an optional **payload** (bytes,
base64 in JSON), an optional **id** (`fuid`), and named **traits**, each an
ordered list of child nodes. Types and trait names are UUIDs; their meanings
below were established against real boards and their screenshots, and are
listed with their ids in the [blueprint](blueprints/ms-whiteboard-import.md).

### Replay

- The tree starts as `session.json`'s `treeInit`: a board root holding the
  **canvas**, whose children trait is the board's element list, back to front.
- A change record is one of: **insert** (nodes into a parent's trait, after a
  named sibling or first), **delete** (a run of siblings, first to last),
  **replace** (a run of siblings by new nodes), **move** (a run of siblings to
  another place), **group** (a list of those same edits, encoded as command
  nodes, applied in order), **undo** and **redo** (of earlier changes by id).
- Changes apply in time order (the change's timestamp, then its sync order):
  a change whose upload finished late (an image insert) carries a later sync
  order than the edits made to it, but its own earlier timestamp.
- **Undo** takes an earlier change out of the replay; **redo** puts it back (a
  redo of an undo restores what that undo took out).
- Edits made concurrently from another window, or following an undone change,
  can name nodes no longer in the tree. Nothing they add is lost: an insert
  whose sibling is gone lands last (on top); a replace whose old value is gone
  still adds its new value. A delete or move of a node that is gone is skipped.
  The replay never throws. A trait that holds a single value (a position, a scale)
  reads its **most recently inserted** child, so a concurrent edit that left two
  values behind resolves to the later one.

### Values

- **Numbers** are little-endian by payload length: 1 byte a signed 8-bit
  integer, 2 bytes signed 16-bit, 4 bytes signed 32-bit, 8 bytes a 64-bit float.
- **Points and sizes** are a node holding two numbers (x, y; width, height).
- **Colours** of shapes, lines, notes and backgrounds are 4 bytes `A R G B`; a
  single byte `FF` is white.
- **Pen colours** are a varint (zig-zag, 32-bit) after a leading `01`: the value's
  bytes, high to low, are `B G R A`.
- **Text** is UTF-8. A text body is paragraphs, each holding runs, each holding
  strings.
- **Packed doubles**, used inside pen payloads: the first byte is the double's
  top byte; each following byte adds 7 bits below it, high bit set when another
  follows; the remaining bits are zero.

### Pen strokes

An ink stroke's payload is a header then the points:

- A **flags** byte, then an **extension** byte when flag `0x80` is set.
- Flag `0x01`: an origin (two packed doubles, canvas px from the stroke's place). `0x02`: the **unit scale**
  (packed double): canvas px per stored unit (1/128 in current boards, about
  1/26.46 in older ones). `0x04`: one more packed double.
- Then varints: the **pressure maximum** (flag `0x10`), the **width** in units,
  then header values for the extension (one per extension bit `0x08`, `0x10`;
  three for `0x02`; one for `0x04`).
- Then one record per point, every value a varint: x and y as zig-zag deltas
  from the previous point, a timing channel (flag `0x08`, ignored), the
  **pressure** as an absolute value out of the maximum (flag `0x10`), a width channel (flag `0x20`, ignored), and one
  channel per extension bit `0x08` and `0x10` (ignored).
- An **arrowhead** is a small stroke of its own in the same encoding (with an origin and a width
  channel), drawn in its stroke's colour.
- A stroke may carry a **width factor** (older boards: the width multiplies by
  it) and a **translation** (older boards, after the stroke was moved); current
  boards carry an identity transform.

### What a board holds

| Whiteboard kind      | Holds                                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------- |
| Ink group            | Position (top-left), scale, rotation (degrees clockwise about the position), its strokes                |
| Pen stroke           | Geometry, colour, optional width factor, translation, arrowhead                                         |
| Highlighter stroke   | Geometry, colour (translucent)                                                                          |
| Rainbow stroke       | Geometry; a preset spectrum, no stored colour                                                           |
| Galaxy stroke        | Geometry; a preset purple-to-teal blend, no stored colour                                               |
| Shape                | Position, size, scale, rotation, border width, dash, border colour, fill colour, text, its text's style |
| Sticky note          | Position, size, scale, colour, text                                                                     |
| Text box             | Position, optional fixed size, scale, colour, font size, text                                           |
| Image                | Position, natural size, scale, rotation, the image file                                                 |
| Ink-to-shape polygon | Centre position, corner points, border colour                                                           |
| Line                 | Position, start and end points, width, dash, colour, arrowheads                                         |
| Table                | Position, row heights, column widths, border colour, cell ink                                           |
| Canvas               | Background colour, background pattern                                                                   |

## Colours

Whiteboard colours are **absolute**: a line is drawn in its stored colour on
any background (black ink on a dark board is invisible), and Whiteboard draws
pure black as `#1f1f1f`. The scene needs **light-reference** colours, so the
parser normalises:

- The board's **appearance** is dark when its background colour's OKLCH
  lightness is below `DARK_BACKGROUND_MAX_LIGHTNESS`, else light; a board with
  no background colour is light (Whiteboard's default `#f0f0f0`).
- On a **dark** board, a near-white, near-neutral line colour (lightness at
  least `INK_MIN_LIGHTNESS_ON_DARK`, chroma at most `INK_MAX_CHROMA`) is
  `'ink'`: the author's ink on that board.
- On a **dark** board, a line colour within `INVISIBLE_DISTANCE` (OKLab) of the
  background was invisible to its author: that stroke is left out (skipped:
  "Strokes drawn in the board's own colour were left out").
- Every other colour passes as its hex (with its alpha); the landing resolves
  near-black to ink and stock hues to stock colours.
- Fills (notes, shapes) pass as their hex.

## Mapping

| Whiteboard                 | Board scene                                                                                                       |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Pen stroke                 | `ink`: points with pressures, width, colour; the group's position, scale and rotation applied                     |
| Pen stroke with arrowhead  | `ink`, plus its arrowhead as a second `ink` stroke in the same colour (an arrowhead is a small stroke of its own) |
| Highlighter stroke         | `ink` with `highlighter`, its colour's alpha as opacity                                                           |
| Rainbow and galaxy strokes | `ink` with colour stops (the preset's); the landing degrades multicolour per [Board scene](board-scene.md)        |
| Shape                      | `shape` rectangle, its border (width, dash, colour) and fill, its text as the label (size, bold, alignment)       |
| Sticky note                | `sticky`, its colour as the fill, its text                                                                        |
| Text box                   | `text`: auto-width when it has no fixed size, its font size times its scale, its colour                           |
| Image                      | `image` with its asset from `objects/`; a missing file is noted ("Images missing from the export")                |
| Ink-to-shape polygon       | closed `polyline` through its corners, border colour, no fill                                                     |
| Line                       | `polyline` from start to end with its heads, width, dash and colour                                               |
| Table                      | One `shape` rectangle per cell (border colour, no fill), cell ink as `ink` (degraded: "Tables became rectangles") |
| Canvas                     | `background`: appearance per Colours, pattern Plain, Dots or Grid; `authoredOn` the same appearance               |

- The scene's `title` is the board's title; `sourceId` is the board id.
- **Text** families are sans-serif (Whiteboard's notes and text use its UI
  font). A text box's font size is its stored size times its scale.
- **Unknown kinds** (an element type not in the table) are skipped and counted
  ("Unsupported Whiteboard items were skipped"), never thrown.

## Importing in the dialog

- The card reads a `.zip` (stored or deflated entries) or a folder (a directory
  pick or a dropped folder), finds every board in it, and shows the list.
- **One board** imports straight away as a new whiteboard tab.
- **Several boards** list first, each with its title (or "Untitled board"), its
  last-modified date and its element count, newest first, all checked; the user
  unticks what they do not want and imports the rest. Each checked board
  becomes its own whiteboard tab after the active tab, in list order, all in one
  undo step; the first new tab becomes active.
- Progress: "Importing board 3 of 12…", then the image pipeline's own progress.
- The **result** shows the shared report per [Board scene](board-scene.md),
  summed over the boards, plus each board that failed with its reason.

## Errors

| Rejection          | When                                                                      | Copy                                                                     |
| ------------------ | ------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `no-boards`        | The pick holds no board folder                                            | "No Microsoft Whiteboard boards found. Pick a board folder or its .zip." |
| `zip-damaged`      | The Zip cannot be read                                                    | "This .zip couldn't be read."                                            |
| `zip-encrypted`    | An entry is encrypted                                                     | "This .zip is password-protected."                                       |
| `too-large`        | The pick passes `MAX_IMPORT_BYTES`                                        | "This export is too large to import at once. Import fewer boards."       |
| `board-unreadable` | A board's JSON does not parse or lacks its tree (per board, others go on) | "This board's files couldn't be read."                                   |
| `board-too-large`  | A board lands more than a tab holds (per board)                           | The landing's `too-many-elements` copy                                   |

- A board that fails never stops the others; the result lists it.
- A change that cannot be read (an unknown command, a damaged payload) is
  skipped and counted in the log; a stroke whose payload cannot be decoded is
  skipped ("Pen strokes that couldn't be read were skipped").

## Limits

- Real boards reach 4,330 changes (2 MB of changes) and 900 ink groups; a board
  decodes in well under a second.
- `MAX_IMPORT_BYTES` caps one pick (the Zip, or the folder's board files).
- Images follow the [Import image pipeline](import-image-pipeline.md) (the
  hosted gallery cap included); an image over the cap stays a placeholder and
  the report says so.

## Telemetry

`track('Tab', 'Imported', 'MicrosoftWhiteboard')` once per board imported.

## Non-goals

- Work or school boards through Microsoft Graph.
- Comments, reactions and the board's follow and laser features.
- Obtaining a board export (outside this repository).
- Exact text layout: Whiteboard's text wraps in its own font; ours wraps in the
  board's.
