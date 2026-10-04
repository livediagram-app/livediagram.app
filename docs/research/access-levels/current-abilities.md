# What each identity can do today

Research note for the access-levels design. Read from the code at `main` commit `fc2d2d650`; nothing was changed
or exercised at runtime, so every cell is what the code says, and the few findings marked **(verify)** want a
test before anyone acts on them.

## How access is decided today

Five mechanisms, layered. Every cell below comes from one of them.

| Mechanism             | Where                                                                                                                               | What it decides                                                                                                                                                                                                                                 |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Grant resolution      | `apps/api/src/auth/document-access.ts` `resolveDocumentGrant`, wrapped by `routes/context.ts` `gateRead` / `gateEdit` / `gateGrant` | Personal owner, then joined team member (both `FULL_EDIT`), then a share link for this document plus the share password. Returns `{ role: 'edit' \| 'view', tabScope, shareCode }`. A tab-scoped grant passes only when the door names its tab. |
| Owner-only guards     | `routes/context.ts` `ownsDocument`, `requireOwnedDocument`, `mayDeleteDocument`                                                     | Ownership is separate from the edit grant already: share family and tab linking need the owner; delete, trash and moves need the owner or a joined member.                                                                                      |
| Read-only token choke | `apps/api/src/index.ts` `routeApiRequest`, `if (tokenAuth?.readOnly && isWrite) return forbidden('read_only_token')`                | A read-only token may only `GET` / `HEAD`, on every route.                                                                                                                                                                                      |
| Session-only routes   | `routes/tokens.ts`, `routes/oauth.ts`, `routes/account.ts`, `routes/migrate.ts`, `routes/drive.ts`, `routes/teams.ts` (non-GET)     | Need `ctx.clerkUserId` (a Clerk session), so neither a guest nor any API token can reach them.                                                                                                                                                  |
| Room op gate          | `apps/api/src/document-room.ts` `webSocketMessage`; op classes in `packages/api-schema/src/room-messages.ts`                        | `if (sender.role !== 'edit' && !isPresenceOp) return;` A view session may send only `PRESENCE_OP_KINDS`; `MUTATION_OP_KINDS` need edit; `SYSTEM_OP_KINDS` never come from a socket.                                                             |

The editor mirrors this with two flags: `sessionRole` (`apps/live/app/document/[id]/editor-page-helpers.ts`
`resolveDocumentSession`, owner or link role) and `isReadOnly = !canEdit` (`useEditorState.ts`, from
`useViewPreview`). Almost every control keys off `isReadOnly`; session verbs also key off `runBlocked` (the
facilitator baton, `facilitator.sessionToolsBlocked`).

The room's presence class is wider than its name suggests. `PRESENCE_OP_KINDS` is `cursor`, `select`, `laser`,
`tab-focus`, `poll-answer`, `avatar`, `avatar-push`, `reaction`, `viewport`, `focus-here`, `drag-preview`
(the last re-gated to edit inside `webSocketMessage`). `poll-answer` is the one that writes a result.

## What a view link can do today

The precise answer to the question. A view link (role `view`, all tabs, no account needed) can:

- **Read everything**: the document, every tab, its images and thumbnail, comment threads (others' author ids
  redacted, `redactCommentAuthorIds`), and the document's Timeline feed (`routes/timeline.ts` `canReadScope`).
- **Be present live**: join the room, show a cursor and current tab, appear in the roster with a Viewer badge,
  use the laser and Avatar mode (and shove another avatar), follow and be followed, press Bring focus, present
  slides on their own screen, enter zen, export PNG / SVG / Markdown.
- **Select elements**, which broadcasts a `select` op and so **locks that element for editors**
  (concurrent-selection lock, `usePresenceBroadcast.ts`; `selectElement` in `useSelectionEditing.ts` has no role
  check).
- **Take part, partly**: answer a live poll (`poll-answer` is presence-class; `PollPromptSheet` is shown to every
  role), add a note to a Q&A board and upvote or withdraw an upvote (`routes/qa-board-routes.ts`,
  `isParticipantQaAction` goes through `gateRead`).
- **Comment, partly**: add a comment to any element's unresolved thread from the anchored popover
  (`POST .../tabs/:tabId/comments`, `gateRead`), and delete their own comment (`DELETE .../comments/:id`, author
  check). Not from a comment panel (`commentPanelActions` is undefined when `isReadOnly`).
