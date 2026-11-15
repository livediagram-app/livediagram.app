# Last seen copy blueprint

Derived from [Offline Mode → Warm open of a cloud document](../offline-mode.md#warm-open-of-a-cloud-document)
(Work Tracker 890). Engineering precision only; design lives in the spec. livedocuments, livedesign and livehuddle
bind the same shared modules; their blueprints name only their bindings and point here.

## Build plan

| Part | What it ships                                                                                                                           | Visible          |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| 1    | Specs, this blueprint, the shared store and copies, kept by every arrival, forgotten on lost access, cleared on sign-out                | No               |
| 2    | The copy follows the document: refreshed when the first tab's save lands and when the tab list or name changes, so it is the last seen  | No               |
| 3    | The warm open in all four editors: the early paint, read-only until the participant resolves, the catch-up replace, lost access, timing | Yes              |
| 4    | Warm-open `DocumentLoad` measured before and after on production builds, numbers in this blueprint and the spec                         | No (docs, tests) |

## Domain and naming

| Term            | Identifier                       | Meaning                                                                                    |
| --------------- | -------------------------------- | ------------------------------------------------------------------------------------------ |
| Last seen copy  | `LastSeenCopy<Item, Tab>`        | What one load answered for one reader and document, kept in this browser                   |
| Reader          | `reader` (a participant id)      | The account id (`user_…`) or the guest's id (`guest_…`) the load ran as                    |
| Copy key        | `lastSeenKey(reader, itemId)`    | `${reader}\n${itemId}`: one copy per reader and document                                   |
| Way in          | `via`                            | The share code the address carried (`?s=`), or null for the document's own address         |
| Access          | `LastSeenAccess`                 | `{ role, isOwner, sessionShareCode, tabScope }` as the arrival set them                    |
| First tab       | `LastSeenFirstTab<Tab>`          | `{ id, rev, tab }`: the tab the load painted first, with the revision it was read at       |
| Keep            | `remember(copy)`                 | Write the copy, then prune                                                                 |
| Forget          | `forget(reader, itemId)`         | Remove one copy (lost access), then prune                                                  |
| Clear           | `forgetAll()`                    | Empty the store (sign-out, account deletion)                                               |
| Prune           | (inside `remember` and `forget`) | Drop other readers' copies, copies past the age limit, and the oldest past the count limit |
| Warm open       | `readWarmCopy`, `paintWarm`      | The early paint of a copy before auth settles, read-only, until the catch-up lands         |
| Expected reader | `expectedReader(copies, who)`    | The guest token's id, or (signed-in hint) the account `lastReader()` names                 |
| Catch-up        | (the ordinary bootstrap load)    | The load that runs once auth settles and replaces the painted copy in place                |
| Follower        | `createLastSeenFollower(copies)` | The copies plus the one copy this page follows (`current`) and its waiting refresh         |
| Follow          | `followMeta`, `followSave`       | Fold the open document's name, tab list or landed first-tab save into the followed copy    |
| Refresh         | (the follower's timer)           | The one write a window of follows gathers into, `LAST_SEEN_REFRESH_MS` after the first     |
| Save landed     | `onSaveLanded(landed)`           | The autosave's newest save landed: the baseline tabs and name, and each PUT's revision     |

"Last seen copy" is the only name: never "cache", "snapshot" or "local copy" (This Browser documents are local).

## Modules

| File                                                                 | Responsibility                                                                                                                                                                                                               |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `../packages/workbench/src/lib/api/last-seen-copies.ts`              | `createLastSeenCopies(store)`: `remember`, `read`, `lastReader`, `forget`, `forgetAll`; the limits; `lastSeenKey`; the read-side validation                                                                                  |
| `../packages/workbench/src/lib/api/last-seen-store.ts`               | `createLastSeenStore(dbName)`: the IndexedDB store, two object stores (`copies`, `seen`), one kept connection, every call bounded and never throwing                                                                         |
| `../packages/workbench/src/lib/editor-arrival.ts`                    | `openShareLink` and `openOwnAddress` keep the copy on reaching the document and forget it on not found, the deleted card or the password gate                                                                                |
| `../packages/workbench/src/lib/api/last-seen-follower.ts`            | `createLastSeenFollower(copies)`: `remember`, `read`, `forget`, `forgetAll`, `follows`, `followMeta`, `followSave`, `flush`; `LAST_SEEN_REFRESH_MS`                                                                          |
| `../packages/workbench/src/hooks/persistence/useLastSeenFollow.ts`   | Follows the open document's name and tab list, answers `onSaveLanded`, forgets a copy whose document went to This Browser                                                                                                    |
| `../packages/workbench/src/hooks/persistence/useAutosaveCore.ts`     | `onSaveLanded` (an option, read as an effect event): told once the newest save landed, with the baseline tabs, name and revisions                                                                                            |
| `../packages/workbench/src/lib/warm-open.ts`                         | `readWarmCopy`, `expectedReader`, `hashTabId`, `keptWarmTab`, `measureAfterPaint`: which copy may paint, and the timing marks                                                                                                |
| `apps/editor/app/document/[id]/useIdentityBootstrap.ts`              | `tryEarlyOpen` reads the copy before auth settles, `paintWarm` paints it, the load's catch-up replaces it or takes it off the screen                                                                                         |
| `apps/editor/lib/last-seen.ts`                                       | livediagram's binding: `lastSeenCopies`, a follower over `createLastSeenCopies(createLastSeenStore(LAST_SEEN_DB))` (`livediagram-last-seen`)                                                                                 |
| `apps/editor/app/document/[id]/editor-state/useEditorPersistence.ts` | Calls `useLastSeenFollow` and hands its `onSaveLanded` to `useAutosave`                                                                                                                                                      |
| `apps/editor/app/document/[id]/document-arrival.ts`                  | `DOCUMENT_ARRIVAL.lastSeen = lastSeenCopies`                                                                                                                                                                                 |
| `apps/editor/app/document/[id]/seed-fetched-document.ts`             | The seed answers the first tab it painted (`LastSeenFirstTab`), or null when the eager fetch failed; `makePaintLastSeen` shows a copy the same way; the seed keeps the painted tab at an unchanged revision (`warmFirstTab`) |
| `apps/editor/components/providers/AccountsBridge.tsx`                | `endSession` (sign-out, account deletion) awaits `lastSeenCopies.forgetAll()` beside `forgetRecentDiagrams()`                                                                                                                |

## Behaviour and state

- **Keep (share link).** `openShareLink` reaching the document, not a Community post and not an embed: `remember({
reader: self.id, itemId: fetched.id, item: fetched, firstTab, via: shareCodeParam, access })`, where `access` is the
  session the kernel answered (`sessionRole`, `isOwner`, `sessionShareCode`) and the link's `tabScope`.
- **Keep (own address).** `openOwnAddress` reaching a server document (not This Browser): `remember({ reader: self.id,
itemId: id, item: fetched, firstTab, via: null, access: { role: 'edit', isOwner, sessionShareCode: null, tabScope: null
} })`, `isOwner` being the grant's answer.
- **Forget.** Not found, the deleted card and the password gate forget `(self.id, id)` when the address names the
  document (`id`). A share link whose address names none has no copy to warm-open from, so there is nothing to forget.
  A load that cannot reach the server (the error screen) forgets nothing.
- **Never awaited.** The arrival starts `remember` and `forget` and goes on; a rejection is swallowed.
- **Prune** runs after every keep and forget: it lists `seen` (tiny rows, never the bodies) and removes, in one
  transaction over both stores, every copy whose reader is not this one, every copy seen more than
  `LAST_SEEN_MAX_AGE_MS` ago, and this reader's copies past the newest `LAST_SEEN_MAX_COPIES`.
- **Read** (part 3's door, built and tested now): the copy for `(reader, itemId)` or null. A record that is not this
  version, not this reader's or document's, past the age limit, or whose body does not parse to the copy's shape is
  removed and reads as null. The stored role goes through `parseStoredLevel`: a role this code does not know reads as
  Viewer, never higher.
- **Follow (part 2).** The follower holds `current`, the copy the last `remember` kept, in memory. `followMeta(reader,
itemId, { name, tabs })` and `followSave(reader, itemId, { name, tabs, revs })` do nothing unless `current` is that
  reader's copy of that document, so only a copy an arrival kept is ever followed (never an embed, a Community post, a
  workbench or a This Browser document) and never for another reader.
  - **Meta.** When the name or the tab list (each tab's id, name and folder, in order) differs from `current.item`, the
    item's `name` and `tabs` are rewritten: each summary keeps the fields the load answered for that tab id
    (`documentId`, `updatedAt`, `outOfScope`, `connection`) with its `name`, `folder` and `orderIndex` (its position)
    from the editor; a tab new since the load gets `{ id, name, orderIndex, folder }`. When the first tab to load
    (`firstTabToLoad(tabs, access.tabScope)`) is no longer `firstTab.id`, `firstTab` becomes null (a warm open would
    paint the wrong tab); a renamed first tab's body takes the new name.
  - **Save.** `followSave` folds the meta as above, then, when the landing carries a revision for the first tab to
    load that is at least `firstTab.rev`, sets `firstTab = { id, rev, tab }` from the landed baseline tab. A landing
    without that revision (a Participant's relay, another tab's save) leaves the body as it was.
  - **Refresh.** A follow that changed `current` arms one timer of `LAST_SEEN_REFRESH_MS` unless one is waiting;
    further follows only update `current`, so the timer writes the newest copy (`copies.remember(current)`, which also
    prunes): at most one write per window, the first within the window of the first change. `flush()` writes a waiting
    refresh at once; the follower calls it on `pagehide` and on `visibilitychange` to hidden (listeners added on the
    first refresh). A follow that changed nothing writes nothing (the arrival's own render follows an identical copy).
  - **Hook.** `useLastSeenFollow({ follower, reader, itemId, following, serverStored, name, tabs })`, where the editor
    passes `following = hydrated && serverStored && !embed && !workbench`: an effect keyed on the name and a signature
    of the tab list (id, name, folder; built per `tabs` change, O(tabs), never O(elements)) calls `followMeta`;
    `onSaveLanded` (stable) calls `followSave`; a hydrated document that is no longer server stored (Take Offline in
    place) while `follows(reader, itemId)` is forgotten.
  - **Save landed.** `useAutosaveCore` collects each tab PUT's revision and, in the branch where the newest save moves
    the baseline, calls `onSaveLanded({ tabs, name, revs })` with the baseline `baseline.after` answered.
- **Clear.** `forgetAll` empties both object stores in one transaction. Sign-out awaits it (bounded by the store's
  timeout) before the hop, so no copy outlives the session in this browser.
- **Warm open (part 3).** The bootstrap's first layout effect calls `tryEarlyOpen` (never awaited by anything; a
  rejection is logged and the open waits for auth as before). Unless auth has answered, the editor is hydrated, or
  it is an embed or a workbench:
  - A path naming a This Browser document takes the early open, as before (`isOfflineId`, only without `?s=`).
  - Otherwise `readWarmCopy(lastSeenCopies, { itemId, shareCode, hash }, { signedIn: readSignedInHint(), guestId:
getGuestSelfId() })`. `expectedReader`: signed out, the guest token's id; signed in, `lastReader()` (the reader of
    the newest `seen` row) when it is an account (`user_…`), else nobody. Then `read(reader, itemId)`, and the copy
    paints only when `via === shareCode` (null for the own address), `firstTab` is kept, `firstTab.id ===
firstTabToLoad(item.tabs, access.tabScope)`, and the `#t=` fragment names no other tab of the item. Any failure
    reads as null.
  - After the read, `runRef.current !== 0` (the ordinary load already started) drops the copy unpainted.
  - **`paintWarm(copy)`**: `warmRef.current = copy`; `makePaintLastSeen(seedDeps(set, resetTabs, false))(copy)`
    shows it as the seed shows a load (placeholder tabs from `item.tabs`, the first filled from `firstTab.tab`, the
    name, deck, active tab, shareable, team and owner fields; nothing fetched, marked loaded, seeded into the autosave
    baseline or counted); then `setIsOwner(access.isOwner)`, `setSessionTabScope(access.tabScope)`,
    `setSessionRole('view')` and `setLoadingDocument(false)`. `documentId` stays null and `hydrated` false, so the
    autosave, the room, presence, follows, comments and lazy tab loads all stay off; `selfParticipant` stays `'self'`.
  - **Catch-up.** The ordinary bootstrap runs once `authLoaded` flips, unchanged, with `loadingDocument` already
    false, so no opening screen shows between. After the participant resolves, a `self.id` other than
    `warmRef.current.reader` clears `warmRef` and sets `loadingDocument` true (the copy leaves the screen; the load
    then opens the document for this reader). The seed reads `warmFirstTab()`: when the fresh first tab has the
    copy's id and revision (`keptWarmTab`), the painted tab object is kept, so element views memoised on it skip.
    The arrival then sets the role, owner chrome and share code; `hydrated` turns everything on.
  - **Lost access** lands as the arrival's own screen (not found, deleted card, password gate, all ahead of the
    canvas in the page's render order), and the arrival forgets the copy as in part 1. A load error shows the
    error card and keeps the copy.
  - **Marks.** `measureAfterPaint('warm-paint', documentLoadOrigin())` after the paint, and
    `measureAfterPaint('warm-catch-up', documentLoadOrigin())` when the catch-up reaches `done` with `warmRef` set:
    `performance.measure` entries from the same start as `DocumentLoad`, taken after the next frame.

## Interfaces and contracts

- `LastSeenStore`: `get(key) → Promise<unknown>`, `put(key, record) → Promise<boolean>`, `remove(keys) →
Promise<void>`, `entries() → Promise<LastSeenEntry[]>`, `clear() → Promise<void>`. None rejects.
- Stored record (`copies`): `{ v: 1, reader, itemId, seenAt, body }`, `body` the JSON of `{ item, firstTab, via, access
}`. Index row (`seen`): `{ reader, seenAt }` under the same key.
- `ArrivalProduct.lastSeen?: LastSeenDoors<Item>` (`remember`, `forget`); left out (liveplanner), nothing is kept.
- `ArrivalRun.seed` may answer `LastSeenFirstTab<unknown> | null`; a seed answering nothing keeps a copy without a
  first tab.

## Data and persistence

- One database per product (`livediagram-last-seen`, `livedocuments-last-seen`, `livedesign-last-seen`,
  `livehuddle-last-seen`), version 1, created on first use. No migration: a record of another version reads as null and
  is removed.
- Every field of the copy is the reader's own view of the document, exactly what the api answered them; nothing is
  derived or widened.

## Errors and edge cases

| Case                                                     | Handling                                                                                                                |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| No IndexedDB, a private window, open errors or `blocked` | Every call resolves (null, false, nothing); the editor works as before                                                  |
| A call that never answers                                | Gives up after `LAST_SEEN_TIMEOUT_MS` and resolves as above                                                             |
| Copy over `LAST_SEEN_MAX_CHARS`                          | Not kept; the older copy under that key is removed so it can't be read stale                                            |
| Another tab on a newer version upgrades the database     | `onversionchange` closes the kept connection; the next call opens again                                                 |
| Corrupt or foreign record                                | Removed on read; reads as null                                                                                          |
| Two loads racing (auth settling twice)                   | The arrival's setters are run-guarded; a superseded keep writes the same reader's copy, which the newer keep overwrites |
| A refresh waiting when another document is kept          | `remember` writes the waiting refresh first (it is the older document's last copy), then keeps the new one              |
| A refresh waiting at sign-out or a forget                | `forgetAll` and a matching `forget` drop `current` and cancel the timer before the store call, so nothing comes back    |
| Document taken offline to This Browser while open        | The hook forgets its copy; This Browser documents keep none                                                             |
| A save or follow before the arrival kept the copy        | `current` is not that copy yet: nothing happens; the arrival's keep has the same content                                |
| The first tab deleted or moved off first                 | `firstTab` becomes null until a save of the new first tab lands                                                         |
| A refresh's write fails or times out                     | `remember` never rejects; the copy stays as last written and the next refresh tries again                               |
| Auth answers before the warm read does                   | `runRef.current !== 0`: the copy is dropped unpainted; the ordinary load paints what it fetches                         |
| The read fails, times out or the store is missing        | `readWarmCopy` answers null; the open waits for auth as before                                                          |
| A stale signed-in hint (signed out in another app)       | The account's copy paints; the participant resolves to someone else, so it leaves the screen for the opening screen     |
| The `#t=` fragment names another tab                     | No warm open: the copy holds no body for that tab                                                                       |
| A second browser tab of the same document                | Warm-opens from the same copy; its room connects after its own catch-up (`hydrated`)                                    |
| The document moved on since the copy                     | The fresh first tab (another revision) and tab list replace the painted ones in the catch-up's one seed                 |

## Security and trust

- The copy holds what the reader already saw, in their own browser profile, for at most 30 days. It is never sent
  anywhere.
- **Per reader:** read only for the same reader; every keep or forget prunes every other reader's copies. A sign-out
  in another app (which cannot reach this app's IndexedDB) leaves copies until this app's next load, which prunes them
  under the guest, and part 3 reads only for the reader the signed-in hint names, so a signed-out browser never shows
  them.
- **Lost access:** a revoked link, a removed team member, a trashed document or a new share password forgets the copy
  on the next load; the warm open (part 3) is read-only until that load answers, so lost access never yields an edit.
- **Follow per reader:** a follow names its reader and document and changes only `current` when both match, so a
  page whose reader changed (a sign-in hop reloads anyway) never writes one reader's view under another's key. Only
  what the editor shows this reader is folded in: the tab list a tab-scoped visitor sees keeps its out-of-scope
  summaries as the load answered them.
- A stored role is never trusted for writes: the warm open holds every edit until the participant resolves, and an
  unknown role reads as Viewer.
- **Warm open per reader (part 3):** signed out, the read uses the guest token's id, so an account's copy never paints;
  signed in, only an account's copies are read (`user_…`), never a guest's. The paint is `'view'` whatever the
  stored role, runs with no `documentId` and no `hydrated`, so nothing is saved, sent or connected under the
  placeholder; the arrival's answer sets the real role.

## Performance and limits

| Constant               | Value     | Why                                                                                     |
| ---------------------- | --------- | --------------------------------------------------------------------------------------- |
| `LAST_SEEN_MAX_COPIES` | 20        | Covers the documents a person returns to; worst case 20 × 1 MB in this product's origin |
| `LAST_SEEN_MAX_CHARS`  | 1,000,000 | About 4,000 shape elements; a 2,000-element tab's copy measured 480 KB                  |
| `LAST_SEEN_MAX_AGE_MS` | 30 days   | Older copies are more likely stale than useful                                          |
| `LAST_SEEN_TIMEOUT_MS` | 1,000 ms  | Bounds sign-out and a read; the tab GET it races is usually slower                      |

Measured (headless Chromium, 25 runs, median / p95), a 2,000-element first tab (480 KB): stringify 0.7 / 0.7 ms, write
0.7 / 3.4 ms, open and read 0.5 / 2.2 ms, parse 0.5 / 0.6 ms. 500 elements (120 KB): 0.2, 0.3, 0.2 and 0.1 ms medians.
The keep runs after the load has set the editor's state and is never awaited; the stringify is the only synchronous
cost (under 1 ms at 2,000 elements). Prune reads `seen` only (at most 20 small rows).

**Following (part 2).** The follows run on React effects and the autosave's landing, never inside a keystroke handler or
a save's request, and none writes: the write waits for the refresh. Measured (Node, CPU time, 10,000 calls, three runs,
a 200-tab document whose first tab holds 2,000 elements): a follow of an unchanged tab list 1.7 µs, a landed first-tab
save 2.4 µs, a rename that rewrites the 200 summaries 18 µs, and the hook's tab-list signature 8.3 µs per `tabs`
change (one pass over the tab list, never the elements). The tests hold budgets on these (`cpuMsOf`). A refresh writes
at most once per `LAST_SEEN_REFRESH_MS` (30 writes a minute at most while editing without pause), each the keep
measured above (0.7 ms of stringify at 2,000 elements, the IndexedDB write off the main thread).

| Constant               | Value    | Why                                                                                                       |
| ---------------------- | -------- | --------------------------------------------------------------------------------------------------------- |
| `LAST_SEEN_REFRESH_MS` | 2,000 ms | Gathers a burst of saves into one write while keeping the copy seconds behind. Safe range: 500 ms to 10 s |

**Warm open (part 3).** Measured (Node, CPU time, 1,000 calls, three runs, a 200-tab document): the check a cold open
adds (`readWarmCopy` with no copy, the store answering at once) 0.5 to 0.8 µs; the paint 6 µs (it builds 200
placeholders and never copies the elements, so 50, 500 and 2,000 elements cost the same); the catch-up's seed 7 µs
with the painted tab kept, against 7.5 µs for a cold open's seed. The real store's read is part 1's open and read
(0.5 ms median, 2.2 ms p95 at 480 KB), started in a layout effect and never awaited by the load, so a cold open
waits on nothing new. The catch-up's seed is one batched commit, and a first tab at the copy's revision keeps the
painted tab object, so the element views (memoised on their element) are not drawn again; what the role change
reaches (read-only to editable chrome) renders once more as it does in any role change. `cpuMsOf` budgets in
`warm-open.test.ts` and each `seed-fetched-*.test.ts` guard these.

## Presentation and UX

- The warm paint is the editor as a Viewer sees it: the same canvas, tab bar and header, with the role pill and the
  disabled edit controls a view link shows. No new surface, copy or state: nothing to design beyond the editor's own
  read-only look, which every share role already has.
- The catch-up changes nothing on screen when the document did not move on but the role: the tools an Editor or a
  Participant has appear. A document that moved on shows its fresh first tab and tab list in place.
- Lost access shows the card the load ends on (not found, deleted, password), as a cold open does.

## Accessibility

- Read-only controls keep the disabled states, labels and roles a view link has. The catch-up announces nothing new;
  the role pill's own label changes with the role, as it does today.

## Web Experience

- LCP: a warm open paints the canvas before auth, the participant and the tab fetch, instead of the opening screen.
- CLS: the catch-up replaces the tabs in place (same ids, same order unless the document moved on), so the canvas
  does not shift; the header's tools appearing with the role are the only change, as in any role change.
- INP: nothing runs on input; the paint and the catch-up are each one commit.

## Observability

- `debugLog('[last-seen] …')` on a failed write, a removed corrupt record and a copy too big to keep.
- `debugLog('[load] warm open from the last seen copy')` on a warm paint, `'[load] no early open'` when the early or
  warm open could not start.
- Timing marks (part 3): `performance.measure` entries `warm-paint` and `warm-catch-up`, from the same start as
  `DocumentLoad`, each taken after the next frame. No new telemetry metric: `DocumentLoad` keeps timing the fresh
  copy; part 4 reads the marks on production builds and decides whether a metric is worth adding.

## Testing

| Rule                                              | Test                                                                                 |
| ------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Keep and read back per reader                     | `last-seen-copies.test.ts` "keeps a copy and reads it back for the same reader only" |
| Other readers pruned, age and count limits        | `last-seen-copies.test.ts` "prunes …"                                                |
| Too big is not kept and drops the older copy      | `last-seen-copies.test.ts` "keeps no copy over the size limit …"                     |
| Corrupt, foreign, old records read as null and go | `last-seen-copies.test.ts` "reads a record that is not a copy as none …"             |
| Unknown role reads as Viewer                      | `last-seen-copies.test.ts` "never reads a role higher than it was kept"              |
| Sign-out clears                                   | `last-seen-copies.test.ts` "forgets every copy"; each AccountsBridge test            |
| Store survives no IndexedDB, errors, timeouts     | `last-seen-store.test.ts`                                                            |
| Editor, Participant, Viewer kept with their role  | `editor-arrival.test.ts` "keeps the last seen copy …"                                |
| Lost access forgets; an unreachable server keeps  | `editor-arrival.test.ts` "forgets the last seen copy …"                              |
| Meta follows: rename, tab added, moved, deleted   | `last-seen-follower.test.ts` "follows the name and the tab list …"                   |
| First tab body follows a landed save              | `last-seen-follower.test.ts` "follows the first tab's landed save …"                 |
| One write per window, flush on hide               | `last-seen-follower.test.ts` "gathers follows into one write …", "flushes …"         |
| Per reader, only a kept copy follows              | `last-seen-follower.test.ts` "never follows another reader's or document's copy"     |
| Sign-out and forget cancel a waiting refresh      | `last-seen-follower.test.ts` "drops a waiting refresh …"                             |
| Hook: meta effect, save landing, taken offline    | `useLastSeenFollow.test.tsx`                                                         |
| Autosave tells the newest landing                 | `useAutosave.test.tsx` "tells the last seen copy each landed save"                   |

| Whose copies the store holds | `last-seen-copies.test.ts` "answers whose copies the store holds …" |
| Expected reader: guest id, or the account held | `warm-open.test.ts` "expectedReader" |
| Signed-out or other reader never reads an account | `warm-open.test.ts` "never shows an account's copy …"; each `useIdentityBootstrap.warm.test.tsx` |
| Way in, first tab and `#t=` checks | `warm-open.test.ts` "paints a share link only by …", "paints nothing …" |
| Cold open adds next to nothing | `warm-open.test.ts` "adds next to nothing to a cold open …" (`cpuMsOfAsync`) |
| Paint shows the copy, fetches and saves nothing | each `seed-fetched-*.test.ts` "paints the copy …" |
| Catch-up keeps an unchanged first tab, else fresh | each `seed-fetched-*.test.ts` "keeps the painted tab …", "replaces the painted tab …" |
| Editor, Viewer, Participant warm opens and roles | each `useIdentityBootstrap.warm.test.tsx` "paints an Editor's copy …", "paints a view/participate link's copy …" |
| Lost access on catch-up forgets | each `useIdentityBootstrap.warm.test.tsx` "swaps the copy for not found …" |
| Someone else after all, sign-out cleared, too late | each `useIdentityBootstrap.warm.test.tsx` |

The shared modules (the store, the copies, the follower, the hook and the warm open) are held at 100% in `packages/workbench/vitest.config.ts`.

## Defaults ledger

See [DEFAULTS.md](DEFAULTS.md): the four limits and the refresh window above.
