# The meeting board (Workshop mode in the code)

Status: **approved, being built** (Work Tracker #423, owner, 2026-11-04). Until its parts land, the code still offers
all of livediagram's Workshop mode; [Not in livehuddle](../002-project-scope/not-in-livehuddle.md) lists what leaves
and which part removes it.

Every tab of a Space is a **meeting board**: a floor to walk round, meet on and leave a few notes on. It is
livehuddle's one [editor mode](../007-editor/editor-modes.md), stored as `'workshop'` because the code was forked from
livediagram's Workshop mode, but it is not Workshop: no retros, no workshop kit, no Collaborate elements, no diagram
tools. There is no other mode and no switch, and the interface never names a mode.

## Why

livehuddle is about meeting in Spaces ([Purpose](../001-project-vision/purpose.md)): Spaces, avatars, rooms and calls
are the product. A meeting needs a place, a few notes and pictures on its walls, and three light tools (a timer, a
quick vote, Bring Focus). Running a workshop on a board, with polls, quizzes, Q&A, agendas and reveals, is
livediagram's Workshop mode, which keeps all of it ([livediagram's Workshop mode](../../../../livediagram/docs/specs/012-collaboration/workshop-mode.md)).

## Domain language

| Term              | Means                                                                                 | Not                                                    |
| ----------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| **meeting board** | A tab of a Space, in livehuddle's one mode (`EditorMode` `'workshop'` in the code)    | Workshop (livediagram's mode); a liveplanner board     |
| **session**       | The meeting a group holds on a board (a stand-up, an all-hands); never a stored thing | a tab kind, a document type, a call                    |
| **facilitator**   | The person holding the baton ([Facilitator](facilitator.md)); unrelated to the mode   | whoever opened the Space first                         |
| **meeting tools** | The Timer, the quick vote (Vote) and Bring Focus                                      | the Collaborate elements, which livehuddle has none of |
| **light content** | Sticky notes, text, images, stickers, icons, link cards and frames                    | shapes, arrows, drawings, containers, charts           |

- The interface says neither **Workshop** nor **mode**: a person opens a Space, never a mode. Specs say **meeting
  board**; the code keeps `'workshop'` (no stored value changes).
- "Collaborate" names no element in livehuddle. The Collaborate Panel (comments and assigned actions) keeps its name.

## What it brings

- **The canvas, the palette and the Toolbar strip** ([Canvas and palette](../008-canvas/canvas-and-palette.md),
  [Toolbar layout](../007-editor/toolbar-layout.md)), with **the meeting palette** (below), landing on its Popular.
