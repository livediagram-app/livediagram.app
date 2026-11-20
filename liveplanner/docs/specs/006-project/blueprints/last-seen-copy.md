# Last seen copy blueprint

Derived from [Offline Mode → Warm open of a cloud project](../offline-mode.md#warm-open-of-a-cloud-project)
(Work Tracker 927). The shared modules (the store, the copies, the follower, the hook and the warm open), their
behaviour, limits, security and tests are the same in every product and are set out once, in livediagram's
[Last seen copy blueprint](../../../../../livediagram/docs/specs/006-document/blueprints/last-seen-copy.md). This one
names liveplanner's bindings, and what a plan adds: the cards, the first tab's sheets, the tabs a Dashboard first
tab shows, and which first tabs paint.

## Domain and naming

The shared terms: last seen copy (`LastSeenCopy`), reader, copy key (`lastSeenKey`), way in (`via`), access
(`LastSeenAccess`), first tab (`LastSeenFirstTab`), keep, forget, clear and prune, follow, refresh, warm open,
expected reader and catch-up. Never "cache" or "snapshot". liveplanner adds:

| Term                  | Identifier                                 | Meaning                                                                          |
| --------------------- | ------------------------------------------ | -------------------------------------------------------------------------------- |
| Plan copy             | `PlanCopyItem`                             | The copy's item: the plan as loaded (`Project`), plus `cards`, `sheets`, `refs`  |
| Kept cards            | `PlanCopyItem.cards: ItemStoreState\|null` | The board's item store as it stood (`items`, `rev`, `nextKey`), or null past cap |
| Kept sheets           | `PlanCopyItem.sheets`                      | `{ tabId, sheets: SheetJson[] }`: the first tab's sheets as last read, or null   |
| Kept shown tabs       | `PlanCopyItem.refs: KeptRefs\|null`        | `{ tabs: Tab[], sheets: KeptSheets[] }`: a Dashboard's shown tabs, or null       |
| Shown tabs            | `dashboardShownTabs(tab)`                  | The ids of the tabs a Dashboard's tab tiles draw, in slot order                  |
| Stand-in              | `standIns` (DashboardPage, its context)    | A kept body a tab tile draws, not worked on, until its tab's own load answers    |
| Warm plan             | `WarmPlan`                                 | `{ cards, sheets, refTabs, role }` from a copy at the paint                      |
| Warm rights           | `WarmRights`, `warmRightsOf(role)`         | The strips the kept role shows, kept as room on the board during the paint       |
| Warm paint code       | `WARM_PAINT_CODE`                          | The lazy panels the paint mounts, preloaded before it paints                     |
| Follow item           | `followItem(reader, itemId, fields)`       | The follower folds fields of the item other than its name and tabs (shared)      |
| What the first tab is | `planCopyPaints(copy)`                     | Whether a copy's first tab can paint from what the copy holds                    |

## Interfaces and contracts

| File                                                                | Binding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/editor/lib/last-seen.ts`                                      | `lastSeenCopies`, a follower (`createLastSeenFollower<PlanCopyItem>`) over the copies on `createLastSeenStore(LAST_SEEN_DB)` (`liveplanner-last-seen`)                                                                                                                                                                                                                                                                                                                                                                                                 |
| `apps/editor/lib/last-seen-plan.ts`                                 | `PlanCopyItem`, `WarmPlan`, `PLAN_COPY_MAX_CARDS`, `PLAN_COPY_MAX_CELLS`, `KeptRefs`, `cardsForCopy(store)`, `sheetsForCopy(tabId, sheets)`, `dashboardShownTabs(tab)`, `refsForCopy(tabs, sheets)`, `planCopyPaints(copy)`, `warmPlanOf(copy)`                                                                                                                                                                                                                                                                                                        |
| `apps/editor/app/project/[id]/bootstrap-arrivals.ts`                | `PLAN_ARRIVAL.lastSeen = lastSeenCopies`; `BootstrapSetters` adds `setWarmTabId` and `setWarmPlan`                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `apps/editor/app/project/[id]/seed-fetched-project.ts`              | The seed answers the first tab it painted, or null when the eager fetch failed; `makePaintLastSeen` shows a copy the same way; the seed keeps the painted tab at an unchanged revision (`warmFirstTab`) and the tab moved to (`keepActiveId`)                                                                                                                                                                                                                                                                                                          |
| `apps/editor/lib/editor-deferred-code.ts`                           | `PlanBoardView`, `PlanSheetsHost` and `PlanTourHost` as lazy panels (`@liveworkspace/ui/lazy-panel`; the board with its loading cover as `fallback`, the board and the host `onFail: 'throw'`); `WARM_PAINT_CODE` = their preloads                                                                                                                                                                                                                                                                                                                     |
| `apps/editor/app/project/[id]/editor-state/useEditorPlan.ts`        | `warmRights` = `warmRightsOf(warmPlan.role)` while not hydrated, handed to `usePlanSlice` and the plan context (`PlanContextValue.warmRights`)                                                                                                                                                                                                                                                                                                                                                                                                         |
| `apps/editor/components/plan/PlanBoardViewHeader.tsx`               | During the paint, an Editor's or Participant's card type chips are drawn `inert`, `aria-hidden`                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `apps/editor/app/project/[id]/useIdentityBootstrap.ts`              | Binds the editors' one copy, `@liveworkspace/workbench/hooks/persistence/useIdentityBootstrapCore`, whose `tryEarlyOpen` reads the copy (`readWarmCopy`) before auth settles and, when `planCopyPaints` (the binding's `paintsCopy`), awaits `warmPaintCodeIn(WARM_PAINT_CODE)` and paints it; `paintWarm` paints it as a Viewer with its warm plan (`onWarmPaint`); the catch-up replaces it or, for another reader, takes it off the screen; `guardNotFound` + `warmOpenFallback`; `warm-paint` and `warm-catch-up` marks and the `WarmPaint` timing |
| `apps/editor/app/project/[id]/editor-state/useEditorProject.ts`     | `warmTabId` and `warmPlan` state, null until a warm paint                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `apps/editor/app/project/[id]/editor-state/useEditorPersistence.ts` | Calls `useLastSeenFollow` (following while hydrated, server stored, not an embed or a workbench) and hands its `onSaveLanded` to `useAutosave`                                                                                                                                                                                                                                                                                                                                                                                                         |
| `apps/editor/app/project/[id]/useAutosave.ts`                       | Passes `onSaveLanded` through to `useAutosaveCore`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `apps/editor/app/project/[id]/usePlanCopyFollow.ts`                 | Follows the cards (`followItem(…, { cards: cardsForCopy(store) })`) while following and no practice cards are on the board; answers `onSheetsRead(tabId, sheets)`, which follows the first tab's sheets                                                                                                                                                                                                                                                                                                                                                |
| `apps/editor/hooks/plan/usePlanItems.ts`                            | `warm`: before the plan is known (no scope), the store shows the warm plan's cards with status `ready`; the first load after it takes the server's store whole                                                                                                                                                                                                                                                                                                                                                                                         |
| `apps/editor/hooks/sheets/useSheetsBridge.ts`                       | `warm` (the warm plan's sheets, only while no plan is known) and `onTabRead` on the bridge                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `apps/editor/components/sheets/sheet-store-base.ts`                 | No fetch while the scope names no plan (the tab stays `loading`); `seedWarm({ tabId, sheets })` adopts the kept sheets and marks the tab `ready`; each tab read tells `deps.onTabRead`                                                                                                                                                                                                                                                                                                                                                                 |
| `apps/editor/components/sheets/sheet-store-client.ts`               | `sheetStoreOf` seeds a store with no plan from `bridge.warm`, gives it no queue, and passes `onTabRead`                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `apps/editor/app/project/[id]/editor-state/editor-view.ts`          | The editor context adds `warmTabId` and `warmRefTabs` (the warm plan's `refTabs`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `apps/editor/components/start/EditorStartPanels.tsx`                | Draws a Dashboard tab's page while hydrated or while it is the warm-painted tab, handing it `standIns` from `warmRefTabs`                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `apps/editor/components/plan/dashboard/DashboardTabPreview.tsx`     | A tile whose tab is still a placeholder and whose load has not failed draws its stand-in, `inert`, until the tab loads                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `apps/editor/app/project/[id]/editor-page-helpers.ts`               | `deriveTabLoadState` takes `warmWithoutBody`: before hydration, a tab other than the warm-painted one shows the tab loader                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `apps/editor/app/project/[id]/useTabEntryEffects.ts`                | Binds the shared `createTabEntryEffects` with the card entry's history state (`cardEntryState`), so the warm-painted tab is fitted once, as it paints                                                                                                                                                                                                                                                                                                                                                                                                  |
| `apps/editor/components/providers/AccountsBridge.tsx`               | `forgetAccount()` (`lastSeenCopies.forgetAll()` beside `forgetRecentDiagrams()`), awaited by `endSession` and by a hinted first answer of signed out                                                                                                                                                                                                                                                                                                                                                                                                   |
| `../packages/workbench/src/lib/api/last-seen-follower.ts`           | `followItem(reader, itemId, fields)`: shallow-merges `fields` into the followed copy's item when any value differs by identity, then schedules a refresh (shared, every product may use it)                                                                                                                                                                                                                                                                                                                                                            |
| `../packages/workbench/src/hooks/editor/useTabEntryEffects.ts`      | `createTabEntryEffects(isEditorPath, historyState?)`: the history state the `#t=` pin writes, `{}` when left out                                                                                                                                                                                                                                                                                                                                                                                                                                       |

## Behaviour and state

- **Keep.** The shared arrival keeps the copy on reaching a server plan (`openShareLink`, not a Community post or an
  embed; `openOwnAddress`, not Offline), with the first tab the seed answers. The arrival's item is the plan as
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
  - **A Dashboard's shown tabs.** When the first tab is a Dashboard, `dashboardShownTabs(firstTab)` names the tabs
    its tab tiles draw; those no longer in `tabs` (deleted) are left out. `onSheetsRead` notes each shown Sheet
    tab's read (`sheetsForCopy`). An effect, once every shown tab is in `loadedTabIds` and every shown Sheet tab
    has been read, calls `followItem(reader, projectId, { refs: refsForCopy(tabs, sheets) })` (null when a noted
    read was past its cap or the cells together pass `PLAN_COPY_MAX_CELLS`). It follows again only when one of
    those tab objects or reads changes identity, never on another tab's edit. A Dashboard with no tab tiles keeps
    no `refs`.
- **Which first tab paints.** `planCopyPaints(copy)` reads the first tab's kind (`tabKindOf(copy.firstTab.tab)`) and
  its elements: `form` never; a tab that draws the cards (`board`, `dashboard`, or any element with `planBoard`,
  `planCard` or `planView`) only when `copy.item.cards` is kept; a tab that draws a sheet (`sheet`, or any element with
  `planSheet` or `chartSource`) only when `copy.item.sheets?.tabId === copy.firstTab.id`; otherwise always. A
  Dashboard with a chart from a sheet's cells therefore waits for the load. A Dashboard also waits when a slot is a
  Sheet Metric or a Form Metric, or when a shown tab is still in the copy's tab list but not in `refs.tabs`, is a
  Form, or is a Sheet whose sheets are not in `refs.sheets` (`refs` null waits whenever it shows a tab). A shown
  tab missing from the tab list paints as its tile's "deleted". `tryEarlyOpen` paints only a copy `readWarmCopy`
  answered and `planCopyPaints` allows.
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
    `loading`. Rights follow the bridge: a Viewer writes no cell. `warm` is every kept sheets list, the first tab's
    and each shown Sheet tab's, each seeded as its own tab.
  - **A Dashboard's tiles.** `EditorStartPanels` draws the Dashboard page for the warm-painted tab before
    `hydrated` (its `loadTabs` asks nothing before then). The shown tabs stay placeholders in `tabs`: each tile
    finds its tab a placeholder and draws the stand-in from `warmPlan.refTabs` (`standIns`) inside an `inert` box,
    the board from the kept cards and the Sheet from the kept sheets, so the paint never puts a kept body where
    the autosave could read it.
- **Catch-up.** The ordinary bootstrap, unchanged. The seed keeps the painted first tab when the fresh one has the
  copy's id and revision (`keptWarmTab`), and the tab the person moved to (`keepActiveId`). Once `projectId` is set,
  `usePlanItems` has a scope and loads; the first load after a warm store sets the server's store whole (the kept
  cards are never merged into it, so an optimistic card the copy kept cannot outrank the server's), with the waiting
  changes laid over it as always. The sheets bridge names the plan, so `sheetStoreOf` makes the plan's own store, seeded
  from the kept sheets too so the Sheet does not blink to its loading face, and its first load of the tab adopts
  the server's sheets over them and drops any kept sheet the answer no longer holds (`warmIds`). The Dashboard page
  stays up (same key) and fetches its shown tabs; each tile keeps its stand-in while its tab is `loading` and draws
  the tab once it loads, or its Retry if the load fails.
- **Someone else after all.** A participant other than the copy's reader clears `warmRef`, `warmTabId` and
  `warmPlan` and sets `loadingProject` true.
- **Lost access and the safety net** are the shared blueprint's: the arrival forgets the copy (and a link's by its
  code), a not found after a warm paint is checked once by a cold reload (`guardNotFound` on `setProjectNotFound`,
  `warmOpenFallback`).

