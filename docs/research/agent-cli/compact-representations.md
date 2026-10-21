# Compact representations and query views for the agent CLI

Research for the `livediagram` CLI (`livediagram <resource> <verb>`), whose first reader is an AI agent.
Question: how should a tab be written out so a model can read, reason about and edit it at the lowest token cost,
and which query views earn a place beside the default outline? Measured on 2026-10-03.

## Summary

- **Raw tab JSON is 11x the cost of an outline that carries nearly the same meaning.** For a 30-element
  architecture tab, the pretty JSON the MCP's `read_document` returns today costs **4,213 tokens**; the proposed
  outline costs **386**; Mermaid costs 232 but drops ids, notes, comments and every non-graph element.
- **Identifiers are the single biggest lever.** UUIDs are 37% of minified JSON (55 UUIDs at 22 tokens each).
  The same outline costs 970 tokens with UUIDs and 386 with short refs.
- **Use shortest-unique id prefixes (git-style, at least 4 characters) as refs**, and use a slug id verbatim when the
  element already has one. Avoid positional refs (`e1..eN`, as in Playwright): they are cheap but change between
  reads, and these documents are edited live by other people.
- **The default read is an indented outline**: one line per element, containment by indentation, outgoing edges
  inline on the source line, reading order standing in for position, no geometry and no styling.
- **Ship eight views over one model**: `overview`, `outline` (default), `graph`, `layout`, `comments`, `show <ref>`,
  `find`, `diff`, plus `--json` and `--raw` escape hatches. Each answers one kind of question; most cost under
  300 tokens on the test tab.
- **Budgets are explicit and never silent.** `--budget 2k` degrades fidelity in steps (notes, then attributes,
  then leaf collapse) and always ends with an elision line naming what was hidden and how to see it.
- **Estimate tokens at chars/3, not chars/4.** chars/4 under-counts the outline by 23% and the JSON by 35%.

## 1. What a read is for

An agent reads a tab for one of seven reasons. Each wants different information, which is why one format cannot
serve all of them cheaply:

| Need                | Typical prompt                               | Wants                                       | Does not want                 |
| ------------------- | -------------------------------------------- | ------------------------------------------- | ----------------------------- |
| Orient              | "What is in this document?"                  | tabs, sizes, open threads, freshness        | any element                   |
| Understand          | "Explain this architecture"                  | labels, grouping, connections, notes        | coordinates, colours, anchors |
| Reason on structure | "What depends on Orders?", "find cycles"     | nodes and edges only, with edge ids         | prose, styling                |
| Edit precisely      | "Rename Payments, add Redis under Auth"      | stable refs, containment, one element fully | the rest of the canvas        |
| Follow discussion   | "Answer the open comments"                   | open threads with element context           | resolved threads, geometry    |
| Catch up            | "What changed since you last looked?"        | additions, removals, renames, moves         | everything unchanged          |
| Arrange             | "Put the databases in a column on the right" | geometry, rows and columns                  | notes, comments               |

## 2. Prior art

| System                         | Representation                                                                                                                                                                                                                            | Refs                                                                                                  | Views and budgets                                                                                                  | What we take                                                                                                |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Playwright ARIA snapshot / MCP | YAML-ish tree: `- button "Submit" [ref=e12]`, role then accessible name, children indented                                                                                                                                                | `e<N>`, valid for the latest snapshot only                                                            | whole page, or a subtree                                                                                           | role + name + ref per line; indentation is containment; no geometry by default                              |
| playwright-cli                 | same snapshot, but **written to a file**; the command prints the path                                                                                                                                                                     | same                                                                                                  | `snapshot <ref>` (subtree), `--depth=N`, `--boxes` (opt-in geometry), `find <text>` (grep with 3 lines of context) | subtree, depth, opt-in geometry and search as separate verbs; large output goes to a file, not into context |
| browser-use                    | flat list of only the interactive, visible elements, `[12]<button>Submit</button>`                                                                                                                                                        | per-step numeric index                                                                                | filtered to what can be acted on                                                                                   | filter to what matters; but per-step indices are the unstable kind we avoid                                 |
| Accessibility trees            | role, name, state, children                                                                                                                                                                                                               | platform ids                                                                                          | none                                                                                                               | meaning without pixels is enough for most reasoning                                                         |
| tldraw agent starter kit       | three tiers: `BlurryShape` `{shapeId, type, text, x, y, w, h}` for everything in view, `FocusedShape` (full detail) for the shapes in play, `PeripheralShapeCluster` `{bounds, numberOfShapes}` for what is off-screen, plus a screenshot | the shape id with its `shape:` prefix stripped                                                        | tiered by relevance; geometry rounded to integers                                                                  | **fidelity tiers by relevance** and **counted elision** for the rest (our elision lines)                    |
| tldraw "make real"             | a screenshot of the selection plus prior output                                                                                                                                                                                           | none                                                                                                  | vision only                                                                                                        | images help layout judgement, but are no substitute for refs when editing                                   |
| Figma Dev Mode MCP             | `get_metadata`: sparse XML of layer ids, names, types, position and size; then `get_design_context` for chosen node ids; `get_screenshot`                                                                                                 | Figma node ids                                                                                        | skeleton first, then drill in by id                                                                                | the two-step "skeleton, then detail by ref" loop                                                            |
| draw.io MCP, Excalidraw MCP    | write-centric: the model emits draw.io XML / CSV / Mermaid or Excalidraw elements; MCP Apps render it inline. draw.io adds `search_shapes` for its 10,000 shape vocabulary                                                                | n/a                                                                                                   | none for reading                                                                                                   | neither solves _reading_ a diagram; vocabulary discovery as a search verb is worth copying                  |
| Mermaid                        | `flowchart`, nodes with bracket shapes, `subgraph`, `a -->                                                                                                                                                                                | label                                                                                                 | b`                                                                                                                 | author-chosen tokens                                                                                        | none | every model already speaks it; a good _alternative_ graph view and input, not the default read |
| D2                             | nested containers, `a -> b: label`, rich shapes (`sql_table`, `person`)                                                                                                                                                                   | author-chosen, but edges across containers need qualified paths (`services.orders -> data.orders_db`) | none                                                                                                               | nesting is readable; qualified edge paths are the cost of putting edges outside their nodes                 |
| PlantUML, Structurizr DSL      | Structurizr separates the **model** (elements, relationships) from **views** (which subset, which layout)                                                                                                                                 | identifiers (`orders = container "Orders"`)                                                           | many views over one model                                                                                          | the model/view split is exactly the CLI's query views                                                       |
| Graphviz DOT                   | `subgraph cluster_x { }`, `a -> b [label=...]`                                                                                                                                                                                            | quoted ids                                                                                            | none                                                                                                               | compact edges; attribute syntax is noisy                                                                    |
| TOON                           | YAML-like, with uniform arrays as tables: `nodes[19]{ref,kind,label}:` then CSV rows                                                                                                                                                      | n/a                                                                                                   | none                                                                                                               | strong for uniform rows; measured below, it loses to the outline here                                       |
| aider repo map                 | tree-sitter tags, ranked by a PageRank over the reference graph, fitted to `--map-tokens` (default 1k) by binary search                                                                                                                   | file + symbol                                                                                         | **a token budget with ranked selection**                                                                           | rank by centrality, fit to a budget                                                                         |
| ctags / tree-sitter outlines   | `kind name` per symbol, indented by scope                                                                                                                                                                                                 | file:line                                                                                             | none                                                                                                               | an outline is a symbol table: a type, a name, an address                                                    |