- **Roll the picker for themselves** (the result is not written, `docs/specs/012-collaboration/picker.md`).
- **Make a copy** of the document into their own files (`routes/documents.ts` `/copy`, a read gate).
- **Be recorded**: their visit seeds "Shared with you" (`routes/share.ts`, `recordSharedAccess`), and the owner's
  Timeline reports their opens and copies.

A view link cannot: cast a dot, answer an estimate card, temperature check, Done check or quiz, drop an idea in
the idea box, tick a checklist, take the roll, press an agenda item, resolve or reopen a thread, delete someone
else's comment, start or end anything, hold the facilitator baton, free a selection lock, edit anything, or touch
sharing, moving, deleting or the Trash. The server would also relay a `reaction` from them, but the editor never
offers it.

So today's view link is already neither a pure Viewer nor a Participant: it is a Viewer that can comment, answer
polls and use the Q&A board, but cannot vote or answer any element-based session tool.

## The identities (columns)

| Column   | Who                                                                                                                                                                    |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Own**  | Owner of a personal document (Clerk session, or a guest by `X-Owner-Id`).                                                                                              |
| **Mem**  | Joined member of the team whose library holds the document. The row owner of a team document is a member like any other, plus the owner-only doors while still joined. |
| **E**    | Edit share link, all tabs.                                                                                                                                             |
| **V**    | View share link, all tabs.                                                                                                                                             |
| **E·t**  | Edit share link scoped to one tab.                                                                                                                                     |
| **V·t**  | View share link scoped to one tab.                                                                                                                                     |
| **EmbE** | `/embed?s=` of an edit link: the editor with `embed` flag, zen-style chrome, no identity screen.                                                                       |
| **EmbV** | `/embed?s=` of a view link.                                                                                                                                            |
| **G**    | Guest (no account) on their own personal document. A guest on someone else's document is simply the link column they arrived through.                                  |
| **FT**   | Full API token, whose Clerk owner is the document's owner or a member. With `X-Share-Code` it takes that link's role instead.                                          |
| **RO**   | Read-only API token, same owner.                                                                                                                                       |
| **MCP**  | The MCP server (`apps/mcp/src/tools.ts`) acting with a full token: 11 tools, no share-code path, no room.                                                              |

Cell legend: **Y** allowed and offered; **N** refused; **T** on its own tab only; **S** the server allows it but
no client offers it; **U** the editor offers it but the server refuses it; **n/a** not meaningful.

## Capability matrix

### Reading and presence

