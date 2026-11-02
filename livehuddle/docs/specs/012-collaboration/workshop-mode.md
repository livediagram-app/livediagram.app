# Workshop mode

**Workshop** is livehuddle's one [editor mode](../007-editor/editor-modes.md): every tab is worked on in Workshop, the
mode for running a session with a team on it, a retrospective, a town hall, a lean coffee, a workshop, a meeting in a
space. It brings the tools that run a room into focus (timers, votes, polls, reveals, the Collaborate elements,
stickers). There is no other mode and no switch.

## Why

livediagram has three modes, Diagram, Draw and Workshop, and Workshop is the one about people being together.
livehuddle is built around that ([Purpose](../001-project-vision/purpose.md)), so it keeps Workshop alone (D2 in
[Open decisions](../005-project-roadmap/open-decisions.md): all of Workshop), and Diagram and Draw are livediagram's.

## Domain language

| Term              | Means                                                                                 | Not                                                            |
| ----------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| **Workshop mode** | The editor mode every tab is worked in (`EditorMode` `'workshop'`)                    | Facilitate mode (its old name), Session mode, Collaborate mode |
| **session**       | The activity a team runs on a tab (a retro, a town hall); never a stored thing        | a tab kind, a document type                                    |
| **facilitator**   | The person holding the baton ([Facilitator](facilitator.md)); unrelated to the mode   | anyone in Workshop mode                                        |
| **session tools** | Timer, Vote and Poll ([Session tools](session-tools.md))                              | the Collaborate elements as a whole                            |
| **Collaborate**   | The session elements as a whole (`toolGroup: 'behaviour'`), offered as six categories | the mode, or comments and presence in general                  |

- The interface says **Workshop**; specs and code say **Workshop mode** or `'workshop'`.
- "Session" and "Collaborate" are not the mode's name: both already name other things (the Session strip, Session
  buttons and the share session; the Collaborate elements and menu rows).
- Workshop mode is a mode, never a kind: a retro is a general tab.

## What it brings

- **The canvas, the palette and the Toolbar strip** ([Canvas and palette](../008-canvas/canvas-and-palette.md),
  [Toolbar layout](../007-editor/toolbar-layout.md)), with **its palette layout** (below), landing on its Popular.
