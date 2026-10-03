# Document views

**Status: specified, not built.**

A **view** is a read-only text projection of a tab, each answering one kind of question at the lowest token cost.
Views are what an agent reads by default; JSON is what it asks for. The measurements behind every choice here are in
`docs/research/agent-cli/compact-representations.md` (a 30-element tab: 4,213 tokens as JSON, 386 as an outline).

## Refs

- An element's **ref** is its id when the id is a slug (`^[a-z][a-z0-9_-]{0,23}$`, as graph input writes them),
  otherwise the shortest prefix of its id unique within the tab, at least 4 characters.
- Every command and endpoint that takes an element accepts a ref, any unique prefix, or the full id. An ambiguous
  prefix is refused with the candidates; it is never guessed.
- A prefix printed earlier can become ambiguous when someone adds an element; the refusal says so and the agent
  re-reads.
- A label is never a ref. Labels are matched by [selectors](edit-operations.md#selectors).
- Elements an agent adds take a slug of their label as their id unless it gives one (`Redis cache` becomes
  `redis-cache`, `-2` on a clash), so agent-built tabs read cheaply.

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

- **Kind** is the shape for shapes (`square`, `cylinder`, `frame`, `lane`, `entity`), else the element type
  (`text`, `sticky`, `table`, `arrow`, `image`, `freehand`).
- **Labels and notes** are JSON strings. Labels are cut at 60 characters, notes at 48, both on a word boundary
  with `…`.
- **Containment** is derived: an element nests under the smallest frame or lane holding its centre, as
  `mermaidFromTab` decides it. A mind map's parent link wins over geometry.
- **Arrows** print on their source line as `→ target "label" ~style`; an arrow with a free end prints on its own
  line. The arrow's own id is in the `graph` view.
- **Order** within a level is reading order: rows top to bottom, then left to right.
- **Content kinds** say what they hold briefly: an entity its first 8 fields, a table its size and header row, a
  code block its language and line count, a chart its series count, a checklist `done=2/5`, an event-storming note
  its notation (`domain-event`).
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
| `diff --since` | What changed since I last read? | Added, removed, changed and moved elements since a revision              |

Every view opens with a header line naming the tab, its counts and its `rev`, so a later write can carry it as a
base. Every view takes `--json` for the same data as JSON; the stored tab itself is `--raw`.

## Budgets

- `--budget <tokens>` fits a view to a budget by dropping detail in a fixed order: notes, then attributes, then the
  children of the largest containers. Tokens are estimated at characters ÷ 3.
- A view never truncates silently: it ends with one line naming what it left out and the command that shows it
  (`… 12 elements in frame c991 hidden: view --only c991`).

## Where views are made

- One package, `@livediagram/document-views`, holds every view as a pure function of a tab.
- The api serves them: `GET /api/documents/:id/tabs/:tabId?view=<name>` answers `text/plain`, and
  `GET /api/documents/:id?view=overview` the overview. The MCP's `read_document` returns the outline instead of
  element JSON, with the JSON on request.
- The CLI uses the api's views online and the package for local files (`pull`). An element kind the renderer does
  not know prints as `? <type> <ref> "label"` and is counted in the header, never dropped.