| Ability                                    | Own | Mem | E   | V   | E·t | V·t | EmbE | EmbV | G   | FT  | RO  | MCP | Granted or refused by                                                                        |
| ------------------------------------------ | --- | --- | --- | --- | --- | --- | ---- | ---- | --- | --- | --- | --- | -------------------------------------------------------------------------------------------- |
| Read document and tab list                 | Y   | Y   | Y   | Y   | T   | T   | Y    | Y    | Y   | Y   | Y   | Y   | `documents.ts` GET `/:id` via `gateGrant`, then `redactDocumentForScope`                     |
| Read tab content                           | Y   | Y   | Y   | Y   | T   | T   | Y    | Y    | Y   | Y   | Y   | Y   | `document-subresource-routes.ts` GET via `gateRead(..., tabId)`; others 404 by `deniedOnTab` |
| Images, thumbnail                          | Y   | Y   | Y   | Y   | T   | T   | Y    | Y    | Y   | Y   | Y   | Y   | `images.ts` GET (`gateGrant` plus `documentReferencesImage`); `documents.ts` `/thumbnail`    |
| Public live image of a link                | Y   | n/a | Y   | Y   | T   | T   | Y    | Y    | Y   | Y   | Y   | N   | `share.ts` `handleShareImage`: any live code, refused when a password is set                 |
| Document Timeline feed                     | Y   | Y   | Y   | Y   | N   | N   | Y    | Y    | Y   | Y   | Y   | N   | `timeline.ts` `canReadScope`, `gateRead` with no tab                                         |
| Join the room, receive live ops            | Y   | Y   | Y   | Y   | T   | T   | Y    | Y    | Y   | S   | N   | N   | `document-room-routes.ts`; RO cannot mint a ticket (`POST room-ticket` hits the choke point) |
| Cursor, tab focus, roster badge            | Y   | Y   | Y   | Y   | T   | T   | Y    | Y    | Y   | S   | N   | N   | `document-room.ts` `webSocketMessage`, presence class; `helloPresence` stamps the role       |
| Select (and so lock an element for others) | Y   | Y   | Y   | Y   | T   | T   | Y    | Y    | Y   | S   | N   | N   | `select` is presence-class; `usePresenceBroadcast.ts` sends it for every role                |
| Laser, Avatar mode, shove                  | Y   | Y   | Y   | Y   | T   | T   | Y    | Y    | Y   | S   | N   | N   | presence class; non-mutating tools in `lib/editor-commands.ts` `toolCommands`                |
| Reactions                                  | Y   | Y   | Y   | S   | T   | S   | Y    | S    | Y   | S   | N   | N   | room allows; `EditorCanvasHost.tsx` `onFireReaction={isReadOnly ? undefined : ...}`          |
| Follow, be followed                        | Y   | Y   | Y   | Y   | T   | T   | Y    | Y    | Y   | S   | N   | N   | `viewport` presence class                                                                    |
| Bring focus                                | Y   | Y   | Y   | Y   | T   | T   | Y    | Y    | Y   | S   | N   | N   | `focus-here` presence class; UI gate is `runBlocked` only                                    |
| Present locally, zen, export               | Y   | Y   | Y   | Y   | T   | T   | N    | N    | Y   | n/a | n/a | n/a | client-side; `viewSafe` commands in `buildEditorCommands`; embed hides the chrome            |
| Listed in "Shared with you"                | n/a | n/a | Y   | Y   | Y   | Y   | Y    | Y    | n/a | n/a | n/a | N   | `share.ts` `recordSharedAccess`; `shared.ts`                                                 |

### Comments

| Ability                       | Own | Mem | E   | V   | E·t | V·t | EmbE | EmbV | G   | FT  | RO  | MCP | Granted or refused by                                                                  |
| ----------------------------- | --- | --- | --- | --- | --- | --- | ---- | ---- | --- | --- | --- | --- | -------------------------------------------------------------------------------------- |
| Read threads                  | Y   | Y   | Y   | Y   | T   | T   | Y    | Y    | Y   | Y   | Y   | Y   | tab GET; author ids redacted for non-owners                                            |
| Add a comment                 | Y   | Y   | Y   | Y   | T   | T   | Y    | Y    | Y   | Y   | N   | N   | edit roles: autosave plus `comment-add` delta; view: `POST .../comments` on `gateRead` |
| Add from a comment panel      | Y   | Y   | Y   | N   | T   | N   | Y    | N    | Y   | n/a | n/a | n/a | `EditorCanvasHost.tsx` `commentPanelActions` undefined when `isReadOnly`               |
| Delete own comment            | Y   | Y   | Y   | Y   | T   | T   | Y    | Y    | Y   | Y   | N   | N   | `DELETE .../comments/:id`, `found.authorId !== owner` refused                          |
| Delete someone else's comment | Y   | Y   | Y   | N   | T   | N   | Y    | N    | Y   | S   | N   | S   | tab PUT (`gateEdit`) or `comment-remove` delta (mutation class)                        |
| Resolve, reopen a thread      | Y   | Y   | Y   | N   | T   | N   | Y    | N    | Y   | S   | N   | S   | same; `CommentThreadPopover.tsx` hides the button when `readOnly`                      |

### Session tools: running them versus taking part

"Run" means start, end, reveal, clear or configure. Every run verb is also gated client-side by the facilitator
baton (`runBlocked`); the room enforces the baton only for `poll-start` / `poll-end` (`mayRunSession`).

