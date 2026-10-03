# Share roles

**Status: specified, not built.**

Everyone who reaches a document without owning it, by a share link, an embed or an API token, does so in one of
three **roles**: **view**, **comment** or **edit**, the levels people know from Google Docs. Before this there were
two, `view` and `edit`, and a view link could already comment and take part in a session, so there was no way to
let someone only look, and a read-only token could not be told apart from a viewer who comments.

## The roles

| Role        | May                                                                                                                                                                                    | May not                                                  |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| **view**    | Open and read every tab it admits, pan, zoom, follow someone, be seen in the presence stack                                                                                            | Comment, take part in a session, change anything         |
| **comment** | All of view; add, reply to, resolve and reopen comments; take part in a session: dot votes, polls, the Q&A board, estimates, temperature checks, the idea box, the Done check, quizzes | Change elements, tabs, the document or its sharing       |
| **edit**    | All of comment; change the content                                                                                                                                                     | Manage share links, delete the document (owner and team) |

- The owner and joined team members always hold edit, as today.
- Taking part in a session sits with commenting: both are saying something without changing the drawing.
- Every gate checks the role on the server: the comment and Q&A endpoints and the room's op gate admit comment and
  edit and refuse view, and every content write admits edit only. The editor's controls follow the role, never the
  other way round.

## Share links

- The Share dialog offers three role cards, **Editor** ("Draws with you in real time."), **Commenter** ("Comments and
  takes part. Can't change the drawing.") and **Viewer** ("Watches, pans and zooms. Can't comment or change a
  thing."), and a pass's stub prints `EDITOR`, `COMMENTER` or `VIEWER` in its role's colour: brand, teal, violet
  ([Live app](../007-editor/live-app.md#share-dialog)).
- `POST /api/documents/:id/share` takes `role: 'view' | 'comment' | 'edit'`; an omitted role is edit, as today.
- The editor's role pill reads Editing, Commenting or Viewing.
- An embed of a view link is a read-only viewer; of a comment link, a viewer that can comment
  ([Embeds](embeds.md)).

## API tokens

A token carries a role instead of the read-only flag ([Public API and API tokens](../015-api/public-api-and-tokens.md)):
**view** (the former read-only), **comment** (comments and agent presence, no changesets) or **edit** (the former
full access). The MCP consent screen and the Settings token composer offer the three; edit is the default. A token
never manages sharing, teams, tokens or the account, whatever its role.

## Moving to three roles

- Every existing `view` share link becomes **comment**, so nobody who holds a link loses anything they could do.
- Every read-only token becomes **view**, every other token **edit**, so no token gains anything.
- One D1 migration does both. Until the change ships, other specs' "view role" describes what becomes the comment
  role; they are renamed in the same change as the code.
- An editor bundle loaded before the deploy that creates a `view` link creates a look-only link; the new-version
  prompt ([New version prompt](../016-platform/new-version-prompt.md)) bounds that window.

## Telemetry

`Document·Shared` and `Document·Joined` gain the type `Comment` beside `Edit` and `View`; existing `View` counts
stay as they were, since those links become comment links ([Telemetry](../017-telemetry/telemetry.md)).
