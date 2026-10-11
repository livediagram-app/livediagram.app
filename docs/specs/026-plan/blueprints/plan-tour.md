# Plan tour blueprint

Derived from [Plan tour](../plan-tour.md). The engine, popover and DOM helpers are the welcome tour's
([Interactive editor tour](../../007-editor/editor-tour.md)), shared rather than copied.

## Domain and naming

| Spec term     | Identifier                                                                         |
| ------------- | ---------------------------------------------------------------------------------- |
| Plan tour     | `PlanTourHost`, `planTourSteps(track)`, `planTourStepTelemetryType`                |
| welcome tour  | `TourHost`, `TOUR_STEPS` (unchanged names)                                         |
| tour track    | `PlanTourTrack` (`'boards' \| 'sheets'`), `PLAN_TOUR_TRACKS`                       |
| example board | `PlanTourContent.elementId` (Boards), built by `exampleBoard(centre)`              |
| example cards | `PlanTourContent.itemIds`, built by `exampleCards(setup)`                          |
| example sheet | `PlanTourContent.elementId` + `.sheetId` (Sheets), built by `exampleSheet(centre)` |
| tour content  | `PlanTourContent` (`{ documentId, elementId, sheetId?, itemIds }`)                 |
| seen guard    | `UserPreferences.planTourSeen`                                                     |

## Files

| File                                           | Holds                                                                                                             |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `apps/live/components/tour/tour-step.ts`       | `TourStepOf<Api>` (the shared step shape), `hasAnchor`, `stepTelemetryType(prefix, id)`                           |
| `apps/live/components/tour/useTourEngine.ts`   | The shared step runner, extracted from `TourHost`: step index, direction, target rect, prepare / wait / heal      |
| `apps/live/components/tour/TourStage.tsx`      | The shared overlay: card backdrop, highlight ring, `TourPopover`                                                  |
| `apps/live/components/tour/TourPopover.tsx`    | Gains `copy` (`TourCardCopy`), `welcomeArt` and `welcomeChoices` (`TourWelcomeChoice[]`, replacing accept)        |
| `apps/live/components/tour/TourHost.tsx`       | The welcome tour on the engine; publishes itself to `tour-active`                                                 |
| `apps/live/components/tour/plan-tour-steps.ts` | `planTourSteps(track)`, `PLAN_TOUR_STEPS` (Boards), `PlanTourApi`, `planTourStepTelemetryType`                    |
| `apps/live/components/tour/PlanTourHost.tsx`   | Offer, relaunch, deferral, end; builds `PlanTourApi`                                                              |
| `apps/live/components/tour/PlanTourArt.tsx`    | The welcome card's illustration                                                                                   |
| `apps/live/lib/tour-active.ts`                 | Which tour is on screen (`'welcome' \| 'plan' \| null`), a module store read with `useSyncExternalStore`          |
| `apps/live/lib/plan-tour.ts`                   | Relaunch event, tracks, `PlanTourContent` and its leftover record, `exampleBoard`, `exampleCards`, `exampleSheet` |
| `apps/live/lib/sheet-select-request.ts`        | `listenForSheetSelect` / `requestSheetSelect`: selecting a drawn Sheet's cell from outside it                     |
| `apps/live/hooks/plan/usePlanTourContent.ts`   | Places, moves and removes tour content with no history and no telemetry; sweeps a leftover record                 |

Also touched: `tour-steps.ts` (its `TourStep` is `TourStepOf<TourApi>`; `ensurePaletteOpen` and `closeDropdown`
are exported for the Plan palette step), `ClusterPopoverButton` (a `dataTourId` prop; Card Types passes
`card-types`), the Settings catalogue and dialog, `power-user-mode.ts`, `help-articles.ts`, the help article
`apps/help/app/canvas/plan-mode/plan-tour/page.mdx` with its registry entry, icon and colour, and the telemetry
dashboard (`apps/telemetry/app/catalogue/features.ts`, `apps/telemetry/app/catalogue/visitors.ts`,
`apps/telemetry/app/catalogue/settings.ts`, `apps/telemetry/app/DashboardView.tsx`,
`apps/telemetry/app/computed-emitters.ts`, `apps/telemetry/app/event-explanations.ts`).

