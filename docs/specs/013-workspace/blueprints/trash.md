# Trash: blueprint

Derived from [Trash](../trash.md), with the delete authority of
[Team shared documents](../team-shared-documents.md), the removal of
[Tab ↔ document many-to-many](../../006-document/tab-document-many-to-many.md), the local store of
[Offline Mode](../../006-document/offline-mode.md) and the room of [API](../../015-api/api.md). The spec
decides; this file only adds engineering precision. Defaults applied where the spec is silent are ledgered
in [DEFAULTS.md](DEFAULTS.md) and cited as `Dn`.

Scope, by file:

| File                                                                             | Role                                                                                        |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `packages/api-schema/src/trash.ts`                                               | The clock and the wire: retention, days left, error code, close code, `TrashedDocument`     |
| `apps/api/migrations/0051_diagram_trash.sql`                                     | `documents.trashed_at` + the partial index                                                  |
| `apps/api/src/db/trash.ts`                                                       | `trashDocument`, `restoreDocument`, `purgeDocuments`, `purgeExpiredTrash`, `listTrash`, ... |
| `apps/api/src/db/document-removal.ts`                                            | `documentRemovalStatements` takes `{ ids }` besides one id / one owner                      |
| `apps/api/src/db/documents.ts`                                                   | `getDocument`, `getDocumentMeta`, both lists: live rows only                                |
| `apps/api/src/db/{shared,favourites,collab-index,tabs,timeline}.ts`              | The reads that leave trashed documents out; `documentsTimelineSweepStatement`               |
| `apps/api/src/timeline/expiry-sweep.ts`                                          | No expiry warning for a trashed document's links                                            |
| `apps/api/src/routes/context.ts`                                                 | `missingDocument`: 410 or 404 on a miss; the guards use it                                  |
| `apps/api/src/routes/document-delete-route.ts`                                   | `DELETE /api/documents/:id`: trash, `?permanent=true`, Take Offline                         |
| `apps/api/src/routes/trash.ts`                                                   | `/api/trash` list, restore, purge one, empty                                                |
| `apps/api/src/routes/{documents,share,document-room-routes,...}.ts`              | The doors: 410 through `missingDocument`; the ws upgrade refuses                            |
| `apps/api/src/room-client.ts`, `document-room.ts`, `room-scope.ts`               | `broadcastDocumentTrashed`; the room closes every socket with 4004                          |
| `apps/api/src/index.ts`, `auth/guest-rest.ts`                                    | `trash` dispatch + guest-signature scope; the cron's `purgeExpiredTrash`                    |
| `apps/api/src/openapi/manifest.ts`, `document.ts`, `scripts/gen-openapi-...`     | The Trash tag and routes; 410 on the document doors; `TrashedDocument` schema               |
| `apps/mcp/src/{tools,schema}.ts`                                                 | `delete_document` to the Trash only; `list_trash`, `restore_document`                       |
| `apps/live/lib/api/trash.ts`                                                     | `apiListTrash`, `apiRestoreDocument`, `apiPurgeDocument`, `apiEmptyTrash`                   |
| `apps/live/lib/offline/offline-trash.ts`, `offline-store.ts`                     | The local Trash on the IndexedDB record                                                     |
| `apps/live/lib/document-trashed.ts`, `document-tombstones.ts`                    | `DocumentTrashedError`, `isDocumentTrashedError`; `unmarkDocumentDeleted`                   |
| `apps/live/lib/trash-groups.ts`, `trash-copy.ts`                                 | Grouping and days-left copy; the confirmation line                                          |
| `apps/live/hooks/persistence/useTrash.ts`, `components/panels/TrashPane.tsx`     | The Trash view                                                                              |
| `apps/live/app/explorer/{TrashSection.tsx,trash/page.tsx,routes.ts,views.tsx}`   | The `/explorer/trash` route, no sidebar row                                                 |
| `apps/live/components/dialogs/settings/{settings-catalogue.ts,SettingsTrashRow}` | Settings › Account › Trash, the one way in                                                  |
| `apps/live/app/document/[id]/{useDocumentTrashed,useIdentityBootstrap,...}.ts`   | The deleted state: load, room, autosave                                                     |
| `apps/live/components/chrome/DocumentTrashedCard.tsx`, `editor-page.tsx`         | The deleted card, Restore when allowed                                                      |
| `apps/help/app/account-and-data/trash/page.mdx`, help registry, article icon     | The help article                                                                            |
| `apps/telemetry/app/catalogue/{content,connections}.ts`, explanations, vocab     | The Trash stack; the two MCP tool charts                                                    |

