# Share roles

Status: **built** (approved on Work Tracker #99; folded back to the code with Work Tracker #190).

livehuddle has the three access levels every liveworkspace product has, with livediagram's meaning
([Share roles](../../../../livediagram/docs/specs/013-workspace/share-roles.md)): **Editor** (`edit`),
**Participant** (`participate`) and **Viewer** (`view`). The levels are a ladder: each holds everything below it.
Ownership is not a level. The wire names and the ladder come from `@liveworkspace/api-schema`
(`packages/api-schema/src/access-levels.ts`), so livehuddle adds nothing to them.

In a meeting app the three read naturally:

- **Editor**: the host. Builds and rearranges the space, runs the session.
- **Participant**: an attendee. Walks, talks, comments, writes stickies and reacts, never reshapes the space.
- **Viewer**: an observer. Walks and watches, takes no part that writes or speaks.

## What a new share offers

livehuddle offers **Editor** and **Participant** only, and a new share starts as **Participant**: a space is shared
to bring people into a meeting, where everyone should be able to speak, comment and write a sticky. Viewer stays a level
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
| Add, write and arrange stickies and text           | Yes    | Yes         | No     | [Share roles](../../../../livediagram/docs/specs/013-workspace/share-roles.md#what-a-participant-changes)     |
| Pin a note on a Notice Board, unpin your own       | Yes    | Yes         | No     | [Social pieces](../009-elements/social-pieces.md#notice-board)                                                |
| Comment, reply, resolve                            | Yes    | Yes         | No     | [Share roles](../../../../livediagram/docs/specs/013-workspace/share-roles.md)                                |
| Pan, zoom, export                                  | Yes    | Yes         | Yes    | [Share roles](../../../../livediagram/docs/specs/013-workspace/share-roles.md)                                |
| Change tabs, the theme, anything on the board else | Yes    | No          | No     | [Share roles](../../../../livediagram/docs/specs/013-workspace/share-roles.md)                                |

- **Avatar first-class changes no gate.** The picker's Avatar entry and a Spaces board opening walking
  ([v1 scope](../002-project-scope/v1-scope.md) feature 1) are offered to every role, because walking writes
  nothing.
- **Every role can enter and leave Avatar mode on any board.** An Editor and a Participant use the picker on their
  palette strip; a Viewer, who has no strip, has the [Walk button](../008-canvas/avatar-mode.md#the-walk-button)
  first in the bottom-right cluster, which toggles the mode, so a board with no Walk In button, pad or opening walk
  still lets a Viewer walk.
- **Every gate reads the session's `can`, never `isReadOnly` alone.** Avatar mode makes the canvas read-only for
  everyone in it, so `isReadOnly` cannot tell a Viewer from a walking Editor.
- **The room enforces what the client hides**: it drops a Viewer's `avatar-say`, reaction and answer, and checks an
  Editor's element ops, as livediagram's room does.
- **A locked tab** behaves for an Editor as for a Viewer, as in every product.

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
- **Space elements are Behaviours**, so a Participant neither writes on one nor adds, moves or removes it. The one
  exception is a Notice Board's notes: a Participant adds notes signed with its own adder key and removes those, and
  the participant content rule keeps every other note as stored. A link
  card, which Travel also offers, is not a Behaviour, but its words are its link's, which stay an Editor's with its
  place.
