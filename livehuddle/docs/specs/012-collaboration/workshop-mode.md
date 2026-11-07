# The meeting board (Workshop mode in the code)

Status: **approved, being built** (Work Tracker #423, owner, 2026-11-04). Parts 2, 3 and 4 are done: the palette,
the templates and the help are the meeting board's (the Session strip has since left), and the leaving code is deleted
([Not in livehuddle](../002-project-scope/not-in-livehuddle.md)).

Every tab of a Space is a **meeting board**: a floor to walk round, meet on and leave a few notes on. It is
livehuddle's one [editor mode](../007-editor/editor-modes.md), stored as `'workshop'` because the code was forked from
livediagram's Workshop mode, but it is not Workshop: no retros, no workshop kit, no Collaborate elements, no diagram
tools. There is no other mode and no switch, and the interface never names a mode.

## Why

livehuddle is about meeting in Spaces ([Purpose](../001-project-vision/purpose.md)): Spaces, avatars, rooms and calls
are the product. A meeting needs a place, a few notes and pictures on its walls, and two light tools (a clock on the wall and
Bring Focus). Running a workshop on a board, with polls, quizzes, Q&A, agendas and reveals, is
livediagram's Workshop mode, which keeps all of it ([livediagram's Workshop mode](../../../../livediagram/docs/specs/012-collaboration/workshop-mode.md)).

## Domain language

| Term              | Means                                                                                 | Not                                                    |
| ----------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| **meeting board** | A tab of a Space, in livehuddle's one mode (`EditorMode` `'workshop'` in the code)    | Workshop (livediagram's mode); a liveplanner board     |
| **session**       | The meeting a group holds on a board (a stand-up, an all-hands); never a stored thing | a tab kind, a document type, a call                    |
| **facilitator**   | The person holding the baton ([Facilitator](facilitator.md)); unrelated to the mode   | whoever opened the Space first                         |
| **meeting tools** | The Timer and Stopwatch pieces and Bring Focus                                        | the Collaborate elements, which livehuddle has none of |
| **light content** | Sticky notes, text and stickers                                                       | shapes, arrows, drawings, containers, charts           |

- The interface says neither **Workshop** nor **mode**: a person opens a Space, never a mode. Specs say **meeting
  board**; the code keeps `'workshop'` (no stored value changes).
- "Collaborate" names no element in livehuddle. The Collaborate Panel (comments and assigned actions) keeps its name.

## What it brings

- **The canvas, the palette and the Toolbar strip** ([Canvas and palette](../008-canvas/canvas-and-palette.md),
  [Toolbar layout](../007-editor/toolbar-layout.md)), with **the meeting palette** (below), landing on its Popular.
- **The Timer and Stopwatch pieces** in the palette's Meet category
  ([Timer and Stopwatch](../009-elements/timer-and-stopwatch.md)); there is no Session strip.
- **A Spaces board opens walking** ([v1 scope](../002-project-scope/v1-scope.md) section 1); any other starts on
  Select (Hand on a phone).

## What every tab offers

- comments, comment threads, mentions and reactions;
- presence, cursors, follow-me and Bring Focus;
- Avatar mode, speech bubbles, proximity audio and calls;
- assigned actions from any element's menu, and the Collaborate Panel;
- the facilitator baton in the Collaborators dialog.

No Presentation mode, no Slide Deck, no Page ([Not in livehuddle](../002-project-scope/not-in-livehuddle.md)): part 2 took
them out, and a document's stored deck is kept untouched.

## The palette

The meeting palette is livehuddle's one palette, in order:

| Band     | Categories                              |
| -------- | --------------------------------------- |
| _(none)_ | Popular                                 |
| Common   | Write                                   |
| Meet     | Rooms, Seats, Perks, Play, Garden, Meet |
| Travel   | Travel                                  |
| Decorate | Stickers                                |

- **Popular** (the landing category), fixed: Sticky note and Text, then behind a divider Room,
  Meeting Table, Chair, Bring Focus and Avatar Pad. No openers: every category is one level deep.
