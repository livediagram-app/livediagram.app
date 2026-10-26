# Domain language

## Project

What a person makes in liveplanner is a **project**: a named set of Board, Sheet, Dashboard and Form tabs, its
items, sharing and history. People see it called a **plan**: the interface, help, marketing, email and the
descriptions agents read all say plan ("Creating your plan", "New Plan"). **Project** is its name in the code: the
type (`Project`), its package, tables, API routes (`/api/projects`), room and URL (`/project/<id>`), and the CLI's
`project` commands. "Document", "file" and "board" never name
it. (A page's DOM `document` is the browser's, not this.)

## Mode, kind and template

Three words describe how a project and its tabs differ. They answer different questions and are never
interchangeable. These are design decisions, taken before any feature that uses them.

| Term         | Answers                       | Values                                                      | Where it lives               |
| ------------ | ----------------------------- | ----------------------------------------------------------- | ---------------------------- |
| **mode**     | How is a tab worked on?       | Plan, the one mode (`EditorMode`)                           | Named, never stored on a tab |
| **kind**     | What is a tab?                | the general tab, or a Board, Sheet, Dashboard or Form tab   | `Tab.kind`                   |
| **template** | What was a project made from? | a template (`TemplateKind`), grouped into template families | Captured once, at creation   |

### Mode

- An **editor mode** is how a tab is worked on, by everyone on it: always **Plan**, the one mode
  ([Editor mode](../007-editor/editor-modes.md)). There is no mode switch.
- A mode is never a type of project or tab. A project's recorded creation intent still names the mode it was made
  in (**opens in**), which is Plan.
- A template catalogue category (**Planning**, **Meetings**, ...) says what a template is for; it never names a
  mode.

### Kind

- A **tab kind** is what a tab is: a **Board**, **Sheet**, **Dashboard** or **Form** tab
  ([Plan tabs](../026-plan/plan-tabs.md), [Forms](../030-forms/forms.md)), each with its own content and rules.
- A fresh tab is the **general** kind (`DEFAULT_TAB_KIND`, stored as `'diagram'`) until Start Planning makes it
  one of the four (`PLAN_TAB_KINDS`).
- "Board type" means a kind. It never names a template or a mode.

### Template

- A **template** is what a project was made from. It shapes a tab's starting content (its boards, card types, sheets
  or form) and then has no further hold on it.
- Templates group into **template families** where a family is meaningful to people, for example Retrospectives
  (several retrospective formats) and Kanban boards.
- A template or a template family is never a kind or a type: a retrospective is a Board tab made from a
  retrospective template.

### Using the three together

- **Default folders** are keyed in the order kind, template family, then mode ([Default folders](../013-workspace/default-folders.md)).
- **Explorer filters** offer them as separate chips: Opens in (mode), Kind and Template ([Explorer filters](../013-workspace/explorer-filters.md)).
- Code, copy and specs use these words only in these meanings.

## Items

The words for the work a Plan board frames ([Items](../026-plan/items.md), [Plan board](../026-plan/plan-board.md)).

