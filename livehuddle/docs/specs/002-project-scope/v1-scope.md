# v1 scope

Status: **proposed**, awaiting the owner's approval (Work Tracker #99).

What livehuddle's first release holds, what it leaves out, and which apps it ships. Every feature named here comes
over from livediagram at the fork and **behaves as livediagram's spec says** unless this page says otherwise; the
forked spec then becomes livehuddle's own ([Build plan](../005-project-roadmap/build-plan.md)). livediagram keeps all
of it ([What livediagram keeps](../005-project-roadmap/build-plan.md#what-livediagram-keeps)).

## Domain language

| Term            | Means                                                                                                        | Not                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| **space**       | What a person makes, opens and shares in livehuddle: tabs of boards, stored as one document                  | a Spaces template; a room; a document (the API's word) |
| **board**       | One tab of a space: a canvas in Workshop's look                                                              | a liveplanner board of cards                           |
| **room**        | The [Room](../../../../livediagram/docs/specs/009-elements/office.md#room) element, walls with a doorway     | the realtime room (the Durable Object everyone joins)  |
| **character**   | A person's figure in [Avatar mode](../../../../livediagram/docs/specs/008-canvas/avatar-mode.md)             | their profile picture, the Avatar element tile         |
| **session**     | The activity a group runs on a board (a retro, a stand-up, a quiz); never a stored thing                     | a meeting call; a share session                        |
| **facilitator** | Whoever holds the baton ([Facilitator](../../../../livediagram/docs/specs/012-collaboration/facilitator.md)) | anyone who opened the space first                      |

"Space" is the recommended noun; [Open decisions](../005-project-roadmap/open-decisions.md) D6 leaves it to the
owner. The API keeps the word `document` for a space (as livediagram and livedocuments do), so the platform's
`apiNoun` types need no change.

## v1 features

### 1. Avatar mode, first-class

All of [Avatar mode](../../../../livediagram/docs/specs/008-canvas/avatar-mode.md): the character and its Avatar
panel (gender, clothing, hair, size, randomise), walking by click, tap and arrow keys, hopping, the five Behaviours
and five Reactions with their keys, Status (Available, Focusing, In a Meeting, Away), speech bubbles and the
composer, pushing, sitting ([Chair](../../../../livediagram/docs/specs/009-elements/chair.md)), drinks, fences and
room walls, the follow camera, and the realtime `avatar`, `avatar-push` and `avatar-say` presence ops.

What changes in livehuddle (recommended, [Open decisions](../005-project-roadmap/open-decisions.md) D7):

- **The picker offers Avatar.** In livediagram the walk is reachable only through a
  [Selection Mode button](../../../../livediagram/docs/specs/009-elements/mode-button.md) on the board, because a
  diagram tool should not push a character at someone drawing. In a meeting app walking is the point, so the
  Selection Mode picker lists **Avatar** beside Select and Hand, and the Selection Mode button still works.
- **A Spaces board opens walking.** A space made from a Spaces template enters Avatar mode on first open, on the
  board's [Avatar Pad](../../../../livediagram/docs/specs/009-elements/avatar-pad.md), for every role.
- Everything else is livediagram's rule, read-only canvas while walking included.

### 2. The Navigate elements

Every tile of Workshop's **Navigate** category, and the office pieces the palette lists with them: Portal
([Portal element](../../../../livediagram/docs/specs/009-elements/portal-element.md)), Bring Focus
([Bring Focus](../../../../livediagram/docs/specs/012-collaboration/bring-focus.md)), Chair, Desk and Sofa
([Chair](../../../../livediagram/docs/specs/009-elements/chair.md)), Fence
([Fence](../../../../livediagram/docs/specs/009-elements/fence.md)), Avatar Pad
([Avatar Pad](../../../../livediagram/docs/specs/009-elements/avatar-pad.md)), Link card
([Link cards](../../../../livediagram/docs/specs/009-elements/link-cards.md)), and Room, Meeting Table, Plant,
Bookshelf, Water Cooler, Coffee Machine and Rug ([Office](../../../../livediagram/docs/specs/009-elements/office.md)).
With them come the Selection Mode buttons and the five
[Reaction pads](../../../../livediagram/docs/specs/009-elements/reaction-pad.md).

### 3. The Spaces templates

[Virtual Office, Coworking Space, Team Pod and All-Hands Hall](../../../../livediagram/docs/specs/012-collaboration/virtual-office-template.md),
unchanged, as the **first** row of livehuddle's start screen and template picker rather than a group after Meetings.

### 4. All of Workshop mode, as the only mode

[Workshop mode](../../../../livediagram/docs/specs/012-collaboration/workshop-mode.md) is livehuddle's one editor
mode, so there is no mode switch and no mode in the interface: every board is a Workshop board.

- **The palette** is Workshop's: Popular; Shapes, My shapes, Write, Draw; Layout; Ask, Tools, Record, React,
  Selection Mode, Navigate; Icons, Stickers, Media; Data.
- **The Session strip**, with Timer, Vote and Poll
  ([Session tools](../../../../livediagram/docs/specs/012-collaboration/session-tools.md)).
- **Every Collaborate element**: dot vote, live poll, quiz, the estimate scales, temperature check, idea box, Q&A
  board; timer, stopwatch, reveal zone, done check, picker; comment panel, action card, agenda, decision record, roll
  call; the reaction pads.
- **Facilitation**: the [facilitator baton](../../../../livediagram/docs/specs/012-collaboration/facilitator.md),
  Bring Focus, hide-cursors votes.
- **The session templates**: the retrospectives, town hall, lean coffee, crazy eights, meeting agenda, workshop board,
  brainstorm, the dot-vote boards, the fill-in-together boards, and the
  [quizzes and games](../../../../livediagram/docs/specs/012-collaboration/quiz-and-game-templates.md), plus Blank
  Workshop as livehuddle's blank ("Untitled Space").

Why all of it ([Open decisions](../005-project-roadmap/open-decisions.md) D2): the card asks for a product built
around workshops and meetings, the All-Hands Hall needs Bring Focus, a Team Pod's stand-up wants a timer, and a
facilitator who has to go back to livediagram for a vote has been sent away from the meeting.

### 5. Collaboration

Realtime editing with per-element merge and an ordered room, live cursors and selections, the presence stack,
[follow-me](../../../../livediagram/docs/specs/012-collaboration/follow-me-viewport.md), comments with
[mentions](../../../../livediagram/docs/specs/012-collaboration/comment-mentions.md),
[assigned actions](../../../../livediagram/docs/specs/012-collaboration/assigned-actions.md), the laser and the
spotlight. All as livediagram has them.

### 6. Workspace, identity and the platform

- Spaces are filed and found in the One Explorer
  ([One Explorer](../../../../liveworkspace/docs/specs/004-index/one-explorer.md)), with folders, favourites, the
  Trash and teams.
- Share links at the three levels ([Share roles](../013-workspace/share-roles.md)), with expiry and passwords as
  livediagram has them.
- Guest access and liveworkspace sign-in ([Accounts](../../../../liveworkspace/docs/specs/003-accounts/accounts.md)).
- Images through the platform's media service, anonymous telemetry through the platform's telemetry
  ([Platform registration](../016-platform/platform-registration.md)).
- The [Timeline](../../../../livediagram/docs/specs/013-workspace/timeline.md), undo and redo.

## Non-goals for v1

Each is cut at the fork. "Later" means it can come back by its own spec change; "Not here" means it belongs to
another product.

| Left out                                                        | Why                                                                                                                     | When            |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | --------------- |
| Diagram and Draw modes, Diagrams, Concepts, Technology, Devices | Building diagrams is livediagram's job. Workshop's Draw category (pencil, highlighter) stays                            | Not here        |
| Event Storming boards                                           | A diagram kind with its own rules; livediagram's                                                                        | Not here        |
| Pages, slides, presenting as a deck                             | livedocuments'                                                                                                          | Not here        |
| Repositories, the Drive mirror                                  | Neither serves a meeting; both carry platform wiring livehuddle does not need yet                                       | Later           |
| Offline Mode (This Browser)                                     | A space is for meeting in, which needs the room; a space kept in one browser has nobody else in it                      | Later, if asked |
| The Community (publishing a space, the gallery)                 | A gallery of offices is worth having once there are spaces worth showing                                                | Later           |
| The MCP server and the CLI                                      | Recommended after v1 ([Open decisions](../005-project-roadmap/open-decisions.md) D3)                                    | v1.1            |
| Audio calls, video calls, screen sharing                        | Need media infrastructure (TURN, an SFU) the stack does not have ([Future work](../005-project-roadmap/future-work.md)) | Next            |
| Calendar invites, recordings, transcripts                       | Each is a product of its own; none is asked for                                                                         | Not planned     |
| A paid tier                                                     | No liveworkspace product has one                                                                                        | Never           |

## The apps livehuddle ships

In the shape of every liveworkspace product, under `livehuddle/apps/` ([Apps and storage](../003-system-architecture/apps-and-storage.md)):

| App         | v1  | What it is                                                                                |
| ----------- | --- | ----------------------------------------------------------------------------------------- |
| `editor`    | Yes | The Next.js editor (livediagram's `apps/editor`, cut down)                                |
| `api`       | Yes | The API Worker and the realtime room: one Durable Object per space                        |
| `router`    | Yes | The Worker in front of every app on livehuddle.app, as every product's router             |
| `marketing` | Yes | The landing page, built on `@liveworkspace/marketing-site`                                |
| `help`      | Yes | The help centre, built on `@liveworkspace/help-site`, with the articles for what v1 holds |
| `mcp`       | No  | Recommended for v1.1 (D3)                                                                 |
| `cli`       | No  | Recommended for v1.1 (D3)                                                                 |
| `community` | No  | Later, with the Community                                                                 |