- **The Session strip with all three tools**, Timer, Vote and Poll, with their set-up panes
  ([Session tools](session-tools.md#the-session-strip)).
- **It starts on Select** (Hand on a phone).
- **Its mark** is a flipchart on an easel, on the template picker and the help article.

## What every tab offers

Collaborating on a tab is part of every session:

- comments, the Comment panel tile, comment threads and mentions;
- presence, cursors, follow-me and Bring Focus;
- Presentation mode and the Slide Deck;
- assigned actions (the Action card tile, every element's Assign Action) and the Collaborate Panel;
- the facilitator baton in the Collaborators dialog.

## The palette

Workshop's layout is livehuddle's one palette, in order:

| Band        | Categories                                            |
| ----------- | ----------------------------------------------------- |
| _(none)_    | Popular                                               |
| Common      | Shapes, My shapes (with a shape library), Write, Draw |
| Structure   | Layout                                                |
| Collaborate | Ask, Tools, Record, React, Selection Mode, Navigate   |
| Decorate    | Icons, Stickers, Media                                |
| Dynamic     | Data                                                  |

- **Popular** (the landing category), fixed: Square, Sticky note, Text, Frame, Arrow, Image, then behind a divider **Ask**,
  **Tools**, **Record** and **React** as openers ([Editor modes](../007-editor/editor-modes.md#the-palette)): each draws its category's glyph
  with a chevron and opens that category's tiles in a popover under it, on a desktop and a phone.
- **Write and Draw hold what a session uses.** Write is Text, Sticky note and
  Pointer note, then behind a divider Table and Checklist (no Page, no Annotation); Draw is Pencil, Highlighter, Arrow
  and Line (no Shape Pen, no Polygon).
- **Layout** ([The Build palette category](../010-palette/build-category.md)): Lane, Frame, Stack, Boundary, the
  [Timeline](../009-elements/timeline.md), then Diagram key, Card, Badge and Step number. A board is laid out in
  frames and lanes, and its notes labelled.
- **The Collaborate elements are six categories, not one.** Each group of
  [Collaborate](../010-palette/palette-top-level-categories.md#collaborate-one-category-fully-grouped)
  is its own category in a **Collaborate** band (the heading names the elements, where Dynamic
  named a mechanism), in the same room-first order, each a list of rows:
  - **Ask**: Dot vote, Poll, Quiz, the estimate scales, Temperature check, Idea box, Q&A board.
  - **Tools**: Timer, Stopwatch, Reveal zone, Done check, Picker.
  - **Record**: Comment panel, Action card, Agenda, Decision record, Roll call.
  - **React**: the five reaction pads.
  - **Selection Mode**: one button per selection mode.
  - **Navigate**: Portal, Bring focus, Chair, Desk, Sofa, Fence, Link card.
- **On the strip, the category bar** ([Toolbar layout](../007-editor/toolbar-layout.md#the-category-bar)) shows the
  layout as **Shapes, Write, Draw · Layout · Ask, Session · Icons, Stickers, Media · Data**: no Popular; and Tools, Record, React, Selection Mode
  and Navigate gathered into **Session**, browsed in two panes (the groups down the side, a search across all of
  them). **Ask** keeps its own button: putting a question to the room is the session's main act.

  In Workshop every one of them is a tile you reach for mid-session, so a parent category was a
  click in front of each, with a group browser one level down. Six categories put every group one
  pick away in the category picker and let the toolbar strip show each group's tiles directly.

- Components and Event Storming are not categories (an event-storming board brings its own notation). The Toolbar
  strip's Search finds every element livehuddle has, those no category offers included (the Components, the Code
  block, the embeds), and places it ([Toolbar layout](../007-editor/toolbar-layout.md#search-every-element-type)).
- A **Participant** gets the participant palette Workshop's landing category gives
  ([Participant share role](#share-roles)): sticky notes and text, and an image.

## The Session strip

`sessionStripTools(mode, esBoard)` gives Timer, Vote and Poll on every tab, an event-storming board included.

- A popover whose button leaves (the tool ending) closes.

## Templates

Every template opens in Workshop ([Templates by mode](../007-editor/templates-by-mode.md)). The session templates are:

- the Retrospectives family's `retrospective`, `start-stop-continue`, `mad-sad-glad`, `four-ls` and `sailboat`;
- `town-hall`, `lean-coffee`, `crazy-eights`, `meeting-agenda`, `workshop-board` and `brainstorm`;
- the boards that ship a dot vote, `affinity-map`, `prioritization-matrix` and `risk-matrix`;
- the boards a team fills in together: `incident-postmortem`, `user-persona`, `empathy-map`, `journey`,
  `objectives-planner`, `roadmap`, `raci-matrix`, `user-story-map`, `swot`, `business-model-canvas`,
  `stakeholder-map` and `opportunity-solution-tree` (grouped in Start a Workshop under Retrospectives, Workshops,
  Planning and Strategy, [Templates by mode](../007-editor/templates-by-mode.md#workshop-templates));
- the quizzes and games, `pub-quiz`, `icebreaker-questions`, `two-truths-and-a-lie`, `would-you-rather` and
  `people-bingo` ([Quiz and game templates](quiz-and-game-templates.md));
- the spaces to walk round in Avatar mode, `virtual-office`, `coworking-space`, `team-pod` and `all-hands-hall`
  ([Virtual Office template](virtual-office-template.md)).

Templates that build with an element livehuddle no longer has (mind maps, flowcharts, sequence diagrams, Sankey
diagrams, org charts, entities, the concept graphics but the Timeline, device frames, Technology icons) are not in the
catalogue. The rest of the forked catalogue stays until step 5.4 of the
[Build plan](../005-project-roadmap/build-plan.md) cuts it to Workshop's and the Spaces.

**Blank Workshop** (kind `blank-session`) is the blank: a general tab with nothing on it, the document named
"Untitled Workshop".

## Share roles

Following [Gate a feature by share role](../../instructions/gate-a-feature-by-share-role.md):

| Role            | In Workshop mode                                                                                                      |
| --------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Editor**      | The full palette and the Session strip's set-up; every session tool's rules as specified for it                       |
| **Participant** | The participant palette and tools; takes part in every running tool (votes, answers, responds) as its own spec allows |
| **Viewer**      | No palette; sees running tools' buttons read-only                                                                     |

Every gate reads the session's `can`, never `isReadOnly` alone. A locked tab behaves for an editor as for a viewer.

## Agents, MCP and the CLI

- `'workshop'` is the stored `opensIn` everywhere a mode is read (the api's creation intent, tab stats, the OpenAPI
  `EditorMode` enum); every other stored value reads as Workshop.
- No tool takes a mode. A template, or `blank-session`, makes a Workshop tab like any other.

## Workspace

- **Default folders:** the `mode:workshop` key, labelled **Sessions** (noun "sessions")
  ([Default folders](../013-workspace/default-folders.md)).
- **Explorer filters:** Opens in offers **Workshop** alone ([Explorer filters](../013-workspace/explorer-filters.md)).

## Telemetry

- No mode-switch events: there is nothing to switch.

## Help

- **Workshop mode** has its own help article (`/help/canvas/workshop-mode/`), registered per
  [Register a help article](../../instructions/register-a-help-article.md).
- The Session tools article says where the set-up lives.
- An optional [Workshop tour](workshop-tour.md) shows the mode, from the footer's **Start Workshop Tour** button.

## Existing tabs

- Nothing is migrated: livehuddle had no stored spaces when Diagram and Draw were cut. A tab stored with any other
  mode reads as Workshop ([Editor modes](../007-editor/editor-modes.md#where-the-mode-lives)).