| Term           | Means                                                                  | Never called                |
| -------------- | ---------------------------------------------------------------------- | --------------------------- |
| **item**       | One record in a project's item store: a type and an open bag of fields | ticket, task, issue, card   |
| **item type**  | What an item is: Task, Story, Bug, Epic, Note, Idea, Action, Risk      | kind (that is a tab's)      |
| **item store** | Every item of one project, stored apart from its tabs                  | backlog, database           |
| **Plan board** | The element that draws items as columns of cards from a stored set-up  | Kanban element, board tab   |
| **card**       | How an item is drawn, on a Plan board or alone as a Plan card          | item (the data is the item) |

- **Plan** is the editor mode, never a kind: a Plan board is the element that fills a Board tab.
- A **column** belongs to a Plan board and stands for a status; a **lane** is the Lane element.

## Agents

The words for a program working on projects for a person ([Agents](../024-agents/README.md)).

| Term               | Means                                                                                                   | Never called                            |
| ------------------ | ------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| **agent**          | A program acting as a person through their API token: an MCP client, a CLI caller, a script             | bot, AI user, assistant                 |
| **changeset**      | One agent write to one tab: atomic, sequenced by the room, attributed, revertable                       | batch, commit, patch                    |
| **edit operation** | One step in a changeset (`add`, `set`, `rm`, `test`), compiled into element ops                         | op (that is a room op), action, command |
| **view**           | A read-only text projection of a project or tab (overview, outline, comments, show, find, diff)         | mode, format                            |
| **ref**            | The short name a view prints for an element: its id, or its shortest unique id prefix                   | handle (that is a mention), alias       |
| **selector**       | An expression matching one or more elements (a ref, a quoted label, `type:plan-board`, `selected`)      | query, filter (that is the Explorer's)  |
| **access level**   | What a share link, embed or token admits: Viewer, Participant or Editor (`view`, `participate`, `edit`) | permission, scope (the field is `role`) |
| **ownership**      | The owner's powers over a project (sharing, delete, move), apart from any level                         | admin, edit level                       |

- **Participant** is the access level; a person's name and colour (their accounts profile, served as `/api/participants`) are their
  **display identity**.
- An **element op** (`ElementOp`) stays the room's unit; an edit operation is the agent's, and compiles into them.
- A CLI **command** and an MCP **tool** are the two front doors to one **verb** (`tab.view`, `item.set`).

## Colours

The words for choosing a colour ([Colour picker](../004-interface-design/colour-picker.md)).

| Term                     | Means                                                                                             | Never called                        |
| ------------------------ | ------------------------------------------------------------------------------------------------- | ----------------------------------- |
| **colour picker**        | The one control that chooses a colour, in any skin                                                | swatch picker, palette, colour well |
| **standard colours**     | The ten named colours every picker offers (Ink or White, Grey, Red ... Pink)                      | stock colours, presets              |
| **tone**                 | Which version of the standard colours a picker offers: `strong` (lines, text) or `soft` (fills)   | shade, variant, a drawing finish    |
| **theme colours**        | The active theme's own colours, offered on the canvas only                                        | presets                             |
| **Custom colours**       | The colours picked with + in the project, kept with its tabs                                      | custom swatches, recent colours     |
| **custom colour editor** | The square, hue, hex and eyedropper panel that **Add a custom colour** (four coloured dots) opens | colour wheel, native picker         |
| **skin**                 | Where and how a picker opens: inline, field, swatch button                                        | variant, mode                       |

## Drawing

The words for how elements are drawn, apart from their colours ([Finish](../008-canvas/finish.md)).

| Term           | Means                                                                                           | Never called                   |
| -------------- | ----------------------------------------------------------------------------------------------- | ------------------------------ |
| **finish**     | The drawing style of a tab and its elements: Flexible (default), Professional, Sketch or Marker | tone, look, style, render mode |
| **Follow Tab** | An element with no finish of its own, drawn in its tab's                                        | inherit, default               |

## Workbenches

The words for the editor framed beside code ([Workbench embeds](../013-workspace/workbench-embeds.md)).

| Term                    | Means                                                                                 | Never called                           |
| ----------------------- | ------------------------------------------------------------------------------------- | -------------------------------------- |
| **workbench**           | A developer tool that frames the editor beside an agent (an agent workbench, VS Code) | host (that is a profile's server), IDE |
| **selection reference** | The text naming what was selected, attached to a person's message to their agent      | context, selection payload             |

## Canvas element kinds

The element kinds of the project model that no Plan surface places (the diagram Card, badges, flowcharts, concept
graphics and the rest) keep their own words in their specs ([Elements](../009-elements/README.md)). Where a Plan
card and the diagram **Card** could meet, the Plan one is always called a **Plan card**.

## This Browser

**This Browser** is the one name for a project saved only in this browser ([Offline Mode](../006-project/offline-mode.md)):
the place it lives (the Explorer's This Browser section, beside My Work and the teams), the pill and badge that
mark it, and where a new guest's projects start. A project is **in This Browser**; it is never "Local Only",
"Local Browser" or "offline" in copy. "Offline Mode" stays the name of the feature, and code may say `offline`.

## Names in a sentence

Copy that builds a phrase around a name (a field, a note, a template, a chart type, an element type in
an agent's error) takes its article from the name: `withArticle` / `indefiniteArticle` in `@liveplanner/items`
(re-exported by `@liveplanner/project` and `@liveplanner/ui`). A vowel sound takes "an" ("an Estimate
field", "is not an Estimate option", "an Idea card"), and a vowel said "you" keeps "a" ("a User Story"). A fixed "a"
before an interpolated name reads "a Estimate" wherever the name starts with a vowel.
