# Authoring from scratch, and the visual feedback loop

Research for the agent-facing `livediagram` CLI, dated 2026-10-03. It asks how an AI agent
builds a good diagram from nothing, how it then sees what it built, and how it corrects it,
and ends with a recommended authoring flow, a `lint` design and a mock session.

What the product does today is stated by the specs, chiefly
[MCP server](../../specs/015-api/mcp-server.md) §4.3 to §4.7a and §5. This file records what
was found and measured at the time; it is not a spec.

## Findings in brief

- **Models are poor at raw coordinates and good at topology.** Every serious system we looked
  at (tldraw's agent, draw.io's MCP, Excalidraw, Eraser, DiagrammerGPT, AutomaTikZ) moves the
  model off absolute pixels: towards a graph plus a layout engine, a relative-placement verb,
  or a high-level language that compiles to geometry.
- **livediagram already has the right core**: graph or Mermaid input, label capping, a
  layered, tree and radial layout, clustered groups, and a pure SVG renderer. All of it is
  pure TypeScript, so the CLI can lay out, render and check **locally** before writing.
- **The layout is not good enough to trust blind.** On a realistic 15-node architecture,
  grouping by tier produced **5 edge crossings and 2 arrows routed behind unrelated boxes**;
  the same graph without groups produced **0 and 0**. The agent cannot know that without a
  check. This is the strongest argument for `lint`.
- **A text lint is the cheapest feedback channel by an order of magnitude**: about 100 tokens,
  works for text-only models, is deterministic, and names element ids the agent can act on.
  tldraw's agent ships the same idea (`canvasLints`).
- **The PNG is still worth having** for multimodal agents: about 600 to 1,200 tokens at
  1000 px wide, rendered locally in 60 to 160 ms. SVG text and ASCII art are poor
  substitutes for it.
- **Relayout churns.** The layout is deterministic, but adding one leaf node to the 15-node
  graph moved 6 to 12 of the 15 existing nodes. Relayout freely while the agent owns the tab;
  place incrementally once a person has arranged it.
- **Recommended flow**: one declarative graph source per tab, `apply --dry-run` (layout,
  lint, render locally), look, edit the source, `apply`. Templates for non-graph boards.
  Element ops for surgical edits on human-arranged tabs.

## 1. An experiment on the real engine

To ground the rest, a 15-node, 16-edge e-commerce architecture was run through the MCP's own
`layoutGraph` (`apps/mcp/src/graph-input.ts`), rendered with `renderElementsToSvg`
(`packages/document`) and rasterised with `@resvg/resvg-wasm` and the embedded Inter, exactly
as the MCP does. Crossings and box hits were counted with the existing `arrowPolyline`,
`pathsCross` and `pathPassesThrough` (`packages/document/src/arrow-path-hits.ts`).

Nodes: web app, mobile app, CDN, API gateway, auth, orders, payments, inventory,
notifications, event bus, orders DB, inventory DB, Redis cache, Stripe, email provider.

| Variant                                 | Crossings | Arrows behind a box | Extent (px) | PNG tokens at 1000 px |
| --------------------------------------- | --------: | ------------------: | ----------- | --------------------: |
| Groups by tier, direction right         |         5 |                   2 | 1317 × 1196 |                 1,216 |
| Tier groups, bus moved into Core        |         5 |                   3 | 1575 × 1076 |                   928 |
| Tier groups, bus in its own group       |         5 |                   3 | 1331 × 1292 |                     - |
| Tier groups, direction down             |         7 |                   3 | 1206 × 1364 |                     - |
| Tier groups, angled lines               |         7 |                   4 | 1317 × 1196 |                     - |
| Bus and notifications in an Async group |         2 |                   3 | 1859 × 988  |                   729 |
| Groups by domain (ordering, inventory)  |         3 |                   2 | 2106 × 880  |                   580 |
| **No groups, direction right**          |     **0** |               **0** | 1319 × 789  |                   823 |
| No groups, direction down               |         0 |                   0 | 822 × 1210  |                     - |

Token figures use Anthropic's published estimate (width × height / 750). Rendering took 58 to
161 ms per image on Node. Payload sizes for the first variant: elements JSON 6,033 chars
(about 1,700 tokens), SVG 16,019 chars (about 4,500 tokens), Mermaid export 728 chars
(about 200 tokens).

What the images showed, looking at them as a multimodal model would:

- With tier groups the "Core services" frame is crossed by long diagonals to the Data frame on
  the far right, and `orders → bus` and `bus → notifications` run behind Payments service.