- **The Session strip with two tools**, Timer and Vote, with their set-up panes
  ([Session tools](session-tools.md#the-session-strip)).
- **A Spaces board opens walking** ([v1 scope](../002-project-scope/v1-scope.md) section 1); any other starts on
  Select (Hand on a phone).

## What every tab offers

- comments, comment threads, mentions and reactions;
- presence, cursors, follow-me, Bring Focus, the laser and the spotlight;
- Avatar mode, speech bubbles, proximity audio and calls;
- assigned actions from any element's menu, and the Collaborate Panel;
- the facilitator baton in the Collaborators dialog.

No Presentation mode, no Slide Deck, no Page ([Not in livehuddle](../002-project-scope/not-in-livehuddle.md)).

## The palette

The meeting palette is livehuddle's one palette, in order:

| Band     | Categories               |
| -------- | ------------------------ |
| _(none)_ | Popular                  |
| Common   | Write, Frame             |
| Meet     | Navigate, Selection Mode |
| Decorate | Icons, Stickers, Media   |

- **Popular** (the landing category), fixed: Sticky note, Text, Frame, Image, Link card, then behind a divider Room,
  Meeting Table, Chair, Bring Focus and Avatar Pad. No openers: every category is one level deep.
- **Write**: Text and Sticky note. No Pointer note, Table, Checklist, Page or Annotation.
- **Frame**: the frame alone, to group a room's notes; no lane, stack, boundary, timeline, key, card, badge or step
  number.
- **Navigate**: Portal, Bring Focus, Chair, Desk, Sofa, Fence, Avatar Pad and Link card, then the
  [office pieces](../009-elements/office.md): Room, Meeting Table, Plant, Bookshelf, Water Cooler, Coffee Machine and
  Rug.
- **Selection Mode**: one [Selection Mode button](../009-elements/mode-button.md) per selection mode (the Spaces'
  **Walk In** is the Avatar one).
- **Icons** and **Stickers**, for decoration, as livediagram has them.
- **Media**: Image (upload, the gallery, [image search](../009-elements/image-search.md)) and Link card. No video or
  website embeds.
- **No** Shapes, My shapes, Draw (pencil, highlighter, arrow, line), Layout, Data, Components, Ask, Tools, Record or
  React. A connector or a flowchart shape is a diagram tool: livediagram's.
- **On the strip, the category bar** ([Toolbar layout](../007-editor/toolbar-layout.md#the-category-bar)) shows
  **Write, Frame · Navigate, Selection Mode · Icons, Stickers, Media**: no Popular, no Session category.
- The Toolbar strip's **Search** finds only what the palette offers: an element livehuddle no longer offers is not
  placed from anywhere ([Toolbar layout](../007-editor/toolbar-layout.md#search-every-element-type)).
- A **Participant** gets sticky notes, text and an image, as before ([Share roles](#share-roles)).

## The Session strip

`sessionStripTools(mode)` gives **Timer** and **Vote** on every tab ([Session tools](session-tools.md)). Poll leaves
with the other Collaborate tools.

- The quick vote is the dot vote: dots on the sticky notes, images and link cards in a room, with
  [vote privacy](session-tools.md#vote-privacy) and [layer scope](vote-layer-scope.md) as they are.
- A popover whose button leaves (the tool ending) closes.
- No Session button element: the strip starts both tools.

## Templates

The catalogue is **Blank Space** and the four Spaces, `virtual-office`, `coworking-space`, `team-pod` and
`all-hands-hall` ([Virtual Office template](virtual-office-template.md), [Templates by
mode](../007-editor/templates-by-mode.md)). Every template opens on a meeting board. The Spaces use only what stays:
the office pieces, furniture, a Walk In button, Bring Focus, sticky notes, text and a sticker.

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
| **Participant** | Walks, sits, talks and hears; sticky notes, text and an image; casts dots in a running vote              |
| **Viewer**      | Walks, sits, talks and hears; no palette; sees a running timer and vote read-only                        |

Every gate reads the session's `can`, never `isReadOnly` alone. A locked tab behaves for an editor as for a viewer.

## Agents, MCP and the CLI

- `'workshop'` is the stored `opensIn` everywhere a mode is read (the api's creation intent, tab stats, the OpenAPI
  `EditorMode` enum); every other stored value reads as it.
- No tool takes a mode. A template, or `blank-session`, makes a meeting board like any other. `list_templates` and
  the CLI list the five templates.
- The element kinds an agent may add are the meeting palette's ([Not in livehuddle](../002-project-scope/not-in-livehuddle.md),
  part 4).

## Workspace

- **Default folders:** the `mode:workshop` key, labelled **Spaces** (noun "spaces")
  ([Default folders](../013-workspace/default-folders.md)).
- **Explorer filters:** no Opens In filter: there is one mode ([Explorer filters](../013-workspace/explorer-filters.md)).

## Telemetry

- No mode-switch events: there is nothing to switch.
- The events of a leaving tool (poll, Q&A, quiz, deck) stop with its code; the telemetry dashboard drops their rows
  ([Telemetry](../017-telemetry/telemetry.md)).

## Help

- No Workshop mode article and no Workshop tour. The Session tools article covers the Timer and the quick vote; the
  Avatar tour is the one guided tour of a Space.
- Help articles for what leaves are removed in the part that removes it, with redirects to the nearest article that
  stays ([Help app](../018-help/help-app.md)).

## Existing tabs

- A tab stored with any mode reads as a meeting board ([Editor modes](../007-editor/editor-modes.md#where-the-mode-lives)).
- A stored element of a leaving kind is kept and drawn ([Not in livehuddle](../002-project-scope/not-in-livehuddle.md#a-space-that-already-holds-a-leaving-element)).
