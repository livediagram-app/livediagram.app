# Excalidraw import & export

Excalidraw content reaches livediagram three ways, all through **one parser**:

- **Paste**: copy in Excalidraw, press Cmd/Ctrl+V on a livediagram canvas. On a
  whiteboard tab it lands as whiteboard-native content (marker strokes, shapes,
  text boxes that hug, stickies, arrows, a frame) as if drawn there; on a
  diagram tab it lands as diagram elements.
- **Import dialog**: a `.excalidraw` file (Excalidraw's plain-JSON save format,
  also what excalidraw.com's "Save to disk" produces), or a `.png` / `.svg`
  Excalidraw exported with its scene embedded, replaces the active tab.
- **Drop**: a `.excalidraw` file, or an Excalidraw PNG / SVG with an embedded
  scene, dropped on the canvas lands like a paste.

The parser turns Excalidraw into a [Board scene](board-scene.md), the
source-neutral intermediate every board import shares; the shared landing turns
that into elements for the tab's profile. Export is deliberately lossy
(Excalidraw has ~10 element types to our ~20+) and follows the explicit
degradation table below; nothing degrades silently outside that table.

## Where it lives

- `apps/live/lib/excalidraw-envelope.ts`: `readExcalidrawEnvelope(text)`, the
  envelope reader (detection, size cap, `JSON.parse`, the named rejections) and
  `looksLikeExcalidraw(text)`, the cheap prefix test a paste runs first.
- `apps/live/lib/excalidraw-scene.ts`: `excalidrawToBoardScene(envelope)`, the
  pure mapping from Excalidraw elements to a `BoardScene`. Helpers for colours,
  text and linear geometry sit beside it (`excalidraw-scene-*.ts`).
- `apps/live/lib/excalidraw-read.ts`: `sceneFromExcalidrawText(text)` (envelope,
  then scene, or the rejection's message) and `readExcalidrawFile(file)` (a
  dropped or pasted file: its scene, `not-excalidraw`, or an error). Never
  throws. Lazy-loaded by its callers, so the parser stays out of the editor's
  first bundle.
- `apps/live/lib/excalidraw-paste.ts`: the cheap, synchronous recognisers a paste
  or drop runs first: `excalidrawTextFromPaste(data)` and
  `isExcalidrawFileCandidate(file)`, plus the drop refusal copy.
- The Import dialog (`useTabImport`) reads the scene and hands it to the shared
  replace-the-tab commit (`useBoardSceneImport`, [Board scene](board-scene.md)),
  which lands it for the tab's profile and runs its images through the
  [Import image pipeline](import-image-pipeline.md) before the tab changes.
  `useClipboard` hands a pasted or dropped scene to the board-scene insert
  (`useBoardSceneInsert`); `usePaletteDrop` passes dropped files to it.
- `apps/live/lib/excalidraw-embedded.ts`: `extractExcalidrawScene(input)`,
  which finds the scene JSON inside an Excalidraw PNG or SVG export (see
  "Embedded-scene PNG and SVG") and hands plain JSON text through untouched.
- `apps/live/lib/excalidraw-export.ts`: `tabToExcalidrawText(tab)`, a pure
  `Tab -> string` serialiser plugged into the Export dialog's text-panel
  registry (`TEXT_PANELS`), like `tabToJsonText` / `tabToMarkdownText`.
- None of these is needed by the MCP worker or any other app, so they stay in
  `apps/live/lib` (Mermaid lives in `packages/document` only because the MCP
  server also renders it).

## Envelopes

Excalidraw writes three JSON envelopes; each carries an `elements` array and
an optional `files` map (`fileId` to `{ mimeType, dataURL }`, the bytes of each
image). The parser accepts all three:

| `type`                     | Where it comes from                                                      | Extra fields read                                          |
| -------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------- |
| `excalidraw/clipboard`     | Copy in Excalidraw (no `version`, no `appState`)                         | none                                                       |
| `excalidraw-api/clipboard` | Copy from an app embedding Excalidraw's component                        | none                                                       |
| `excalidraw`               | A saved scene (`.excalidraw`), or the scene inside an embedded PNG / SVG | `appState.viewBackgroundColor`, `appState.gridModeEnabled` |

- Detection is by content: the text's first characters must read
  `{"type":"excalidraw…` (whitespace allowed, as a saved file is indented), the
  `type` must be one of the three, and `elements` must be an array. `version`
  is tolerated whatever it is (the format is additive in practice; unknown
  fields are ignored).
- A text longer than `EXCALIDRAW_MAX_SCENE_CHARS` is refused **before**
  `JSON.parse`: _"This Excalidraw scene is too large to import."_
- Named rejections, each with its message: not JSON (_"File isn't valid
  JSON."_), not an object (_"Expected a JSON object at the top level."_), not
  Excalidraw (_"This isn't an Excalidraw scene (missing "type": "excalidraw")."_),
  no elements (_"Scene is missing its elements array."_), too large (above).
- A missing or malformed `files` reads as empty.
- `isDeleted` elements are skipped without a note (they are not content).

## Embedded-scene PNG and SVG

Excalidraw's PNG and SVG exports can carry the whole scene ("Embed scene" in
the export dialog, which also names the file `.excalidraw.png` /
`.excalidraw.svg`). Import reads the scene back out and runs it through the
same parser, images included (the embedded scene carries `files` too).

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
  payload marker, anything else as JSON. A PNG or SVG with no
  embedded scene fails with: _"This image doesn't contain an Excalidraw scene.
  In Excalidraw, export it with Embed scene switched on."_ A corrupt payload
  fails with: _"The Excalidraw scene inside this image couldn't be read."_
- The paste panel accepts SVG text as well (an SVG is text), so an exported SVG
  can be pasted as readily as a `.excalidraw` scene.

## Paste

Copying in Excalidraw puts the `excalidraw/clipboard` envelope on the system
clipboard twice: as `application/vnd.excalidraw.clipboard+json` and as
`text/plain` (Excalidraw's `copyToClipboard`; when the copy event is not
available it falls back to `navigator.clipboard.writeText`, which writes
`text/plain` only). It writes no HTML and no image. A browser paste event
exposes the custom type only to pages in the same browser engine, so:

- The paste reads `application/vnd.excalidraw.clipboard+json` first, then
  `text/plain`, and takes the first that passes `looksLikeExcalidraw`.
- It runs after the image-file branch and before our own element payload in
  `useClipboard`'s paste handler (the two envelopes cannot be confused: ours is
  `livediagram.elements`). Everything that already gates a canvas paste (a
  modal open, a text field focused, read-only, a label being edited) gates it
  too.