## Domain and naming

| Term               | Identifier                                                    | Meaning                                              |
| ------------------ | ------------------------------------------------------------- | ---------------------------------------------------- |
| Trash              | `trash` (route segment, telemetry category `Trash`)           | Where a deleted document waits                       |
| Trashed            | `documents.trashed_at` (epoch ms), `trashedAt`                | In the Trash since that time; NULL / absent = live   |
| Trash (verb)       | `trashDocument`, `offlineTrashDocument`                       | Move a live document in                              |
| Restore            | `restoreDocument`, `apiRestoreDocument`, `restore_document`   | Bring it back to its place                           |
| Purge              | `purgeDocuments`, `apiPurgeDocument`, `offlinePurgeDocument`  | Remove for good, through `documentRemovalStatements` |
| Empty Trash        | `apiEmptyTrash(scope)`, `DELETE /api/trash[?team=]`           | Purge one group                                      |
| Group / scope      | `TrashGroup`, `TrashScope` (`personal`, `team`, `local`)      | One Trash in the view; one Empty Trash               |
| Local Trash        | `offline-trash.ts`                                            | This browser's, for Offline Mode records             |
| Retention          | `TRASH_RETENTION_DAYS` / `TRASH_RETENTION_MS`                 | 30 days                                              |
| Days left          | `trashDaysLeft`, `daysLeftLabel`                              | Whole days to the purge, rounded up, floor 0         |
| Deleted state      | `DOCUMENT_TRASHED_ERROR` (`document_trashed`), 410            | What a door answers an authorised caller             |
| Deleted card       | `DocumentTrashedCard`                                         | The editor's surface for it                          |
| Trashed op / close | `document-trashed` (system op), `DOCUMENT_TRASHED_CLOSE` 4004 | The room telling open sessions                       |
| Permanent          | `?permanent=true`                                             | REST only: trash + purge in one call                 |

