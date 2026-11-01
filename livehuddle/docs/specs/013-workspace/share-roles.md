# Share roles

Status: **proposed**, awaiting the owner's approval (Work Tracker #99).

livehuddle has the three access levels every liveworkspace product has, with livediagram's meaning
([Share roles](../../../../livediagram/docs/specs/013-workspace/share-roles.md)): **Editor** (`edit`),
**Participant** (`participate`) and **Viewer** (`view`). The levels are a ladder: each holds everything below it.
Ownership is not a level. The wire names and the ladder come from `@liveworkspace/api-schema`
(`packages/api-schema/src/access-levels.ts`), so livehuddle adds nothing to them.

In a meeting app the three read naturally:

- **Editor**: the host. Builds and rearranges the space, runs the session.
- **Participant**: an attendee. Walks, talks, votes, answers, writes stickies, never reshapes the space.
- **Viewer**: an observer. Walks and watches, takes no part that writes or speaks.

## Feature by feature (v1)

| Feature                                            | Editor | Participant | Viewer | From                                                                                                          |
| -------------------------------------------------- | ------ | ----------- | ------ | ------------------------------------------------------------------------------------------------------------- |
| Walk, hop, Behaviours, Reactions, Status           | Yes    | Yes         | Yes    | [Avatar mode](../../../../livediagram/docs/specs/008-canvas/avatar-mode.md): presence, any role               |
| Speak in a speech bubble                           | Yes    | Yes         | No     | [Who may speak](../../../../livediagram/docs/specs/008-canvas/avatar-mode.md#who-may-speak)                   |
| Push another character, sit, take a drink          | Yes    | Yes         | Yes    | [Office](../../../../livediagram/docs/specs/009-elements/office.md#share-roles)                               |
| Go through a portal, follow and be followed        | Yes    | Yes         | Yes    | [Portal element](../../../../livediagram/docs/specs/009-elements/portal-element.md)                           |
| Place, move, rename or delete Navigate elements    | Yes    | No          | No     | [Office](../../../../livediagram/docs/specs/009-elements/office.md#share-roles)                               |
| Make a space or a board from a template            | Yes    | No          | No     | [Virtual Office](../../../../livediagram/docs/specs/012-collaboration/virtual-office-template.md#share-roles) |
| Press Bring Focus                                  | Yes    | No          | No     | [Bring Focus](../../../../livediagram/docs/specs/012-collaboration/bring-focus.md)                            |
| Start, end, reveal or configure a session tool     | Yes    | No          | No     | [Share roles](../../../../livediagram/docs/specs/013-workspace/share-roles.md#what-a-participant-changes)     |
| Take part in a session tool (vote, answer, react)  | Yes    | Yes         | No     | as above                                                                                                      |
| Hold the facilitator baton                         | Yes    | No          | No     | [Facilitator](../../../../livediagram/docs/specs/012-collaboration/facilitator.md)                            |
| Add, write and arrange stickies and text           | Yes    | Yes         | No     | [Share roles](../../../../livediagram/docs/specs/013-workspace/share-roles.md#what-a-participant-changes)     |
| Comment, reply, resolve                            | Yes    | Yes         | No     | [Share roles](../../../../livediagram/docs/specs/013-workspace/share-roles.md)                                |
| Pan, zoom, laser, spotlight, export                | Yes    | Yes         | Yes    | [Share roles](../../../../livediagram/docs/specs/013-workspace/share-roles.md)                                |
| Change tabs, the theme, anything on the board else | Yes    | No          | No     | [Share roles](../../../../livediagram/docs/specs/013-workspace/share-roles.md)                                |

- **Avatar first-class changes no gate.** The picker's Avatar entry and a Spaces board opening walking
  ([v1 scope](../002-project-scope/v1-scope.md) feature 1) are offered to every role, because walking writes
  nothing.
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
room's refusal of a Viewer's speech, reaction and answer.
