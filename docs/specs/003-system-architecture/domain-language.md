# Domain language

## Mode, kind and template

Three words describe how a document and its tabs differ. They answer different questions and are never
interchangeable. These are design decisions, taken before any feature that uses them.

| Term         | Answers                        | Values                                                      | Where it lives                                |
| ------------ | ------------------------------ | ----------------------------------------------------------- | --------------------------------------------- |
| **mode**     | How is a tab worked on?        | Diagram, Draw, Workshop, Pages, Plan (`EditorMode`)         | Per tab, the same for everyone; `Tab.opensIn` |
| **kind**     | What is a tab?                 | the general diagram tab, or Event Storming (`TabKind`)      | `Tab.kind`                                    |
| **template** | What was a document made from? | a template (`TemplateKind`), grouped into template families | Captured once, at creation                    |

### Mode

- An **editor mode** is how a tab is worked on, by everyone on it: always **Plan**, the one mode (the Editor mode
  spec in 007-editor). Diagram, Draw, Workshop and Pages were retired.
- A mode is never a type of document or tab. A document's recorded creation intent still names the mode it was made
  in (**opens in**), which is Plan.
- Whiteboarding is Draw mode. There is no whiteboard tab kind and no whiteboard document type.
- Running a session (a retro, a town hall) is Workshop mode. A session is an activity, never a tab kind or a
  stored thing; "Session" and "Collaborate" never name the mode, and neither does its old name, "Facilitate".
- "Workshop" names the mode; a start's template group is never called Workshops (Workshop mode's is **Ideation**,
  Draw's **Exercises**). The template catalogue's **Workshops** category
  stays: it says what a template is for, as **Planning** does beside Plan mode, and most of its templates open in
  Workshop mode.

### Kind

- A **tab kind** is what a tab is. It is reserved for boards that do not follow the homogeneous environment of the
  general diagram tab, with their own notation, rules and data.
- The general diagram tab is the default kind. **Event Storming** is the only other kind among the canvas modes;
  Plan's tabs are kinds of their own ([Plan tabs](../026-plan/plan-tabs.md): Board, Sheet and Dashboard, and the Form
  tab of [Forms](../030-forms/forms.md)), each always in Plan.
- A new kind is added only when no mode can serve the use.
- "Board type" means a kind. It never names a template or a mode.

### Template

- A **template** is what a document was made from. It shapes the starting content of a general diagram tab and
  then has no further hold on it.
- Templates group into **template families** where a family is meaningful to people, for example Retrospectives
  (several retrospective formats) and Kanban boards.
- A template or a template family is never a kind or a type: a retrospective is a general diagram tab made from a
  retrospective template.

### Using the three together

- **Default folders** are keyed in the order kind, template family, then mode ([Default folders](../013-workspace/default-folders.md)).
- **Explorer filters** offer them as separate chips: Opens in (mode), Kind and Template ([Explorer filters](../013-workspace/explorer-filters.md)).
- Code, copy and specs use these words only in these meanings.

## Items

The words for the work a Plan board frames ([Items](../026-plan/items.md), [Plan board](../026-plan/plan-board.md)).

