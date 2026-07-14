# 87 — Excalidraw import & export

The Import and Export dialogs each gain an **Excalidraw** format: a `.excalidraw`
file (Excalidraw's plain-JSON save format, also what excalidraw.com's
"Save to disk" produces) can be imported into the active tab, and the active
tab can be exported as one. Import is the headline: it is near-lossless and is
the migration path for people arriving from Excalidraw. Export is deliberately
lossy (Excalidraw has ~8 element types to our ~20+) and follows the explicit
degradation table below — nothing degrades silently outside that table.

## Where it lives

- `apps/live/lib/excalidraw-import.ts` — `buildElementsFromExcalidraw(text)`,
  the parser/converter. Sibling of `markdown-import.ts`; lazy-loaded by
  `useTabImport` the same way. It never throws on bad input: it returns
  `{ ok: false, error }` with a human-readable message.
- `apps/live/lib/excalidraw-export.ts` — `tabToExcalidrawText(tab)`, a pure
  `Tab -> string` serialiser plugged into the Export dialog's text-panel
  registry (`TEXT_PANELS`), like `tabToJsonText` / `tabToMarkdownText`.
- Neither module is needed by the MCP worker or any other app, so they stay in
  `apps/live/lib` (Mermaid lives in `packages/diagram` only because the MCP
  server also renders it).

## The file envelope

An Excalidraw scene is `{ type: "excalidraw", version: 2, source, elements,
appState, files }`. Import requires `type === "excalidraw"` and an `elements`
array, tolerates any `version` (the format is additive in practice; unknown
fields are ignored), and skips `isDeleted` elements. Export emits `version: 2`
with `source: "https://livediagram.app"`, `appState.viewBackgroundColor` from
the tab's background colour, and an empty `files` map.

## Import mapping (`.excalidraw` → Tab)

Element ids are re-minted to fresh UUIDs inside the converter (with a map so
arrow bindings and group memberships follow), so nothing can collide with
elements already on the diagram — the JSON import's `remintElementIds` step is
not needed on this path.

| Excalidraw                        | livediagram                                                                                                                                      |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `rectangle`                       | `shape: 'square'` (`roundness` set → `borderRadius: 'md'`, absent → `'none'`)                                                                    |
| `ellipse`                         | `shape: 'circle'`                                                                                                                                |
| `diamond`                         | `shape: 'diamond'`                                                                                                                               |
| `frame` / `magicframe`            | `shape: 'frame'` with the frame's `name` as label                                                                                                |
| `text` with `containerId`         | the container's `label` (+ its text styling); the text element itself is consumed                                                                |
| `text` standalone                 | `text` element                                                                                                                                   |
| `arrow`                           | `arrow`; `startBinding`/`endBinding` → `pinned` endpoints at the nearest of the 8 anchors; 3+ points → `arrowStyle: 'curved'` with `curvePoints` |
| `line`, 2 points                  | `arrow` with `arrowEnds: 'none'`                                                                                                                 |
| `line`, 3+ points                 | `freehand` with `straightEdges: true`; first ≈ last point → `closed: true` + fill                                                                |
| `freedraw`                        | `freehand` (points normalised into the bounding box)                                                                                             |
| `image`                           | `image` placeholder (`imageId: null`) — bytes are NOT migrated in v1 (they'd need an R2 upload per file)                                         |
| `embeddable` / `iframe` / unknown | skipped; the count is returned in the result (`skipped`) so tests can assert it                                                                  |

Property mapping, applied to every imported element where present:

- `strokeColor` → `strokeColor` verbatim; `backgroundColor` → `fillColor`
  (`"transparent"` carries through as the CSS keyword, matching the unfilled
  Excalidraw look). Text elements use `strokeColor` as `textColor` (that is
  where Excalidraw keeps text ink).
- `strokeWidth` (1/2/4) → `thin` / `medium` / `thick` (≤1, ≤2.5, else).
- `strokeStyle` `solid`/`dashed`/`dotted` map 1:1.
- `opacity` 0–100 → 0–1 (100 → field omitted).
- `angle` (radians, clockwise) → `rotation` (degrees, clockwise); 0 omitted.
- `groupIds` → `groupId` from the **outermost** group (last entry) — our
  groups are one level, so the outermost is what keeps things moving together.
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
hachure / cross-hatch / zigzag flatten to solid), `seed`-based wobble, image
bytes (placeholder in v1), per-point pressure on freedraw strokes.

## Export degradation table (Tab → `.excalidraw`)

Every element exports — nothing is dropped — but only geometry, colours, label
text, links, groups, rotation, opacity and lock survive; livediagram-only
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
| `freehand`                                                                                                 | `freedraw`; `straightEdges` → `line` (closed polygons re-append the first point + fill)                                                              |
| `arrow`                                                                                                    | `arrow` with `startBinding`/`endBinding` for pinned ends, curve points flattened into the point list, label as bound text, arrowheads reverse-mapped |

Labels export as **bound text elements** (`containerId` + a `boundElements`
entry on the container) so they stay attached when edited in Excalidraw.
Reverse property maps mirror the import table (`thin`→1, `medium`→2,
`thick`/`extra-thick`→4; exotic dash patterns → `dashed`; degrees → radians;
0–1 opacity → 0–100). Colours resolve through `defaultFillColor` /
`defaultStrokeColor` / `defaultTextColor` so a theme-coloured diagram exports
with the colours you see, not blanks.

## UI

- **Import dialog** (spec/27 + spec/73): a fourth format card, "Excalidraw",
  opening the same paste-or-file panel; the file picker accepts
  `.excalidraw` + `.json`. Same replace-the-tab semantics + single undo step.
- **Export dialog** (spec/73): a seventh card in the text-format group with the
  view/edit/copy panel; download saves `<name>.excalidraw`
  (`application/json`).
- Telemetry (spec/22): `track('Tab', 'Imported', 'Excalidraw')` and
  `track('Diagram', 'Exported', 'Excalidraw')` — the existing category/action
  vocabulary, no schema change.
- Help centre: the Importing a Tab + Exporting a Tab articles list the format,
  and their registry keywords gain `excalidraw` so searching it finds them.

## Non-goals (v1)

- Migrating image bytes either direction (import gives a placeholder image
  element; export gives a labelled box).
- Rasterising exotic shapes into Excalidraw `image` elements — the labelled-box
  degrade is honest and keeps the exporter pure/sync; revisit if demand shows.
- `.excalidraw.png` / `.excalidraw.svg` embedded-scene files — JSON only.
- Reproducing the hand-drawn rendering style on our canvas.
