# Excalidraw import: blueprint

Derived from [Excalidraw import & export](../excalidraw-import-export.md), covering the import side's
images, embedded-scene PNG / SVG, and the dialog's progress and report. The element mapping tables
are the spec's and are not restated. Defaults are ledgered in [DEFAULTS.md](DEFAULTS.md).

Scope, by file:

| File                                                 | Role                                                                    |
| ---------------------------------------------------- | ----------------------------------------------------------------------- |
| `apps/live/lib/excalidraw-import.ts`                 | Converter; now returns `images: ImportImageRequest[]`                   |
| `apps/live/lib/excalidraw-embedded.ts`               | `extractExcalidrawScene`: PNG / SVG / JSON input to scene text          |
| `apps/live/lib/import-tab.ts`                        | `ImportOutcome` gains the report; `pickTabFile` also returns the `File` |
| `apps/live/hooks/persistence/useTabImport.ts`        | Runs extraction, the converter, the pipeline, then one replace          |
| `apps/live/hooks/persistence/useTabActions.ts`       | Passes `diagramId` through                                              |
| `apps/live/components/dialogs/TextImportPanel.tsx`   | Progress label; hands the outcome to the dialog                         |
| `apps/live/components/dialogs/ImportTabDialog.tsx`   | Shows the report view when the outcome carries one                      |
| `apps/live/components/dialogs/ImportImageReport.tsx` | The report view                                                         |
| `apps/telemetry/app/event-explanations.ts`           | Explanations for `ExcalidrawPng` / `ExcalidrawSvg`                      |

## Domain and naming

| Term            | Identifier                 | Meaning                                                  |
| --------------- | -------------------------- | -------------------------------------------------------- |
| Scene           | Excalidraw scene JSON text | `{ type: 'excalidraw', elements, appState, files }`      |
| Files map       | `files`                    | `fileId → { mimeType?, dataURL? }`                       |
| Embedded scene  | `ExcalidrawContainer`      | `'json' \| 'png' \| 'svg'`: where the scene was found    |
| Encoded wrapper | `EncodedSceneWrapper`      | `{ version?, encoding: 'bstring', compressed, encoded }` |
| Import progress | `ImportImageProgress`      | From the pipeline                                        |

## Behaviour and state

### Converter (`buildElementsFromExcalidraw(text)`)

- Success result gains `images: ImportImageRequest[]`, one per imported `image` element, in
  element order: `{ elementId, key: fileId ?? elementId, source, hint: { width, height } }`.
- `source`: `files[fileId]?.dataURL` a non-empty string → `{ kind: 'data-url', dataUrl }`; else
  `null` (`missing-bytes`). A `files` that is not a plain object reads as `{}`.
- An element with a non-null `crop` object gains `objectFit: 'cover'`.
- Everything else unchanged; the converter stays synchronous and pure.

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

### `useTabImport`

- Deps gain `ownerId: string` and `diagramId: string | null`.
- `importTextIntoActiveTab(format, text, onProgress?)` and `importIntoActiveTab(format,
onProgress?)`. The file path for `excalidraw` reads `new Uint8Array(await file.arrayBuffer())`;
  the text path passes the string. Both go to `importExcalidraw(input, onProgress)`:
  1. Lock check (existing).
  2. `extractExcalidrawScene(input)`; error → `{ status: 'error', error }`.
  3. `buildElementsFromExcalidraw(text)`; error → as today.
  4. `images.length > 0`: lazy-import the pipeline, `createBrowserImportImageSession({ ownerId,
diagramId })`, `attachImportImages(elements, images, session, onProgress)`.
  5. Replace the tab once with the patched elements (existing `replaceActiveTabContent`).
  6. `track('Tab', 'Imported', container === 'png' ? 'ExcalidrawPng' : container === 'svg' ?
'ExcalidrawSvg' : 'Excalidraw')`.
  7. `{ status: 'done', images: report }` when `images.length > 0`, else `{ status: 'done' }`.
- File accept for `excalidraw`: `.excalidraw,.json,application/json,.png,image/png,.svg,image/svg+xml`.
- The active tab's id is captured before the awaits; the replace targets that id, so switching
  tabs mid-upload still imports into the tab the dialog named (D7).

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

| Case                                     | Handling                                             |
| ---------------------------------------- | ---------------------------------------------------- |
| PNG without the chunk                    | `NO_SCENE` inline error                              |
| Truncated PNG / bad base64 / bad inflate | `BAD_SCENE` inline error                             |
| SVG not from Excalidraw                  | `NO_SCENE`                                           |
| Scene with images but no `files`         | Every image `missing-bytes`; import succeeds         |
| Tab locked                               | Existing error, before any upload                    |
| All images fail                          | Import succeeds with placeholders; report explains   |
| Pipeline module fails to load            | Runner throws → the panel's existing catch-all error |

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
- The pipeline's own `[import-images]` lines cover every image.

## Testing

| Rule                                      | Test                                                                                            |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Image requests from `files`, key = fileId | `apps/live/lib/excalidraw-import.test.ts`                                                       |
| Missing file → `null` source              | `apps/live/lib/excalidraw-import.test.ts`                                                       |
| `crop` → `objectFit: 'cover'`             | `apps/live/lib/excalidraw-import.test.ts`                                                       |
| PNG compressed / uncompressed / legacy    | `apps/live/lib/excalidraw-embedded.test.ts` (fixtures built with the same encoding in the test) |
| SVG v1 / v2 payloads                      | `apps/live/lib/excalidraw-embedded.test.ts`                                                     |
| No scene / corrupt scene messages         | `apps/live/lib/excalidraw-embedded.test.ts`                                                     |
| JSON passthrough                          | `apps/live/lib/excalidraw-embedded.test.ts`                                                     |
| Report copy                               | `apps/live/lib/import-images/report.test.ts`                                                    |
| Images stored as WebP, report, focus      | `apps/live/e2e/import-images.spec.ts`                                                           |
| Full gallery: placeholders + sentence     | `apps/live/e2e/import-images.spec.ts` (403 via route)                                           |
| Real PNG export imports its content       | `apps/live/e2e/import-images.spec.ts`                                                           |