Banned: "recycle bin", "bin" (except in the help article's keywords), "soft delete" in copy, "undelete",
"archive".

## Behaviour and state

A document is in exactly one of three states: **live** (`trashed_at IS NULL`), **trashed** (`trashed_at`
set), **gone** (no row). Offline records mirror it with `trashedAt` absent / set / record deleted.

| From    | Event                                                  | To      | Guard                                                  |
| ------- | ------------------------------------------------------ | ------- | ------------------------------------------------------ |
| live    | `DELETE /api/documents/:id`                            | trashed | `mayDeleteDocument`                                    |
| live    | `DELETE ...?permanent=true`                            | gone    | `mayDeleteDocument`; trash then purge                  |
| live    | owner's `DELETE` with `X-Document-Conversion: offline` | gone    | caller is the owner; `deleteDocument` (hard)           |
| live    | teammate's `DELETE` with the offline conversion        | trashed | the conversion is ignored for a non-owner              |
| live    | account deletion                                       | gone    | `deleteAccount`, owner selector, trashed rows included |
| trashed | `POST /api/trash/:id/restore`, `restore_document`      | live    | `mayDeleteDocument` on the trashed row                 |
| trashed | `DELETE /api/trash/:id`, `DELETE ...?permanent=true`   | gone    | `mayDeleteDocument`                                    |
| trashed | `DELETE /api/trash[?team=]`                            | gone    | personal: owner; team: joined member (verified id)     |
| trashed | daily cron, `trashed_at <= now - TRASH_RETENTION_MS`   | gone    | none                                                   |
| trashed | `DELETE /api/documents/:id` (plain)                    | trashed | answers 410; the first `trashed_at` stands             |

Invariants:

- **I1** Every document read used by a door (`getDocument`, `getDocumentMeta`) and every list sees live rows
  only. A trashed document is reachable solely through `db/trash.ts`.
- **I2** `purgeDocuments` only ever removes trashed rows (`trashedIdsIn` filters its input), so no caller can
  skip the Trash by naming an id. The permanent path trashes first.
- **I3** Trashing touches no child row: tabs, links, share links, stars, change log, collaboration index,
  Timeline events and image references all stay until the purge.
- **I4** Restore returns the document to `folder_id` only when that folder still exists in its scope (the
  owner's personal tree, or its team's); otherwise Unsorted. `team_id` and `owner_id` are unchanged.
- **I5** A trashed document cannot be written: every write door answers 410, the room refuses the upgrade,
  and the client stops its autosave (`writesForbiddenRef`) on the first 410.
- **I6** The local Trash follows the same clock: `isTrashExpired(trashedAt, now)`.

Client state: `useDocumentTrashed` holds `trashed` (set by the load's 410 / `DocumentTrashedError`, the room's
`document-trashed` op from `system`, the 4004 close, or an autosave 410) and `restorable` (the reader's own
Trash row for the id, read once `trashed` is set, never for a share-link session). The editor page renders
the deleted card ahead of every other status while `trashed` is true.

## Interfaces and contracts

REST (all `guest-or-clerk`, token-usable; a read-only token may only `GET`):

| Method | Path                                | Success                                       | Failures                                                                        |
| ------ | ----------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------- |
| DELETE | `/api/documents/:id`                | 204                                           | 400 no caller; 404 missing / stranger; 403 no delete claim; 410 already trashed |
| DELETE | `/api/documents/:id?permanent=true` | 204                                           | 400; 404; 403                                                                   |
| GET    | `/api/trash`                        | 200 `{ trash: TrashedDocument[] }`            | 400                                                                             |
| POST   | `/api/trash/:id/restore`            | 200 `{ document }` (redacted for a non-owner) | 400; 404 (missing, live, or no claim)                                           |
| DELETE | `/api/trash/:id`                    | 204                                           | 400; 404                                                                        |
| DELETE | `/api/trash[?team=<id>]`            | 200 `{ purged: number }`                      | 400; 404 team not joined                                                        |

Every `/api/documents/:id/*` door and `/api/share/:code` (+ `image.svg`): 410 `{ error: 'document_trashed' }`
when the id is trashed and the caller has a grant (`gateGrant`), else 404. `/api/share/:code` answers 410 to
any holder of a live code (the code is the credential). `POST /api/documents` over a trashed id: 410 to its
owner, 403 otherwise, and nothing written. The ws upgrade: 404.

`TrashedDocument = { id, name, teamId, teamName, trashedAt, purgeAt }`; `purgeAt = trashedAt + 30 days`.

Room: `POST /broadcast { op: { kind: 'document-trashed' } }`, sent only for a document with a room (shareable
or in a team, D2). The room relays it (it is a `SYSTEM_OP_KINDS` member, refused from client sockets and
delivered to tab-scoped sessions) and then closes every socket with `4004, 'document-trashed'`.

MCP: `delete_document { documentId, tabId? }` → `{ deleted: 'document', documentId, trashed: true,
restorableForDays: 30 }`; `list_trash {}` → `{ trash: { id, name, library, deletedAt, purgeAt }[] }`;
`restore_document { documentId }` → `{ restored: 'document', id, name, url }`, a 404 as an `isError` result
pointing at `list_trash`. No permanent option.

Client: `apiListTrash(ownerId, now?) → { cloud: TrashedDocument[] | null, local: TrashedDocument[] }`
(`cloud: null` when unreachable); `apiRestoreDocument` / `apiPurgeDocument` dispatch on `isOfflineId`;
`apiEmptyTrash(ownerId, TrashScope)`. `connectRoom` handlers gain `onDocumentTrashed`; after a 4004 close it
stops reconnecting.

## Data and persistence

| Field                             | Class | Notes                                                         |
| --------------------------------- | ----- | ------------------------------------------------------------- |
| `documents.trashed_at`            | state | INTEGER NULL, epoch ms; partial index `documents_trashed_idx` |
| `OfflineDocumentRecord.trashedAt` | state | optional number; absent on every record written before it     |

Migration 0051 adds the column and index; every existing row is live (NULL). No backfill. 0050 belongs to
the image reference index; the two are independent (D1). Snapshot and restore are the row itself: nothing
is copied. Account deletion and guest-to-account migration act on `owner_id` and so carry trashed rows with
the rest. Deleting a team re-homes its trashed documents to their owners' personal Trash (`team_id = NULL`).

## Errors and edge cases

- **E1** Trash an already-trashed document: 410, `trashed_at` unchanged.
- **E2** Restore a live or missing id: 404; the offline form throws `not in the local Trash`.
- **E3** Restore after the folder was deleted: Unsorted (I4). After the team was deleted: the document is
  in its owner's personal Trash and restores there.
- **E4** Snapshot (R2) delete fails during a purge: the purge stands; `[trash] snapshot delete failed` warns.
- **E5** The room is unreachable when trashing: logged `[room-broadcast] document-trashed did not reach the
room`; open sessions still stop at their next save (I5).
- **E6** The cloud Trash is unreachable from the view: the local group still shows; a toast says so.
- **E7** A ticket minted before the delete: refused at the upgrade (I1).
- **E8** A tab shared with another document: untouched by the trash, kept by the purge.
- **E9** A purge backlog over one run's cap: oldest first, the rest the next day.
- **E10** A page-session tombstone for a restored document: cleared by `unmarkDocumentDeleted`.
- **E11** An owner re-creating (POST) a trashed id, e.g. a stale client: 410, nothing written.

## Security and trust

- The restore / purge / list authority is exactly `mayDeleteDocument`; team membership is read against the
  verified account id only (never `X-Owner-Id`). A share-link visitor never restores, purges or lists.
- The deleted state leaks nothing: 410 only to a caller with a grant; strangers get the 404 of a missing id.
- `POST /api/documents` over a trashed id cannot transfer ownership (the upsert would rewrite `owner_id`).
- `trash` is an owner-scoped segment for the guest signature gate.
- An AI tool cannot destroy a document: the MCP surface has no permanent delete.
- A forged `document-trashed` from a client socket is dropped by the room.

## Performance and limits

- Trash / restore: one UPDATE each. The list: one query over the partial index plus joins.
- The purge is set-based: per batch one `SELECT` (`trashedIdsIn`) and one D1 batch of three statements
  (the Timeline sweep and the two removal statements) over a `json_each` id list, plus one R2 bulk delete.
  `TRASH_PURGE_BATCH = 100`, `TRASH_PURGE_MAX_BATCHES = 20`: at most 2,000 purges and about 100 D1 queries
  and 20 R2 calls per cron run, far inside the 1,000 subrequests of one invocation.
- The Timeline filter adds a primary-key probe per event row read; the favourites read a probe per star.

## Presentation and UX

- The confirmation line, once, nowhere else: "It can be restored from Settings › Trash for 30 days." Team:
  "Any teammate can restore it from Settings › Trash for 30 days." Share links: "Its share links stop
  working, and visitors see that it was deleted." The "Document deleted" toast is unchanged.
- Settings › Account, section "Your Data", row "Trash" with an "Open Trash" link and the footnote "Deleted
  documents wait here for 30 days before they are removed for good. Restore one to put it back where it was."
- Trash view: intro, in an `InfoNote` (the small info-glyph note the Dynamic folders use), "Deleted documents wait here for 30 days, then they are removed for good. Restoring one
  puts it back where it was." Groups "Your documents", each team by name (A to Z), "This browser only" with
  "Offline documents, kept only in this browser." Row: name, "Deleted {d MMM} · {n} days left" ("1 day left",
  "Removed at the next clean-up" at 0). Actions "Restore" (no confirmation), "Delete permanently" and
  "Empty Trash" (confirm popovers: "Delete "{name}" for good? This cannot be undone." / "Delete {n}
  documents in {your Trash | {team}'s Trash, for the whole team | this browser's Trash} for good? ...").
  Loading "Loading…"; empty state "Nothing in the Trash right now" / "Delete a document and it is kept
  here for 30 days, so you can restore it."
- Deleted card: eyebrow "Deleted", title "This document was deleted"; allowed: "It is in the Trash ({n}
  days left). Restore it to put it back where it was." with Restore (then a reload); otherwise "It is no
  longer available. If it is restored, this link works again." Always "Go to Explorer".

## Accessibility

- Each group is a `section` labelled by its heading; row buttons carry the document's name ("Restore X",
  "Delete X permanently"). The Settings link is described by its footnote. The deleted card is a
  `role="alert"`; the restore failure line is a `role="status"`. Confirm popovers are the shared
  `ConfirmPopover` (Esc cancels, Enter confirms). Contrast rides the dark palette tokens already audited.

