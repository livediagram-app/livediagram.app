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
3. **The diagram.** The editor hands the graph to the index (`POST /diagram-sends/diagrams`), which checks the person
   may read the source and asks livediagram's door (`POST /api/internal/items/from-graph`) to make a new diagram of the
   person's own, at the top of their library, named as they chose. livediagram compiles the graph exactly as its MCP's
   graph input does (shapes, pinned arrows, frames for groups, then its own auto layout), so the layout is
   livediagram's, never the model's.
4. **Open it.** The new diagram opens in livediagram in a new browser tab, and a toast says "Diagram made" with
   **Open Diagram**, for a browser that held the tab back.

The diagram is a copy, never linked live: editing the words later does not change it. Its first tab carries a caption
under the title naming where it came from ("From <source title>, <place>") and the caption links back to the exact
place (`#t=<tab>&el=<element>`, as Send to Plan's line back).

## Who may send

- **A signed-in account**, in person: never an API token, an agent, a guest, a workbench frame or a Community visitor.
- **Read on the source**: a Viewer may draw a diagram of what they read. The index checks the person's own access to the
  source on every send, as Send to Plan does.
- The new diagram is the person's own personal item: nobody else gains anything, and the source is never changed.

## The picker

A centred dialog (a bottom sheet on a phone), with the shared illustrated header (livediagram's logo art):

- **The words**, quoted, at most four lines with a fade (the full words are sent).
- **Kind**: **Auto** (chosen), **Flowchart**, **Mind Map**, **Org Chart**, **Architecture**, **Timeline**, as chips.
  Auto lets the model choose; the others tell it what to draw and set the layout (flow down; mind map; tree; flow
  across with groups; flow across).
- **Name**: the diagram's name, the source's place by default ("<page title> diagram"), editable.
- **Make Diagram** drafts and makes it, the button showing progress ("Reading the words", then "Drawing"); a failure
  says why in the dialog, in fixed words, and the person may try again. Escape or Cancel closes; nothing is made until
  the index answers.

## The graph

`DiagramSendGraph` (`@liveworkspace/index-client` `diagram-sends.ts`), checked by the index before it calls livediagram,
and by livediagram again:

- `nodes`: `{id, label, shape?, note?, role?, group?}`. `shape` is one of `square`, `circle`, `diamond`, `cylinder`,
  `parallelogram`, `hexagon`, `document`; `role` makes an org chart's person card.
- `edges`: `{from, to, label?, line?}`, `line` `solid` or `dashed`. An edge naming no node is dropped.
- `groups`: `{id, label}`, a node joining one by its `group`.
- `style`: `flow`, `tree` or `mindmap`; `direction`: `down` or `right`; `title`.

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
| Drafts                    | the app | The source app's own AI caps (its spec)          |

## Not yet

A sent place shows no chip, and sending the same words again makes a second diagram: diagrams have no status to show,
so the chip waits until people ask for it. A diagram drawn into a new tab of an existing diagram is the next step.

## Telemetry

Under the source app's name, through the workbench's `track`, typed by the feature and never by words:
`UI·Opened·SendToDiagram` (the picker opened), `UI·Created·SendToDiagram` (a diagram made, with the kind),
`UI·Refused·SendToDiagram` (a draft or a make turned away).
