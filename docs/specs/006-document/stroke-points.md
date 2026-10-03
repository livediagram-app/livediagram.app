# Stroke points

How a `freehand` element stores its points: one compact binary block per stroke, written as
base64 inside the tab's JSON. It covers every freehand stroke on every tab kind: whiteboard pen
strokes, diagram pencil sketches, highlighter marks and polygon-tool paths, drawn or imported.

## Why

- Pen strokes are the bulk of a whiteboard. Stored as `{ nx, ny }` objects with full doubles, a
  point costs about 29 to 46 bytes, and a large board's tab outgrows what one database row holds.
- A tab is saved as one row in Cloudflare D1, which caps a row at 2,000,000 bytes, so a tab must fit
  within it ([API](../015-api/api.md)). Compact points keep large boards well inside
  it without thinning strokes visibly.
- Every point as an object also means a large board becomes tens of thousands of small objects
  in the browser the moment it loads, whether or not they are ever drawn.
- The idea follows Oxc's raw transfer with lazy deserialisation (hand over a compact layout and
  build objects only for what is used) and Deno's flat AST (fixed-size records, so record `i` is
  found by multiplying).

## The format

A freehand element carries **`packedPoints`**: a string holding the stroke's points, and the
pen's pressure at each point when it reported one. It replaces the former `points` list of
`{ nx, ny }` objects and the `pressures` list; neither field exists any more.

- **Encoding:** standard base64 (RFC 4648 section 4, `+` and `/`, `=` padding) of a byte block.
- **Byte block**, little-endian:
  - byte 0: **format version**, `1`.
  - byte 1: **flags**. Bit 0 set: every point carries a pressure. The other bits are zero.
  - then one fixed-size **record per point**, back to back, in drawing order:
    - `x`: unsigned 16-bit, `0` to `65535` across the element's width (`0` its left edge,
      `65535` its right edge).
    - `y`: unsigned 16-bit, `0` to `65535` across the element's height.
    - `pressure`: unsigned 8-bit, `0` to `255` for 0 to 1, only when the flag is set.
  - A record is 4 bytes without pressure and 5 with it, so point `i` starts at byte
    `2 + i × 4` (or `2 + i × 5`). The point count is the block's length less the header,
    divided by the record size; a remainder is corrupt.
- **Bounds:** the element's `x`, `y`, `width` and `height` are its bounding box, as before; the
  points are normalised into it, so resizing the element scales the stroke and leaves the block
  unchanged.
- **Quantisation:** a coordinate in `[0, 1]` is stored as `round(n × 65535)` and read back as
  `q / 65535`; a pressure as `round(p × 255)` and `q / 255`. A writer never stores a coordinate
  outside its box.
- **Precision guarantee:** a stored point is within **1 / 131,070 of the box's size** of where
  it was written, on each axis (`STROKE_POINT_MAX_ERROR`): 0.008 px on a stroke 1,000 px across,
  0.08 px on one 10,000 px across, invisible even at the editor's maximum zoom. A pressure is
  within 1 / 510. Re-encoding a decoded block yields the same block.
- **Empty and single-point strokes:** a block with no records (only the header) is a valid empty
  stroke; a single record is a dot. A box of zero width or height stores `0` on that axis.
- **Neighbour deltas are not used:** measured on a large real board they gained nothing over the
  fixed-size layout, which is simpler and directly addressable.

## Reading and writing

- **In memory the element holds the block exactly as stored.** Loading a tab creates one string
  per stroke and no point objects.
- **Decoding is lazy and memoised.** Whatever needs the points (drawing, the eraser, export,
  hit-testing) asks the codec, which decodes the block into typed arrays once and remembers the
  result in a bounded cache keyed by the block. A stroke that is never drawn is never decoded.
- **Every edit produces a new block.** Moving or resizing a stroke changes only its box; erasing
  part of it, drawing it, or importing it encodes fresh blocks.
- **One codec** in `@livediagram/document` serves the editor, the api worker, the MCP server
  and the imports, so there is one reader and one writer of the format.
- **Developers read a block** with the debug decoder: a function that expands a block into
  readable `{ nx, ny, p }` points, and a script that prints a tab or document file with every
  block expanded.

## Migration of stored strokes

- A stroke stored in the former shape (`points` as `{ nx, ny }` objects, optional `pressures`)
  is converted to `packedPoints` by the stored-tab migration (`migrateStoredTab`) that every
  stored-tab entry point already runs: the api's tab read and thumbnail, the offline store, and
  file imports.
