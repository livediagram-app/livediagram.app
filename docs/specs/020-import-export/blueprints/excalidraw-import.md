# Excalidraw import: blueprint

Derived from [Excalidraw import & export](../excalidraw-import-export.md): the parser from
Excalidraw to a board scene, paste and drop on the canvas, images, embedded-scene PNG / SVG, and
the dialog's progress and report. The scene-mapping table and the degradation copy are the spec's
and are not restated. The landing is [Board scene](../board-scene.md)'s. Defaults are ledgered in
[DEFAULTS.md](DEFAULTS.md).

Scope, by file:

| File                                                 | Role                                                                        |
| ---------------------------------------------------- | --------------------------------------------------------------------------- |
| `apps/live/lib/excalidraw-types.ts`                  | The slice of Excalidraw's format the parser reads (types only)              |
| `apps/live/lib/excalidraw-envelope.ts`               | `looksLikeExcalidraw`, `readExcalidrawEnvelope`: detection, cap, rejections |
| `apps/live/lib/excalidraw-scene.ts`                  | `excalidrawToBoardScene`: elements to scene items, order, notes             |
| `apps/live/lib/excalidraw-scene-style.ts`            | Colours, opacity, widths, dashes, fonts, text, arrowheads                   |
| `apps/live/lib/excalidraw-scene-geometry.ts`         | Absolute points, rotation baking, closure                                   |
| `apps/live/lib/excalidraw-fixtures.ts`               | Typed builder of synthesised Excalidraw elements and envelopes (tests only) |
| `apps/live/lib/excalidraw-import.ts`                 | Import dialog converter: envelope, scene, `landBoardScene`                  |
| `apps/live/lib/excalidraw-paste.ts`                  | Scene text or file out of a paste / drop's data                             |
| `apps/live/lib/excalidraw-embedded.ts`               | `extractExcalidrawScene`: PNG / SVG / JSON input to scene text              |
| `apps/live/hooks/canvas/useClipboard.ts`             | One branch: an Excalidraw paste goes to the board-scene insert              |
| `apps/live/hooks/canvas/usePaletteDrop.ts`           | One branch: a dropped Excalidraw file goes to the board-scene insert        |
| `apps/live/hooks/persistence/useTabImport.ts`        | Runs extraction, the converter, the pipeline, then one replace              |
| `apps/live/components/dialogs/TextImportPanel.tsx`   | Progress label; hands the outcome to the dialog                             |
| `apps/live/components/dialogs/ImportTabDialog.tsx`   | Shows the report view when the outcome carries one                          |
| `apps/live/components/dialogs/ImportImageReport.tsx` | The report view                                                             |
| `apps/telemetry/app/event-explanations.ts`           | Explanations for `ExcalidrawPng` / `ExcalidrawSvg` and the paste            |

## Domain and naming

| Term            | Identifier                  | Meaning                                                                          |
| --------------- | --------------------------- | -------------------------------------------------------------------------------- |
| Envelope        | `ExcalidrawEnvelope`        | `{ type, elements, files, appState? }`, read and checked                         |
| Envelope type   | `ExcalidrawEnvelopeType`    | `'excalidraw' \| 'excalidraw/clipboard' \| 'excalidraw-api/clipboard'`           |
| Element         | `ExcalidrawElement`         | The read slice of one element (every field optional)                             |
| Files map       | `ExcalidrawFiles`           | `fileId → { mimeType?, dataURL? }`                                               |
| Rejection       | `ExcalidrawRejection`       | `'too-large' \| 'not-json' \| 'not-object' \| 'not-excalidraw' \| 'no-elements'` |
| Board scene     | `BoardScene`                | [Board scene](../board-scene.md); `source: 'excalidraw'`                         |
| Embedded scene  | `ExcalidrawContainer`       | `'json' \| 'png' \| 'svg'`: where the scene was found                            |
| Encoded wrapper | `EncodedSceneWrapper`       | `{ version?, encoding: 'bstring', compressed, encoded }`                         |
| Profile         | `'whiteboard' \| 'diagram'` | Which landing the tab gets: whiteboard tabs `whiteboard`, all else `diagram`     |
| Import progress | `ImportImageProgress`       | From the pipeline                                                                |

