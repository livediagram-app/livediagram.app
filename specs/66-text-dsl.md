# Text DSL — human-editable round-trip format

A plain-text language that represents a tab's full graph: nodes, the
**connections between them**, and styling, in a form a person can read,
hand-edit, diff, paste into a chat, or generate from a script. Importing
the text rebuilds the diagram; exporting a diagram emits the text. The two
are a **round-trip** from day one — text out, text back in, same graph.

This is the format Markdown export was never meant to be. Our Markdown
outline (spec/27, `export-tab-text.ts`) is a human _summary_: it drops
unlabelled arrows and keys edges on label strings, so the relationships
don't survive. The DSL keeps every node's **id** and writes edges as
`id -> id`, so the connection graph is preserved exactly.

## Why a native DSL, not Mermaid

Mermaid is the obvious reference, but it can't express our model: it has
no concept of our eight compass anchors, arrow-to-arrow messages
(spec/50), freehand strokes, curve/elbow handles, tables, device frames,
or per-tab background + theme. Adopting Mermaid would make export lossy
and import ambiguous. A native language maps **1:1** to the element model
in `packages/diagram`, so the round-trip is faithful. (Mermaid stays a
candidate for a _later_, explicitly-lossy interop importer — see
Boundaries.)

## The shape of the language

One file = one tab. A `diagram` block holds tab-level settings, then node
declarations, then edges. The common case is terse; richness lives in
optional `{ … }` attribute blocks. Geometry is optional — omit `@ x,y` and
auto-layout (spec/47) places the node. Colours are omitted by default; the
theme owns them (same rule the MCP format follows, spec/62).

```
diagram "Checkout flow" {
  theme: ocean
  font: inter
  background: dots

  # nodes —  <id> <shape> "label"  [@ x,y  WxH]  [{ attrs }]
  start  stadium   "Start"
  login  square    "Log in"     @ 40,120  220x90
  valid  diamond   "Valid?"
  dash   circle    "Dashboard"
  db     cylinder  "Users DB"   { textSize: 18 }

  # non-shape elements key on their type
  note     sticky  "Rate-limit this"
  caption  text    "Checkout v2"

  # edges —  <from> -> <to>  [: "label"]  [{ attrs }]
  start    -> login
  login    -> valid  : "submit"
  valid.s  -> dash    : "yes"                 # explicit anchor via .s
  valid.e  -> login   : "no"   { style: curved }
  dash     -> db       { ends: both, head: hollow-triangle, line: dashed }
  db       -> (640,400)                        # free endpoint, raw coords
}
```

### How it maps to the model (`packages/diagram/src/index.ts`)

- **Nodes** → `BoxedElement`. The keyword is the `ShapeKind` for a
  `shape` element (default `square`), or the element `type` for
  `text/sticky/image/freehand/table/annotation/link-card`. `@ x,y WxH`
  sets `x/y/width/height`; omit to let auto-layout decide. `"…"` is the
  `label`.
- **Edges** → `ArrowElement`. `a -> b` builds an arrow whose `from`/`to`
  are **`pinned` endpoints** referencing the node ids — the real graph
  relationship. `a.s -> b.e` pins explicit `anchor`s (the 8 compass
  points; bare ids let auto-rebind choose). `: "…"` is the arrow `label`.
  `(x,y)` is a `free` endpoint. `edgeId@0.6` is an `on-arrow` endpoint
  (spec/50) at param `t`.
- **Attribute blocks** cover everything else, one model field per key:
  `ends` (`from/to/both/none`), `head` (arrowheadShape), `style`
  (`straight/curved/angled`), `line` (strokeStyle), `width`
  (strokeWidth), `flow`, `textSize`, `font`, `link`, marker, etc. Any
  field not given falls back to the model default and is **omitted on
  export** for readability.
- **`diagram { … }` settings** → `Tab` presentation fields: `theme`,
  `font`, `background` (pattern) + `backgroundColor`/`patternColor`/
  opacity/scale, `defaultTextSize`, `locked`.

Element ids are diagram-scoped (spec/05), so ids in the text are stable
and an exported file re-imports to an identical graph. Ids in the DSL are
identifier-shaped (`[A-Za-z0-9_-]`) — exported ids are UUIDs, which qualify;
a hand-authored id must avoid `.`, `@`, `:`, and whitespace since the
endpoint syntax reserves those.

## The round-trip contract

- **Export** (`serializeTab`): every field that differs from its default
  is written; defaults are dropped so the text stays readable. Ids are the
  elements' real ids.
- **Import** (`parseTab`): tolerant — unknown keys warn but don't fail,
  whitespace/comments (`#`) are free, edges may appear before the nodes
  they reference (two-pass), and a referenced-but-undeclared id becomes an
  implicit untitled node so a hand-written sketch still renders.
- **Faithful by construction:** `parseTab(serializeTab(tab))` reproduces
  the same elements (ids, shapes, labels, pinned endpoints, styling).
  Freehand point arrays and image data are emitted as compact inline
  payloads (or referenced), not redrawn — the one place "readable" yields
  to "lossless". A unit test asserts the round-trip on a fixture covering
  every element kind and endpoint kind.

## How it's triggered

Reuses the existing Export/Import dialogs (spec/27), adding a third format
beside **livediagram file** (`.json`) and **Markdown** (`.md`):

- **Text (`.lvd`)** — export writes the DSL; import parses it, replacing
  the active tab's contents in one `commitTabs` step (Undo restores, same
  as Markdown import). The format picker drives the file filter and which
  serializer/parser runs — no content auto-detection.

Emits `Tab / Exported / Text` and `Tab / Imported / Text` telemetry
(spec/22), matching the existing JSON/Markdown actions.

## Placement (reuse, not a god file)

The parser and serializer are pure `Tab ⇄ string` and belong in
**`packages/diagram`** alongside `auto-layout.ts`, so `apps/live`,
`apps/mcp`, and `apps/api` can all reuse them rather than copying:

```
packages/diagram/src/text-dsl/
  parse.ts        # parseTab(source): { tab, warnings }
  serialize.ts    # serializeTab(tab): string
  grammar.ts      # token/keyword tables derived from the model constants
```

Built from the diagram package's exported constants
(`SHAPE_KINDS`, `ANCHORS`, `ELEMENT_TYPES`, `THEMES`) so the keyword set
never drifts from the model — the same single-source discipline the MCP
schema uses (spec/62). `apps/live` wires the dialogs and dynamic-imports
the module so it stays out of the initial editor bundle.

## Boundaries / future

- **Lossy by choice:** freehand/image payloads are encoded, not
  human-pretty — readability stops at vector content.
- **Mermaid interop (later, separate):** a `flowchart`/`graph` _importer_
  that maps Mermaid edges onto pinned arrows and leans on auto-layout
  (spec/47 already anticipates it). Explicitly lossy and one-way-ish; the
  native `.lvd` DSL remains the round-trip format, Mermaid is convenience
  ingest. Tracked here, not built with the first pass.

See also [spec/05](05-diagram-structure.md) (element model),
[spec/27](27-markdown-import.md) (Import/Export dialogs + the Markdown
summary it complements), [spec/47](47-layout-cleanup.md) (auto-layout for
un-positioned nodes), [spec/50](50-arrow-to-arrow.md) (on-arrow
endpoints), and [spec/62](62-mcp-server.md) (the structured element format
this mirrors as human-facing syntax).
