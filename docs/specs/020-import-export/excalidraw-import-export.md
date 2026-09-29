# Excalidraw import & export

The Import and Export dialogs each gain an **Excalidraw** format: a `.excalidraw`
file (Excalidraw's plain-JSON save format, also what excalidraw.com's
"Save to disk" produces), or a `.png` / `.svg` Excalidraw exported with its
scene embedded, can be imported into the active tab, and the active tab can be
exported as a `.excalidraw` file. Import is the headline: it is near-lossless and is
the migration path for people arriving from Excalidraw. Export is deliberately
lossy (Excalidraw has ~8 element types to our ~20+) and follows the explicit
degradation table below — nothing degrades silently outside that table.

## Where it lives

- `apps/live/lib/excalidraw-import.ts` — `buildElementsFromExcalidraw(text)`,
  the parser/converter. Sibling of `markdown-import.ts`; lazy-loaded by
  `useTabImport` the same way. It never throws on bad input: it returns
  `{ ok: false, error }` with a human-readable message. It stays pure and
  synchronous: image elements come back as placeholders plus one image request
  each, which `useTabImport` runs through the
  [Import image pipeline](import-image-pipeline.md) before the tab changes.
- `apps/live/lib/excalidraw-embedded.ts`: `extractExcalidrawScene(input)`,
  which finds the scene JSON inside an Excalidraw PNG or SVG export (see
  "Embedded-scene PNG and SVG" below) and hands plain `.excalidraw` text through
  untouched.
- `apps/live/lib/excalidraw-export.ts` — `tabToExcalidrawText(tab)`, a pure
  `Tab -> string` serialiser plugged into the Export dialog's text-panel
  registry (`TEXT_PANELS`), like `tabToJsonText` / `tabToMarkdownText`.
- Neither module is needed by the MCP worker or any other app, so they stay in
  `apps/live/lib` (Mermaid lives in `packages/document` only because the MCP
  server also renders it).

## The file envelope

An Excalidraw scene is `{ type: "excalidraw", version: 2, source, elements,
appState, files }`. Import requires `type === "excalidraw"` and an `elements`
array, tolerates any `version` (the format is additive in practice; unknown
fields are ignored), and skips `isDeleted` elements. `files` maps a `fileId`
to `{ mimeType, dataURL }`, the bytes of each image on the board; a missing or
malformed `files` reads as empty.

## Embedded-scene PNG and SVG

Excalidraw's PNG and SVG exports can carry the whole scene ("Embed scene" in
the export dialog, which also names the file `.excalidraw.png` /
`.excalidraw.svg`). Import reads the scene back out and runs it through the
same converter, images included (the embedded scene carries `files` too).

- **PNG:** a `tEXt` chunk with the keyword `application/vnd.excalidraw+json`.
  Its Latin-1 text is JSON: either an encoded wrapper
  `{ version: "1", encoding: "bstring", compressed, encoded }`, or, from older
  Excalidraw, the scene JSON itself. `encoded` is a byte string (one character
  per byte); `compressed: true` means those bytes are zlib-deflated scene JSON
  (inflated with the browser's `DecompressionStream('deflate')`), otherwise they
  are the scene's UTF-8 bytes (or, from the oldest exports, the scene text
  itself when the bytes are not valid UTF-8).
- **SVG:** the text between `<!-- payload-start -->` and
  `<!-- payload-end -->`, present when the SVG names
  `payload-type:application/vnd.excalidraw+json`. It is base64. With
  `<!-- payload-version:2 -->` the decoded bytes are the wrapper's JSON as a
  byte string; with version 1 (or no version) they are UTF-8 JSON. The wrapper
  then decodes as for PNG.
- Detection is by content, not by file name: PNG by its signature, SVG by the
  payload marker, anything else as `.excalidraw` JSON. A PNG or SVG with no
  embedded scene fails with: _"This image doesn't contain an Excalidraw scene.
  In Excalidraw, export it with Embed scene switched on."_ A corrupt payload
  fails with: _"The Excalidraw scene inside this image couldn't be read."_
- The paste panel accepts SVG text as well (an SVG is text), so an exported SVG
  can be pasted as readily as a `.excalidraw` scene. Export emits `version: 2`
  with `source: "https://livediagram.app"`, `appState.viewBackgroundColor` from
  the tab's background colour, and an empty `files` map.

## Import mapping (`.excalidraw` → Tab)

Element ids are re-minted to fresh UUIDs inside the converter (with a map so
arrow bindings follow), so nothing can collide with
elements already on the diagram — the JSON import's `remintElementIds` step is
not needed on this path.

