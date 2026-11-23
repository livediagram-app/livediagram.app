# Diagrams and Plans: blueprint

Derived from [diagrams-and-plans.md](../diagrams-and-plans.md). The spec decides; this file adds engineering precision.
Nothing here is a new Worker, queue, binding or D1 table: Make Plan Cards records Send to Plan's own `plan_sends` rows,
and a plan's live views are kept in the plan room's own SQLite (`plan_views`), so the index gains no migration.

## Flow

```
Make Plan Cards
livediagram editor ── POST /api/index/items/:plan/plan-makes {board, column, source, cards[], trash[]} ─▶ index
   account in person; limiter plan-make:<person>; plan loadItem(edit, whole); diagram loadItem(view)
   existing live sends (plan, source, refs) → card ids to update; trash ⊆ this source's live sends in this plan
   mintGrant(person, plan, edit) ─▶ liveplanner POST /api/internal/items/:plan/plan-diagram {op: 'make', …}
        grantWrites; Blocked By field added to the type when missing; one insert of the new cards, guarded updates
        of the old, trash moves; loops left out (blockingCycleOf); relay + history as the person
   ◀─ {cards: [{element, id, title, column, done, made}], skipped}
   index inserts plan_sends rows for the made cards → 201 {sends, made, updated, trashed, skipped}

View As Diagram
liveplanner editor ── POST /api/index/items/:plan/plan-views {board, filter?, name} ─▶ index
   account in person; limiter plan-view:<person>; plan loadItem(view)
   mintGrant(person, plan, level) ─▶ liveplanner plan-diagram {op: 'graph'} → PlanDiagramGraph
   ─▶ livediagram POST /api/internal/items/plan-diagram {owner, name, graph, caption, link} → {id, tabId}
   ─▶ liveplanner plan-diagram {op: 'watch', diagramId, tabId, board, filter} (the room's plan_views)
   → 201 {diagram: {id, title, tabId, link}, cards, links, critical}
liveplanner editor ── connectFile(plan → diagram, Editor, one way) when the session may change tabs

Live
plan room: an `items` or `item-types` op while plan_views holds a row ── PLAN_VIEW_SETTLE_MS ─▶ each view's graph,
   hashed; changed ones ─▶ POST /app/items/:plan/plan-diagrams {views: [{diagramId, tabId, person, graph}]}
   index: per view, the maker reads the plan and edits the diagram (neither trashed) ─▶ livediagram plan-diagram
   {owner: maker, itemId, tabId, graph} (a `replace` changeset) ─▶ {views: [{diagramId, status: ok|gone|failed}]}
   room deletes the `gone` rows

Changes from the diagram
livediagram editor ── POST /api/index/items/:plan/plan-edits {edits} ─▶ index (edit, whole plan)
   ─▶ liveplanner plan-diagram {op: 'edit', edits} → {results: [{status: applied|refused, reason?}]}
```

## Wire (`@liveworkspace/index-client`, src/plan-diagrams.ts)

| Shape                | Fields                                                                                                     |
| -------------------- | ---------------------------------------------------------------------------------------------------------- |
| `PlanMakeCard`       | `element`, `title`, `text`, `column?`, `labels?`, `start?`, `due?`, `blockedBy?` (elements)                 |
| `PlanMakeAsk`        | `board`, `column`, `source: {itemId, tabId, label}`, `cards` (1 to 500), `trash?` (card ids, up to 500)      |
| `PlanMakeAnswer`     | `sends: PlanSend[]`, `made`, `updated`, `trashed`, `skipped`                                                |
| `PlanDiagramGraph`   | `lanes: {id, label}[]`, `nodes: {card, label, lane, done, critical, link}[]`, `edges: {from, to, critical}[]`, `total` |
| `PlanViewAsk`        | `board`, `filter?` (`BoardFilterValue`, liveplanner's), `name`                                              |
| `PlanViewAnswer`     | `diagram: {id, title, tabId, link}`, `cards`, `links`, `critical`                                               |
| `PlanEdit`           | `{kind: 'block', card, blocker}` or `{kind: 'move', card, column}`                                          |
| `PlanEditResult`     | `{status: 'applied'}` or `{status: 'refused', reason}`                                                      |
| `PlanDiagramDoorCall`| `op: 'make' \| 'graph' \| 'watch' \| 'edit'`, `person`, and each op's fields                                |
| `PlanDiagramDraw`    | livediagram's door: `owner`, `name`, `graph`, `caption`, `link`, `itemId?`, `tabId?`                         |

Every reader is a hand-written walk with caps (no schema library), shared by the index and both doors.

## The index (`liveworkspace/apps/index/src/plan-diagrams.ts`)

- `handlePlanMakes(ctx, planId)`, `handlePlanViews(ctx, planId)`, `handlePlanEdits(ctx, planId)` on `/items/:id/…`;
  `handlePlanDiagrams(request, env, app, planId)` on `/app/items/:id/plan-diagrams` (liveplanner's key alone).
- The send rows are written with `plan-sends.ts`' own insert (`insertSendRows`), the link with `placeLink`.

## liveplanner

- `apps/api/src/plan-room/plan-diagram-door.ts`: the four ops; `plan-views.ts`: the `PlanViews` watcher (the room's
  `plan_views` table, the settle timer, the graph hash), fed by `broadcastOrderedSystemOp` as `SentCards` is.
- `packages/items/src/plan-diagram-graph.ts`: the graph (lanes, nodes, edges, the critical path), pure.
- `packages/items/src/plan-make.ts`: the make's pure plan (new and updated items, the Blocked By field, loops left out).
- The editor: `components/plan-diagram/` (the entry, the dialog, the preview counts).
- `sent-cards.ts` tells the index in chunks of `PLAN_CARDS_CHANGED_MAX`, so a 500-card burst loses none.

## livediagram

- `apps/api/src/routes/internal-plan-diagram.ts` + `document-room/plan-diagram-tab.ts`: the door, the graph compiled
  by `applyReplace` (`style: 'lanes'`, `direction: 'right'`), the ids rewritten (`card:`, `lane:`, `dep:`), then a new
  canvas through the import door's path or a `replace` changeset as `owner`.
- The editor: `lib/plan-cards/` (shapes, arrows, lanes and dates read into `PlanMakeCard`s; the offers a plan-drawn tab
  makes), `components/plan-cards/` (the entries, the dialog host, the changes pill). The dialog is the workbench's
  (`packages/workbench/src/components/plan-cards/MakePlanCardsDialog.tsx`), drawn from the rows the app reads.

## Performance

Measured in each package's perf test (500 cards, 1,000 links): the shape reading, the make's plan with the loop checks,
the graph and its critical path, and livediagram's lanes layout. The redraw is bounded by the settle window (one draw a
view per `PLAN_VIEW_SETTLE_MS`), skipped when the graph's hash is unchanged, and by `PLAN_VIEWS_PER_PLAN_MAX`.

## Tests

- index-client: every reader's caps and wrong types.
- index: make (edit needed, view on the source, updates matched by ref, trash limited to this source's sends, limiter),
  views (view enough, graph → draw → watch, livediagram down), app redraws (maker lost access → gone), edits (edit needed).
- liveplanner: the graph and critical path, the make's plan (types gain Blocked By, loops skipped, columns, labels,
  dates), the door's grant checks per op, the watcher's settle and hash, sent-cards chunking.
- livediagram: the shape reader (arrows, lanes, dates, timeline axis), the offers, the door's ids and links, the
  dialog's rows, ticks and summary, roles (who sees the entries and the pill).