| Ability                                    | Own                                                                | Mem | E   | V   | E·t | V·t | EmbE | EmbV | G   | FT  | RO  | MCP | Granted or refused by                                                                               |
| ------------------------------------------ | ------------------------------------------------------------------ | --- | --- | --- | --- | --- | ---- | ---- | --- | --- | --- | --- | --------------------------------------------------------------------------------------------------- |
| Dot vote: run                              | Y                                                                  | Y   | Y   | N   | T   | N   | Y    | N    | Y   | S   | N   | N   | `useTabSession.ts` `startVote` etc. on `runBlocked`; `tab-meta` is mutation class                   |
| Dot vote: cast, retract                    | Y                                                                  | Y   | Y   | N   | T   | N   | Y    | N    | Y   | S   | N   | N   | `castVote` returns on `editsBlocked`; `vote` is mutation class                                      |
| Live poll: start, end                      | Y                                                                  | Y   | Y   | N   | T   | N   | Y    | N    | Y   | n/a | N   | N   | mutation class plus `mayRunSession` in the room                                                     |
| Live poll: answer                          | Y                                                                  | Y   | Y   | Y   | T   | T   | Y    | Y    | Y   | n/a | N   | N   | `poll-answer` presence class; `PollPromptSheet` ungated                                             |
| Q&A: add note, upvote, withdraw            | Y                                                                  | Y   | Y   | Y   | T   | T   | Y    | Y    | Y   | S   | N   | N   | `qa-board-routes.ts`, participant actions on `gateRead`                                             |
| Q&A: discuss, close, reopen, remove, clear | Y                                                                  | Y   | Y   | N   | T   | N   | Y    | N    | Y   | S   | N   | N   | same route, other actions on `gateEdit`                                                             |
| Estimate, temperature, Done check: answer  | Y                                                                  | Y   | Y   | N   | T   | N   | Y    | N    | Y   | S   | N   | N   | `respond` undefined when `isReadOnly`; `el-delta` (`response`) is mutation class                    |
| Estimate, Done check: reveal, reset, scale | Y                                                                  | Y   | Y   | N   | T   | N   | Y    | N    | Y   | S   | N   | N   | `isReadOnly \|\| runBlocked` in `EditorCanvasHost.tsx`                                              |
| Idea box: add an idea                      | Y                                                                  | Y   | Y   | N   | T   | N   | Y    | N    | Y   | S   | N   | N   | `addIdea` undefined when `isReadOnly`; `idea` delta is mutation class                               |
| Idea box: reveal, scatter, clear           | Y                                                                  | Y   | Y   | N   | T   | N   | Y    | N    | Y   | S   | N   | N   | `isReadOnly \|\| runBlocked`                                                                        |
| Quiz: answer                               | Y                                                                  | Y   | Y   | N   | T   | N   | Y    | N    | Y   | S   | N   | N   | `answerQuiz` undefined when `isReadOnly`                                                            |
| Quiz: start, lock, reveal, reset, edit     | Y                                                                  | Y   | Y   | N   | T   | N   | Y    | N    | Y   | S   | N   | N   | `isReadOnly \|\| runBlocked`                                                                        |
| Picker: press                              | Y                                                                  | Y   | Y   | Y   | T   | T   | Y    | Y    | Y   | n/a | N   | N   | anyone presses; only an editor's result is written (`picker.md`)                                    |
| Timer: start, pause, extend, reset         | Y                                                                  | Y   | Y   | N   | T   | N   | Y    | N    | Y   | S   | N   | N   | `useTabSession.ts` on `runBlocked`; view sees a read-only clock                                     |
| Roll call, agenda press                    | Y                                                                  | Y   | Y   | N   | T   | N   | Y    | N    | Y   | S   | N   | N   | `takeRoll`, `pressAgendaItem` on `isReadOnly \|\| runBlocked`                                       |
| Checklist tick                             | Y                                                                  | Y   | Y   | N   | T   | N   | Y    | N    | Y   | S   | N   | N   | `onToggleChecklistItem` on `isReadOnly`; `check` delta is mutation class                            |
| Facilitator baton: claim, hold, grant      | Y                                                                  | Y   | Y   | N   | T   | N   | Y    | N    | Y   | n/a | N   | N   | `facilitator.ts` `canHold = role === 'edit'`                                                        |
| Baton: take it back from a holder          | Y*                                                                 | N   | N   | N   | N   | N   | N    | N    | Y*  | n/a | N   | N   | `claimBaton` needs `isOwner`, set only by `X-Verified-Owner` from a personal-document `?o=` upgrade |
| Free someone's selection lock              | Y                                                                  | Y   | Y   | N   | T   | N   | Y    | N    | Y   | n/a | N   | N   | `document-room.ts` `releaseSelectionLock`: edit plus `mayReleaseLock`                               |
| Bring focus while someone holds the baton  | holder only, client-side; the room relays `focus-here` from anyone |     |     |     |     |     |      |      |     |     |     |     | `EditorCanvasHost.tsx` `onPressFocusButton={runBlocked ? undefined : ...}`                          |

