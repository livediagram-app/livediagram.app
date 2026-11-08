# Plan tour blueprint

Derived from [Plan tour](../plan-tour.md). The footer's Start Tour button, the offer ranks and the one-tour-at-a-time
store live once in `@liveworkspace/workbench/components/tour` and `apps/editor/lib/tour-active.ts`
([Editor tours](../../007-editor/editor-tour.md)). The three tracks here do not use the step engine: they run
missions, checked from live state, in a mission strip of their own.

## Domain and naming

| Spec term      | Identifier                                                                                       |
| -------------- | ------------------------------------------------------------------------------------------------ |
| Plan tour      | `PlanTourHost` (Boards, Sheets), `DashboardTour` hooks (Dashboards), `planTourStepTelemetryType` |
| tour track     | `BoardSheetTrack` (`'boards' \| 'sheets'`), of `PLAN_TOUR_TRACKS`; `'dashboards'`                |
| mission        | `Mission<Ctx>` (`missions.ts`): `id`, `title`, `why`, `lesson`, `hints`, `done(ctx)`             |
| mission strip  | `MissionStrip` (`placement: 'page' \| 'dialog'`), `Segments`, `HintRing`                         |
| practice card  | an item in `PlanItems.practiceIds`, key `PRACTICE_KEY` (0), `data-practice` on its board cell    |
| practice sheet | `startPracticeSheet` (`practice-sheet.ts`), `PracticeSheetDialog`                                |
| Layout View    | `LayoutView`, `layoutMissions`, `data-layout-view` on `[data-dashboard]`                         |
| tour subject   | `Run.boardId` in `PlanTourHost`, fixed at a press by `visiblePlanWork`                           |
| leftovers      | `PlanTourContent` and its leftover record, swept by `usePlanTourLeftovers` (old tour only)       |
| seen guard     | `UserPreferences.planTourTracks` (the answered tracks), read by `planTrackSeen`                  |

## Files

