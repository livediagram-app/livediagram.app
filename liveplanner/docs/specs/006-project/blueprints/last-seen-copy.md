# Last seen copy blueprint

Derived from [Offline Mode → Warm open of a cloud project](../offline-mode.md#warm-open-of-a-cloud-project)
(Work Tracker 927). The shared modules (the store, the copies, the follower, the hook and the warm open), their
behaviour, limits, security and tests are the same in every product and are set out once, in livediagram's
[Last seen copy blueprint](../../../../../livediagram/docs/specs/006-document/blueprints/last-seen-copy.md). This one
names liveplanner's bindings, and what a plan adds: the cards and the first tab's sheets, and which first tabs paint.

## Domain and naming

The shared terms: last seen copy (`LastSeenCopy`), reader, copy key (`lastSeenKey`), way in (`via`), access
(`LastSeenAccess`), first tab (`LastSeenFirstTab`), keep, forget, clear and prune, follow, refresh, warm open,
expected reader and catch-up. Never "cache" or "snapshot". liveplanner adds:

| Term                  | Identifier                                 | Meaning                                                                          |
| --------------------- | ------------------------------------------ | -------------------------------------------------------------------------------- |
| Plan copy             | `PlanCopyItem`                             | The copy's item: the plan as loaded (`Project`), plus `cards` and `sheets`       |
| Kept cards            | `PlanCopyItem.cards: ItemStoreState\|null` | The board's item store as it stood (`items`, `rev`, `nextKey`), or null past cap |
| Kept sheets           | `PlanCopyItem.sheets`                      | `{ tabId, sheets: SheetJson[] }`: the first tab's sheets as last read, or null   |
| Warm plan             | `WarmPlan`                                 | `{ cards, sheets }` taken from a copy at the paint, for the stores to show       |
| Follow item           | `followItem(reader, itemId, fields)`       | The follower folds fields of the item other than its name and tabs (shared)      |
| What the first tab is | `planCopyPaints(copy)`                     | Whether a copy's first tab can paint from what the copy holds                    |

## Interfaces and contracts

| File                                                                | Binding                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/editor/lib/last-seen.ts`                                      | `lastSeenCopies`, a follower (`createLastSeenFollower<PlanCopyItem>`) over the copies on `createLastSeenStore(LAST_SEEN_DB)` (`liveplanner-last-seen`)                                                                                                                                                                                          |
| `apps/editor/lib/last-seen-plan.ts`                                 | `PlanCopyItem`, `WarmPlan`, `PLAN_COPY_MAX_CARDS`, `PLAN_COPY_MAX_CELLS`, `cardsForCopy(store)`, `sheetsForCopy(tabId, sheets)`, `planCopyPaints(copy)`, `warmPlanOf(copy)`                                                                                                                                                                     |
| `apps/editor/app/project/[id]/bootstrap-arrivals.ts`                | `PLAN_ARRIVAL.lastSeen = lastSeenCopies`; `BootstrapSetters` adds `setWarmTabId` and `setWarmPlan`                                                                                                                                                                                                                                              |
| `apps/editor/app/project/[id]/seed-fetched-project.ts`              | The seed answers the first tab it painted, or null when the eager fetch failed; `makePaintLastSeen` shows a copy the same way; the seed keeps the painted tab at an unchanged revision (`warmFirstTab`) and the tab moved to (`keepActiveId`)                                                                                                   |
| `apps/editor/app/project/[id]/useIdentityBootstrap.ts`              | `tryEarlyOpen` reads the copy (`readWarmCopy`) before auth settles and paints it when `planCopyPaints`; `paintWarm` paints it as a Viewer with its warm plan; the catch-up replaces it or, for another reader, takes it off the screen; `guardNotFound` + `warmOpenFallback`; `warm-paint` and `warm-catch-up` marks and the `WarmPaint` timing |
| `apps/editor/app/project/[id]/editor-state/useEditorProject.ts`     | `warmTabId` and `warmPlan` state, null until a warm paint                                                                                                                                                                                                                                                                                       |
| `apps/editor/app/project/[id]/editor-state/useEditorPersistence.ts` | Calls `useLastSeenFollow` (following while hydrated, server stored, not an embed or a workbench) and hands its `onSaveLanded` to `useAutosave`                                                                                                                                                                                                  |
| `apps/editor/app/project/[id]/useAutosave.ts`                       | Passes `onSaveLanded` through to `useAutosaveCore`                                                                                                                                                                                                                                                                                              |
| `apps/editor/app/project/[id]/usePlanCopyFollow.ts`                 | Follows the cards (`followItem(…, { cards: cardsForCopy(store) })`) while following and no practice cards are on the board; answers `onSheetsRead(tabId, sheets)`, which follows the first tab's sheets                                                                                                                                         |
| `apps/editor/hooks/plan/usePlanItems.ts`                            | `warm`: before the plan is known (no scope), the store shows the warm plan's cards with status `ready`; the first load after it takes the server's store whole                                                                                                                                                                                  |
| `apps/editor/hooks/sheets/useSheetsBridge.ts`                       | `warm` (the warm plan's sheets, only while no plan is known) and `onTabRead` on the bridge                                                                                                                                                                                                                                                      |
| `apps/editor/components/sheets/sheet-store-base.ts`                 | No fetch while the scope names no plan (the tab stays `loading`); `seedWarm({ tabId, sheets })` adopts the kept sheets and marks the tab `ready`; each tab read tells `deps.onTabRead`                                                                                                                                                          |
| `apps/editor/components/sheets/sheet-store-client.ts`               | `sheetStoreOf` seeds a store with no plan from `bridge.warm`, gives it no queue, and passes `onTabRead`                                                                                                                                                                                                                                         |
| `apps/editor/app/project/[id]/editor-page-helpers.ts`               | `deriveTabLoadState` takes `warmWithoutBody`: before hydration, a tab other than the warm-painted one shows the tab loader                                                                                                                                                                                                                      |
| `apps/editor/app/project/[id]/useTabEntryEffects.ts`                | Binds the shared `createTabEntryEffects` with the card entry's history state (`cardEntryState`), so the warm-painted tab is fitted once, as it paints                                                                                                                                                                                           |
| `apps/editor/components/providers/AccountsBridge.tsx`               | `endSession` awaits `lastSeenCopies.forgetAll()` beside `forgetRecentDiagrams()`                                                                                                                                                                                                                                                                |
| `../packages/workbench/src/lib/api/last-seen-follower.ts`           | `followItem(reader, itemId, fields)`: shallow-merges `fields` into the followed copy's item when any value differs by identity, then schedules a refresh (shared, every product may use it)                                                                                                                                                     |
| `../packages/workbench/src/hooks/editor/useTabEntryEffects.ts`      | `createTabEntryEffects(isEditorPath, historyState?)`: the history state the `#t=` pin writes, `{}` when left out                                                                                                                                                                                                                                |

## Behaviour and state

- **Keep.** The shared arrival keeps the copy on reaching a server plan (`openShareLink`, not a Community post or an
  embed; `openOwnAddress`, not This Browser), with the first tab the seed answers. The arrival's item is the plan as
  loaded, without `cards` or `sheets`: the follower adds them as they load.
- **Follow.** The shared hook follows the name, the tab list and the first tab's landed saves. `usePlanCopyFollow`
  adds:
  - **Cards.** An effect on the item store (`planItems.store`, by identity) while `following` (hydrated, server
    stored, not an embed or a workbench), the store is `ready` and is not the warm store itself (only what a load
    read is followed back), and no practice cards are on the board, calls
    `followItem(reader, projectId, { cards: cardsForCopy(store) })`. `cardsForCopy` answers the store itself (no
    copy is made; the JSON is built only when the refresh writes) when it holds at most `PLAN_COPY_MAX_CARDS` cards,
    else null. The follower writes at most once per `LAST_SEEN_REFRESH_MS`, so a burst of card writes is one write.
  - **Sheets.** The sheet store tells `onTabRead(tabId, sheets)` after each tab read (the open's, a reconnect's
    resync, a refetch). When `tabId` is the first tab to load (`firstTabToLoad(tabs, sessionTabScope)`) and
    following, `followItem(reader, projectId, { sheets: sheetsForCopy(tabId, sheets) })`; `sheetsForCopy` answers
    null when the sheets hold more than `PLAN_COPY_MAX_CELLS` cells together.
- **Which first tab paints.** `planCopyPaints(copy)` reads the first tab's kind (`tabKindOf(copy.firstTab.tab)`) and
  its elements: `form` never; a tab that draws the cards (`board`, `dashboard`, or any element with `planBoard`,
  `planCard` or `planView`) only when `copy.item.cards` is kept; a tab that draws a sheet (`sheet`, or any element with
  `planSheet` or `chartSource`) only when `copy.item.sheets?.tabId === copy.firstTab.id`; otherwise always. A
  Dashboard with a chart from a sheet's cells therefore waits for the load. `tryEarlyOpen` paints only a copy `readWarmCopy` answered and
  `planCopyPaints` allows.
- **The paint.** `paintWarm(copy)`: `makePaintLastSeen(seedDeps(set, resetTabs, false))(copy)`, then
  `setWarmPlan(warmPlanOf(copy))`, `setWarmTabId(firstTab.id)`, `setIsOwner(access.isOwner)`,
  `setSessionTabScope(access.tabScope)`, `setSessionRole('view')` and `setLoadingProject(false)`; `projectId` stays
  null and `hydrated` false.
  - **Cards.** `usePlanItems` with no project id and a `warm` store sets its store to it and its status to `ready`
    while rendering (React's adjust-state-in-render, so the cards are in the paint's own frame), so the Board and the
    Dashboard draw it. When the warm plan leaves before a project id (someone else's copy) the store goes back to
    empty and `loading`. With no scope nothing is fetched, written, queued or
    sent. The Viewer role closes card moves, edits and the shared filter (board-widgets.md "Share roles"); the
    Automations gate needs `hydrated` and an Editor's level.
  - **Sheets.** The sheets bridge carries `warm`. `sheetStoreOf` seeds each store it makes from `bridge.warm`
    (`seedWarm`: each sheet of the kept tab the store lacks is adopted as confirmed and noted in `warmIds`; the tab's
    status is left alone), so the Sheet draws it (a Sheet draws any sheet the store holds, whatever the tab's
    status). The store for no plan is keyed `''`, has no queue, and its `fetchTab` fetches nothing and leaves the tab
    `loading`. Rights follow the bridge: a Viewer writes no cell.
- **Catch-up.** The ordinary bootstrap, unchanged. The seed keeps the painted first tab when the fresh one has the
  copy's id and revision (`keptWarmTab`), and the tab the person moved to (`keepActiveId`). Once `projectId` is set,
  `usePlanItems` has a scope and loads; the first load after a warm store sets the server's store whole (the kept
  cards are never merged into it, so an optimistic card the copy kept cannot outrank the server's), with the waiting
  changes laid over it as always. The sheets bridge names the plan, so `sheetStoreOf` makes the plan's own store, seeded
  from the kept sheets too so the Sheet does not blink to its loading face, and its first load of the tab adopts
  the server's sheets over them and drops any kept sheet the answer no longer holds (`warmIds`).
- **Someone else after all.** A participant other than the copy's reader clears `warmRef`, `warmTabId` and
  `warmPlan` and sets `loadingProject` true.
- **Lost access and the safety net** are the shared blueprint's: the arrival forgets the copy (and a link's by its
  code), a not found after a warm paint is checked once by a cold reload (`guardNotFound` on `setProjectNotFound`,
  `warmOpenFallback`).

## Data and persistence

IndexedDB `liveplanner-last-seen`, version 1, stores `copies` and `seen`; at most 20 copies of at most 1,000,000
characters each, none read past 30 days. The copy's item adds `cards` (an `ItemStoreState`, exactly what the
reader's store held) and `sheets` (`{ tabId, sheets: SheetJson[] }`, exactly what the reader's read answered), each
absent until followed and null past its cap.