- A recognised paste on a **whiteboard** tab lands with the whiteboard profile;
  on a **diagram** or **event-storming** tab with the diagram profile.
- It lands through the shared board-scene insert ([Board scene](board-scene.md)):
  the scene's bounds centred on the canvas pointer when the pointer is over the
  canvas, else on the viewport centre; **one undo step**; the landed elements
  are **selected**, so the quick style panel restyles them at once; images go
  through the [Import image pipeline](import-image-pipeline.md) in insert mode.
- A paste that degraded or skipped anything shows the shared non-blocking
  paste notice; a lossless paste is silent.
- A text that looks like Excalidraw but fails to read shows the rejection's
  message as an error toast; the paste does nothing else.
- **Pasted files**: a `.excalidraw` file (by name or by the
  `application/vnd.excalidraw+json` type) is read and lands the same way. A
  pasted PNG or SVG is checked for an embedded scene first: with one, the scene
  lands; without one, it is an ordinary image paste, as before.
- **Dropped files** (on a tab that is not read-only): the same files land at the point
  they are released. Any other dropped file (a photo, a PNG or SVG without a scene) is
  refused with an info toast: _"Only Excalidraw files, or images exported from
  Excalidraw with the scene embedded, can be dropped on the canvas."_ A photo dropped on
  an event-storming board still goes to the wall reader first
  ([Event storming](../021-event-storming/event-storming.md)).

## Scene mapping (Excalidraw to board scene)

Checked against real clipboard copies (two boards, 827 elements: rectangles,
text, lines, freedraw, arrows, diamonds, ellipses, a frame, sticky notes).
Coordinates are canvas px and stay absolute; every item's `key` is the
Excalidraw element id (the landing re-mints ids). `authoredOn` is `unknown`:
neither envelope records a theme. Items keep the scene's z-order (below).

