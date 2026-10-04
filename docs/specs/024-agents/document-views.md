# Document views

**Status: built, except the `lint` view (it arrives with the [diagram lint](diagram-lint.md)) and the CLI that
reads views offline and computes `diff`.**

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
- Refs, slug ids, kind words, containment and the content origin live in `@livediagram/document`, so views, edit
  operations and the lint name elements alike.

## The outline (default)

One line per element: its kind, ref, label, attributes, then its outgoing arrows. Indentation is containment.

```text
tab 0b34 "Checkout platform" · 30 elements: 16 boxes, 3 frames, 11 arrows · threads 1 open/2 · rev 41
frame 048c "Edge"
  actor b811 "Customer" → a3cf
  hexagon 649c "API gateway" note="Kong. Terminates TLS, rate-limits per API key,"… → 202b "JWT", 146b
frame c991 "Services"
  square 146b "Orders service" icon=server → e4a8 "charge", d41e, 6406 "OrderPlaced"
  square e4a8 "Payments service" comments=1 resolved → e6d7 "HTTPS" ~dashed
cylinder d41e "Orders DB"
entity cb02 "Order" {id uuid PK; customer_id uuid FK; status text; total_cents int}
table 480a 4x3 Service | p99 latency | Availability
sticky 0c84 "Payment retries are not idempotent yet!" comments=2 open
```

The example is abridged; a real outline prints every element.

- **Header** names the tab, its counts (boxes, frames, lanes, arrows), the tab kind when it is not a diagram
  (`kind=event-storming`), elements on hidden layers and elements of unknown kinds, open threads and the revision.
- **Kind** is the shape for shapes (`square`, `cylinder`, `frame`, `lane`, `entity`), an event-storming note's
  notation (`domain-event`, `command`; `es:actor` so it never reads as the actor shape), else the element type
  (`text`, `sticky`, `table`, `arrow`, `image`, `freehand`).
- **Labels and notes** are JSON strings. Labels are cut at 60 characters, notes at 48, both on a word boundary
  with `…`.
- **Containment** is derived: an element nests under the smallest frame or lane holding its centre, as
  `mermaidFromTab` decides it. A mind map's parent link wins over geometry. Edit operations report frame and lane
  membership by the same rule; the editor's frame drag keeps its own.
- **Arrows** print on their source line as `→ target "label" ~style`; an arrow with a free end prints on its own
  line. The arrow's own id is in the `graph` view.
- **Order** within a level is reading order: rows top to bottom, then left to right.
- **Content kinds** say what they hold briefly: an entity its first 8 fields, a table its size and header row, a
  code block its language and line count, a chart its slice or series count, a checklist `done=2/5`.
- **Live and structured kinds** carry one state attribute: an estimate card `votes=4 revealed`, a decision
  `status=accepted`, a progress bar `progress=40`, and likewise for the rest of the collaboration family, stat rows,
  process steps, agendas, quizzes, legends, ratings, timeline rails and pages.
- **Bare strokes** (freehand with no label, note, comment, link or arrow) that sit next to each other fold into one
  line, `freehand ×12 (3 closed)`; `layout` lists each one with its ref.
- **Left out**: coordinates, sizes, colours, fonts, anchors and routing (the `layout` view and `--style` have them),
  comment bodies (the `comments` view), elements on hidden layers (counted in the header).

## The views

| View           | Answers                         | Holds                                                                    |
| -------------- | ------------------------------- | ------------------------------------------------------------------------ |
| `overview`     | What is in this document?       | Its tabs, their sizes, open threads, last edit; no elements              |
| `outline`      | What does this tab mean?        | As above                                                                 |
| `graph`        | What connects to what?          | Nodes (ref, kind, label) and arrows (ref, from, to, label), nothing else |
| `layout`       | Where do things sit?            | Rounded geometry per element, or `--coarse` rows and columns             |
| `comments`     | What are people saying?         | Open threads with their element's ref and label, every comment in full   |
| `show <ref>`   | Everything about one element    | Every field, plus its arrows in and out and its container                |
| `find <text>`  | Where is this?                  | Matching elements with their containers                                  |
| `lint`         | Is the drawing sound?           | The [lint](diagram-lint.md) findings, refs first                         |
| `diff --since` | What changed since I last read? | Added, removed, changed and moved elements since a revision              |

Every view opens with a header line naming the tab, its counts and its `rev`, so a later write can carry it as a
base. Every view takes `--json` for the same data as JSON; the stored tab itself is `--raw`.

`diff` is computed by the CLI: it keeps the last tab it read of each document and tab, with its revision, and
compares that copy with the current tab. The api serves no diff.

## Budgets

- `--budget <tokens>` fits a view to a budget by dropping detail in a fixed order: notes, then attributes, then the
  children of the largest containers. Tokens are estimated at characters ÷ 3.
- The api and the CLI apply no budget unless asked; the MCP's `read_document` applies 8,000 tokens unless its caller
  passes another.
- A view never truncates silently: it ends with one line naming what it left out and the command that shows it,
  in the syntax of the door it was read through (`… 12 elements in frame c991 hidden: view --only c991` in the CLI,
  `read_document {"only":"c991"}` in the MCP).

## Where views are made

- One package, `@livediagram/document-views`, holds every view as a pure function of a tab.
- The api serves every view but `diff`: `GET /api/documents/:id/tabs/:tabId?view=<name>` answers `text/plain`, and
  `GET /api/documents/:id?view=overview` the overview.
- The MCP's `read_document` returns a view, the outline by default, instead of element JSON: its text first, then one
  line of JSON naming the document, the tab, its revision and its link. It takes the view's arguments (`view`,
  `budget`, `only`, ...), returns the elements with `format: "json"`, and attaches a PNG only with `image: true`.
- The CLI uses the api's views online and the package for local files (`pull`). An element kind the renderer does
  not know prints as `? <type> <ref> "label"` and is counted in the header, never dropped.
- Each view the api answers counts one anonymous `Agent·Viewed` event typed by the view's name
  ([Telemetry](../017-telemetry/telemetry.md)).
