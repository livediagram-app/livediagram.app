# Design views

**Status: built**, the `lint` view answered by the [page lint](page-lint.md); the CLI reads a pulled file's views
offline and computes `diff` from its read copies.

A **view** is a read-only text projection of a tab, each answering one kind of question at the lowest token cost.
Views are what an agent reads by default; JSON is what it asks for. The measurements behind every choice here are in
`docs/research/agent-cli/compact-representations.md` (a 30-element tab: 4,213 tokens as JSON, 386 as an outline).

## Refs

- An element's **ref** is its id when the id is a slug (`^[a-z][a-z0-9_-]{0,23}$`, as an `id=` in edit operations writes them),
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
- Refs, slug ids, kind words, containment and the content origin live in `@livedesign/design`, so views, edit
  operations and the lint name elements alike.

## The outline (default)

One line per element: its kind, ref, label, attributes, then its outgoing arrows. Indentation is containment.

```text
tab 0b34 "Checkout" · 24 elements: 9 boxes, 3 frames, 4 arrows · 3 pages: 3 wireframe (view pages) · threads 1 open/2 · rev 41
frame 048c "Cart"
  text b811 "Your cart"
  image 649c "Product photo"
frame c991 "Payment"
  square 146b "Revenue" icon=chart → e4a8
  square e4a8 "Margin" comments=1 resolved
  table 480a 4x3 Region | Q2 | Q3
frame d41e "Done"
  sticky 0c84 "Check the churn figure before Friday" comments=2 open
```

The example is abridged; a real outline prints every element.

- **Header** names the tab, its counts (boxes, frames, arrows), its finish when set (`finish=sketch`), its pages (`4 pages: 3 wireframe, 1 logo (view pages)`), elements on hidden layers and elements of unknown kinds, open threads and the revision.
- **Kind** is the shape for shapes (`square`, `cylinder`, `frame`), else the element type (`text`, `sticky`, `table`, `arrow`, `image`, `freehand`).
- **Labels and notes** are JSON strings. Labels are cut at 60 characters, notes at 48, both on a word boundary
  with `…`.
- **Containment** is derived: an element nests under the smallest frame holding its centre
  (`deriveContainers`). Edit operations report frame
  membership by the same rule; the editor's frame drag keeps its own.
- **Arrows** print on their source line as `→ target "label" ~style`; an arrow with a free end prints on its own
  line. The arrow's own id is in the `graph` view.
- **Order** within a level is reading order: rows top to bottom, then left to right.
- **Content kinds** say what they hold briefly: a table its size and header row, a
  code block its language and line count, a chart its slice or series count, a checklist `done=2/5`.
- **Live and structured kinds** carry one state attribute: a progress bar `progress=40`, and likewise for stat rows,
  process steps, legends, ratings, timelines and pages.
- **Instances** ([Components](../009-elements/components.md)) print as one element, never as the main's elements:
  `instance 6d2a instance of "Nav bar" overrides=2 fields=label,fillColor`, naming the main and, when it has any,
  how many main elements its overrides touch and which fields. A main the reader was not given prints by id with
  `(main not loaded)`; one the library does not hold, `(main missing)`. The `components` view lists the mains.
- **Bare strokes** (freehand with no label, note, comment, link or arrow) that sit next to each other fold into one
  line, `freehand ×12 (3 closed)`; `layout` lists each one with its ref.
- **Left out**: coordinates, sizes, colours, fonts, anchors and routing (the `layout` view and `--style` have them),
  comment bodies (the `comments` view), elements on hidden layers (counted in the header).

## The views