\* Personal documents only; on a team document nobody holds the owner override.

### Content

| Ability                                            | Own | Mem | E   | V   | E·t | V·t | EmbE | EmbV | G   | FT  | RO  | MCP | Granted or refused by                                                                                   |
| -------------------------------------------------- | --- | --- | --- | --- | --- | --- | ---- | ---- | --- | --- | --- | --- | ------------------------------------------------------------------------------------------------------- |
| Edit elements, layers, tab theme, canvas, tab name | Y   | Y   | Y   | N   | T   | N   | Y    | N    | Y   | Y   | N   | Y   | tab PUT `gateEdit(..., tabId)`; room `el`, `tab`, `tab-meta`; MCP `update_document`                     |
| Add a tab                                          | Y   | Y   | Y   | N   | N   | N   | Y    | N    | Y   | Y   | N   | Y   | tab PUT names a tab outside the scope; `document-meta` refused by `scopedSenderMayRelay`; MCP `add_tab` |
| Delete a tab                                       | Y   | Y   | Y   | N   | N   | N   | Y    | N    | Y   | Y   | N   | N   | tab DELETE: `grant?.tabScope !== null` refused                                                          |
| Rename document, reorder tabs, slide deck          | Y   | Y   | Y   | N   | N   | N   | Y    | N    | Y   | Y   | N   | Y   | `documents.ts` PUT `/:id`, `gateEdit` without a tab; MCP `rename_document`                              |
| Upload and place images                            | Y   | Y   | Y   | N   | T   | N   | N    | N    | Y   | Y   | N   | N   | `images.ts` POST is per-uploader, not document-gated; embed blocks it (`useEditorImages.ts`)            |
| AI assistant                                       | Y   | Y   | Y   | S   | T   | S   | Y    | S    | Y¹  | Y¹  | N   | n/a | `ai-gate.ts` is not document-gated; panel hidden when `isReadOnly`                                      |
| Link an existing tab from another document         | Y   | N²  | N   | N   | N   | N   | N    | N    | Y   | Y   | N   | N   | `document-subresource-routes.ts` `/link`: `ownsDocument`                                                |

¹ Unless `AI_REQUIRE_CLERK=true`, which refuses guests and tokens. ² Except the row owner.

### Sharing

| Ability                                 | Own                                           | Mem | E   | V   | E·t | V·t | EmbE | EmbV | G   | FT  | RO  | MCP | Granted or refused by                                           |
| --------------------------------------- | --------------------------------------------- | --- | --- | --- | --- | --- | ---- | ---- | --- | --- | --- | --- | --------------------------------------------------------------- |
| List links, read the password in clear  | Y                                             | N²  | N   | N   | N   | N   | N    | N    | Y   | Y   | Y   | N   | `document-share-routes.ts` GET `/share`, `requireOwnedDocument` |
| Create a link (role, expiry, tab scope) | Y                                             | N²  | N   | N   | N   | N   | N    | N    | Y   | Y   | N   | Y³  | POST `/share`; MCP `share_document`                             |
| Revoke one or all, rescope, extend      | Y                                             | N²  | N   | N   | N   | N   | N    | N    | Y   | Y   | N   | N   | DELETE `/share`, DELETE / PUT `/share/:code`, POST `/extend`    |
| Set or clear the share password         | Y                                             | N²  | N   | N   | N   | N   | N    | N    | Y   | Y   | N   | N   | PUT `/share-password`                                           |
| Change an existing link's role          | nobody: there is no route; revoke and reissue |     |     |     |     |     |      |      |     |     |     |     | n/a                                                             |

³ View or edit, with expiry; no tab scope, default `view` (`apps/mcp/src/schema.ts` `shareDocumentShape`).
The editor hides Share for anyone with `isOwner` false (`EditorView.tsx` `showShare={isOwner && ...}`), which
matches the server for members who are not the row owner.

### Document lifecycle

