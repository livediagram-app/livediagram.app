# Facilitate mode

**Facilitate** is the fifth [editor mode](../007-editor/editor-modes.md), beside Diagram, Draw,
Illustrate and Plan: how a general tab is worked on while a team runs a session on it, a
retrospective, a town hall, a lean coffee, a workshop. It brings the tools that run a room into
focus (timers, votes, polls, reveals, the Collaborate elements, stickers) and takes them out of
Diagram, so Diagram is about diagrams.

## Why

Diagram was the first mode, so it collected everything: shapes and arrows, and beside them a
whole workshop kit (34 Collaborate tiles, a sticker catalogue, a Session strip of Timer, Vote and
Poll in the bottom bar). Someone drawing an architecture diagram meets a fist-of-five gauge and
confetti; someone running a retro has to know those tools hide in the last category of a diagram
palette. A mode for running a session gives each audience its own surface, the way Plan did for
boards.

## Domain language

| Term                | Means                                                                                         | Not                                           |
| ------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------- |
| **Facilitate mode** | The editor mode for running a session with a team (`EditorMode` `'facilitate'`)               | Session mode, Collaborate mode                |
| **session**         | The activity a team runs on a tab (a retro, a town hall); never a stored thing                | a tab kind, a document type                   |
| **facilitator**     | The person holding the baton ([Facilitator](facilitator.md)); unrelated to who is in the mode | anyone in Facilitate mode                     |
| **session tools**   | Timer, Vote and Poll ([Session tools](session-tools.md))                                      | the Collaborate elements as a whole           |
| **Collaborate**     | The palette category of session elements (id `behaviour`)                                     | the mode, or comments and presence in general |

- The interface says **Facilitate**; specs and code say **Facilitate mode** or `'facilitate'`.
- "Session" and "Collaborate" are not the mode's name: both already name other things (the
  Session strip, Session buttons and the share session; the Collaborate palette category and
  menu rows).
- Facilitate mode is a mode, never a kind: a retro is a general tab in Facilitate mode, and
  everything on it is there in every other mode.

## What it brings into focus

- **Diagram mode's look and input.** No pages, no dock: the canvas, the palette and the Toolbar
  strip as Diagram has them. Every rule, tool and shortcut not named here is Diagram mode's.