| Term           | Means                                                                   | Never called                |
| -------------- | ----------------------------------------------------------------------- | --------------------------- |
| **item**       | One record in a document's item store: a type and an open bag of fields | ticket, task, issue, card   |
| **item type**  | What an item is: Task, Story, Bug, Epic, Note, Idea, Action, Risk       | kind (that is a tab's)      |
| **item store** | Every item of one document, stored apart from its tabs                  | backlog, database           |
| **Plan board** | The element that draws items as columns of cards from a stored set-up   | Kanban element, board tab   |
| **card**       | How an item is drawn, on a Plan board or alone as a Plan card           | item (the data is the item) |

- **Plan** is an editor mode, never a kind: a Plan board is an element on a general tab.
- A **column** belongs to a Plan board and stands for a status; a **lane** is the Lane element.

## Diagram elements

The words for the diagram-building elements ([The card](../009-elements/card.md), [The badge](../009-elements/badge.md),
[The step number](../009-elements/step-number.md), [The boundary](../009-elements/boundary.md),
[Concept graphics](../009-elements/concept-graphics.md)).

| Term                | Means                                                                                   | Never called                              |
| ------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------- |
| **Card**            | The diagram element (`card`) with a header band, media, title, meta line, body and tags | node card, info card, Plan card           |
| **slot**            | One part of a Card a person switches on or off                                          | section, field (in copy)                  |
| **Badge**           | The small pill element (`badge`)                                                        | tag (a tag is a chip inside a Card), pill |
| **Step number**     | The numbered disc element (`step`)                                                      | marker (that is a shape's status mark)    |
| **attachment**      | A badge or step number held on one of eight points of a host element                    | group, pin, dock                          |
| **host**            | The element an attached badge or step number sits on                                    | parent (that is a mind node's)            |
| **Boundary**        | The titled, tinted container element (`boundary`)                                       | zone, group, frame (that is the Frame)    |
| **concept graphic** | A Layer stack, Pyramid or Cycle: one element laying out its own rows                    | SmartArt, diagram                         |
| **row**             | One layer, tier or step of a concept graphic (`conceptRows`)                            | item (that is a Plan record)              |

- A Plan **card** draws an item and is always called a Plan card where the two could meet; the diagram **Card** is
  never offered in Plan mode.

## Agents

The words for a program working on documents for a person ([Agents](../024-agents/README.md)).

| Term               | Means                                                                                                   | Never called                            |
| ------------------ | ------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| **agent**          | A program acting as a person through their API token: an MCP client, a CLI caller, a script             | bot, AI user, assistant                 |
| **changeset**      | One agent write to one tab: atomic, sequenced by the room, attributed, revertable                       | batch, commit, patch                    |
| **edit operation** | One step in a changeset (`set`, `add`, `connect`, ...), compiled into element ops                       | op (that is a room op), action, command |
| **view**           | A read-only text projection of a tab (outline, graph, layout, ...)                                      | mode, format                            |
| **ref**            | The short name a view prints for an element: its id, or its shortest unique id prefix                   | handle (that is a mention), alias       |
| **selector**       | An expression matching one or more elements (a ref, `type:sticky`, `in:f1`)                             | query, filter (that is the Explorer's)  |
| **lint finding**   | One problem the diagram lint reports (`box-overlap`), with the refs involved                            | warning, issue                          |
| **access level**   | What a share link, embed or token admits: Viewer, Participant or Editor (`view`, `participate`, `edit`) | permission, scope (the field is `role`) |
| **ownership**      | The owner's powers over a document (sharing, delete, move), apart from any level                        | admin, edit level                       |

- **Participant** is the access level; a person's name, colour and picture (the `participants` table) are their
  **display identity**.
- An **element op** (`ElementOp`) stays the room's unit; an edit operation is the agent's, and compiles into them.
- A CLI **command** and an MCP **tool** are the two front doors to one **verb** (`tab.view`, `element.set`).

## Colours

The words for choosing a colour ([Colour picker](../004-interface-design/colour-picker.md)).

| Term                     | Means                                                                                             | Never called                          |
| ------------------------ | ------------------------------------------------------------------------------------------------- | ------------------------------------- |
| **colour picker**        | The one control that chooses a colour, in any skin                                                | swatch picker, palette, colour well   |
| **standard colours**     | The ten named colours every picker offers (Ink or White, Grey, Red ... Pink)                      | stock colours (outside Draw), presets |
| **tone**                 | Which version of the standard colours a picker offers: `strong` (lines, text) or `soft` (fills)   | shade, variant, a drawing finish      |
| **theme colours**        | The active theme's own colours, offered on the canvas only                                        | presets                               |
| **Custom colours**       | The colours picked with + in the document, kept with its tabs                                     | custom swatches, recent colours       |
| **custom colour editor** | The square, hue, hex and eyedropper panel that **Add a custom colour** (four coloured dots) opens | colour wheel, native picker           |
| **skin**                 | Where and how a picker opens: inline, field, swatch button                                        | variant, mode                         |

## Drawing

The words for how elements are drawn, apart from their colours ([Finish](../008-canvas/finish.md)).

| Term           | Means                                                                                           | Never called                   |
| -------------- | ----------------------------------------------------------------------------------------------- | ------------------------------ |
| **finish**     | The drawing style of a tab and its elements: Flexible (default), Professional, Sketch or Marker | tone, look, style, render mode |
| **Follow Tab** | An element with no finish of its own, drawn in its tab's                                        | inherit, default               |

## Flowcharts

The words for a grown flowchart ([The flowchart](../009-elements/flowchart.md)).

| Term          | Means                                                                     | Never called        |
| ------------- | ------------------------------------------------------------------------- | ------------------- |
| **flowchart** | Steps sharing a `flowchartId`, joined by connectors and laid out together | flow, diagram       |
| **step**      | One shape of a flowchart                                                  | node, box           |
| **step type** | What a step is (Process, Decision, ...), which is its shape kind          | node type, symbol   |
| **lane**      | A swimlane of a flowchart: a Lane element carrying the chart's id         | swimlane (in code)  |
| **direction** | Which way a flowchart flows: Down or Right                                | orientation, layout |

## Workbenches

The words for the editor framed beside code ([Workbench embeds](../013-workspace/workbench-embeds.md)).

| Term                    | Means                                                                                 | Never called                           |
| ----------------------- | ------------------------------------------------------------------------------------- | -------------------------------------- |
| **workbench**           | A developer tool that frames the editor beside an agent (an agent workbench, VS Code) | host (that is a profile's server), IDE |
| **selection reference** | The text naming what was selected, attached to a person's message to their agent      | context, selection payload             |

## Animation

- An **animation set** is the catalogue of animations one family of elements takes: Shape, Sticky, Drawing,
  Media, Table, and Text for words ([Element animations](../028-animation/element-animations.md)). Icons, charts
  and arrows keep sets of their own.
- An element's **body set** animates the element; the **Text set** animates its words. A set is never a kind or a
  mode.
- A **reveal** brings an element or its words in; a **loop** repeats around the rest frame.

## This Browser

**This Browser** is the one name for a document saved only in this browser ([Offline Mode](../006-document/offline-mode.md)):
the place it lives (the Explorer's This Browser section, beside My Documents and the teams), the pill and badge that
mark it, and where a new guest's documents start. A document is **in This Browser**; it is never "Local Only",
"Local Browser" or "offline" in copy. "Offline Mode" stays the name of the feature, and code may say `offline`.

## Names in a sentence

Copy that builds a phrase around a name (a page kind, a field, a note, a template, a chart type, an element type in
an agent's error) takes its article from the name: `withArticle` / `indefiniteArticle` in `@liveplanner/items`
(re-exported by `@liveplanner/document` and `@liveplanner/ui`). A vowel sound takes "an" ("Add an infographic
page", "Create an Org Chart", "is not an Estimate option"), and a vowel said "you" keeps "a" ("a User Persona", "a
UML Class"). A fixed "a" before an interpolated name is how "Create a Org Chart" reached the marketing site.