## Errors and edge cases

| Case                                                       | Handling                                                                                   |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| A Board or Dashboard first tab with no cards kept          | No warm open (past the cap, or a reload before the cards first loaded and were written)    |
| A Sheet first tab whose sheets were not kept, or another's | No warm open                                                                               |
| A Form first tab                                           | No warm open                                                                               |
| More than `PLAN_COPY_MAX_CARDS` cards                      | `cards: null`: the copy keeps the meta and first tab only, small enough to write           |
| Sheets over `PLAN_COPY_MAX_CELLS` cells                    | `sheets: null`                                                                             |
| The whole copy over `LAST_SEEN_MAX_CHARS`                  | The shared store keeps none and removes the older one                                      |
| Practice cards on the board (the Plan tour)                | Cards not followed until they go; the kept cards stay as they were                         |
| A card the copy kept that the server refused               | The catch-up's first load takes the server's store whole                                   |
| A Dashboard tile reading a sheet during the warm paint     | Its loading state until the catch-up (nothing is fetched without the plan)                 |
| A tab-scoped link                                          | The kept cards and sheets are what that scope read; the copy is read only by the same code |

## Security and trust

The shared blueprint's rules hold: per reader, cleared on sign-out, forgotten on lost access, never sent anywhere,
painted as a Viewer whatever role it was kept with. The cards and sheets are what the reader's own reads answered,
under their scope; nothing is derived or widened. With no plan known the stores send nothing.

