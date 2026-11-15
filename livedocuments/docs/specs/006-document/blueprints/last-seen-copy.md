# Last seen copy blueprint

Derived from [Offline Mode → Warm open of a cloud document](../offline-mode.md#warm-open-of-a-cloud-document)
(Work Tracker 890). The shared modules, their behaviour, limits, security, measurements and tests are the same in
every product and are set out once, in livediagram's
[Last seen copy blueprint](../../../../../livediagram/docs/specs/006-document/blueprints/last-seen-copy.md), whose build
plan this product follows. This one names livedocuments' bindings only.

## Domain and naming

The same terms: last seen copy (`LastSeenCopy`), reader, copy key (`lastSeenKey`), way in (`via`), access
(`LastSeenAccess`), first tab (`LastSeenFirstTab`), keep, forget, clear and prune. Never "cache" or "snapshot".

## Interfaces and contracts

| File                                                     | Binding                                                                               |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `apps/editor/lib/last-seen.ts`                           | `lastSeenCopies` over `createLastSeenStore(LAST_SEEN_DB)` (`livedocuments-last-seen`) |
| `apps/editor/app/document/[id]/document-arrival.ts`      | `DOCUMENT_ARRIVAL.lastSeen = lastSeenCopies`                                          |
| `apps/editor/app/document/[id]/seed-fetched-document.ts` | The seed answers the first tab it painted, or null when the eager fetch failed        |
| `apps/editor/components/providers/AccountsBridge.tsx`    | `endSession` awaits `lastSeenCopies.forgetAll()` beside `forgetRecentDiagrams()`      |

## Data and persistence

IndexedDB `livedocuments-last-seen`, version 1, stores `copies` and `seen`; at most 20 copies of at most 1,000,000
characters each, none read past 30 days.

## Defaults ledger

See [DEFAULTS.md](DEFAULTS.md), the last-seen-copy rows.
