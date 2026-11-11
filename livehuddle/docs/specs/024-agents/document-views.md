# Document views

> **No lint view** ([The element engine](../002-project-scope/not-in-livehuddle.md#the-element-engine), part 5): the diagram lint left livehuddle, so `lint` is no longer a
> view and `view=lint` is refused as an unknown view. The arrow selectors (`from:`, `to:`, `->`, `downstream:`,
> `upstream:`) left the edit operations; the views still print a stored arrow as `? arrow`. A stored square, circle or
> other diagram shape prints as `? <kind>` like any retired element.

> **No arrow joins anything** ([The element engine](../002-project-scope/not-in-livehuddle.md#the-element-engine), part 4): a stored arrow, stroke, path or
> annotation prints as `? <kind>`, and the graph view lists no node and no arrow.

> **No MCP server or CLI in livehuddle** ([Not in livehuddle](../002-project-scope/not-in-livehuddle.md#the-mcp-server-the-cli-and-workbenches)):
> the REST API is the only front door. Where this file names the MCP or the CLI, it records livediagram's front
> doors over the same engine, where this design came from; their wire values (`mcp`, `cli`) still parse.

**Status: built**, the `lint` view answered by the [diagram lint](diagram-lint.md). No livehuddle door serves `diff`
(livediagram's CLI computes it from its read copies).

A **view** is a read-only text projection of a tab, each answering one kind of question at the lowest token cost.
Views are what an agent reads by default; JSON is what it asks for. The measurements behind every choice here are in
`docs/research/agent-cli/compact-representations.md` (a 30-element tab: 4,213 tokens as JSON, 386 as an outline).

## Refs

- An element's **ref** is its id when the id is a slug (`^[a-z][a-z0-9_-]{0,23}$`, as graph input writes them),
  otherwise the shortest prefix of its id unique within the tab, at least 4 characters. An id whose prefix would
  hold anything but letters, digits, `_` and `-` prints as `id:` and the full id as a JSON string (`id:"Node A"`),
  which selectors take too.
- Every command and endpoint that takes an element accepts a ref, any unique prefix, or the full id. An ambiguous
  prefix is refused with the candidates; it is never guessed.
- A prefix printed earlier can become ambiguous when someone adds an element; the refusal says so and the agent
  re-reads.
- A label is never a ref. Labels are matched by [selectors](edit-operations.md#selectors).
- Elements an agent adds take a slug of their label as their id unless it gives one (`Redis cache` becomes
  `redis-cache`, `-2` on a clash), so agent-built tabs read cheaply.
- Refs, slug ids, kind words and the content origin live in `@livehuddle/document`, so views, edit operations and
  the lint name elements alike.

## The outline (default)

One line per element: its kind, ref, label, attributes, then its outgoing arrows. The outline is flat: nothing
nests, because the layout containers that once held elements (lane, stack, boundary) are retired kinds that hold
nothing ([not in livehuddle](../002-project-scope/not-in-livehuddle.md) "The element engine", part 3).

```text
tab 0b34 "Checkout platform" · 30 elements: 19 boxes, 11 arrows · 4 unknown · threads 1 open/2 · rev 41
? boundary 048c "Edge"
hexagon 649c "API gateway" note="Kong. Terminates TLS, rate-limits per API key,"… → 202b "JWT", 146b
actor b811 "Customer" → a3cf
? boundary c991 "Services"
square 146b "Orders service" icon=server → e4a8 "charge", d41e, 6406 "OrderPlaced"
square e4a8 "Payments service" comments=1 resolved → e6d7 "HTTPS" ~dashed
cylinder d41e "Orders DB"
square cb02 "Order"
? table 480a
sticky 0c84 "Payment retries are not idempotent yet!" comments=2 open
```

The example is abridged; a real outline prints every element.

- **Header** names the tab, its counts (boxes and arrows; a stored lane or boundary is a box), its finish when set
  (`finish=sketch`), elements of unknown kinds, open threads and the revision.
- **Kind** is the shape for shapes (`square`, `cylinder`), else the element type (`text`, `sticky`, `arrow`,
  `image`, `freehand`). A retired kind prints as `? <kind>` (`? boundary`, `? lane`, `? table`), its stored label
  kept and searchable by `find`.
- **Labels and notes** are JSON strings. Labels are cut at 60 characters, notes at 48, both on a word boundary
  with `…`.
- **No containment**: nothing holds an element. A stored lane, stack or boundary prints as one line like any other
  element, and what sat on it prints beside it, unindented ([not in livehuddle](../002-project-scope/not-in-livehuddle.md) "The element engine", part 3).
- **Arrows** print on their source line as `→ target "label" ~style`; an arrow with a free end prints on its own
  line. The arrow's own id is in the `graph` view.
- **Order** is reading order: rows top to bottom, then left to right.
- **No content summaries or state attributes**: the kinds that had them (tables, code blocks, charts, checklists,
  Timelines, stacks, cards, badges and steps) are retired, and a retired element carries none. The JSON keeps
  `summary: null` on every node.
- **Bare strokes** (freehand with no label, note, comment, link or arrow) that sit next to each other fold into one
  line, `freehand ×12 (3 closed)`; `layout` lists each one with its ref.
- **Left out**: coordinates, sizes, colours, fonts, anchors and routing (the `layout` view and `--style` have them),
  comment bodies (the `comments` view).

## The views

| View           | Answers                         | Holds                                                                                                                                                          |
| -------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `overview`     | What is in this document?       | Its tabs, their sizes, open threads, last edit; no elements                                                                                                    |
| `outline`      | What does this tab mean?        | As above                                                                                                                                                       |
| `graph`        | What connects to what?          | Nodes (ref, kind, label) and arrows (ref, from, to, label), nothing else                                                                                       |
| `layout`       | Where do things sit?            | Rounded geometry per element from the content origin (the header names the origin when it is not 0,0: stored = shown + origin), or `--coarse` rows and columns |
| `comments`     | What are people saying?         | Open threads with their element's ref and label, every comment in full                                                                                         |
| `show <ref>`   | Everything about one element    | Every field, plus its arrows in and out; or `selected`                                                                                                         |
| `find <text>`  | Where is this?                  | Matching elements, each on its outline line                                                                                                                    |
| `lint`         | Is the drawing sound?           | The [lint](diagram-lint.md) findings, refs first                                                                                                               |
| `diff --since` | What changed since I last read? | Added, removed, changed and moved elements since a revision                                                                                                    |

Every view opens with a header line naming the tab, its counts and its `rev`, so a later write can carry it as a
base. Every view takes `--json` for the same data as JSON; the stored tab itself is `--raw`.

`show selected` reads what the agent's owner has selected in an open editor now, the selection the `selected`
selector of [edit operations](edit-operations.md#selectors) reads: every selected element in full, in the tab's order,
fitted by `--budget`. Nothing selected, or a selection that could not be read, is refused as edit operations refuse
it. The api serves it; a pulled file has no live selection.

`diff` is computed by the CLI: it keeps the last tab it read of each document and tab, with its revision, and
compares that copy with the current tab. The api serves no diff.

## Budgets

- `--budget <tokens>` fits a view to a budget by dropping detail in a fixed order: notes, then attributes, then the
  outline's trailing lines, as few as the budget asks. Tokens are estimated at characters ÷ 3.
- The api and the CLI apply no budget unless asked; the MCP's `read_document` applies 8,000 tokens unless its caller
  passes another.
- A view never truncates silently: it ends with one line naming what it left out and the command that shows it,
  in the syntax of the door it was read through (`… notes hidden; attributes hidden; 12 elements hidden: view --budget
420` in the CLI, `read_document {"budget":420}` in the MCP).

## Where views are made

- One package, `@livehuddle/document-views`, holds every view as a pure function of a tab.
- The api serves every view but `diff`: `GET /api/documents/:id/tabs/:tabId?view=<name>` answers `text/plain`, and
  `GET /api/documents/:id?view=overview` the overview.
- The MCP's `read_document` returns a view, the outline by default, instead of element JSON: its text first, then one
  line of JSON naming the document, the tab, its revision and its link. It takes the view's arguments (`view`,
  `budget`, `only`, ...), returns the elements with `format: "json"`, and attaches a PNG only with `image: true`.
- The CLI uses the api's views online and the package for local files (`pull`). An element kind the renderer does
  not know prints as `? <type> <ref> "label"` and is counted in the header, never dropped.
- Each view the api answers counts one anonymous `Agent·Viewed` event typed by the view's name
  ([Telemetry](../017-telemetry/telemetry.md)).
