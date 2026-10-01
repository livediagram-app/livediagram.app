# Stroke points blueprint

Derived from [Stroke points](../stroke-points.md). Engineering precision only; design lives in the
spec.

## Domain and naming

| Term              | Identifier                       | Meaning                                                                  |
| ----------------- | -------------------------------- | ------------------------------------------------------------------------ |
| Packed points     | `FreehandElement.packedPoints`   | The base64 string on the element: the stored form                        |
| Block             | (bytes behind `packedPoints`)    | Header (version, flags) then one record per point                        |
| Record            | (4 or 5 bytes)                   | One point: `x` u16, `y` u16, optional `pressure` u8                      |
| Stroke points     | `StrokePoints`                   | A decoded block: `count`, `nx`, `ny`, `pressures` typed arrays           |
| Rejection         | `StrokePointsRejection`          | The named reason a string is not a valid block                           |
| Legacy points     | `LegacyFreehandPoints`           | The former stored shape: `points: { nx, ny }[]` + `pressures?: number[]` |
| Normalised point  | `NormalisedPoint` (`{ nx, ny }`) | A point in `[0, 1]` of its box: the encoder's input and the debug output |
| Freehand geometry | `FreehandGeometry`               | A box and its normalised points, before packing (the live ink's layout)  |

"Packed points" is the only name for the stored string: never "binary points", "ink data" or
"point blob". `points` and `pressures` no longer name element fields anywhere.

## Modules

| File                                                | Responsibility                                                                                                                                           |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/document/src/stroke-points.ts`            | The codec: constants, `encodeStrokePoints`, `parseStrokePoints`, `strokePointCount`, `EMPTY_STROKE_POINTS`, base64                                       |
| `packages/document/src/stroke-points-cache.ts`      | `createStrokePointsDecoder`, `decodeStrokePoints`: the memoised, bounded decode the renderers call                                                       |
| `packages/document/src/stroke-points-debug.ts`      | `describeStrokePoints`, `expandPackedPoints`: the debug decoder                                                                                          |
| `packages/document/src/freehand-points.ts`          | `freehandGeometry`, `packFreehandPoints` and the readers `freehandStrokePoints`, `freehandCanvasPoints`, `freehandNormalisedPoints`, `freehandPressures` |
| `packages/document/src/legacy-stroke-points.ts`     | `migrateLegacyStrokePoints`: the former shape to `packedPoints`                                                                                          |
| `packages/document/scripts/expand-stroke-points.ts` | The debug script: a tab or document JSON file with every block expanded                                                                                  |
| `scripts/ts-source-hooks.mjs`                       | Node resolve hook: lets repo scripts run workspace TypeScript sources                                                                                    |

## Interfaces and contracts

```ts
// stroke-points.ts
export const STROKE_POINTS_VERSION = 1;
export const STROKE_POINTS_HEADER_BYTES = 2;
export const STROKE_POINTS_PRESSURE_FLAG = 0b0000_0001;
export const STROKE_POINT_STEPS = 65_535; // u16 range
export const STROKE_PRESSURE_STEPS = 255; // u8 range
export const STROKE_POINT_MAX_ERROR = 1 / (2 * STROKE_POINT_STEPS); // of the box, per axis
export const STROKE_PRESSURE_MAX_ERROR = 1 / (2 * STROKE_PRESSURE_STEPS);
export const MAX_FREEHAND_POINTS = 20_000; // moved here from validate.ts
export const MAX_PACKED_POINTS_LENGTH = 133_336; // base64 of 2 + 20,000 x 5 bytes

export type NormalisedPoint = { nx: number; ny: number };
export type StrokePoints = {
  readonly count: number;
  readonly nx: Float64Array; // q / 65535, length count
  readonly ny: Float64Array;
  readonly pressures: Float64Array | null; // q / 255, or null without the flag
};
export type StrokePointsRejection =
  | 'not-a-string'
  | 'too-long'
  | 'not-base64'
  | 'too-short'
  | 'unknown-version'
  | 'unknown-flags'
  | 'ragged'
  | 'too-many-points';
export type StrokePointsParse =
  { ok: true; points: StrokePoints } | { ok: false; rejection: StrokePointsRejection };

export function encodeStrokePoints(
  points: readonly NormalisedPoint[],
  pressures?: readonly number[],
): string;
export function parseStrokePoints(packed: unknown): StrokePointsParse; // uncached, full checks
export function strokePointCount(packed: string): number; // from the length alone
export const EMPTY_STROKE_POINTS: StrokePoints; // frozen, count 0

// stroke-points-cache.ts
export const STROKE_DECODE_CACHE_POINTS = 500_000;
export type StrokePointsDecoder = {
  decode(packed: string): StrokePoints;
  has(packed: string): boolean;
  size(): { entries: number; points: number };
  clear(): void;
};
export function createStrokePointsDecoder(budgetPoints: number): StrokePointsDecoder;
export function decodeStrokePoints(packed: string): StrokePoints; // the shared decoder

// stroke-points-debug.ts
export type DescribedStrokePoints =
  | {
      ok: true;
      version: number;
      pressure: boolean;
      points: { nx: number; ny: number; p?: number }[];
    }
  | { ok: false; rejection: StrokePointsRejection };
export function describeStrokePoints(packed: string): DescribedStrokePoints;
export function expandPackedPoints<T>(value: T): T; // deep copy, every packedPoints expanded

// freehand-points.ts
type Box = Pick<FreehandElement, 'x' | 'y' | 'width' | 'height'>;
export function freehandStrokePoints(el: Pick<FreehandElement, 'packedPoints'>): StrokePoints;
export function freehandCanvasPoints(
  el: Box & Pick<FreehandElement, 'packedPoints'>,
  minSide?: number, // a box side below this counts as this (the pen draws with max(side, 1))
): Point[];
export function freehandNormalisedPoints(
  el: Pick<FreehandElement, 'packedPoints'>,
): NormalisedPoint[];
export function freehandPressures(el: Pick<FreehandElement, 'packedPoints'>): number[] | undefined;
export type FreehandGeometry = Box & { points: NormalisedPoint[] }; // unpacked, the live ink's
export function freehandGeometry(rawPoints: readonly Point[]): FreehandGeometry;
export function packFreehandPoints(
  rawPoints: readonly Point[],
  pressures?: readonly number[],
): Box & Pick<FreehandElement, 'packedPoints'>; // freehandGeometry + encode

// legacy-stroke-points.ts
export function migrateLegacyStrokePoints(elements: Element[]): Element[]; // identity when none
```

- **Encoder input:** `nx`, `ny` clamped into `[0, 1]` (writers derive them from the box, so only
  float noise is ever clamped); a non-finite coordinate or pressure throws
  `RangeError('stroke-point-not-finite')`; `pressures` of a different length than `points`
  throws `RangeError('stroke-pressures-length')`; more than `MAX_FREEHAND_POINTS` throws
  `RangeError('stroke-too-many-points')`. A throw is a programming error in a writer; every
  writer's tests cover its inputs.
- **Base64:** the module's own table codec (the document package cannot depend on
  `@livediagram/api-schema`, which depends on it): standard alphabet, `=` padding, canonical only
  (a non-zero pad remainder is `not-base64`), no whitespace.
- **Decode** reads with a `DataView`, little-endian; record `i` at `2 + i * stride`.
- **Validation:** `isValidElement` for `freehand` requires `parseStrokePoints(el.packedPoints).ok`
  and no `points` / `pressures` fields (a stray field is invalid, so the former shape cannot pass).
  The api runs the migration first, so it never sees one.

## Behaviour and state

- **Element in memory:** holds `packedPoints` exactly as stored. No decoded state on the element.
- **Decode cache:** a `Map<string, StrokePoints>` in insertion order. A hit is moved to the end;
  an insert evicts from the front while the cached point total exceeds
  `STROKE_DECODE_CACHE_POINTS`. A block larger than the whole budget is decoded and not cached.
- **Corrupt at draw time:** `decodeStrokePoints` returns the frozen empty `StrokePoints` and logs
  `console.warn('[stroke-points] undecodable', { rejection, length })` once per distinct string
  (a bounded `Set` of 64 entries, cleared when full).
- **Writers** (each produces a fresh block):
  - `createFreehand(rawPoints, closed, pressures?)` and `freehandGeometry` (factories):
    `freehandGeometry` keeps its box rule and returns normalised points (unpacked, for the live
    ink); `createFreehand` packs them with the pressures.
  - The pen commit (`commit-freehand.ts` `whiteboardStroke`): pressures from the live stroke's
    ink go to `createFreehand`.
  - The eraser's partial split (`eraseStrokePart`): each piece packs its own points and, when
    the stroke had pressures, its interpolated pressures.
  - The style preset that drops pen ink (`style-presets.ts`): re-packs the same points without
    pressures.
  - Imports: the Excalidraw file importer; the board-scene landing (track F) adopts
    `packFreehandPoints` when it rebases.
- **Live ink:** the stroke being drawn keeps its raw samples (`freehandGeometry`, unpacked, through
  `PenStrokeSource`'s `points` form), so settled ink never re-quantises as the box grows; the landed
  stroke is within `STROKE_POINT_MAX_ERROR` of it, the only difference release makes.
- **Readers** (each decodes through the cache): canvas freehand view (pen outline and the
  100-unit polyline), SVG export (`svgFreehandShape`), the pen outline helpers
  (`freehandPenStroke`, `penStrokeSvg`), the eraser (`freehandAbsolutePoints`,
  `strokeTouchesBrush`, `inkHalfWidth`), the Excalidraw exporter.
- **Migration entry points:** `migrateStoredTab` (api tab read, thumbnail, offline store, import
  merge) gains `migrateLegacyStrokePoints` through `migrateStoredElements`; plus the api's create
  and tab save (before `isValidTab`), `migrateRoomOp` on every received room op (`tab`, `el`),
  `parseClipboardPayload`, `parseImportedTab` (tab file import), and change-log entries as the
  editor receives them (`apiListChangeLog` and the room's `log` op) before Revert can apply them.

## Inventory of readers and writers

Every site that read or wrote `FreehandElement.points` / `pressures`, found by removing both
fields from the type and compiling every workspace, plus the untyped entry points.

| Area                | Site                                                                                 | Change                                                        |
| ------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| Element model       | `packages/document/src/element-types.ts`                                             | `packedPoints: string` replaces both fields                   |
| Validation          | `packages/document/src/validate.ts`                                                  | `parseStrokePoints`; `MAX_FREEHAND_POINTS` moves to the codec |
| OpenAPI             | `apps/api/src/openapi/schemas.generated.ts`                                          | regenerated from the type                                     |
| Factories           | `packages/document/src/factories.ts`                                                 | `createFreehand` packs; geometry stays unpacked               |
| Pen outline         | `packages/document/src/pen-stroke.ts`                                                | `freehandPenStroke` / `penStrokeSvg` decode                   |
| Eraser              | `packages/document/src/whiteboard-stroke.ts`                                         | decode; pieces re-pack                                        |
| SVG export          | `packages/document/src/svg-render-shapes.ts`                                         | decode                                                        |
| Stored migration    | `packages/document/src/stored-elements.ts`                                           | adds `migrateLegacyStrokePoints`                              |
| Canvas view         | `apps/live/components/canvas/boxed-element-overlays.tsx`                             | decode                                                        |
| Live ink            | `apps/live/components/canvas/whiteboard/LiveInk.tsx`                                 | unchanged: raw geometry through `PenStrokeSource`             |
| Pen gesture         | `apps/live/components/canvas/useWhiteboardPenGesture.ts`                             | ink type                                                      |
| Commit types        | `apps/live/components/canvas/Canvas.types.ts`                                        | `PenInk` owns `pressures`                                     |
| Pen commit          | `apps/live/hooks/canvas/commit-freehand.ts`                                          | pressures to `createFreehand`                                 |
| Style presets       | `apps/live/lib/style-presets.ts`                                                     | re-pack without pressures                                     |
| Excalidraw export   | `apps/live/lib/excalidraw-export.ts`                                                 | decode                                                        |
| Excalidraw import   | `apps/live/lib/excalidraw-import.ts`                                                 | `packFreehandPoints`                                          |
| Realtime            | `apps/live/app/document/[id]/useRoomConnection.ts`                                   | `migrateRoomOp` on receipt                                    |
| Clipboard           | `apps/live/lib/clipboard-payload.ts`                                                 | migrate before `isValidElement`                               |
| Tab file import     | `apps/live/lib/import-tab.ts`, `export-tab.ts`                                       | migrate; `TAB_SCHEMA_VERSION` 2                               |
| Change log          | `apps/live/lib/api/change-log.ts`, room `log` op                                     | migrate entry states                                          |
| Api writes          | `apps/api/src/routes/documents.ts`, `document-subresource-routes.ts`                 | `migrateStoredTab` before `isValidTab`                        |
| Api reads           | `apps/api/src/tab-row.ts`, `thumbnail.ts`                                            | unchanged (already migrate)                                   |
| Offline store       | `apps/live/lib/offline/offline-store.ts`                                             | unchanged (already migrates)                                  |
| MCP server          | `apps/mcp/src/tools.ts`                                                              | unchanged: writes through the api; reads migrated tabs        |
| Drive mirror        | `apps/live/lib/drive/livediagram-port.ts`                                            | unchanged: copies create through the api                      |
| Templates           | `packages/templates/src/template-builders-sailboat.ts`, `template-sailboat-scene.ts` | unchanged: `createFreehand`                                   |
| Shape recognition   | `apps/live/lib/recognition-preview.ts`, `recogniseBoardStroke`                       | unchanged: reads the live stroke, not an element              |
| Polygon tool        | `useCanvasPolygonGesture.ts`                                                         | unchanged: `createFreehand`                                   |
| Highlighter, pencil | `commit-freehand.ts`                                                                 | unchanged: `createFreehand`                                   |
| Path tool           | `PathElement.nodes`                                                                  | not a freehand: out of scope                                  |
| AI features         | `apps/api/src/ai-prompt.ts`, `apps/live/lib/api/ai.ts`                               | unchanged: AI never generates freehand                        |
| Undo                | `useEditorHistory.ts`                                                                | unchanged: element snapshots by reference                     |

## Data and persistence

| Field                          | Class    | Stored | Notes                  |
| ------------------------------ | -------- | ------ | ---------------------- |
| `FreehandElement.packedPoints` | document | yes    | Required; base64 block |
| `FreehandElement.points`       | legacy   | no     | Migration input only   |
| `FreehandElement.pressures`    | legacy   | no     | Migration input only   |

- **Snapshot / restore:** document snapshots and exports render through `svgFreehandShape`,
  which decodes. Undo snapshots hold element references, so the block is shared, not copied.
- **Migration (`migrateLegacyStrokePoints`):** for each freehand with an array `points` and no
  string `packedPoints`: drop points whose `nx` or `ny` is not finite; find the extent
  `[minNx, maxNx] x [minNy, maxNy]`; when it leaves `[0, 1]`, widen the box to
  `x + minNx' * width` (with `minNx' = min(0, minNx)`, `maxNx' = max(1, maxNx)`, likewise y) and
  renormalise; keep `pressures` when it is an array of the same length with every value a finite
  number in `[0, 1]`, else drop it; encode; delete `points` and `pressures`. An element with both
  `packedPoints` and `points` keeps `packedPoints` and loses the strays. Returns the input array
  when nothing changed.

## Errors and edge cases

| Case                                          | Handling                                                                            |
| --------------------------------------------- | ----------------------------------------------------------------------------------- |
| Empty stroke (0 points)                       | Valid block of 2 bytes (`AQA=`); draws nothing                                      |
| Single point                                  | One record; drawn as today (a dot for a pen, nothing for a polyline under 2 points) |
| Zero-width or zero-height box                 | Stores 0 on that axis; readers use `max(side, 1)` where they did                    |
| Coordinates at exactly 0 and 1                | 0 and 65535 exactly                                                                 |
| Legacy points outside `[0, 1]`                | Box widened in migration                                                            |
| Legacy non-finite points                      | Dropped in migration                                                                |
| Legacy pressures of the wrong length or range | Dropped in migration                                                                |
| Corrupt block reaching a renderer             | Empty, `[stroke-points] undecodable` logged once                                    |
| Block over the cache budget                   | Decoded, not cached                                                                 |
| Stale peer sends the former shape             | `migrateRoomOp` converts it before it is applied                                    |
| Stale browser saves the former shape          | The api migrates before validating                                                  |
| Version 2 export opened in an older editor    | Its existing schema-version refusal                                                 |

## Security and trust

- Untrusted strings are length-checked against `MAX_PACKED_POINTS_LENGTH` before decoding, so a
  hostile block cannot force a large allocation; the decode allocates `count` from the checked
  length only.
- The base64 decoder rejects anything outside the alphabet; it never calls `atob` on input.
- Migration runs before validation on every untrusted path; it only reshapes, it never trusts a
  field it does not check.

## Performance and limits

- Worst case per stroke: 20,000 points, 100,002 bytes, 133,336 characters (same point cap as
  before, a fifth of the former JSON).
- Decode: one pass over the bytes into three `Float64Array`s; 20,000 points in well under 1 ms.
- Cache budget: 500,000 points, 12 MB of `Float64Array` at most; every real board measured fits.
- Encode on commit and erase: linear in the stroke; the live ink never encodes.
- The bench records tab bytes, `JSON.parse` time, decode and first-draw time and allocations
  before and after (spec, "Measured wins").

## Observability

| Fingerprint                   | Where                       | When                                                                          |
| ----------------------------- | --------------------------- | ----------------------------------------------------------------------------- |
| `[stroke-points] undecodable` | `decodeStrokePoints`        | A block failed to decode at draw time                                         |
| `[stroke-points] migrated`    | `migrateLegacyStrokePoints` | Count of strokes converted, once per call that converted any (`console.info`) |

The api's existing `invalid tab` 400 covers a block that fails validation.

## Testing

| Spec rule                                                              | Test                                                                                |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Byte layout, version, flags, little-endian                             | `packages/document/src/stroke-points.test.ts`                                       |
| Round trip and precision bound (tiny, huge, degenerate, single, empty) | `stroke-points.test.ts`                                                             |
| Pressure present and absent, pressure precision                        | `stroke-points.test.ts`                                                             |
| Re-encoding a decoded block is stable                                  | `stroke-points.test.ts`                                                             |
| Every named rejection                                                  | `stroke-points.test.ts`                                                             |
| Encoder throws on non-finite, length mismatch, too many                | `stroke-points.test.ts`                                                             |
| Memoised decode: same arrays, bounded, LRU, oversize                   | `packages/document/src/stroke-points-cache.test.ts`                                 |
| Corrupt block draws nothing and logs once                              | `stroke-points-cache.test.ts`                                                       |
| Debug decoder and expansion                                            | `packages/document/src/stroke-points-debug.test.ts`                                 |
| Migration: shape, extent widening, pressures, idempotent               | `packages/document/src/legacy-stroke-points.test.ts`                                |
| Validation accepts packed, rejects former shape and corrupt            | `packages/document/src/validate.test.ts`                                            |
| Eraser split behaviour unchanged                                       | `packages/document/src/whiteboard-stroke.test.ts`                                   |
| Pen outline unchanged                                                  | `packages/document/src/pen-stroke.test.ts`                                          |
| SVG export within the bound                                            | `packages/document/src/svg-render-shapes.test.ts`, `stroke-points-fidelity.test.ts` |
| Api migrates former shape on create and save                           | `apps/api/src/routes/documents.test.ts`                                             |
| Clipboard and tab import migrate                                       | `apps/live/lib/clipboard-payload.test.ts`, `import-tab.test.ts`                     |
| Change-log entries migrate                                             | `apps/live/lib/api/change-log.test.ts`                                              |
| Live ink matches landed ink within the bound                           | `apps/live/components/canvas/whiteboard/WhiteboardPenPreview.test.tsx`              |

## Constants and configuration

| Constant                     | Value     | Provenance                                               | Safe range           |
| ---------------------------- | --------- | -------------------------------------------------------- | -------------------- |
| `STROKE_POINTS_VERSION`      | 1         | First binary layout                                      | 1 to 255             |
| `STROKE_POINT_STEPS`         | 65,535    | u16 range; 0.069 px worst error measured on a real board | fixed by the layout  |
| `STROKE_PRESSURE_STEPS`      | 255       | u8 range; pressure drives width only                     | fixed by the layout  |
| `STROKE_POINT_MAX_ERROR`     | 1/131,070 | Half a step                                              | derived              |
| `MAX_FREEHAND_POINTS`        | 20,000    | Unchanged from before                                    | 1 to 65,535          |
| `MAX_PACKED_POINTS_LENGTH`   | 133,336   | `4 * ceil((2 + 20,000 * 5) / 3)`                         | derived              |
| `STROKE_DECODE_CACHE_POINTS` | 500,000   | 7x the largest real board's 66,128 points; 12 MB         | 100,000 to 2,000,000 |

## Defaults ledger

See [DEFAULTS.md](./DEFAULTS.md), rows D1 to D6.