| File                                                  | Holds                                                                                                                                     |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/editor/components/tour/missions.ts`             | `useMissions`, `Mission`, `MissionHint`: the runner every track shares (a lesson waits for `next`)                                        |
| `apps/editor/components/tour/MissionStrip.tsx`        | The strip: name, segments, mission or lesson (Next) or finish, Hint / More Help, End; `StripFrame`, the corner strip over a dialog        |
| `apps/editor/components/tour/TourStart.tsx`           | The start panel a press opens: one track (Start) or a board's three (rows with a Done tick); Not Now                                      |
| `apps/editor/components/tour/board-tracks.ts`         | `typesMissions`, `setupMissions`, `newTypeOf`, `typeShape`, `setupChanged`: the Card Types and Board Setup checks                         |
| `apps/editor/components/tour/CardTypesTrack.tsx`      | The Card Types track: new type, its first shape, capture of its card, board `addTypes`, Keep the Type / Put It Back                       |
| `apps/editor/components/tour/BoardSetupTrack.tsx`     | The Board Setup track: the board's setup at start, missions, Keep Changes / Put It Back (`updateBoard(boardId, start)`)                   |
| `apps/editor/components/tour/TrackFinish.tsx`         | The finish of a track that changed the real plan: Keep, Put It Back, Learn More                                                           |
| `apps/editor/components/tour/HintRing.tsx`            | A hint's ring round a selector, re-measured every 150 ms                                                                                  |
| `apps/editor/components/tour/LearnMore.tsx`           | A finish's help link, in a new tab                                                                                                        |
| `apps/editor/components/tour/plan-tour-steps.ts`      | `sprintMissions`, `sheetMissions`, `overWipColumn`, `wipNote`, `a1Range`, `visiblePlanWork`, `needsReveal`, `FINISH_STEP`, telemetry type |
| `apps/editor/components/tour/PlanTourHost.tsx`        | Offer, subject, relaunch, end; mounts `PracticeSprint` or `PracticeSheetDialog`                                                           |
| `apps/editor/components/tour/PracticeSprint.tsx`      | The Boards track: deal, missions, WIP note, finish (Keep as Real Cards / Clear Them)                                                      |
| `apps/editor/components/plan/PracticeMarks.tsx`       | The Practice pill and the Shipped stamp; `practiceShipColumn`                                                                             |
| `apps/editor/hooks/plan/practice-items.ts`            | The practice layer's pure parts: split a write, add, apply, keep over a read, take away                                                   |
| `apps/editor/components/tour/practice-sheet.ts`       | The practice store (a `SheetStore` over a local api), the seed, `practiceSheetCtx`, `keptSheetSeed`                                       |
| `apps/editor/components/tour/PracticeSheetDialog.tsx` | The Sheets track: the real Sheet parts in a dialog, its own undo, cell marks, missions, Keep This Sheet                                   |
| `apps/editor/components/tour/PracticeChart.tsx`       | The small grouped column chart a Chart It pick draws in the strip                                                                         |
| `apps/editor/components/sheets/sheet-cell-marks.ts`   | `SheetCellMarksContext`: A1 addresses to `'glow' \| 'ok'`, drawn by `SheetCells`                                                          |
| `apps/editor/components/sheets/useFormulaPointRef.ts` | Formula pointing, shared by `PlanSheetView` and the practice sheet                                                                        |
| `apps/editor/components/tour/layout-missions.ts`      | `layoutMissions(start, condensed)`, `emptyCount`, `LAYOUT_VIEW_REVEAL`                                                                    |
| `apps/editor/components/tour/LayoutView.tsx`          | The Dashboards track: the grid overlay (`RowGuides`), missions, finish                                                                    |
| `apps/editor/components/tour/DashboardTour.tsx`       | `useDashboardTour`, `useDashboardTourOffer`, `DashboardShowMeButton`, `DashboardTourStage`                                                |
| `apps/editor/lib/tour-active.ts`                      | Which tour is on screen (`'plan' \| 'dashboard' \| 'form' \| 'show-me' \| null`), a module store                                          |
| `apps/editor/lib/plan-tour.ts`                        | Relaunch event, tracks, `planTrackSeen` / `markPlanTracksSeen`, the old tour's `PlanTourContent` record                                   |
| `apps/editor/hooks/plan/usePlanTourLeftovers.ts`      | The sweep of an old tour's leftover record; nothing new is placed (see Leftovers)                                                         |

Also touched: `usePlanItems` (`practiceIds`, `practise`, `endPractice`), `usePlanSlice` (passes them on; no `Plan` ·
`Moved` for a practice card), `PlanBoardCells` / `PlanBoardView` (`data-practice`, the deal index, the stamp),
`PlanCardFace` (no key tag at key 0), `ItemPanel` (a Practice Card: no menu, no comments), `ItemPanelLayout`
(`data-item-field`), `usePlanTabActions.addTabAfter`, `DashboardSettings`, `globals.css` and `canvas-motion.css`,
the help article `apps/help/app/plan/plan-tour/page.mdx`, and the telemetry dashboard
(`../liveworkspace/apps/site/app/telemetry/liveplanner/computed-emitters.ts`, `event-explanations.ts`, the retired
events list).

## Behaviour and state

### Missions (`useMissions`)

`useMissions({ missions, ctx, active, onView })` returns `{ mission, index, count, phase, hintLevel, hint,
moreHints, showHint, next }`:

1. A new `missions` array or `active` turning on resets to index 0, no hints, phase `'doing'` (`'finish'` when
   there are none). The reset happens as it renders, not in an effect.
2. Each render checks `mission.done(ctx)` while `'doing'`; true sets `'lesson'`. A mission already done as it starts
   shows its lesson straight away.
3. `'lesson'` waits for `next()` (the strip's Next, Finish after the last), then the next mission (`'doing'`, hints
   reset) or `'finish'`. No timer: a lesson is never gone before it is read.
4. `onView(mission)` fires once as each mission starts (`UI` · `View` · `PlanTourStep<Id>`).
5. `showHint()` raises `hintLevel` up to the mission's hint count; `hint` is the rung on show. A rung's `ring()` is a
   selector `MissionStrip` hands to `HintRing`.

### Offer and end (`PlanTourHost`)

| State   | Event                                                        | Guard                                         | Effect                                                                                         |
| ------- | ------------------------------------------------------------ | --------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| idle    | render                                                       | usable, can edit, tab unlocked, has plan work | publish `{ name: 'Boards' \| 'Sheets', rank: TOUR_OFFER_RANK.mode, … }`                        |
| idle    | render                                                       | otherwise                                     | publish `null`                                                                                 |
| idle    | the button first shows this offer in a page load (`onShown`) | none                                          | `Opened` · `PlanTourOffer`                                                                     |
| idle    | a press or relaunch event                                    | not active, no other tour, `offerKind` set    | `Run { kind, track: null, boardId: visiblePlanWork(…), tabId, n }`, `Opened` · `PlanTourStart` |
| start   | a pick on `TourStart`                                        | none                                          | `track` set, `Started` · `PlanTour` / `PlanTourCardTypes` / `PlanTourBoardSetup`, mark taken   |
| start   | Not Now                                                      | none                                          | `Run` null; nothing recorded                                                                   |
| running | edit rights lost / another tab / its board deleted           | none                                          | end as skipped                                                                                 |
| running | the track's `onEnd(outcome)`                                 | `runRef` set (an end counts once)             | mark taken, `Ended` · `PlanTourCompleted` or `PlanTourSkipped`, unmount                        |

"Usable": `hydrated && !anyWelcomeOpen && !isReadOnly && !embedMode`. `offerKind`: of the kinds with work on the
tab (Boards first), the first not taken, else the first; Boards is taken when all of `BOARD_TRACKS` are. `seen`:
every kind with work on the tab is taken. The Dashboards tour's offer calls `tour.start(true)`: `TourStart` first,
then `begin()` (mark taken, `Started` · `DashboardTour`) or `cancel()`; Show Me calls `start()` and goes straight in.

### Boards: Practice Sprint (`PracticeSprint`)

- The shape is fixed at mount from the board's setup: first column, the next (or the first), the ship column
  (`practiceShipColumn`: the first done-kind column, else the last), whether the card type has `due`, phone.
  No columns: ends as skipped.
- Mount: reveal the board if it is off screen (`needsReveal`, `scrollIntoView`), set `data-practice-deal` on the
  root for `DEAL_MS` (900), and `plan.practise(creates)` with `PRACTICE_CARD_TITLES` in the first column. Unmount:
  `endPractice(false)` (a no-op once kept). Under Strict Mode the remount ends the first practice and deals again.
- Ctx per render: the practice cards from `plan.context.items`, the open item id, the dealt ids.
- Capture: as it deals, `plan.capturePractice(c => c.place.status is one of the board's columns)`, so Add card on
  the board makes a practice card (`add-card` is done when one not dealt appears); cleared on unmount and by
  `endPractice` (so kept cards are made real, not captured again). `addItem` sends no `Plan` · `Added` for one.
- WIP: `overWipColumn(setup.columns, items)` gone over during a mission sets a note once, shown in place of that
  mission's why.
- Finish: **Clear Them** (`endPractice(false)`), **Keep as Real Cards** (`endPractice(true)`, `UI` · `Selected` ·
  `PlanTourKeepCards`), Learn More (`/help/plan/planning-basics/`); then `onEnd('completed')`.

### Boards: Card Types (`CardTypesTrack`) and Board Setup (`BoardSetupTrack`)

- Card Types keeps the type ids at mount; `newTypeOf` is the first type not among them, and its `typeShape` as first
  seen (set during render) tells an edit apart. Once it exists, `capturePractice` matches a create of that type in a
  board column, and a board whose `addTypes` names its types gets the new id (`updateBoard`). Put It Back:
  `endPractice(false)`, `itemTypes.deleteType(id)`, and `addTypes` as it was; Keep: `endPractice(false)` only.
- Board Setup keeps the board's `PlanBoardSetup` at mount; the checks compare columns by id (a new column is not a
  rename) and `widgetsOf` (so an unset `widgets` reads as the defaults). Put It Back: `updateBoard(boardId, start)`
  when `setupChanged`; one undo step. Adding a column is left out (its status would stay).
