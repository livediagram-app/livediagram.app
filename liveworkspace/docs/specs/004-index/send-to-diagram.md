# Send to Diagram

**Send to Diagram** turns words written in one app into a livediagram diagram drawn from them (Work Tracker 1393;
owner, 2026-11-23: "an option to Send to Diagram which uses AI to analyse the selected text and build a diagram based
on it using the built in AI, or the users AI token if that is configured as the primary"). A process, a system or a
team written as prose in a knowledgebase page becomes a picture of it in one step, rather than being redrawn by hand.

It sits beside [Send to Plan](send-to-plan.md) wherever an app offers that for words, and shares its look: Send to
Plan wears liveplanner's logo and Send to Diagram livediagram's (owner, 2026-11-23). What each app sends, and where its
entry sits, is that app's spec (`<app>/docs/specs/013-workspace/send-to-diagram.md`).

## How it works

1. **The words.** The person picks words (or leaves the caret in a block, which sends the block), and presses **Send to
   Diagram**. The picker opens on them.
2. **The draft.** The source app's api asks a model to read the words as a diagram and answers a **graph**: boxes,
   arrows between them and, where the words name parts of a whole, groups (`DiagramSendGraph`). The model is the
   source app's own choice, as its other AI features make it (for liveknowledge: the knowledgebase's key, its team's,
   the person's own, else built-in AI). The words go to that model alone; nothing is drawn yet.
3. **The preview.** The picker shows the graph as a sketch (its boxes and arrows, laid out roughly) with how many boxes
   and arrows it holds, so the person sees what the AI read before anything is written. They may write it, draw it
   again, or change the kind and draw again.
4. **The diagram.** The editor hands the graph to the index (`POST /diagram-sends/diagrams`), which checks the person
   may read the source and, for an existing diagram, edit it, and asks livediagram's door
   (`POST /api/internal/items/from-graph`) to write it where the person chose:
   - **New diagram**: a new diagram of the person's own, at the top of their library, named as they chose.
   - **New tab**: a new tab, named as they chose, at the end of a diagram they may edit.
   - **Update**: the tab an earlier send from the same place drew, redrawn whole (its name kept).

   livediagram compiles the graph exactly as its MCP's graph input does (shapes, pinned arrows, frames for groups,
   then its own auto layout), so the layout is livediagram's, never the model's. A new tab and an update are written as
   an agent's changeset is, as the person: open editors see them arrive, and the diagram's history and undo hold them.

5. **Open it.** The diagram opens in livediagram on its tab in a new browser tab, and a toast says "Diagram made" (or
   "Tab added", "Tab updated") with **Open Diagram**, for a browser that held the tab back.

The diagram is a copy, never linked live: editing the words later does not change it, until the person updates it from
the picker. Its tab carries a caption under the title naming where it came from ("From <source title>, <place>") and
the caption links back to the exact place (`#t=<tab>&el=<element>`, as Send to Plan's line back).

## Who may send

- **A signed-in account**, in person: never an API token, an agent, a guest, a workbench frame or a Community visitor.
- **Read on the source**: a Viewer may draw a diagram of what they read. The index checks the person's own access to the
  source on every send, as Send to Plan does.
- **Edit on the diagram**, for a new tab or an update: the person's own Editor access to the whole diagram (never
  through a share link), checked by the index on every write; a diagram in the Trash or archived is refused.
- A new diagram is the person's own personal item: nobody else gains anything, and the source is never changed.

## The picker