## Data and persistence

IndexedDB `liveplanner-last-seen`, version 1, stores `copies` and `seen`; at most 20 copies of at most 1,000,000
characters each, none read past 30 days. The copy's item adds `cards` (an `ItemStoreState`, exactly what the
reader's store held), `sheets` (`{ tabId, sheets: SheetJson[] }`, exactly what the reader's read answered) and,
for a Dashboard first tab, `refs` (`{ tabs: Tab[], sheets: KeptSheets[] }`, the shown tabs as loaded and their
sheets as read), each absent until followed and null past its cap.

## Errors and edge cases

| Case                                                       | Handling                                                                                    |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| A Board or Dashboard first tab with no cards kept          | No warm open (past the cap, or a reload before the cards first loaded and were written)     |
| A Sheet first tab whose sheets were not kept, or another's | No warm open                                                                                |
| A Form first tab                                           | No warm open                                                                                |
| More than `PLAN_COPY_MAX_CARDS` cards                      | `cards: null`: the copy keeps the meta and first tab only, small enough to write            |
| Sheets over `PLAN_COPY_MAX_CELLS` cells                    | `sheets: null`                                                                              |
| The whole copy over `LAST_SEEN_MAX_CHARS`                  | The shared store keeps none and removes the older one                                       |
| Practice cards on the board (the Plan tour)                | Cards not followed until they go; the kept cards stay as they were                          |
| A card the copy kept that the server refused               | The catch-up's first load takes the server's store whole                                    |
| A Dashboard (or any tab) with a chart from a sheet's cells | No warm open: the copy keeps only the first tab's own sheets                                |
| A Dashboard with a Sheet Metric or Form Metric slot        | No warm open: the copy keeps no sheet a figure reads, and a form's figures are the server's |
| A Dashboard tile naming a Form tab                         | No warm open                                                                                |
| A Dashboard's shown tab not yet loaded, or cells past cap  | No `refs` written (or `refs: null`): no warm open                                           |
| A Dashboard's shown tab deleted                            | Left out of `refs`; the tile paints "This Board was deleted." as it would loaded            |
| A shown tab's load fails after the catch-up                | The tile drops its stand-in for its Retry                                                   |
| A tab-scoped link                                          | The kept cards and sheets are what that scope read; the copy is read only by the same code  |

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
check (O(1)) and hands the store over by reference; `sheetsForCopy` counts cells (O(sheets)). The shown tabs'
follow compares the shown tab objects and reads by identity (O(shown tiles)) on each change of `tabs`, so an edit
elsewhere costs a few comparisons and no write. A shown tab's body is a board or Sheet element and its charts, a
few KB; its cells share the 10,000 cell cap. A copy whose cards and cells together pass `LAST_SEEN_MAX_CHARS` (a
Dashboard over a near-cap board and a near-cap Sheet) is not kept, and opens as it always did.

