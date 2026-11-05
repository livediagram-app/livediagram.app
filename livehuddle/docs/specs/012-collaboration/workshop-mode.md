# The meeting board (Workshop mode in the code)

Status: **approved, being built** (Work Tracker #423, owner, 2026-11-04). Parts 2, 3 and 4 are done: the palette,
the Session strip, the templates and the help are the meeting board's, and the leaving code is deleted
([Not in livehuddle](../002-project-scope/not-in-livehuddle.md)).

Every tab of a Space is a **meeting board**: a floor to walk round, meet on and leave a few notes on. It is
livehuddle's one [editor mode](../007-editor/editor-modes.md), stored as `'workshop'` because the code was forked from
livediagram's Workshop mode, but it is not Workshop: no retros, no workshop kit, no Collaborate elements, no diagram
tools. There is no other mode and no switch, and the interface never names a mode.

## Why

livehuddle is about meeting in Spaces ([Purpose](../001-project-vision/purpose.md)): Spaces, avatars, rooms and calls
are the product. A meeting needs a place, a few notes and pictures on its walls, and two light tools (a timer and
Bring Focus). Running a workshop on a board, with polls, quizzes, Q&A, agendas and reveals, is
livediagram's Workshop mode, which keeps all of it ([livediagram's Workshop mode](../../../../livediagram/docs/specs/012-collaboration/workshop-mode.md)).

## Domain language

| Term              | Means                                                                                 | Not                                                    |
| ----------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| **meeting board** | A tab of a Space, in livehuddle's one mode (`EditorMode` `'workshop'` in the code)    | Workshop (livediagram's mode); a liveplanner board     |
| **session**       | The meeting a group holds on a board (a stand-up, an all-hands); never a stored thing | a tab kind, a document type, a call                    |
| **facilitator**   | The person holding the baton ([Facilitator](facilitator.md)); unrelated to the mode   | whoever opened the Space first                         |
| **meeting tools** | The Timer, Bring Focus and the Reaction Pads                                          | the Collaborate elements, which livehuddle has none of |
| **light content** | Sticky notes, text, images, stickers, icons and link cards                            | shapes, arrows, drawings, containers, charts           |

- The interface says neither **Workshop** nor **mode**: a person opens a Space, never a mode. Specs say **meeting
  board**; the code keeps `'workshop'` (no stored value changes).
- "Collaborate" names no element in livehuddle. The Collaborate Panel (comments and assigned actions) keeps its name.

## What it brings

- **The canvas, the palette and the Toolbar strip** ([Canvas and palette](../008-canvas/canvas-and-palette.md),
  [Toolbar layout](../007-editor/toolbar-layout.md)), with **the meeting palette** (below), landing on its Popular.