## Constants and configuration

| Constant                           | Value                                         | Provenance                                                                                | Safe range          |
| ---------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------- |
| `EXCALIDRAW_MAX_SCENE_CHARS`       | `64 * 1024 * 1024`                            | Excalidraw caps one image at 4 MiB (`MAX_ALLOWED_FILE_BYTES`): about a dozen as data URLs | 8 Mi to 128 Mi      |
| `EXCALIDRAW_DETECT_PREFIX_CHARS`   | `256`                                         | Room for an indented saved file's opening `"type"` line plus leading whitespace           | 64 to 1024          |
| `EXCALIDRAW_CLOSE_EPSILON_PX`      | `1`                                           | Our exporter repeats the first point exactly; 1 px absorbs float noise only               | 0 to 2              |
| `EXCALIDRAW_FREEDRAW_WIDTH_FACTOR` | `{ constant: 2.8, variable: 4.25 }`           | Excalidraw `shape.ts`: laser-pointer radius `1.4 × w`; perfect-freehand size `4.25 × w`   | fixed by the source |
| `EXCALIDRAW_LABEL_POSITION_MIDDLE` | `0.5`                                         | Excalidraw's default `labelPosition`                                                      | fixed by the source |
| `EXCALIDRAW_CLIPBOARD_MIME`        | `'application/vnd.excalidraw.clipboard+json'` | Excalidraw `MIME_TYPES.excalidrawClipboard`                                               | fixed by the source |
| `EXCALIDRAW_FILE_MIME`             | `'application/vnd.excalidraw+json'`           | Excalidraw `MIME_TYPES.excalidraw`                                                        | fixed by the source |
| `EXCALIDRAW_FONT_FAMILY`           | `{ hand: [1, 5], mono: [3, 8] }`              | Excalidraw `FONT_FAMILY`: Virgil 1, Cascadia 3, Excalifont 5, Comic Shanns 8              | fixed by the source |

## Interfaces and contracts

```ts
export function looksLikeExcalidraw(text: string): boolean;
export function readExcalidrawEnvelope(
  text: string,
):
  | { ok: true; envelope: ExcalidrawEnvelope }
  | { ok: false; rejection: ExcalidrawRejection; error: string };
export function excalidrawToBoardScene(envelope: ExcalidrawEnvelope): BoardScene;
export function buildElementsFromExcalidraw(
  text: string,
  profile: 'whiteboard' | 'diagram',
): ExcalidrawImportResult; // { ok: true, elements, images, report, backgroundColor? } | { ok: false, error }
export function excalidrawTextFromPaste(data: Pick<DataTransfer, 'getData'>): string | null;
export function isExcalidrawFileCandidate(file: File): boolean;
```

## Behaviour and state

### Envelope (`readExcalidrawEnvelope(text)`)

1. `text.length > EXCALIDRAW_MAX_SCENE_CHARS` → `too-large`.
2. `JSON.parse` throws → `not-json`.
3. Not a non-array object → `not-object`.
4. `type` not an `ExcalidrawEnvelopeType` → `not-excalidraw`.
5. `elements` not an array → `no-elements`.
6. `files` not a plain object → `{}`. `appState` kept only for `type: 'excalidraw'`.
7. Elements that are not objects, or are `isDeleted`, are dropped here.

`looksLikeExcalidraw(text)`: the first `EXCALIDRAW_DETECT_PREFIX_CHARS` characters match
`/^\s*\{\s*"type"\s*:\s*"excalidraw(?:\/clipboard|-api\/clipboard)?"/`. No parse.

### Scene (`excalidrawToBoardScene(envelope)`)

1. **Order**: every element has a string `index` → stable sort by it (`<` on strings); else array
   order.