Sheets side: `PlacedSheet.setUp` (`lib/sheet-seeds.ts`) makes a placed sheet already set up (`useSheetModel`'s
`setUpNow`: `setupWrite` of the start in the Header look, header frozen, Default size, `undoable: false`);
`PlanSheetView`'s `SheetParts` listens for `requestSheetSelect` on its sheet id; `SheetFormulaBar` carries
`data-sheet-formula-bar` for the Formulas step.

Wiring: `useEditorState` composes `usePlanTourContent` (with `sheets.releaseSheets`) and returns it as `planTour`; `EditorView` mounts
`<PlanTourHost />` beside `<TourHost />` in the same `AreaErrorBoundary`. `usePlanItems` gains `writeQuiet`
(applies and sends a write without an undo step). `usePlanSlice` returns `showItem(id | null)`, setting the open
item without `Plan` · `Opened`.

## Behaviour and state

### Engine (`useTourEngine`)

`useTourEngine<Api>({ steps, apiRef, onStepView, onStart, onFinish })` returns `{ active, step, stepIndex, stepDir,
targetRect, countableSteps, start, next, back, skip, stop }`. Behaviour is the welcome tour's, moved:

1. `start()` sets index 0, direction forward, clears the rect, bumps the run token, `active = true`.
2. On each step entry: `onStepView(step)` (not for `card: 'welcome'`); then `prepare(api)` runs for every
   step, anchored or not (an anchorless step's prepare is how the Plan outro removes tour content); an
   anchorless step then shows centred; an anchored step awaits its target (`selector(api)` when set, else the
   `data-tour-id` of `target`) for 3500 ms. No target: the step's cleanup runs and the tour moves on, or
   finishes from the last step.
3. Every 150 ms the target is re-measured; a detached target re-runs prepare and re-awaits (healing).
4. `next()`, `back()`, `skip()` run the current step's cleanup first; `next()` from the welcome card calls
   `onStart`. `next()` on the last step and `skip()`
   call `onFinish(outcome)` with `'completed'`, or `'skipped'` / `'declined'` (declined from the welcome card).
5. `stop()` ends without an outcome (the host ending it for its own reasons).

`TourStep<Api>` gains `selector?: (api) => string | null`. `target` stays the data-tour-id anchor; a step has
an anchor when either is set.

### Offer (`PlanTourHost`)

| State   | Event                                     | Guard                                                   | Effect                                                             |
| ------- | ----------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------ |
| idle    | mode becomes `plan` (or mounts in `plan`) | none                                                    | `armed = true`                                                     |
| idle    | mode leaves `plan`                        | none                                                    | `armed = false`                                                    |
| idle    | armed, `planTourSeen === true`            | none                                                    | `armed = false`                                                    |
| idle    | armed for `OFFER_DELAY_MS`                | usable, can edit, tab unlocked, no other tour, not owed | `start()`, `Opened` · `PlanTourOffer`                              |
| idle    | relaunch event                            | in `plan`                                               | `armed = true` (offers by the row above)                           |
| idle    | relaunch event                            | not in `plan`                                           | none (`planTourSeen` is already cleared, so entering Plan arms it) |
| running | edit rights lost / mode leaves `plan`     | none                                                    | `stop()`, end as skipped                                           |
| running | `onFinish(outcome)`                       | none                                                    | end (below)                                                        |

"Usable": `hydrated && !anyWelcomeOpen && !isReadOnly && !embedMode`. "No other tour": `activeTour() === null`.
"Not owed": `!hasTourPending()`. The guard is re-read whenever `activeTour` changes, so the Plan tour offers
right after the welcome tour ends. `TourHost` mirrors it: its offer and its relaunch wait while
`activeTour() === 'plan'`.

End: `planTour.removeAll()`, close the item panel, write `planTourSeen: true` (as `TourHost` writes
`tourSeen`), and send `Closed` · `PlanTourOffer`, `Ended` · `PlanTourCompleted` or `Ended` · `PlanTourSkipped`.
Unmounting mid-tour runs `removeAll()`.

### Tracks

The welcome card's `welcomeChoices` are **Boards** and **Spreadsheets**; each sends `Selected` ·
`PlanTourBoards` | `PlanTourSheets`, sets the host's `tourTrack`, then `engine.next()` (which sends `Started` ·
`PlanTour`). The engine's `steps` are `planTourSteps(tourTrack)`: the shared welcome card then that track's steps
and outro. `tourTrack` resets to `'boards'` on each offer, so the welcome card always has a next step; the switch
lands with the index move to 1, in one render. The outro's help link follows the track
(`/help/canvas/plan-mode/` or `/help/canvas/plan-mode/sheets/`).

