# Share roles

Status: **built** (approved on Work Tracker #99; folded back to the code with Work Tracker #190).

livehuddle has the three access levels every liveworkspace product has, with livediagram's meaning
([Share roles](../../../../livediagram/docs/specs/013-workspace/share-roles.md)): **Editor** (`edit`),
**Participant** (`participate`) and **Viewer** (`view`). The levels are a ladder: each holds everything below it.
Ownership is not a level. The wire names and the ladder come from `@liveworkspace/api-schema`
(`packages/api-schema/src/access-levels.ts`), so livehuddle adds nothing to them.

In a meeting app the three read naturally:

- **Editor**: the host. Builds and rearranges the space, runs the session.
- **Participant**: an attendee. Walks, talks, comments, reacts and uses the pieces (pins a note, swings a door, plays
  the Jukebox), never adds to or reshapes the space.
- **Viewer**: an observer. Walks and watches, takes no part that writes or speaks.

## What a new share offers

livehuddle offers **Editor** and **Participant** only, and a new share starts as **Participant**: a space is shared
to bring people into a meeting, where everyone should be able to speak, comment and use the room's pieces. Viewer stays a level
(the ladder and the gates below are unchanged), but nothing new grants it.

- **The Share dialog** (the shared one, in the editor and in the Explorer) lists Editor then Participant in its
  role picker, with Participant chosen when it opens. The levels and the default are livehuddle's entry in the
  platform's per-app table (`APP_LINK_LEVELS`, `APP_DEFAULT_LINK_LEVEL`,
  [Sharing and access](../../../../liveworkspace/docs/specs/004-index/one-explorer-contracts.md#sharing-and-access)),
  so the other products keep all three and Editor to start.
- **The api and the MCP refuse a new Viewer link** rather than quietly making a Participant one: `POST
/api/documents/:id/share {role: "view"}` answers 400 `level_not_offered`, and the index does the same for a
  link made straight on it. A script or an agent that asks for a look-only link learns that livehuddle has none,
  instead of handing out a link that lets people speak and write when they were told it would not. A share with no
  role is Participant. The MCP's `share_document` offers `participate` (the default) and `edit` only.

### Legacy Viewer links

A Viewer link made before this change keeps working exactly as it did: it still opens the space as a Viewer, every
gate below still applies to it, and nobody already in through one is sent away. In the Share dialog its pass reads
**Viewer (Legacy)** in its band, so the owner can tell it apart; they revoke it and issue a Participant pass to move
its people up (passes have no level control in any product). Rescoping a legacy link to another tab keeps it a
Viewer; the index refuses a change to Viewer, never a change away from it.

## Feature by feature (v1)

| Feature                                            | Editor | Participant | Viewer | From                                                                                                          |
| -------------------------------------------------- | ------ | ----------- | ------ | ------------------------------------------------------------------------------------------------------------- |
| Walk, hop, Behaviours, Reactions, Status           | Yes    | Yes         | Yes    | [Avatar mode](../../../../livediagram/docs/specs/008-canvas/avatar-mode.md): presence, any role               |
| Speak in a speech bubble                           | Yes    | Yes         | No     | [Who may speak](../../../../livediagram/docs/specs/008-canvas/avatar-mode.md#who-may-speak)                   |
| Push another character, sit, take a drink          | Yes    | Yes         | Yes    | [Office](../../../../livediagram/docs/specs/009-elements/office.md#share-roles)                               |
| Go through a portal, follow and be followed        | Yes    | Yes         | Yes    | [Portal element](../../../../livediagram/docs/specs/009-elements/portal-element.md)                           |
| Place, move, rename or delete Space elements       | Yes    | No          | No     | [Office](../../../../livediagram/docs/specs/009-elements/office.md#share-roles)                               |
| Make a space or a board from a template            | Yes    | No          | No     | [Virtual Office](../../../../livediagram/docs/specs/012-collaboration/virtual-office-template.md#share-roles) |
| Press Bring Focus                                  | Yes    | No          | No     | [Bring Focus](../../../../livediagram/docs/specs/012-collaboration/bring-focus.md)                            |
| Start, end, reveal or configure a session tool     | Yes    | No          | No     | [Share roles](../../../../livediagram/docs/specs/013-workspace/share-roles.md#what-a-participant-changes)     |
| Take part in a session tool (answer, react)        | Yes    | Yes         | No     | as above                                                                                                      |
| Hold the facilitator baton                         | Yes    | No          | No     | [Facilitator](../../../../livediagram/docs/specs/012-collaboration/facilitator.md)                            |
| Add, write, arrange or delete stickies and text    | Yes    | No          | No     | [A Participant walks](#a-participant-walks)                                                                   |
| A palette, Undo / Redo, paste, duplicate, delete   | Yes    | No          | No     | [A Participant walks](#a-participant-walks)                                                                   |
| Leave Avatar mode                                  | Yes    | No          | Yes    | [A Participant walks](#a-participant-walks)                                                                   |
| Pin a note on a Notice Board, unpin your own       | Yes    | Yes         | No     | [Social pieces](../009-elements/social-pieces.md#notice-board)                                                |
| Start, pause, reset or set a Timer or Stopwatch    | Yes    | Yes         | No     | [Timer and Stopwatch](../009-elements/timer-and-stopwatch.md#share-roles)                                     |
| Open or close a Door                               | Yes    | Yes         | No     | [Room Builder and Door](../009-elements/room-builder.md#opening-and-closing)                                  |
| Comment, reply, resolve                            | Yes    | Yes         | No     | [Share roles](../../../../livediagram/docs/specs/013-workspace/share-roles.md)                                |
| Pan, zoom, export                                  | Yes    | Yes         | Yes    | [Share roles](../../../../livediagram/docs/specs/013-workspace/share-roles.md)                                |
| Change tabs, the theme, anything on the board else | Yes    | No          | No     | [Share roles](../../../../livediagram/docs/specs/013-workspace/share-roles.md)                                |

- **Avatar first-class changes no gate.** The picker's Avatar entry and a Spaces board opening walking
  ([v1 scope](../002-project-scope/v1-scope.md) feature 1) are offered to every role, because walking writes
  nothing.
- **An Editor and a Viewer can enter and leave Avatar mode on any board**, through the
  [Walk button](../008-canvas/avatar-mode.md#the-walk-button) in the bottom-right cluster, which toggles the mode, so
  a board with no Walk In button, pad or opening walk still lets them walk. An Editor can also pick Avatar on the
  palette strip. A Participant is always walking ([below](#a-participant-walks)).
- **Every gate reads the session's `can`, never `isReadOnly` alone.** Avatar mode makes the canvas read-only for
  everyone in it, so `isReadOnly` cannot tell a Viewer from a walking Editor.
- **The room enforces what the client hides**: it drops a Viewer's `avatar-say`, reaction and answer, and checks an
  Editor's element ops, as livediagram's room does.
- **A locked tab** behaves for an Editor as for a Viewer, as in every product.

## A Participant walks

The owner (2026-11-05): "dont let participants add notes or text elements, they shouldn't have a palette and always
be in avatar mode". A Participant is in a meeting place to meet: it walks, talks, reacts and comments, and it uses the
room's pieces the way anyone in a room would. What a Space holds is the host's.

- **No palette.** A Participant has no palette strip at all: no Participate category (it held Sticky and Text), no
  selection-mode picker, no Search tiles. Its tile keys (`N`, `T`, `8`) go with it, and so do paste, duplicate,
  delete, Undo and Redo, select all and the other edit chords: it gets the Viewer's keys (zoom, search, `Tab`,
  `Escape`) plus the walk's.
- **Always in Avatar mode.** A Participant's canvas opens walking on every Space and every tab, whether or not the
  tab offers the walk ([Opening walking](../008-canvas/avatar-mode.md#opening-walking)), on a phone too. Nothing takes
  it out: there is no Walk button in its cluster (a button that could only ever read pressed is not a control), a
  Selection Mode button draws its face but does not press, an Avatar Pad does not toggle the walk off, and the
  view-tool keys (`V`, `H`) and `Escape` do not leave the mode. Changing tab keeps it walking. Pan and zoom work as
  they do while walking for anyone: the camera follows the character, the zoom controls stay.
- **The pieces it keeps** are piece actions, not content edits: pinning a note on a Notice Board and unpinning its
  own ([Social pieces](../009-elements/social-pieces.md#notice-board)), opening and closing a Door that is not locked
  ([Room Builder and Door](../009-elements/room-builder.md#opening-and-closing)), a Timer or Stopwatch
  ([Timer and Stopwatch](../009-elements/timer-and-stopwatch.md#share-roles)), playing the Jukebox, knocking, sitting,
  drinks, reactions, speech bubbles, comments and session-tool answers, as the table says.
- **Its earlier stickies and text stay as they are.** A Space that holds stickies or text a Participant added before
  this change loads and draws them unchanged, still signed with that Participant's adder key. The Participant can no
  longer write on, move, recolour or remove them (nor anything else on the canvas); an Editor can.
- **The room holds the same line.** The participant content rule (`packages/document/src/participant-content.ts`)
  refuses every add and every remove from a Participant, and on an update keeps every field as stored except a
  Door's `doorClosed` (an unlocked door) and a Notice Board's notes it signs. A refused op comes back with the
  correction that puts the sender's screen right, as before.
- **The Viewer is unchanged.** A Viewer still chooses to walk with the Walk button, and leaves the mode the same way.
- **Previewing as a Participant** (an Editor's role pill) shows exactly this: no palette, walking, no way out until
  the preview ends.

## Future features

Audio, video and screen sharing get their own rows when they are specified
([Future work](../005-project-roadmap/future-work.md#share-roles)). The proposal there: every role may listen and
watch, a Participant and an Editor may unmute and turn on a camera, and only an Editor may share a screen or mute
someone else.

## Tests

Each feature ships role tests, as every product's do: one per level for each gate in the table, including the
room's refusal of a Viewer's speech, reaction and answer. The Viewer cases now cover legacy Viewer links only, and
the share tests hold the offer: the dialog lists Editor and Participant with Participant chosen, and the api, the
index and the MCP refuse a new Viewer link while a legacy one still resolves as a Viewer. The table is held whole by two matrices, one row per gate
and one case per level: the room's (`apps/api/src/share-roles.test.ts`: the op gate, the participant content rule and
the baton) and the editor's (`apps/editor/lib/share-roles.test.ts`: `can`, the session gates read from it, the
palettes and the selection modes). A row added here gets its cases in both.

- **The editor's Editor-only gates read `can`.** Running a session tool, Bring Focus and the template start ask
  `roleGates(can, runBlocked)` (`apps/editor/lib/editor-capabilities.ts`): `run` (an Editor, and the facilitator's
  while someone holds the baton), `shape` (an Editor) and `takePart` (an Editor or a Participant).
- **A Participant changes no element** but through a piece: a Notice Board's notes (it adds notes signed with its
  own adder key and removes those, and the participant content rule keeps every other note as stored) and a Door's
  open or closed state (`doorClosed`: it opens and closes any Door that is not locked, and nothing else about it).
  Every other field of every element, its own earlier stickies and text included, stays as stored.