2. **Keys**: `key` = element `id`; an element without an id gets `excalidraw-<position>`.
3. **Bound text**: a `text` whose `containerId` names an element in the envelope is consumed by that
   container (rectangle, ellipse, diamond, stickynote: `label` / `text`; arrow: `label`). A
   container of another type does not consume it.
4. **Per type** per the spec's table; boxed items carry `x`, `y`, `width`, `height` (each at least
   1. and `rotationDeg` = `angle × 180 / π` when non-zero.
5. **Linear points**: `abs = (x + px, y + py)`; with `angle` non-zero each point rotates by `angle`
   about the element's centre `(x + width / 2, y + height / 2)`.
6. **Closure**: freedraw: ends within `EXCALIDRAW_CLOSE_EPSILON_PX` with 3+ points → `closed`, last
   point dropped. Line: `polygon === true` (last point dropped when it repeats the first) or the
   same geometric rule.
7. **Pressure**: freedraw `simulatePressure === false` and `pressures.length === points.length` →
   each point's `p` = `pressures[i]` clamped to 0..1.
8. **Connector ends**: `startBinding.elementId` / `endBinding.elementId` naming an element that
   lands as an item (not consumed, not skipped) → `from` / `to`.
9. **Heads**: `startArrowhead` / `endArrowhead` mapped per the spec; for `arrow`, an absent
   `endArrowhead` key is `arrow`.
10. **Notes**: counted per the spec's degradation table, in rule order; zero counts omitted.
11. **Background**: `appState.viewBackgroundColor` a readable colour → `background.colour`;
    `appState.gridModeEnabled === true` → `background.pattern: 'grid'`.
12. `source: 'excalidraw'`, `authoredOn: 'unknown'`, `assets` from `files` once per `fileId`
    referenced by an image item and carrying a string `dataURL`.

### Style (`excalidraw-scene-style.ts`)

- `readColour(value)`: `transparent` → `none`; `#rgb` / `#rrggbb` / `#rrggbbaa` (any case) →
  `{ hex: lower-case '#rrggbb', alpha? }` (alpha `aa / 255`, omitted when 1); anything else →
  `unreadable`. A stroke `none` on a shape → `stroke: null`; on a linear item → `ink` + no note
  (an invisible line has no colour to keep). `unreadable` → `ink` (stroke, text) or no fill + a
  `excalidraw.colour` note.
- `opacity` (0..100) → factor `o / 100` clamped to 0..1, applied to stroke `opacity`, fill and
  text `alpha` (multiplied into any alpha the colour carries). Factor 1 omits the field.