Sheets steps: `sheet` (the element; prepare `placeSheet`), `cells` (`[role="grid"]`), `formulas`
(`[data-sheet-formula-bar]`; prepare `selectTotal`), `sheet-toolbar` (`[role="toolbar"]`), `sheet-settings`
(`button[aria-label="Sheet Settings"]`), `sheet-palette` (the palette step), `outro`, each scoped to
`[data-element-id="<sheet element>"]`. `placeSheet` waits up to `SHEET_DRAW_WAIT_MS` for the grid.

### Tour content (`usePlanTourContent`)

`{ ensureBoard(centre), ensureSheet(centre), ensureCards(), moveFirstCard(), removeAll(), boardId(),
sheetElementId(), sheetId(), firstCardId(), status(column) }`, each idempotent; placing and adding are no-ops while
edits are blocked or there is no document id. Content is one track's: `ensureBoard` after a sheet, or
`ensureSheet` after a board, returns null.

- `ensureBoard`: when no board is placed yet, builds `exampleBoard(centre)` and appends it to the active tab
  with `tickTabs` (no history), records the content, writes the leftover record.
- `ensureCards`: waits for the item store (`status === 'ready'`, up to 3000 ms), then one `writeQuiet`
  create of `exampleCards(setup)` with fresh ids, records them, rewrites the leftover record.
- `moveFirstCard`: `writeQuiet` move of "Plan the launch" to the board's In Progress status, end of column;
  a no-op once it is there.
- `ensureSheet`: builds `exampleSheet(centre)` (a `plan-sheet` element of `EXAMPLE_SHEET_SIZE` whose
  `placeNewSheet({ title: EXAMPLE_SHEET_TITLE, setUp: 'budget' })` makes it set up when it first draws), appends it
  with `tickTabs`, records element and sheet ids.
- `removeAll`: `writeQuiet` delete of each recorded item, `releaseSheets([sheetId])` for a sheet (a warning
  `content.failed { step: 'sheet' }` when no Sheet has drawn to take it), `tickTabs` filtering the element out of
  every tab, clears the record and the leftover record.
- Sweep: once the document has hydrated, a leftover record for this document has its element (and sheet) removed; once the
  items are ready, its items too, then the record is cleared. A record for another document is kept. The
  sweep never touches what this visit's tour is showing.

`exampleBoard(centre)`: `createShape('plan-board')` with `freshBoardSetup('kanban')`, title
`EXAMPLE_BOARD_TITLE`, width `max(default, planBoardWidthFor(setup))`, centred on `centre`. The PlanTourApi
the host builds wraps these (`placeBoard` also waits for the board to draw), plus `openCard` /
`closeCard` (`plan.showItem` / `plan.closeItem`) and `removeContent`.
`exampleCards(setup)`: the spec's three cards, statuses read from the setup's `todo~` and `backlog~` columns.