- Either: `UI` · `Selected` · `PlanTourPutBack` on Put It Back; End keeps the changes.

### The strip over a dialog (`StripFrame`)

On a computer, while `useOpenModalCount() > 0`, the full strip moves to the bottom-left (`data-mission-corner` on its
layer, `justify-start`, the card `w-[19rem]`); nothing about it shrinks. A mission with `onPage` adds the amber line
`[data-close-first]` "Close this window first, then:" over its why while doing. A phone keeps docking at the top.
The ring is `hint.ring()` once a hint asks, otherwise the mission's `points` while doing; `HintRing` takes the first
selector drawn on screen (non-zero box), re-checked every 150 ms. `Emphasis` draws `**x**` as `<strong>`.

### Practice cards (`usePlanItems`)

- `practise(creates)`: `addPracticeItems` (store's own transition, key 0, `nextKey` unchanged); ids join
  `practiceRef`. False when refused or there is no person yet.
- `write` / `send`: `splitPracticeWrite` first. The practice part goes through `applyPracticeWrite` with no undo
  step; a write wholly on practice cards stops there; the rest is sent as ever.
- Every `load` lays them back with `keepPracticeItems`.
- `endPractice(keep)`: takes them out of the store (`withoutPracticeItems`); with `keep`, one undoable `create` of
  them in rank order, each with its `fields` less `status` and `place: { status }`.

### Sheets: Five Small Wins (`PracticeSheetDialog`)

- `startPracticeSheet(locale, sinks)`: one `SheetStore` a page, over an api answered locally (`fetchSheets` reads the
  seeds, `writeSheet` echoes the write). Each run is a new tab id and sheet id, seeded by typing `PRACTICE_CELLS`
  (through `typeInto`, so formulas work out) and bolding the header and Total rows, with no undo.
- The dialog renders `SheetToolbar`, `SheetFormulaBar`, `SheetGrid` and `SheetMenus` under a
  `SheetControllerProvider` with `canEdit`, `maximised`; `placeChart` draws `PracticeChart` from the pick instead
  of placing a chart. ⌘Z / Ctrl+Z, ⌘⇧Z and Ctrl+Y run the dialog's own undo stacks. `closeOnEscape` is false.
- Ctx per render: `practiceSheetCtx(sheet, value, charted)`. The current mission's `cells` are marks (`'glow'`, or
  `'ok'` in its lesson) through `SheetCellMarksContext`; `SheetCells` draws a mark per drawn cell with
  `data-practice-cell` and `data-mark`.