- Widths per the spec; dash `strokeStyle` `dashed` / `dotted` → same, else `solid` omitted.
- `fontFamily` → `hand` / `mono` / `sans` per `EXCALIDRAW_FONT_FAMILY`.
- Text: `{ text: originalText ?? text ?? '', fontPx: fontSize ?? 20, family, colour,
alignX, alignY }` (Excalidraw's default font size is 20).

### `extractExcalidrawScene(input: Uint8Array | string)` → `{ ok: true, text, container }` or `{ ok: false, error }`

1. Bytes starting with the PNG signature → PNG path. Bytes otherwise decode as UTF-8 text.
2. Text containing `payload-type:application/vnd.excalidraw+json` → SVG path.
3. Text whose first non-space characters are `<svg` or `<?xml` without the marker → error
   `NO_SCENE`.
4. Anything else → `{ ok: true, text, container: 'json' }` (the converter reports JSON errors).

PNG path: walk chunks from byte 8 (`length` u32 BE, 4-byte type, data, CRC); stop at `IEND` or the
end. For each `tEXt`: split data at the first `0x00`; keyword (Latin-1) equal to
`application/vnd.excalidraw+json` → value (Latin-1) → `decodeWrapperText`. No such chunk →
`NO_SCENE`. A chunk whose length runs past the end → `BAD_SCENE`.

SVG path: `/<!-- payload-start -->\s*(.+?)\s*<!-- payload-end -->/s`; none → `BAD_SCENE`.
Version from `/<!-- payload-version:(\d+) -->/`, default `1`. `atob` the payload (throw →
`BAD_SCENE`); version ≠ 1: the binary string is the text; version 1: bytes decoded as UTF-8. Then
`decodeWrapperText`.

`decodeWrapperText(text)`: `JSON.parse` (throw → `BAD_SCENE`). No `encoded` key: a parsed
`type === 'excalidraw'` → the text itself (legacy); else `BAD_SCENE`. `encoding !== 'bstring'` →
`BAD_SCENE`. `compressed`: byte string → bytes → `DecompressionStream('deflate')` → UTF-8 text
(throw → `BAD_SCENE`). Not compressed: byte string → bytes → `TextDecoder('utf-8', { fatal: true })`;
a throw → the byte string itself (oldest exports stored raw text).

Messages: `NO_SCENE` = "This image doesn't contain an Excalidraw scene. In Excalidraw, export it
with Embed scene switched on."; `BAD_SCENE` = "The Excalidraw scene inside this image couldn't be
read."

### Converter (`buildElementsFromExcalidraw(text, profile)`)

1. `readExcalidrawEnvelope(text)`; a rejection → `{ ok: false, error }` (the rejection's message).
2. `excalidrawToBoardScene(envelope)`.
3. `landBoardScene(scene, { profile, placement: { kind: 'origin' }, mintId: crypto.randomUUID })`.
4. `{ ok: true, elements, images: imageRequests, report, backgroundColor? }`; `backgroundColor`
   from the land result's tab patch.

### `useTabImport`

- `importExcalidraw(input, onProgress)`: lock check; `extractExcalidrawScene(input)` (error →
  `{ status: 'error', error }`); `buildElementsFromExcalidraw(text, profile)` with the active tab's
  profile; images through the pipeline; one replace of the tab; `track('Tab', 'Imported',
'Excalidraw' | 'ExcalidrawPng' | 'ExcalidrawSvg')`; `{ status: 'done', images?, report? }`.
- File accept for `excalidraw`: `.excalidraw,.json,application/json,.png,image/png,.svg,image/svg+xml`.
- The active tab's id is captured before the awaits; the replace targets that id (D7).

### Paste (`useClipboard`)

- After the image-file branches and before `parseElementsPayload`:
  `excalidrawTextFromPaste(e.clipboardData)` reads `EXCALIDRAW_CLIPBOARD_MIME`, then
  `text/plain`, and returns the first that passes `looksLikeExcalidraw`.
- A hit: `preventDefault`, `readExcalidrawEnvelope`; a rejection → `toast.error(message)` and
  stop. Otherwise `excalidrawToBoardScene` → the board-scene insert with the tab's profile, at the
  canvas pointer (null → the insert's viewport centre) → `track('Element', 'Imported',
'Excalidraw')`.
- A file in the paste or drop that `isExcalidrawFileCandidate` (name ends `.excalidraw`, or type
  `EXCALIDRAW_FILE_MIME`, `image/png` or `image/svg+xml`) is read as bytes,
  `extractExcalidrawScene` runs, and a found scene lands as above; a PNG or SVG with no scene
  continues as the ordinary image paste or drop; a `.excalidraw` file that fails shows its error.

### Dialog

- `ImportOutcome` `done` gains `images?: ImportImageReport`.
- `TextImportPanel`: runners receive `onProgress`. While busy with `progress.total > 0` the
  footer's left slot (where a format's note sits) reads `Importing images {done} of {total}…` in an
  `aria-live="polite"` region; the primary button reads `Importing…` and has a minimum width
  (`min-w-[7.5rem]`) so neither label swap moves a button. On `done` it calls `onDone(outcome)`.
- `ImportTabDialog`: `onDone(outcome)` with `outcome.images` → the dialog shows
  `<ImportImageReport report onDone={onClose} />` in place of the panel; otherwise `onClose()`.

## Presentation and UX

`ImportImageReport` view, inside the existing dialog body (the amber warning stays out: the
replace has happened):

- Heading `Import complete` (`h3`, `text-sm font-semibold`).
- One line per `describeImportImageReport(report).lines`, in a list (`text-sm`).
- When failures exist: a list, each `"{count} · {sentence}"`, muted (`text-xs text-slate-600`,
  dark `text-slate-300`).
- `hint` as a final muted line.
- Footer: primary `Done` button, right-aligned, closing the dialog.
- Subtitle of the dialog: `Here's how your images came across.`

Copy is the pipeline spec's; pluralisation `1 image` / `2 images`, `1 placeholder` /
`2 placeholders`.

## Accessibility

- The report container has `role="status"` so the result is announced on arrival.
- `Done` receives focus when the report mounts; Enter / Space closes; Escape closes (dialog).
- Progress is announced from the footer's `aria-live="polite"` region, which exists before the
  count starts so each change is read.
- Contrast: body `slate-700` / muted `slate-600` on white, `slate-300` on `slate-900`: ≥ 4.5:1.

## Web Experience

- The pipeline and extractor are lazy-imported on import only: no editor bundle growth (LCP).
- The report replaces the panel in the same dialog box; the dialog keeps its size class, so no
  layout shift outside the dialog (CLS). Progress appears in the footer's left slot and the primary button has a minimum width, so
  no trigger moves while it counts.
- Uploads run off the input handler's path (awaited promises), so typing and canvas interaction stay
  responsive (INP).

## Errors and edge cases

| Case                                           | Handling                                                        |
| ---------------------------------------------- | --------------------------------------------------------------- |
| Text above the cap                             | `too-large` before parsing                                      |
| Clipboard text that only looks like Excalidraw | Error toast with the rejection's message; nothing lands         |
| Bound text whose container was not copied      | Standalone text                                                 |
| Binding to an element not in the scene         | That end is free                                                |
| Element without `id`                           | Synthetic key; it cannot be bound to                            |
| Freedraw with 0 or 1 points                    | An ink item with what there is; the landing draws a dot         |
| Some elements lack `index`                     | Array order for all                                             |
| Unknown type                                   | Skipped with an `excalidraw.skipped:<type>` note                |
| PNG without the chunk                          | `NO_SCENE` inline error (dialog); ordinary image (paste / drop) |
| Truncated PNG / bad base64 / bad inflate       | `BAD_SCENE` inline error                                        |
| SVG not from Excalidraw                        | `NO_SCENE`                                                      |
| Scene with images but no `files`               | Every image `missing-bytes`; import succeeds                    |
| Tab locked                                     | Existing error, before any upload                               |
| All images fail                                | Import succeeds with placeholders; report explains              |
| Pipeline module fails to load                  | Runner throws → the panel's existing catch-all error            |

## Security and trust

- Clipboard and file content is untrusted: the cap applies before `JSON.parse`; every field is
  type-checked before use (numbers must be finite, strings strings); nothing is evaluated.
- `link` is passed as a string; the landing's link validation applies.
- Image bytes go only through the pipeline, which sniffs and re-encodes them.

## Performance and limits

- The real 705-element copy parses to a scene in well under 50 ms (one pass plus a sort).
- A paste of ordinary text costs one regular expression on at most 256 characters.
- Element count limits are the landing's (`MAX_ELEMENTS_PER_TAB`).

## Assets and external resources

| Asset                                                         | Source                                                                                               | Licence                                                                    |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `apps/live/lib/__fixtures__/excalidraw-export.excalidraw.png` | excalidraw.com, Export image, Embed scene on, 1x, PNG, of a scene holding one text and one rectangle | Our own drawing; Excalidraw's output format is MIT (excalidraw/excalidraw) |
| `apps/live/lib/__fixtures__/excalidraw-export.excalidraw.svg` | The same scene and dialog, SVG                                                                       | As above                                                                   |

Regenerate by loading that scene on excalidraw.com (drop the `.excalidraw` file on the canvas),
opening Export image (Ctrl+Shift+E), switching Embed scene on and exporting each format. The text
must read `Imported from Excalidraw`, which the tests assert.

## Observability

- `[excalidraw-import]` `console.info` with `{ container, elements, images, skipped }` on success;
  `console.warn` with the error name on `NO_SCENE` / `BAD_SCENE`.
- `[excalidraw-paste]` `console.info` with `{ envelope, items, notes }` when a paste lands;
  `console.warn` with the rejection on a refused paste or file.
- The pipeline's own `[import-images]` lines cover every image.

## Testing

| Rule                                               | Test                                                                     |
| -------------------------------------------------- | ------------------------------------------------------------------------ |
| Envelope detection, cap, every rejection           | `apps/live/lib/excalidraw-envelope.test.ts`                              |
| Prefix test: three types, indented, ordinary text  | `apps/live/lib/excalidraw-envelope.test.ts`                              |
| Order by `index`, ties, missing indices, deleted   | `apps/live/lib/excalidraw-scene.test.ts`                                 |
| Shapes, roundness types, bound labels              | `apps/live/lib/excalidraw-scene.test.ts`                                 |
| Standalone text: autoResize, size, family, lines   | `apps/live/lib/excalidraw-scene.test.ts`                                 |
| Freedraw: points, pressure, widths, closure        | `apps/live/lib/excalidraw-scene.test.ts`                                 |
| Lines: two-point, multi-point, polygon, curved     | `apps/live/lib/excalidraw-scene.test.ts`                                 |
| Arrows: bindings, heads, curved, elbowed, label    | `apps/live/lib/excalidraw-scene.test.ts`                                 |
| Sticky note, frame, groups note                    | `apps/live/lib/excalidraw-scene.test.ts`                                 |
| Images and assets, missing bytes                   | `apps/live/lib/excalidraw-scene.test.ts`                                 |
| Colours, opacity, unreadable colour note           | `apps/live/lib/excalidraw-scene-style.test.ts`                           |
| Rotation baked into linear points                  | `apps/live/lib/excalidraw-scene-geometry.test.ts`                        |
| Unknown types noted, never thrown                  | `apps/live/lib/excalidraw-scene.test.ts`                                 |
| Diagram profile keeps today's mapping              | `apps/live/lib/excalidraw-import.test.ts`                                |
| Whiteboard profile                                 | `apps/live/lib/excalidraw-import.test.ts`                                |
| Paste text pick (custom type, text/plain, neither) | `apps/live/lib/excalidraw-paste.test.ts`                                 |
| Paste routes to the insert per profile             | `apps/live/hooks/canvas/useClipboard.test.ts`                            |
| Image requests from `files`, key = fileId          | `apps/live/lib/excalidraw-import.test.ts`                                |
| PNG compressed / uncompressed / legacy             | `apps/live/lib/excalidraw-embedded.test.ts` (fixtures built in the test) |
| SVG v1 / v2 payloads                               | `apps/live/lib/excalidraw-embedded.test.ts`                              |
| No scene / corrupt scene messages                  | `apps/live/lib/excalidraw-embedded.test.ts`                              |
| JSON passthrough                                   | `apps/live/lib/excalidraw-embedded.test.ts`                              |
| Report copy                                        | `apps/live/lib/import-images/report.test.ts`                             |
| Images stored as WebP, report, focus               | `apps/live/e2e/import-images.spec.ts`                                    |
| Full gallery: placeholders + sentence              | `apps/live/e2e/import-images.spec.ts` (403 via route)                    |
| Real PNG export imports its content                | `apps/live/e2e/import-images.spec.ts`                                    |
| Paste on a whiteboard: lands, selected, one undo   | `apps/live/e2e/excalidraw-paste.spec.ts`                                 |

Real input is never a fixture: `apps/live/scripts/excalidraw-verify.ts <path>` (data-free) runs a
real copy through parser and landing and prints counts and notes.