| Excalidraw                        | livediagram                                                                                                                                                                                                                            |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rectangle`                       | `shape: 'square'` (`roundness` set → `borderRadius: 'md'`, absent → `'none'`)                                                                                                                                                          |
| `ellipse`                         | `shape: 'circle'`                                                                                                                                                                                                                      |
| `diamond`                         | `shape: 'diamond'`                                                                                                                                                                                                                     |
| `frame` / `magicframe`            | `shape: 'frame'` with the frame's `name` as label                                                                                                                                                                                      |
| `text` with `containerId`         | the container's `label` (+ its text styling); the text element itself is consumed                                                                                                                                                      |
| `text` standalone                 | `text` element                                                                                                                                                                                                                         |
| `arrow`                           | `arrow`; `startBinding`/`endBinding` → `pinned` endpoints at the nearest anchor the shape offers; 3+ points → `arrowStyle: 'curved'` with `curvePoints`                                                                                |
| `line`, 2 points                  | `arrow` with `arrowEnds: 'none'`                                                                                                                                                                                                       |
| `line`, 3+ points                 | `freehand` with `straightEdges: true`; first ≈ last point → `closed: true` + fill                                                                                                                                                      |
| `freedraw`                        | `freehand` (points normalised into the bounding box); first ≈ last point → `closed: true` + fill, same geometric rule as `line`                                                                                                        |
| `image`                           | `image`; its `fileId`'s bytes go through the [Import image pipeline](import-image-pipeline.md), `naturalWidth`/`naturalHeight` from the stored image; a `crop` → `objectFit: 'cover'`; a failure stays a placeholder (`imageId: null`) |
| `embeddable` / `iframe` / unknown | skipped; the count is returned in the result (`skipped`) so tests can assert it                                                                                                                                                        |

Property mapping, applied to every imported element where present:

- `strokeColor` → `strokeColor` verbatim; `backgroundColor` → `fillColor`
  (`"transparent"` carries through as the CSS keyword, matching the unfilled
  Excalidraw look). Text elements use `strokeColor` as `textColor` (that is
  where Excalidraw keeps text ink).
- `strokeWidth` (1/2/4) → `thin` / `medium` / `thick` (≤1, ≤2.5, else).
- `strokeStyle` `solid`/`dashed`/`dotted` map 1:1.
- `opacity` 0–100 → 0–1 (100 → field omitted).
- `angle` (radians, clockwise) → `rotation` (degrees, clockwise); 0 omitted.
- `groupIds` are **dropped**: livediagram has no groups
  ([Web components are elements; groups are gone](../009-elements/web-components-and-no-groups.md)), so grouped elements arrive
  as separate elements in the same places.
- `locked` → `locked`; `link` (a URL string) → `link: { kind: 'url', url }`.
- `fontSize` → `textSize`: ≤16 `sm`, ≤22 `md`, else `lg`. `fontFamily` 1
  (hand-drawn) → `caveat`, 3 (code) → `roboto-mono`, else default.
  `textAlign` → `textAlignX`, `verticalAlign` → `textAlignY`.
- Arrowheads: `arrow`→`line`, `bar`→`line`, `triangle`→`triangle`,
  `triangle_outline`→`triangle-hollow`, `dot`/`circle`→`circle`,
  `circle_outline`→`circle-hollow`, `diamond`→`diamond`,
  `diamond_outline`→`diamond-hollow`. `arrowEnds` derives from which of
  start/end carry a head (an absent `endArrowhead` field counts as Excalidraw's
  default `arrow`).
- `appState.viewBackgroundColor` → the tab's `backgroundColor` (kept only when
  the scene sets one).

Accepted loss on import: the hand-drawn aesthetic (`roughness`, `fillStyle`
hachure / cross-hatch / zigzag flatten to solid), `seed`-based wobble,
per-point pressure on freedraw strokes, an image's exact `crop` rectangle (the
image fills its box, centred) and its flip (`scale` of -1).

## Images

Every `image` element becomes one image request keyed by its `fileId`, so a
image used twice on the board is stored once. The request's source is the
`dataURL` from `files`; a `fileId` that `files` lacks is `missing-bytes`.
`useTabImport` opens one import session for the diagram, resolves every request,
fills `imageId` / `naturalWidth` / `naturalHeight` on the elements that stored,
and only then replaces the tab. Limits, offline handling, failures and the
report are the pipeline's ([Import image pipeline](import-image-pipeline.md)).

## Export degradation table (Tab → `.excalidraw`)

Every element exports — nothing is dropped — but only geometry, colours, label
text, links, rotation, opacity and lock survive (`groupIds` is always empty); livediagram-only
behaviour (animations, markers, notes, comments, actions, non-URL links,
layers — the list flattens) does not. Kind by kind:

| livediagram                                                                                                | Excalidraw                                                                                                                                           |
| ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `square`                                                                                                   | `rectangle` (`borderRadius: 'none'` → sharp, else rounded)                                                                                           |
| `circle`, `annotation`                                                                                     | `ellipse`                                                                                                                                            |
| `diamond`                                                                                                  | `diamond`                                                                                                                                            |
| `stadium`                                                                                                  | `rectangle` with rounded corners                                                                                                                     |
| every other shape kind (cylinder, cloud, actor, devices, progress, charts, code block, checklist, icon, …) | `rectangle` carrying the label — the documented "labelled box" degrade                                                                               |
| `frame`                                                                                                    | `rectangle` (transparent fill) with the frame label                                                                                                  |
| `text`                                                                                                     | `text`                                                                                                                                               |
| `sticky`                                                                                                   | `rectangle` with the sticky fill + bound label                                                                                                       |
| `table`                                                                                                    | `rectangle` placeholder (cells don't survive; the label does if set)                                                                                 |
| `image`                                                                                                    | `rectangle` placeholder labelled with the alt text (bytes live in R2, not the export)                                                                |
| `link-card`                                                                                                | `rectangle` with the card title/URL as label + the `link`                                                                                            |
| `freehand`                                                                                                 | `freedraw`; `straightEdges` → `line`. Any `closed` stroke re-appends the first point + fill, pencil sketches included                                |
| `arrow`                                                                                                    | `arrow` with `startBinding`/`endBinding` for pinned ends, curve points flattened into the point list, label as bound text, arrowheads reverse-mapped |

Labels export as **bound text elements** (`containerId` + a `boundElements`
entry on the container) so they stay attached when edited in Excalidraw.
Reverse property maps mirror the import table (`thin`→1, `medium`→2,
`thick`/`extra-thick`→4; exotic dash patterns → `dashed`; degrees → radians;
0–1 opacity → 0–100). Colours resolve through `defaultFillColor` /
`defaultStrokeColor` / `defaultTextColor` so a theme-coloured diagram exports
with the colours you see, not blanks.

## UI

- **Import dialog** ([Markdown import](markdown-import.md) + [Mermaid import & export](mermaid.md)): a fourth format card, "Excalidraw",
  opening the same paste-or-file panel; the file picker accepts
  `.excalidraw`, `.json`, `.png` and `.svg`. Same replace-the-tab semantics +
  single undo step. While images upload the footer beside the buttons reads
  "Importing images 3 of 12…"; an import with images ends on the pipeline's
  report instead of closing.
- **Export dialog** ([Mermaid import & export](mermaid.md)): a seventh card in the text-format group with the
  view/edit/copy panel; download saves `<name>.excalidraw`
  (`application/json`).
- Telemetry ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md)): `track('Tab', 'Imported', type)` with
  `Excalidraw` for a scene, `ExcalidrawPng` / `ExcalidrawSvg` for an embedded
  scene, and `track('Diagram', 'Exported', 'Excalidraw')`. The existing
  category/action vocabulary, no schema change.
- Help centre: the Importing a Tab + Exporting a Tab articles list the format,
  and their registry keywords gain `excalidraw` so searching it finds them.

## Follow-up: excalidraw.com share links

A share link (`https://excalidraw.com/#json=<id>,<key>`) can be imported
entirely in the browser, without our server, and is specified here for a later
change:

- The `#json=` fragment never leaves the browser, so the key stays private;
  the editor reads `<id>` and `<key>` from the pasted link.
- `GET https://json.excalidraw.com/api/v2/<id>` returns the encrypted scene.
  It answers with `Access-Control-Allow-Origin: *` and needs no preflight
  (a plain GET), so the editor can fetch it directly.
- The body is Excalidraw's chunked buffer: a 4-byte version, then
  length-prefixed chunks `[encoding metadata JSON, 12-byte IV, ciphertext]`.
  The ciphertext decrypts with AES-GCM using the key imported as a JWK
  (`{ kty: 'oct', alg: 'A128GCM', k: <key> }`) via Web Crypto, inflates with
  `DecompressionStream('deflate')`, and splits again into
  `[contents metadata JSON, scene JSON bytes]`. Links made before that format
  are one AES-GCM blob with the IV prefixed (or a zero IV); both are known.
- Images live beside it in Firebase Storage,
  `https://firebasestorage.googleapis.com/v0/b/excalidraw-room-persistence.appspot.com/o/files%2FshareLinks%2F<id>%2F<fileId>?alt=media`
  (also `Access-Control-Allow-Origin: *`), each the same chunked, encrypted,
  deflated buffer whose contents are a `data:` URL, which then enters the
  [Import image pipeline](import-image-pipeline.md) like a file's image.
- Risk: both endpoints are excalidraw.com's own, undocumented backend; a change
  there breaks the import without warning, so failures must name the source
  ("excalidraw.com didn't return this scene") rather than blame the file.

Status: specified, not built. It needs a binary decoder, two legacy branches
and a network failure surface of its own.

## Non-goals

- Migrating image bytes on **export** (export gives a labelled box).
- Rasterising exotic shapes into Excalidraw `image` elements — the labelled-box
  degrade is honest and keeps the exporter pure/sync; revisit if demand shows.
- Reproducing the hand-drawn rendering style on our canvas.
