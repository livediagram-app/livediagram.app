# Share roles

**Status: specified, not built.**

Everyone who reaches a document without owning it, by a share link, an embed or an API token, does so at one of
three **access levels**: **Viewer**, **Participant** or **Editor**. **Ownership** is not a level: it is a set of
powers over the document, held apart from editing. The research behind this is in `docs/research/access-levels/`.

## Why

Before this there were two link roles, `view` and `edit`. A view link could comment, answer live polls and use the
Q&A board, but could not cast a dot, estimate, use a temperature check, mark the Done check, drop an idea or answer a
quiz. The line fell where the transport fell (a REST door or a presence op versus an element mutation), not where
anyone decided it. There was no way to let someone only look, and none to let them take part fully without editing.

## The levels

| Level           | Wire name     | May                                                                                                                                                                                                                                                                 |
| --------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Viewer**      | `view`        | Open and read every tab it admits; pan, zoom, point, use the laser and reactions, follow and be followed, appear in the presence stack, present on their own screen, export. Writes nothing.                                                                        |
| **Participant** | `participate` | All of Viewer; say something without changing the drawing: comment, reply, resolve and reopen; answer live polls; add to and upvote on the Q&A board; cast dots; answer estimate cards, temperature checks, the Done check and quizzes; drop ideas in the idea box. |
| **Editor**      | `edit`        | All of Participant; change the drawing, its tabs and its tools' configuration; hold the facilitator baton.                                                                                                                                                          |

- **The levels are a ladder**: every level holds everything below it.
- **A participant writes only their own answer.** A participation act adds or withdraws the sender's own answer inside
  something someone else opened; it never changes the question, the structure, or another person's answer. The
  server enforces it (see [Integrity](#integrity)).
- **Running a session is facilitation, an Editor's hat**: starting, ending, revealing, clearing and pacing stay with
  editors and the [facilitator baton](../012-collaboration/facilitator.md). A participant takes part and never runs.
- **A checklist tick is editing**: it is one shared value, not a person's answer.
- **Only an Editor's selection holds an element** against other editors; a Viewer's or a Participant's never does.
- **A Viewer is neutral in the room**: it is not in the Done check's waiting list or a roll call's roster.

## Ownership

Ownership is a set of powers, held by the document's **owner**: its creator, or whoever moved it into their own
library. On a team document the owner is still its creator; team-wide ownership (team admins) is out of scope.

| Power                                                          | Owner | Team member | Editor link |
| -------------------------------------------------------------- | ----- | ----------- | ----------- |
| Create, revoke and rescope share links; set the share password | ✓     |             |             |
| Delete to the Trash, restore, purge                            | ✓     | ✓           |             |
| Move between folders and spaces                                | ✓     | ✓           |             |
| Take offline                                                   | ✓     |             |             |
| Take the facilitator baton back                                | ✓     |             |             |

The owner and joined team members also hold the Editor level. Every gate asks two questions, never one: "is the
level at least X?" and "does the caller hold this power?".

## Share links

- The Share dialog offers three role cards: **Editor** ("Draws with you in real time."), **Participant** ("Comments,
  votes and takes part. Can't change the drawing.") and **Viewer** ("Watches, pans and zooms. Can't comment or change a
  thing."). A pass's stub prints `EDITOR`, `PARTICIPANT` or `VIEWER`, each with a glyph and a colour that meets WCAG
  2.2 AA against its word ([Live app](../007-editor/live-app.md#share-dialog)).
- `POST /api/documents/:id/share` takes `role: 'view' | 'participate' | 'edit'`; an omitted role is `edit`, as today.
- The editor's role pill reads Editing, Participating or Viewing.
- **Embeds look only**: an embed of any link below Editor renders as a Viewer, since an embed has no identity screen
  to put a name on a comment or an answer ([Embeds](embeds.md)). An Editor link's embed stays editable.

## API tokens

- A token carries a level instead of the read-only flag: **view**, **participate** or **edit**, offered on the MCP
  consent screen and in the Settings composer; edit is the default.
- A token's level never exceeds its owner's access to a document: it narrows, never widens.
- A participate token may do everything a Participant may, session answers included, answering through
  `POST /api/documents/:id/tabs/:tabId/answers` since an agent holds no socket; an agent acts as its owner
  ([Agent presence](../024-agents/agent-presence.md)).
- An **edit** token also holds its owner's ownership powers, except administration: it may create and manage share
  links (the MCP's `share_document`) and delete to the Trash, but never manages teams, tokens or the account. A view
  or participate token holds none, and never reads a document's share links or password.
- The MCP's `share_document` creates a **Participant** link when no level is named.

## Integrity

- **One answer per person, enforced.** A session below Editor answers under a collaboration key the server derives
  from the caller and the document and hands over in the room ticket; the room pins it at hello and refuses a `vote`,
  `poll-answer`, response or idea from a non-editor that names any other key, so nobody can answer as someone else.
- **Answers persist without an editor.** The room writes a participant's answer to D1 itself, one at a time, with a
  compare-and-swap, as it does for the [Q&A board](../012-collaboration/qa-board.md), so an answer never depends on an
  editor saving the tab.
- **Participation is its own class of room op**, between presence (anyone) and mutation (editors), owned by
  `packages/api-schema` beside the others.

## Moving to three levels

- **Every existing `view` link becomes a Participant link.** Nobody loses anything; they gain the session tools a view
  link could not use. A newly created Viewer link is the first that only looks.
- **Every read-only token becomes a view token; every other token an edit token**, so no token gains anything.
- **No old reader ever sees an unknown level.** An api worker before this change reads any role it does not know as
  edit, so the change ships expand then contract: first every reader (the api, the room, the ticket, the editor)
  learns the new names and reads an unknown one as Viewer; then the data migration and the writers; the legacy values
  go last.

## Telemetry

`Document·Shared` and `Document·Joined` take the type `Participate` beside `Edit` and `View`. Before the migration
`View` meant what is now Participant; the dashboard notes the date ([Telemetry](../017-telemetry/telemetry.md)).

## Domain language

**Participant** is this access level. The `participants` table and its records are a person's **display identity**
(name, colour, picture); prose calls them that, never "participant" ([Domain language](../003-system-architecture/domain-language.md)).