**The copy's size and write.** Card JSON measured (Node, CPU time, 25 runs, median / p95): 100 cards with 40-word
descriptions 66,700 characters (667 a card), stringify 0.10 / 0.31 ms; 1,000 cards 668,201 characters, 0.93 /
1.07 ms; 2,000 cards with 80-word descriptions (the 1.5 MB plan) 1,758,239 characters, 2.27 / 2.50 ms. In headless
Chromium (15 runs, median) a copy at the card cap (668,292 characters) stringifies in 0.4 ms, its IndexedDB put lands
in 0.4 ms and its `JSON.parse` at the next open takes 0.8 ms. The 1.5 MB plan keeps no cards (`cards: null`), so its
copy is 72 characters plus its first tab and writes in 0.1 ms; past `LAST_SEEN_MAX_CHARS` the shared store would
have refused it anyway.

**Measured on production builds.** `e2e/perf/warm-open.perf.ts` (the `perf` project, `E2E_PERF=1`) makes a guest's
Kanban plan on the server and opens it at its own address against the production export on the e2e stack, cold (the
copy store deleted first, the open as it was before) and warm, 12 each interleaved, every one a fresh navigation in
one browser context, the network emulated over CDP at 100 ms round trip, 10 Mbps down, 5 Mbps up. "Content" is the
first frame with a card on screen; "editable" is the catch-up's `warm-catch-up` mark (a cold open is editable when
its cards paint). Medians / p90 from navigation start:

| Way in                                                        | Cold: content and editable | Warm: content | Warm: editable   |
| ------------------------------------------------------------- | -------------------------- | ------------- | ---------------- |
| A guest, the plan's own address (first, Work Tracker 927)     | 829 / 836 ms               | 390 / 397 ms  | 1,036 / 1,051 ms |
| The same, before Work Tracker 1111 (8 each, a loaded machine) | 916 / 966 ms               | 442 / 482 ms  | 802 / 894 ms     |
| The same, Work Tracker 1111                                   | 925 / 935 ms               | 405 / 419 ms  | 775 / 787 ms     |

The cards show about 520 ms (56%) sooner and the plan is editable about 150 ms before a cold open. A commit probe (a
devtools hook counting Suspense boundaries showing a fallback at each commit) found the paint's commit left the board,
the card panel's host and the Plan tour's host waiting on their code, the cards drawing about 50 ms after the paint;
with `WARM_PAINT_CODE` none waits. Following the first card's top each frame through the open, the catch-up moved it
down 50 px (198 to 248) before the board kept room for the example cards notice, and moves it by 0 px after.

## Observability

The shared marks and logs: `debugLog('[load] warm open from the last seen copy')`, `'[load] no early open'`,
`'[last-seen] copy too big to keep'`, `console.warn('[load] warm-open-fallback not-found: …')`, the `warm-paint` and
`warm-catch-up` measures and the `WarmPaint` timing. liveplanner adds `debugLog('[last-seen] plan copy skipped',
{ first: kind })` when a copy is read but its first tab cannot paint from it.