Two things inside this repo are prior art too:

- `packages/document/src/export-tab-text.ts` (`tabToMarkdownText`) already writes a tab as Markdown, but it drops every
  unlabelled arrow (7 of 11 in the test tab), every id, notes, comments, containment and table content.
- `packages/document/src/mermaid-serialise.ts` (`mermaidFromTab`) derives containment geometrically ("the smallest
  frame containing its centre"), the same rule the outline uses below.

## 3. The benchmark

### 3.1 The tab

A 30-element architecture tab ("Checkout platform"), built from the real factories in `packages/document`
(`createShape`, `createText`, `createTable`, `createSticky`, `createPinnedArrow`), so every element carries the
defaults the editor writes. `isValidTab` accepts it. Ids are deterministic pseudo-UUIDs so the counts reproduce.

- 1 text title, 3 frames (Edge, Services, Data).
- 12 graph nodes: an actor, 7 squares (with `iconId`), a hexagon, a stadium, 2 cylinders, a cloud with a URL link.
- 1 entity (`Order`, 4 fields), 1 sticky (with an open 2-comment thread), 1 table (SLOs, 4x3).
- 11 pinned arrows: 4 labelled, 1 dashed, 1 angled.
- 4 notes; 1 resolved thread on Payments.

### 3.2 Method

Each format was generated by a script from the same tab and counted with `gpt-tokenizer` 4.0.0 (`o200k_base`,
the GPT-4o family, and `cl100k_base`). No public offline tokenizer exists for Claude; Claude's counts run somewhat
higher, but the ratios between formats are what matter and they hold across both encodings. The scripts were run from
a scratch directory and are not part of the repo; the formats are reproduced in the [appendix](#appendix-the-renders).

### 3.3 Results

| Format                                                  | chars  | chars/4 | cl100k | o200k     | vs JSON |
| ------------------------------------------------------- | ------ | ------- | ------ | --------- | ------- |
| JSON, pretty (`read_document` text block today)         | 12,665 | 3,166   | 4,219  | **4,213** | 100%    |
| JSON, minified                                          | 7,558  | 1,890   | 2,893  | 2,910     | 69%     |
| tldraw-style blurry shapes (JSON, geometry, short refs) | 2,439  | 610     | 883    | 882       | 21%     |
| Outline with full UUIDs                                 | 2,144  | 536     | 977    | 970       | 23%     |
| TOON tables (nodes + edges)                             | 1,160  | 290     | 469    | 468       | 11%     |
| D2                                                      | 1,577  | 394     | 420    | 416       | 10%     |
| Outline, prefix refs, edge targets also labelled        | 1,349  | 337     | 424    | 422       | 10%     |
| Graphviz DOT                                            | 1,039  | 260     | 388    | 387       | 9%      |
| **Outline, prefix refs (proposed default)**             | 1,184  | 296     | 388    | **386**   | **9%**  |
| Outline, positional refs `e1..eN`                       | 1,141  | 285     | 357    | 355       | 8%      |
| Outline, slug ids (an agent-authored document)          | 1,315  | 329     | 345    | 343       | 8%      |
| Outline, prefix refs, notes omitted                     | 992    | 248     | 330    | 329       | 8%      |
| Mermaid (`mermaidFromTab` today)                        | 608    | 152     | 232    | 232       | 6%      |
| Markdown export (`tabToMarkdownText` today)             | 730    | 183     | 202    | 201       | 5%      |
| View: graph (nodes + edges + arrow refs)                | 582    | 146     | 259    | 258       | 6%      |
| View: layout, exact geometry                            | 387    | 97      | 222    | 222       | 5%      |
| View: layout, coarse rows                               | 137    | 34      | 79     | 79        | 2%      |
| View: comments (open threads)                           |        |         |        | 81        | 2%      |
| View: `show <ref>` (one element in full + neighbours)   |        |         |        | 121       | 3%      |
| View: diff (6 changes)                                  |        |         |        | 110       | 3%      |

Where the JSON's tokens go (o200k, minified, 2,910):

- **UUIDs: 1,076 (37%).** 55 of them (30 element ids, 22 arrow endpoints, 3 comment ids) at 22 tokens each.
  Replacing them with 4-character prefixes alone brings the JSON to 1,834.
- **Geometry and presentation defaults: 471 (16%).** `x/y/width/height`, `textSize`, `textAlign*`, `padding`.
- **JSON syntax: the rest.** With short ids and no geometry the JSON is still 1,363 tokens, 3.5x the outline:
  repeated keys, quotes, and nested endpoint objects (`{"kind":"pinned","elementId":"…","anchor":"e"}`).

Scale is linear: ten copies of the tab (300 elements) cost 29,145 tokens as minified JSON and about 3,530 as an
outline, roughly **12 tokens per element**, against 97 (minified) or 139 (pretty) for JSON.

Cost of one reference, o200k, as it appears in an edge list (` → <ref>,`):

| Ref                   | tokens alone | in context |
| --------------------- | ------------ | ---------- |
| full UUID             | 22           | 25         |
| 4-hex prefix (`146b`) | 2            | 5          |
| positional (`e12`)    | 2            | 4          |
| slug (`orders`)       | 1            | 3          |
| slug (`orders-svc`)   | 3            | 5          |

The inline image is the other large cost today: `read_document`, `create_document`, `add_tab` and
`update_document` each return a PNG, which a vision model bills at roughly a thousand tokens or more per image,
on every write as well as every read.

### 3.4 What each format loses

✓ kept, ~ partly, ✗ lost.

| Format          | Real refs     | Containment   | All edges       | Edge labels | Notes             | Comments        | Tables, entities, stickies, text                | Icons, links    | Geometry | Styling           |
| --------------- | ------------- | ------------- | --------------- | ----------- | ----------------- | --------------- | ----------------------------------------------- | --------------- | -------- | ----------------- |
| JSON            | ✓             | ✗ implicit    | ✓               | ✓           | ✓                 | ✓               | ✓                                               | ✓               | ✓        | ✓                 |
| Markdown export | ✗             | ✗             | ✗ keeps 4 of 11 | ✓           | ✗                 | ✗               | ~ labels only, table dropped                    | ✗               | ✗        | ✗                 |
| Mermaid         | ✗ `n1..`      | ~ one level   | ✓               | ✓           | ✗                 | ✗               | ✗ title, sticky, table gone; entity a plain box | ~ URL link only | ✗        | ~ dashed          |
| DOT             | ~             | ~             | ✓               | ✓           | ✗                 | ✗               | ✗ no kinds, entity fields lost                  | ✗               | ✗        | ✗                 |
| D2              | ✗ synthesised | ✓             | ✓               | ✓           | ✓ tooltip         | ✗               | ✓ incl. `sql_table`                             | ✗               | ✗        | ~                 |
| TOON            | ✓             | ~ `in` column | ✓               | ✓           | ~ cut             | ~ count         | ~ header row only                               | ✗               | ✗        | ✗                 |
| Blurry shapes   | ✓             | ✗             | ✓               | ✓           | ✗                 | ✗               | ~ text only                                     | ✗               | ✓        | ✗                 |
| **Outline**     | ✓             | ✓ derived     | ✓               | ✓           | ~ cut at 48 chars | ~ count + state | ✓ (table: size + header row)                    | ✓               | ✗        | ~ non-solid lines |

The outline loses exactly what a view or `show <ref>` returns on demand: geometry, styling, anchors and routing,
full notes, comment bodies and table body rows.

Why TOON lost here: the tab is not uniform. Most cells in the `note`, `comments` and `in` columns are empty
commas, refs repeat in the edge table, and indentation (which costs one token per level) is cheaper than an
`in` column that repeats the parent's ref.

## 4. The outline

### 4.1 Rendered

```text
tab 0b34 "Checkout platform" · 30 elements: 16 boxes, 3 frames, 11 arrows · threads 1 open/2
text 98eb "Checkout platform: production"
frame 048c "Edge"
  actor b811 "Customer" → a3cf
  square a3cf "Web app" icon=nextjs → 649c
  hexagon 649c "API gateway" note="Kong. Terminates TLS, rate-limits per API key,"… → 202b "JWT", 146b
frame c991 "Services"
  square 202b "Auth service" icon=shield
  square 146b "Orders service" icon=server note="Owns the order lifecycle and is the source of"… → e4a8 "charge", d41e, 6406 "OrderPlaced"
  stadium 6406 "Event bus" note="Kafka, 3 brokers, 7-day retention." → 12de, 0556
  square e4a8 "Payments service" icon=credit-card comments=1 resolved → e6d7 "HTTPS" ~dashed
  square 12de "Inventory service" icon=package → 822f
  square 0556 "Notification worker" icon=mail
frame ca76 "Data"
  cylinder d41e "Orders DB" note="Postgres 16, primary + 1 replica."
  cylinder 822f "Inventory DB"
cloud e6d7 "Stripe" link=https://stripe.com/docs/api
entity cb02 "Order" {id uuid PK; customer_id uuid FK; status text; total_cents int}
table 480a 4x3 Service | p99 latency | Availability
sticky 0c84 "Payment retries are not idempotent yet!" comments=2 open
```

The same tab built by an agent through graph input, whose node ids are the slugs it chose (343 tokens):

```text
frame services "Services"
  square orders "Orders service" icon=server note="Owns the order lifecycle and is the source of"… → payments "charge", orders-db, event-bus "OrderPlaced"
  stadium event-bus "Event bus" note="Kafka, 3 brokers, 7-day retention." → inventory, notification
```

### 4.2 Grammar

```text
header := "tab" SP ref SP name " · " counts [" · kind=" tabKind] [" · threads " open "/" total]
line   := indent token SP ref [SP label] {SP attr} [SP "→" SP edge {", " edge}]
indent := "  " repeated depth          (depth = derived containment)
token  := shape for shapes (square, cylinder, frame, lane, entity, ...), else the element type
          (text, sticky, table, image, freehand, arrow, annotation, link-card, video)
ref    := the element's id when it is a slug, else its shortest unique id prefix (min 4)
label  := JSON string, cut at 60 chars on a word boundary, then "…"
attr   := key=value | key=JSON-string
edge   := ref [SP label] [SP "~" lineStyle]
```

### 4.3 Decisions

**Refs.**

- A ref is the element's own id when the id is already a slug (`^[a-z][a-z0-9_-]{0,23}$`); graph input keeps
  the model's node ids as element ids (`graph-authoring.ts`), so agent-built documents read with semantic refs.
- Otherwise it is the shortest unique prefix of the id, minimum 4 characters, computed across the whole tab
  (git's short-SHA rule). At 300 elements expect under one colliding pair of 4-hex prefixes (300²/2 ÷ 65,536 ≈ 0.7); those two print 5.
- The CLI accepts any unique prefix and any full id. An ambiguous prefix is an error that lists the candidates;
  it never picks one. A prefix printed earlier can become ambiguous after a collaborator adds an element: the
  error says so, and the agent re-reads.
- Positional refs (`e1..eN`) are rejected. Playwright gets away with them because a browser session is stateful
  and single-writer; a CLI is stateless between calls and a livediagram tab has live co-editors, so `e7` could name
  a different element on the next read.
- Labels are never refs: they are not unique and they change.
- The CLI should default new element ids to a unique slug of the label (`redis-cache`) unless the agent passes
  `--id`, so documents built through the CLI stay cheap to read. Before adopting this, verify nothing outside
  `packages/document` assumes element ids are UUIDs (realtime ops, D1 indexes, element links across tabs).

**Containment.** There is no parent field on elements; containment is geometric. The outline nests an element
under the smallest frame or lane containing its centre (the rule `mermaidFromTab` already uses), to any depth.
This is derived, so the CLI states it in help ("indentation is derived from position") and an edit that moves an
element into a frame is a move with a target (`--into c991`), not a re-parent. Mind maps are the exception:
`mindParentId` is a real hierarchy and wins over geometry for mind nodes.

**Edges.** Outgoing edges are written on the source line (`→ e4a8 "charge", d41e`), so the source ref is not
repeated and an element's dependencies sit beside it. Incoming edges are not repeated; `graph` and `show` list
both directions. Arrow ids are omitted from the outline to save about 3 tokens per edge; the `graph` and `show`
views carry them, and the CLI also accepts `from..to` (`146b..e4a8`, shell-safe) as an edge selector, failing
with candidates when two arrows join the same pair. Labelling each edge target with its node's label cost 9% more
(422 against 386) and was dropped: refs are resolved by the model from the same small text.

Special edges:

- An arrow with a free end prints on its own line at the root: `arrow 7a1c free → e4a8 "retry"`.
- An endpoint on another arrow prints as `→ arrow:c41d`.
- A line without heads prints `~none`; a two-headed arrow prints `~both`.

**Position as reading order.** Children print in reading order (rows top to bottom, by overlapping vertical
extent, then left to right). This carries "Auth is left of Orders, Event bus is below Auth" for free. Explicit
relations (`left-of`, `above`) cost O(n²) and were not worth it; the `layout` view covers geometry when an
agent needs it.

**Content-bearing types say what they hold, briefly:**

| Type                       | Outline form                                                                                    |
| -------------------------- | ----------------------------------------------------------------------------------------------- |
| `entity`                   | fields inline in braces, first 8, then `+N`                                                     |
| `table`                    | `RxC` and the header row; full cells via `show`                                                 |
| `code-block`               | `lang=ts lines=24` and the first line as the label                                              |
| `bar-chart`, `pie-chart`   | `slices=5`; `line-chart`: `series=2 x=12`                                                       |
| `checklist`                | `done=2/5`                                                                                      |
| `sticky` on Event Storming | the note's `esKind` as the token (`domain-event`, `command`, `hotspot`), `draft` when `esDraft` |
| `image`                    | `alt=…`                                                                                         |
| `freehand`                 | runs of unlabelled strokes collapse into one line: `freehand ×12 (3 closed)`                    |
| collaboration shapes       | their state, one attribute: `votes=4 revealed`, `status=accepted`                               |

**Notes, comments, actions, links.** A note is meaning, so it shows, cut to 48 characters; `--notes full`
shows all of it and `--notes off` hides it (saving 15% on the test tab). A comment thread shows only as
`comments=2 open`; bodies live in the `comments` view. An assigned action shows as `action="Fix retries" @Sam due=10-12`.
Links show as `link=<url>`, `link=tab:51c9`, or `link=tab:51c9#e4a8`.

**Left out by default:** coordinates, sizes, colours, fonts, text styling, shadows, animation, anchors, routing,
`layerId`. `--style` adds the non-default style attributes (`fill=#fde68a stroke=dashed`). Hidden-layer elements
are left out, with a count in the header, matching the export rule in `mermaidFromTab`; `--hidden` includes them.
`locked` shows as a flag because it changes what an edit may do.

**Escaping.** Labels and notes are JSON strings, so quotes, newlines (`\n`) and non-Latin text round-trip
without new rules. Models read JSON escapes fluently.

**One vocabulary in and out.** The tokens and refs the outline prints are the ones the CLI's write verbs take
(`livediagram element add cylinder "Redis cache" --into c991`), so reading teaches writing. The outline itself is
a read form; see [open question 1](#9-open-questions).

## 5. Query views

One model, many views (Structurizr's split; tldraw's fidelity tiers; Figma's skeleton-then-detail). Every view
takes `--json` for the same view's data as JSON, and `--raw` gives the stored tab.

### 5.1 `overview`: the document at a glance

For orienting before choosing a tab. About 90 tokens for three tabs.

```text
doc 7f3a "Checkout platform" · 3 tabs · edited 3m ago by Sam · https://livediagram.app/document/7f3a…
  tab 0b34 "Architecture"       30 elements: 16 boxes, 3 frames, 11 arrows · 1 open thread
  tab 51c9 "Payment sequence"   42 elements: 6 lanes, 18 boxes, 18 arrows
  tab 9e02 "Incident retro"     24 elements: 22 stickies, 2 text · opens in draw · 3 open threads
```

### 5.2 `outline` (default): meaning without geometry

Shown in [§4.1](#41-rendered). 386 tokens; about 12 per element.

Flags: `--in <ref>` (one container's subtree, like `snapshot <ref>`), `--depth N`, `--notes off|cut|full`,
`--style`, `--hidden`, `--budget N`.

### 5.3 `graph`: nodes and edges only

For dependency questions, cycle hunting, and for the arrow refs an edge edit needs. 258 tokens. Only elements that
take part in an edge are listed; containment is one `in` reference.

```text
b811 "Customer" in 048c
a3cf "Web app" in 048c
649c "API gateway" in 048c
202b "Auth service" in c991
146b "Orders service" in c991
e4a8 "Payments service" in c991
6406 "Event bus" in c991
12de "Inventory service" in c991
0556 "Notification worker" in c991
d41e "Orders DB" in ca76
822f "Inventory DB" in ca76
e6d7 "Stripe"

b811 -> a3cf [c74b]
a3cf -> 649c [6e71]
649c -> 202b "JWT" [9c5e]
649c -> 146b [111e]
146b -> e4a8 "charge" [c41d]
e4a8 -> e6d7 "HTTPS" [8e70]
146b -> d41e [892e]
146b -> 6406 "OrderPlaced" [3462]
6406 -> 12de [1434]
6406 -> 0556 [0cee]
12de -> 822f [1fc0]
```

`--as mermaid` writes the same graph as Mermaid with the real refs as node ids, so it pastes straight back into
the `mermaid` input the MCP already accepts. The emitter must alias a ref that is a Mermaid keyword (`end`, `graph`).

### 5.4 `layout`: geometry, exact or coarse

For arranging. Coarse rows by default (79 tokens): per container, rows top to bottom separated by `/`, refs left
to right within a row.

```text
canvas: 98eb / 048c c991 ca76 e6d7 / cb02 / 480a 0c84
048c: b811 / a3cf / 649c
c991: 202b 146b / 6406 e4a8 / 12de 0556
ca76: d41e / 822f
```

`--exact` (222 tokens) prints `ref x,y wxh` in reading order, with `r=<deg>` when rotated, and arrows as
`c41d 146b.s → e4a8.n angled` so anchors and routing can be edited.

```text
98eb 40,20 520x48
b811 150,140 80x110
202b 440,150 200x72
146b 720,150 200x72
…
```

`--png <file>` renders the tab through the shared SVG renderer and writes it to a file, printing only the path
(playwright-cli's pattern). Images never go to stdout.

### 5.5 `comments`: open threads in context

81 tokens. Resolved threads are hidden and counted; `--all` includes them. Author ids are never printed.

```text
sticky 0c84 "Payment retries are not idempotent yet!" · open · 2
  Sam 2026-09-27: Retry storm last Friday double-charged 14 orders.
  Webber 2026-09-27: @Priya can we add an idempotency key per order?
(1 resolved thread hidden; --all shows it)
```

### 5.6 `show <ref>`: one element in full

Everything non-default on the element, its container, its geometry, and its edges both ways with arrow refs. The
"focused shape" tier. 121 tokens.

```text
square 146b "Orders service" in frame c991 "Services"
  at 720,150 200x72
  iconId: server
  note: "Owns the order lifecycle and is the source of truth for order state. Calls Payments synchronously; publishes OrderPlaced."
  ← 649c "API gateway" [111e]
  → e4a8 "Payments service" "charge" [c41d]
  → d41e "Orders DB" [892e]
  → 6406 "Event bus" "OrderPlaced" [3462]
```

A table prints its cells as a pipe table; an entity its fields one per line; a code block its code. Several refs
may be given at once.

### 5.7 `find <text>`: search with ancestry

Matches labels, notes, edge labels and comment text; each match prints with its container chain, the way
`playwright-cli find` returns context. `--regex` for patterns.

```text
frame c991 "Services"
  square 146b "Orders service" … → e4a8 "charge"          (edge to match)
  square e4a8 "Payments service" icon=credit-card comments=1 resolved → e6d7 "HTTPS" ~dashed
sticky 0c84 "Payment retries are not idempotent yet!" comments=2 open
3 matches: 2 labels, 1 edge
```

### 5.8 `diff`: what changed since you last read

110 tokens for six changes. The unit is the outline's facts (label, container, edges, notes, threads), so a diff
reads like the outline; geometry and styling changes collapse to `moved`, `resized`, `restyled`.

```text
tab 0b34 "Checkout platform" · since your last read 3m ago · by Sam, Webber
~ square e4a8 label "Payments service" → "Payments"
+ cylinder 7180 "Redis cache" in c991 "Services"
+ arrow 202b → 7180 [5d21]
- arrow 6406 → 0556 "Event bus" → "Notification worker"
~ sticky 0c84 comments open → resolved
~ entity cb02 moved (+200,0)
```

The api has no tab revision history today (the element-level Activity panel was removed; see
[Timeline](../../specs/013-workspace/timeline.md)). The CLI can diff without an api change by keeping the last
tab it read in its cache directory (`--since last`, the default). A server revision counter would add
`--since <rev>` across machines later.

Every write verb should answer with this diff of what it changed, not with the whole tab and not with an image.
That keeps an edit loop to tens of tokens per step.

### 5.9 Escape hatches

- `--json`: the current view as JSON (`{ "refs": "prefix", "nodes": [...] }`), for scripts.
- `--raw`: the stored tab, unchanged, for sync to files and lossless round-trips.

## 6. Budgets

`--budget 2k` (any view; the outline's default is 4k) fits the output to a token budget, aider-style, and
never drops content silently.

1. Estimate tokens at **chars/3**. Measured chars per o200k token: outline 3.07, minified JSON 2.60, Mermaid 2.62,
   D2 3.79. chars/4 under-counts the outline by 23% and the JSON by 35%.
2. Always keep the header and the container skeleton (every frame and lane line, with child counts).
3. Degrade in steps until it fits: cut notes to 24 characters; drop notes; drop attributes other than
   `comments=… open`; collapse low-ranked leaves into elision lines; collapse whole containers.
4. Rank elements by: open threads, edge degree (a cheap stand-in for aider's PageRank), being a container, a match
   for `--in` or `find`, recent change (when a cached read exists), then label length.
5. Each elision is one line naming what it hides and how to reach it, like tldraw's peripheral clusters:

```text
frame c991 "Services" (48 elements)
  square 146b "Orders service" icon=server → e4a8 "charge", d41e, 6406 "OrderPlaced"
  square e4a8 "Payments service" comments=1 resolved → e6d7 "HTTPS" ~dashed
  … 46 more: 31 square, 9 cylinder, 6 sticky · outline --in c991
budget 2k: 82 of 300 elements shown · --budget 8k or --in <ref> for more
```

## 7. Edge cases

| Case                                         | Handling                                                                                 |
| -------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Empty tab                                    | header only, `0 elements`; never an error                                                |
| Unlabelled element                           | token and ref only; `elementDisplayLabel` names (`Comment Panel`) where the kind has one |
| Very long or multi-line label                | JSON string, `\n` kept, cut at 60 characters with `…`; full in `show`                    |
| Overlapping frames                           | smallest containing frame wins; a centre inside none is at the root                      |
| Element larger than the frame it sits on     | never nested under a smaller container                                                   |
| Rotated element                              | containment by centre, unaffected; `layout --exact` prints `r=`                          |
| Hidden layer                                 | omitted with a header count; `--hidden` includes it                                      |
| Free or on-arrow endpoints                   | own line, `free` or `arrow:<ref>`                                                        |
| Parallel arrows between one pair             | both listed; the `a..b` selector errors with both arrow refs                             |
| Self-loop                                    | `→ <own ref>`                                                                            |
| Event Storming tab                           | header `kind=event-storming`; lanes are containers; stickies print their `esKind`        |
| Mind map                                     | nesting follows `mindParentId`, not geometry                                             |
| Board drawn in Draw mode (mostly ink)        | strokes collapse into `freehand ×N`; text and stickies stay legible                      |
| Huge table or long code                      | outline shows dimensions; `show` prints in full, under the budget                        |
| Prefix collision after a collaborator's edit | ambiguity error with candidates; never a guess                                           |
| Element deleted between read and write       | `not found: e4a8 (deleted since your read?)`, suggesting `diff`                          |
| Labels containing `→`, quotes, `             | `                                                                                        | inside a JSON string, so unambiguous |

## 8. Recommendations

1. Make the outline the default read of a tab, with the grammar in [§4.2](#42-grammar).
2. Use shortest-unique id prefixes (min 4) as refs, slug ids verbatim, and resolve any unique prefix on input with
   a hard error on ambiguity.
3. Default ids the CLI creates to label slugs, once the UUID assumption is checked outside `packages/document`.
4. Ship the views `overview`, `outline`, `graph` (`--as mermaid`), `layout` (`--exact`, `--png <file>`),
   `comments`, `show`, `find`, `diff`, with `--json` and `--raw` on all of them.
5. Put the outline renderer, ref resolver, containment derivation and diff in `packages/document`, pure, so the
   CLI, the MCP and the editor's text export share one implementation; then let `read_document` return the outline
   instead of pretty JSON (and stop sending the PNG unless asked).
6. Answer every write with a diff of what it changed.
7. Budget with chars/3, degrade in steps, and always print the elision line.
8. Fix the Markdown export's silent loss of unlabelled arrows while there: it currently drops 7 of 11 connections.

## 9. Open questions

1. **Is the outline also a write format?** An agent could edit outline text and the CLI apply the difference.
   One language to learn, but positions for new lines must be invented, and a deleted line deleting an element is
   a sharp edge. The recommendation above keeps the outline read-only and shares its vocabulary with write verbs.
2. **Slug ids by default:** adopt once realtime, D1 and cross-tab element links are confirmed id-agnostic?
3. **Default budget:** 4k for the outline, or unbounded with a warning when a tab exceeds it?
4. **Server revisions:** is `--since last` from a local cache enough, or should the api expose a tab revision so
   two agents (or two machines) can diff from the same point?

## Appendix: the renders

### JSON, pretty (first two of 30 elements)

```json
{
  "tab": {
    "id": "0b3481f3-59fb-4bd0-a21a-152f1ba9bba5",
    "name": "Checkout platform",
    "elements": [
      {
        "id": "98ebcb82-034f-4ba5-a41e-dd74d0cfc15a",
        "type": "text",
        "x": 40,
        "y": 20,
        "width": 520,
        "height": 48,
        "label": "Checkout platform: production",
        "textSize": "xl",
        "textBold": true
      },
      {
        "id": "048c4809-8abd-4d3d-a6e2-d40702e359b9",
        "type": "shape",
        "shape": "frame",
        "x": 40,
        "y": 100,
        "width": 300,
        "height": 440,
        "textSize": "md",
        "label": "Edge",
        "textAlignY": "top",
        "textAlignX": "right",
        "padding": "lg"
      }
    ]
  }
}
```

### Mermaid (`mermaidFromTab`)

```text
flowchart TD
  subgraph s1["Edge"]
    n1["Customer"]
    n2["Web app"]
    n3{{"API gateway"}}
  end
  subgraph s2["Services"]
    n4["Auth service"]
    n5["Orders service"]
    n6["Payments service"]
    n7(["Event bus"])
    n8["Inventory service"]
    n9["Notification worker"]
  end
  subgraph s3["Data"]
    n10[("Orders DB")]
    n11[("Inventory DB")]
  end
  n12["Stripe"]
  n13["Order"]
  n1 --> n2
  n2 --> n3
  n3 -->|JWT| n4
  n3 --> n5
  n5 -->|charge| n6
  n6 -.->|HTTPS| n12
  n5 --> n10
  n5 -->|OrderPlaced| n7
  n7 --> n8
  n7 --> n9
  n8 --> n11
  click n12 "https://stripe.com/docs/api"
```

### Markdown export (`tabToMarkdownText`)

```text
# Checkout platform

## Elements

- **Checkout platform: production** (text)
- **Edge** (frame)
- **Services** (frame)
- **Data** (frame)
- **Customer** (actor)
- **Auth service** (square)
- **Orders service** (square)
- **Orders DB** (cylinder)
- **Event bus** (stadium)
- **Payments service** (square)
- **Stripe** (cloud)
- **Web app** (square)
- **Inventory DB** (cylinder)
- **API gateway** (hexagon)
- **Inventory service** (square)
- **Notification worker** (square)
- **Order** (entity)
- **Payment retries are not idempotent yet!** (sticky)

## Connections

- *JWT*: API gateway → Auth service
- *charge*: Orders service → Payments service
- *HTTPS*: Payments service → Stripe
- *OrderPlaced*: Orders service → Event bus
```

### TOON tables

```text
tab: 0b34
name: Checkout platform
nodes[19]{ref,kind,label,in,note,comments}:
  98eb,text,Checkout platform: production,,,
  048c,frame,Edge,,,
  c991,frame,Services,,,
  ca76,frame,Data,,,
  b811,actor,Customer,048c,,
  a3cf,square,Web app,048c,,
  649c,hexagon,API gateway,048c,"Kong. Terminates TLS, rate-limits per API key, f…",
  202b,square,Auth service,c991,,
  146b,square,Orders service,c991,Owns the order lifecycle and is the source of tr…,
  e4a8,square,Payments service,c991,,1r
  6406,stadium,Event bus,c991,"Kafka, 3 brokers, 7-day retention.",
  12de,square,Inventory service,c991,,
  0556,square,Notification worker,c991,,
  d41e,cylinder,Orders DB,ca76,"Postgres 16, primary + 1 replica.",
  822f,cylinder,Inventory DB,ca76,,
  e6d7,cloud,Stripe,,,
  cb02,entity,Order,,,
  0c84,sticky,Payment retries are not idempotent yet!,,,2o
  480a,table,Service | p99 latency | Availability,,,
edges[11]{ref,from,to,label}:
  c74b,b811,a3cf,
  6e71,a3cf,649c,
  9c5e,649c,202b,JWT
  111e,649c,146b,
  c41d,146b,e4a8,charge
  8e70,e4a8,e6d7,HTTPS
  892e,146b,d41e,
  3462,146b,6406,OrderPlaced
  1434,6406,12de,
  0cee,6406,0556,
  1fc0,12de,822f,
```

### D2

```text
direction: right
checkout_platform: "Checkout platform: production"
edge: "Edge" {
  customer: "Customer" {
    shape: person
  }
  web_app: "Web app"
  api_gateway: "API gateway" {
    shape: hexagon
    tooltip: "Kong. Terminates TLS, rate-limits per API key, forwards the JWT."
  }
}
services: "Services" {
  auth: "Auth service"
  orders: "Orders service" {
    tooltip: "Owns the order lifecycle and is the source of truth for order state. Calls Payments synchronously; publishes OrderPlaced."
  }
  payments: "Payments service"
  event_bus: "Event bus" {
    shape: oval
    tooltip: "Kafka, 3 brokers, 7-day retention."
  }
  inventory: "Inventory service"
  notification: "Notification worker"
}
data: "Data" {
  orders_db: "Orders DB" {
    shape: cylinder
    tooltip: "Postgres 16, primary + 1 replica."
  }
  inventory_db: "Inventory DB" {
    shape: cylinder
  }
}
stripe: "Stripe" {
  shape: cloud
}
order: "Order" {
  shape: sql_table
  id: uuid PK
  customer_id: uuid FK
  status: text
  total_cents: int
}
payment_retries: "Payment retries are not idempotent yet!" {
  shape: page
}
slos: "SLO table"
edge.customer -> edge.web_app
edge.web_app -> edge.api_gateway
edge.api_gateway -> services.auth: "JWT"
edge.api_gateway -> services.orders
services.orders -> services.payments: "charge"
services.payments -> stripe: "HTTPS" {style.stroke-dash: 3}
services.orders -> data.orders_db
services.orders -> services.event_bus: "OrderPlaced"
services.event_bus -> services.inventory
services.event_bus -> services.notification
services.inventory -> data.inventory_db
```

### Graphviz DOT

```text
digraph G {
  rankdir=LR;
  subgraph "cluster_048c" { label="Edge";
    "b811" [label="Customer"];
    "a3cf" [label="Web app"];
    "649c" [label="API gateway"];
  }
  subgraph "cluster_c991" { label="Services";
    "202b" [label="Auth service"];
    "146b" [label="Orders service"];
    "e4a8" [label="Payments service"];
    "6406" [label="Event bus"];
    "12de" [label="Inventory service"];
    "0556" [label="Notification worker"];
  }
  subgraph "cluster_ca76" { label="Data";
    "d41e" [label="Orders DB"];
    "822f" [label="Inventory DB"];
  }
  "98eb" [label="Checkout platform: production"];
  "e6d7" [label="Stripe"];
  "cb02" [label="Order"];
  "0c84" [label="Payment retries are not idempotent yet!"];
  "480a" [label="SLO table"];
  "b811" -> "a3cf";
  "a3cf" -> "649c";
  "649c" -> "202b" [label="JWT"];
  "649c" -> "146b";
  "146b" -> "e4a8" [label="charge"];
  "e4a8" -> "e6d7" [label="HTTPS"];
  "146b" -> "d41e";
  "146b" -> "6406" [label="OrderPlaced"];
  "6406" -> "12de";
  "6406" -> "0556";
  "12de" -> "822f";
}
```

### tldraw-style blurry shapes (first five of 30)

```json
[
  {
    "shapeId": "98eb",
    "type": "text",
    "text": "Checkout platform: production",
    "x": 40,
    "y": 20,
    "w": 520,
    "h": 48
  },
  { "shapeId": "048c", "type": "frame", "text": "Edge", "x": 40, "y": 100, "w": 300, "h": 440 },
  {
    "shapeId": "c991",
    "type": "frame",
    "text": "Services",
    "x": 400,
    "y": 100,
    "w": 580,
    "h": 440
  },
  { "shapeId": "ca76", "type": "frame", "text": "Data", "x": 1040, "y": 100, "w": 280, "h": 440 },
  { "shapeId": "b811", "type": "actor", "text": "Customer", "x": 150, "y": 140, "w": 80, "h": 110 }
]
```