- With domain groups the `OrderPlaced` edge label lands **inside** the Payments box: a
  label collision the counters above do not even measure.
- Without groups the picture is clean: left-to-right tiers emerge on their own, every
  database sits beside its service.

Lessons:

1. The clustered layout lays each group out as one block, so edges between groups pay for it.
   Grouping by technical tier ("all databases in Data") fights the flow; grouping by
   ownership is better; no groups is best for this graph. An agent will reach for tier
   groups first, because that is how architecture diagrams are described in prose.
2. None of this is visible from the graph the agent wrote. It is visible in the PNG, and
   **cheaply and exactly** in a lint.
3. Because layout and render are pure and fast, the CLI can score several variants and tell
   the agent which reads best, without a single network call.

Two smaller defects surfaced on the way, recorded in §10.

## 2. What is known about LLM spatial reasoning

- **Grid and coordinate tasks remain weak.** Benchmarks such as GRASP (grid-based
  commonsense spatial reasoning, arXiv 2407.01892) and the 2026 Grid Spatial Understanding
  dataset (arXiv 2603.17333) keep finding that text models lose track of positions over many
  steps. Visualization-of-Thought (arXiv 2404.03622) improves 2D grid navigation by having the
  model draw intermediate states, which says the model benefits from **seeing** state rather
  than holding coordinates in its head.
- **Layout as a style sheet helps.** LayoutGPT (arXiv 2305.15393) gets far better layouts
  when the model writes CSS-like declarations with in-context examples than free numbers:
  a structured, named vocabulary beats raw geometry.
- **Plan, audit, render.** DiagrammerGPT (arXiv 2310.12128) splits diagram generation into a
  plan (entities, relations, boxes) refined in a planner-auditor loop before anything is drawn.
- **High-level languages beat primitives.** AutomaTikZ (arXiv 2310.00367) argues TikZ is a
  good target precisely because it is a human-oriented abstraction over vector primitives;
  StarVector (arXiv 2312.11556) and VGBench (arXiv 2407.10972) show raw SVG is hard for models
  to write and to read. DeTikZify (arXiv 2405.15306) adds a render-and-compare search at
  inference time: compiling and looking is what lifts quality.
- **Classic graph drawing by the model itself is unreliable.** "Ask and you shall receive (a
  graph drawing)" (arXiv 2303.08819) tested ChatGPT applying layout algorithms and found the
  probabilistic output hard to keep correct; the sensible split is model for semantics,
  algorithm for geometry.
- **Self-feedback works when the feedback is concrete.** Self-Refine (arXiv 2303.17651) shows
  iterative refinement helps when the critique is specific; Visual Sketchpad (arXiv 2406.09403)
  shows multimodal models reason better when they can draw and look.
- **Text-to-diagram-as-code is the mainstream.** MermaidSeqBench (arXiv 2511.14967) and
  GenAI-DrawIO-Creator (arXiv 2601.05162, Claude 3.7 writing draw.io XML with error checks)
  both treat a textual diagram language plus validation as the default.

Implication: the CLI should never ask an agent for pixels when it is building something new.
It should ask for **what exists, what connects, what belongs together, and which way it
flows**, then show the result and report its faults in words.

## 3. The spectrum of coordinate-free authoring

| Approach                    | Examples                                                                                                                        | What the model writes              | Strength                                          | Weakness                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------- | ----------------------------------------------------------- |
| Absolute coordinates        | raw `elements`, draw.io XML, Excalidraw JSON                                                                                    | x, y, width, height                | Total control (rings, grids, posters)             | The model's weakest skill; overlaps and drift               |
| Relative placement verbs    | tldraw agent `place` (side, align, offsets), `align`, `distribute`, `stack`; TikZ `right=of a`                                  | "B below A, centred"               | Local, intuitive, cheap to apply                  | Accumulates; no global optimum; still needs a look          |
| Constraint systems          | Penrose (Domain, Substance, Style, solved by numeric optimisation), Cassowary (Apple Auto Layout), D2 `near` and `grid-rows`    | Relations and objectives           | Declarative, composable                           | Solver complexity; unsatisfiable sets need explaining       |
| Graph plus layout engine    | Graphviz `dot`, ELK layered, dagre, D2 (dagre, ELK, TALA), Mermaid, PlantUML, **livediagram `graph` / `mermaid` input**         | Nodes, edges, groups, direction    | Matches how models think; globally tidy           | Little control; groups and long edges can go wrong (see §1) |
| Graph plus layout **hints** | Graphviz `rank=same`, `constraint=false`, edge `weight`; ELK layer constraints (first, last) and partitions; PlantUML `-down->` | The graph, plus a few named nudges | Fixes the common faults without leaving the graph | Each hint must be honoured by our own engine                |
| Templates and scaffolds     | livediagram's 68 templates, Miro, Lucid and Whimsical starters                                                                  | A template kind, then content      | Curated layout for non-graph boards               | Personalising needs a readable outline of slot ids          |

