# Last seen copy blueprint

Derived from [Offline Mode → Warm open of a cloud design](../offline-mode.md#warm-open-of-a-cloud-design)
(Work Tracker 890). The shared modules (`@liveworkspace/workbench/lib/api/last-seen-copies` and `last-seen-store`),
their behaviour, limits, security, measurements and tests are the same in every product and are set out once, in
livediagram's last seen copy blueprint (its specs' blueprints folder, `last-seen-copy.md`), whose build plan this
product follows. This one names livedesign's bindings only.

## Domain and naming

The same terms: last seen copy (`LastSeenCopy`), reader, copy key (`lastSeenKey`), way in (`via`), access
(`LastSeenAccess`), first tab (`LastSeenFirstTab`), keep, forget, clear and prune. Never "cache" or "snapshot".

## Interfaces and contracts

| File                                                | Binding                                                                            |
| --------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `apps/live/lib/last-seen.ts`                        | `lastSeenCopies` over `createLastSeenStore(LAST_SEEN_DB)` (`livedesign-last-seen`) |
| `apps/live/app/design/[id]/design-arrival.ts`       | `DESIGN_ARRIVAL.lastSeen = lastSeenCopies`                                         |
| `apps/live/app/design/[id]/seed-fetched-design.ts`  | The seed answers the first tab it painted, or null when the eager fetch failed     |
| `apps/live/components/providers/AccountsBridge.tsx` | `endSession` awaits `lastSeenCopies.forgetAll()` beside `forgetRecentDesigns()`    |

## Data and persistence

IndexedDB `livedesign-last-seen`, version 1, stores `copies` and `seen`; at most 20 copies of at most 1,000,000
characters each, none read past 30 days.

## Defaults ledger

See [DEFAULTS.md](DEFAULTS.md), the last-seen-copy rows.