- **The Session strip with the Timer**, with its set-up pane
  ([Session tools](session-tools.md#the-session-strip)).
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

| Band     | Categories                        |
| -------- | --------------------------------- |
| _(none)_ | Popular                           |
| Common   | Write                             |
| Meet     | Travel, Seating, Rooms, Amenities |
| Decorate | Icons, Stickers, Media            |

- **Popular** (the landing category), fixed: Sticky note, Text, Image, Link card, then behind a divider Room,
  Meeting Table, Chair, Bring Focus and Avatar Pad. No openers: every category is one level deep.
- **Write**: Text and Sticky note. No Pointer note, Table, Checklist, Page or Annotation.
- **The Space categories** ([The Space categories](../010-palette/palette-top-level-categories.md#the-space-categories)),
  one per question somebody building a Space asks (owner, 2026-11-05: one Navigate category would only grow):
  - **Travel**: Portal, Bring Focus, Avatar Pad, the Avatar Button and Link card.
  - **Seating**: Chair, Desk, Sofa and Meeting Table.
  - **Rooms**: Fence, Room, Stage and Rug.
  - **Amenities**: Plant, Bookshelf, Water Cooler and Coffee Machine.
- **No Selection Mode category.** The Avatar [Selection Mode button](../009-elements/mode-button.md) (the Spaces'
  **Walk In**) is in Travel; the Select, Hand, Eraser and Format buttons are gone, and so are Reaction Pads and the
  Laser, Spotlight and Isometric buttons (owner, 2026-11-05).
- **Icons** and **Stickers**, for decoration, as livediagram has them.
- **Media**: Image (upload, the gallery, [image search](../009-elements/image-search.md)) and Link card. No video or
  website embeds.
- **No** Shapes, My shapes, Draw (pencil, highlighter, arrow, line), Frame, Layout, Data, Components, Ask, Tools, Record or React (owner, 2026-11-05: no frames in livehuddle). A connector or a flowchart shape is a diagram tool: livediagram's.
- **On the strip, the category bar** ([Toolbar layout](../007-editor/toolbar-layout.md#the-category-bar)) shows
  **Write · Travel, Seating, Rooms, Amenities, Modes · Icons, Stickers, Media**: no Popular, no Session
  category. Selection Mode reads **Modes** on the bar, since a bar name is one word (`barLabel`); its flyout and the
  palette keep the full name. Each Space category's flyout is one block of its tiles, with no group headings.
- The Toolbar strip's **Search** finds only what the palette offers: an element livehuddle no longer offers is not
  placed from anywhere ([Toolbar layout](../007-editor/toolbar-layout.md#search-every-element-type)).
- A **Participant** gets sticky notes, text and an image, as before ([Share roles](#share-roles)).

## The Session strip

`sessionStripTools(mode)` gives the **Timer** on every tab ([Session tools](session-tools.md)). Poll left
with the other Collaborate tools: its button shows only while a stored Poll card's poll is running, so whoever
started it can end it, and offers no new poll.

- The quick vote left too ([Not in livehuddle](../002-project-scope/not-in-livehuddle.md#the-vote)): no Vote button, and a tab's stored vote is dropped on read.
- A popover whose button leaves (the tool ending) closes.
- No Session button element: the strip starts the timer.

## Templates

The catalogue is **Blank Space** and ten Spaces in the Office, Events, Outdoor and Recreation categories
([Virtual Office template](virtual-office-template.md), [Templates by mode](../007-editor/templates-by-mode.md)).
Every template opens on a meeting board. The Spaces use only what stays: the office, bar and garden pieces,
furniture, a Walk In button, Bring Focus, sticky notes, text and a sticker.

The retrospectives, the workshop boards, the planning and strategy boards and the quizzes and games leave
([Not in livehuddle](../002-project-scope/not-in-livehuddle.md)); a link, an agent or a seed naming one is answered
with Blank Space, as any unknown kind is.

**Blank Space** (kind `blank-session`) is the blank: a general tab with nothing on it, the document named
"Untitled Space".

## Share roles

Following [Gate a feature by share role](../../instructions/gate-a-feature-by-share-role.md):

| Role            | On a meeting board                                                                                       |
| --------------- | -------------------------------------------------------------------------------------------------------- |
| **Editor**      | The full meeting palette and the Session strip's set-up; builds and furnishes rooms; presses Bring Focus |
| **Participant** | Walks, sits, talks and hears; sticky notes, text and an image; comments and reacts                       |
| **Viewer**      | Walks, sits, talks and hears; no palette; sees a running timer read-only                                 |

Every gate reads the session's `can`, never `isReadOnly` alone. A locked tab behaves for an editor as for a viewer.

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

- No Workshop mode article and no Workshop tour. The Session tools article covers the Timer; the
  Avatar tour is the one guided tour of a Space.
- Help articles for what leaves are removed in the part that removes it, with redirects to the nearest article that
  stays ([Help app](../018-help/help-app.md)).

## Existing tabs

- A tab stored with any mode reads as a meeting board ([Editor modes](../007-editor/editor-modes.md#where-the-mode-lives)).
- A stored element of a leaving kind is kept and drawn ([Not in livehuddle](../002-project-scope/not-in-livehuddle.md#a-space-that-already-holds-a-leaving-element)).