## Interfaces and contracts

- `UserPreferences.planTourSeen?: boolean`; missing = not seen. No migration (free-form preferences blob).
- `PLAN_TOUR_RELAUNCH_EVENT = 'livediagram:plan-tour-relaunch'`, dispatched by `requestPlanTourRelaunch()`.
- Leftover record: `localStorage['livediagram:v2:plan-tour-content']` = JSON `PlanTourContent`; a malformed value is
  dropped, never thrown. A record from before the Sheets track (`boardId`) reads as its `elementId`.
- `requestSheetSelect(sheetId, { r, c })`: true when a drawn Sheet took it (selects that one cell, unsaved).
- Settings switch: `planTourSeen`, label **Plan** in the Show Tours `toggleGroup`, inverted read / write, help article
  `planTour`, event `{ on: 'PlanTourSeenOff', off: 'PlanTourSeenOn' }`. `SettingsDialog`'s close relaunches
  when the row is on and was off at open.
- `POWER_USER_PRESET.planTourSeen = { planTourSeen: true }`.

## Data and persistence

- `planTourSeen`: synced preference, per person.
- `PlanTourContent` in memory (a ref) plus its leftover record in `localStorage` (per browser): the only way to find
  tour content after a reload. Tour content itself is an ordinary element and ordinary items, persisted and
  synced as any are, for the few seconds the tour lasts.

## Errors and edge cases

| Case                                             | Handling                                                                                  |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Items never load                                 | `ensureCards` gives up after 3000 ms; the cards / move / panel steps are skipped          |
| A write is refused                               | `writeQuiet` returns false; the step's target never appears and it is skipped             |
| The person deletes the example board mid-tour    | Board steps are skipped (no target); `removeAll` deletes the recorded items               |
| The person switches tab mid-tour                 | The tour ends as skipped; `removeAll` filters every tab                                   |
| Reload or closed window mid-tour                 | The leftover record sweeps the content on the next visit to that document                 |
| Leftover record for another document             | Kept until that document is opened                                                        |
| Welcome tour relaunched while the Plan tour runs | The welcome tour waits for `activeTour() === null`, as the Plan tour does                 |
| Locked tab                                       | No offer                                                                                  |
| The example sheet's chunk or tab is slow to load | `placeSheet` waits 3000 ms; the sheet steps skip if the grid never draws                  |
| A reload mid Sheets track, before a Sheet draws  | The sweep's `releaseSheets` returns false: the element goes, the sheet is left as a Cut's |

## Security and trust

Tour content is made with the person's own rights through the same item routes and element sync as any edit;
nothing new crosses a trust boundary. A viewer never sees an offer.

## Performance and limits

- Nothing loads until Plan mode: `PlanTourHost` renders `null` and subscribes to one module store; its steps
  module is a few strings.
- Three item writes in one create, one move, three deletes; one board element. Well inside `ITEMS_MAX`.
- Sheets track: one element, one sheet create and one setup write of 18 cells; one release.
- The engine's 150 ms re-measure runs only while a tour is on screen (unchanged from the welcome tour).

## Presentation and UX

As the welcome tour. The welcome card's eyebrow is **Plan tour** and its art `PlanTourArt` (a card sliding
from one column to the next on a small board, the welcome art's recipe: inline SVG, Tailwind classes for
light and dark, looping with `infinite`, still under reduced motion). The outro reuses `TourHelpArt`, with
**Visit Help Centre** linking `/help/canvas/plan-mode` and **Start planning**.

## Accessibility

As the welcome tour: the popover is a labelled dialog ("Plan tour step 2 of 7: Add cards"), buttons are
native, the ring is `aria-hidden`, reduced motion stills the art and the glide.

## Web Experience

No work at page load; the host is in the editor bundle and draws nothing until offered. No layout shift: every
surface is fixed-position over the canvas.

## Observability