| Ability                                   | Own | Mem | E   | V   | E·t | V·t | EmbE | EmbV | G   | FT  | RO       | MCP | Granted or refused by                                                                  |
| ----------------------------------------- | --- | --- | --- | --- | --- | --- | ---- | ---- | --- | --- | -------- | --- | -------------------------------------------------------------------------------------- |
| Make a copy into own files                | Y   | Y   | Y   | Y   | T   | T   | S    | S    | Y   | Y   | N        | N   | `documents.ts` `/copy`: `gateGrant` or a live `shared_with` row; embed shows no button |
| Move, re-folder, file into or out of team | Y   | Y   | N   | N   | N   | N   | N    | N    | Y⁴  | Y   | N        | N   | `document-placement-route.ts`: owner or joined member rules                            |
| Delete to Trash, delete permanently       | Y   | Y   | U   | N   | U   | N   | N    | N    | Y   | Y   | N        | Y   | `document-delete-route.ts` `mayDeleteDocument`; palette offers it to edit links        |
| Restore, purge, list Trash                | Y   | Y   | N   | N   | N   | N   | N    | N    | Y   | Y   | RO lists | Y   | `trash.ts`, `mayDeleteDocument`                                                        |
| Empty the whole Trash                     | Y   | Y⁵  | N   | N   | N   | N   | N    | N    | Y   | Y   | N        | N   | `trash.ts` DELETE: personal by owner, `?team=` by any joined member                    |
| Take offline                              | Y   | N   | N   | N   | N   | N   | N    | N    | Y   | Y   | N        | N   | `document-delete-route.ts`, honoured for the owner only                                |
| Favourite                                 | Y   | Y   | Y   | Y   | Y   | Y   | n/a  | n/a  | Y   | Y   | N        | N   | `favourites.ts`: per caller, not access-checked                                        |

⁴ Personal moves only; a guest can never be a team member. ⁵ The team's Trash, by any joined member, not only admins.

### Teams, tokens and account

| Ability                                         | Clerk session                  | Guest        | Full token | Read-only token | MCP | Granted or refused by                                      |
| ----------------------------------------------- | ------------------------------ | ------------ | ---------- | --------------- | --- | ---------------------------------------------------------- |
| Create a team                                   | Y                              | N            | N          | N               | N   | `teams.ts`: non-GET needs `clerkUserId`                    |
| Read team, members, library                     | members (library: joined only) | N            | Y          | Y               | Y   | `teams.ts` uses `verifiedUserId` for reads                 |
| See the team invite-link token                  | admins                         | N            | admins     | admins          | N   | `teams.ts` GET `/:id`, `isAdmin ? getTeamInviteLink`       |
| Rename, delete team; invite; roles; invite link | joined admin                   | N            | N          | N               | N   | `teams.ts` `isAdmin` plus session                          |
| Leave or decline                                | self                           | N            | N          | N               | N   | `teams.ts` DELETE member, `isSelf`                         |
| List, mint, revoke API tokens                   | Y (Settings mints full only)   | N            | N          | N               | N   | `tokens.ts` `if (!clerkUserId) return forbidden()`         |
| Mint through MCP consent (full or read-only)    | Y                              | N            | N          | N               | n/a | `oauth.ts` `handleOauthExchange`, `readOnly` from the body |
| Delete account, migrate guest work, Drive       | Y                              | migrate only | N          | N               | N   | `account.ts`, `migrate.ts`, `drive.ts`                     |

Team roles are `admin` and `member`. Neither changes what a member can do to a document: every joined member holds
`FULL_EDIT` (`resolveDocumentGrant`).

### Embeds in short

An embed carries its link's role exactly (`docs/specs/013-workspace/embeds.md`, `apps/live/lib/embed.ts`). It
differs from the plain link only in what the chrome withholds: no identity screen (comments and Q&A notes carry
the default guest identity, so `getParticipant` often yields "Anonymous"), no palette, panels, tab bar, theme
dialog or Make a copy button, no image upload or paste (`useEditorImages.ts`, `useClipboard.ts`), and the
"Open in livediagram" badge instead.

## Where the editor and the server disagree

