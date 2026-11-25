# Diagrams and Plans

Two links between livediagram and liveplanner, both ways (Work Tracker 1369). Teams sketch a roadmap or a process in
livediagram, then rebuild it by hand as cards in liveplanner, and the two drift; liveplanner has Blocked By chains and
a Gantt, but no picture of them. With these links a diagram becomes plan cards, and a plan draws itself as a diagram
that stays live.

- **Make Plan Cards** (livediagram, [make-plan-cards.md](../../../../livediagram/docs/specs/013-workspace/make-plan-cards.md)):
  shapes become cards, arrows become Blocked By, lanes become columns or labels, dates become Start and Due.
- **View As Diagram** (liveplanner, [view-as-diagram.md](../../../../liveplanner/docs/specs/026-plan/view-as-diagram.md)):
  a board, or the cards its filter shows, drawn as a livediagram diagram in a connected tab: cards as boxes, Blocked By
  as arrows, columns as lanes, the critical path highlighted, redrawn as the plan changes.

Both pickers offer [Connect as tabs](connected-tabs.md#linked-from-a-send-to): the diagram and the plan each get a connected tab that opens the
other once the cards or the diagram are made. View As Diagram's own connected tab in the plan (for an Editor of the
whole plan, with its pass, as before) is the plan's side: the diagram gains a linked tab back, paired with it, so
removing either removes both.

The platform holds what both need: the **shape-to-card link**, the index's routes that check each person's access, and
the doors each app opens to the index alone. The plan is always the source of truth for cards: a diagram suggests
changes, never overwrites one.

## The shape-to-card link

A card made from a shape is a [Send to Plan](send-to-plan.md) send of kind `element`: the same record (`PlanSend`, ref
`element:<tab>:<element>:`), the card's **Sent From** back to the shape, and the shape's **chip** showing the card's
column and done state, live, to anyone who may open the plan. Making Plan Cards adds no second kind of link, so every
chip, every Sent From row, the Trash rules and the purges hold as they do for a send.

- **Both ways**: the card's Sent From opens the diagram at the shape (`#t=<tab>&el=<element>`); the shape's chip
  opens the card.
- **Making again** matches by the shape's ref: a shape that already has a live card (not in the Trash) in the chosen
  plan updates that card, never makes a second.
- A diagram drawn by View As Diagram links the other way: each box is the card's own address
  (`<liveplanner>/project/<plan>#item=<card>`), so pressing a box's link opens the card.

## Make Plan Cards: the route

`POST /items/:plan/plan-makes` (`PlanMakeAsk`), an account in person, never an app, a token or a guest:

- `board` (the board's element id), `column` (the column cards go to when nothing else places them), `source`
  (`{itemId, tabId, label}`: the diagram, the tab and its name), `cards` (1 to `PLAN_MAKE_CARDS_MAX`), `trash`
  (card ids, 0 to `PLAN_MAKE_CARDS_MAX`).
- Each card: `element` (the shape's id, its key), `title`, `text` (the shape's words), and when the diagram gave them
  `column`, `labels` (each at most 32 characters, at most 12), `start` and `due` (`YYYY-MM-DD`), and `blockedBy` (the
  elements of the shapes it waits on, in this ask).

The index checks, in order: the person's **Edit on the whole plan** (as Send to Plan), their **read on the diagram**
(any level), the per-person limit (`KIT_RUN_LIMITER`, key `plan-make:<person>`), and that the source holds no more than
`PLAN_SENDS_PER_SOURCE_MAX` sends after it. It reads the diagram's live sends in this plan by ref: a card whose shape
already has one is an **update** of that card. Every id in `trash` must be a live card one of this diagram's sends
names in this plan, or the ask is refused (`400`): Make Plan Cards can only take back cards it made.

liveplanner's door makes, updates and trashes the cards as the person (below) and answers each card's id, title,
column and done state. The index records one send for each card made and answers
`{sends, made, updated, trashed, skipped}`; `skipped` counts Blocked By links liveplanner left out because they would
close a loop.

## View As Diagram: the routes

`POST /items/:plan/plan-views` (`PlanViewAsk`: `board`, `filter?`, `name`), an account in person:

1. The person's **read on the plan** (any level, any link they opened); the per-person limit (`plan-view:<person>`).
2. liveplanner's door draws the board's **graph** (`op: 'graph'`, the grant at the person's own level).
3. livediagram's door makes a **new diagram of the person's own** at the top of their library, named `name`, drawn
   from the graph.
4. liveplanner's door **watches** it (`op: 'watch'`): the plan remembers the diagram, its tab, the board, the filter
   and who made it, at most `PLAN_VIEWS_PER_PLAN_MAX` a plan (the oldest goes).
5. The answer, `201 {diagram: {id, title, tabId, link}, cards, links, critical}`, is what the editor needs to put the
   connected tab in and say what was drawn.

The connected tab itself is an ordinary [connection](connected-tabs.md) the plan's editor makes next (Editor on the
diagram, one way), so a Participant or a Viewer, who may not change the plan's tabs, gets the diagram in a new browser
tab instead.

**Live.** When a card on a watched board changes (made, moved, renamed, done, trashed, a Blocked By link added or
removed), the plan's room gathers changes for `PLAN_VIEW_SETTLE_MS`, draws each watched view's graph again, and tells
the index only the views whose graph changed (`POST /app/items/:plan/plan-diagrams`, at most
`PLAN_VIEWS_PER_PLAN_MAX`). For each view the index checks that its maker still reads the plan and still edits the
diagram (neither in the Trash), then asks livediagram's door to redraw the tab as the maker: one changeset, so open
editors see it move and its history holds it. A view whose maker lost either, or whose diagram or tab is gone, answers
`gone`, and the plan forgets it. Never polled: a change no one made draws nothing.

`POST /items/:plan/plan-edits` (`{edits}`, 1 to `PLAN_EDITS_MAX`), an account in person: the structural edits a
diagram offers, applied by liveplanner's door as the person after the index checks their **Edit on the whole plan**:

- `{kind: 'block', card, blocker}`: `card` waits on `blocker` (its first Blocked By field gains it).
- `{kind: 'move', card, column}`: the card goes to the board column of that name.

Each edit answers `applied`, or `refused` with a reason in words ("#5 Launch already waits on #3 Website, so it can't
block it."). The plan then redraws the diagram, so an applied edit's arrow becomes the plan's.

## The doors

Each is opened by the index alone (the app's key), and each checks the person's grant itself before it writes.

- **liveplanner**, `POST /api/internal/items/:plan/plan-diagram`, `X-Index-Grant`:
  - `op: 'make'` (Editor, whole plan): makes the new cards in one insert, in their columns, of the board's first card
    type; updates each existing card's title, Start, Due and labels (never its column: the plan decides where work
    stands) and adds its Blocked By links; moves the `trash` cards to the Trash. When a card waits on another and the
    type has no Blocked By field, the door adds one (**Blocked By**, linking to the type itself) to the type first.
    A link that would close a loop is left out and counted. Each card carries its Sent From. Written as the person's
    own adds and edits: relayed to open editors, in the history as theirs, heard by the plan's rules.
  - `op: 'graph'` (any level): the board's graph (below).
  - `op: 'watch'` (any level): remembers a view.
  - `op: 'edit'` (Editor, whole plan): applies the edits above, each checked as the card panel checks it.
- **livediagram**, `POST /api/internal/items/plan-diagram` (`{owner, name, graph, caption, link, itemId?, tabId?}`):
  without `itemId`, a new diagram of `owner`'s; with them, the tab redrawn as `owner`'s changeset. The graph is laid
  out by livediagram's own auto layout (`style: 'lanes'`, the flow left to right), its caption linked to the board.

## The graph

`PlanDiagramGraph` (`@liveworkspace/index-client` `plan-diagrams.ts`), drawn by liveplanner, checked again by the index
and by livediagram:

- `lanes`: the board's columns in order (`{id, label}`), only those holding a drawn card.
- `nodes`: one a card, in board order, `{card, label, lane, done, critical, link}`; the label is the card's number and
  title ("#12 Launch site"), at most `PLAN_DIAGRAM_LABEL_MAX` characters.
- `edges`: each Blocked By link between two drawn cards, `{from: blocker, to: card, critical}`.
- `total`: how many cards the board (or filter) holds, so a diagram cut at `PLAN_VIEW_CARDS_MAX` says so in its caption
  ("500 of 612 cards").

The **critical path** is the longest chain of open cards through their Blocked By links, each card weighing its days
from Start to Due (one when it has neither): the chain that sets when the last of the work can finish. Its boxes are
drawn strong and its arrows thick; done cards are drawn quiet. With no Blocked By links nothing is critical.

livediagram draws a node's box with the id `card:<lane>:<card>`, a lane with `lane:<lane>`, and each Blocked By arrow
`dep:<blocker>:<card>`, so a redraw changes only what moved and the editor can tell the plan's arrows and lanes from
ones a person drew (make-plan-cards.md "Changes to the plan").

## Who may

| Who                                           | Make Plan Cards             | View As Diagram                     | Apply a diagram's edit |
| --------------------------------------------- | --------------------------- | ----------------------------------- | ---------------------- |
| Editor of the plan (whole plan)               | Yes                         | Yes, with a connected tab           | Yes                    |
| Participant or Viewer of the plan, a tab link | No (the plan is not listed) | Yes, the diagram opens in a new tab | No (refused, 403)      |
| Reader of the diagram (any level)             | Yes, into a plan they edit  | n/a                                 | Needs Edit on the plan |
| Guest, API token, Offline, embed, Community   | No                          | No                                  | No                     |

A diagram drawn from a plan is the maker's own item: who else reads it is the diagram's own sharing, as for any file
someone makes from what they can read. Its live redraws stop the moment its maker can no longer read the plan.

## Limits

| Limit                       | Value | What it bounds                                                                          |
| --------------------------- | ----- | --------------------------------------------------------------------------------------- |
| `PLAN_MAKE_CARDS_MAX`       | 500   | Cards one Make Plan Cards makes or updates, and cards it trashes                        |
| `PLAN_MAKE_LINKS_MAX`       | 1,000 | Blocked By links in one make                                                            |
| `PLAN_VIEW_CARDS_MAX`       | 500   | Cards one diagram draws (livediagram's layout cap)                                      |
| `PLAN_VIEW_LINKS_MAX`       | 1,000 | Arrows one diagram draws                                                                |
| `PLAN_VIEWS_PER_PLAN_MAX`   | 10    | Live diagrams one plan keeps                                                            |
| `PLAN_VIEW_SETTLE_MS`       | 2,000 | How long the plan gathers changes before redrawing                                      |
| `PLAN_EDITS_MAX`            | 20    | Edits in one apply                                                                      |
| `PLAN_DIAGRAM_LABEL_MAX`    | 120   | Characters in a box's label or a lane's                                                 |
| `PLAN_SENDS_PER_SOURCE_MAX` | 1,000 | Sends one diagram holds (raised from 500 for Make Plan Cards)                           |
| `PLAN_SEND_READ_MAX`        | 500   | Sends a source's read answers (raised from 200, so every chip of a 500-card make shows) |
| Makes and views a person    | 10/m  | `KIT_RUN_LIMITER`, own keys                                                             |

## Telemetry

Under each app's name, through the workbench's `track`, in the UI category, never carrying a title, a card or a
shape's words:

- livediagram: `UI·Opened·MakePlanCards` (the preview opened), `UI·Created·MakePlanCards` (cards made or updated),
  `UI·Refused·MakePlanCards` (a make turned away), `UI·Opened·PlanChange` (a diagram's suggested change shown),
  `UI·Created·PlanChange` (applied), `UI·Closed·PlanChange` (dismissed), `UI·Refused·PlanChange` (refused by the
  plan).
- liveplanner: `UI·Opened·ViewAsDiagram`, `UI·Created·ViewAsDiagram`, `UI·Refused·ViewAsDiagram`.

Charted on the site's telemetry page beside Send to Plan: livediagram's Make Plan Cards stack and liveplanner's View
As Diagram stack (`apps/site/app/telemetry/_shared/diagrams-and-plans-metrics.ts`).