## Web Experience

- The Trash pane and the deleted card are lazy chunks (`dynamic`), outside the Explorer's and editor's
  first paint. The view reserves no layout that shifts: rows arrive with the list, the empty state replaces
  "Loading…" in the same slot. No image, so no LCP change.

## Observability

| Fingerprint                                                | Where                     |
| ---------------------------------------------------------- | ------------------------- |
| `[trash] trashed <id>`                                     | api, DELETE               |
| `[trash] deleted permanently <id>`                         | api, `?permanent=true`    |
| `[trash] bypassed for take offline <id>`                   | api, owner's Take Offline |
| `[trash] purged from the Trash <id>`                       | api, purge one            |
| `[trash] emptied <personal / team:id> <n>`                 | api, Empty Trash          |
| `[trash] restored <id>`                                    | api, restore              |
| `[trash] snapshot delete failed <n> <err>`                 | api, purge, warn          |
| `trash sweep: purged <n> documents` / `trash sweep failed` | api, cron                 |
| `[room-broadcast] document-trashed did not reach the room` | api, warn                 |
| `[trash] purged local <n>`                                 | editor, local sweep       |
| `[trash] cloud list failed`                                | editor, warn              |
| `[trash] open document is in the Trash`                    | editor                    |
| `Http410.<Action>.DocumentTrashed`                         | editor error telemetry    |

