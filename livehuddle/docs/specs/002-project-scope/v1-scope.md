# v1 scope

Status: **approved, being built** (approved on Work Tracker #99; folded back to the code with Work Tracker #190;
refocused on meeting by Work Tracker #423, whose parts remove what [Not in livehuddle](not-in-livehuddle.md) lists).

What livehuddle's first release holds, what it leaves out, and which apps it ships. Every feature named here comes
over from livediagram at the fork and **behaves as its forked spec in this tree says** unless this page says otherwise;
each links to livehuddle's own copy ([Build plan](../005-project-roadmap/build-plan.md)). livediagram keeps all
of it ([What livediagram keeps](../005-project-roadmap/build-plan.md#what-livediagram-keeps)).

## Domain language

| Term            | Means                                                                                       | Not                                                    |
| --------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| **space**       | What a person makes, opens and shares in livehuddle: tabs of boards, stored as one document | a Spaces template; a room; a document (the API's word) |
| **board**       | One tab of a space: a floor to meet on                                                      | a liveplanner board of cards                           |
| **room**        | The [Room](../009-elements/office.md#room) element, walls with a doorway                    | the realtime room (the Durable Object everyone joins)  |
| **character**   | A person's figure in [Avatar mode](../008-canvas/avatar-mode.md)                            | their profile picture, the Avatar element tile         |
| **session**     | The meeting a group holds on a board (a stand-up, an all-hands); never a stored thing       | a meeting call; a share session                        |
| **facilitator** | Whoever holds the baton ([Facilitator](../012-collaboration/facilitator.md))                | anyone who opened the space first                      |

"Space" is the noun, settled as D6 (a) in [Open decisions](../005-project-roadmap/open-decisions.md)
([Domain language](../003-system-architecture/domain-language.md#space)). The API keeps the word `document` for a space (as livediagram and livedocuments do), so the platform's
`apiNoun` types need no change.

## v1 features

### 1. Avatar mode, first-class

All of [Avatar mode](../008-canvas/avatar-mode.md): the character and its Avatar
panel (gender, clothing, hair, size, randomise), walking by click, tap and arrow keys, hopping, the five Behaviours
and five Reactions with their keys, Status (Available, Focusing, In a Meeting, Away), speech bubbles and the
composer, pushing, sitting ([Chair](../009-elements/chair.md)), drinks, fences and
room walls, the follow camera, and the realtime `avatar`, `avatar-push` and `avatar-say` presence ops.

What changes in livehuddle (settled as D7 (a) in [Open decisions](../005-project-roadmap/open-decisions.md);
the rules in [Avatar mode](../008-canvas/avatar-mode.md#where-it-lives)):

- **The picker offers Avatar.** In livediagram the walk is reachable only through a
  [Selection Mode button](../009-elements/mode-button.md) on the board, because a
  diagram tool should not push a character at someone drawing. In a meeting app walking is the point, so the
  Selection Mode picker lists **Avatar** beside Select and Hand, and the Selection Mode button still works.
- **A Spaces board opens walking.** A tab that offers the walk (it holds an
  [Avatar Pad](../009-elements/avatar-pad.md), as every Spaces template does at its entrance, or a Selection Mode
  button set to Avatar, and something besides its pads) puts you in Avatar mode the first time it is shown in a
  visit, for every role: on its pad when it has one, otherwise just below its first such button. Leaving the mode
  is yours to keep for the rest of the visit.
- Everything else is livediagram's rule, read-only canvas while walking included.

### 2. The Space elements

Every tile of the four Space categories (Travel, Seats, Rooms, Perks; [The Space categories](../010-palette/palette-top-level-categories.md#the-space-categories)): Portal
([Portal element](../009-elements/portal-element.md)), Bring Focus
([Bring Focus](../012-collaboration/bring-focus.md)), Chair, Desk and Sofa
([Chair](../009-elements/chair.md)), Fence
([Fence](../009-elements/fence.md)), Avatar Pad
([Avatar Pad](../009-elements/avatar-pad.md)), and Room, Meeting Table, Plant,
Bookshelf, Water Cooler, Coffee Machine and Rug ([Office](../009-elements/office.md)).
With them comes the Avatar [Selection Mode button](../009-elements/mode-button.md), in Travel.

### 3. The Spaces templates

[Twenty-five Spaces in eight categories](../012-collaboration/virtual-office-template.md) (Campus, Events, Games
Rooms, Homes, Office, Outdoor, Recreation and Venues), with Blank Space, are the whole catalogue (Work Tracker #423; [Templates by mode](../007-editor/templates-by-mode.md)).

### 4. The meeting board: light content and light meeting tools

Every tab is a meeting board, livehuddle's one editor mode, stored as `'workshop'`
([Workshop mode](../012-collaboration/workshop-mode.md)); the interface never names a mode.

- **The palette** is the meeting palette: Popular; Write (Text, Sticky note); Rooms, Seats, Perks,
  Play, Garden, Meet; Travel; Stickers ([Workshop mode](../012-collaboration/workshop-mode.md#the-palette)).
- **The Timer and Stopwatch** pieces in the Meet category ([Timer and Stopwatch](../009-elements/timer-and-stopwatch.md)).
  The Session strip left: its Timer for these pieces ([Not in livehuddle](not-in-livehuddle.md#the-session-strips-timer)),
  its quick vote before it ([Not in livehuddle](not-in-livehuddle.md#the-vote)).
- **Facilitation**: the [facilitator baton](../012-collaboration/facilitator.md), Bring Focus and follow-me.

Why only these (owner, 2026-11-04, Work Tracker #423): livehuddle is about meeting in Spaces, not workshops. A Team
Pod's stand-up wants a timer and the All-Hands Hall needs Bring Focus;
the rest of Workshop mode (polls, quizzes, Q&A, agendas, reveals, the retros and workshops) is livediagram's, as are
the diagram tools ([Not in livehuddle](not-in-livehuddle.md)). This replaces "all of Workshop mode", D2 in
[Open decisions](../005-project-roadmap/open-decisions.md).

### 5. Collaboration

Realtime editing with per-element merge and an ordered room, live cursors and selections, the presence stack,
[follow-me](../012-collaboration/follow-me-viewport.md), comments with
[mentions](../012-collaboration/comment-mentions.md),
[assigned actions](../012-collaboration/assigned-actions.md). All as livediagram has them, but the laser and the
spotlight, which are not in livehuddle ([Not in livehuddle](not-in-livehuddle.md#the-presenting-tools-isometric-and-zen)).

### 6. Workspace, identity and the platform

- Spaces are filed and found in the One Explorer
  ([One Explorer](../../../../liveworkspace/docs/specs/004-index/one-explorer.md)), with folders, favourites, the
  Trash and teams.
- Share links at the three levels ([Share roles](../013-workspace/share-roles.md)), with expiry and passwords as
  livediagram has them.
- Guest access and liveworkspace sign-in ([Accounts](../../../../liveworkspace/docs/specs/003-accounts/accounts.md)).
- Images through the platform's media service, anonymous telemetry through the platform's telemetry
  ([Platform registration](../016-platform/platform-registration.md)).
- Google Drive sync for signed-in people, liveworkspace's for every app
  ([Google Drive sync](../../../../liveworkspace/docs/specs/005-drive/drive.md)): each Space they own is a
  `.livehuddle` file in their Drive, kept in step (owner, 2026-11-02).
- The [Timeline](../013-workspace/timeline.md), undo and redo.

### 7. The platform-wide features

livehuddle keeps every feature the platform gives all its apps, and cuts only what is livediagram's own (owner,
2026-11-02; [Open decisions](../005-project-roadmap/open-decisions.md) D3 settled as (b)):

- **Offline Mode** ([Offline Mode](../006-document/offline-mode.md)): a Space kept in This Browser, a guest's default,
  with Take Offline and Sync Space to move it either way, and the prompt that offers to move This Browser's Spaces into
  the account after signing in.
- **Google Drive sync** (above), the platform service
  ([Google Drive sync](../../../../liveworkspace/docs/specs/005-drive/drive.md)).
- **The Community** ([Community](../025-community/community.md)): publishing a Space to the gallery at
  `/community`, on the platform's Community service, filed under its template categories, its best also shown in
  Start a Space.
- **The REST API and API tokens** ([Public API and tokens](../015-api/public-api-and-tokens.md)): a script finds,
  reads, creates and changes Spaces. The MCP server and the CLI went later
  ([Not in livehuddle](not-in-livehuddle.md#the-mcp-server-the-cli-and-workbenches)).

## Non-goals for v1

Each is cut at the fork. "Later" means it can come back by its own spec change; "Not here" means it belongs to
another product.

| Left out                                                        | Why                                                                                                                                                                         | When        |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| Diagram and Draw modes, Diagrams, Concepts, Technology, Devices | Building diagrams is livediagram's job. Workshop's Draw category leaves with #423 too                                                                                       | Not here    |
| Event Storming boards, the wall-photo import                    | A diagram kind with its own rules; livediagram's                                                                                                                            | Not here    |
| Pages, slides, presenting as a deck                             | livedocuments' (decks and presenting stay in livediagram's Workshop mode)                                                                                                   | Not here    |
| Retros, workshops, quizzes and games, the Collaborate elements  | Running a workshop is livediagram's Workshop mode (Work Tracker #423, [Not in livehuddle](not-in-livehuddle.md))                                                            | Not here    |
| Shapes, arrows, drawing, layout containers, tables, charts      | Diagram tools; livediagram's. A Space keeps sticky notes, text and stickers                                                                                                 | Not here    |
| Repositories                                                    | Doesn't serve a meeting; carries platform wiring livehuddle does not need yet                                                                                               | Later       |
| Audio calls, video calls, screen sharing                        | Built on Cloudflare Realtime ([Proximity audio](../012-collaboration/proximity-audio.md)), on wherever its secrets are set, under the calls kill switch (Work Tracker #316) | Built       |
| Calendar invites, recordings, transcripts                       | Each is a product of its own; none is asked for                                                                                                                             | Not planned |
| A paid tier                                                     | No liveworkspace product has one                                                                                                                                            | Never       |

## The apps livehuddle ships

In the shape of every liveworkspace product, under `livehuddle/apps/` ([Apps and storage](../003-system-architecture/apps-and-storage.md)):

| App         | v1  | What it is                                                                                |
| ----------- | --- | ----------------------------------------------------------------------------------------- |
| `editor`    | Yes | The Next.js editor (livediagram's `apps/editor`, cut down)                                |
| `api`       | Yes | The API Worker and the realtime room: one Durable Object per space                        |
| `router`    | Yes | The Worker in front of every app on livehuddle.app, as every product's router             |
| `marketing` | Yes | The landing page, built on `@liveworkspace/marketing-site`                                |
| `help`      | Yes | The help centre, built on `@liveworkspace/help-site`, with the articles for what v1 holds |
| `mcp`       | No  | Shipped at launch, removed later (Work Tracker #562, not-in-livehuddle.md)                |
| `cli`       | No  | Shipped at launch, removed later (Work Tracker #563, not-in-livehuddle.md)                |
| `community` | Yes | The Community gallery at `/community`, on the platform's Community service (D3)           |