| Ability                                 | Editor                                                                           | Server                                 | Effect                                                                                                                                                                                                                            |
| --------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Delete document, edit link              | Command palette offers "Delete document" (`buildEditorCommands`, not role-gated) | 403, `mayDeleteDocument`               | `useDocumentListActions.ts` `deleteDocument` tombstones locally, swallows the 403 (`.catch(() => {})`) and navigates to the Explorer: silent failure, and the visitor's own autosave is now stopped by the tombstone **(verify)** |
| Reactions, view role                    | Hidden                                                                           | Relayed (`reaction` is presence-class) | A crafted client can fire them; harmless, but the two disagree                                                                                                                                                                    |
| Q&A run verbs while someone holds baton | Hidden (`runBlocked`)                                                            | Allowed to any editor (`gateEdit`)     | Baton is advisory for Q&A, timer, vote, quiz, responses                                                                                                                                                                           |
| Bring focus while someone holds baton   | Hidden                                                                           | Relayed from anyone, view included     | Same                                                                                                                                                                                                                              |
| Copy from an embed                      | No button                                                                        | Allowed                                | Harmless                                                                                                                                                                                                                          |
| Room join, full token                   | No client                                                                        | Ticket mint and edit session allowed   | An agent could join a room today with no presence design                                                                                                                                                                          |
| Comment from a comment panel, view role | No composer                                                                      | The REST door would accept it          | Inconsistent between popover and panel                                                                                                                                                                                            |

## Anomalies and gaps

1. **The view role is already split down the middle.** Comments, poll answers and the Q&A board are open to it;
   dot votes, responses (estimate, temperature, Done check, quiz) and the idea box are not. The line falls where
   the transport happens to fall (REST door or presence op versus mutation op), not where a product decision put
   it. This is the strongest evidence for Webber's Participant level.
2. **Done check never completes with a viewer present.** `DoneCheckFace.tsx` derives the waiting list from every
   participant in the roster (`doneSplit(element.responses, keys)`), viewers included, yet a viewer cannot
   respond. The same shape likely affects roll call.
3. **A viewer can lock elements for editors.** `select` is presence-class and `usePresenceBroadcast.ts` sends it
   for every role, so a viewer who clicks an element (to read its thread) blocks editors from it until they click
   away. Only a baton holder or a free-baton editor can release it.
4. **A read-only token can read every share code and the password.** `GET /share` is a `GET`, so the choke point
   lets it through, and `requireOwnedDocument` accepts the token's owner. Anyone holding a read-only token can
   therefore lift an edit link and open it in a browser. A read-only token of a team admin likewise reads the
   team invite-link token, which lets any account join the team and edit its library.
5. **A full token can mint credentials.** `context.ts` states "a leaked token must not be able to manage
   membership or mint further credentials", yet share links (edit role included) and the share password are
   reachable with a full token, and MCP exposes `share_document`.
6. **Possible owner impersonation on the room upgrade (verify).** The `?o=` leg (`isPersonalOwner(claimedOwnerId,
...)`) trusts an unsigned query value for personal documents. For a signed-in owner that value is a Clerk id,
   which teammates can read from the members list, and the document id reaches every link visitor. Unlike the
   `X-Owner-Id` header, which `index.ts` refuses when it is Clerk-shaped, the query param has no such check.
   If confirmed, a teammate holding a view link to a colleague's personal document could join its room as an
   editor with the owner bit. Worth a focused test.
7. **Ownership is already separate from edit, but unevenly.** Owner-only: share family, tab linking, Take offline.
   Owner or any member: delete, permanent delete, Trash, moves (including taking a team document into one's own
   library, which transfers ownership). Team admin carries no document power at all, while any member can empty
   the team Trash.
8. **No owner override on team documents.** `X-Verified-Owner` is set only for a personal-document `?o=` upgrade,
   so a stuck baton on a team document can be cleared only by the grace timer.
9. **Read-only tokens cannot join the room or comment**, and Settings cannot mint them at all: only the MCP consent
   screen offers the toggle (`apps/live/app/oauth/consent/page.tsx`); `tokens.ts` ignores any `readOnly` field.
10. **A link's role is immutable.** There is no route to change it; scope can change (`PUT /share/:code`), role
    cannot.
11. **Setting a password does not end live sessions.** The password route broadcasts nothing (unlike revoke and
    rescope, which close sockets), and the copy route's `shared_with` leg does not re-check the password.
12. **Embeds comment anonymously.** With the identity screen suppressed, an embed's comments and Q&A notes carry
    whatever default guest identity the browser has, often "Anonymous".