## Testing

| Rule                                                    | Test                                                       |
| ------------------------------------------------------- | ---------------------------------------------------------- |
| Clock, days left, expiry                                | `packages/api-schema/src/trash.test.ts`                    |
| Migration, trash / restore / purge / list / cron sweep  | `apps/api/src/db/trash.test.ts` (real SQLite)              |
| Timeline hidden and back, Activity, tab link, expiry    | `apps/api/src/db/trash-surfaces.test.ts`                   |
| Every door: 410 / 404 / lists / DELETE semantics / room | `apps/api/src/routes/trash-doors.test.ts`                  |
| `/api/trash` authority                                  | `apps/api/src/routes/trash.test.ts`                        |
| Cron wiring and log                                     | `apps/api/src/scheduled-trash.test.ts`                     |
| Room closes with 4004; never relays a client's op       | `apps/api/src/document-room.test.ts`, `room-scope.test.ts` |
| Permanent removal keeps shared tabs                     | `apps/api/src/db/document-delete.test.ts`                  |
| OpenAPI parity                                          | `apps/api/src/openapi/*.test.ts`                           |
| MCP tools                                               | `apps/mcp/src/tools.test.ts`                               |
| Local Trash                                             | `apps/live/lib/offline/offline-trash.test.ts`              |
| Client calls, dispatch, 410                             | `apps/live/lib/api/trash.test.ts`                          |
| Room client stops on 4004                               | `apps/live/lib/api/room.test.ts`                           |
| Grouping and copy                                       | `apps/live/lib/trash-groups.test.ts`                       |
| End to end                                              | `apps/live/e2e/trash.spec.ts`                              |
| Telemetry coverage and charts                           | `apps/live` telemetry tests, `apps/telemetry` suites       |

## Constants and configuration

| Constant                  | Value | Provenance                                | Safe range   |
| ------------------------- | ----- | ----------------------------------------- | ------------ |
| `TRASH_RETENTION_DAYS`    | 30    | Operator decision                         | 7 to 90      |
| `TRASH_PURGE_BATCH`       | 100   | ~4 KB bound per `json_each` list (D3)     | 10 to 500    |
| `TRASH_PURGE_MAX_BATCHES` | 20    | Well inside one invocation's query budget | 1 to 200     |
| `DOCUMENT_TRASHED_CLOSE`  | 4004  | Next free code beside 4003                | 4000 to 4999 |

No new environment variable or binding; self-hosting needs only the migration.

## Defaults ledger

D1 to D6 in [DEFAULTS.md](DEFAULTS.md).