What livediagram has, by file:

- `packages/document/src/graph-authoring.ts`: `graphToElements`; node id becomes element id;
  boxes sized to labels (`labelBoxSize`); entity nodes from `fields`.
- `packages/document/src/auto-layout*.ts`: layered flow with barycentre crossing reduction
  (`reduceCrossings`, `countCrossings`), long-edge lanes, tree, mindmap; `nodesLookUnplaced`
  to respect a placement the model made on purpose.
- `packages/document/src/auto-layout-clusters.ts`: `layoutClusteredGraph`, groups as frames.
- `apps/mcp/src/graph-input.ts`: label cap of 40 with overflow into the note, layout choice,
  line style, Mermaid via the editor's own `parseMermaid`.
- `packages/templates`: 68 hand-tuned templates materialised server-side.
- `packages/document/src/svg-render*.ts` and `apps/mcp/src/render.ts`: one SVG renderer for
  editor export, MCP preview and api snapshots; resvg rasterisation.
- `packages/document/src/arrow-path-hits.ts`: path-through-shape and path-crossing geometry,
  written for arrow rebinding, directly reusable for a lint.

What is missing for the CLI: layout hints (same rank, order within a rank, an edge that does
not constrain ranking), placement of new nodes that keeps existing ones still, an `icon` on
graph nodes (77 Technology icons exist, `packages/icons/src/tech-icon-ids.ts`, but a graph
node cannot name one), and stable edge ids.

**Recommendation**: keep the graph as the primary authoring language and grow it with a
**small, closed set of hints** the layered engine can honour cheaply, in the Graphviz and
ELK tradition. Do not adopt a general constraint solver (Penrose, Cassowary): the cost and
the "why is this unsatisfiable" problem outweigh the gain for boxes-and-arrows. Offer the
tldraw-style relative verbs (`place`, `align`, `distribute`) only on the element-editing path
for human-arranged tabs, where the global layout must not run.

## 4. Templates, then personalisation

Templates are the right start for anything that is not a node graph: retrospectives, kanban,
story maps, personas, swimlane journeys. The MCP already does `list_templates` → create with
`template` → `update_document` ops. The CLI should mirror it, with two additions:

- `template list` stays metadata only (kind, title, one line), grouped by category; about 15
  tokens a row, so all 68 cost about 1,000 tokens. A `--category` filter keeps it smaller.
- After creating from a template the agent needs the **slots**: a compact outline of element
  ids with their current labels, in reading order (lanes and columns first). Without that,
  personalising means reading the full elements JSON. The outline view proposed in §6 serves
  both template slots and diagram reading.

Templates also double as **worked examples**: `template show <kind> --as graph` (where the
template is graph-shaped) teaches a model the input format by example, which LayoutGPT found
is what makes structured layout languages work.

## 5. Incremental building versus one-shot

Two pulls, in tension:

- Evidence for iteration is strong (Self-Refine, DiagrammerGPT's auditor, DeTikZify's
  search, tldraw's `review` and `add-detail` actions, which schedule a look before continuing).
- A layered layout is global. In the §1 graph, adding one leaf moved **6 of 15** nodes;
  adding a leaf off the event bus moved **12 of 15**; adding a node with two edges moved 10.
  The layout is deterministic (the same graph gives the same positions), so nothing is
  random, but every addition reshuffles.

Resolution:

- **While the agent owns the tab** (it created it, and no person has moved anything since),
  iterate on the **whole graph** and relayout each time. The agent looks again anyway, and a
  fresh global layout beats patched placement. Iteration happens in the **source**, not on
  the canvas: edit the graph file, re-apply. This is declarative, idempotent and diffable,
  like `kubectl apply` or `terraform plan`.
- **Once a person has arranged the tab**, never relayout implicitly. New nodes are placed
  beside their neighbours with existing nodes pinned (a "place new only" layout mode the
  engine does not have yet), or the agent uses element ops and relative verbs.
- **Build big diagrams section by section, but as tabs or groups, not as rank-by-rank
  additions**: the MCP spec's own motivating case is "an overview plus a detail tab per
  subsystem". One-shot the overview topology; drill down per tab.

"Owns the tab" is detectable: the tab was created through the API with `source` from the CLI
or MCP, and its element positions still equal the last layout the CLI wrote (the CLI can
store a layout fingerprint in its local state, or the api can record it). That detection
is a design fork (§11).

## 6. Seeing the result: the feedback channels compared

| Channel              | Cost for the §1 diagram     | Works for text-only models | What it catches well                                    | What it misses                                  |
| -------------------- | --------------------------- | -------------------------- | ------------------------------------------------------- | ----------------------------------------------- |
| PNG (local resvg)    | 580 to 1,216 tokens         | No                         | Gestalt: balance, clutter, odd placement, label clashes | Exact ids; small faults at 1000 px              |
| SVG text             | about 4,500 tokens          | Barely                     | Nothing a model reads reliably (VGBench, StarVector)    | Almost everything                               |
| ASCII render         | 1,000+ tokens at 80 columns | Yes                        | Rough left/right/top/bottom                             | At 26 px a character, boxes and diagonals smear |
| Elements JSON        | about 1,700 tokens          | Yes                        | Exact state for editing                                 | Spatial sense; too costly to read every time    |
| Outline (graph text) | about 200 tokens            | Yes                        | Topology, groups, labels, notes, ids                    | Geometry                                        |
| Layout summary       | about 150 tokens            | Yes                        | Which column or row each node is in; extent; direction  | Fine geometry                                   |
| **Lint report**      | **about 100 tokens**        | **Yes**                    | Overlaps, crossings, hidden arrows, overflow, orphans   | Taste: whether it tells the story               |

Conclusions:

- **Lint plus outline is the default feedback**: cheap, exact, model-agnostic.
- **PNG on request** (`--png`, or `view --as png` writing a file path the agent opens) for
  multimodal agents and for the final check before handing a link to a person. Downscale to
  1000 px wide by default; the token cost is linear in area.
- **Do not build an ASCII renderer** for agents. A **layout summary** in words ("column 3:
  Orders service, Payments service; Event bus is top-right, outside every group") carries the
  same information more reliably. An ASCII sketch can come later for humans in a terminal.
- **Never return SVG to an agent** as feedback; keep it as an export.

## 7. Prior art

Verified against source or docs during this research unless marked "(from product notes)".

| System                                              | Authoring input                                                                            | Feedback loop                                                                                                                                                                                                                         | What to borrow                                                                                     |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| tldraw agent starter kit                            | Actions: create, update, `place` (side, align, offset), align, distribute, stack, `review` | Screenshot plus "blurry shapes" (bounds, id, type, text) in view, peripheral clusters off view, and **canvas lints**: `growY-on-shape` (text overflowing its shape), `overlapping-text`, `friendless-arrow`; lints surfaced once each | Lints as a first-class prompt part; levelled detail; positions rounded and offset to small numbers |
| tldraw "make real"                                  | A sketch screenshot                                                                        | Model returns HTML, rendered beside the sketch (from product notes)                                                                                                                                                                   | Vision is good at reading sketches, not at writing coordinates                                     |
| Excalidraw text-to-diagram                          | Prompt → LLM writes **Mermaid** → `mermaid-to-excalidraw`                                  | Preview before insert                                                                                                                                                                                                                 | Mermaid as the lingua franca; convert, then hand over editable shapes                              |
| Eraser DiagramGPT                                   | Prompt → Eraser's diagram-as-code (nodes with `[icon: ...]`, `{}` groups, `>` edges)       | Code panel beside the canvas; edit code or prompt again (from product notes)                                                                                                                                                          | **Icons named in the graph language**; code and canvas side by side                                |
| draw.io MCP (jgraph)                                | draw.io XML, CSV or Mermaid; `search_shapes` across 10,000+ shapes                         | Inline viewer; optional **ELK post-layout** or **libavoid** orthogonal rerouting that keeps nodes still                                                                                                                               | A shape and icon search verb; "reroute only" as a separate pass from "relayout"                    |
| GenAI-DrawIO-Creator (paper)                        | Claude writes draw.io XML                                                                  | XML validation and error checking, real-time updates                                                                                                                                                                                  | Validate before write, name the error                                                              |
| Mermaid Chart AI, D2 (from product notes)           | Mermaid / D2 text                                                                          | Render; D2 offers dagre, ELK and TALA engines, `near`, grid layouts                                                                                                                                                                   | Layout engine as a switch; a few positional hints                                                  |
| Napkin, Whimsical AI, Lucid AI (from product notes) | Prose → generated visual, flowchart or mind map                                            | Pick from variants, then edit by hand                                                                                                                                                                                                 | **Offer variants and let the author choose**                                                       |
| DiagrammerGPT                                       | LLM plan (entities, relations, boxes)                                                      | Planner-auditor refinement                                                                                                                                                                                                            | Audit the plan before drawing                                                                      |
| AutomaTikZ, DeTikZify, TikZero                      | TikZ programs                                                                              | Compile; DeTikZify searches with render-and-compare                                                                                                                                                                                   | A high-level language plus a compiler that reports faults                                          |

The pattern across all of them: **text in, layout by algorithm, look, fix with named
operations**. tldraw is the closest analogue to what the CLI wants, and it independently
arrived at text lints for exactly the faults §1 found.

## 8. The `lint` check

### What it checks

Each finding has a stable code (its log fingerprint), a severity, the element ids involved and
a suggested fix phrased as a CLI command or graph edit. Detection reuses existing geometry.

| Code                | Sev.  | Finding                                                                 | Detection (existing code)                                    | Suggested fix                          |
| ------------------- | ----- | ----------------------------------------------------------------------- | ------------------------------------------------------------ | -------------------------------------- |
| `box-overlap`       | error | Two non-container boxes overlap                                         | Rect intersection via `elementGridFor` / `queryElementGrid`  | Relayout, or move one                  |
| `arrow-dangling`    | error | Arrow endpoint pinned to a missing id, or free at both ends             | Element index lookup                                         | Remove, or pin to a node               |
| `arrow-behind-box`  | warn  | Arrow passes through an unrelated box                                   | `arrowPolyline` + `pathPassesThrough`                        | Regroup, `--lines angled`, a rank hint |
| `edge-crossings`    | warn  | Count of crossing arrow pairs, above a threshold scaled by edge count   | `pathsCross` pairwise (16 edges: 120 pairs, trivial)         | Try variants (`lint --compare`)        |
| `label-collision`   | warn  | An edge label's box overlaps a node                                     | Label anchor from `arrow-label-layout.ts` against node rects | Shorten label, relayout                |
| `label-overflow`    | warn  | A label needs more lines than the box holds                             | `labelBoxSize` estimate against the element's size           | Shorten; detail into the note          |
| `label-long`        | info  | Node label over 40 characters (it was capped, full text in the note)    | `capLabel`                                                   | Accept, or shorten                     |
| `node-isolated`     | warn  | A boxed node with no arrows in a tab that is otherwise a graph          | Arrow endpoints                                              | Connect it, or drop it                 |
| `group-escape`      | warn  | A member lies outside its group's frame                                 | Frame rect containment                                       | Relayout                               |
| `group-split-edges` | info  | Share of edges that leave their group is high (the §1 tier-group fault) | Membership against edges                                     | Group by ownership, or drop groups     |
| `node-ungrouped`    | info  | One node outside every group when all others are grouped                | Membership                                                   | Give it a group, or accept             |
| `duplicate-label`   | info  | Two nodes with the same label                                           | Label map                                                    | Rename, or merge                       |
| `flow-backwards`    | info  | Edges pointing against the flow direction                               | Rank of from against to                                      | Intended (a loop)? else reverse        |
| `aspect-extreme`    | info  | Extent ratio beyond 3:1 (reads badly on a screen and in a PNG)          | Bounding box                                                 | Switch direction                       |
| `colour-on-themed`  | info  | Fill or stroke set on a themed element                                  | Field presence, sticky exempt                                | Remove; the theme owns colour          |

Deliberately not checked: aesthetics a rule cannot judge (whether the story reads), which is
what the PNG is for.

### Output

Compact by default, one finding a line, ids first so the agent can act without re-reading:

```bash
$ livediagram tab lint shop-arch/overview
5 crossings · 2 behind · 0 overlaps · 1319×789 → 2 warn, 1 info
W arrow-behind-box   orders→bus passes behind pay           fix: regroup, or --lines angled
W arrow-behind-box   bus→notify passes behind pay           fix: regroup, or --lines angled
I group-split-edges  core: 12 of 13 edges cross its border  fix: group by ownership, or drop
```

- `--json` returns the same findings as an array, for scripts.
- Exit codes: `0` no errors, `1` errors, `2` the lint could not run. Warnings exit `0` unless
  `--strict`, so an agent in a loop can gate on errors alone.
- `lint --compare` re-lays the same graph in a handful of variants (direction, groups on or
  off, line style) and prints one line of metrics each; layout plus checks for 15 nodes is
  milliseconds, so this costs the agent about 100 tokens to pick a better arrangement:

```bash
$ livediagram graph lint arch.yaml --compare direction,groups
variant              crossings  behind  extent     ratio
right  groups        5          2       1317×1196  1.1
right  no-groups     0          0       1319×789   1.7   ← best
down   groups        7          3       1206×1364  0.9
down   no-groups     0          0       822×1210   0.7
```

### Properties

- **Pure and local**: runs on a graph file before anything is written (`graph lint`) and on a
  stored tab (`tab lint`, after one read). The same module serves the MCP, which can append
  the summary line to every write's result.
- **Deterministic**: the same input gives the same findings in the same order, so tests pin
  every rule (one fixture per code).
- **Observable**: each run logs its counts under a `lint.run` fingerprint and each finding
  code once, so how often agents hit each fault is measurable.
- **Bounded**: crossing checks are quadratic in arrows; above 300 arrows sample or report
  "skipped: too many arrows" rather than stall. Path sampling is already capped per segment
  (`PATH_MAX_SAMPLES_PER_SEGMENT`).

## 9. Recommended authoring flow for the CLI

### Where the code lives

The CLI should run layout, render and lint **client-side**, from the same packages the MCP
uses, so both paths draw and judge identically and a dry run needs no network. That means
moving the MCP-only parts (`graph-input.ts`: label cap, layout choice, lines, Mermaid) out of
`apps/mcp` into a shared package (for example `packages/authoring`, beside a new lint
module), per the reuse rule. Rasterising in Node can use `@resvg/resvg-wasm` with the same
embedded Inter, measured above at 60 to 160 ms.

### The source format

Accept what the MCP accepts, so agents learn one thing:

- **Mermaid** (`.mmd`): the format models know best from training; flowcharts with
  subgraphs, state and ER diagrams.
- **Graph YAML or JSON**: the MCP `graph` shape (`nodes`, `edges`, `groups`, `direction`,
  `style`, `lines`), which also carries notes, entity fields and links. YAML is about 30 %
  fewer tokens than JSON for the same graph.

Additions worth making to the graph shape (each needs a spec change first): `icon` on a node
(a Technology or line-art id, with an `icon search` verb in the draw.io tradition); a closed
set of hints (`rank: same` for a list of ids, `order` within a rank, `constrain: false` on an
edge); and deterministic edge ids derived from their ends, so re-applying a source updates
arrows in place instead of replacing them.

### The commands, in the order an agent meets them

```bash
livediagram help authoring            # the graph format, hints, shapes, one worked example
livediagram template list             # 68 kinds, one line each; --category to narrow
livediagram icon search kafka         # icon ids for nodes
livediagram graph lint arch.yaml      # local: layout + checks, nothing written
livediagram graph lint arch.yaml --compare direction,groups
livediagram graph render arch.yaml -o arch.png   # local preview for a multimodal agent
livediagram doc create "Shop architecture" --tab Overview -f arch.yaml
livediagram tab apply shop-arch/overview -f arch.yaml [--dry-run]   # re-apply an edited source
livediagram tab view shop-arch/overview --as outline|layout|png|json
livediagram tab lint shop-arch/overview
```

- `apply` on a tab the agent still owns relayouts the whole graph; on a tab a person has
  arranged it refuses unless `--relayout` or `--place-new` is given, and says so in one line.
- Every write prints the deep link and the lint summary line; the PNG only when `--png` is
  passed.
- `doc create -f` and `tab apply -f` read `-` for stdin, so an agent can pipe a heredoc
  without writing a file.

### The loop

1. Read `help authoring` once (or use the MCP schema resource).
2. Choose: graph (anything with arrows), template (boards), or elements (a deliberate shape).
3. Write the whole topology as one source file; headings in labels, detail in notes.
4. `graph lint --compare`, pick the variant; fix errors; render the PNG if the agent can see.
5. `doc create` (or `tab apply`); share the link.
6. Iterate by editing the source and `apply`; switch to element ops once a person has moved
   things.

## 10. Mock session: 15-node architecture, checked, one fix

An agent in a repo is asked: "Draw our shop's architecture and give me a link." The metrics
below are the measured ones from §1.

```bash
$ livediagram help authoring | head -20
graph source: YAML/JSON {nodes, edges, groups?, direction?, style?, lines?} or Mermaid
node:  {id, label (≤40, rest moves to note), shape?, note?, group?, fields?}
edge:  {from, to, label?}      group: {id, label?}   direction: down|right
shapes: square (default), stadium, cylinder, diamond, hexagon, ... (shapes list)
check before writing: livediagram graph lint <file> [--compare direction,groups]
```

The agent writes the topology in one go, grouped by tier because that is how the README
describes the system:

```bash
$ cat > arch.yaml <<'EOF'
direction: right
groups: [{id: clients, label: Clients}, {id: edge, label: Edge}, {id: core, label: Core services},
         {id: data, label: Data}, {id: ext, label: Third parties}]
nodes:
  - {id: web, label: Web app, group: clients}
  - {id: mobile, label: Mobile app, group: clients}
  - {id: cdn, label: CDN, group: edge}
  - {id: gw, label: API gateway, group: edge}
  - {id: auth, label: Auth service, group: core}
  - {id: orders, label: Orders service, group: core}
  - {id: pay, label: Payments service, group: core}
  - {id: inv, label: Inventory service, group: core}
  - {id: notify, label: Notifications, group: core}
  - {id: bus, label: Event bus, shape: stadium}
  - {id: ordersdb, label: Orders DB, shape: cylinder, group: data}
  - {id: invdb, label: Inventory DB, shape: cylinder, group: data}
  - {id: cache, label: Redis cache, shape: cylinder, group: data}
  - {id: stripe, label: Stripe, group: ext}
  - {id: email, label: Email provider, group: ext}
edges:
  - {from: web, to: cdn}
  - {from: web, to: gw}
  - {from: mobile, to: gw}
  - {from: gw, to: auth}
  - {from: gw, to: orders}
  - {from: gw, to: inv}
  - {from: orders, to: pay}
  - {from: orders, to: ordersdb}
  - {from: orders, to: bus, label: OrderPlaced}
  - {from: inv, to: invdb}
  - {from: inv, to: cache}
  - {from: bus, to: notify}
  - {from: bus, to: inv}
  - {from: pay, to: stripe}
  - {from: notify, to: email}
  - {from: auth, to: cache}
EOF

$ livediagram graph lint arch.yaml
15 nodes · 16 edges · 5 crossings · 2 behind · 0 overlaps · 1317×1196 → 2 warn, 2 info
W arrow-behind-box   orders→bus passes behind pay           fix: regroup, or --lines angled
W arrow-behind-box   bus→notify passes behind pay           fix: regroup, or --lines angled
I group-split-edges  data: 4 of 4 edges arrive from other groups   fix: group by ownership, or drop
I node-ungrouped     bus is outside every group             fix: give it a group, or accept
```

The agent does not guess; it asks for the alternatives:

```bash
$ livediagram graph lint arch.yaml --compare groups
variant              crossings  behind  extent     ratio
right  groups        5          2       1317×1196  1.1
right  no-groups     0          0       1319×789   1.7   ← best
```

**The fix.** The tier frames are what route arrows through the core. The agent drops the
`group` keys and the `groups` list (two edits to the source), because the left-to-right flow
already reads as tiers without frames, and re-checks:

```bash
$ sed -i -e '/^groups:/,/Third parties}\]$/d' -e 's/, group: [a-z]*//' arch.yaml
$ livediagram graph lint arch.yaml
15 nodes · 16 edges · 0 crossings · 0 behind · 0 overlaps · 1319×789 → clean

$ livediagram graph render arch.yaml -o /tmp/arch.png
/tmp/arch.png 1000×617 (≈823 image tokens)
```

A multimodal agent opens the PNG and sees clients on the left, the gateway fanning out to
auth, orders and inventory, each database beside its service, and the `OrderPlaced` label on
its own edge. It creates the document:

```bash
$ livediagram doc create "Shop architecture" --tab Overview -f arch.yaml
created shop-architecture (d_7Kq2) · tab Overview (t_1) · 15 nodes · lint clean
https://livediagram.app/document/d_7Kq2
```

Total feedback cost of the loop: two lint reports and a comparison (about 300 tokens) plus one
PNG (about 800 tokens), against about 1,700 tokens for a single read of the elements JSON.
A text-only agent would have reached the same fix from the lint alone.

## 11. Gaps found in the current code

Recorded for whoever specs the CLI; each needs triage, none was changed here.

- **Clustered layout costs crossings.** On the §1 graph, groups added 2 to 7 crossings and 2
  to 4 hidden arrows over the ungrouped layout. Ordering members within a group by their
  external neighbours, or a crossing pass across group blocks, may close most of the gap.
- **Edge labels can land on nodes** (the `OrderPlaced` label inside Payments, domain-group
  variant). Label placement does not avoid boxes.
- **`mermaidFromTab` always writes `flowchart TD`** (`mermaid-serialise.ts` line 97), even for
  a left-to-right layout, and renumbers ids to `n1..nN`, so a round trip loses direction and
  the agent's semantic ids. A CLI outline view should keep element ids.
- **No incremental layout**: no option keeps existing nodes still while placing new ones.
- **Edge ids are random UUIDs** (`graphToElements` default), so re-applying a graph replaces
  every arrow rather than updating it.
- **Graph nodes cannot carry an icon**, though shapes support `iconId` and 77 Technology
  icons exist.
- **No layout hints** (same rank, order, non-constraining edge).

## 12. Open forks

These are product decisions, not research conclusions:

- Whether the CLI lays out and renders locally (shared packages, offline dry runs) or the
  public API gains a graph endpoint (one implementation server-side, thinner CLI). This
  research leans local, with the package shared by MCP and CLI.
- How "the agent owns this tab" is decided: a stored layout fingerprint, the last writer's
  `source`, or an explicit flag the agent passes.
- Whether to invent a line-oriented graph syntax (Eraser and D2 style, fewer tokens) or stay
  with Mermaid plus YAML (known to every model, no new grammar). This research leans to the
  latter.
- Whether the MCP should append the lint summary to every write result, which would bring
  the same self-correction to chat agents at about 30 tokens a call.

## Sources

- tldraw agent starter kit: README, tldraw's templates/agent/shared/schema/AgentActionSchemas.ts
  (`place`, `review`), tldraw's shared/types/AgentCanvasLint.ts, tldraw's client/agent/managers/AgentLintManager.ts,
  <https://github.com/tldraw/tldraw/tree/main/templates/agent>
- draw.io MCP: <https://github.com/jgraph/drawio-mcp> (tools, ELK and libavoid passes)
- mermaid-to-excalidraw: <https://github.com/excalidraw/mermaid-to-excalidraw>
- DiagrammerGPT, arXiv 2310.12128: <https://arxiv.org/abs/2310.12128>
- AutomaTikZ, arXiv 2310.00367: <https://arxiv.org/abs/2310.00367>
- DeTikZify, arXiv 2405.15306: <https://arxiv.org/abs/2405.15306>
- TikZero, arXiv 2503.11509: <https://arxiv.org/abs/2503.11509>
- StarVector, arXiv 2312.11556: <https://arxiv.org/abs/2312.11556>
- VGBench, arXiv 2407.10972: <https://arxiv.org/abs/2407.10972>
- LayoutGPT, arXiv 2305.15393: <https://arxiv.org/abs/2305.15393>
- Visualization-of-Thought, arXiv 2404.03622: <https://arxiv.org/abs/2404.03622>
- Visual Sketchpad, arXiv 2406.09403: <https://arxiv.org/abs/2406.09403>
- GRASP, arXiv 2407.01892: <https://arxiv.org/abs/2407.01892>
- Grid Spatial Understanding, arXiv 2603.17333: <https://arxiv.org/abs/2603.17333>
- ChatGPT and graph layout, arXiv 2303.08819: <https://arxiv.org/abs/2303.08819>
- Self-Refine, arXiv 2303.17651: <https://arxiv.org/abs/2303.17651>
- MermaidSeqBench, arXiv 2511.14967: <https://arxiv.org/abs/2511.14967>
- GenAI-DrawIO-Creator, arXiv 2601.05162: <https://arxiv.org/abs/2601.05162>
- Anthropic image token estimate (width × height / 750): Claude vision documentation
- In-repo: `apps/mcp/src/graph-input.ts`, `apps/mcp/src/render.ts`, `apps/mcp/src/schema.ts`,
  `apps/mcp/src/prompts.ts`, `packages/document/src/graph-authoring.ts`, `auto-layout*.ts`,
  `arrow-path-hits.ts`, `mermaid-serialise.ts`, `packages/icons/src/tech-icon-ids.ts`,
  `packages/templates/src/templates.ts`
