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

| Term           | Identifier                       | Meaning                                                                                    |
| -------------- | -------------------------------- | ------------------------------------------------------------------------------------------ |
| Last seen copy | `LastSeenCopy<Item, Tab>`        | What one load answered for one reader and document, kept in this browser                   |
| Reader         | `reader` (a participant id)      | The account id (`user_…`) or the guest's id (`guest_…`) the load ran as                    |
| Copy key       | `lastSeenKey(reader, itemId)`    | `${reader}\n${itemId}`: one copy per reader and document                                   |
| Way in         | `via`                            | The share code the address carried (`?s=`), or null for the document's own address         |
| Access         | `LastSeenAccess`                 | `{ role, isOwner, sessionShareCode, tabScope }` as the arrival set them                    |
| First tab      | `LastSeenFirstTab<Tab>`          | `{ id, rev, tab }`: the tab the load painted first, with the revision it was read at       |
| Keep           | `remember(copy)`                 | Write the copy, then prune                                                                 |
| Forget         | `forget(reader, itemId)`         | Remove one copy (lost access), then prune                                                  |
| Clear          | `forgetAll()`                    | Empty the store (sign-out, account deletion)                                               |
| Prune          | (inside `remember` and `forget`) | Drop other readers' copies, copies past the age limit, and the oldest past the count limit |
| Warm open      | (part 3)                         | The early paint of a copy before auth settles                                              |

"Last seen copy" is the only name: never "cache", "snapshot" or "local copy" (This Browser documents are local).

## Modules

| File                                                     | Responsibility                                                                                                                                       |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `../packages/workbench/src/lib/api/last-seen-copies.ts`  | `createLastSeenCopies(store)`: `remember`, `read`, `forget`, `forgetAll`; the limits; `lastSeenKey`; the read-side validation                        |
| `../packages/workbench/src/lib/api/last-seen-store.ts`   | `createLastSeenStore(dbName)`: the IndexedDB store, two object stores (`copies`, `seen`), one kept connection, every call bounded and never throwing |
| `../packages/workbench/src/lib/editor-arrival.ts`        | `openShareLink` and `openOwnAddress` keep the copy on reaching the document and forget it on not found, the deleted card or the password gate        |
| `apps/editor/lib/last-seen.ts`                           | livediagram's binding: `lastSeenCopies` over `createLastSeenStore(LAST_SEEN_DB)` (`livediagram-last-seen`)                                           |
| `apps/editor/app/document/[id]/document-arrival.ts`      | `DOCUMENT_ARRIVAL.lastSeen = lastSeenCopies`                                                                                                         |
| `apps/editor/app/document/[id]/seed-fetched-document.ts` | The seed answers the first tab it painted (`LastSeenFirstTab`), or null when the eager fetch failed                                                  |
| `apps/editor/components/providers/AccountsBridge.tsx`    | `endSession` (sign-out, account deletion) awaits `lastSeenCopies.forgetAll()` beside `forgetRecentDiagrams()`                                        |

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
- **Clear.** `forgetAll` empties both object stores in one transaction. Sign-out awaits it (bounded by the store's
  timeout) before the hop, so no copy outlives the session in this browser.

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

## Security and trust

- The copy holds what the reader already saw, in their own browser profile, for at most 30 days. It is never sent
  anywhere.
- **Per reader:** read only for the same reader; every keep or forget prunes every other reader's copies. A sign-out
  in another app (which cannot reach this app's IndexedDB) leaves copies until this app's next load, which prunes them
  under the guest, and part 3 reads only for the reader the signed-in hint names, so a signed-out browser never shows
  them.
- **Lost access:** a revoked link, a removed team member, a trashed document or a new share password forgets the copy
  on the next load; the warm open (part 3) is read-only until that load answers, so lost access never yields an edit.
- A stored role is never trusted for writes: the warm open holds every edit until the participant resolves, and an
  unknown role reads as Viewer.

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

## Observability

- `debugLog('[last-seen] …')` on a failed write, a removed corrupt record and a copy too big to keep.
- No telemetry in part 1: nothing visible changed. Part 3 adds the warm paint's timing beside `DocumentLoad`.

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

Both shared modules are held at 100% in `packages/workbench/vitest.config.ts`.

## Defaults ledger

See [DEFAULTS.md](DEFAULTS.md): the four limits above.