- Points that lie outside `[0, 1]` (possible in strokes written by older code) widen the box to
  their extent first, so no point moves by more than the precision guarantee. A pressure list
  whose length differs from the points is dropped, and the stroke draws at the middle pressure.
- The former shape is accepted **only as migration input**, at every place a stored or foreign
  element arrives: the api's tab writes (create and save, which also serve API-token scripts and
  the Google Drive mirror's copies), the MCP server's own validation of what a model writes, realtime element operations from peers, clipboard pastes,
  and tab file imports. Each runs the same migration
  before validation, so nothing downstream ever sees the former shape.
- The migration is idempotent: a stroke already carrying `packedPoints` is returned unchanged.
- The tab export file's `schemaVersion` and the clipboard payload's become `2`, because the
  browser reads both directly: a version 1 file or payload imports through the migration, and an
  older editor refuses a version 2 one (a file with its existing "update the editor" message)
  rather than pasting strokes it cannot draw.
- The document file (the Google Drive mirror's format) stays at version 1: it is only ever read
  into the api's document create, which migrates, so bumping it would only make the mirror
  rewrite every file once.

## The wire

- Tabs travel to and from the api, and elements through realtime operations, with
  `packedPoints` as stored. Nothing else changes about either protocol.
- The api's OpenAPI schema describes `packedPoints` as a base64 string.

## Validation

A freehand element is valid only when `packedPoints` decodes and it carries neither former field
(`points`, `pressures`); every entry point migrates those first. Each decoding failure has a name:

| Rejection         | When                                                             |
| ----------------- | ---------------------------------------------------------------- |
| `not-a-string`    | `packedPoints` is missing or not a string                        |
| `too-long`        | the string is longer than `MAX_FREEHAND_POINTS` records can need |
| `not-base64`      | the string is not canonical padded base64                        |
| `too-short`       | the block is shorter than its two header bytes                   |
| `unknown-version` | the version byte is not `1`                                      |
| `unknown-flags`   | a flag bit other than bit 0 is set                               |
| `ragged`          | the bytes after the header are not a whole number of records     |
| `too-many-points` | more than `MAX_FREEHAND_POINTS` (20,000) records                 |

A block the editor cannot decode at draw time (it never passed validation) draws nothing and logs
`[stroke-points] undecodable` with its rejection, once per block.

## Limits

- At most `MAX_FREEHAND_POINTS` (20,000) points per stroke, as before: at most 100,002 bytes,
  133,336 base64 characters.
- The decode cache holds at most `STROKE_DECODE_CACHE_POINTS` decoded points; the least recently
  used blocks leave it first.

## Measured wins

Measured by the stroke-points bench (`pnpm bench:stroke-points`, `scripts/stroke-points-bench.ts`)
on a synthesised whiteboard shaped like the largest real board measured: 3,300 pen strokes,
66,000 points, a pressure on every point. Before is the former shape as the pen wrote it (full
doubles); timings are medians on a developer machine and move with it, the ratios hold.

| Measure                                   | Before (`{ nx, ny }`) | After (packed) |
| ----------------------------------------- | --------------------- | -------------- |
| Tab bytes                                 | 5,129 KB              | 1,066 KB       |
| Share of one D1 row (2,000,000 bytes)     | 263%                  | 55%            |
| Bytes per point, pressure included        | 70.8                  | 7.8            |
| Objects `JSON.parse` allocates            | 75,902                | 3,302          |
| Heap held after parsing                   | 6,674 KB              | 1,148 KB       |
| `JSON.parse`                              | 9.7 ms                | 1.5 ms         |
| Parse and draw one viewport (1920 x 1080) | 12.9 ms               | 4.6 ms         |
| Parse and draw the whole board            | 131 ms                | 132 ms         |

- **Accuracy:** the worst position error over all 66,000 points is 0.0029 px, exactly the
  guarantee for these strokes' sizes; the worst pressure error is 0.0020 (bound 1 / 510).
- **Drawing the whole board** costs the same: perfect-freehand's outline dominates, and decoding a
  block is cheaper than the point objects it replaces. What packing removes is the cost of
  everything not drawn: a stroke outside the view is never decoded.
- **Migrating** the former tab on load takes 18 ms, once: the next save stores it packed.
- **In the editor**, the same board (912 KB packed) loads and draws all 3,300 strokes 0.78 s
  after a reload, with no errors (a one-off Playwright measurement against the local stack).