| View           | Answers                         | Holds                                                                                                                                                          |
| -------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `overview`     | What is in this design?         | Its tabs, their sizes, open threads, last edit; no elements                                                                                                    |
| `outline`      | What does this tab mean?        | As above                                                                                                                                                       |
| `graph`        | What connects to what?          | Nodes (ref, kind, label) and arrows (ref, from, to, label), nothing else                                                                                       |
| `layout`       | Where do things sit?            | Rounded geometry per element from the content origin (the header names the origin when it is not 0,0: stored = shown + origin), or `--coarse` rows and columns |
| `comments`     | What are people saying?         | Open threads with their element's ref and label, every comment in full                                                                                         |
| `show <ref>`   | Everything about one element    | Every field, plus its arrows in and out and its container; or `selected`                                                                                       |
| `find <text>`  | Where is this?                  | Matching elements with their containers                                                                                                                        |
| `lint`         | Does the text fit?              | The [lint](page-lint.md) findings, refs first                                                                                                                  |
| `diff --since` | What changed since I last read? | Added, removed, changed and moved elements since a revision                                                                                                    |
| `pages`        | What pages does this tab have?  | Its pages and the layouts on offer ([Pages for agents](pages-for-agents.md#reading-the-pages-view))                                                            |
| `components`   | What can I place and override?  | The design's component library: each main's id, name, frame, archived flag and its elements (id, kind, text); no tab                                           |

Every view opens with a header line naming the tab, its counts and its `rev`, so a later write can carry it as a
base. Every view takes `--json` for the same data as JSON; the stored tab itself is `--raw`.

`show selected` reads what the agent's owner has selected in an open editor now, the selection the `selected`
selector of [edit operations](edit-operations.md#selectors) reads: every selected element in full, in the tab's order,
fitted by `--budget`. Nothing selected, or a selection that could not be read, is refused as edit operations refuse
it. The api serves it; a pulled file has no live selection.

`components` reads the design, not a tab ([Components](../009-elements/components.md)): one line per main,
`component <id> "<name>" <w>x<h> [archived] · <n> elements`, then each of its elements indented, `<kind> <id>
"<text>"`, the ids an instance's `componentOverrides` is keyed by and the fields each takes (`takes=label,fillColor,…`).
A tab-scoped reader sees only the mains its tab uses. Views that measure or place (`layout`, the lint) treat an
instance as its box; anything that draws a tab (a PNG preview) expands each instance into its main's elements first
(`expandInstances`).

`diff` is computed by the CLI: it keeps the last tab it read of each design and tab, with its revision, and
compares that copy with the current tab. The api serves no diff.

## Budgets

- `--budget <tokens>` fits a view to a budget by dropping detail in a fixed order: notes, then attributes, then the
  children of the largest containers. Tokens are estimated at characters ÷ 3.
- The api and the CLI apply no budget unless asked; the MCP's `read_design` applies 8,000 tokens unless its caller
  passes another.
- A view never truncates silently: it ends with one line naming what it left out and the command that shows it,
  in the syntax of the door it was read through (`… 12 elements in frame c991 hidden: view --only c991` in the CLI,
  `read_design {"only":"c991"}` in the MCP).

## Where views are made

- One package, `@livedesign/design-views`, holds every view as a pure function of a tab.
- The api serves every view but `diff`: `GET /api/designs/:id/tabs/:tabId?view=<name>` answers `text/plain`,
  `GET /api/designs/:id?view=overview` the overview and `GET /api/designs/:id?view=components` the library. A tab
  view of a tab holding instances is rendered with the mains that tab uses (read only then).
- The MCP's `read_design` returns a view, the outline by default, instead of element JSON: its text first, then one
  line of JSON naming the design, the tab, its revision and its link. It takes the view's arguments (`view`,
  `budget`, `only`, ...), returns the elements with `format: "json"`, and attaches a PNG only with `image: true`;
  `view: "components"` reads the design's library.
- The CLI uses the api's views online and the package for local files (`pull`). An element kind the renderer does
  not know prints as `? <type> <ref> "label"` and is counted in the header, never dropped.
- Each view the api answers counts one anonymous `Agent·Viewed` event typed by the view's name
  ([Telemetry](../017-telemetry/telemetry.md)).