13. **The baton is mostly advisory.** Only `poll-start` / `poll-end` are enforced in the room; every other run
    verb is a client rule, as `facilitator.md` says openly. Any edit holder can run any session tool over REST or
    a crafted socket.
14. **MCP is owner-shaped.** It sends no share code, so it sees only owned and team documents; it has no tools for
    comments, session tools or presence.

## How today maps onto the four levels

| Proposed level          | Today's nearest identity  | What would have to move                                                                                                              |
| ----------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Viewer (read only)      | View link                 | Comments, poll answers and Q&A writes move out; presence stays; selection should stop locking                                        |
| Participant             | none                      | Gains comments, poll answers, Q&A, dot votes, every `response` and `idea` delta; needs a room op class between presence and mutation |
| Editor                  | Edit link, team member    | Unchanged, minus anything ownership claims                                                                                           |
| Ownership (not a level) | Owner, partly team member | A defined set: share family, password, delete, Trash, move, Take offline, baton override                                             |

The draft blueprint in the worktree (`docs/specs/013-workspace/blueprints/share-roles.md`) already sketches the
middle class (`PARTICIPATION_DELTA_KINDS = ['response', 'idea']`, `poll-answer` and `vote` to comment), which
fits this map.

Other products separate the same layers. Google Drive offers Viewer, Commenter and Editor on a file, with the
owner set apart ([Google Drive help: share files](https://support.google.com/drive/answer/2494822)); Figma
offers "can view" and "can edit" with ownership and admin rights handled separately
([Figma: guide to sharing and permissions](https://help.figma.com/hc/en-us/articles/1500007609322-Guide-to-sharing-and-permissions)).

## Recommendations

1. **Name the Participant level from what the code already does**: comments, poll answers and Q&A writes are
   live today for view links, so Participant is a promotion of an existing behaviour plus the missing votes and
   responses, not a new surface.
2. **Introduce a third room op class** (participation) beside presence and mutation, owned by
   `packages/api-schema/src/room-messages.ts`, and move `poll-answer` into it, so the role gate stops leaning on
   "presence" for a write.
3. **Define ownership as a list of doors, not a role**: share family, password, delete, Trash, move, Take offline,
   baton override; decide per door whether a team member or admin also holds it, and route all of them through
   `ownsDocument` / `mayDeleteDocument` only.
4. **Fix the token escape hatches before adding roles**: refuse share-link and password reads to read-only tokens,
   hide the team invite-link token from tokens, and decide whether full tokens may mint share links.
5. **Test anomaly 6 first.** If the `?o=` leg admits a Clerk id, refuse Clerk-shaped values there as `index.ts`
   does for the header, and require a ticket for every signed-in owner.
6. **Make viewers neutral in the room**: no selection lock from a session below edit, and exclude non-respondents
   from the Done check waiting list.
7. **Close the UI and server gaps**: hide Delete document for non-owners and stop swallowing its 403; decide
   reactions for viewers one way.

## Open questions for Webber

1. **What does Participant include?**
   - **All session tools and comments**: votes, responses, ideas, quiz, poll, Q&A, comments.
   - **Session tools only**, comments stay with Editor.
   - **Comments only**, session tools stay with Editor (the Google Commenter model).
2. **What does a Viewer keep?**
   - **Presence and following only**: cursor, laser, follow, reactions; no comments, no answers.
   - **Presence plus poll answers and Q&A**, as audiences on view links do today.
   - **Read only, invisible**: no cursor or roster entry either.
3. **Who holds ownership doors on a team document?**
   - **Every joined member**, as delete and Trash already work.
   - **Team admins and the row owner** only.
   - **The row owner only**, as the share family works today.
4. **What may a token do with sharing?**
   - **Nothing**: share links and the password become session-only, like tokens.
   - **Create view links only**, never edit links or password reads.
   - **As today**, full tokens manage sharing; read-only tokens see nothing of it.
5. **How do existing view links migrate?**
   - **Become Participant**, keeping what they do today and gaining votes.
   - **Stay Viewer**, losing comments, poll answers and Q&A.
   - **Become a new "legacy view"** that keeps exactly today's mix until revoked.
6. **Should tokens carry the same four levels?**
   - **Yes, Viewer / Participant / Editor** as a ceiling on the owner's grant.
   - **Two only**, read and write, as today.
   - **Three, without Participant**, since agents rarely take part in sessions.
