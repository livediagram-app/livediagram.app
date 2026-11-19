# Last seen copy blueprint

Derived from [Offline Mode → Warm open of a cloud document](../offline-mode.md#warm-open-of-a-cloud-document)
(Work Tracker 890). Engineering precision only; design lives in the spec. livedocuments, livedesign, livehuddle and
liveplanner (Work Tracker 927) bind the same shared modules; their blueprints name only their bindings and point here.

## Build plan

| Part | What it ships                                                                                                                           | Visible          |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| 1    | Specs, this blueprint, the shared store and copies, kept by every arrival, forgotten on lost access, cleared on sign-out                | No               |
| 2    | The copy follows the document: refreshed when the first tab's save lands and when the tab list or name changes, so it is the last seen  | No               |
| 3    | The warm open in all four editors: the early paint, read-only until the participant resolves, the catch-up replace, lost access, timing | Yes              |
| 4    | Warm and cold opens measured on production builds, numbers here and in the spec; the `WarmPaint` timing; the refit driven check         | No (docs, tests) |

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
| Clear           | `forgetAll()`                    | Empty the store (sign-out, account deletion, a stale signed-in hint)                       |
| Prune           | (inside `remember` and `forget`) | Drop other readers' copies, copies past the age limit, and the oldest past the count limit |
| Warm open       | `readWarmCopy`, `paintWarm`      | The early paint of a copy before auth settles, read-only, until the catch-up lands         |
| Expected reader | `expectedReader(who)`            | The guest token's id, or (signed-in hint) the account the session's token answer names     |
| Catch-up        | (the ordinary bootstrap load)    | The load that runs once auth settles and replaces the painted copy in place                |
| Follower        | `createLastSeenFollower(copies)` | The copies plus the one copy this page follows (`current`) and its waiting refresh         |
| Follow          | `followMeta`, `followSave`       | Fold the open document's name, tab list or landed first-tab save into the followed copy    |
| Refresh         | (the follower's timer)           | The one write a window of follows gathers into, `LAST_SEEN_REFRESH_MS` after the first     |
| Save landed     | `onSaveLanded(landed)`           | The autosave's newest save landed: the baseline tabs and name, and each PUT's revision     |

"Last seen copy" is the only name: never "cache", "snapshot" or "local copy" (This Browser documents are local).

## Modules

| File                                                                 | Responsibility                                                                                                                                                                                                               |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `../packages/workbench/src/lib/api/last-seen-copies.ts`              | `createLastSeenCopies(store)`: `remember`, `read`, `readVia`, `forget`, `forgetAll`; the limits; `lastSeenKey`; the read-side validation                                                                                     |
| `../packages/workbench/src/lib/api/last-seen-store.ts`               | `createLastSeenStore(dbName)`: the IndexedDB store, two object stores (`copies`, `seen`), one kept connection, every call bounded and never throwing                                                                         |
| `../packages/workbench/src/lib/editor-arrival.ts`                    | `openShareLink` and `openOwnAddress` keep the copy on reaching the document and forget it on not found, the deleted card or the password gate                                                                                |
| `../packages/workbench/src/lib/api/last-seen-follower.ts`            | `createLastSeenFollower(copies)`: `remember`, `read`, `forget`, `forgetAll`, `follows`, `followMeta`, `followSave`, `followItem`, `flush`; `LAST_SEEN_REFRESH_MS`                                                            |
| `../packages/workbench/src/hooks/persistence/useLastSeenFollow.ts`   | Follows the open document's name and tab list, answers `onSaveLanded`, forgets a copy whose document went to This Browser                                                                                                    |
| `../packages/workbench/src/hooks/persistence/useAutosaveCore.ts`     | `onSaveLanded` (an option, read as an effect event): told once the newest save landed, with the baseline tabs, name and revisions                                                                                            |
| `../packages/workbench/src/lib/warm-open.ts`                         | `readWarmCopy`, `expectedReader`, `hashTabId`, `keptWarmTab`, `measureAfterPaint`: which copy may paint, and the timing marks; `guardNotFound`, `warmOpenFallback`: a warm-painted not found checked once cold               |
| `../packages/workbench/src/hooks/editor/useBrowserTabTitle.ts`       | Holds the tab title while the editor route shows it                                                                                                                                                                          |
| `../packages/auth-client/src/token-answer.ts`                        | `askToken`, `askTokenUntilKnown`: the first token answer, with unknown asked again                                                                                                                                           |
| `apps/editor/app/document/[id]/useIdentityBootstrap.ts`              | `tryEarlyOpen` reads a guest's copy before auth settles, `warmForAccount` an account's once auth has, `paintWarm` paints it, the load's catch-up replaces it or takes it off the screen                                      |
| `apps/editor/lib/last-seen.ts`                                       | livediagram's binding: `lastSeenCopies`, a follower over `createLastSeenCopies(createLastSeenStore(LAST_SEEN_DB))` (`livediagram-last-seen`)                                                                                 |
| `apps/editor/app/document/[id]/editor-state/useEditorPersistence.ts` | Calls `useLastSeenFollow` and hands its `onSaveLanded` to `useAutosave`                                                                                                                                                      |
| `apps/editor/app/document/[id]/document-arrival.ts`                  | `DOCUMENT_ARRIVAL.lastSeen = lastSeenCopies`                                                                                                                                                                                 |
| `apps/editor/app/document/[id]/seed-fetched-document.ts`             | The seed answers the first tab it painted (`LastSeenFirstTab`), or null when the eager fetch failed; `makePaintLastSeen` shows a copy the same way; the seed keeps the painted tab at an unchanged revision (`warmFirstTab`) |
| `apps/editor/components/providers/AccountsBridge.tsx`                | `forgetAccount()` (`lastSeenCopies.forgetAll()` beside `forgetRecentDiagrams()`), awaited by `endSession` and by a hinted first answer of signed out                                                                         |

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
  timeout) before the hop, so no copy outlives the session in this browser. So does the accounts bridge's
  `initialSession` when the signed-in hint was set and the first token answer is signed out (the session ended in
  another app, which cannot reach this store), before it calls `retrySilentSignIn`.
- **Warm open (part 3).** The bootstrap's first layout effect calls `tryEarlyOpen` (never awaited by anything; a
  rejection is logged and the open waits for auth as before). Unless auth has answered, the editor is hydrated, or
  it is an embed or a workbench:
  - A path naming a This Browser document takes the early open, as before (`isOfflineId`, only without `?s=`).
  - Signed in by the hint (`readSignedInHint()`, read before the first await): no read yet. The address is kept
    (`warmAddress`) and the layout effect on `[authLoaded, passwordRetry]` calls `warmForAccount` before `bootstrap`:
    once auth has answered, with an `accountUserId`, it reads
    `readWarmCopy(lastSeenCopies, address, { signedIn: true, accountId: accountUserId })`, once; an answer of signed
    out (a stale hint) reads nothing. Auth answering while `isOfflineId` loads reads at once from `tryEarlyOpen`.
  - Otherwise (no hint) `readWarmCopy(lastSeenCopies, { itemId, shareCode, hash }, { signedIn: false, guestId:
getGuestSelfId() })`. `expectedReader`: signed out, the guest token's id; signed in, the `accountId` the session
    named when it is an account (`user_…`), else nobody. Then `read(reader, itemId)`; when that finds
    none and the address carries `?s=<code>` (a link's own address, `/<route>/shared?s=<code>`, names no item, or
    names `shared` where the product's path parser reads it as an id), `readVia(reader, code)`: the reader's newest
    `seen` row whose `via` is the code, read with `read` so it is checked the same way. The address is not rewritten.
    The copy paints only when `via === shareCode` (null for the own address), `firstTab` is kept, `firstTab.id ===
firstTabToLoad(item.tabs, access.tabScope)`, and the `#t=` fragment names no other tab of the item. Any failure
    reads as null.
  - **The code it draws first.** A copy found, `tryEarlyOpen` awaits `warmPaintCodeIn(WARM_PAINT_CODE)`
    (`@liveworkspace/workbench/lib/warm-open`) before the checks below: every preload in the editor's
    `WARM_PAINT_CODE` (`apps/editor/lib/editor-deferred-code.ts`: `QuickStylePanel.preload`,
    `ElementTourHost.preload`, each a `lazyPanel` from `@liveworkspace/ui/lazy-panel`), settled or failed, or
    `WARM_PAINT_CODE_WAIT_MS` (200 ms), whichever comes first. With the code in, a lazy panel mounts its loaded
    component directly, so the paint's commit shows no Suspense fallback and reveals nothing later. No copy, no wait:
    a cold open asks for nothing new. The sign-in bridge mounts by a state update as its code lands
    (`createAuthProvider` in `@liveworkspace/workbench/components/providers/auth-provider`), never by a Suspense
    reveal, so React's 300 ms reveal throttle (`FALLBACK_THROTTLE_MS`), which any reveal on the page restarts, never
    holds auth or the load behind the paint.
  - After the read, the copy is dropped unpainted only once the ordinary load has landed: the run's setters are
    wrapped in `markLanding` (`@liveworkspace/workbench/lib/warm-open`), which sets `landedRef` on the first setter
    other than the quiet ones (`setSelfParticipant`, `setNameConfirmed`, `setIdentityPromptOpen`), so the seed, a
    not-found or deleted screen, the password gate, a load error or the someone-else swap all count. A load that has
    only started still lets the copy paint (a guest's auth settles from the local token almost at once, so it often
    starts before the read answers), unless it has resolved a reader (`readerRef`) other than the copy's. The
    load then replaces the copy as any catch-up does. `tryEarlyOpen` runs once per mount (`warmTried`), so
    StrictMode's second layout effect in dev neither reads, paints nor measures again.
  - **`paintWarm(copy)`**: `makePaintLastSeen(seedDeps(set, resetTabs, false))(copy)`
    shows it as the seed shows a load (placeholder tabs from `item.tabs`, the first filled from `firstTab.tab`, the
    name, deck, active tab, shareable, team and owner fields; nothing fetched, marked loaded, seeded into the autosave
    baseline or counted); then `setIsOwner(access.isOwner)`, `setSessionTabScope(access.tabScope)`,
    `setSessionRole('view')` and `setLoadingDocument(false)`; then `warmRef.current = copy` and
    `setWarmTabId(firstTab.id)`. `documentId` stays null and `hydrated` false, so the
    autosave, the room, presence, follows, comments and lazy tab loads all stay off; `selfParticipant` stays `'self'`.
  - **Other tabs.** `warmTabId` (editor state, null until a warm paint) is the one tab with a body before hydration.
    `deriveTabLoadState` takes `warmWithoutBody: !hydrated && warmTabId !== null && activeId !== warmTabId` and
    answers `'loading'` for it, so a tab switched to during the warm paint shows the tab loader (and blocks edits)
    rather than a blank canvas; the lazy tab load stays off until the catch-up, which then fetches it.
  - **The fit.** `useTabEntryEffects` takes `warmTabId`: before hydration it fits only the warm-painted tab (counted
    as loaded) and claims it in `lastFittedTabRef`, so a catch-up that keeps its body never fits it again and the
    view does not jump. It also takes `elements` (the active tab's array) and notes the one it fitted: when the
    catch-up lands with another array (`keptWarmTab` answered null, the copy was older than the server's), the claim
    is dropped and the tab is fitted again on its fresh body. A copy written before the last save landed (the
    follower writes at most every `LAST_SEEN_REFRESH_MS`, so a reload just after a save often paints the one before)
    would otherwise leave content the copy lacked off screen.
    The `#t=` pin still waits for `hydrated`. livedocuments and livedesign hand Pages mode the same warm-aware
    `tabLoaded`, so its page framing runs at the paint and not again at catch-up.
  - **Catch-up.** The ordinary bootstrap runs once `authLoaded` flips, unchanged, with `loadingDocument` already
    false, so no opening screen shows between. After the participant resolves, a `self.id` other than
    `warmRef.current.reader` clears `warmRef` and sets `loadingDocument` true (the copy leaves the screen; the load
    then opens the document for this reader) and clears `warmTabId`. `showDocument` first asks `keepActiveId()`
    (the active tab, from a ref kept in a layout effect, while `warmRef` is set; else null) and keeps that tab when
    the fresh tabs hold it and `isTabOutOfScope` allows it, ahead of the `#t=` pick, so the person's tab choice
    during the warm paint survives. The seed reads `warmFirstTab()`: when the fresh first tab has the
    copy's id and revision (`keptWarmTab`), the painted tab object is kept, so element views memoised on it skip.
    The arrival then sets the role, owner chrome and share code; `hydrated` turns everything on.
  - **Lost access** lands as the arrival's own screen (not found, deleted card, password gate, all ahead of the
    canvas in the page's render order), and the arrival forgets the copy as in part 1, plus, on a share link,
    `forgetVia(reader, code)` (the doors' optional `forgetVia`), since the link's own address names no item. A load error shows the
    error card and keeps the copy.
  - **Never a wrong not found.** The page's not-found setter is wrapped (`guardNotFound` in `warm-open.ts`): a not
    found that ends an open which warm-painted a copy is checked once by a cold open first. `warmOpenFallback` marks
    the item in `sessionStorage` (`warm-open-fallback:<id>`), logs `[load] warm-open-fallback not-found`, forgets the
    copy and reloads; the reload has no copy to paint and shows whatever the ordinary load ends on. A second not found
    in the same session, or a browser without `sessionStorage`, shows at once, so a gone item never loops.
  - **The answer the reader rests on.** The page's first token ask
    (`@liveworkspace/auth-client/token-answer`) reads an answer as signed in, signed out (only the api's own
    `signedIn: false`) or unknown (a failed, timed-out after `TOKEN_TIMEOUT_MS`, 5xx or malformed answer), and asks
    again on unknown (`TOKEN_RETRY_DELAYS_MS`) instead of settling as a guest. The warm paint stays up meanwhile.
  - **Marks.** `measureAfterPaint('warm-paint', documentLoadOrigin())` after the paint, and
    `measureAfterPaint('warm-catch-up', documentLoadOrigin())` when the catch-up reaches `done` with `warmRef` set:
    `performance.measure` entries from the same start as `DocumentLoad`, taken after the next frame.

## Interfaces and contracts

- `LastSeenStore`: `get(key) → Promise<unknown>`, `put(key, record) → Promise<boolean>`, `remove(keys) →
Promise<void>`, `entries() → Promise<LastSeenEntry[]>`, `clear() → Promise<void>`. None rejects.
- Stored record (`copies`): `{ v: 1, reader, itemId, seenAt, body }`, `body` the JSON of `{ item, firstTab, via, access
}`, plus `via`. Index row (`seen`): `{ reader, seenAt, via }` under the same key; a row written before `via` was
  kept lists it as null (no warm open by code for that copy until it is kept again).
- `readVia(reader, code)` and `forgetVia(reader, code)` on the copies and the follower; `forgetVia` stops following
  the current copy when it came by that code.
- `ArrivalProduct.lastSeen?: LastSeenDoors<Item>` (`remember`, `forget`, optional `forgetVia`); left out, nothing is
  kept. Every editor binds it, liveplanner too since Work Tracker 927 (its
  [blueprint](../../../../../liveplanner/docs/specs/006-project/blueprints/last-seen-copy.md): the copy's item adds the
  cards and the first tab's sheets, and a Form first tab never paints).
- `followItem(reader, itemId, fields)` on the follower: shallow-merges `fields` into the followed copy's item when
  any value differs by identity (never `name` or `tabs`, which `followMeta` owns), then schedules a refresh. Nothing
  for another reader or item. liveplanner follows its cards and first tab's sheets through it.
- `ArrivalRun.seed` may answer `LastSeenFirstTab<unknown> | null`; a seed answering nothing keeps a copy without a
  first tab.

## Data and persistence

- One database per product (`livediagram-last-seen`, `livedocuments-last-seen`, `livedesign-last-seen`,
  `livehuddle-last-seen`), version 1, created on first use. No migration: a record of another version reads as null and
  is removed.
- Every field of the copy is the reader's own view of the document, exactly what the api answered them; nothing is
  derived or widened.

## Errors and edge cases

| Case                                                      | Handling                                                                                                                |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| No IndexedDB, a private window, open errors or `blocked`  | Every call resolves (null, false, nothing); the editor works as before                                                  |
| A call that never answers                                 | Gives up after `LAST_SEEN_TIMEOUT_MS` and resolves as above                                                             |
| Copy over `LAST_SEEN_MAX_CHARS`                           | Not kept; the older copy under that key is removed so it can't be read stale                                            |
| Another tab on a newer version upgrades the database      | `onversionchange` closes the kept connection; the next call opens again                                                 |
| Corrupt or foreign record                                 | Removed on read; reads as null                                                                                          |
| Two loads racing (auth settling twice)                    | The arrival's setters are run-guarded; a superseded keep writes the same reader's copy, which the newer keep overwrites |
| A refresh waiting when another document is kept           | `remember` writes the waiting refresh first (it is the older document's last copy), then keeps the new one              |
| A refresh waiting at sign-out or a forget                 | `forgetAll` and a matching `forget` drop `current` and cancel the timer before the store call, so nothing comes back    |
| Document taken offline to This Browser while open         | The hook forgets its copy; This Browser documents keep none                                                             |
| A save or follow before the arrival kept the copy         | `current` is not that copy yet: nothing happens; the arrival's keep has the same content                                |
| The first tab deleted or moved off first                  | `firstTab` becomes null until a save of the new first tab lands                                                         |
| A refresh's write fails or times out                      | `remember` never rejects; the copy stays as last written and the next refresh tries again                               |
| Auth answers before the warm read does                    | The copy still paints while the load has not landed (`markLanding`) and resolved no other reader; else dropped          |
| The read fails, times out or the store is missing         | `readWarmCopy` answers null; the open waits for auth as before                                                          |
| A stale signed-in hint (signed out in another app)        | Nothing is read or painted; the first token answer empties the store (`forgetAll`) before the silent sign-in's retry    |
| The `#t=` fragment names another tab                      | No warm open: the copy holds no body for that tab                                                                       |
| A link's own address (`/<route>/shared?s=<code>`)         | `readVia` finds the reader's newest copy kept by that code; the address is left as it is                                |
| A tab switched to during the warm paint                   | Tab loader until the catch-up; the catch-up keeps that tab when it still exists and is in scope                         |
| A second browser tab of the same document                 | Warm-opens from the same copy; its room connects after its own catch-up (`hydrated`)                                    |
| The document moved on since the copy                      | The fresh first tab (another revision) and tab list replace the painted ones in the catch-up's one seed                 |
| The catch-up ends on not found after a warm paint         | `guardNotFound` + `warmOpenFallback`: forget, log, reload once cold; the second not found in the session shows          |
| The token request fails, hangs or answers a 5xx           | Unknown, never signed out: asked again with backoff, the warm paint left up, no guest load                              |
| The framework rewrites the tab title after the warm paint | `useBrowserTabTitle` watches the head and puts the item's title back                                                    |

## Security and trust

- The copy holds what the reader already saw, in their own browser profile, for at most 30 days. It is never sent
  anywhere.
- **Per reader:** read only for the same reader; every keep or forget prunes every other reader's copies. A sign-out
  in another app (which cannot reach this app's IndexedDB) leaves copies until this app's next load, whose first token
  answer finds the hint stale and empties the store. Signed in, part 3 reads only once that answer names the account,
  so no account's copy ever paints for another account or for a signed-out browser.
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

**Measured on production builds (part 4).** `e2e/perf/warm-open.perf.ts` (the `perf` project, `E2E_PERF=1`) opens one
server-stored document, a 200-element first tab of the reference board's mix plus two more tabs, against the
signed-in export (`.next/out-signed-in`) on the e2e stack. Cold (the last seen copy store deleted first) and warm
(the copy the previous open kept) alternate, 12 each, every one a fresh navigation in one browser context so the
app's files come from the HTTP cache in both. The network is emulated over CDP on every request, the api's
included: 100 ms round trip, 10 Mbps down, 5 Mbps up (`Network.setBlockedURLs` rather than route interception,
which turns the HTTP cache off). "Content" is the first frame with an element on screen; "editable" is the first
frame after the load's `done` step. Medians / p90 from navigation start:

| Way in                                | Cold: content and editable | Warm: content | Warm: editable   |
| ------------------------------------- | -------------------------- | ------------- | ---------------- |
| Signed in, the document's own address | 827 / 829 ms               | 360 / 369 ms  | 1,191 / 1,209 ms |
| A guest by an edit link's own address | 835 / 843 ms               | 369 / 376 ms  | 1,190 / 1,196 ms |

The warm paint shows the content about 470 ms (56%) sooner. The catch-up made it editable about 360 ms later than a
cold open: in warm opens the ordinary load's first request (the participant) started about 400 ms later, with the main
thread idle in between, behind two 290 ms timers and a 47 ms one: React's 300 ms throttle on revealing suspended
content. The warm paint's commit left the Quick Style panel and the element tours waiting on their code, and their
reveal restarted the throttle, so the sign-in bridge (itself revealed from a Suspense boundary) mounted, and auth
answered, about 400 ms late.

**After Work Tracker 960** (the paint waits for its code, the bridge mounts as its code lands; the same measure, which
now also reports when auth answered, the e2e bridge's read of the test's session, and how long after it the participant
request went out):

| Way in                                | Cold: content and editable | Warm: content | Warm: editable | Auth answers, cold / warm | Participant after auth |
| ------------------------------------- | -------------------------- | ------------- | -------------- | ------------------------- | ---------------------- |
| Signed in, the document's own address | 828 / 841 ms               | 382 / 389 ms  | 787 / 801 ms   | 285 / 284 ms              | 3 / 4 ms               |
| A guest by an edit link's own address | 843 / 853 ms               | 389 / 398 ms  | 798 / 803 ms   | 291 / 290 ms              | 3 / 5 ms               |

Warm editable is now about 40 ms ahead of cold (its catch-up keeps the painted tab rather than drawing the editor for
the first time). The paint waits a few milliseconds for its code (warm content 382 against 360 to 383 ms in the before
runs). The race is timing-dependent: on the same build, before runs gave a warm editable median of 1,208, 803 and 801
ms (p90 1,217, 1,204 and 809), as the paint's update landed before or after the bridge's throttled reveal; after,
every run lands at 784 to 798 ms with a p90 within 15 ms of the median.

**Field timing.** `WarmPaint` joins `EDITOR_TIMING_METRICS` (`@liveworkspace/api-schema` and livedesign's copy): the
paint calls `startEditorTiming('WarmPaint', { from: documentLoadOrigin() ?? performance.now() }).endAfterPaint()`,
from the same start as `DocumentLoad`, so the two read side by side in the Telemetry dashboard. The
`performance.measure` marks stay for local traces.

## Presentation and UX

- The warm paint is the editor as a Viewer sees it: the same canvas, tab bar and header, with the
  disabled edit controls a view link shows. No new surface, copy or state: nothing to design beyond the editor's own
  read-only look, which every share role already has.
- A tab other than the painted one shows the tab loader the editor already has for a tab still loading, never a
  blank canvas, and stays the active tab through the catch-up. The painted tab is fitted once, as it paints, and
  again at the catch-up only when its body was replaced by a newer one.
- The catch-up changes nothing on screen when the document did not move on but the role: the tools an Editor or a
  Participant has appear. A document that moved on shows its fresh first tab and tab list in place.
- Lost access shows the card the load ends on (not found, deleted, password), as a cold open does, after one cold
  reload confirms a not found.
- The tab is named after the item from the warm paint on, and stays so (`useBrowserTabTitle`): the static export's
  not-found route commits its metadata title after the paint and no longer leaves the bare brand.

## Accessibility

- Read-only controls keep the disabled states, labels and roles a view link has. The catch-up announces nothing new.

## Web Experience

- LCP: a warm open paints the canvas before auth, the participant and the tab fetch, instead of the opening screen.
- CLS: the catch-up replaces the tabs in place (same ids, same order unless the document moved on), so the canvas
  does not shift; the header's tools appearing with the role are the only change, as in any role change.
- INP: nothing runs on input; the paint and the catch-up are each one commit.

## Observability

- `debugLog('[last-seen] …')` on a failed write, a removed corrupt record and a copy too big to keep.
- `debugLog('[load] warm open from the last seen copy')` on a warm paint, `'[load] no early open'` when the early or
  warm open could not start.
- `console.warn('[load] warm-open-fallback not-found: …')` when a warm-painted open ends on not found and reloads cold;
  `console.warn('[auth] token answer unknown (<reason>), asking again')` on each unknown token answer.
- Timing marks (part 3): `performance.measure` entries `warm-paint` and `warm-catch-up`, from the same start as
  `DocumentLoad`, each taken after the next frame. `DocumentLoad` keeps timing the fresh copy; part 4 adds the
  `WarmPaint` timing (`Timing·Measured·WarmPaint.<bucket>`), the warm paint's first frame from the same start.

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
| A warm-painted not found reloads once, cold | `warm-open.test.ts` "warmOpenFallback", "guardNotFound"; each `useIdentityBootstrap.warm.test.tsx` "reloads once without the copy rather than show not found …" |
| An unknown token answer is asked again, never a guest | `token-answer.test.ts`; each `AccountsBridge.test.tsx` "keeps asking while the api cannot be reached …" |
| The tab title survives the route's metadata | `useBrowserTabTitle.test.tsx`; each editor's `tab-title.test.ts` |
| Someone else after all, sign-out cleared, too late | each `useIdentityBootstrap.warm.test.tsx` |
| A guest whose auth settles before the read answers | `warm-open.test.ts` "markLanding"; each `useIdentityBootstrap.warm.test.tsx` "paints when auth settles before the copy read answers …", "paints no late copy once the load resolved someone else …", "reads and paints once when the layout effect runs twice …" |
| A link's own address warm-opens by its code, forgets by it | `last-seen-copies.test.ts` "reads the newest copy a share code kept …", "forgets every copy a share code kept …"; `warm-open.test.ts` "reads a share link's own address …"; `editor-arrival.test.ts` "forgets a link's copies by its code …"; each `useIdentityBootstrap.warm.test.tsx` "paints a link's own address …", "forgets a revoked link's copies …" |
| Other tabs load, the chosen tab is kept | each `editor-page-helpers.test.ts` "loads a tab without a body while the warm open shows …"; each `seed-fetched-*.test.ts` "keeps the tab the person moved to …", "falls back to the first tab …"; each `useIdentityBootstrap.warm.test.tsx` "keeps the tab the person moved to …" |
| One fit, at the paint | `useTabEntryEffects.test.tsx` "fits the warm-painted tab before hydration …", "waits for the load for a tab without a body …" |
| A stale copy is fitted again on its fresh body | `useTabEntryEffects.test.tsx` "fits the warm-painted tab again when the catch-up replaced its body …"; driven in `e2e/perf/warm-open.perf.ts` "a copy whose content changed since it was kept refits once at catch-up" |
| The warm paint is timed as `WarmPaint`, a cold open never | each `useIdentityBootstrap.warm.test.tsx` "times the warm paint as WarmPaint …", "times no WarmPaint …" |
| Warm against cold on production builds | `e2e/perf/warm-open.perf.ts` (reports, never fails on a number) |

The shared modules (the store, the copies, the follower, the hook and the warm open) are held at 100% in `packages/workbench/vitest.config.ts`.

## Defaults ledger

See [DEFAULTS.md](DEFAULTS.md): the four limits and the refresh window above.
