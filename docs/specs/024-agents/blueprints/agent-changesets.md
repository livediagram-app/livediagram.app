# Agent changesets: blueprint

Derived from [Agent changesets](../agent-changesets.md), with the room and persistence boundary of
[API](../../015-api/api.md), the tool contracts of [MCP server](../../015-api/mcp-server.md) §4.3a and §4.4, the
ledger merge of [Collaboration race hardening](../../012-collaboration/collab-race-hardening.md), the agent rule in
[Realtime conflict resolution](../../012-collaboration/realtime-conflict-resolution.md) (locked decision 3), the
attribution and person tag of [Agent presence](../agent-presence.md), the gates of
[Share roles](../../013-workspace/share-roles.md) and the `Agent` telemetry of
[Telemetry](../../017-telemetry/telemetry.md). The edit-operations engine and the diagram lint are dependencies,
consumed through the interfaces their blueprints export ([edit operations](edit-operations.md),
[diagram lint](diagram-lint.md)). The spec decides; this file only adds engineering precision. Defaults applied
where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and cited as `CSn`.

Scope, by file:

| File                                                                                      | Role                                                                                                       |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `packages/api-schema/src/changesets.ts`                                                   | Constants, header names, id pattern, error codes, wire types (CS35)                                        |
| `packages/api-schema/src/index.ts`                                                        | `TabRecord.rev`; re-exports `changesets.ts`                                                                |
| `packages/api-schema/src/room-messages.ts`                                                | `RoomOp` `changeset`; `select` gains `elementIds`; `SYSTEM_OP_KINDS` gains `changeset`                     |
| `packages/api-schema/src/telemetry-schema.ts`                                             | Category `Agent`; actions `Conflicted`, `Held` (`Applied`, `Reverted`, `Opened` exist)                     |
| `packages/document/src/element-fingerprint.ts`                                            | `canonicalElementJson`, `elementFingerprint`                                                               |
| `packages/document/src/comments.ts`                                                       | Exports `LIVE_ELEMENT_FIELDS`; `opForTheWire` strips comment author ids from a `changeset` op              |
| `packages/document/src/element-ops.ts`                                                    | `invertElementOps(before, ops)`, shared by the engine and the revert                                       |
| `apps/api/migrations/0066_agent_changesets.sql`                                           | `tabs.rev`, the `tabs_rev_advances` trigger, `agent_changesets`, `agent_changeset_parts`                   |
| `apps/api/src/tab-row.ts`                                                                 | `TabRow.rev`; `rowToTab` returns it                                                                        |
| `apps/api/src/db/tabs.ts`                                                                 | `getTab` reads `rev`; `upsertTab`, `seedTabs`, `swapTabData` advance it; new `upsertTabAtRev`, `renameTab` |
| `apps/api/src/db/documents.ts`                                                            | The copy's tab insert starts at `rev` 1                                                                    |
| `apps/api/src/db/changesets.ts`                                                           | Record and part statements; reads for the merge, the list, one changeset, the revert; the sweep            |
| `apps/api/src/db/account.ts`, `account-owner-columns.test.ts`                             | `agent_changesets.author_id` on deletion and guest migration                                               |
| `apps/api/src/changesets/changeset-id.ts`                                                 | `mintChangesetId`                                                                                          |
| `apps/api/src/changesets/base-check.ts`                                                   | `checkBase`, pure                                                                                          |
| `apps/api/src/changesets/held-check.ts`                                                   | `heldTargets`, pure                                                                                        |
| `apps/api/src/changesets/merge-on-save.ts`                                                | `mergeChangesetsIntoSave`, pure                                                                            |
| `apps/api/src/changesets/revert-plan.ts`                                                  | `planRevert`, pure                                                                                         |
| `apps/api/src/changesets/room-op.ts`                                                      | `changesetRoomOp`: the relay payload and its size rule                                                     |
| `apps/api/src/changesets/submit.ts`                                                       | `submitChangeset`: the pipeline, its attempt loop and the write                                            |
| `apps/api/src/changesets/front-door.ts`, `log.ts`                                         | `frontDoorOf(request)`; `changesetLog` and the fingerprints                                                |
| `apps/api/src/routes/changesets.ts`                                                       | `handleChangesetRoutes`: submit, list, one, revert                                                         |
| `apps/api/src/routes/tab-put-route.ts`                                                    | `handleTabPut`, lifted out of `document-subresource-routes.ts`: token refusal, seen merge, CAS write       |
| `apps/api/src/routes/tab-name-route.ts`                                                   | `handleTabRename`: `PUT .../tabs/:tabId/name`, relayed as `document-meta`                                  |
| `apps/api/src/routes/document-subresource-routes.ts`                                      | Tab GET sets `ETag`; delegates the PUT, the rename and the changeset routes                                |
| `apps/api/src/index.ts`                                                                   | The daily sweep                                                                                            |
| `apps/api/src/room-client.ts`                                                             | `roomStubFor(env, documentId)` for every document; `relayChangeset`, `relayTabList`, `readRoomSelections`  |
| `apps/api/src/room-selections.ts`                                                         | `RoomSelectionStore`: each session's selection in DO storage                                               |
| `apps/api/src/document-room.ts`                                                           | `/mutation` accepts `changeset` and `document-meta`; `GET /selections`; `select` recorded; close prunes    |
| `apps/api/src/responses.ts`                                                               | CORS allows `X-Changeset-Seen`, `X-Livediagram-Client`; exposes `ETag`                                     |
| `apps/api/src/openapi/{manifest,document}.ts`, `scripts/gen-openapi-schemas`              | The five routes, `Tab.rev`, the header, the error bodies, the PUT's 405                                    |
| `apps/mcp/src/changeset-client.ts`                                                        | `submitChangeset`, `mcpOpsToEditOperations`, `changesetErrorText`                                          |
| `apps/mcp/src/tools.ts`, `schema.ts`, `output-schema.ts`, `api.ts`                        | `add_tab`, `update_document` on changesets; `rename_document` on the name route; `rev`; the client header  |
| `apps/live/lib/api/tabs.ts`                                                               | `apiLoadTabRevisioned`; `apiSaveTab` and the unload beacon send `X-Changeset-Seen`                         |
| `apps/live/lib/api/changesets.ts` (planned)                                               | `apiRevertChangeset`                                                                                       |
| `apps/live/app/document/[id]/editor-realtime.ts`, `useIdentityBootstrap.ts`               | `documentServerStored`, the room gate                                                                      |
| `apps/live/app/document/[id]/useRoomConnection.ts`                                        | Room for every server-stored document; the `changeset` branch                                              |
| `apps/live/app/document/[id]/usePresenceBroadcast.ts`                                     | `select` (with `elementIds`) and `tab-focus` for every open room                                           |
| `apps/live/app/document/[id]/room-op-apply.ts`                                            | `applyRoomOpToTabs` case `changeset`                                                                       |
| `apps/live/app/document/[id]/changeset-seen.ts` (planned)                                 | `ChangesetSeen`, `noteLoadedRev`, `admitChangesetOp`, pure                                                 |
| `apps/live/app/document/[id]/changeset-toast.ts` (planned)                                | `coalesceChangesetToast`, `changesetToastCopy`, pure                                                       |
| `apps/live/app/document/[id]/useChangesetFeed.ts` (planned)                               | Seen map, gap refetch, reveal state, toast, Show, Undo                                                     |
| `apps/live/app/document/[id]/{usePerTabLoad,useRoomResync,seed-fetched-...}`              | Record each loaded tab's `rev`; resync of named tabs                                                       |
| `apps/live/app/document/[id]/useAutosave.ts`                                              | Passes the seen revision per tab                                                                           |
| `apps/live/components/canvas/ChangesetRevealOverlay.tsx` (planned), `CanvasElementsLayer` | The outline in the author's colour                                                                         |
| `apps/live/hooks/ui/useToast.tsx`                                                         | `toast.action`: a keyed info toast with buttons, upserted by key, no timeout                               |
| `apps/telemetry/app/catalogue/collaboration.ts`                                           | The `Agent` stack                                                                                          |

