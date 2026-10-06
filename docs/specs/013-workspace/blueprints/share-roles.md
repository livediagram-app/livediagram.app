# Share roles: blueprint

Derived from [Share roles](../share-roles.md), with the token surface of
[Public API and API tokens](../../015-api/public-api-and-tokens.md) §3.4 to §3.6a, the consent screen of
[MCP server](../../015-api/mcp-server.md) §4.8 and §4.11, the room of
[Realtime conflict resolution](../../012-collaboration/realtime-conflict-resolution.md),
[Collab race hardening](../../012-collaboration/collab-race-hardening.md) and the
[Q&A board](../../012-collaboration/qa-board.md) write queue, the baton of
[Facilitator](../../012-collaboration/facilitator.md), the pass and pill of
[Live app](../../007-editor/live-app.md#share-dialog), [Embeds](../embeds.md), the share types of
[Telemetry](../../017-telemetry/telemetry.md) and the terms of
[Domain language](../../003-system-architecture/domain-language.md). The code sites and constraints it answers are
catalogued in `docs/research/access-levels/current-abilities.md` and `constraints.md` (cited as `Cn`). The spec
decides; this file only adds engineering precision. Defaults applied where the spec is silent are ledgered in
[DEFAULTS.md](DEFAULTS.md) and cited as `SRn`.

Shipping separately and not restated here: the room refusing an account id as `?o=`, the read-only token refused
`GET /share`, and the team invite link returned only to an interactive session (pull request #352). This blueprint
widens the second to every token below edit (Ownership).

It provides these names to sibling blueprints ([Agent presence](../../024-agents/blueprints/agent-presence.md),
[Agent changesets](../../024-agents/blueprints/agent-changesets.md), [CLI](../../015-api/blueprints/cli.md)):

| Name                                                                           | What it is                                                            |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| `AccessLevel = 'view' \| 'participate' \| 'edit'`, `ACCESS_LEVELS`             | The three levels, on links, grants, tickets, room sessions and tokens |
| `levelAtLeast`, `lowerLevel`, `isAccessLevel`, `parseStoredLevel`              | The ladder; `parseStoredLevel` reads anything unknown as `view`       |
| `RouteContext.token: { id, ownerId, level } \| null`                           | The presenting API token; null for a session or a guest               |
| `gateRead`, `gateParticipate`, `gateEdit` `(ctx, id, ownerId, teamId, tabId?)` | Level gates; each applies the token's level as a ceiling              |
| `holdsPower(ctx, liveDoc, power)`, `OwnershipPower`                            | The ownership question, asked beside the level question               |
| `deniedParticipate(ctx, liveDoc, tabId)`                                       | The refusal for a participation-class REST door                       |
| `tokenWriteRefusal(level, method, segments)`, `requiredTokenLevel`             | The write choke point and its route classifier                        |
| `classifyRoomOp(op)`, `minimumLevelForOp(op)`, `PARTICIPATION_OP_KINDS`        | The room's three op classes plus system ops, and the level each needs |
| `writeParticipation(env, req)`                                                 | The room's own D1 write of one participation op                       |
| `collabKeyFor(documentId, ownerId)`                                            | The server-derived collaboration key, carried in the room ticket      |
| `POST /api/documents/:id/tabs/:tabId/answers`                                  | The REST door for one answer, the way a token takes part              |

`AccessLevel` replaces `ShareRole` (and the `TokenRole` the siblings name); `gateParticipate` replaces
`gateComment`.

## Delivery

The change ships expand then contract ([spec](../share-roles.md#moving-to-three-levels), C24), in three releases:

| Release         | What ships                                                                                                                                                                                                                                                                                                                    | Migration                               |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| **1. Readers**  | `AccessLevel` with `participate`; every reader (`rowToShareLink`, `consumeWsTicket`, the room's `X-Verified-Role` and attachment, `apiLoadShared`, roster badges) parses through `parseStoredLevel`. Every gate is unchanged: `participate` is "not edit", exactly today's view. No writer emits `participate`.               | none                                    |
| **2. Levels**   | Migration 0068; the gates, the room's op classes, derived keys in tickets, key pinning and participation writes; the answers route; ownership powers; the writers (Share dialog, `POST /share`, token mint, MCP); the UI, which now mints a ticket for every session; telemetry. Writers keep `api_tokens.read_only` in step. | `0068_access_levels.sql`                |
| **3. Contract** | Token resolution and mint stop touching `read_only`; the column is dropped.                                                                                                                                                                                                                                                   | the next free number at that time (SR2) |

- Release 2 ships no sooner than `ACCESS_LEVELS_SOAK_DAYS` after release 1 (SR3), so an editor bundle loaded
  before release 1 is all but gone when `participate` first appears.
- In release 2's deploy window the release-1 worker reads a `participate` link as today's view (no escalation, no
  loss) and a participate token through `read_only = 1` (read-only, fail closed).

## Scope, by file

| File                                                                                                                      | Release | Role                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/api-schema/src/access-levels.ts` (planned) (new)                                                                | 1       | `ACCESS_LEVELS`, `AccessLevel`, the ladder, `parseStoredLevel`, defaults, telemetry types                                                                          |
| `packages/api-schema/src/index.ts`                                                                                        | 1, 2    | `ShareRole` removed; `ShareLink.role`, `SharedWithItem.role`, `ParticipantPresence.role`: `AccessLevel`; `ApiToken.role` replaces `readOnly` (2)                   |
| `packages/api-schema/src/room-messages.ts`                                                                                | 2       | `PARTICIPATION_OP_KINDS`, `PARTICIPATION_DELTA_KINDS`, `classifyRoomOp`, `minimumLevelForOp`; `poll-answer` leaves `PRESENCE_OP_KINDS`                             |
| `apps/api/src/share-link-row.ts`, `api-token-row.ts`, `db/ws-tickets.ts`, `db/shared.ts`                                  | 1, 2    | Readers through `parseStoredLevel`; token row reads `role` (2)                                                                                                     |
| `apps/api/migrations/0068_access_levels.sql` (planned) (new)                                                              | 2       | Link and visit rebuilds, ticket and token columns                                                                                                                  |
| `apps/api/migrations/<next>_drop_api_token_read_only.sql` (new)                                                           | 3       | Drops `api_tokens.read_only`                                                                                                                                       |
| `apps/api/src/db/api-tokens.ts`                                                                                           | 2, 3    | `createApiToken`, `mintApiToken`, `resolveApiToken` carry `level`                                                                                                  |
| `apps/api/src/auth/document-access.ts`                                                                                    | 2       | `resolveDocumentGrant(..., tokenLevel)`; `canReadDocument`, `canParticipateDocument`, `canEditDocument`                                                            |
| `packages/api-schema/src/answers.ts` (planned) (new)                                                                      | 2       | `AnswerRequest`, `AnswerResponse`, `RoomTicketResponse { ticket, collabKey }`                                                                                      |
| `apps/api/src/collab-key.ts` (planned) (new)                                                                              | 2       | `collabKeyFor`, `COLLAB_KEY_LENGTH`                                                                                                                                |
| `apps/api/src/routes/answers-route.ts` (planned) (new)                                                                    | 2       | `handleAnswersRoute`: `POST .../tabs/:tabId/answers` on `gateParticipate`, handed to the room's `/participation`                                                   |
| `apps/live/app/document/[id]/useRoomConnection.ts`, `apps/live/lib/api/room.ts`, `apps/live/lib/identity.ts`              | 2       | Every session mints a ticket; the ticket's `collabKey` becomes the self key while connected                                                                        |
| `apps/api/src/auth/ownership.ts` (planned) (new)                                                                          | 2       | `OWNERSHIP_POWERS`, `holdsPower`, `tokenHoldsOwnership`                                                                                                            |
| `apps/api/src/auth/token-level-gate.ts` (planned) (new)                                                                   | 2       | `tokenWriteRefusal`, `requiredTokenLevel`, `isParticipationWrite`, `isEveryLevelTokenWrite`                                                                        |
| `apps/api/src/routes/context.ts`                                                                                          | 2       | `RouteContext.token`; `gateParticipate`; ceilings on every gate; `ownsDocument`, `requireOwnedDocument`, `mayDeleteDocument` ask `holdsPower`; `deniedParticipate` |
| `apps/api/src/index.ts`                                                                                                   | 2       | `tokenAuth` carries `level`; the choke point calls `tokenWriteRefusal`; builds `ctx.token`                                                                         |
| `apps/api/src/routes/document-share-routes.ts`                                                                            | 2       | `POST /share` validates three levels; omitted is `edit`; owner power `share`                                                                                       |
| `apps/api/src/routes/share.ts`                                                                                            | 2       | `Document·Joined` type from `LEVEL_TELEMETRY_TYPE`                                                                                                                 |
| `apps/api/src/routes/document-subresource-routes.ts` (or `comment-routes.ts`)                                             | 2       | Comment add and delete-own on `gateParticipate`                                                                                                                    |
| `apps/api/src/routes/qa-board-routes.ts`                                                                                  | 2       | Participant actions on `gateParticipate`; running actions on `gateEdit`                                                                                            |
| `apps/api/src/routes/document-delete-route.ts`, `routes/trash.ts`, `document-placement-route.ts`                          | 2       | Ownership powers `delete`, `move` and `take-offline` through `holdsPower`                                                                                          |
| `apps/api/src/routes/document-room-routes.ts`                                                                             | 1, 2    | Level parse (1); ticket `owner` bit and `X-Verified-Owner` from it (2)                                                                                             |
| `apps/api/src/document-room.ts`, `document-room-rules.ts`                                                                 | 1, 2    | `verifiedRole: AccessLevel` (1); op gate by class, pinned key, participation write queue (2)                                                                       |
| `apps/api/src/participation-write.ts` (planned) (new)                                                                     | 2       | `writeParticipation`: one vote or answer, compare-and-swap                                                                                                         |
| `apps/api/src/qa-board-write.ts`                                                                                          | 2       | `TAB_CAS_MAX_ATTEMPTS` shared with the participation write                                                                                                         |
| `apps/api/src/facilitator.ts`                                                                                             | 1       | `Asker.role: AccessLevel \| undefined`; `canHold` stays edit                                                                                                       |
| `apps/api/src/routes/tokens.ts`, `routes/oauth.ts`                                                                        | 2       | Mint with `role`; refuse the retired `readOnly` field                                                                                                              |
| `apps/api/src/openapi/manifest.ts`, `document.ts`, `schemas.generated.ts`, `scripts/gen-openapi-schemas.mjs`              | 2       | `AccessLevel` enum, `ApiToken.role`, token bodies, `x-token-level`                                                                                                 |
| `packages/agent-verbs/src/mcp/schema.ts`, `output-schema.ts`, `tools.ts`, `tool-annotations.ts`                           | 2       | `share_document.role` takes three levels, default `participate`                                                                                                    |
| `apps/live/lib/api/share.ts`, `apps/live/lib/api/core.ts`, `api-client.ts`                                                | 1       | `apiLoadShared` parses through `parseStoredLevel`                                                                                                                  |
| `apps/live/lib/api/tokens.ts`, `apps/live/lib/api/oauth.ts`, `hooks/persistence/useTokens.ts`                             | 2       | `apiCreateToken(ownerId, name, role)`, `apiExchangeOauthToken(ownerId, client, role)`                                                                              |
| `apps/live/components/dialogs/settings/token-levels.ts` (planned) (new)                                                   | 2       | `TOKEN_LEVEL_OPTIONS`: label, line, badge per level                                                                                                                |
| `apps/live/app/oauth/consent/page.tsx`                                                                                    | 2       | Three-level radio group replaces the read-only toggle                                                                                                              |
| `apps/live/components/dialogs/settings/SettingsTokenCreate.tsx`, `SettingsTokenCard.tsx`                                  | 2       | The composer's level control; the card's level badge                                                                                                               |
| `apps/live/components/dialogs/share-dialog-parts.tsx`                                                                     | 2       | `ROLE_PASS` for three levels, AA solids; `LEVEL_ORDER`                                                                                                             |
| `apps/live/components/dialogs/ShareComposer.tsx`, `SharePassTicket.tsx`, `ActiveSharePass.tsx`                            | 2       | Three cards; wider stub; link label and embed copy per level                                                                                                       |
| `apps/live/components/chrome/RoleIndicator.tsx`                                                                           | 1, 2    | `Role = AccessLevel` (1); Participating word, tone, glyph (2)                                                                                                      |
| `apps/live/app/document/[id]/useViewPreview.ts`, `useRoleIndicator.ts`                                                    | 2       | `canTakePart`; the pill's level                                                                                                                                    |
| `apps/live/app/document/[id]/useEditorState.ts`, `editor-page-helpers.ts`, `editor-realtime.ts`                           | 1, 2    | `sessionRole: AccessLevel` (1); `participationBlocked`, embed cap to view (2)                                                                                      |
| `apps/live/components/canvas/EditorCanvasHost.tsx`                                                                        | 2       | Answers, ideas, quiz picks, Q&A add and upvote, poll answers on `canTakePart`; respondents filter                                                                  |
| `apps/live/hooks/persistence/useTabSession.ts`, `hooks/canvas/useCollabElements.ts`, `useQuizElements.ts`                 | 2       | Casts and answers on `participationBlocked`; ticks and running stay edit                                                                                           |
| `apps/live/hooks/collab/useLivePoll.ts`                                                                                   | 2       | `answerPoll` refused without `canTakePart`; the sheet shows no answer controls                                                                                     |
| `apps/live/components/panels/EditorAnchoredPopovers.tsx`, `CommentThreadPopover.tsx`, `hooks/collab/useEditorComments.ts` | 2       | `canComment`; a session below edit persists, resolves and reopens over REST                                                                                        |
| `apps/live/lib/presence-rows.ts`, `app/document/[id]/usePresenceRows.ts`                                                  | 2       | `RemoteSelector.holds`; `lockedByOther` counts only an Editor's selection                                                                                          |
| `apps/live/lib/collaborator-roster.ts`, `components/dialogs/CollaboratorsHost.tsx`                                        | 1, 2    | Badges Editor, Participant, Viewer; `takesPart(p)` for the Done check and roll call                                                                                |
| `apps/live/components/canvas/collab/DoneCheckFace.tsx`, `useCollabElements.ts` (`takeRoll`)                               | 2       | Waiting list and roster from `takesPart`                                                                                                                           |
| `apps/live/lib/editor-commands.ts`                                                                                        | 2       | Delete document offered only with the `delete` power                                                                                                               |
| `apps/live/app/explorer/views.tsx`                                                                                        | 2       | Shared-with-you chip: Edit, Participate, View                                                                                                                      |
| `apps/live/hooks/persistence/useShareLinks.ts`                                                                            | 2       | `Document·Shared` type from `LEVEL_TELEMETRY_TYPE`                                                                                                                 |
| `apps/live/lib/embed.ts`                                                                                                  | 2       | An embed below edit is a Viewer                                                                                                                                    |
| `apps/telemetry/app/catalogue/collaboration.ts`, `event-explanations.ts`                                                  | 2       | Participate metrics, the cut-over note, settings chart excludes `Participate`                                                                                      |
| `apps/help/app/**` (Presentation and UX)                                                                                  | 2       | Help copy for three levels                                                                                                                                         |

## Domain and naming

| Term              | Identifier                                                                                    | Meaning                                                                                        |
| ----------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Access level      | `AccessLevel`, `ACCESS_LEVELS` (ascending); wire and column field `role` (SR1)                | What a link, embed or token admits                                                             |
| Viewer            | `'view'`; card **Viewer**, stub `VIEWER`, pill **Viewing**                                    | Looks; writes nothing                                                                          |
| Participant       | `'participate'`; card **Participant**, stub `PARTICIPANT`, pill **Participating**             | Looks and takes part: comments, answers                                                        |
| Editor            | `'edit'`; card **Editor**, stub `EDITOR`, pill **Editing**                                    | Changes the drawing; may hold the baton                                                        |
| Ownership         | `OwnershipPower` (`share`, `delete`, `move`, `take-offline`, `take-back-baton`), `holdsPower` | Powers over the document, apart from any level                                                 |
| Owner             | `ownsDocument`                                                                                | The creator, or whoever moved it into their library                                            |
| Grant             | `DocumentGrant { level, tabScope, shareCode }`                                                | What a caller holds on one document                                                            |
| Effective level   | `lowerLevel(grant.level, token.level)`                                                        | What every level gate checks                                                                   |
| Participation act | `PARTICIPATION_OP_KINDS`, `PARTICIPATION_DELTA_KINDS`, `isParticipationWrite`                 | Adds or withdraws the sender's own answer, or a comment                                        |
| Facilitation      | the baton (`canHold`), `runBlocked`                                                           | Running a session; an Editor's hat                                                             |
| Collaboration key | `collabKeyFor`, `ParticipantPresence.key`, `SessionAttachment.pinnedKey`                      | The id an answer is keyed by: derived by the server per caller and document, pinned per socket |
| Display identity  | `participants` table, `ParticipantRecord`, the editor's `Participant` type                    | A person's name, colour and picture; never "participant" in prose                              |
| Take part         | `canTakePart`, `participationBlocked`, `takesPart`                                            | The editor's flags and roster filter for the Participant level and above                       |

Banned: "commenter" and "comment role" (the level is Participant), "permission", "scope" for a level (scope is a
tab scope), "read-only token" and "full token" (say view token, edit token), "admin" for ownership, "participant"
for a display identity, "readOnly" as a token field.

## Behaviour and state

The levels are a ladder, **view < participate < edit**. `levelAtLeast(level, min)` compares ranks;
`lowerLevel(a, null)` is `a`. `parseStoredLevel(x)` is `x` when it is one of the three, else `view`.

Effective level, per caller:

| Caller                            | Grant level     | Token ceiling | Effective                          |
| --------------------------------- | --------------- | ------------- | ---------------------------------- |
| Personal owner (session or guest) | edit            | none          | edit                               |
| Joined team member (verified)     | edit            | none          | edit                               |
| Link holder                       | the link's role | none          | the link's role                    |
| Token of an owner or member       | edit            | its level     | its level                          |
| Token presenting `X-Share-Code`   | the link's role | its level     | the lower                          |
| Embed (editor only, SR6)          | the link's role | none          | the link's role if edit, else view |
| Nobody                            | no grant        | n/a           | refused                            |

Doors by level:

| Door                                                                                      | Needs                                            |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Document, tab, image, thumbnail, timeline, comment-list reads; share resolve; make a copy | view (`gateRead`, `gateGrant`)                   |
| Comment add, reply, resolve, reopen, delete own; agent presence set and clear             | participate (`gateParticipate`)                  |
| Q&A add a note, upvote, withdraw                                                          | participate (`gateParticipate`)                  |
| Q&A discuss, close, reopen, remove, clear                                                 | edit (`gateEdit`)                                |
| Tab PUT and DELETE, document PUT, changesets, images, AI                                  | edit (`gateEdit`)                                |
| Room upgrade                                                                              | any grant; the session keeps its effective level |

Ownership, asked beside the level ([spec table](../share-roles.md#ownership)):

| Power             | Holds it             | Doors                                                                                                    |
| ----------------- | -------------------- | -------------------------------------------------------------------------------------------------------- |
| `share`           | owner                | `/share` (list, create, revoke all), `/share-password`, `/share/:code` (revoke, rescope), `/extend`      |
| `delete`          | owner, joined member | `DELETE /documents/:id`, Trash restore, purge, empty                                                     |
| `move`            | owner, joined member | placement, folder moves                                                                                  |
| `take-offline`    | owner                | `DELETE /documents/:id` with `X-Document-Conversion: offline`; a teammate's conversion trashes, as today |
| `take-back-baton` | owner                | the room's owner override (`X-Verified-Owner`)                                                           |

`holdsPower(ctx, liveDoc, power)` is the table, then `tokenHoldsOwnership(ctx)`: true for no token or an edit
token, false for a view or participate token. Team mutations, `/api/tokens` (except `/current`), the account,
migration and Drive stay session-only for every token. Linking an existing tab (`/link`) stays on `ownsDocument`
(SR12).

Room op classes (`classifyRoomOp(op)`, owned by `room-messages.ts`):

| Class           | Kinds                                                                                                   | Minimum level       | Ordering                                         |
| --------------- | ------------------------------------------------------------------------------------------------------- | ------------------- | ------------------------------------------------ |
| presence        | `cursor`, `select`, `laser`, `tab-focus`, `avatar`, `avatar-push`, `reaction`, `viewport`, `focus-here` | view                | unordered, never logged                          |
| presence (edit) | `drag-preview`                                                                                          | edit                | unordered                                        |
| participation   | `poll-answer`; `vote`; `el-delta` whose `delta.kind` is `response` or `idea`                            | participate         | `poll-answer` unordered; the rest sequenced      |
| mutation        | `tab`, `tab-meta`, `el`, `document-meta`, `poll-start`, `poll-end`; `el-delta` `check` and `comment-*`  | edit                | sequenced                                        |
| system          | `SYSTEM_OP_KINDS` (and `changeset`, from agent changesets)                                              | never from a socket | worker only                                      |
| unknown         | anything else                                                                                           | edit                | sequenced (the fall-through stays edit only, C9) |

`PRESENCE_OP_KINDS`, `PARTICIPATION_OP_KINDS = ['poll-answer', 'vote']` and `MUTATION_OP_KINDS` partition the kinds;
`el-delta` is a mutation kind whose `PARTICIPATION_DELTA_KINDS = ['response', 'idea']` classify as participation.
A session below edit sends its comments through the comment endpoints, never as socket deltas (SR4).

A participation op from a session, after the class gate and the tab-scope gate:

1. **Key check** (sessions below edit): the op's key must equal the session's `pinnedKey` (the ticket's derived
   key): `vote.voter`,
   `response.participantId`, `poll-answer.key` (an absent key means the presence id, as today). An `idea` names no
   key. A mismatch, or no pinned key, drops the op.
2. **Editor**: relayed and ledgered at once, as today; its own autosave persists it (SR21).
3. **Below edit**: `poll-answer` goes to the live poll (`RoomLivePoll.noteAnswer`) and relays unordered (ephemeral,
   C15). `vote` and the two deltas join the room's tab write queue: `writeParticipation` applies the op to the
   stored tab with compare-and-swap; on `changed` the op is sequenced (relay to everyone but the sender, ledger,
   `cursor` frame to the sender); on `unchanged` nothing is relayed; on a failure the sender gets
   `catchup { resync: true }` (SR5) and re-hydrates from D1.

Collaboration keys:

- **Derivation.** `collabKeyFor(documentId, ownerId)` is the first `COLLAB_KEY_LENGTH` characters of
  base64url(SHA-256(`livediagram:collab-key:v1:<documentId>:<ownerId>`)) (SR22). `ownerId` is `ctx.resolveOwner()`:
  a guest id, an account id, or a token's owner. One person has one key per document, on every device the same
  identity reaches. The key cannot be turned back into a guest id; for an account id it confirms only what the
  roster's name already shows; it says nothing about other documents.
- **Delivery.** The ticket mint computes it, stores it on the ticket (`ws_tickets.collab_key`) and answers
  `{ ticket, collabKey }`. The editor mints a ticket for every session (no longer only for team documents and
  signed-in sessions, SR24) and uses `collabKey` as its own key in hello and in every answer while connected.
- **Pinning.** The upgrade forwards it as `X-Verified-Collab-Key` (set on every path, empty when none); the room
  stores it on the attachment as `pinnedKey` and `helloPresence` publishes `pinnedKey` as the presence `key`,
  ignoring the hello's. A session with no `pinnedKey` (an upgrade by `?s=` or `?o=`, from an older bundle)
  publishes its hello key as today; below edit, it may answer nothing keyed.
- **The answers route** keys a vote or response by `collabKeyFor(documentId, ctx.resolveOwner())`, so a token
  answers as its owner and matches the owner's browser sessions on that document.

The answers route (`POST /api/documents/:id/tabs/:tabId/answers`), for any caller at participate or above:

1. `gateParticipate(ctx, id, ownerId, teamId, tabId)`, else `deniedParticipate`.
2. Parse one answer (Interfaces); fill `voter` / `participantId` with the derived key; never read a key from the
   body.
3. Hand `{ tabId, op }` to the room's internal `POST /participation`, which runs the same queue, rules and sequencing
   as a socket's answer (with `from: 'system'`, nobody excluded) and answers `{ changed }` or the write's failure.

`writeParticipation` rules, all pure functions from `packages/document`:

| Op                 | Applies when                                                                         | Change                                     |
| ------------------ | ------------------------------------------------------------------------------------ | ------------------------------------------ |
| `vote` +1          | `voteDeltaApplies(tab.vote, op.round)` and `canCastVote(tab.vote, voter, elementId)` | `applyVoteDelta`                           |
| `vote` -1          | `voteDeltaApplies(tab.vote, op.round)`                                               | `applyVoteDelta`                           |
| `response`, `idea` | the element exists                                                                   | `applyElementDelta` (rounds, the idea cap) |

Editor state (`useEditorState`):

| Flag                   | Value                                                                                                       |
| ---------------------- | ----------------------------------------------------------------------------------------------------------- |
| `sessionRole`          | owner: `edit`; link: its level; embed: `edit` stays, anything else `view`                                   |
| `canEdit`              | `sessionRole === 'edit' && !viewPreview` (unchanged)                                                        |
| `canTakePart`          | `levelAtLeast(sessionRole, 'participate') && !viewPreview`                                                  |
| `canComment`           | `canTakePart`                                                                                               |
| `isReadOnly`           | `!canEdit` (unchanged; autosave, palette, content controls)                                                 |
| `participationBlocked` | `activeTabLocked \|\| !canTakePart \|\| activeTabLoadState !== 'ready' \|\| (!canEdit && !collabKey)` (SR7) |
| Pill level             | `viewPreview ? 'view' : sessionRole`                                                                        |
| `canToggleRole`        | `sessionRole === 'edit'`: two states, Editing and Viewing                                                   |

- The preview is the Viewer level exactly, so it turns commenting and taking part off as well as editing.
- `takesPart(p)` is `levelAtLeast(parseStoredLevel(p.role), 'participate')` and not an agent row; your own row uses
  `canTakePart`. The Done check's waiting list and a roll call's roster count only those.
- `RemoteSelector.holds` is true only for a peer whose level parses as `edit`; `lockedByOther` counts only holders.
  A Viewer's or Participant's selection still shows its badge and holds nothing.

Share composer: `role ∈ ACCESS_LEVELS`, initial `'edit'`; Left and Up step back, Right and Down forward in
`LEVEL_ORDER = ['edit', 'participate', 'view']`, wrapping; Home and End jump to the ends (SR8).

Invariants:

- **I1** Every level gate computes the effective level through `resolveDocumentGrant(..., tokenLevel)`.
- **I2** A token never exceeds its level, nor its owner's access; its level never raises a grant.
- **I3** Every reader parses through `parseStoredLevel`: an unknown level reads as `view`, on the server and in
  the editor; a room session with no level acts as `view`.
- **I4** Every ownership door asks the level and `holdsPower`, never one alone.
- **I5** A session below edit only ever writes its own answer: its key is derived by the server and pinned from the
  ticket, never claimed; its comments go through REST.
- **I6** A participation answer from a session below edit is in D1 before anyone else sees it.
- **I7** The baton is held only at edit; the owner (personal or team) may always take it back.
- **I8** The server enforces every level; the editor's flags only decide what renders.

## Interfaces and contracts

`packages/api-schema/src/access-levels.ts` (planned):

```ts
export const ACCESS_LEVELS = ['view', 'participate', 'edit'] as const;
export type AccessLevel = (typeof ACCESS_LEVELS)[number];
export const DEFAULT_LINK_LEVEL: AccessLevel = 'edit';
export const DEFAULT_TOKEN_LEVEL: AccessLevel = 'edit';
export const DEFAULT_MCP_SHARE_LEVEL: AccessLevel = 'participate';
export function isAccessLevel(value: unknown): value is AccessLevel;
export function parseStoredLevel(value: unknown): AccessLevel; // unknown -> 'view'
export function levelAtLeast(level: AccessLevel, min: AccessLevel): boolean;
export function lowerLevel(a: AccessLevel, b: AccessLevel | null): AccessLevel;
export const LEVEL_TELEMETRY_TYPE: Record<AccessLevel, 'View' | 'Participate' | 'Edit'>;
```

`room-messages.ts`:

```ts
export const PARTICIPATION_OP_KINDS = ['poll-answer', 'vote'] as const;
export const PARTICIPATION_DELTA_KINDS = ['response', 'idea'] as const;
export type RoomOpClass = 'presence' | 'participation' | 'mutation' | 'system';
export function classifyRoomOp(op: unknown): RoomOpClass;
export function minimumLevelForOp(op: unknown): AccessLevel | null; // null: never from a socket
```

`apps/api/src/participation-write.ts` (planned):

```ts
export type ParticipationWriteRequest = { documentId: string; tabId: string; op: ParticipationOp };
export type ParticipationWriteResult =
  { ok: true; changed: boolean } | { ok: false; status: 404 | 409 | 413 };
export function writeParticipation(
  env: Env,
  req: ParticipationWriteRequest,
): Promise<ParticipationWriteResult>;
```

Wire (`packages/api-schema/src/index.ts`): `ShareLink.role`, `SharedWithItem.role`, `ParticipantPresence.role?` and
the share-resolve `role` are `AccessLevel`; `ApiToken.readOnly` becomes `ApiToken.role: AccessLevel`.

REST:

| Method | Path                                         | Contract                                                                                | Failures                                                                |
| ------ | -------------------------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| POST   | `/api/documents/:id/share`                   | `role?: 'view' \| 'participate' \| 'edit'`, omitted `edit`; owner power `share`         | 400 `invalid role` (`null` and unknown included); 403 no power          |
| GET    | `/api/documents/:id/share`                   | owner power `share`; a token below edit is refused                                      | 403                                                                     |
| GET    | `/api/share/:code`                           | `{ document, role: AccessLevel, tabId }`                                                | unchanged                                                               |
| POST   | `/api/documents/:id/tabs/:tabId/comments`    | `gateParticipate`                                                                       | `deniedParticipate`                                                     |
| DELETE | `/api/documents/:id/tabs/:tabId/comments/:c` | `gateParticipate`; author only                                                          | `deniedParticipate`; 403 not the author                                 |
| POST   | `/api/documents/:id/tabs/:tabId/qa`          | participant actions `gateParticipate`; running actions `gateEdit`                       | 403                                                                     |
| DELETE | `/api/documents/:id`, `/api/trash...`        | owner power `delete`                                                                    | 403                                                                     |
| POST   | `/api/tokens`                                | `{ name?, role? }`, omitted `edit`; answer adds `role`                                  | 400 `invalid role`; 400 `readOnly is retired` (SR9)                     |
| POST   | `/api/oauth/exchange`                        | `{ clientName?, role? }`, omitted `edit`; answer `{ token, id, name, expiresAt, role }` | 400 `invalid role`; 400 `readOnly is retired` (SR9)                     |
| GET    | `/api/tokens`, `/api/tokens/current`         | each token's `role`                                                                     | unchanged                                                               |
| POST   | `/api/documents/:id/room-ticket`             | answers `{ ticket, collabKey }`                                                         | unchanged                                                               |
| POST   | `/api/documents/:id/tabs/:tabId/answers`     | `AnswerRequest`; `gateParticipate`; 200 `{ changed: boolean }` (SR23)                   | 400 `invalid answer`; `deniedParticipate`; 404 element or tab; 409; 413 |

`AnswerRequest` (JSON object, unknown fields ignored), one of:

```ts
type AnswerRequest =
  | { kind: 'vote'; elementId: string; delta: 1 | -1; round?: string }
  | { kind: 'response'; elementId: string; value: string | null; round?: string }
  | { kind: 'idea'; elementId: string; text: string; round?: string };
```

The route builds the room op from it: `{ kind: 'vote', tabId, elementId, voter: key, delta, round }` or
`{ kind: 'el-delta', tabId, elementId, delta: { kind: 'response', participantId: key, value, at: now, round } }`
or `{ kind: 'el-delta', tabId, elementId, delta: { kind: 'idea', text, round } }`, where `key` is
`collabKeyFor(id, ctx.resolveOwner())`. `value` and `text` are bounded as the element types bound them (the
response value cap, `IDEA_MAX_TEXT`); anything else is 400. Room internal: `POST /participation { tabId, op }`
answers `{ changed }` or `{ error: 'participation_write_failed' }` with the write's status.

`deniedParticipate(ctx, liveDoc, tabId)`: no grant, 403; a grant confined to another tab, 404; an effective
level of view, 403.

The token write choke point (`apps/api/src/index.ts`), for a token presenting `POST`, `PUT` or `DELETE`:

| Token level | Admitted                                         | Refusal                             |
| ----------- | ------------------------------------------------ | ----------------------------------- |
| view        | `isEveryLevelTokenWrite`                         | 403 `read_only_token` (SR10)        |
| participate | `isEveryLevelTokenWrite`, `isParticipationWrite` | 403 `participate_only_token` (SR10) |
| edit        | every write                                      | none                                |

- `isEveryLevelTokenWrite`: `DELETE /api/tokens/current`.
- `isParticipationWrite`, under `/api/documents/:id/tabs/:tabId/`: `POST comments`, `DELETE comments/:id`,
  `POST comments/:id/reply`, `POST comments/:id/resolve`, `POST comments/:id/reopen`, `PUT presence`,
  `DELETE presence`, `POST qa`, `POST answers`. The route behind each then gates with the ceiling, so a participate
  token's running Q&A action is refused at the route.
- `requiredTokenLevel(method, segments)` returns view for reads and every-level writes, participate for a
  participation write, edit otherwise; the choke point and OpenAPI's `x-token-level` both read it (SR11).

Room upgrade: `X-Verified-Role` carries the effective level; `X-Verified-Owner` is `1` for a personal owner's `?o=`
upgrade (unchanged, with #352's refusal of an account id) and for a ticket whose `owner` is `1`;
`X-Verified-Collab-Key` carries the ticket's `collab_key`, empty without a ticket. The ticket mint sets
`owner = holdsPower(ctx, liveDoc, 'take-back-baton') && level === 'edit'` and
`collab_key = collabKeyFor(id, ctx.resolveOwner())`.

MCP: `share_document.role` is `z.enum(['view', 'participate', 'edit']).optional()`, default `participate`; the output
schema's `role` enum matches. Description: `"participate" (default): recipients read it, comment and take part in
sessions, and cannot change it. "view": they only look. "edit": they can also change it.`

OpenAPI: `AccessLevel` replaces `ShareRole`; `ApiToken.role`; the share summary reads "Create a share link (view,
participate or edit, optional expiry)."; `POST /tokens` documents `role`; the room-ticket answer documents `collabKey`;
`POST /documents/{id}/tabs/{tabId}/answers` is a token-usable operation with the `AnswerRequest` schema; every
token-usable operation carries `x-token-level`.

## Data and persistence

| Field                                          | Class      | Notes                                                                                 |
| ---------------------------------------------- | ---------- | ------------------------------------------------------------------------------------- |
| `share_links.role`                             | credential | `CHECK (role IN ('view', 'participate', 'edit'))`                                     |
| `shared_with.role`                             | derived    | Same CHECK; joined to `share_links.role` by the Shared lists                          |
| `ws_tickets.role`                              | ephemeral  | The effective level; no CHECK                                                         |
| `ws_tickets.owner`                             | ephemeral  | `INTEGER NOT NULL DEFAULT 0`; the baton take-back bit                                 |
| `ws_tickets.collab_key`                        | ephemeral  | `TEXT NULL`; the derived key, 60 s like the ticket                                    |
| `api_tokens.role`                              | credential | `TEXT NOT NULL DEFAULT 'view' CHECK (role IN ('view', 'participate', 'edit'))` (SR13) |
| `api_tokens.read_only`                         | legacy     | Written as `role === 'edit' ? 0 : 1` in release 2; dropped in release 3               |
| Tab `vote.votes`, element `responses`, `ideas` | state      | Written by the room for sessions below edit; by an editor's save as before            |
| Room attachment `pinnedKey`                    | ephemeral  | Per socket, from `X-Verified-Collab-Key`, survives hibernation                        |
| Timeline share snapshots, telemetry rows       | history    | Unchanged (SR14)                                                                      |

Migration `0068_access_levels.sql`, one batch:

1. `share_links` rebuild: `CREATE TABLE share_links_new (code TEXT PRIMARY KEY, document_id TEXT NOT NULL, role TEXT
NOT NULL CHECK (role IN ('view', 'participate', 'edit')), created_at INTEGER NOT NULL, expiry TEXT NULL, expires_at
INTEGER NULL, tab_id TEXT NULL, FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE)`; copy with
   `CASE role WHEN 'view' THEN 'participate' ELSE role END`; drop; rename; recreate
   `idx_share_links_document_created` and `idx_share_links_document_role_created`. A child table only.
2. `shared_with` rebuild the same way (`owner_id, document_id, role, last_seen, tab_id`, primary key
   `(owner_id, document_id)`, the same foreign key, `view` to `participate`); recreate `shared_with_by_owner`.
3. `UPDATE ws_tickets SET role = 'participate' WHERE role = 'view'`; `ALTER TABLE ws_tickets ADD COLUMN owner INTEGER
NOT NULL DEFAULT 0`; `ALTER TABLE ws_tickets ADD COLUMN collab_key TEXT NULL`.
4. `ALTER TABLE api_tokens ADD COLUMN role TEXT NOT NULL DEFAULT 'view' CHECK (...)`;
   `UPDATE api_tokens SET role = CASE read_only WHEN 1 THEN 'view' ELSE 'edit' END`.

Release 3: `ALTER TABLE api_tokens DROP COLUMN read_only`.

Participation persistence: the room writes through the same queue as Q&A board writes (`tabWriteQueue`, formerly
`qaQueue`, SR15), one write at a time per document, compare-and-swap on the tab's stored data against an editor's
autosave and a linked tab's other room; `TAB_CAS_MAX_ATTEMPTS = 8`, shared with `writeQaAction`. The sequenced op
also enters the ledger, so an editor save snapshotted before it merges it back (phase 3). Snapshot and restore are
the rows themselves; account deletion and guest migration carry levels unchanged; Offline Mode stores no level and
its holder is the owner (C19).

## Errors and edge cases

- **E1** `POST /share` with `role: 'admin'`, `null` or a number: 400, nothing written.
- **E2** An editor bundle older than release 1 opens a `participate` link: it reads edit, renders editing, its first
  save is refused 403 and `writesForbiddenRef` stops the autosave; the soak (SR3) makes this rare.
- **E3** A release-1 bundle (or any bundle older than release 2) creates a `view` link after the migration: a
  Viewer link, look-only.
- **E4** A release-1 worker mints a full token in release 2's deploy window: the row defaults to `view` (fail
  closed, SR13); its owner sees the View badge and mints again.
- **E5** A consent page older than release 2 posts `readOnly: true`: 400; nothing is minted (SR9).
- **E6** A view token presents any write but `DELETE /api/tokens/current`: 403 `read_only_token`.
- **E7** A participate token presents a changeset, tab PUT, document create, image, room-ticket mint or share
  write: 403 `participate_only_token`; it reads `GET /share`: 403 (no `share` power).
- **E8** An edit token whose owner holds only a Participant link to the document (`X-Share-Code`): effective
  participate; content writes 403 at the route.
- **E9** A non-editor socket sends a `vote` naming another person's key: dropped, logged.
- **E10** A non-editor casts a dot past `votesPerPerson`, or into a closed or other round: `unchanged`; nothing
  relayed.
- **E11** The participation write loses the compare-and-swap `TAB_CAS_MAX_ATTEMPTS` times, the tab is gone (404),
  or the tab is over its cap (413): the sender gets `catchup { resync: true }`; the op is never relayed.
- **E12** The tab is deleted while a write is queued: 404, as E11.
- **E13** A Viewer socket sends `poll-answer`, `vote`, `response` or `idea`: dropped; no tally, no ledger entry.
- **E14** A Participant socket sends `tab`, `el`, `check`, `drag-preview`, `poll-start` or a `comment-*` delta:
  dropped.
- **E15** A session below edit upgraded without a ticket (an older bundle's `?s=`): no `pinnedKey`, so it may answer
  nothing keyed; ideas, comments and Q&A still work. Its next connect from a current bundle mints a ticket.
- **E16** An attachment written by release 1 (no `pinnedKey`): as E15 until the socket reconnects.
- **E23** Answers saved before release 2 are keyed by the old browser-minted key: they stay in tallies but no
  longer match their author, who sees them as someone else's; a Done check or estimate's next clear starts clean.
- **E24** The ticket mint fails (network, 5xx): the editor connects without a ticket, as E15, and retries the mint
  on its next reconnect; a guest's answers wait (`participationBlocked`) until a `collabKey` is held.
- **E25** `POST .../answers` with an unknown `kind`, a missing `elementId`, `delta` not 1 or -1, or an oversized
  value or text: 400 `invalid answer`; any `voter` or `participantId` in the body is ignored.
- **E26** A participate token's answer to a closed vote or another round: 200 `{ changed: false }`.
- **E27** A teammate's `DELETE` with the offline conversion: the document goes to the Trash; only the owner takes
  it offline (`take-offline`).
- **E17** An embed of a Participant link: renders as a Viewer; a crafted embed client could still take part at the
  link's level, as a plain link holder can.
- **E18** The view preview while a poll runs: the sheet shows no answer controls; toggling back restores them.
- **E19** A tab-scoped Participant link: participation doors and ops on its own tab only; other tabs 404 through
  `deniedParticipate`. `poll-answer` has no tab and is admitted as today.
- **E20** A Shared-with-you entry after the migration: row and link both read `participate`; the join finds the
  code.
- **E21** A read-only token minted before release 2: `role = 'view'`, same abilities, View badge.
- **E22** An old MCP client with a cached schema sends `role: 'view'`, meaning the old link: it gets a Viewer link.

## Security and trust

- Every level is enforced on the server: REST gates through the grant and its ceiling, tokens again at the choke
  point, the room by op class. Ownership doors ask both questions (I4).
- Readers fail closed (I3) and old readers never see `participate` read as edit (Delivery).
- A non-editor writes only under its pinned key (I5), and that key is the server's: derived from the caller's
  verified or signed identity and the document, carried in a ticket only that caller could mint, never read from a
  hello or a body. Holding a colleague's published key gains nothing: the room checks ops against the socket's own
  pinned key, and the answers route derives the key itself.
- A guest's derived key rests on the guest id, so it is exactly as strong as the guest credential (signed when
  `GUEST_ID_HMAC_SECRET` is set, Public API and API tokens §4).
- A non-editor's answer is validated against the stored state (rounds, budget, idea cap) before anyone sees it (I6).
- Comment authorship stays server-stamped: comments from sessions below edit go through REST only.
- The baton stays edit-only; the owner's take-back now reaches team documents through the ticket's `owner` bit.
- A view or participate token holds no ownership: it cannot list share codes or the password, create links, or
  delete. An edit token holds the owner's powers except administration.
- Embeds render as Viewers below edit, so an embed on a public page offers no anonymous ballot box (C8).
- Rate limits: participation REST writes ride the per-owner and per-token write limiter; socket ops ride the room's
  frame cap (`OP_RATE_CAP`).

## Performance and limits

- `classifyRoomOp` is a constant-time lookup on `op.kind` and, for `el-delta`, `delta.kind`.
- A non-editor's dot or answer costs one D1 read and one compare-and-swap write, serialised per document behind the
  same queue as the Q&A board. A retro of 30 casting 5 dots each is 150 writes over a minute, about 2.5 a second,
  well inside one room's throughput; each relay waits for its write (tens of milliseconds).
- Editors' answers add no D1 writes (their autosave and the ledger, as today).
- Every session now mints a room ticket: one extra REST round trip and one D1 insert per connect for guest and
  share-link sessions that skipped it before; the ticket mint is exempt from the write rate limit already.
- `collabKeyFor` is one SHA-256 over under 200 bytes per mint or answer.
- The migration copies `share_links` and `shared_with` once and touches two small tables; no index is lost.

## Presentation and UX

Share dialog cards, in `LEVEL_ORDER` ([spec](../share-roles.md#share-links)):

| Level       | Title / blurb                                                                 | Stub          | Glyph              | Solid (stub, tile, check)                        | Selected card                                                                    |
| ----------- | ----------------------------------------------------------------------------- | ------------- | ------------------ | ------------------------------------------------ | -------------------------------------------------------------------------------- |
| edit        | **Editor** / "Draws with you in real time."                                   | `EDITOR`      | `lucidePencilLine` | `bg-brand-700 text-white dark:bg-brand-700/60`   | `border-brand-600 bg-brand-50/70 dark:border-brand-400 dark:bg-brand-500/10`     |
| participate | **Participant** / "Comments, votes and takes part. Can't change the drawing." | `PARTICIPANT` | `lucideVote`       | `bg-teal-700 text-white dark:bg-teal-600/60`     | `border-teal-600 bg-teal-50/70 dark:border-teal-400 dark:bg-teal-500/10`         |
| view        | **Viewer** / "Watches, pans and zooms. Can't comment or change a thing."      | `VIEWER`      | `lucideEye`        | `bg-violet-600 text-white dark:bg-violet-500/60` | `border-violet-500 bg-violet-50/70 dark:border-violet-400 dark:bg-violet-500/10` |

- Teal and the ballot glyph for Participant (SR16); the Editor and Viewer solids darken to pass AA.
- One column below `sm`, three from `sm` (`sm:grid-cols-3`); the stub widens from `w-16` to `w-24` so `PARTICIPANT`
  fits (SR17).
- Pass link field names: "Edit pass link", "Participate pass link", "View pass link".
- The Embed hover line: edit "This edit pass embeds an editable canvas."; any other "This pass embeds a look-only
  canvas."

Role pill (`RolePill`, `RoleStatusIcon`):

| Level       | Word          | Pill tone                                                          | Icon               | Icon label          |
| ----------- | ------------- | ------------------------------------------------------------------ | ------------------ | ------------------- |
| edit        | Editing       | emerald (unchanged)                                                | `PencilIcon`       | Editing             |
| participate | Participating | `bg-teal-100 text-teal-800 dark:bg-teal-500/15 dark:text-teal-200` | `lucideVote` glyph | Participating       |
| view        | Viewing       | amber (unchanged)                                                  | `EyeIcon`          | Viewing (read-only) |

A Participant's pill is static, as a Viewer's.

Editor surfaces by level (the server is the rule):

| Surface                                                        | view                         | participate                             | edit             |
| -------------------------------------------------------------- | ---------------------------- | --------------------------------------- | ---------------- |
| Comment threads, comment panel                                 | read; no composer, no verbs  | add, reply, resolve, reopen, delete own | all              |
| Dots, estimate, temperature, Done check, quiz, idea box        | read-only faces              | answer                                  | answer, run      |
| Live poll sheet                                                | the question, no controls    | answer                                  | answer, run      |
| Q&A board                                                      | read                         | add, upvote                             | add, upvote, run |
| Laser, reactions, avatar, follow, Bring Focus, present, export | yes                          | yes                                     | yes              |
| Palette, element editing, checklist ticks, autosave            | none                         | none                                    | all              |
| Delete document (palette)                                      | with the `delete` power only | with the `delete` power only            | with the power   |

- The editor offers reactions at every level (`onFireReaction` no longer keys off `isReadOnly`), as the spec's
  Viewer row lists them.
- Badges: "Editor", "Participant", "Viewer". Explorer Shared-with-you chip: "Edit", "Participate", "View".
- Token level control (consent screen and Settings composer), from `TOKEN_LEVEL_OPTIONS`, Edit selected first:
  **Edit** "Reads, takes part, changes your documents and manages their share links.", **Participate** "Reads,
  comments and answers session tools. Changes nothing.", **View** "Reads only." Token card badge: "View" or
  "Participate"; none for Edit.

Help articles updated: `getting-started/sharing-your-document`, `collaboration/sharing`,
`collaboration/sharing/embeds`, `collaboration/comments`, `collaboration/session-tools`,
`collaboration/session-tools/polls`, `collaboration/session-tools/voting`, `collaboration/facilitator`,
`palette/collaborate`, `palette/collaborate/qa-boards`, `palette/collaborate/quizzes`,
`palette/behaviour/session-buttons`, `account-and-data/connect-ai-mcp`, `account-and-data/api-tokens`,
`troubleshooting/collaboration-issues`, `canvas/notes`; "view-only" meaning "cannot edit" reads "without edit
access" in `tips-and-tricks/copy-and-paste`, `tips-and-tricks/format-painter`, `search-panel/.../command-palette`.

### Specs renamed in the same change

Where a spec's "view role" describes commenting, answering a poll or the Q&A board, it becomes Participant; where
it means "cannot edit", it becomes "below Editor"; where it describes looking, it stays Viewer. Participant:
`015-api/api.md`, `public-api-and-tokens.md`, `mcp-server.md`, `cli.md`, `013-workspace/embeds.md`,
`tab-scoped-share-links.md`, `trash.md`, `timeline.md`, `activity-page.md`, `007-editor/live-app.md`,
`012-collaboration/live-poll.md`, `qa-board.md`, `README.md`, `session-tools.md`, `session-button.md`,
`participant-responses.md`, `quiz.md`, `idea-box.md`, `done-check.md`, `roll-call.md`, `temperature-check.md`,
`collab-race-hardening.md`, `realtime-conflict-resolution.md`, `comment-mentions.md`, `assigned-actions.md`,
`facilitator.md`, `014-identity/auth-and-guest-access.md`, `017-telemetry/telemetry.md`. Below Editor:
`008-canvas/canvas-and-palette.md`, `quick-style-panel.md`, `009-elements/annotations.md`, `rich-text-notes.md`,
`mind-node.md`, `checklist.md`, `006-document/per-tab-storage.md`, `007-editor/editor-modes.md`,
`ai-assistance.md`, `power-user-mode.md`, `zen-mode.md`, `013-workspace/shape-libraries.md`,
`020-import-export/markdown-import.md`, `021-event-storming/event-storming.md`, `023-draw-mode/draw-mode.md`,
`012-collaboration/action-panel.md`. Blueprints: `013-workspace/blueprints/default-folders.md`.

## Accessibility

- The cards are one `role="radiogroup"` ("What the pass lets people do") of `role="radio"` cards with
  `aria-checked`, roving `tabIndex`, wrapping arrows, Home and End; each card stays well above 24 by 24 px.
- Text contrast, 10 px bold stub words (4.5:1): white on `brand-700` 5.93, `teal-700` 5.47, `violet-600` 5.70;
  dark: white on `brand-700/60` 9.15, `teal-600/60` 6.76, `violet-500/60` 7.41 over the dark pass (`#16202e`).
  Pill: `teal-800` on `teal-100` 6.73. Non-text 3:1: selected borders `brand-600` 4.10, `teal-600` 3.74,
  `violet-500` 4.23 against white; dark borders 6.0 and above. The Steel dark overrides of `brand-*` are covered
  by the contrast audit (Testing).
- Never colour alone: each level has its own word and glyph on the card, the stub and the pill.
- The pill's accessible name keeps its pattern ("Participating. Owned by Ada"); the icon's label is the word.
- The token level control is a native-semantics radio group with a visible label and focus ring.
- A Viewer's missing composer and poll controls are absent, not disabled-and-unexplained; the thread and the poll
  question read as content.
- Nothing new moves.

## Web Experience

- The Share dialog is a lazy chunk; a third card adds no request and no image. Column counts are fixed per
  breakpoint, so nothing reflows after paint (CLS).
- The pill sits at the end of the title row; its longer word shifts nothing after it.
- A non-editor's answer waits for its D1 write before peers see it; the sender's own screen applies it at once, so
  INP is unchanged.

## Observability

| Fingerprint                                                                     | Where                                          |
| ------------------------------------------------------------------------------- | ---------------------------------------------- |
| `[access-levels] token write refused <tokenId> <level> <method> <path>`         | api, choke point (warn)                        |
| `[access-levels] participation refused <documentId> <tabId> <level>`            | api, `deniedParticipate`                       |
| `[access-levels] ownership refused <documentId> <power> <reason>`               | api, `holdsPower` (info)                       |
| `[access-levels] invalid role <value>`                                          | api, share and token mint                      |
| `[access-levels] unknown stored level <table> <value>`                          | api, `parseStoredLevel` callers (error)        |
| `[access-levels] retired readOnly field`                                        | api, tokens and oauth (warn)                   |
| `[room] op refused <kind> <level> <minimum>`                                    | room (debug, sampled 1 in 100, SR18)           |
| `[room] answer key mismatch <kind> <presenceId>`                                | room (warn)                                    |
| `[participation-write] applied <documentId> <tabId> <kind>`                     | room (debug)                                   |
| `[participation-write] unchanged <documentId> <tabId> <kind>`                   | room (debug)                                   |
| `[participation-write] failed <documentId> <tabId> <status>`                    | room (error)                                   |
| `[answers] <changed\|unchanged\|failed> <documentId> <tabId> <kind> <tokenId?>` | api, answers route                             |
| `[collab-key] ticket without key <documentId>`                                  | api, ticket mint when no owner resolves (warn) |
| `[role] view preview <bool>`                                                    | editor (existing)                              |
| `Http403.<Action>.ParticipateOnlyToken` / `ReadOnlyToken`                       | MCP and editor error telemetry                 |

Telemetry: `Document·Shared` and `Document·Joined` take `Participate` (`LEVEL_TELEMETRY_TYPE`), the client emit before
the request as today. The dashboard adds `PARTICIPATE_LINKS_SHARED` and `PARTICIPANTS_JOINED` beside their siblings;
`SHARE_SETTINGS` excludes `Participate`; the View metrics' blurbs and `event-explanations.ts` carry the cut-over
note "Before {ACCESS_LEVELS_MIGRATED_ON}, View counted links that are now Participant." (SR19).

## Testing

| Rule                                                                                                                                   | Test                                                                                                                            |
| -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| The ladder, `parseStoredLevel` fail closed, telemetry types                                                                            | `packages/api-schema/src/access-levels.test.ts` (planned) (new)                                                                 |
| Every op kind and delta kind classified; unknown is edit; the three lists disjoint                                                     | `packages/api-schema/src/room-op-classes.test.ts` (planned) (new)                                                               |
| Editor and room share the vocabulary                                                                                                   | `apps/live/app/document/[id]/room-op-vocabulary.test.ts`                                                                        |
| Release-1 readers: `participate` reads as non-edit, unknown as view                                                                    | `apps/api/src/share-link-row.test.ts`, `db/ws-tickets.test.ts`, `document-room-rules.test.ts`                                   |
| Migration 0068: links, visits, tickets, tokens, indexes                                                                                | `apps/api/src/db/legacy-migration-0067.test.ts` (planned) (new, real SQLite)                                                    |
| Grant ceiling for owner, member, link, token, token over link                                                                          | `apps/api/src/auth/document-access.test.ts`                                                                                     |
| Ownership powers by caller and token level                                                                                             | `apps/api/src/auth/ownership.test.ts` (planned) (new)                                                                           |
| Choke point table                                                                                                                      | `apps/api/src/auth/token-level-gate.test.ts` (planned) (new), `apps/api/src/index.test.ts`                                      |
| Every door by level: reads, participation, Q&A split, content, ownership                                                               | `apps/api/src/routes/access-level-doors.test.ts` (planned) (new, SR20)                                                          |
| Share and token mint validation; retired `readOnly`                                                                                    | `routes/document-share-routes.test.ts`, `routes/tokens.test.ts`, `routes/oauth.test.ts`                                         |
| Key derivation: stable, per document, per identity; length                                                                             | `apps/api/src/collab-key.test.ts` (planned) (new)                                                                               |
| Ticket carries the key; upgrade pins it; hello cannot replace it                                                                       | `apps/api/src/routes/document-room-routes.test.ts`, `apps/api/src/document-room-rules.test.ts`                                  |
| Answers route: gate, body parse, derived key, room hand-off, every failure                                                             | `apps/api/src/routes/answers-route.test.ts` (planned) (new)                                                                     |
| Room gate per class and level; key pinning and mismatch                                                                                | `apps/api/src/document-room.test.ts`                                                                                            |
| Participation write: apply, unchanged, CAS retry, 404, 409, 413, resync frame                                                          | `apps/api/src/participation-write.test.ts` (planned) (new), `document-room.test.ts`                                             |
| Ticket owner bit; team owner takes the baton back; baton edit-only                                                                     | `apps/api/src/routes/document-room-routes.test.ts`, `facilitator.test.ts`                                                       |
| `Document·Joined` type                                                                                                                 | `apps/api/src/routes/share.test.ts`                                                                                             |
| OpenAPI enums, `ApiToken.role`, `x-token-level` from one source                                                                        | `apps/api/src/openapi/*.test.ts`                                                                                                |
| MCP default and enum                                                                                                                   | `apps/mcp/src/tools.test.ts`                                                                                                    |
| Three cards, copy, keys, issue per level                                                                                               | `apps/live/components/dialogs/ShareDialog.test.tsx`                                                                             |
| Pill per level, toggle two-state                                                                                                       | `apps/live/components/chrome/RoleIndicator.test.tsx`                                                                            |
| `canEdit`, `canTakePart`, preview, embed cap                                                                                           | `apps/live/app/document/[id]/useViewPreview.test.ts` (planned) (new), `editor-page-helpers.test.ts`                             |
| Handlers refuse while `participationBlocked`                                                                                           | `apps/live/hooks/persistence/useTabSession.test.ts`, `hooks/canvas/useCollabElements.test.ts` (planned) (new)                   |
| Comment popover per level; REST path below edit                                                                                        | `apps/live/components/panels/CommentThreadPopover.test.tsx`                                                                     |
| Only an Editor's selection holds                                                                                                       | `apps/live/lib/presence-rows.test.ts`                                                                                           |
| Done check and roll call count only those who take part                                                                                | `apps/live/lib/collaborator-roster.test.ts`, `DoneCheckFace.test.tsx`                                                           |
| Token level control and badge                                                                                                          | `apps/live/components/dialogs/settings/SettingsTokensRow.test.tsx`, `apps/live/app/oauth/consent/page.test.tsx` (planned) (new) |
| Contrast of every stub, card border and pill, both schemes                                                                             | `apps/live/e2e/contrast-audit.spec.ts` (Share dialog and pill screens)                                                          |
| End to end, dark: a Participant link votes, answers and comments, and a reload keeps them with no editor present; a Viewer link cannot | `apps/live/e2e/access-levels.spec.ts` (planned) (new)                                                                           |
| Dashboard metrics and explanations                                                                                                     | `apps/telemetry` catalogue and explanation suites                                                                               |

## Constants and configuration

| Constant                    | Value                             | Provenance                     | Safe range          |
| --------------------------- | --------------------------------- | ------------------------------ | ------------------- |
| `ACCESS_LEVELS`             | `['view', 'participate', 'edit']` | Spec, ascending                | fixed               |
| `DEFAULT_LINK_LEVEL`        | `'edit'`                          | Spec: an omitted role is edit  | fixed               |
| `DEFAULT_TOKEN_LEVEL`       | `'edit'`                          | Spec: edit is the default      | fixed               |
| `DEFAULT_MCP_SHARE_LEVEL`   | `'participate'`                   | Spec                           | fixed               |
| `LEVEL_ORDER`               | `['edit', 'participate', 'view']` | Spec's card order              | fixed               |
| `PARTICIPATION_OP_KINDS`    | `['poll-answer', 'vote']`         | Spec's participation acts      | grows with the spec |
| `PARTICIPATION_DELTA_KINDS` | `['response', 'idea']`            | Spec's participation acts      | grows with the spec |
| `TAB_CAS_MAX_ATTEMPTS`      | 8                                 | The Q&A write's existing bound | 3 to 20             |
| `COLLAB_KEY_LENGTH`         | 22                                | 132 bits of base64url (SR22)   | 16 to 43            |
| `ACCESS_LEVELS_SOAK_DAYS`   | 7                                 | SR3                            | 1 to 30             |
| `ACCESS_LEVELS_MIGRATED_ON` | release 2's deploy date           | SR19                           | fixed once shipped  |
| Room refusal log sampling   | 1 in 100                          | SR18                           | 1 to 1000           |

No new environment variable or binding; self-hosting needs migration 0068 and, later, the contract migration.

## Assets and external resources

No new asset. The Participant glyph is `lucideVote` and the Viewer glyph `lucideEye`, both already vendored in
`packages/icons/src/lucide.generated.ts` from Lucide (ISC licence) by `packages/icons/scripts/vendor-lucide.ts`.

## Defaults ledger

SR1 to SR24 in [DEFAULTS.md](DEFAULTS.md).
