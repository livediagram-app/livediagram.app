# Plan tour blueprint

Derived from [Plan tour](../plan-tour.md). The footer's Start Tour button, the offer ranks and the one-tour-at-a-time
store live once in `@liveworkspace/workbench/components/tour` and `apps/editor/lib/tour-active.ts`
([Editor tours](../../007-editor/editor-tour.md)). The three tracks here do not use the step engine: they run
missions, checked from live state, in a mission strip of their own.

## Domain and naming

| Spec term      | Identifier                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------ |
| Plan tour      | `PlanTourHost` (Boards, Sheets), `DashboardTour` hooks (Dashboards), `planTourStepTelemetryType`             |
| tour track     | `BoardSheetTrack` (`'boards' \| 'sheets'`), of `PLAN_TOUR_TRACKS`; `'dashboards'`                            |
| mission        | `Mission<Ctx>` (`missions.ts`): `id`, `title`, `why`, `lesson`, `hints`, `done(ctx)`                         |
| mission strip  | `MissionStrip` (`placement: 'page' \| 'dialog'`), `Segments`, `HintRing`                                     |
| practice card  | an item in `PlanItems.practiceIds`, key `PRACTICE_KEY` (0), `data-practice` on its board cell                 |
| practice sheet | `startPracticeSheet` (`practice-sheet.ts`), `PracticeSheetDialog`                                            |
| Layout View    | `LayoutView`, `layoutMissions`, `data-layout-view` on `[data-dashboard]`                                     |
| tour subject   | `Run.boardId` in `PlanTourHost`, fixed at a press by `visiblePlanWork`                                       |
| leftovers      | `PlanTourContent` and its leftover record, swept by `usePlanTourLeftovers` (old tour only)                   |
| seen guard     | `UserPreferences.planTourTracks` (the answered tracks), read by `planTrackSeen`                              |

## Files