## Domain and naming

| Term                 | Identifier                                                                   | Meaning                                                                       |
| -------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Changeset            | `agent_changesets` row, `ChangesetRecord`, room op `changeset`               | One write to one tab through the changeset route                              |
| Changeset id         | `id`, `cs_` + 10 Crockford base32, `CHANGESET_ID_PATTERN`                    | Minted by the api (CS7)                                                       |
| Part                 | `agent_changeset_parts` row, `part` = `ops` \| `inverse` \| `results`        | One large body of a changeset, beside its record                              |
| Agent changeset      | `token_id IS NOT NULL`, `agent: true` on the wire                            | One a token submitted                                                         |
| Author               | `author_id`, `author_name`, `author_color`                                   | The resolved owner of the request; the token's owner for an agent             |
| Edit operation       | `EditOperation` (engine)                                                     | One step of the body                                                          |
| Replace              | `ChangesetRequest.replace` (`ReplaceBody`)                                   | The whole-tab body                                                            |
| Element op           | `ElementOp` (`@livediagram/document`)                                        | The compiled unit the room and editors apply                                  |
| Inverse              | `inverse`                                                                    | Element ops that undo it, from the before-images                              |
| Tab revision         | `tabs.rev`, `TabRecord.rev`, `ETag: W/"<rev>"`                               | Advanced by every write of the tab                                            |
| Base                 | `ChangesetBase { rev, elements? }`                                           | The revision read and the fingerprints of the targets as read                 |
| Fingerprint          | `elementFingerprint(element)`                                                | 16 hex characters over the canonical element, live fields left out (CS6)      |
| Live fields          | `LIVE_ELEMENT_FIELDS`                                                        | Multi-writer fields (comments, answers, ...) a fingerprint ignores            |
| Before / after image | `fingerprints.before[id]`, `fingerprints.after[id]`                          | An element as the changeset found it / left it                                |
| Target               | `targets` (engine `OperationTargets[]`), `createdIds`                        | Ids an operation addressed by selector; never a make-room shift               |
| Held                 | `HeldElement { id, by: { name, color } }`, `409 elements_held`               | Selected by a person in an open editor, other than the agent's owner          |
| Person tag           | `personTagFor(documentId, ownerId)`, attachment `personTag`                  | The room's opaque stand-in for an owner ([agent presence](agent-presence.md)) |
| Seen revision        | `X-Changeset-Seen`, `ChangesetSeen`                                          | The highest changeset revision an editor has applied to a tab                 |
| Merge on save        | `mergeChangesetsIntoSave`                                                    | Step 8 of the spec                                                            |
| Superseded           | `superseded` count                                                           | A changeset's version not taken because a person changed it after             |
| Revert               | `POST .../changesets/:id/revert`, `planRevert`, `revert_of`                  | The inverse as a new changeset                                                |
| Kept                 | `kept: { id, reason }[]`                                                     | An element a revert leaves because it changed since                           |
| Reveal               | `ChangesetRevealOverlay`, `CHANGESET_REVEAL_MS`                              | The outline in the author's colour                                            |
| Front door           | `frontDoorOf`, `X-Livediagram-Client`, type `Mcp` / `Cli` / `Api` / `Editor` | Which surface submitted it                                                    |
| Server-stored        | `documentServerStored`                                                       | Saved on the server: has a room                                               |

