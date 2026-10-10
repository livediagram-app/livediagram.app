# Domain language

## Mode, kind and template

Three words describe how a document and its tabs differ. They answer different questions and are never
interchangeable. These are design decisions, taken before any feature that uses them.

| Term         | Answers                        | Values                                                      | Where it lives                                |
| ------------ | ------------------------------ | ----------------------------------------------------------- | --------------------------------------------- |
| **mode**     | How is a tab worked on?        | Diagram, Draw, Illustrate, Plan, Facilitate (`EditorMode`)  | Per tab, the same for everyone; `Tab.opensIn` |
| **kind**     | What is a tab?                 | the general diagram tab, or Event Storming (`TabKind`)      | `Tab.kind`                                    |
| **template** | What was a document made from? | a template (`TemplateKind`), grouped into template families | Captured once, at creation                    |

### Mode

- An **editor mode** is how a general tab is worked on right now, by everyone on it: Diagram, Draw, Illustrate, Plan or Facilitate.
  (the Editor modes spec in 007-editor).
- A mode is never a type of document or tab. Switching mode changes no content: it sets the tab's mode (one undo step) and everyone on the tab follows.
- A tab stores the mode it **opens in**. "Opens in" is a choice among modes, not a binary, so a new mode needs no
  new concept.
- Whiteboarding is Draw mode. There is no whiteboard tab kind and no whiteboard document type.
- Running a session (a retro, a town hall) is Facilitate mode. A session is an activity, never a tab kind or a
  stored thing; "Session" and "Collaborate" never name the mode.

### Kind

- A **tab kind** is what a tab is. It is reserved for boards that do not follow the homogeneous environment of the
  general diagram tab, with their own notation, rules and data.
- The general diagram tab is the default kind. **Event Storming** is the only other kind.
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
| **tone**                 | Which version of the standard colours a picker offers: `strong` (lines, text) or `soft` (fills)   | shade, variant                        |
| **theme colours**        | The active theme's own colours, offered on the canvas only                                        | presets                               |
| **Custom colours**       | The colours picked with + in the document, kept with its tabs                                     | custom swatches, recent colours       |
| **custom colour editor** | The square, hue, hex and eyedropper panel that **Add a custom colour** (four coloured dots) opens | colour wheel, native picker           |
| **skin**                 | Where and how a picker opens: inline, field, swatch button                                        | variant, mode                         |

## Repositories and workbenches

The words for diagrams living beside code ([Repositories](../027-repositories/README.md),
[Workbench embeds](../013-workspace/workbench-embeds.md)).

| Term                    | Means                                                                                 | Never called                           |
| ----------------------- | ------------------------------------------------------------------------------------- | -------------------------------------- |
| **repository link**     | `livediagram.toml`: binds a directory to the documents it **covers**                  | project, workspace, scope              |
| **mirror level**        | How much of the covered documents a link writes: `none`, `index`, `files`             | sync mode                              |
| **snapshot**            | A tab as a repository holds it, at a recorded revision                                | copy (that is Drive's), backup, cache  |
| **sync**                | One pass of a link: read, merge, send, write                                          | refresh, update                        |
| **base**                | The snapshot a local change was made from; the merge's common ancestor                | original, previous                     |
| **lost local value**    | A field both sides changed, kept in the report and as a comment, never applied        | conflict (that is a changeset's 409)   |
| **source**              | A diagram as text in a repository (a Mermaid file or fence), bound to a tab           | diagram file, code diagram             |
| **bridge**              | One format's parser and serialiser, with the capabilities it expresses                | adapter, converter                     |
| **compatibility**       | Whether a bound tab may hold residue: `relaxed` (default) or `strict`                 | mode (that is the editor's)            |
| **residue**             | What a bound tab holds that its source's format cannot express                        | extras, unsupported                    |
| **workbench**           | A developer tool that frames the editor beside an agent (an agent workbench, VS Code) | host (that is a profile's server), IDE |
| **selection reference** | The text naming what was selected, attached to a person's message to their agent      | context, selection payload             |

## Community

The words for the public gallery of published documents ([Community](../025-community/community.md)).

| Term               | Means                                                                                       | Never called                          |
| ------------------ | ------------------------------------------------------------------------------------------- | ------------------------------------- |
| **Community**      | The public gallery of published documents; the app at `/community`                          | Gallery, Showcase or Feed as its name |
| **post**           | One document published to Community (`CommunityPost`); a document has at most one           | listing (in code), entry, submission  |
| **author**         | The signed-in owner who published a post, shown by their display identity                   | creator, poster, publisher            |
| **category**       | The one coarse subject of a post, from a closed set (`architecture`, `flows`, ...)          | type, kind (that is a tab's), section |
| **tag**            | A normalised free-form word on a post, up to five                                           | label, keyword, topic                 |
| **community link** | The view-role share link a post owns: never listed, never expires, no room, no comments     | public link, gallery link             |
| **community key**  | The random per-browser key the Community app sends for likes and reports; never an owner id | voter id, device id                   |

- **Edit Listing** names the act of changing a post's details in copy; the thing is still a post.

## Animation

- An **animation set** is the catalogue of animations one family of elements takes: Shape, Sticky, Drawing,
  Media, Table, and Text for words ([Element animations](../028-animation/element-animations.md)). Icons, charts
  and arrows keep sets of their own.
- An element's **body set** animates the element; the **Text set** animates its words. A set is never a kind or a
  mode.
- A **reveal** brings an element or its words in; a **loop** repeats around the rest frame.