| Excalidraw                                         | Board scene item                                                                                                                                                                                                                                                                                                                                                   |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `rectangle`                                        | `shape` `rectangle`; `rounded` when `roundness` is set (type 1 legacy, 2 proportional, 3 adaptive)                                                                                                                                                                                                                                                                 |
| `ellipse`                                          | `shape` `ellipse`                                                                                                                                                                                                                                                                                                                                                  |
| `diamond`                                          | `shape` `diamond`; `rounded` when `roundness` is set                                                                                                                                                                                                                                                                                                               |
| `text` with a `containerId`                        | the container's `label` (`shape`, `sticky`) or the arrow's `label` (`connector`); consumed. A container that is not in the scene leaves it standalone                                                                                                                                                                                                              |
| `text` standalone                                  | `text` with the element's box; `autoWidth` from `autoResize` (absent reads `true`); the unwrapped `originalText` (else `text`)                                                                                                                                                                                                                                     |
| `freedraw`                                         | `ink`: absolute points; `p` from `pressures` when `simulatePressure` is `false` and there is one pressure per point; `closed` when the ends coincide (within `EXCALIDRAW_CLOSE_EPSILON_PX`), the repeated end point dropped; `streamline` from `strokeOptions.streamline` (Excalidraw's default 0.5 when absent); a non-transparent background is the ink's `fill` |
| `line`                                             | `polyline`: absolute points; `closed` when `polygon` is `true` or the ends coincide (3+ points); `curved` when `roundness` is set and there are 3+ points; a non-transparent background on a closed line is its `fill`; arrowheads as `heads`                                                                                                                      |
| `arrow`                                            | `connector`: absolute points; `from` / `to` the keys of the bound elements when they are in the scene; `curved` when `roundness` is set, it bends (3+ points) and it is not `elbowed` (an elbow or sharp arrow is not curved; the landing draws its bends as a curve and says so); `heads` per the table below; bound text as `label`                              |
| `stickynote`                                       | `sticky` with the element's box and `backgroundColor` as `fill`; its bound text as `text`                                                                                                                                                                                                                                                                          |
| `frame` / `magicframe`                             | `frame` with its `name`; the elements inside it (`frameId`) stay ordinary items                                                                                                                                                                                                                                                                                    |
| `image`                                            | `image` with `asset` = `fileId` (the element id when absent); a `crop` sets `crop`. Its `files` entry with a `dataURL` becomes a `data-url` asset, once per `fileId`                                                                                                                                                                                               |
| `embeddable`, `iframe`, `selection`, anything else | skipped, counted in a note by its type                                                                                                                                                                                                                                                                                                                             |

Properties, applied wherever present:

- **Colours** are passed through as light-reference `SceneColour`s: Excalidraw
  stores light-mode colours and paints dark mode by inverting the canvas, so a
  stored `#1e1e1e` is what a dark-mode user saw as white. The landing decides
  which colours become adaptive ink or stock colours ([Board scene](board-scene.md));
  the parser never does. `#rgb` expands to `#rrggbb`, `#rrggbbaa` splits into
  hex and `alpha`, `transparent` is no colour (no fill; a `transparent` stroke
  is a shape with `stroke: null`). Any other value (a CSS name, `rgb()`) is
  unreadable: the stroke falls back to `ink`, a fill to none, and a note counts it.
- `opacity` (0 to 100) multiplies into every colour the element paints: the
  stroke's `opacity`, the fill's and the text's `alpha`. 100 is omitted.
- **Stroke width**: `strokeWidth` px for shapes, lines and arrows. Freedraw
  reports the width Excalidraw paints: `strokeWidth × 2.8` for constant-width
  strokes (`strokeOptions.variability: 'constant'`), `strokeWidth × 4.25` for
  variable ones (absent options read as variable, as in Excalidraw).
- `strokeStyle` `solid` / `dashed` / `dotted` map to `dash` 1:1.
- **Rotation**: `angle` (radians, clockwise) becomes `rotationDeg` on boxed
  items; linear items (`freedraw`, `line`, `arrow`) have it baked into their
  points, rotated about the element's centre.
- **Text**: `fontSize` px is `fontPx` exactly (sizes are continuous, 13 to 63 px
  in the real boards). `fontFamily` 1 (Virgil) and 5 (Excalifont) are `hand`;
  3 (Cascadia) and 8 (Comic Shanns) are `mono`; every other family is `sans`.
  `textAlign` and `verticalAlign` map 1:1 (Excalidraw draws bound text centred
  and middle, standalone text left and top). The text colour is the text
  element's `strokeColor`. Line breaks are kept.
- **Arrowheads**: `arrow` to `arrow`, `bar` to `bar`, `triangle` to
  `triangle`, `triangle_outline` to `triangle-hollow`, `dot` and `circle` to
  `circle`, `circle_outline` to `circle-hollow`, `diamond` to `diamond`,
  `diamond_outline` to `diamond-hollow`; `crowfoot_one`, `crowfoot_many` and
  `crowfoot_one_or_many` (and any unknown head) to `arrow` with a note. On an `arrow`, a missing
  `endArrowhead` field reads as Excalidraw's default `arrow`; `null` is no head.
- **Bindings**: only the bound element's id is read. Excalidraw's `fixedPoint`
  and `mode` (`orbit`, `inside`) are not: the landing pins each bound end to the
  target's anchor nearest the arrow's end point.
- `locked` is kept; `link` (a URL string) becomes `link`.
- **Z-order**: when every element carries a string `index` (Excalidraw's
  fractional order key), items are ordered by it (plain string comparison,
  which is the keys' order), the array order breaking ties; otherwise the
  array order stands.
- `appState.viewBackgroundColor` (saved scenes only) becomes the scene
  background's colour and `appState.gridModeEnabled` its `grid` pattern.

## What degrades

Each degradation is a scene note: a rule (its final, user-facing sentence), a
count and a kind, shown by the shared report (import) or paste notice (paste)
as "count · rule". The landing adds its own rules on top ([Board scene](board-scene.md):
dashed pen strokes, bar heads, sharp bends, filled pen strokes, links).

| Rule (copy)                                               | Kind     | Counted                                                            |
| --------------------------------------------------------- | -------- | ------------------------------------------------------------------ |
| "Groups were dropped"                                     | degraded | per distinct group id among the items                              |
| "Tapered strokes drawn at an even width"                  | degraded | per freedraw with `variability: 'variable'` and simulated pressure |
| "Arrowheads with no match here drawn as plain arrowheads" | degraded | per crow's-foot or unknown head                                    |
| "Arrow labels moved to the middle of their arrow"         | degraded | per arrow label whose `labelPosition` is set and not 0.5           |
| "Colours that couldn't be read use the ink"               | degraded | per unreadable colour value                                        |
| "<Type> elements were skipped"                            | skipped  | per skipped element, by its type (e.g. "Embeddable elements…")     |

An image whose `fileId` has no `dataURL` is not a note: it is the image
pipeline's `missing-bytes` placeholder, reported there.

Accepted loss, by design and without a note (it is a matter of look, not
content): the hand-drawn wobble (`roughness`, `seed`), hachure / cross-hatch /
zigzag fill styles (drawn solid), the frame's clipping of its children, a
sticky note's creation-date footer, an image's exact `crop` rectangle and its
flip (`scale` of -1), and the Excalifont typeface itself (drawn in our
hand-drawn font).

## Landing, per profile

The landing is [Board scene](board-scene.md)'s, one for every source:

- **Whiteboard profile** (a whiteboard tab): ink as marker strokes with
  pressure where recorded, adaptive ink and stock colours, text boxes that hug
  their text at the exact font size, stickies, whiteboard shapes, arrows
  pinned to their shapes, the frame.
- **Diagram profile** (a diagram or event-storming tab, and the Import
  dialog on such a tab): the element mapping this importer has always had:
  rectangles as `square` shapes (rounded corners as `md`), ellipses as
  `circle`, diamonds, frames, text elements, arrows with pinned ends and curve
  points, two-point lines as headless arrows, longer lines and freedraw as
  `freehand` (straight-edged for lines), images, and the scene background as
  the tab's background colour.

## Images

Every `image` element becomes one image request keyed by its `fileId`, so an
image used twice in the scene is stored once. The request's source is the
`dataURL` from `files`; a `fileId` that `files` lacks is `missing-bytes`.
The shared commit (an import's replace or a paste's insert, [Board scene](board-scene.md))
opens one import session for the document, resolves every request, fills
`imageId` / `naturalWidth` / `naturalHeight` on the elements that stored, and
only then changes the tab, so either stays one undo step. Limits, offline handling, failures and the
report are the pipeline's ([Import image pipeline](import-image-pipeline.md)).

## Export degradation table (Tab → `.excalidraw`)

Every element exports (nothing is dropped), but only geometry, colours, label
text, links, rotation, opacity and lock survive (`groupIds` is always empty); livediagram-only
behaviour (animations, markers, notes, comments, actions, non-URL links,
layers: the list flattens) does not. Export emits `version: 2` with
`source: "https://livediagram.app"`, `appState.viewBackgroundColor` from the
tab's background colour, and an empty `files` map. Kind by kind:

| livediagram                                                                                                | Excalidraw                                                                                                                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `square`                                                                                                   | `rectangle` (`borderRadius: 'none'` → sharp, else rounded)                                                                                                                                                                                         |
| `circle`, `annotation`                                                                                     | `ellipse`                                                                                                                                                                                                                                          |
| `diamond`                                                                                                  | `diamond`                                                                                                                                                                                                                                          |
| `stadium`                                                                                                  | `rectangle` with rounded corners                                                                                                                                                                                                                   |
| every other shape kind (cylinder, cloud, actor, devices, progress, charts, code block, checklist, icon, …) | `rectangle` carrying the label: the documented "labelled box" degrade                                                                                                                                                                              |
| `frame`                                                                                                    | `rectangle` (transparent fill) with the frame label                                                                                                                                                                                                |
| `text`                                                                                                     | `text`                                                                                                                                                                                                                                             |
| `sticky`                                                                                                   | `rectangle` with the sticky fill + bound label                                                                                                                                                                                                     |
| `table`                                                                                                    | `rectangle` placeholder (cells don't survive; the label does if set)                                                                                                                                                                               |
| `image`                                                                                                    | `rectangle` placeholder labelled with the alt text (bytes live in R2, not the export)                                                                                                                                                              |
| `link-card`                                                                                                | `rectangle` with the card title/URL as label + the `link`                                                                                                                                                                                          |
| `freehand`                                                                                                 | `freedraw`; `straightEdges` → `line`. Any `closed` stroke re-appends the first point + fill, pencil sketches included. A whiteboard pen stroke's recorded pressures travel (`simulatePressure: false`); without them Excalidraw simulates pressure |
| `arrow`                                                                                                    | `arrow` with `startBinding`/`endBinding` for pinned ends, curve points flattened into the point list, label as bound text, arrowheads reverse-mapped                                                                                               |

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
  single undo step; on a whiteboard tab the scene lands with the whiteboard
  profile, elsewhere with the diagram profile. While images upload the footer
  beside the buttons reads "Importing images 3 of 12…"; an import with images
  or notes ends on the shared report instead of closing.
- **Export dialog** ([Mermaid import & export](mermaid.md)): a seventh card in the text-format group with the
  view/edit/copy panel; download saves `<name>.excalidraw`
  (`application/json`).
- Telemetry ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md)): `track('Tab', 'Imported', type)` with
  `Excalidraw` for a scene, `ExcalidrawPng` / `ExcalidrawSvg` for an embedded
  scene, `track('Element', 'Imported', 'Excalidraw')` for a paste or drop on
  the canvas, and `track('Document', 'Exported', 'Excalidraw')`. The existing
  category/action vocabulary, no schema change.
- Help centre: the Importing a Tab + Exporting a Tab articles list the format,
  the importing article explains pasting from Excalidraw, and their registry
  keywords gain `excalidraw` so searching it finds them.

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
- Rasterising exotic shapes into Excalidraw `image` elements: the labelled-box
  degrade is honest and keeps the exporter pure/sync; revisit if demand shows.
- Reproducing the hand-drawn rendering style on our canvas.