Banned: "batch", "commit", "patch" for a changeset; "op" for an edit operation (an op is a room op); "version" or
"etag" for the tab revision in copy and identifiers other than the header; "lock" for held (the selection lock is
the editor's advisory client rule); "bot", "AI user", "assistant" for an agent; "undo" for the route (the route
is revert; Undo is the toast's button label); "account key" for the person tag.

## Behaviour and state

### The pipeline (`submitChangeset`)

Inputs: the document (`getDocument`), the tab id, the parsed `ChangesetRequest`, the caller (`RouteContext`, its
`token` when one presented), `dryRun`. One attempt:

1. **Read.** In parallel: `getTab(env, documentId, tabId)` (null means create), `lastChangesetRev(env, tabId)`,
   and `readRoomSelections(env, documentId, tabId, personTagFor(documentId, author))`.
2. **Compile.** Operations: `applyEditOperations(stored, operations, { selection, theme, makeId, log })`. Replace:
   `applyReplace(stored ?? null, replace, { tabId, name, selection, theme, makeId, log })`. Both return
   `{ tab, results, elementOps, inverse, warnings, targets, createdIds } | { errors }`. The engine resolves
   selectors, normalises and coerces values, lands workshop notes on lanes, lays out what it touched and ends with
   `isValidTab`. `selection` is the union of `elementIds` of the selections marked `mine`, or `null` when the room
   did not answer.
3. **Check the base** with `checkBase` (below). When the engine refused and the base's revision is behind, the base
   check runs over `base.elements` alone first; its conflict wins over the engine's errors (CS13).
4. **Check held**, agent changesets only: `heldTargets(targets, selections)` over the selections not marked
   `mine`, any role. A person's changeset or revert is never held.
5. **Dry run** stops here and answers the plan.
6. **No-op.** No element op and no new tab: answer 200 with `changeset: null`; nothing is written (CS11).
7. **Bound.** `CHANGESET_MAX_OPERATIONS` is checked before compile; after it, each part against
   `CHANGESET_PART_MAX_BYTES` (CS43) and the tab through `storeTab`, all `too_large`.
8. **Write and record** in one D1 batch: `upsertTabAtRev(env, documentId, tab, orderIndex, stored?.rev ?? 0)`,
   `insertChangesetStatement(...)` and three `insertChangesetPartStatement(...)`. The trigger aborts the batch
   when the row moved (`tab_rev_stale`).
9. **Lost race.** On `tab_rev_stale`, or a primary-key or unique failure on a create, repeat from step 1 once;
   a second loss answers `409 tab_busy` (CS40).
10. **Relay** `relayChangeset(env, documentId, changesetRoomOp(record))` to the submitting document's room only,
    awaited with `ROOM_RELAY_TIMEOUT_MS`; a failure logs `[changeset] relay-failed` and the answer stays 200.
    Other documents linking the tab are protected by the merge on save.
11. **After**, off the response path (`ctx.waitUntil`): `recordTabSave` and the new-comment email exactly as a
    save does (CS29), the agent presence refresh of the [agent presence blueprint](agent-presence.md) for a token,
    and the `Agent` telemetry.

The write applies, before step 8, the server rules a save applies: `migrateIncomingTab` on a replace's elements,
`capStoredName` on a created tab's name, `preferNewerQaAll` against the stored elements, and
`rewriteCommentAuthors` against the stored elements with the author's participant record (CS30). A `replace`'s
`name` names a tab it creates; on an existing tab it is ignored.

### `checkBase(base, stored, targetIds, createdIds, strict)`

`targetIds` is the union of `targets[].ids`.

| Case                                                                       | Outcome                                      |
| -------------------------------------------------------------------------- | -------------------------------------------- |
| `base` absent, `strict` true                                               | `400 strict_needs_base` (CS15)               |
| `base` absent                                                              | apply; warning `no_base`                     |
| `base.rev > stored.rev` (or stored absent and `base.rev > 0`)              | `400 invalid_base` (CS14)                    |
| `base.rev === stored.rev`                                                  | apply                                        |
| revisions differ, `strict` true                                            | `412 stale_tab { rev: stored.rev }`          |
| an id in `base.elements` is missing from `stored`                          | conflict `vanished`                          |
| an id in `base.elements` has a fingerprint unlike `stored`'s               | conflict `changed`                           |
| an id in `targetIds`, not in `createdIds`, has no entry in `base.elements` | conflict `resolves_differently`              |
| none of the above                                                          | apply; `rebasedOver = stored.rev - base.rev` |

Every conflict is collected, never the first only. Make-room shifts never appear in `targets`, so they are never
fingerprinted or checked. A conflict carries the fingerprint the agent read and the element now; the CLI prints the
as-read side from its own cache.

### `mergeChangesetsIntoSave(save, records)` (step 8 of the spec)

`records` are this tab's changesets with `rev > seen` (or, without a valid header, `created_at > now -
CHANGESET_MERGE_WINDOW_MS`), ascending by `rev`, read with their `ops` part in pages of `CHANGESET_MERGE_PAGE`
(CS18). For each record, for each element op, in order (`fp` is `elementFingerprint`, `cur` the save's element with
that id):

| Op            | Changeset version taken when                                        | Then                                        | Otherwise                                                 |
| ------------- | ------------------------------------------------------------------- | ------------------------------------------- | --------------------------------------------------------- |
| `add e at i`  | `cur` absent                                                        | insert `e` at `min(i, n)`                   | keep `cur`; superseded when `fp(cur) !== after[e.id]`     |
| `update e`    | `cur` present and `fp(cur) === before[e.id]`                        | replace with `mergeIncomingElement(cur, e)` | keep; superseded unless `cur` present with `fp === after` |
| `remove id`   | `cur` present and `fp(cur) === before[id]`                          | remove                                      | keep; superseded when `cur` present                       |
| `reorder ids` | the save's relative order of the common ids equals the before order | apply the after order to those ids          | keep the save's order; superseded once                    |

Taking the changeset's version keeps the save's live fields (`mergeIncomingElement`), since the fingerprint
ignores them (CS44). The pure function returns `{ tab, merged, superseded }`. It is idempotent: a save that already
holds a changeset's after-images is unchanged by it.

### The tab `PUT` (`handleTabPut`)

1. A request with `ctx.token` is refused `405 use_changesets` before anything is read (CS45). The PUT is the
   editor's autosave alone.
2. Gate, migrate, `isValidTab`, `bodyExceedsCap`, strip `rev`, `documentId`, `orderIndex`, `updatedAt` from the
   body (CS32). Parse `X-Changeset-Seen` (CS19).
3. Attempt: in parallel `getTab` and the records after the seen revision; `mergeChangesetsIntoSave` on the
   received tab; then `mergeRoomLedger` on its result (changesets first, so the before-image compare sees the
   save as sent); then the existing name cap, empty-tab backstop, `preferNewerQaAll`, `rewriteCommentAuthors`.
4. Write with `upsertTabAtRev(..., existingTab?.rev ?? 0)`. On `tab_rev_stale` repeat step 3 once, then
   `409 tab_busy` (CS4); the editor's autosave already retries any non-403 failure (`saveFailureStatus`).
5. Log `[changeset] merged-on-save` when `merged > 0` and `[changeset] superseded-on-save` when
   `superseded > 0`. Answer the echoed tab with its new `rev`.

### The tab rename (`handleTabRename`)

`PUT /api/documents/:id/tabs/:tabId/name { name }`: `gateEdit` with the tab; `capStoredName(name, stored.name,
'tab')`; `renameTab(env, tabId, name)` (`UPDATE tabs SET name = ?, rev = rev + 1`, CS42); then
`relayTabList(env, documentId)`, a `document-meta` op built from the document's tab summaries, through `/mutation`.
Open to tokens and sessions alike. Answers `{ tab: TabSummary }` with the stored name.

### The room

- `/mutation` accepts `changeset` and `document-meta` beside `el-delta`:
  `sequenceMutation('system', opForTheWire(op))`, one seq and one catch-up slot whatever its size.
  `ledger.record` skips both (`ledgerKey` returns null).
- `changeset` joins `SYSTEM_OP_KINDS`: a client socket can never send one (CS24).
- A `select` op from any session records `{ tabId, elementIds }` under `selection:<presenceId>` in DO storage
  (`RoomSelectionStore.note`), `elementIds` clamped to `MAX_SELECTION_IDS` and defaulting to `[elementId]` when a
  sender omits it; `elementId: null` deletes it. `webSocketClose` and `webSocketError` delete the session's entry.
- `GET /selections?tab=<tabId>&person=<tag>` answers
  `{ selections: { elementIds: string[], name: string, color: string, mine: boolean }[] }` for entries on that tab
  whose presence id has a live socket, whatever the session's role; stale entries found are deleted. `mine` is
  true when the session's attachment `personTag` equals `person` (both non-empty; CS39). Agent presence entries are never
  in the answer.

### Rooms for every server-stored document

- `roomStubFor(env, documentId)` returns a stub for every document; the `shareable`/`teamId` gate goes. Its
  callers (`mergeRoomLedger`, `relayElementDelta`, `broadcastDocumentTrashed`, `relayChangeset`, `relayTabList`,
  `readRoomSelections`) take the document id.
- The editor's room gate becomes `roomOpen = hydrated && documentId && documentServerStored`, where
  `documentServerStored = fetched.ownerId !== OFFLINE_OWNER_ID` (set in `useIdentityBootstrap`, false for a
  never-saved draft). `useRoomConnection` and `usePresenceBroadcast` use it. The presence streams
  (`useEditorBroadcast`, `useDragPreviewBroadcast`), the presence rows and the poll audience keep the audience gate
  `documentShareable || documentTeamId`.

### The editor

State, per document, in `useChangesetFeed`:

- `seenRef: Map<tabId, number>` (`ChangesetSeen`): set by `noteLoadedRev(tabId, rev)` on every tab load
  (`seed-fetched-document`, `usePerTabLoad`, `useRoomResync`), raised by an admitted op.
- `reveals: { changesetId, color, ids, until }[]`, rendered by the overlay, pruned at `until`.
- `toasts: Map<toastKey, { key, changesetIds, count, name, summary, lastAt }>`.

`admitChangesetOp(seen, op)` decides, in order:

| Condition           | Decision                                                                |
| ------------------- | ----------------------------------------------------------------------- |
| tab not loaded here | `skip`: the tab's first load carries it                                 |
| `op.rev <= seen`    | `skip`: the loaded content holds it                                     |
| `op.prevRev > seen` | `apply-and-refetch`: a changeset was missed; seen waits for the refetch |
| `op.refetch`        | `refetch`                                                               |
| otherwise           | `apply`; seen becomes `op.rev`                                          |

`apply` runs through the existing mutation branch: `applyRemoteTabs(prev => applyRoomOpToTabs(prev, op))`,
`foldRemoteOpIntoBaseline`, `countAppliedOp`. `applyRoomOpToTabs` case `changeset`: append `op.tab` when it names
a tab not in the list, then each element op exactly as case `el` (`mergeOpOverLocal`). `refetch` calls the resync
with `tabIds: [op.tabId]`, which moves the tabs, the baseline and the seen revision together. Undo history is not
touched: `applyRemoteTabs` preserves the stacks, so Ctrl+Z never reaches a changeset. Every admitted op (catch-up
included) starts a reveal and a toast.

Toast coalescing (`coalesceChangesetToast`): the key is `agentKey` for an agent changeset, else the changeset id.
An op whose key has an entry with `lastAt` within `CHANGESET_TOAST_COALESCE_MS` adds its id and count to that toast
and updates it in place (`toast.action` with the same `key`); otherwise a new entry replaces that key's toast, so
one token has at most one toast. The toast stays until dismissed or replaced.

**Show**: `track('Agent', 'Opened', 'Toast')`, switch to the tab when it is not active (`selectTab`), then
`fitToBounds` over the union of `elementBounds` of the toast's touched elements still present, `maxZoom: 1` (CS34).
**Undo**: `apiRevertChangeset` for each changeset in the toast, newest first, sending `X-Livediagram-Client:
editor`; the toast then reads the outcome.

## Interfaces and contracts

### REST

| Method | Path                                                | Gate                                   | Success                                              | Failures                                                                                                                                                                                                                      |
| ------ | --------------------------------------------------- | -------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/api/documents/:id/tabs/:tabId/changesets`         | `gateEdit(..., tabId)`                 | 200 `ChangesetResponse`                              | 400 `invalid_body`, `parse_error`, `unknown_operation`, `invalid_base`, `strict_needs_base`; 403; 404; 409 `changeset_conflict`, `elements_held`, `tab_busy`, `tab_id_taken`; 410; 412 `stale_tab`; 413 `too_large`; 422; 429 |
| GET    | `/api/documents/:id/changesets[?tab=&limit=]`       | `gateRead`; a scoped link its tab only | 200 `{ changesets: ChangesetSummary[] }`             | 400 bad `limit`; 404; 410                                                                                                                                                                                                     |
| GET    | `/api/documents/:id/changesets/:changesetId`        | `gateRead` on the record's tab         | 200 `{ changeset: ChangesetSummary, results, text }` | 404 (no record for this document, or its tab outside a scoped link); 410                                                                                                                                                      |
| POST   | `/api/documents/:id/changesets/:changesetId/revert` | `gateEdit` on the record's tab         | 200 `RevertResponse`                                 | 403; 404 (no record for this document, or tab unlinked); 409 `tab_busy`; 410                                                                                                                                                  |
| PUT    | `/api/documents/:id/tabs/:tabId/name`               | `gateEdit(..., tabId)`                 | 200 `{ tab: TabSummary }`                            | 400 `invalid_name`; 403; 404; 410                                                                                                                                                                                             |
| GET    | `/api/documents/:id/tabs/:tabId`                    | unchanged                              | `tab.rev`; header `ETag: W/"<rev>"` (CS5)            | unchanged                                                                                                                                                                                                                     |
| PUT    | `/api/documents/:id/tabs/:tabId`                    | unchanged; tokens refused              | `tab.rev` in the echo                                | adds 405 `use_changesets` (any token), 409 `tab_busy`                                                                                                                                                                         |

The role a token or a share link needs is exactly the named gate's; this file names no role. `?dryRun=1` on the
submit answers the same 200 shape with `dryRun: true`, `changeset: null`; any other value of `dryRun` is false.

```ts
type ChangesetBase = { rev: number; elements?: Record<string, string> }; // id -> fingerprint
type ChangesetRequest = {
  operations?: unknown[] | string; // JSON form (validateEditOperations) or line form (parseEditOperations) (CS8)
  replace?: ReplaceBody; // { graph | mermaid | template | elements, layout?, theme?, name? }; exactly one of the two
  base?: ChangesetBase;
  strict?: boolean;
  summary?: string; // trimmed, control characters removed, at most CHANGESET_SUMMARY_MAX (CS10)
};
type ChangesetResponse = {
  dryRun: boolean;
  changeset: {
    id: string;
    tabId: string;
    rev: number;
    previousRev: number;
    rebasedOver: number;
  } | null;
  results: ResultLine[]; // the engine's result lines, structured
  text: string; // formatResultLines + formatResultFooter: the same for a dry run and a write
  warnings: string[]; // 'no_base', engine warnings
  lint: LintReport | null; // lintTab on the result; null when the lint failed
};
type ChangesetConflict = {
  id: string;
  reason: 'changed' | 'vanished' | 'resolves_differently';
  readFingerprint: string | null;
  now: Element | null;
};
type ChangesetSummary = {
  id: string;
  tabId: string;
  rev: number;
  author: { name: string; color: string };
  agent: boolean;
  tokenId?: string; // only to the changeset's author (CS26)
  summary: string | null;
  counts: { added: number; changed: number; removed: number };
  revertOf: string | null;
  createdAt: number;
};
type RevertResponse = {
  changeset: ChangesetResponse['changeset'];
  reverted: number;
  kept: { id: string; reason: 'changed' | 'gone' | 'present' | 'order' }[];
  lint: LintReport | null;
};
```

Engine codes map to statuses by CS9: 400 `parse_error`, `unknown_operation`; 413 `too_large`; 422 every other code.
Document reads (`GET /api/documents/:id`, tab summaries) carry no `rev` (CS33). Error bodies: `{ error: code, ... }`
with `conflicts: ChangesetConflict[]` (409 `changeset_conflict`, plus `rev`), `held: HeldElement[]` (409
`elements_held`), `rev` (412), `errors: EditRejection[]` and `text` from `formatRejections` (400 / 422 engine
codes), `cap` (413), `message` (405, CS45). `now` elements pass `redactCommentAuthorIds` for a non-owner.

### Headers

| Header                 | Direction              | Value                                          | Absent / invalid                                          |
| ---------------------- | ---------------------- | ---------------------------------------------- | --------------------------------------------------------- |
| `X-Changeset-Seen`     | editor → tab PUT       | decimal integer 0 to `Number.MAX_SAFE_INTEGER` | window rule; invalid also logs `[changeset] seen-invalid` |
| `X-Livediagram-Client` | MCP, CLI, editor → api | `mcp`, `cli` or `editor`                       | front door `Api` (CS25)                                   |
| `ETag`                 | api → tab GET          | `W/"<rev>"`                                    | never absent                                              |

### Room

```ts
| { kind: 'changeset'; tabId: string; id: string; rev: number; prevRev: number | null;
    author: { name: string; color: string }; agentKey?: string; summary?: string;
    counts: { added: number; changed: number; removed: number };
    elementOps?: ElementOp[]; touched?: string[]; refetch?: true;
    tab?: Omit<Tab, 'elements'>; revertOf?: string }
| { kind: 'select'; elementId: string | null; tabId?: string; elementIds?: string[] }
```

`changesetRoomOp(record)` puts `elementOps` on the op when their UTF-8 JSON is at most
`CHANGESET_RELAY_MAX_BYTES`; otherwise `refetch: true` and `touched` (every id the record touched). `prevRev` is
`lastChangesetRev` read in step 1 (CS21). `agentKey` is the first 12 hex of SHA-256 of the token id, present only
for an agent changeset (CS22). `tab` is present only when the changeset created the tab (CS23). The editor sends
`elementIds` as every selected id (the multi-selection, or the single selection), capped at `MAX_SELECTION_IDS`.

Internal: `POST /mutation { op }` accepts `changeset` and `document-meta`; `GET /selections` above. The person tag
on the attachment comes from the ticket ([agent presence](agent-presence.md), migration 0068); this file adds no
ticket field.

### Shared functions

- `elementFingerprint(element: Element): string` and `canonicalElementJson(element: Element): string`
  (`@livediagram/document`): the JSON of the element without its `LIVE_ELEMENT_FIELDS`, object keys sorted at
  every depth, array order kept, `undefined` dropped; hashed per CS6. The CLI, the MCP and the api call the same
  function.
- `invertElementOps(before: Element[], ops: ElementOp[]): ElementOp[]`: `add` → `remove`; `update` → `update` with
  the before element; `remove` → `add` of the before element at its before index; `reorder` → `reorder` with the
  before ids; emitted in reverse order.
- `planRevert(current: Tab, record) → { elementOps, kept }`, per element of the record:

| Record op     | Reverted when                                                                    | Kept reason        |
| ------------- | -------------------------------------------------------------------------------- | ------------------ |
| `add e`       | `cur` present and `fp(cur) === after[e.id]`: remove it                           | `changed` / `gone` |
| `update e`    | `cur` present and `fp(cur) === after[e.id]`: `mergeIncomingElement(cur, before)` | `changed` / `gone` |
| `remove id`   | `cur` absent: add the before element at its before index (clamped)               | `present`          |
| `reorder ids` | current relative order of the common ids equals the after order                  | `order`            |

### Clients

- `apiLoadTabRevisioned(ownerId, documentId, tabId, shareCode, opts) → { tab: Tab; rev: number } | null`
  (deduped like `apiLoadTab`); `apiLoadTab` maps it to `tab` (CS41). Offline documents answer `rev: 0`.
- `apiSaveTab(..., { allowEmpty, roomCursor, changesetSeen })`; `flushDocumentSavesBeacon` takes
  `changesetSeen: Map<string, number>` and sends the header per tab.
- `apiRevertChangeset(ownerId, documentId, changesetId, shareCode) → RevertResponse`.
- `toast.action({ key, message, actions: { label, ariaLabel, onSelect }[] })`: an info-tone toast, so the "Show
  notifications" preference silences it; inserts, or replaces the entry with the same `key` in place; no timeout.

### MCP

- No tool does a whole-tab save.
- `add_tab`: `POST .../tabs/<newTabId>/changesets` with `{ replace: { template | graph | mermaid | elements,
layout, theme, name } }`, no base; then reads the tab to render the PNG (CS36). Structured output gains
  `changesetId`, `rev`, `text`, `lint`.
- `update_document` `replace`: `{ replace: { graph | mermaid | elements, layout } }`, no base.
- `update_document` `ops`: `mcpOpsToEditOperations(args.ops)` in the JSON form: `add` → `add` of the element's
  kind with `id`, its fields and placement `at:x,y`; `update` → `set` on `elementId` with the element's given
  fields; `remove` → `rm` on `elementId` (pinned arrows go too and are listed). The engine lands event-storming notes
  on lanes and coerces shapes. Base: `{ rev: args.rev ?? loaded.rev, elements }` with the fingerprints of the ops'
  named ids from the tab the tool loads at call time. Input gains optional `rev`, the revision `read_document`
  returned.
- `rename_document` with `tabId`: `PUT .../tabs/:tabId/name { name }`.
- A 4xx from the route returns `errorResult(changesetErrorText(err))` (the route's `text` or `message`, never
  reported to the Error category); a 5xx is reported as today.

## Data and persistence

Migration `0066_agent_changesets.sql` (CS1):

```sql
ALTER TABLE tabs ADD COLUMN rev INTEGER NOT NULL DEFAULT 0;
CREATE TRIGGER tabs_rev_advances BEFORE UPDATE OF data ON tabs
  WHEN NEW.rev IS NOT OLD.rev + 1
  BEGIN SELECT RAISE(ABORT, 'tab_rev_stale'); END;
CREATE TABLE agent_changesets (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  tab_id TEXT NOT NULL REFERENCES tabs(id) ON DELETE CASCADE,
  rev INTEGER NOT NULL,
  base_rev INTEGER,
  author_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_color TEXT NOT NULL,
  token_id TEXT,
  summary TEXT,
  fingerprints TEXT NOT NULL,
  added INTEGER NOT NULL,
  changed INTEGER NOT NULL,
  removed INTEGER NOT NULL,
  created_tab INTEGER NOT NULL DEFAULT 0,
  revert_of TEXT,
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX agent_changesets_tab_rev ON agent_changesets(tab_id, rev);
CREATE INDEX agent_changesets_document_created ON agent_changesets(document_id, created_at);
CREATE INDEX agent_changesets_created ON agent_changesets(created_at);
CREATE TABLE agent_changeset_parts (
  changeset_id TEXT NOT NULL REFERENCES agent_changesets(id) ON DELETE CASCADE,
  part TEXT NOT NULL CHECK (part IN ('ops', 'inverse', 'results')),
  data TEXT NOT NULL,
  PRIMARY KEY (changeset_id, part)
);
```

| Field                          | Class              | Notes                                                                    |
| ------------------------------ | ------------------ | ------------------------------------------------------------------------ |
| `tabs.rev`                     | state              | 0 on every existing row; 1 on insert (CS2); +1 on every write of the tab |
| `agent_changesets.id`          | identity           | `cs_` + 10                                                               |
| `document_id`, `tab_id`, `rev` | reference          | `(tab_id, rev)` unique: one changeset per revision                       |
| `base_rev`                     | audit              | Null without a base                                                      |
| `author_id`                    | personal           | Owner-keyed; deleted with the account, moved by guest migration (CS27)   |
| `author_name`, `author_color`  | personal, snapshot | From `participants` at write; fallback CS16                              |
| `token_id`                     | audit              | Null for a person; never on the wire except to the author                |
| `summary`                      | content            | At most 80 characters                                                    |
| `fingerprints`                 | derived            | JSON `{ before: Record<id, fp>, after: Record<id, fp> }` (CS17)          |
| `added`, `changed`, `removed`  | derived            | Counts for the list and the toast                                        |
| `created_tab`, `revert_of`     | state              | 1 when it created the tab; the reverted changeset's id                   |
| `created_at`                   | state              | Epoch ms; the sweep and the merge window key on it                       |
| part `ops`, `inverse`          | content            | JSON `ElementOp[]`, comment author ids intact (server only)              |
| part `results`                 | derived            | JSON `{ results: ResultLine[], text }`, for `GET .../changesets/:id`     |
| DO `selection:<presenceId>`    | ephemeral          | Room storage, pruned on close                                            |

Writers of the tab and their `rev`: `upsertTab` (`ON CONFLICT ... rev = tabs.rev + 1`, `RETURNING rev`, used by
the comment routes), `upsertTabAtRev` (`rev = expected + 1` on both the insert and the conflict update),
`renameTab` (`rev = rev + 1`), `seedTabs` and the document copy (insert at 1), `swapTabData` (`rev = rev + 1`).
The trigger is the compare-and-swap: a batch whose tab statement does not advance `rev` by exactly one aborts whole,
so the record, its parts and the index rows never land without their tab write (CS3). `stampTabElementCount`
writes no `data` and does not advance `rev`.

Snapshot and restore: the record and its parts are the snapshot of its change; nothing else is copied. Trash: the
rows wait with their document and go with its purge (cascade). A tab unlinked from every document takes its records
(cascade). Retention: `deleteOldChangesets(env, cutoff)` from the daily cron through
`scheduleSweep(ctx, env, 'changesets', 'rows', now - CHANGESET_RETENTION_MS, ...)`; parts follow by cascade (CS28).

## Errors and edge cases

- **E1** Submit to a trashed document: 410 through `missingDocument`. A stranger: 404.
- **E2** `replace` on a tab id this document lacks but `tabs` holds (another document's tab): `409 tab_id_taken`;
  an id over 128 characters: 422 `invalid_value` (CS31).
- **E3** Both `operations` and `replace`, or neither: `400 invalid_body`. More than `CHANGESET_MAX_OPERATIONS`
  operations (comment lines excluded; a `replace` counts as one): 413 `too_large` before compile.
- **E4** Engine refusal: nothing written; codes and the engine's text returned; `[changeset] rejected` logged.
- **E5** The room cannot answer `/selections` (throws, non-2xx, timeout `ROOM_SELECTIONS_TIMEOUT_MS`): nothing is
  held and `selection` is `null`; `[changeset] selections-unreachable` warns.
- **E6** Relay fails or times out: answered 200; `[changeset] relay-failed`; editors that missed it detect the gap
  on the next changeset (`prevRev`) or carry it by the merge on their next save.
- **E7** Room asleep: the relay wakes it; the op lands in a fresh log and reaches sockets that reconnect through
  catch-up or resync.
- **E8** Editor offline when it landed: catch-up replays it; beyond the log, the resync reloads the tab and its
  revision.
- **E9** Two changesets race: the trigger serialises them; the loser recompiles on the winner's tab, so its base
  check sees the winner's write.
- **E10** A save racing a changeset: the save's CAS loses, re-reads the records (now including the changeset) and
  merges it.
- **E11** Relays reaching the room out of order: the later revision carries `prevRev` of the earlier; an editor
  that sees it first refetches, and then skips the earlier one by `rev <= seen`.
- **E12** A merged save outgrows `MAX_TAB_BYTES`: 413 as today.
- **E13** Revert after the record's sweep: 404. Revert of a record whose tab left the document: 404.
- **E14** Revert where every element changed since, a second revert of one changeset included: no write,
  `changeset: null`, every element in `kept` (CS11). A revert of a tab-creating changeset empties the tab and keeps
  it.
- **E15** A revert's inverse of an add whose element is gone: `kept` with `gone`; of a remove whose id is back:
  `kept` with `present`.
- **E16** `X-Changeset-Seen` ahead of the tab (a forged or stale header): nothing merges; the editor's own risk.
- **E17** A tab PUT with a token: `405 use_changesets` naming `POST /api/documents/:id/tabs/:tabId/changesets`. A
  PUT without the header comes only from a bundle older than this change: the window rule applies.
- **E18** An oversize relay: editors refetch the tab in place; the outline still shows from `touched`.
- **E19** A make-room shift moves an element a person is dragging: allowed (only targets are held); the update lands
  mid-drag as any peer's does.
- **E20** `strict` with an unchanged revision: applied.
- **E21** Id collision on mint: the primary key refuses; one re-mint inside the same attempt (CS7).
- **E22** A part over `CHANGESET_PART_MAX_BYTES` (a full replace of a tab at the byte cap): 413 `too_large`,
  nothing written.
- **E23** The agent's owner has the targeted element selected: not held (their sessions are `mine`), and it is what
  `selected` resolves to.
- **E24** Rename to the current name: the tab's revision still advances and the relay still goes; the editor's
  `document-meta` apply keeps identity for an unchanged name.

## Security and trust

- Submit and revert pass `gateEdit` with the tab, so a tab-scoped link writes its own tab only; the token's role is
  applied inside the gate ([share roles blueprint](../../013-workspace/blueprints/share-roles.md)).
- A token can never reach the whole-tab PUT: 405 before any read.
- Agent attribution comes only from the server: `author_*` from the resolved owner's participant row, `token_id`
  from `ctx.token.id`. Nothing in the body names an author.
- `changeset` is a system kind: the room drops it from any client socket, and `/mutation` is reachable only through
  the worker's stub.
- Comment author ids never leave the server: `opForTheWire` strips them from the op's elements, conflict `now`
  elements are redacted for a non-owner, and a replace's comments pass `rewriteCommentAuthors` so an agent cannot
  forge another person's comment.
- `token_id` reaches only its author through the list. `agentKey` is a one-way digest. The person tag is the agent
  presence blueprint's: a hash, never an owner id.
- The selection store holds element ids and a session's presence name and colour, never an owner id.
- Abuse: the token write limiter counts every submit, revert and rename (dry runs included);
  `CHANGESET_MAX_OPERATIONS`, `MAX_BODY_BYTES` and `CHANGESET_PART_MAX_BYTES` bound the work; `MAX_SELECTION_IDS`
  bounds a hostile `select`.
- A forged `X-Changeset-Seen` can only make its own save drop or keep changesets; it reaches no other tab.

## Performance and limits

- Submit, worst case: 5 D1 reads (document, gate, tab, last revision, participant), one room fetch, the engine over
  500 operations on a tab at the byte cap, one lint, one D1 batch (tab, link, `saved_at`, collaboration index, image
  refs, record, three parts), one relay. Twice on a lost race. The route adds no pass over the tab beyond
  fingerprinting the targets (O(targets)).
- Tab PUT adds one indexed read (`agent_changesets_tab_rev`) that returns nothing in the common case, and the
  trigger's row check.
- Merge on save, worst case: an editor offline for the retention period on a busy tab. Records stream in pages of
  20 with their `ops` part; one page holds at most 20 x `CHANGESET_PART_MAX_BYTES`, about 40 MB, under the 128 MB
  isolate (CS18). Fingerprints are computed only for elements a record names.
- Rows: each part at most `CHANGESET_PART_MAX_BYTES` (1,991,808), so every row fits D1's 2,000,000 bytes; only the
  tab cap bounds a changeset.
- Room: each `changeset` takes one of the 256 catch-up slots; at most 192 KiB each, the log holds at most 48 MiB,
  inside the 64 MiB a log of maximum `tab` ops already allows. Selection writes: one DO storage put per selection
  change of a connected editor.
- Editor: one `changeset` op applies in one `applyRemoteTabs` update, one render; 500 element ops over a
  2,000-element tab is about 10^6 element visits, inside a 50 ms long-task budget.
- Personal documents hold a socket each; with the presence streams gated on an audience, an idle personal room
  sends only `hello`, `select` and `tab-focus`.

## Presentation and UX

- Outline: each touched element still on the active tab gets a rounded rectangle 4 px outside `elementBounds`,
  2 px stroke in the author's colour, drawn in canvas space by `ChangesetRevealOverlay` above the elements and below
  the selection chrome, for `CHANGESET_REVEAL_MS` from arrival. Elements removed by the changeset show no outline.
- Toast copy: `{name} changed {n} element` / `{n} elements`, followed by `: {summary}` when the latest changeset in
  it has one. Buttons **Show** and **Undo**. After Undo: "Undone", or "Undone, {k} kept because they changed since";
  on failure an error toast "Could not undo {name}'s change".
- Name and colour are the author's: "Webber changed 3 elements" reads the same for Webber and for his agent.
- No toast on a skipped op; a refetched op toasts as soon as the refetch lands. With "Show notifications" off there
  is no toast; the outline still shows.
- The summary shows in the toast, the list route and `changeset ls`; the editor has no changeset history surface.
- Loading: Undo disables both buttons until the revert answers. Empty: no state; a toast exists only for a change.

## Accessibility

- The toast is `role="status"` in the existing `aria-live="polite"` stack; its message is the announcement. Buttons
  carry visible labels and `aria-label` "Show {name}'s changes" / "Undo {name}'s changes"; both are native buttons,
  keyboard reachable, Enter and Space activate. Focus is never moved to the toast.
- The toast has no timeout (WCAG 2.2.1); it goes when dismissed or replaced by a newer burst from the same token.
- The outline is `aria-hidden`; it supplements the toast. Its 2 px stroke in a participant colour is drawn over a
  1 px halo in the canvas surface colour so it meets 3:1 against any element fill (WCAG 1.4.11).
- Motion: the outline fades in and out over the motion blueprint's short duration (CS37); under
  `prefers-reduced-motion` or the `.reduce-motion` class it appears and disappears with no transition. Show pans
  without animation under reduced motion.

## Web Experience

- No change to first paint: the overlay renders nothing until a reveal exists, and the toast lives in the existing
  portal. LCP is untouched.
- CLS: the toast is fixed-position and the overlay absolutely positioned in canvas space; neither moves layout.
- INP: Show and Undo handlers do one viewport update and one fetch; the op apply is a single state update.

## Observability

Every api line carries `documentId`, `tabId`, `changesetId` (when one exists) and counts, never content.

| Fingerprint                                                   | Where                       | Level |
| ------------------------------------------------------------- | --------------------------- | ----- |
| `[changeset] applied` (`rev`, `rebasedOver`, counts, `agent`) | api, step 8                 | info  |
| `[changeset] dry-run` (counts)                                | api, step 5                 | info  |
| `[changeset] conflict` (conflict count, `strict`)             | api, base check             | info  |
| `[changeset] held` (held count)                               | api, held check             | info  |
| `[changeset] rejected` (codes)                                | api, engine refusal         | info  |
| `[changeset] lost-race` (attempt)                             | api, step 9                 | warn  |
| `[changeset] relay-failed` (error)                            | api, step 10                | warn  |
| `[changeset] selections-unreachable` (error)                  | api, step 1                 | warn  |
| `[changeset] merged-on-save` (records, elements)              | api, tab PUT                | info  |
| `[changeset] superseded-on-save` (elements)                   | api, tab PUT                | info  |
| `[changeset] seen-invalid` (raw length)                       | api, tab PUT                | warn  |
| `[changeset] whole-tab-refused` (token id)                    | api, tab PUT 405            | info  |
| `[changeset] reverted` (`revertOf`, reverted, kept)           | api, revert                 | info  |
| `[changeset] tab-renamed` (`rev`)                             | api, rename                 | info  |
| `changesets sweep: deleted <n> rows older than <cutoff>`      | api, cron (`scheduleSweep`) | info  |
| `[changeset] received` (`rev`, decision)                      | editor, `debugLog`          | trace |
| `[changeset] gap-refetch` (`prevRev`, seen)                   | editor, `debugLog`          | trace |
| `[changeset] undo-failed` (status)                            | editor                      | warn  |

Telemetry, server-side through `reportServerEvent`, never for a dry run (CS12): `Agent` / `Applied`, `Conflicted`
(409 conflict and 412), `Held` for an agent changeset; `Agent` / `Reverted` for a revert of an agent changeset;
type `frontDoorOf(request)`: `Mcp`, `Cli`, `Api` or, for the toast's Undo, `Editor`. Client-side, Show tracks
`Agent` / `Opened` / `Toast`.

## Testing

| Spec rule                                                                | Test                                                                                                       |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Id `cs_` + 10 base32, minted by the api                                  | `apps/api/src/changesets/changeset-id.test.ts`                                                             |
| One tab per changeset; a new tab is a replace on a missing id            | `apps/api/src/routes/changesets.test.ts` "creates a tab", "refuses another document's tab"                 |
| Agent = token; absent for a session                                      | `changesets.test.ts` "records the token", "records no token for a session"                                 |
| Summary up to 80                                                         | `packages/api-schema/src/changesets.test.ts`; `changesets.test.ts` "refuses a long summary"                |
| Atomic; a rejection writes nothing and says why                          | `changesets.test.ts` "writes nothing on any refusal" (tab row, record, parts, relay all absent)            |
| Whole-tab PUT is the editor's; a token is refused 405                    | `apps/api/src/routes/tab-put-route.test.ts` "token PUT answers use_changesets"                             |
| Tab rename route, relayed as `document-meta`                             | `apps/api/src/routes/tab-name-route.test.ts`; `document-room.test.ts` "/mutation sequences document-meta"  |
| Every write advances `rev`                                               | `apps/api/src/db/tabs.test.ts` (real SQLite): upsert, at-rev, rename, seed, swap, copy, trigger aborts     |
| Every tab read returns `rev` and `ETag`                                  | `document-subresource-routes` GET test; `tab-row.test.ts`                                                  |
| Any edit identity may submit; dry run writes nothing                     | `changesets.test.ts` "share-link editor submits", "dry run answers the plan only"                          |
| Base table, each row (missing fingerprint conflicts)                     | `apps/api/src/changesets/base-check.test.ts`, one case per row                                             |
| Shifts are not fingerprinted; live fields are ignored                    | `base-check.test.ts` "ignores make-room shifts"; `element-fingerprint.test.ts` "ignores live fields"       |
| Held: every selected element, any role, never the owner, agents only     | `held-check.test.ts`; `changesets.test.ts` "elements_held", "owner's own selection", "person's revert"     |
| Unreachable room holds nothing and logs                                  | `changesets.test.ts` "room down logs and applies"                                                          |
| Compile through the engine and `isValidTab`                              | `changesets.test.ts` with the engine, "invalid_result"                                                     |
| CAS; lost race repeats once then 409                                     | `apps/api/src/changesets/submit.test.ts` (real SQLite, injected interleaving)                              |
| Record and parts                                                         | `apps/api/src/db/changesets.test.ts`; "a part at the cap is refused too_large"                             |
| One sequenced op to the submitting room; relay failure never fails       | `document-room.test.ts` "/mutation sequences a changeset"; `submit.test.ts` "relay throws, 200"            |
| Merge on save: each element rule, reorder, live-field graft, idempotence | `apps/api/src/changesets/merge-on-save.test.ts`                                                            |
| Header absent: the window                                                | `tab-put-route.test.ts` "no header merges the last 10 minutes"                                             |
| Survives a dropped relay, a sleeping room, an offline editor             | `tab-put-route.test.ts` "merges a changeset no editor saw"; `useChangesetFeed.test.tsx` gap refetch; e2e   |
| Op carries id, rev, name, colour, summary, element ops                   | `apps/api/src/changesets/room-op.test.ts`                                                                  |
| Oversize relay: no element ops, editors refetch                          | `room-op.test.ts`; `changeset-seen.test.ts` "refetch"                                                      |
| `GET /selections`                                                        | `apps/api/src/room-selections.test.ts`; `document-room.test.ts` "answers selections", "mine by person tag" |
| Rooms for every server-stored document, none offline                     | `room-client.test.ts` "stub for a personal document"; `useRoomConnection` gate test                        |
| Revert: inverse as a new changeset, kept list, twice, created tab        | `apps/api/src/changesets/revert-plan.test.ts`; `changesets.test.ts` revert cases                           |
| One changeset read                                                       | `changesets.test.ts` "GET one answers results and text"                                                    |
| Toast Undo is the revert; Ctrl+Z never reverts                           | `useChangesetFeed.test.tsx`; `apps/live/e2e/agent-changesets.spec.ts` (planned) "Ctrl+Z leaves it"         |
| Revertable while the record exists                                       | `db/changesets.test.ts` sweep with cascade; `changesets.test.ts` "404 after the sweep"                     |
| Anyone with edit may revert                                              | `changesets.test.ts` "team member reverts", "viewer refused"                                               |
| Applies as a peer's and folds into the baseline                          | `room-op-apply.test.ts` case `changeset`; `save-baseline.test.ts`                                          |
| Outline for 2000 ms; reduced motion                                      | `ChangesetRevealOverlay.test.tsx` (fake timers, both motion modes)                                         |
| Toast copy, Show, Undo newest first, coalescing per token, no timeout    | `changeset-toast.test.ts`; `useChangesetFeed.test.tsx`; `useToast.test.tsx` "action toast stays"           |
| Toast silenced by "Show notifications"                                   | `useToast.test.tsx` "action toast respects the preference"                                                 |
| MCP tools submit changesets; ops with a base and `rev`; rename route     | `apps/mcp/src/tools.test.ts`; `apps/mcp/src/changeset-client.test.ts`                                      |
| `CHANGESET_MAX_OPERATIONS`                                               | `changesets.test.ts` "501 operations"                                                                      |
| Token write limit                                                        | `index.test.ts` "a changeset counts against the token's writes"                                            |
| Logs                                                                     | each api test above asserts its fingerprint on a spied `console`                                           |
| Telemetry, `Editor` type, Show tracked                                   | `changesets.test.ts` telemetry rows; `useChangesetFeed.test.tsx`; `apps/telemetry` catalogue suite         |
| Fingerprint stability across api, CLI and MCP                            | `packages/document/src/element-fingerprint.test.ts` (golden values, key order, live fields)                |
| Room op vocabulary                                                       | `room-op-vocabulary.test.ts` stays green with the `changeset` branch                                       |
| OpenAPI parity                                                           | `apps/api/src/openapi/*.test.ts`                                                                           |
| Owner columns                                                            | `account-owner-columns.test.ts` entry for `agent_changesets.author_id`                                     |

The end-to-end spec (`agent-changesets.spec.ts`, dark mode) opens a personal document, submits a changeset with an
API token, and checks the element appears, the outline shows, the toast reads, Show frames it, the next autosave
keeps it, and Undo reverts it.

## Constants and configuration

In `packages/api-schema/src/changesets.ts` (CS35):

| Constant                         | Value                  | Provenance                                           | Safe range        |
| -------------------------------- | ---------------------- | ---------------------------------------------------- | ----------------- |
| `CHANGESET_MAX_OPERATIONS`       | 500                    | Spec                                                 | 100 to 2,000      |
| `CHANGESET_RELAY_MAX_BYTES`      | 196,608                | Spec (192 KiB, under the 256 KiB frame)              | 64 KiB to 224 KiB |
| `CHANGESET_MERGE_WINDOW_MS`      | 600,000                | Spec (10 minutes)                                    | 5 to 60 minutes   |
| `CHANGESET_RETENTION_DAYS`       | 30                     | Spec (matches `TRASH_RETENTION_DAYS`)                | 7 to 90           |
| `CHANGESET_REVEAL_MS`            | 2,000                  | Spec                                                 | 1,000 to 5,000    |
| `CHANGESET_TOAST_COALESCE_MS`    | 10,000                 | Spec                                                 | 2,000 to 60,000   |
| `CHANGESET_SUMMARY_MAX`          | 80                     | Spec                                                 | 40 to 200         |
| `CHANGESET_PART_MAX_BYTES`       | 1,991,808              | `MAX_TAB_BYTES`: one D1 row per part (CS43)          | fixed by D1       |
| `CHANGESET_MERGE_PAGE`           | 20                     | CS18                                                 | 5 to 50           |
| `CHANGESET_LIST_DEFAULT`, `_MAX` | 20, 100                | CS26                                                 | 10 to 500         |
| `CHANGESET_ID_LENGTH`            | 10                     | Spec; 50 bits                                        | 10 to 16          |
| `ELEMENT_FINGERPRINT_LENGTH`     | 16                     | CS6 (64 bits)                                        | 12 to 32          |
| `ROOM_SELECTIONS_TIMEOUT_MS`     | 1,500                  | CS20                                                 | 500 to 5,000      |
| `ROOM_RELAY_TIMEOUT_MS`          | 2,000                  | CS20                                                 | 500 to 5,000      |
| `MAX_SELECTION_IDS`              | 500                    | CS38                                                 | 100 to 2,000      |
| `TAB_SAVE_CAS_ATTEMPTS`          | 2                      | Spec's "once" for changesets, applied to saves (CS4) | 2 to 3            |
| `CHANGESET_SEEN_HEADER`          | `X-Changeset-Seen`     | Spec                                                 | fixed             |
| `CLIENT_HEADER`                  | `X-Livediagram-Client` | CS25                                                 | fixed             |

No new binding or environment variable; self-hosting needs only the migration. Staging needs no `[env.staging]`
change.

## Defaults ledger

CS1 to CS45 in [DEFAULTS.md](DEFAULTS.md).