- Finish: **Done**, **Keep This Sheet** (`stashSheetSeeds([keptSheetSeed(sheet)], { keepTitle: true })`, so the copy keeps the title,, then a `kind: 'sheet'` tab named
  Practice Budget with one `plan-sheet` whose `planSheet.copyOf` is the seed, through `planTabs.addTabAfter`, then
  `setActiveId`; `UI` · `Selected` · `PlanTourKeepSheet`), Learn More (`/help/plan/sheets/`).

### Dashboards: Layout View (`LayoutView`)

- `useDashboardTour(hidden)`: `{ active, n, start, end }`; `end` counts once; `hidden` (covered, or no longer
  editable) ends as skipped. `offered(true)` marks a footer run, whose end takes the track; Show Me records nothing.
- At mount: `start` (the layout) and `condensed` (`[data-dashboard]` narrower than 640 px) are fixed;
  `layoutMissions(start, condensed)`. `data-layout-view` on `[data-dashboard]` keeps dividers and edges shown;
  `data-tour-reveal` on the first filled slot shows its cog.
- The overlay (`pointer-events: none`, `--z-overlay`) re-measures `[data-dashboard-row]` and `[data-dashboard-slot]`
  every 150 ms and on scroll, keeping its state when nothing moved: 12 column bands per row (not when condensed),
  a span chip per slot, a height chip per row that does not fill the page.
- Missions compare the layout now with `start`: spans changed, slot count up, a row height changed, fewer empty
  slots.

### Leftovers (`usePlanTourLeftovers`)

`usePlanTourLeftovers`, composed in `useEditorState`, sweeps what the old tour left: once the project has hydrated,
a leftover record for this project has its element (and sheet, through `releaseSheets`) removed with no history.
When `releaseSheets` returns false (no Sheet has drawn to take it), the element and the record stay, `[plan-tour]
content.failed` is logged once, and the sweep tries again after `LEFTOVER_SHEET_RETRY_MS` (2000, a cheap check; the
sheet goes soon after the first Sheet draws). Once the items are ready, its items go too (`writeQuiet` deletes,
`[plan-tour] content.swept`); the record is cleared only once both the element and the items are swept. A record for
another project is kept. Nothing writes a record any more.

## Interfaces and contracts

- `UserPreferences.planTourTracks?: PlanTourTrack[]` (`'boards' | 'card-types' | 'board-setup' | 'sheets' |
'dashboards'`; PlanTourHost runs all but the last, `BoardSheetTrack`); missing = none answered. `planTourSeen?: boolean` counts no
  track on its own; for a stored blob that had `powerUserMode` on, `upgradeLegacyPreferences`
  (`packages/api-schema/src/legacy-preferences.ts`) adds every track to `planTourTracks` on read. No migration
  (free-form preferences blob).