## Testing

| Rule                                                 | Test                                                                                                                                                 |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Caps and which first tabs paint                      | `lib/last-seen-plan.test.ts`                                                                                                                         |
| A Dashboard of tab tiles paints them from the copy   | `DashboardTabPreview.warm.test.tsx`; `EditorStartPanels.warm.test.tsx`                                                                               |
| A Dashboard's shown tabs follow, deleted, capped     | `usePlanCopyFollow.test.tsx` "keeps the tabs a Dashboard first tab shows …"                                                                          |
| Another app's spec links pass the naming guard       | `liveworkspace/apps/help/editions/liveplanner/tests/project-naming.test.ts`                                                                          |
| Follow item folds fields and schedules once          | `last-seen-follower.test.ts` "follows the item's other fields …"                                                                                     |
| Paint, catch-up, roles, someone else, lost access    | `useIdentityBootstrap.warm.test.tsx`                                                                                                                 |
| A revoked share link forgets the copy                | `useIdentityBootstrap.warm.test.tsx` "forgets a revoked link's copies …"                                                                             |
| Board / Sheet / Dashboard paint, Form waits          | `useIdentityBootstrap.warm.test.tsx` "paints a … first tab from what the copy kept", "waits for the load on a … first tab the copy cannot paint"     |
| Seed answers, paints, keeps the painted tab          | `seed-fetched-project.test.ts`                                                                                                                       |
| Cards shown before the plan is known, replaced whole | `usePlanItems.warm.test.ts`                                                                                                                          |
| Cards and sheets follow, practice cards and caps     | `usePlanCopyFollow.test.tsx`                                                                                                                         |
| No sheet fetch without a plan, seeded tab, tab reads | `sheet-store-warm.test.ts`                                                                                                                           |
| Other tabs load while the warm paint shows           | `editor-page-helpers.test.ts` "loads another tab than the warm-painted one before hydration"                                                         |
| Sign-out clears                                      | `AccountsBridge.test.tsx`                                                                                                                            |
| Warm against cold on production builds               | `e2e/perf/warm-open.perf.ts` (reports, never fails on a number)                                                                                      |
| The paint waits for its code, bounded                | `useIdentityBootstrap.warm.test.tsx` "has the code the paint draws in before it paints", "paints nothing when the load landed while the code loaded" |
| The board keeps room for the kept role's strips      | `PlanBoardView.warm-hold.test.tsx`; `last-seen-plan.test.ts` "warmRightsOf"                                                                          |
| History state on the `#t=` pin                       | the shared `useTabEntryEffects.test.tsx`; `useTabEntryEffects.test.tsx` here                                                                         |

## Defaults ledger

See [DEFAULTS.md](DEFAULTS.md), the last-seen-copy rows.
