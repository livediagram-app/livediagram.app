# Last seen copy blueprint

Derived from [Offline Mode → Warm open of a cloud design](../offline-mode.md#warm-open-of-a-cloud-design)
(Work Tracker 890). The shared modules (`@liveworkspace/workbench/lib/api/last-seen-copies` and `last-seen-store`),
their behaviour, limits, security, measurements and tests are the same in every product and are set out once, in
livediagram's last seen copy blueprint (its specs' blueprints folder, `last-seen-copy.md`), whose build plan this
product follows. This one names livedesign's bindings only.

## Domain and naming

The same terms: last seen copy (`LastSeenCopy`), reader, copy key (`lastSeenKey`), way in (`via`), access
(`LastSeenAccess`), first tab (`LastSeenFirstTab`), keep, forget, clear and prune, warm open, expected reader and catch-up. Never "cache" or "snapshot".

## Interfaces and contracts

| File                                                             | Binding                                                                                                                                                                                                                                                                                                                           |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/live/lib/last-seen.ts`                                     | `lastSeenCopies`, a follower (`createLastSeenFollower`) over the copies on `createLastSeenStore(LAST_SEEN_DB)` (`livedesign-last-seen`)                                                                                                                                                                                           |
| `apps/live/app/design/[id]/design-arrival.ts`                    | `DESIGN_ARRIVAL.lastSeen = lastSeenCopies`                                                                                                                                                                                                                                                                                        |
| `apps/live/app/design/[id]/seed-fetched-design.ts`               | The seed answers the first tab it painted, or null when the eager fetch failed; `makePaintLastSeen` shows a copy the same way; the seed keeps the painted tab at an unchanged revision (`warmFirstTab`)                                                                                                                           |
| `apps/live/app/design/[id]/useIdentityBootstrap.ts`              | Binds the editors' one copy, `@liveworkspace/workbench/hooks/persistence/useIdentityBootstrapCore`, whose `tryEarlyOpen` reads the copy (`readWarmCopy`) before auth settles, `paintWarm` paints it as a Viewer, the catch-up replaces it or, for another reader, takes it off the screen; `warm-paint` and `warm-catch-up` marks |
| `apps/live/components/providers/AccountsBridge.tsx`              | `endSession` awaits `lastSeenCopies.forgetAll()` beside `forgetRecentDesigns()`                                                                                                                                                                                                                                                   |
| `apps/live/app/design/[id]/editor-state/useEditorPersistence.ts` | Calls `useLastSeenFollow` (following while hydrated, server stored, not an embed or a workbench) and hands its `onSaveLanded` to `useAutosave`                                                                                                                                                                                    |
| `apps/live/app/design/[id]/useAutosave.ts`                       | Passes `onSaveLanded` through to `useAutosaveCore`                                                                                                                                                                                                                                                                                |

## Behaviour and state

The copy follows the open design (part 2) exactly as the shared blueprint's "Follow" sets out: the name and tab list on each change, the first tab on each landed save of it, at most one write per `LAST_SEEN_REFRESH_MS`, flushed on hide, for the kept reader only.

The warm open (part 3) is the shared blueprint's "Warm open": the copy for the expected reader (the guest token's id, read before auth settles, or, when the signed-in hint is set, the account the session's first token answer names, read once it has), by the same way in, with the first tab this open shows first, painted read-only under `'self'` with no `designId` and no `hydrated`, then replaced in place by the ordinary load, whose role applies. `DesignLoad` keeps timing the fresh copy. A link's own address (`/design/shared?s=<code>`) finds its copy by the code (`readVia`) and is left as it is; lost access on a link forgets by the code too (`forgetVia`). A tab other than the painted one (`warmTabId`) shows the tab loader until the catch-up, which keeps the tab the person moved to (`keepActiveId`), and the painted tab is fitted once, as it paints (`useTabEntryEffects`'s `warmTabId`), and again at the catch-up only when that replaced its body (`elements` no longer the painted array).

## Data and persistence

IndexedDB `livedesign-last-seen`, version 1, stores `copies` and `seen`; at most 20 copies of at most 1,000,000
characters each, none read past 30 days.

## Defaults ledger

See [DEFAULTS.md](DEFAULTS.md), the last-seen-copy rows.