- `PLAN_TOUR_RELAUNCH_EVENT = 'liveplanner:plan-tour-relaunch'`, dispatched by `requestPlanTourRelaunch()`.
- Leftover record (read only): `localStorage['liveplanner:v2:plan-tour-content']` = JSON `PlanTourContent`; a
  malformed value is dropped, never thrown. A record from before the Sheets track (`boardId`) reads as its
  `elementId`.
- Settings switches: **Plan Tours** (`tourTracksSwitch`, key `planTourSeen`, label **Plan Tours**, the second toggle
  row in the Getting Started category; reads on while any of `PLAN_TOUR_TRACKS` is owed; off writes `planTourSeen: true` with
  every track answered, on removes `planTourTracks` and clears `planTourSeen`; events `PlanTourSeenOff` /
  `PlanTourSeenOn`), then one row per track nested beneath it (`tourTrackSwitch`, `parent: 'planTourSeen'`), keys
  `planTourSeen-boards`, `planTourSeen-sheets` and `planTourSeen-dashboards`, labels **Boards Tour**, **Sheets Tour**
  and **Dashboards Tour**. A track's row reads on while `!planTrackSeen(p, track)`; it writes `planTourSeen: false`
  and `planTourTracks` = the tracks seen in `p` with its own track added (off) or removed
  (on). A row on puts its track back on the button (the host's `seen` reads the same `planTrackSeen`). Help articles `planTour` (Boards, Sheets) and `planDashboards` (Dashboards); events
  `{ on: 'BoardsTourSeenOff', off: 'BoardsTourSeenOn' }`, `{ on: 'SheetsTourSeenOff', off: 'SheetsTourSeenOn' }` and
  `{ on: 'DashboardsTourSeenOff', off: 'DashboardsTourSeenOn' }`. `SettingsDialog`'s close relaunches when a track is
  owed that was not owed at open; the host starts the tour then only if it is on offer.

## Data and persistence

- `planTourTracks` and `planTourSeen`: synced preferences, per person.
- Practice cards and the practice sheet live in this screen's memory alone: no request, no history entry, no undo
  step in the plan. A reload drops them.
- Kept work is ordinary plan data: Keep as Real Cards is one `create` write (one undo step); Keep This Sheet is a new
  tab whose Sheet is copied from a stashed seed, as a template's is.
- The leftover record in `localStorage` is only read and cleared (the old tour's).

## Errors and edge cases

| Case                                               | Handling                                                              |
| -------------------------------------------------- | --------------------------------------------------------------------- |
| No board or Sheet on the tab (empty, Dashboard)    | Not on offer; the button names another tour or is not drawn           |
| A press while another tour is on screen            | Nothing happens                                                       |
| A board with no columns                            | The sprint ends as skipped as it starts                               |
| A board with one column                            | Only Open One (and Give It a Date): nowhere to move a card to         |
| A card type without Due                            | Give It a Date is left out                                            |
| The store refuses the deal (full)                  | `[plan-tour] practice cards refused`; the missions wait for cards     |
| A WIP limit gone over                              | Said once, on that mission; the move is never blocked                 |
| The board is deleted, the tab changed, rights lost | Ends as skipped; the practice cards go                                |
| Escape inside the practice sheet                   | The sheet's (a cell's edit); the dialog stays                         |
| A dashboard narrower than 640 px                   | Only Fill a Slot (none when nothing is empty: straight to the finish) |
| Every dashboard row fills the page                 | No row height mission                                                 |
| A slot maximised, or the page no longer editable   | Layout View ends as skipped                                           |
| A leftover record from the old tour                | Swept on the next visit to that project, as before                    |

## Security and trust

Nothing a tour does crosses a trust boundary until the person keeps it, and then it goes through the same writes,
checks and share roles as any card or tab. A Participant and a Viewer never see the button (`isReadOnly`).

## Performance and limits

Measured in jsdom (vitest), which is slower than a browser:

- `splitPracticeWrite` with no practice cards: 0.02 µs a write (one `size` check); with three cards and a
  500-card move, 8.4 µs.
- `keepPracticeItems` on a 2000-card read: 0.01 µs with no practice cards, 25 µs with three.
- `SheetCells` marks: one null check a cell outside the practice sheet; inside, `formatA1` for its 84 drawn cells,
  1.8 µs a draw.
- Layout View's measure (every 150 ms while it runs): two `querySelectorAll`s, 53 µs for 8 rows of 4 slots (one
  lookup per row and slot took 723 µs); the overlay re-renders only when a box moved.
- `HintRing` re-measures one selector every 150 ms while a hint with a ring shows.
- Nothing runs until a press; the tracks load with the editor and draw nothing until then.