- `[plan-tour] offer`, `[plan-tour] end { outcome }`, `[plan-tour] content.placed`, `[plan-tour] content.removed
{ items }`, `[plan-tour] content.swept { items }` through `debugLog`.
- `console.warn('[plan-tour] content.failed', { step })` when a write is refused (`step`: `cards` or `move`).

## Testing

| Rule                                                          | Test                                                     |
| ------------------------------------------------------------- | -------------------------------------------------------- |
| Offered on entering Plan, once, after the delay               | `PlanTourHost.test.tsx`                                  |
| Not offered when seen, read-only, locked, or another tour     | `PlanTourHost.test.tsx`                                  |
| Waits for the welcome tour, then offers                       | `PlanTourHost.test.tsx`                                  |
| Relaunch offers in Plan only                                  | `PlanTourHost.test.tsx`                                  |
| Steps and telemetry tokens, both tracks                       | `plan-tour-steps.test.ts`                                |
| Welcome choices pick the track; Sheets runs on the sheet      | `PlanTourHost.test.tsx`, `TourStage.test.tsx`            |
| Example sheet placed set up, no undo step                     | `useSheetModel.test.tsx`, `plan-tour.test.ts`            |
| Example sheet placed and released with its element            | `usePlanTourContent.test.ts`                             |
| A cell selected from outside a Sheet                          | `sheet-select-request.test.ts`, `PlanSheetView.test.tsx` |
| Example board is a fresh Kanban, example cards on its columns | `plan-tour.test.ts`                                      |
| Leftover record round trip, malformed value dropped           | `plan-tour.test.ts`                                      |
| Content placed and removed without history or telemetry       | `usePlanTourContent.test.ts`                             |
| Sweep of a leftover record                                    | `usePlanTourContent.test.ts`                             |
| Engine: prepare, skip a missing target, heal, finish outcomes | `useTourEngine.test.tsx`                                 |
| Stage: default and Plan card words, ring, labels              | `TourStage.test.tsx`                                     |
| Welcome tour waits for the Plan tour                          | `TourHost.test.tsx`                                      |
| Active-tour store                                             | `tour-active.test.ts`                                    |
| Settings row inverted, events                                 | `settings-catalogue.test.ts`                             |
| Telemetry tokens charted and explained                        | `apps/telemetry` `metric-emitters.test.ts`, explanations |

## Constants and configuration

| Constant                | Value                                | Provenance                                | Safe range   |
| ----------------------- | ------------------------------------ | ----------------------------------------- | ------------ |
| `OFFER_DELAY_MS`        | 800                                  | The welcome tour's settle delay           | 300 to 2000  |
| `EXAMPLE_MOVE_TO`       | `'doing'`                            | Spec: the first card moves to In Progress | fixed        |
| `TARGET_WAIT_MS`        | 3500                                 | The welcome tour's target wait            | 1000 to 6000 |
| `ITEMS_READY_WAIT_MS`   | 3000                                 | Default D28                               | 1000 to 6000 |
| `EXAMPLE_BOARD_TITLE`   | `'Example Board'`                    | Spec                                      | fixed        |
| `EXAMPLE_SHEET_TITLE`   | `'Example Sheet'`                    | Spec                                      | fixed        |
| `EXAMPLE_SHEET_SIZE`    | 600 × 400                            | Budget's 3 columns, 6 rows, header, bars  | 480 to 960   |
| `EXAMPLE_TOTAL_CELL`    | `{ r: 5, c: 2 }` (C6)                | Spec: the Budget start's Total amount     | fixed        |
| `SHEET_DRAW_WAIT_MS`    | 3000                                 | As `ITEMS_READY_WAIT_MS`                  | 1000 to 6000 |
| `PLAN_TOUR_CONTENT_KEY` | `'livediagram:v2:plan-tour-content'` | The editor's storage key scheme           | fixed        |

## Defaults ledger

D28 (how long to wait for items before skipping the card steps) in [DEFAULTS.md](DEFAULTS.md).