## Performance and limits

| Constant              | Value  | Why                                                                                                 |
| --------------------- | ------ | --------------------------------------------------------------------------------------------------- |
| `PLAN_COPY_MAX_CARDS` | 1,000  | A typical card's JSON is about 670 characters, so 1,000 cards are about 670 KB, under the store cap |
| `PLAN_COPY_MAX_CELLS` | 10,000 | A cell's JSON is about 40 to 60 characters, so 10,000 cells are about 500 KB                        |

The follows run on effects (the store's identity, a tab read), never on a keystroke, and write nothing themselves:
the follower's refresh writes the newest copy at most once per `LAST_SEEN_REFRESH_MS`. `cardsForCopy` is a length
check (O(1)) and hands the store over by reference; `sheetsForCopy` counts cells (O(sheets)). The measurements are
in the spec's section and below.

## Observability

The shared marks and logs: `debugLog('[load] warm open from the last seen copy')`, `'[load] no early open'`,
`'[last-seen] copy too big to keep'`, `console.warn('[load] warm-open-fallback not-found: …')`, the `warm-paint` and
`warm-catch-up` measures and the `WarmPaint` timing. liveplanner adds `debugLog('[last-seen] plan copy skipped',
{ first: kind })` when a copy is read but its first tab cannot paint from it.

## Testing

| Rule                                                 | Test                                                                                          |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Caps and which first tabs paint                      | `lib/last-seen-plan.test.ts`                                                                  |
| Follow item folds fields and schedules once          | `last-seen-follower.test.ts` "follows the item's other fields …"                              |
| Paint, catch-up, roles, someone else, lost access    | `useIdentityBootstrap.warm.test.tsx`                                                          |
| A revoked share link forgets the copy                | `useIdentityBootstrap.warm.test.tsx` "forgets a revoked link's copies …"                      |
| Board / Sheet / Dashboard paint, Form waits          | `useIdentityBootstrap.warm.test.tsx` "paints a … first tab …", "waits for the load on a Form" |
| Seed answers, paints, keeps the painted tab          | `seed-fetched-project.test.ts`                                                                |
| Cards shown before the plan is known, replaced whole | `usePlanItems.warm.test.tsx`                                                                  |
| Cards and sheets follow, practice cards and caps     | `usePlanCopyFollow.test.tsx`                                                                  |
| No sheet fetch without a plan, seeded tab, tab reads | `sheet-store-client.test.ts` "warm …"                                                         |
| Other tabs load while the warm paint shows           | `editor-page-helpers.test.ts` "loads a tab without a body while the warm open shows …"        |
| Sign-out clears                                      | `AccountsBridge.test.tsx`                                                                     |
| History state on the `#t=` pin                       | the shared `useTabEntryEffects.test.tsx`; `useTabEntryEffects.test.tsx` here                  |

## Defaults ledger

See [DEFAULTS.md](DEFAULTS.md), the last-seen-copy rows.