- **Its own palette layout** (below), landing on its Popular.
- **The Session strip with all three tools**, Timer, Vote and Poll, with their set-up panes
  ([Session tools](session-tools.md#the-session-strip)).
- **It starts on Select** (Hand on a phone), like Diagram.
- **Its mark** is a flipchart on an easel, on the switch, the tab menu's Mode, the tab pill, the
  template picker's mode filter, the Explorer's Opens in and the help article.

## What Diagram gives up

- **The Collaborate category** (every Selection Mode, session, ask, record, reaction and navigate
  tile) and **the Stickers category** leave Diagram's palette.
- **The Session strip** leaves Diagram entirely (below).
- **Diagram keeps two Collaborate tiles in Write:** the **Comment panel** and the **Action card**
  (`collab:comment-pin`, `collab:action-card`), because comments and assigned actions belong to
  every mode (below). In Facilitate they stay in Collaborate's Record group too.
- **Diagram keeps Icons**, Technology, Media and everything else it has.
- **Content stays.** A session element already on a tab (a session button, a reveal zone, an
  agenda, a sticker) renders and works in every mode exactly as before: pressing a session button
  in Diagram still starts its tool, a reveal zone still reveals, a quiz still takes answers. Only
  what the palette **offers to add** changes, as with every narrowed palette.
- **Search still finds them.** The Toolbar strip's Search keeps offering every tile of every
  mode ([Toolbar layout](../007-editor/toolbar-layout.md#search-every-element-type)), the ones
  Diagram does not offer listed with the other modes' tiles: a timer or a sticker picked there in
  Diagram is placed in Diagram, without switching mode.
- **The element menus are unchanged.** A session element's own menu sections (Session, Reveal,
  Picker, Scale, Segments, Decision, Chair) and every element's Collaborate section (Assign
  Action, Comments) follow the element, not the mode.

## What stays in every mode

Collaborating on a tab is not running a session, so these are untouched and offered in every
mode as today:

- comments, the Comment panel tile, comment threads and mentions;
- presence, cursors, follow-me and Bring Focus;
- Presentation mode and the Slide Deck;
- assigned actions (the Action card tile, every element's Assign Action) and the Collaborate
  Panel; a Decision record already on a tab works everywhere, though its tile is Facilitate's;
- the facilitator baton in the Collaborators dialog.

## The palette

Facilitate's layout, in order:

| Band      | Categories                                            |
| --------- | ----------------------------------------------------- |
| _(none)_  | Popular                                               |
| Common    | Shapes, My shapes (with a shape library), Write, Draw |
| Structure | Build                                                 |
| Decorate  | Icons, Stickers, Media                                |
| Dynamic   | Collaborate                                           |

- **Popular** (the landing category), twelve fixed tiles: Sticky note, Text, Frame, Arrow,
  Timer button, Vote button, Poll button, Reveal zone, Agenda, Idea box, Q&A board, Temperature
  check.
- **Collaborate** holds all its groups (Ask, Tools, Record, React, Selection Mode, Navigate)
  exactly as Diagram's did ([Palette top-level categories](../010-palette/palette-top-level-categories.md)).
- Technology, Components, Devices, Data and Event Storming are not offered: they build diagrams
  and pages, not sessions.
- A **Participant** gets the participant palette Facilitate's landing category gives
  ([Participant share role](#share-roles)): sticky notes and text from Popular, and an image.

## The Session strip per mode

`sessionStripTools(mode)`:

| Mode       | Strip tools       |
| ---------- | ----------------- |
| Facilitate | Timer, Vote, Poll |
| Plan       | Timer, Vote       |
| Diagram    | none              |
| Draw       | none (as today)   |
| Illustrate | none (as today)   |

- **Diagram has no strip, running or not.** A timer, vote or poll started on a Diagram tab (by a
  session button on it, or before the tab was switched out of Facilitate) runs as before and shows
  on its own canvas element, but its strip button and popover do not: watching turnout, ending a
  poll or keeping its results is done from Facilitate (or Plan for a timer or vote). This is the
  same rule Draw and Illustrate already follow, and the price of a Diagram mode with no session
  chrome.
- A popover whose button leaves (a mode switch, the tool ending) closes, as today.

## Templates

Session templates open in Facilitate, as the Draw templates open in Draw
([Templates by mode](../007-editor/templates-by-mode.md)):

- the Retrospectives family's `retrospective`, `start-stop-continue`, `mad-sad-glad`, `four-ls`
  and `sailboat` (`team-retro` stays in Plan: it is a board of cards);
- `town-hall`, `lean-coffee`, `crazy-eights` and `meeting-agenda`.

Brainstorm mind maps stay in Diagram and the drawn warm-ups (`doodle-warmup`, `pre-mortem`,
`idea-garden`) stay in Draw.

**Blank Session** (kind `blank-session`) is Facilitate's blank: a general tab that opens in
Facilitate with nothing on it, the document named "Untitled Session". It joins the blanks
leading Popular in the template picker and Quick Start, which become five.

## Share roles

Following [Gate a feature by share role](../../instructions/gate-a-feature-by-share-role.md):

| Role            | In Facilitate mode                                                                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Editor**      | Switches the tab into and out of Facilitate; the full palette and the Session strip's set-up; every session tool's rules as specified for it                  |
| **Participant** | Follows the tab's mode, sees no switch; the participant palette and tools; takes part in every running tool (votes, answers, responds) as its own spec allows |
| **Viewer**      | Follows the tab's mode, sees no switch and no palette; sees running tools' buttons read-only, as today                                                        |

Every gate reads the session's `can`, never `isReadOnly` alone. A locked tab behaves for an editor
as for a viewer, as every mode does.

## Agents, MCP and the CLI

- `'facilitate'` is a valid stored `opensIn` everywhere a mode is read (the api's creation intent,
  default folders, tab stats, the OpenAPI `EditorMode` enum).
- MCP and the CLI reach Facilitate through templates: a session template, or `blank-session`,
  makes a tab that opens in Facilitate. No tool takes a mode directly, as today.
- `document-views` need no change: Facilitate draws no pages.

## Workspace

- **Default folders:** a `mode:facilitate` key, labelled **Sessions** (noun "sessions")
  ([Default folders](../013-workspace/default-folders.md)).
- **Explorer filters:** Opens in offers **Facilitate** ([Explorer filters](../013-workspace/explorer-filters.md)).
- **The template picker's mode filter** offers Facilitate, with its count.

## Telemetry

- `Editor` · `Changed` · `ModeFacilitate`, fired as the other modes' switches fire.
- `UI` · `Toggled` · `TemplateModeFacilitate`, from the template picker's mode filter.
- Both extend the existing types; no new category or action.

## Help

- **Facilitate mode** gets its own help article (`/help/collaboration/facilitate-mode/`),
  registered per [Register a help article](../../instructions/register-a-help-article.md), and
  **Editor Modes** covers five modes.
- The Session tools article says the set-up lives in Facilitate (and Plan).

## Existing tabs

- Nothing is migrated. A tab in Diagram keeps opening in Diagram, with every session element on it
  working; its editors switch to Facilitate when they want the kit.
- A retro made from a template before this change opens in Diagram, as stored.