## Presentation and UX

The strip: a white or slate-900 panel, 26 rem wide, floating 12 px above the footer on desktop; full width as a
bottom sheet on a phone (at the top while a modal covers the bottom); in the practice dialog, in its flow at its foot.
Practice cards: a dashed brand border, see-through, dealt in one after another (`practice-deal`, 420 ms, 80 ms
apart); the Shipped stamp, a double emerald border (`practice-stamp`, 280 ms). Both live in `canvas-motion.css` and
stop under reduced motion. Layout View: faint dashed brand column bands, dark span chips, brand height chips, in
mono with tabular figures.

## Accessibility

The strip is a labelled region (`aria-label` the track's name); its segments read "Mission 2 of 4"; the mission,
lesson and finish sit in an `aria-live="polite"` area; End reads "End Practice Sprint". Rings and the overlay are
`aria-hidden` and take no pointer. The practice chart is a labelled `img` with every value in its label, a legend
for two series, and `<title>` per column. Every mission has a keyboard route (Shift+Arrow or Move To, Enter,
arrow keys on dividers and edges, Ctrl+D).

## Web Experience

No work at page load. No layout shift: the strip, rings and overlay are fixed-position; the practice sheet is a
dialog.

## Observability

- `[plan-tour] start { track }`, `[plan-tour] end { outcome, track }`, `[plan-tour] practice cards refused` through
  `debugLog`; the sweep's `[plan-tour] content.swept { items }`.

## Testing

| Rule                                                                        | Test                                                                            |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| On the button with a board or Sheet on the tab; never starts on its own     | `PlanTourHost.test.tsx`                                                         |
| Runs the sprint on the board in view, the sheet track for a Sheet           | `PlanTourHost.test.tsx`                                                         |
| Ends once; as skipped on another tab, the board deleted, rights lost        | `PlanTourHost.test.tsx`                                                         |
| Names Boards first, Sheets once Boards is taken                             | `PlanTourHost.test.tsx`                                                         |
| Sprint and sheet missions, their checks, hints and rings                    | `plan-tour-steps.test.ts`                                                       |
| Missions run, lessons, hints climb, the strip and its footer clearance      | `missions.test.tsx`                                                             |
| Practice cards: local only, no undo, kept over a read, Keep and Clear       | `usePlanItems.practice.test.ts`                                                 |
| The practice sheet's seed, its runs, sending nothing, the kept seed         | `practice-sheet.test.ts`                                                        |
| The practice chart's columns, label and legend                              | `PracticeChart.test.tsx`                                                        |
| A kept sheet's tab goes after the open one                                  | `usePlanTabActions.test.ts`                                                     |
| Layout View: missions from the start layout, phone, fill rows               | `layout-missions.test.ts`                                                       |
| Layout View: grid, chips, hints, a change ticks off, End, Done, rights lost | `DashboardTour.test.tsx`                                                        |
| The Dashboards offer, its end once, a Show Me run records nothing           | `DashboardTourOffer.test.tsx`                                                   |
| Leftover record round trip, malformed value dropped                         | `plan-tour.test.ts`                                                             |
| Sweep of a leftover record                                                  | `usePlanTourLeftovers.test.ts`                                                  |
| Telemetry tokens charted and explained                                      | `liveworkspace/apps/site/app/telemetry` `metric-emitters.test.ts`, explanations |

## Constants and configuration

| Constant                   | Value                                | Provenance                              | Safe range   |
| -------------------------- | ------------------------------------ | --------------------------------------- | ------------ |
| `LESSON_MS`                | 1600                                 | Long enough to read a line              | 1200 to 2500 |
| `DEAL_MS`                  | 900                                  | Three cards, 80 ms apart, 420 ms each   | 600 to 1200  |
| `TRACK_MS` (overlay, ring) | 150                                  | The tour engine's re-measure            | 100 to 250   |
| `CONDENSED_PX`             | 640                                  | `DASHBOARD_CONDENSE_PX`                 | fixed        |
| `PRACTICE_KEY`             | 0                                    | No real card's key                      | fixed        |
| `PLAN_TOUR_CONTENT_KEY`    | `'liveplanner:v2:plan-tour-content'` | The editor's storage key scheme (sweep) | fixed        |

## Defaults ledger

D28 (how long the old tour waited for items before its card steps) in [DEFAULTS.md](DEFAULTS.md), retired with
the example cards: the card steps now read the drawn board.