| File                                                  | Holds                                                                                                    |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `apps/editor/components/tour/missions.ts`             | `useMissions`, `Mission`, `MissionHint`, `LESSON_MS`: the runner the three tracks share                  |
| `apps/editor/components/tour/MissionStrip.tsx`        | The strip: name, segments, mission or lesson or finish, Hint / More Help, End; footer clearance          |
| `apps/editor/components/tour/HintRing.tsx`            | A hint's ring round a selector, re-measured every 150 ms                                                 |
| `apps/editor/components/tour/LearnMore.tsx`           | A finish's help link, in a new tab                                                                       |
| `apps/editor/components/tour/plan-tour-steps.ts`      | `sprintMissions`, `sheetMissions`, `overWipColumn`, `wipNote`, `a1Range`, `visiblePlanWork`, `needsReveal`, `FINISH_STEP`, telemetry type |
| `apps/editor/components/tour/PlanTourHost.tsx`        | Offer, subject, relaunch, end; mounts `PracticeSprint` or `PracticeSheetDialog`                          |
| `apps/editor/components/tour/PracticeSprint.tsx`      | The Boards track: deal, missions, WIP note, finish (Keep as Real Cards / Clear Them)                     |
| `apps/editor/components/plan/PracticeMarks.tsx`       | The Practice pill and the Shipped stamp; `practiceShipColumn`                                            |
| `apps/editor/hooks/plan/practice-items.ts`            | The practice layer's pure parts: split a write, add, apply, keep over a read, take away                 |
| `apps/editor/components/tour/practice-sheet.ts`       | The practice store (a `SheetStore` over a local api), the seed, `practiceSheetCtx`, `keptSheetSeed`      |
| `apps/editor/components/tour/PracticeSheetDialog.tsx` | The Sheets track: the real Sheet parts in a dialog, its own undo, cell marks, missions, Keep This Sheet  |
| `apps/editor/components/tour/PracticeChart.tsx`       | The small grouped column chart a Chart It pick draws in the strip                                        |
| `apps/editor/components/sheets/sheet-cell-marks.ts`   | `SheetCellMarksContext`: A1 addresses to `'glow' \| 'ok'`, drawn by `SheetCells`                         |
| `apps/editor/components/sheets/useFormulaPointRef.ts` | Formula pointing, shared by `PlanSheetView` and the practice sheet                                       |
| `apps/editor/components/tour/layout-missions.ts`      | `layoutMissions(start, condensed)`, `emptyCount`, `LAYOUT_VIEW_REVEAL`                                   |
| `apps/editor/components/tour/LayoutView.tsx`          | The Dashboards track: the grid overlay (`RowGuides`), missions, finish                                   |
| `apps/editor/components/tour/DashboardTour.tsx`       | `useDashboardTour`, `useDashboardTourOffer`, `DashboardShowMeButton`, `DashboardTourStage`               |
| `apps/editor/lib/tour-active.ts`                      | Which tour is on screen (`'plan' \| 'dashboard' \| 'form' \| 'show-me' \| null`), a module store        |
| `apps/editor/lib/plan-tour.ts`                        | Relaunch event, tracks, `planTrackSeen` / `markPlanTracksSeen`, the old tour's `PlanTourContent` record  |
| `apps/editor/hooks/plan/usePlanTourLeftovers.ts`      | The sweep of an old tour's leftover record; nothing new is placed (see Leftovers)                        |

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
moreHints, showHint }`:

1. A new `missions` array or `active` turning on resets to index 0, no hints, phase `'doing'` (`'finish'` when
   there are none). The reset happens as it renders, not in an effect.
2. Each render checks `mission.done(ctx)` while `'doing'`; true sets `'lesson'`. A mission already done as it starts
   shows its lesson and moves on too.
3. `'lesson'` waits `LESSON_MS` (1600), then the next mission (`'doing'`, hints reset) or `'finish'`.
4. `onView(mission)` fires once as each mission starts (`UI` · `View` · `PlanTourStep<Id>`).
5. `showHint()` raises `hintLevel` up to the mission's hint count; `hint` is the rung on show. A rung's `ring()` is a
   selector `MissionStrip` hands to `HintRing`.

### Offer and end (`PlanTourHost`)

| State   | Event                                                        | Guard                                                            | Effect                                                                     |
| ------- | ------------------------------------------------------------ | ---------------------------------------------------------------- | -------------------------------------------------------------------------- |
| idle    | render                                                       | usable, can edit, tab unlocked, has plan work                    | publish `{ name: 'Boards' \| 'Sheets', rank: TOUR_OFFER_RANK.mode, … }`    |
| idle    | render                                                       | otherwise                                                        | publish `null`                                                             |
| idle    | the button first shows this offer in a page load (`onShown`) | none                                                             | `Opened` · `PlanTourOffer`                                                 |
| idle    | a press or relaunch event                                    | not active, no other tour, `offerTrack` set                      | `Run { track, boardId: visiblePlanWork(…), tabId, n }`, `Started` · `PlanTour`, mark taken |
| running | edit rights lost / another tab / its board deleted           | none                                                             | end as skipped                                                             |
| running | the track's `onEnd(outcome)`                                 | `runRef` set (an end counts once)                                | mark taken, `Ended` · `PlanTourCompleted` or `PlanTourSkipped`, unmount   |

"Usable": `hydrated && !anyWelcomeOpen && !isReadOnly && !embedMode`. `offerTrack`: of the tracks with work on the
tab (Boards first), the first not taken, else the first. `seen`: every track with work on the tab is taken.

### Boards: Practice Sprint (`PracticeSprint`)

- The shape is fixed at mount from the board's setup: first column, the next (or the first), the ship column
  (`practiceShipColumn`: the first done-kind column, else the last), whether the card type has `due`, phone.
  No columns: ends as skipped.
- Mount: reveal the board if it is off screen (`needsReveal`, `scrollIntoView`), set `data-practice-deal` on the
  root for `DEAL_MS` (900), and `plan.practise(creates)` with `PRACTICE_CARD_TITLES` in the first column. Unmount:
  `endPractice(false)` (a no-op once kept). Under Strict Mode the remount ends the first practice and deals again.
- Ctx per render: the practice cards from `plan.context.items`, the open item id.
- WIP: `overWipColumn(setup.columns, items)` gone over during a mission sets a note once, shown in place of that
  mission's why.
- Finish: **Clear Them** (`endPractice(false)`), **Keep as Real Cards** (`endPractice(true)`, `UI` · `Selected` ·
  `PlanTourKeepCards`), Learn More (`/help/plan/planning-basics/`); then `onEnd('completed')`.

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
- Finish: **Done**, **Keep This Sheet** (`stashSheetSeeds([keptSheetSeed(sheet)])`, then a `kind: 'sheet'` tab named
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

- `UserPreferences.planTourTracks?: PlanTourTrack[]` (`'boards' | 'sheets' | 'dashboards'`; PlanTourHost runs the
  first two, `BoardSheetTrack`); missing = none answered. `planTourSeen?: boolean` counts no
  track on its own; for a stored blob that had `powerUserMode` on, `upgradeLegacyPreferences`
  (`packages/api-schema/src/legacy-preferences.ts`) adds every track to `planTourTracks` on read. No migration
  (free-form preferences blob).
- `PLAN_TOUR_RELAUNCH_EVENT = 'liveplanner:plan-tour-relaunch'`, dispatched by `requestPlanTourRelaunch()`.
- Leftover record (read only): `localStorage['liveplanner:v2:plan-tour-content']` = JSON `PlanTourContent`; a
  malformed value is dropped, never thrown. A record from before the Sheets track (`boardId`) reads as its
  `elementId`.
- Settings switches: **Plan Tours** (`tourTracksSwitch`, key `planTourSeen`, label **Plan Tours**, the second toggle
  row in the Tours category; reads on while any of `PLAN_TOUR_TRACKS` is owed; off writes `planTourSeen: true` with
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
- The tour writes no project data: no element, item, cell or history entry. The subject is held in component
  state for the run only.
- The leftover record in `localStorage` is only read and cleared (the old tour's).

## Errors and edge cases

| Case                                              | Handling                                                    |
| ------------------------------------------------- | ----------------------------------------------------------- |
| No board or Sheet on the tab (empty, Dashboard)   | Not on offer; the button names another tour or is not drawn |
| Settings rerun with no board or Sheet             | Nothing starts; nothing is placed                           |
| A press while another tour is on screen           | Nothing happens                                             |
| A board with no cards                             | The card steps run on the tour's example card               |
| The board or Sheet has not drawn when a step runs | The step's target is awaited 3500 ms, then skipped          |
| The subject is deleted mid-tour                   | The tour ends as skipped                                    |
| The person switches tab or leaves Plan mid-tour   | The tour ends as skipped; the card panel is closed          |
| A Sheet's toolbar or cog not shown to this person | Its step finds no target and is skipped                     |
| Locked tab                                        | Not on offer                                                |
| A leftover record from the old tour               | Swept on the next visit to that project, as before          |

## Security and trust

The tour writes nothing, so nothing crosses a trust boundary. A Participant and a Viewer never see the
button for it (`isReadOnly`).

## Performance and limits

- `PlanTourHost` loads in its own chunk, draws nothing until a press and subscribes to one module store; its
  steps module is a few strings. Its offer is republished only when its name or rank changes.
- Per render while mounted: two `filter`s over the open tab's elements (linear; a tab holds a handful of plan
  elements).
- `visiblePlanWork` runs at a press only: one `querySelector` and one `getBoundingClientRect` per board or Sheet
  on the tab.
- `firstCardOn` is one `querySelector`, run on the card steps only.
- The engine's 150 ms re-measure runs only while a tour is on screen.

## Presentation and UX

As every editor tour ([Editor tours](../../007-editor/editor-tour.md)). The footer button reads **Start Boards
Tour** or **Start Sheets Tour**. The cards' `ariaPrefix` is **Boards tour** or **Sheets tour**. The last card is a
step card in `TourPopover`, with **Help** linking the track's article and its finish button. There are no welcome cards and no tour art.

## Accessibility

As every editor tour: the popover is a labelled dialog ("Plan tour step 2 of 7: Add cards"), buttons are
native, the ring is `aria-hidden`, reduced motion stills the glide. The footer button keeps its full name as its
accessible name when it shows the glyph alone.

## Web Experience

No work at page load; the host is in the editor bundle and draws nothing until a press. No layout shift: every
surface is fixed-position over the canvas.

## Observability

- `[plan-tour] start { track }`, `[plan-tour] end { outcome, answered }` through `debugLog`;
  the sweep's `[plan-tour] content.swept { items }`.

## Testing

| Rule                                                                    | Test                                                                            |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| On the button with a board or Sheet on the tab; never starts on its own | `PlanTourHost.test.tsx`                                                         |
| Not on offer on an empty tab; a rerun there places nothing              | `PlanTourHost.test.tsx`                                                         |
| Starts nothing while another tour is on screen                          | `PlanTourHost.test.tsx`                                                         |
| Reruns from Settings with a board on the tab                            | `PlanTourHost.test.tsx`                                                         |
| Names Boards first, Sheets once Boards is taken, Boards once all are    | `PlanTourHost.test.tsx`                                                         |
| A board with no cards still gets the card steps, on the tour's card     | `PlanTourHost.test.tsx`, `plan-tour-steps.test.ts`                              |
| Runs to the end without changing the project or sending content events  | `PlanTourHost.test.tsx`                                                         |
| Ends as skipped on another tab or the subject deleted                   | `PlanTourHost.test.tsx`                                                         |
| Steps, selectors on the subject, nothing prepared but the card panel    | `plan-tour-steps.test.ts`                                                       |
| Title Case step titles                                                  | `plan-tour-steps.test.ts`                                                       |
| Leftover record round trip, malformed value dropped                     | `plan-tour.test.ts`                                                             |
| Sweep of a leftover record                                              | `usePlanTourLeftovers.test.ts`                                                  |
| Engine: prepare, skip a missing target, heal, finish outcomes           | `useTourEngine.test.tsx`                                                        |
| Stage: default and Plan card words, ring, labels                        | `TourStage.test.tsx`                                                            |
| Active-tour store                                                       | `tour-active.test.ts`                                                           |
| Settings row inverted, events                                           | `settings-catalogue.test.ts`                                                    |
| Telemetry tokens charted and explained                                  | `liveworkspace/apps/site/app/telemetry` `metric-emitters.test.ts`, explanations |

## Constants and configuration

| Constant                | Value                                | Provenance                              | Safe range   |
| ----------------------- | ------------------------------------ | --------------------------------------- | ------------ |
| `TARGET_WAIT_MS`        | 3500                                 | The shared engine's target wait         | 1000 to 6000 |
| `PLAN_TOUR_CONTENT_KEY` | `'liveplanner:v2:plan-tour-content'` | The editor's storage key scheme (sweep) | fixed        |

## Defaults ledger

D28 (how long the old tour waited for items before its card steps) in [DEFAULTS.md](DEFAULTS.md), retired with
the example cards: the card steps now read the drawn board.