- **Write**: Text and Sticky note. No Pointer note, Table, Checklist, Page or Annotation.
- **The Space categories** ([The Space categories](../010-palette/palette-top-level-categories.md#the-space-categories)),
  one per question somebody building a Space asks (owner, 2026-11-05: one Navigate category would only grow):
  - **Rooms**: a **Build** group first (Room, Room Builder, Door), then **Floor** (Fence, Stage, Office Pod, Rug).
  - **Seats**: Chair, Desk, Sofa, Meeting Table, Bean Bag and Reading Nook.
  - **Perks**: Plant, Bookshelf, Water Cooler, Coffee Machine and Vending Machine.
  - **Play**: **Bar** (Bar, Bar Stool, Drinks Cabinet, Drinks Fridge), **Games** (Ping-Pong Table, Pool
    Table, Foosball Table, Arcade Machine, Dartboard), **Lounge** (Jukebox, Fireplace). There is no Bar category (owner, 2026-11-06).
  - **Garden**: **Plants** (Outdoor Plant, Tree, Grass), **Paths and Fences** (Garden Path, Garden Fence),
    **Furniture** (Bench, Picnic Table, Hammock, Garden Umbrella), **Features** (Fountain, Pond, Campfire).
  - **Meet**, as [The Space categories](../010-palette/palette-top-level-categories.md#the-space-categories) lists it.
  - **Travel**, in a band of its own: Portal, Bring Focus, Avatar Pad, Directory, Elevator and the Avatar Button.
- **No Selection Mode category.** The Avatar [Selection Mode button](../009-elements/mode-button.md) (once the Spaces'
  **Walk In**, which an Avatar Pad replaced) is in Travel; the Select, Hand, Eraser and Format buttons are gone, and so are Reaction Pads and the
  Laser, Spotlight and Isometric buttons (owner, 2026-11-05).
- **Stickers**, for decoration, as livediagram has them. No Icons category (owner, 2026-11-05:
  [Icons](../002-project-scope/not-in-livehuddle.md#icons)); a stored icon still draws and edits.
- **No Media** (owner, 2026-11-05: [Media](../002-project-scope/not-in-livehuddle.md#media-image-and-link-card)): no Image or Link card anywhere in the palette, and a picture pasted
  or dropped on the canvas is refused. A stored image or link card still draws, moves and deletes.
- **No** Shapes, My shapes, Draw (pencil, highlighter, arrow, line), Frame, Layout, Data, Components, Ask, Tools, Record or React (owner, 2026-11-05: no frames in livehuddle). A connector or a flowchart shape is a diagram tool: livediagram's.
- **On the strip, the category bar** ([Toolbar layout](../007-editor/toolbar-layout.md#the-category-bar)) shows
  **Write | Rooms, Seats, Perks, Play, Garden, Meet | Travel | Stickers**, a divider
  between each band ([The strip's order](../010-palette/palette-top-level-categories.md#the-strips-order)): no
  Popular, no Session category, no Selection Mode category. Each Space category's flyout is one block of its tiles,
  with no group headings, but Rooms, which opens on its Build group, and Play and Garden, which list their
  groups ([Groups in a flyout](../010-palette/palette-top-level-categories.md#groups-in-a-flyout)).
- The Toolbar strip's **Search** finds only what the palette offers: an element livehuddle no longer offers is not
  placed from anywhere ([Toolbar layout](../007-editor/toolbar-layout.md#search-every-element-type)).
- A **Participant** gets no palette at all, and is always walking ([A Participant walks](../013-workspace/share-roles.md#a-participant-walks), owner 2026-11-05).

## The Session strip

There is none. Its last tool, the Timer, left for the [Timer and Stopwatch](../009-elements/timer-and-stopwatch.md)
pieces ([Not in livehuddle](../002-project-scope/not-in-livehuddle.md#the-session-strips-timer)); Poll and the quick
vote had left before it ([Vote](../002-project-scope/not-in-livehuddle.md#the-vote)). A tab's stored `timer` and
`vote` are dropped on read.

## Templates

The catalogue is **Blank Space** and eighteen Spaces in the Campus, Office, Events, Outdoor and Recreation categories
([Virtual Office template](virtual-office-template.md), [Templates by mode](../007-editor/templates-by-mode.md)).
Every template opens on a meeting board. The Spaces use only what stays: the office, bar and garden pieces,
furniture, an Avatar Pad, Bring Focus, sticky notes, text and a sticker.

The retrospectives, the workshop boards, the planning and strategy boards and the quizzes and games leave
([Not in livehuddle](../002-project-scope/not-in-livehuddle.md)); a link, an agent or a seed naming one is answered
with Blank Space, as any unknown kind is.

**Blank Space** (kind `blank-session`) is the blank: a general tab with nothing on it, the document named
"Untitled Space".

## Share roles

Following [Gate a feature by share role](../../instructions/gate-a-feature-by-share-role.md):

| Role            | On a meeting board                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------------------ |
| **Editor**      | The full meeting palette; builds and furnishes rooms; runs Timers and Stopwatches; presses Bring Focus |
| **Participant** | Always walks; sits, talks and hears; comments and reacts; pins notes, swings doors, runs Timers        |
| **Viewer**      | Walks, sits, talks and hears; no palette; sees a running Timer or Stopwatch read-only                  |

Every gate reads the session's `can`, never `isReadOnly` alone.

## Agents, MCP and the CLI

- `'workshop'` is the stored `opensIn` everywhere a mode is read (the api's creation intent, tab stats, the OpenAPI
  `EditorMode` enum); every other stored value reads as it.
- No tool takes a mode. A template, or `blank-session`, makes a meeting board like any other. `list_templates` and
  the CLI list the five templates.
- No agent schema, verb or enum names a retired kind or the Page (part 4, [Not in livehuddle](../002-project-scope/not-in-livehuddle.md#retired-elements));
  the diagram kinds an agent may still add leave with the element engine (Work Tracker #459).

## Workspace

- **Default folders:** the `mode:workshop` key, labelled **Spaces** (noun "spaces")
  ([Default folders](../013-workspace/default-folders.md)).
- **Explorer filters:** no Opens In filter: there is one mode ([Explorer filters](../013-workspace/explorer-filters.md)).

## Telemetry

- No mode-switch events: there is nothing to switch.
- The events of a leaving tool (poll, Q&A, quiz, deck) stop with its code; the telemetry dashboard drops their rows
  ([Telemetry](../017-telemetry/telemetry.md)).

## Help

- No Workshop mode article and no Workshop tour. The Session tools article covers the Timer and Stopwatch pieces; the
  Avatar tour is the one guided tour of a Space.
- Help articles for what leaves are removed in the part that removes it, with redirects to the nearest article that
  stays ([Help app](../018-help/help-app.md)).

## Existing tabs

- A tab stored with any mode reads as a meeting board ([Editor modes](../007-editor/editor-modes.md#where-the-mode-lives)).
- A stored element of a leaving kind is kept and drawn ([Not in livehuddle](../002-project-scope/not-in-livehuddle.md#a-space-that-already-holds-a-leaving-element)).
