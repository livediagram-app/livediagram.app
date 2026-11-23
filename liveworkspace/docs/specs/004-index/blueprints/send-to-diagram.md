# Send to Diagram: blueprint

Derived from [send-to-diagram.md](../send-to-diagram.md). The spec decides; this file adds engineering precision.
Nothing here is a new Worker, queue or binding: the source app drafts on the AI it already has, the index calls
livediagram's internal door with the app's key, and a person's writes count on `KIT_RUN_LIMITER` under a key of their
own. The index gains one D1 migration (`0031_diagram_sends.sql`).

## Flow

```
source app's editor ── POST <app api>/…/describe-diagram {words, kind} ─▶ {graph, provider}   (the app's own AI)
         │ the picker shows the sketch (graph-sketch.ts); Make / Add Tab / Update Tab
         ▼
POST /api/index/diagram-sends/diagrams {name, graph, source, target?} ─▶ index (person)
         │ account in person? limiter `diagram-send:<person>`; source: loadItem(view)
         │ target: loadItem(edit, whole item, livediagram, not trashed or archived)
         ▼
livediagram ◀── POST /api/internal/items/from-graph {owner, name, graph, caption, link, itemId?, tabId?} (index key)
         compile: applyReplace(null, {graph}) → caption linked → elements
         no itemId: a .livediagram file through the import door's path (a new document)
         itemId:    submitChangeset(replace {elements}) as owner on tabId (or a fresh one)
         │ 201 {id, tabId}
         ▼
index: the item row checked (livediagram, and for a new one the person's own); one diagram_sends row
       (the same place, diagram and tab replaced) → 201 {item, link, send}

source opens: GET /api/index/items/:source/diagram-sends → {sends} whose diagram the reader can open
```

## Wire (`@liveworkspace/index-client`, src/diagram-sends.ts)

| Shape                   | Fields                                                                                                |
| ----------------------- | ----------------------------------------------------------------------------------------------------- |
| `DiagramSendKind`       | `auto`, `flowchart`, `sequence`, `mindmap`, `orgchart`, `architecture`, `timeline`                    |
| `DiagramSendGraph`      | `title?`, `style?` (`flow`, `tree`, `mindmap`, `sequence`), `direction?`, `nodes`, `edges`, `groups?` |
| `DiagramSendSource`     | `app`, `itemId`, `tabId`, `elementId`, `label`                                                        |
| `DiagramSendTarget`     | `itemId` (a diagram), `tabId?` (the tab to redraw; absent: a new tab)                                 |
| `DiagramSendAsk`        | `name`, `graph`, `source`, `target?`                                                                  |
| `DiagramSend`           | `id`, `ref` (`tab:element`), `diagram: {id, title}`, `tabId`, `link` (the diagram on its tab), `at`   |
| `DiagramSendAnswer`     | `{item, link, send}`                                                                                  |
| `DiagramSendsRead`      | `{sends: DiagramSend[]}`, newest first, only those whose diagram the reader can open                  |
| `DiagramFromGraphInput` | `owner`, `name`, `graph`, `caption`, `link`, `itemId?`, `tabId?`                                      |

- `readDiagramSendGraph` keeps one edge a pair except on a `sequence` graph, whose messages may repeat, and drops a
  sequence's groups. `readDiagramSendAsk` and `readDiagramFromGraphInput` read `target`, `itemId`, `tabId` as ids
  (at most 200 characters).
- `diagramSendRef(tabId, elementId)` is `tab:element`, each empty when null.
- `IndexClient.sendToDiagram(ask)`, `IndexClient.diagramSends(sourceId, {share?, signal?})`.

## The index (liveworkspace/apps/index)

```
migrations/0031_diagram_sends.sql   the table below
src/diagram-sends.ts                POST /diagram-sends/diagrams, GET /items/:id/diagram-sends
src/index.ts                        routes both
```

`diagram_sends`: `id` (`ds_` + 20 hex), `source_id` → items ON DELETE CASCADE, `ref`, `diagram_id` → items ON DELETE
CASCADE, `diagram_tab_id`, `at`. Indexes `(source_id, at DESC)` and `(diagram_id)`. No person, no words.

- **Write**: `DELETE … WHERE source_id, ref, diagram_id, diagram_tab_id` then `INSERT`, in one batch, so a place keeps
  one row a tab and an update moves it to the top.
- **Read**: the newest `DIAGRAM_SEND_READ_MAX` rows of the source; each distinct diagram (at most
  `DIAGRAM_SEND_DIAGRAMS_CHECKED_MAX`, newest first) loaded on the reader's own access (no share code carries over),
  kept when open and neither trashed nor archived, with its current title.
- **Refusals**: 401/403 as Send to Plan's sender; 404 for a source or target the person cannot reach; 400 for a target
  that is not livediagram; 422 `invalid_graph`; 404 `diagram_gone` when the door finds no document; 503 otherwise.

## livediagram (livediagram/apps/api)

`routes/internal-graph.ts`: `graphElements(input)` compiles and links the caption; `documentFromGraph` writes a new
document as before; `graphIntoDocument(env, input)` reads the document (`getDocument`), the author (`getParticipant`
of the owner) and submits `{kind: 'replace', replace: {elements}, name}` on `tabId ?? crypto.randomUUID()` with
`frontDoor` `Api` and no token, answering `{status: 'ok', id, tabId}`, `not_found`, or `invalid_graph` for an engine
refusal. `@liveworkspace/index-app`'s `graphDoor` answers `{id, tabId}` and 404 for `not_found`.

## The editors (packages/workbench src/components/send-to-diagram)

| File                      | What                                                                                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `diagram-send-store.ts`   | The open item's diagram sends: read on open and after a send, by element, live                                                                   |
| `diagram-chip-dom.ts`     | A sent block's chip in an article (drawn by `article-sent.ts` beside Send to Plan's)                                                             |
| `graph-sketch.ts`         | The preview's layout: layered (longest path) for flow and tree, rings for a mind map, lifelines for a sequence; pure, linear in boxes and arrows |
| `DiagramSketch.tsx`       | The sketch as SVG                                                                                                                                |
| `DiagramWhere.tsx`        | Where: New Diagram, New Tab (the person's diagrams at Editor, recent, searched), Update                                                          |
| `diagram-kinds.ts`        | The seven kind cards                                                                                                                             |
| `SendToDiagramDialog.tsx` | The picker; loaded on first open (`SendToPlanHost` lazy import)                                                                                  |

The host names the diagram store's source only when the app gave a drafter, so an app without Send to Diagram makes no
read. Send to Plan's canvas indicator (`SENT_CARD_GLYPHS.card`) is liveplanner's logo.

## Tests

- index-client: the graph reader (sequence repeats, caps), the ask's target, the door body.
- index: a send to a new diagram, a new tab and an update (edit refused for a viewer, a trashed or non-livediagram
  target), the row written and replaced, the read filtered by the reader's access.
- index-app: the door's `{id, tabId}` and 404.
- livediagram api: a new tab and a redraw written as a changeset, `not_found`, an engine refusal.
- workbench: the picker's preview before writing, Where (update offered for a sent block), the sketch's layout, the
  store and the chip.
- liveknowledge: the sequence kind's layout wins; role gating, key choice and caps (already in the route tests).