A centred dialog (a bottom sheet on a phone), with the shared illustrated header (livediagram's logo art):

- **The words**, quoted, at most four lines with a fade (the full words are sent).
- **Where**, as cards: **New Diagram** (chosen), **New Tab** in a diagram, and, when the place was sent before and the
  person can open that diagram, **Update** with its name (then chosen first). New Tab lists the person's diagrams they
  may edit, most recent first, with a search; a diagram they can only view is not listed.
- **Kind**: **Auto** (chosen), **Flowchart**, **Sequence**, **Mind Map**, **Org Chart**, **Architecture**,
  **Timeline**, as cards. Auto lets the model choose; the others tell it what to draw and set the layout (flow down;
  lifelines and messages in order; mind map; tree; flow across with groups; flow across).
- **Name**: the diagram's name for a new diagram, the tab's for a new tab, the place's by default ("<page title>
  diagram"), editable. An update keeps the tab's name, so it has none.
- **Preview** drafts the graph ("Reading the words") and shows the sketch with its counts. Changing the words' kind
  drops the sketch, so the button reads Preview again; **Draw Again** asks for another draft of the same kind.
- **Make Diagram** (**Add Tab**, **Update Tab**) writes the previewed graph ("Drawing"). A failure says why in the
  dialog, in fixed words, and the person may try again. Escape or Cancel closes; nothing is written until the index
  answers.

## The graph

`DiagramSendGraph` (`@liveworkspace/index-client` `diagram-sends.ts`), checked by the index before it calls livediagram,
and by livediagram again:

- `nodes`: `{id, label, shape?, note?, role?, group?}`. `shape` is one of `square`, `circle`, `diamond`, `cylinder`,
  `parallelogram`, `hexagon`, `document`; `role` makes an org chart's person card.
- `edges`: `{from, to, label?, line?}`, `line` `solid` or `dashed`. An edge naming no node is dropped.
- `groups`: `{id, label}`, a node joining one by its `group`.
- `style`: `flow`, `tree`, `mindmap` or `sequence`; `direction`: `down` or `right`; `title`. A `sequence` graph's
  nodes are its participants and its edges its messages, in order, so the same pair may repeat (other styles keep one
  arrow a pair); a dashed edge is a reply, and groups are left out.

## Limits

| Limit                     | Value   | What it bounds                                   |
| ------------------------- | ------- | ------------------------------------------------ |
| `DIAGRAM_SEND_WORDS_MAX`  | 8,000   | Characters of words one send reads               |
| `DIAGRAM_SEND_NODES_MAX`  | 60      | Boxes in one graph                               |
| `DIAGRAM_SEND_EDGES_MAX`  | 120     | Arrows in one graph                              |
| `DIAGRAM_SEND_GROUPS_MAX` | 12      | Groups in one graph                              |
| `DIAGRAM_SEND_LABEL_MAX`  | 120     | Characters in a label, a name or a group's label |
| `DIAGRAM_SEND_NOTE_MAX`   | 400     | Characters in a box's note                       |
| Diagrams a person         | 10/m    | The kit run limiter (`KIT_RUN_LIMITER`), own key |
| Sends read for a place    | 200     | A source's newest sends, for its chips           |
| Diagrams checked a read   | 20      | Distinct diagrams a chip read checks access on   |
| Drafts                    | the app | The source app's own AI caps (its spec)          |

## The chip

Each place sent shows a small chip after its words: livediagram's logo and the diagram's name, "+N" when several
diagrams came from it. Hover it for where it opens; a press opens the newest diagram, on the tab drawn, in livediagram
in a new browser tab. Beside Send to Plan's chip when the place has both.

- **Only for those who may see the diagram.** `GET /items/:id/diagram-sends` answers the source's sends whose diagram
  the reader can open with their own access, not in the Trash or archived: most often, only the person who sent. A
  diagram's name never reaches anyone who could not open it.
- **Read when the source opens**, and again after a send from it. Never polled: a diagram renamed elsewhere shows its
  new name on the next open. The chip is drawn beside the place; it is not part of the source and never in an export.
- The rows cascade from the source and the diagram, so purging either takes them, and they hold no person.

## Sending again

A place with a chip opens the picker on **Update**, the newest diagram's tab the person may open: Update Tab redraws that
tab from the words as they read now. **New Diagram** and **New Tab** stay one press away, so an earlier diagram is
never overwritten unless the person means it.

## Telemetry

Under the source app's name, through the workbench's `track`, typed by the feature and never by words:
`UI·Opened·SendToDiagram` (the picker opened), `UI·Created·SendToDiagram` (a diagram made, a tab added or one updated),
`UI·Refused·SendToDiagram` (a draft or a make turned away), `UI·Used·SendToDiagram` (a draft shown),
`UI·Opened·SentDiagram` (a chip pressed).
