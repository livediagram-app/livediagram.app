# Delta saves blueprint

Derived from [Delta saves](../delta-saves.md). Engineering precision only; design lives in the spec. The shared parts
are one copy in `packages/` (livediagram's blueprint of the same name sets them out in full); this blueprint names
what livehuddle binds, and its own tests.

## Domain and naming

| Term         | Identifier                   | Meaning                                                                          |
| ------------ | ---------------------------- | -------------------------------------------------------------------------------- |
| Delta save   | `POST .../tabs/:tabId/delta` | One tab save sent as element ops over a base copy                                |
| Delta body   | `TabDeltaBody`               | `{ baseRev, digest, ops, tab }`, parsed by `parseTabDelta`                       |
| Base copy    | (the editor's, per tab)      | The tab's elements exactly as stored at `baseRev`                                |
| Digest       | `elementsDigest(elements)`   | SHA-256 lowercase hex of `JSON.stringify(elements)`                              |
| Refusal      | `TabDeltaRefusal`            | `too_many_ops`, `no_base`, `stale_base`, `digest_mismatch`                       |
| Whole save   | `PUT .../tabs/:tabId`        | The whole-tab save; the delta save's fallback                                    |
| Announcement | `TabSavedOp` (`tab-saved`)   | `{ tabId, rev, digest }`, an Editor's landed save, relayed after its element ops |
| Draft        | `TabDraftRecord`             | The unload flush's copy of a tab in this browser, over its base copy's revision  |

"Delta save" is the only name: never "patch save", "partial save" or "diff save".

## Modules

| File                                                          | Responsibility                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `../packages/api-kit/src/tab-delta-door.ts`                   | `answerTabDelta` (shared): parse, refuse, rebuild, prove by digest, hand to `write`; `TAB_DELTA_OPENAPI`                                                                                                                                                                |
| `apps/api/src/routes/tab-delta-route.ts`                      | `handleTabDelta`: binds `answerTabDelta` to `getTab`, `applyElementOps` and `writeTabSave`                                                                                                                                                                              |
| `apps/api/src/routes/tab-put-route.ts`                        | `writeTabSave`: the whole save's pipeline from the body on, the PUT's and the delta door's; `handleTabPut`                                                                                                                                                              |
| `apps/api/src/routes/document-subresource-routes.ts`          | Dispatch: `POST /api/documents/:id/tabs/:tabId/delta` behind the PUT's doors, in their order                                                                                                                                                                            |
| `apps/api/src/openapi/manifest.ts`                            | The route's OpenAPI entry, `...TAB_DELTA_OPENAPI`                                                                                                                                                                                                                       |
| `packages/api-schema/src/room-op-kinds.ts`                    | `'tab-saved'` among `MUTATION_OP_KINDS`; the `RoomOp` union (`room-op.ts`) takes `TabSavedOp`                                                                                                                                                                           |
| `apps/editor/lib/api/tabs.ts`                                 | The binding: `delta: { diff: diffToElementOps }`, `drafts: createTabDraftStore(TAB_DRAFTS_DB)` (`livehuddle-drafts`); `apiSavedTabDigest`, `apiAdoptPeerSave`, `apiTakeDraftReplay`, `apiDiscardDraft`, `onTabDraft`; every editor load reads its draft (`draft: true`) |
| `apps/editor/app/document/[id]/tab-save-flow.ts`              | `saveTabAndRelay(..., digestOf)` announces a landed save with `announceTabSave` after its element ops                                                                                                                                                                   |
| `apps/editor/app/document/[id]/useAutosave.ts`                | Passes `apiSavedTabDigest` as `digestOf`                                                                                                                                                                                                                                |
| `apps/editor/app/document/[id]/room-op-shape.ts`              | `tab-saved` well formed by `tabSavedIsWellFormed`                                                                                                                                                                                                                       |
| `apps/editor/app/document/[id]/room-op-receive.ts`            | A received `tab-saved` for a loaded tab goes to `receiveTabSaved` with the baseline's tab                                                                                                                                                                               |
| `apps/editor/app/document/[id]/editor-state/useEditorRoom.ts` | `receiveTabSaved` hands it to `apiAdoptPeerSave` for an Editor; mounts `useTabDrafts` with the draft doors                                                                                                                                                              |

## Behaviour and state

- **The door** (`answerTabDelta`): body parsed (`400` with `parseTabDelta`'s message), then `too_many_ops` (more than
  `TAB_DELTA_MAX_OPS`), then `no_base` (`getTab` answers null), then `stale_base` (`stored.rev !== baseRev`), then
  `digest_mismatch` (`elementsDigest(applyElementOps(stored.elements, ops)) !== digest`); each refusal is
  `409 { error: 'delta_refused', reason }` and writes nothing. Otherwise `writeTabSave(ctx, saving, tabId, owner,
{ ...tab, id: tabId, elements }, { stored })`, whose first attempt uses the read just made; a lost race reads again.
  Its Response (any of the whole save's refusals) is answered as is; else `200 { rev, digest }` with the digest of the
  elements it stored.
- **The editor** (`createTabCalls` with `delta` and `drafts`): base copies held from the load (before
  `normalizeElement`), the whole save's echo (`holdEcho`) and a matching delta answer, at most
  `TAB_DELTA_BASES_MAX` (16) tabs; `send` before the whole `PUT`, `null` (no base, too large, refused) saves whole in
  the same call; the unload flush plans with `planUnload`, keepalive within the 60 KB budget, writes a draft first.
- **The announcement**: `saveTabAndRelay` relays the save's ops, then, for a numeric revision, `announceTabSave`
  sends `tab-saved` with `apiSavedTabDigest(tabId, rev)` (null when no copy is held at `rev`: nothing sent). A peer's
  `receiveRoomOp` hands a loaded tab's baseline copy to `receiveTabSaved`; the room hook calls `apiAdoptPeerSave` only
  for an Editor (`canEdit && !participant.participating`).
- **Drafts**: `useTabDrafts` takes a replay for an Editor over a loaded, unedited tab (`applyRemoteOp`), else
  discards it; a stale draft's warning waits for the item id.

## Interfaces and contracts

The wire is `@liveworkspace/api-schema/tab-delta` (`TabDeltaBody`, `TabDeltaRefusal`, `TabSavedOp`); the door answers
`200 { rev: number, digest: string }`, `400 { error: 'bad_request', message }`, `409 { error: 'delta_refused', reason }`
or any answer of the whole save (`403`, `404`, `405 use_changesets`, `409 empty_tab_overwrite_blocked`, `409 tab_busy`,
`413`).

## Data and persistence

Nothing new is stored server-side: the door writes through `writeTabSave`. The browser keeps drafts in IndexedDB
`livehuddle-drafts`, store `drafts`, keyed per person, item and tab (`createTabDrafts`), at most `TAB_DRAFT_MAX_CHARS`.

## Errors and edge cases

A wrong base copy, a merge the editor did not see, or an element in another key order only fails the digest: the
delta is refused or the answer's digest differs, and the next save is whole. A delta answer from an older request
never replaces a newer copy (`hold` keeps the higher revision). IndexedDB missing or failing keeps no drafts.

## Security and trust

The door sits behind the PUT's doors (`refuseTokenTabPut`, `requireOwner`, the edit gate with the tab scope); the
digest makes the stored tab exactly what a whole save would have sent, so the door grants nothing the PUT does not.
The room relays `tab-saved` only from an Editor (`gateClientOp`, a mutation op); a forged one only fails a digest.

## Performance and limits

A one-label edit on a 2,000-element tab: measured 264,926 bytes sent whole and 295 bytes as a delta (`tab-delta-save.test.ts`, Work Tracker 805), about 900 times less. The api applies at most 500 ops and hashes the rebuilt
elements once more than a whole save; a peer hashes its baseline once per announced save.

## Observability

`[tab-delta] refused { documentId, tabId, reason }` and `[tab-delta] saved { documentId, tabId, ops, matched }` (api);
`[tab-delta] refused`, `[tab-delta] peer save adopted` / `not adopted` (editor debug log).

## Testing

| Rule                                                  | Test                                                            |
| ----------------------------------------------------- | --------------------------------------------------------------- |
| The door's refusals, the answer, the share roles      | `apps/api/src/routes/tab-delta-route.test.ts`                   |
| The whole PUT unchanged by the extraction             | `apps/api/src/routes/tab-put-route.test.ts`                     |
| The room relays an Editor's `tab-saved` only          | `apps/api/src/room-op-gate.test.ts`                             |
| This editor sends deltas, falls back, flushes, adopts | `apps/editor/lib/api/tab-delta-save.test.ts`                    |
| `tab-saved` sent, shape-checked and received          | `apps/editor/app/document/[id]/room-op-tab-saved.test.ts`       |
| The shared door, editor side, drafts and announcement | `packages/api-kit`, `packages/api-schema`, `packages/workbench` |

## Constants and configuration

`TAB_DELTA_MAX_OPS` (500), `TAB_DELTA_MAX_SHARE` (0.5), `TAB_DELTA_BASES_MAX` (16), `TAB_DRAFT_MAX_CHARS`
(4,000,000), `TAB_DRAFT_READ_TIMEOUT_MS` (1,000), the 60 KB keepalive budget: all shared, with their safe ranges where
they are defined. `TAB_DRAFTS_DB` is `livehuddle-drafts`.
