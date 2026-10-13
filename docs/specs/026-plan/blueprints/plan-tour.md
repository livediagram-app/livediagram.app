# Plan tour blueprint

Derived from [Plan tour](../plan-tour.md). The engine, popover and DOM helpers are the Diagram tour's
([Diagram tour](../../007-editor/editor-tour.md)), shared rather than copied.

## Domain and naming

| Spec term     | Identifier                                                                                             |
| ------------- | ------------------------------------------------------------------------------------------------------ |
| Plan tour     | `PlanTourHost`, `planTourSteps(track, { offer, hasCards })`, `planTourStepTelemetryType`               |
| Diagram tour  | `TourHost`, `TOUR_STEPS` (the welcome tour's names, unchanged)                                         |
| tour track    | `PlanTourTrack` (`'boards' \| 'sheets'`), `PLAN_TOUR_TRACKS`                                           |
| welcome offer | `PlanTourOffer` (`PlanTourTrack \| 'choice'`)                                                          |
| tour subject  | `Subject` (`{ boardId, sheetId }`, element ids) in `PlanTourHost`, fixed at offer by `visiblePlanWork` |
| plan work     | `plan-board` / `plan-sheet` shape elements on `activeTab.elements` (`isBoard`, `isSheet`)              |
| leftovers     | `PlanTourContent` and its leftover record, swept by `usePlanTourLeftovers` (old tour only)             |
| seen guard    | `UserPreferences.planTourTracks` (the answered tracks), read by `planTrackSeen` / `planTourOwed`       |

## Files

| File                                              | Holds                                                                                                                                                                  |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/live/components/tour/tour-step.ts`          | `TourStepOf<Api>` (the shared step shape), `hasAnchor`, `stepTelemetryType(prefix, id)`                                                                                |
| `apps/live/components/tour/useTourEngine.ts`      | The shared step runner: step index, direction, target rect, prepare / wait / heal                                                                                      |
| `apps/live/components/tour/TourStage.tsx`         | The shared overlay: card backdrop, highlight ring, `TourPopover`                                                                                                       |
| `apps/live/components/tour/TourPopover.tsx`       | `copy` (`TourCardCopy`), `welcomeArt` and `welcomeChoices` (`TourWelcomeChoice[]`, replacing accept)                                                                   |
| `apps/live/components/tour/TourHost.tsx`          | The Diagram tour on the engine; publishes itself to `tour-active`                                                                                                      |
| `apps/live/components/tour/plan-tour-steps.ts`    | `planTourSteps`, `PLAN_TOUR_STEPS` (Boards), `PlanTourApi`, `PlanTourOffer`, `boardRoot`, `sheetRoot`, `firstCardOn`, `visiblePlanWork`, `needsReveal`, telemetry type |
| `apps/live/components/tour/PlanTourHost.tsx`      | Offer, subject, relaunch, end; builds `PlanTourApi`                                                                                                                    |
| `apps/live/components/tour/art/plan-tour-art.tsx` | The welcome cards' illustrations: `BoardsTourArt`, `SheetsTourArt`, `PlanChoiceTourArt` (in `apps/live/components/tour/art/TourArtFrame.tsx`)                          |
| `apps/live/lib/tour-tracks.ts`                    | `tourTrackSeen`, `withTracksAnswered`: a tour of several tracks, each offered once                                                                                     |
| `apps/live/lib/tour-active.ts`                    | Which tour is on screen (`'welcome' \| 'plan' \| 'facilitate' \| null`), a module store                                                                                |
| `apps/live/lib/plan-tour.ts`                      | Relaunch event, tracks, `planTrackSeen` / `planTourOwed` / `markPlanTracksSeen`, the old tour's `PlanTourContent` record                                               |
| `apps/live/hooks/plan/usePlanTourLeftovers.ts`    | The sweep of an old tour's leftover record; nothing new is placed (see Leftovers)                                                                                      |

Also touched: `ClusterPopoverButton` (a `dataTourId` prop; Card Types passes `card-types`), the Settings catalogue
and dialog, `power-user-mode.ts`, `help-articles.ts`, the help article
`apps/help/app/canvas/plan-mode/plan-tour/page.mdx` with its registry entry, icon and colour, and the telemetry
dashboard (`apps/telemetry/app/catalogue/features.ts`, `apps/telemetry/app/catalogue/visitors.ts`,
`apps/telemetry/app/catalogue/settings.ts`, `apps/telemetry/app/DashboardView.tsx`,
`apps/telemetry/app/computed-emitters.ts`, `apps/telemetry/app/event-explanations.ts`).

Wiring: `useEditorState` composes `usePlanTourLeftovers` (it returns nothing); `EditorView` mounts `<PlanTourHost />` beside `<TourHost />` in the same
`AreaErrorBoundary`. `usePlanSlice` returns `showItem(id | null)`, setting the open item without `Plan` ·
`Opened`.

## Behaviour and state

### Engine (`useTourEngine`)

`useTourEngine<Api>({ steps, apiRef, onStepView, onStart, onFinish })` returns `{ active, step, stepIndex, stepDir,
targetRect, countableSteps, start, next, back, skip, stop }`. Behaviour is the welcome tour's, moved:

1. `start()` sets index 0, direction forward, clears the rect, bumps the run token, `active = true`.
2. On each step entry: `onStepView(step)` (not for `card: 'welcome'`); then `prepare(api)` runs for every
   step, anchored or not; an
   anchorless step then shows centred; an anchored step awaits its target (`selector(api)` when set, else the
   `data-tour-id` of `target`) for 3500 ms. No target: the step's cleanup runs and the tour moves on in the
   direction it was going (`stepDirRef`): backward to the step before unless that is index 0's welcome card or
   there is none, else forward (direction set `forward`), or finishes from the last step.
3. Every 150 ms the target is re-measured; a detached target re-runs prepare and re-awaits (healing); a heal that
   finds nothing clears the rect, so the ring lets go and the popover centres.
4. `next()`, `back()`, `skip()` run the current step's cleanup first; `next()` from the welcome card calls
   `onStart`. `next()` on the last step and `skip()`
   call `onFinish(outcome)` with `'completed'`, or `'skipped'` / `'declined'` (declined from the welcome card).
5. `stop()` ends without an outcome (the host ending it for its own reasons).

`TourStep<Api>` gains `selector?: (api) => string | null`. `target` stays the data-tour-id anchor; a step has
an anchor when either is set.

### Offer (`PlanTourHost`)

| State   | Event                                                                 | Guard                                                        | Effect                                                                  |
| ------- | --------------------------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------- |
| idle    | mode becomes `plan` (or mounts in `plan`)                             | none                                                         | `armed = true`                                                          |
| idle    | mode leaves `plan`                                                    | none                                                         | `armed = false`                                                         |
| idle    | armed, every track seen (`owed` empty)                                | none                                                         | `armed = false`                                                         |
| idle    | an owed track's plan work arrives (`offerKey` changes)                | in `plan`, has plan work                                     | `armed = true`                                                          |
| idle    | armed for `OFFER_DELAY_MS`                                            | usable, can edit, tab unlocked, no other tour, has plan work | fix the subject, pick the offer, `start()`, `Opened` · `PlanTourOffer`  |
| idle    | relaunch event                                                        | in `plan`                                                    | `armed = true` (offers by the row above, so it too waits for plan work) |
| idle    | relaunch event                                                        | not in `plan`                                                | none (the answered tracks are cleared, so entering Plan arms it)        |
| running | edit rights lost / mode leaves `plan` / another tab / subject deleted | none                                                         | `stop()`, end as skipped                                                |
| running | `onFinish(outcome)`                                                   | none                                                         | end (below)                                                             |

"Usable": `hydrated && !anyWelcomeOpen && !isReadOnly && !embedMode`. "No other tour": `activeTour()` is null or
`'plan'`. "Owed": `PLAN_TOUR_TRACKS` less those `planTrackSeen` (in `planTourTracks`, or every track when
`planTourSeen` and Power user mode are both on). "Has plan work": a `plan-board` shape while Boards is owed, or a
`plan-sheet` shape while Sheets is owed, on `activeTab.elements`; `offerKey` is which of the two the tab has. The guard is re-read whenever `activeTour` or the tab's elements change, so the Plan tour offers
right after another tour ends, or as soon as a board or Sheet appears. It no longer reads `hasTourPending()`: the
Diagram tour never runs in Plan.

At the offer: `subject = { boardId: visiblePlanWork(boardIds, boardRoot), sheetId: visiblePlanWork(sheetIds, sheetRoot) }`
(of every board and Sheet on the tab: the one inside `[data-canvas-cover]`, maximised or filling its tab, else the
first whose box meets the window, else the first); `offer = 'choice'` with both, else `'boards'` or `'sheets'`;
`tourTrack` = `'sheets'` for a sheet offer, else `'boards'`; `hasCards = firstCardOn(boardId) !== null`.
"Subject deleted": `subject[tourTrack]` no longer among `activeTab.elements`.

End: close the item panel, write `markPlanTracksSeen(prefs, answered)` (rebased onto the freshest preferences):
`answered` is both tracks for a declined choice card, else `[tourTrack]`; then send `Closed` ·
`PlanTourOffer`, `Ended` · `PlanTourCompleted` or `Ended` · `PlanTourSkipped`. Nothing to remove.

### Tracks

The engine's `steps` are `planTourSteps(tourTrack, { offer, hasCards })`: the welcome card for the offer (three
bodies: your board, your sheet, or which), then that track's steps and outro, the Boards track without
`move-card` and `card-panel` when `hasCards` is false. On a `'choice'` offer the welcome card's `welcomeChoices`
are **Boards** and **Spreadsheets**; each sends `Selected` · `PlanTourBoards` | `PlanTourSheets`, sets `tourTrack`,
then `engine.next()` (which sends `Started` · `PlanTour`); the switch lands with the index move to 1, in one
render. On a single-track offer there are no `welcomeChoices`, so the card's default accept (**Yes**)
calls `engine.next()`. The outro's help link follows the track (`/help/canvas/plan-mode/` or
`/help/canvas/plan-mode/sheets/`).

Boards steps, each scoped to the board's drawn body `[data-plan-board="<board>"]` (`boardRoot`; never its
`data-element-id` canvas node, hidden under a maximised or tab-filling body): `board` (no anchor, a centred card; prepare
`reveal('boards')`), `add-cards`
(`[data-add-card-trigger]`, the first column's Add card), `move-card` (`[data-plan-card="<first card>"]`), `card-panel`
(`[role="dialog"][aria-label^="Item #"]`; prepare `openCard`, cleanup `closeCard`), `board-header`
(`[data-board-header]`; prepare `closeCard`), `card-types` (data-tour-id `card-types`), `outro`.

Sheets steps, each scoped to the Sheet's drawn body `[data-plan-sheet="<sheet>"]` (`sheetRoot`, on
`PlanSheetView`'s body root): `sheet` (no anchor, a centred card; prepare `reveal('sheets')`), `cells` (`[data-sheet-a1]`,
the A1 cell box `SheetCells` marks; skipped when A1 is not drawn),
`formulas` (`[data-sheet-formula-bar]`), `sheet-toolbar` (`[role="toolbar"]`), `sheet-settings`
(`button[aria-label="Sheet Settings"]`), `outro`. No other Sheets step prepares anything.

### Tour subject

`PlanTourApi` is `{ boardId(), sheetElementId(), firstCardId(), openCard(), closeCard(), reveal(track) }`, built
fresh each render over the subject. `firstCardId` and `openCard` read `firstCardOn(boardId)`: the `data-plan-card`
of the first card drawn inside the board's body, or null. `reveal(track)` asks `needsReveal(root)` (false inside
`[data-canvas-cover]`; true when the body's box leaves the window) and, if so, calls
`scrollIntoView(x, y, width, height)` on the subject element: a minimal pan, zooming out only when it overflows. `openCard` calls `plan.showItem(id)` when that card is not already
open; `closeCard` calls `plan.closeItem()` when one is open. Nothing else in the api writes.

### Leftovers (`usePlanTourLeftovers`)

`usePlanTourLeftovers`, composed in `useEditorState`, sweeps what the old tour left: once the document has hydrated,
a leftover record for this document has its element (and sheet, through `releaseSheets`) removed with no history.
When `releaseSheets` returns false (no Sheet has drawn to take it), the element and the record stay, `[plan-tour]
content.failed` is logged once, and the sweep tries again after `LEFTOVER_SHEET_RETRY_MS` (2000, a cheap check; the
sheet goes soon after the first Sheet draws). Once the items are ready, its items go too (`writeQuiet` deletes,
`[plan-tour] content.swept`); the record is cleared only once both the element and the items are swept. A record for
another document is kept. Nothing writes a record any more.

## Interfaces and contracts

- `UserPreferences.planTourTracks?: PlanTourTrack[]`; missing = none answered. `planTourSeen?: boolean` counts every
  track only while `powerUserMode` is on. No migration (free-form preferences blob).
- `PLAN_TOUR_RELAUNCH_EVENT = 'livediagram:plan-tour-relaunch'`, dispatched by `requestPlanTourRelaunch()`.
- Leftover record (read only): `localStorage['livediagram:v2:plan-tour-content']` = JSON `PlanTourContent`; a
  malformed value is dropped, never thrown. A record from before the Sheets track (`boardId`) reads as its
  `elementId`.
- Settings switch: `planTourSeen` (`tourTracksSwitch`), label **Plan Tour**, second toggle row in the Tours category; reads on while
  `planTourOwed`, writes off as `{ planTourSeen: true, planTourTracks: ['boards', 'sheets'] }` and on as
  `planTourSeen: false` with `planTourTracks` removed; help article
  `planTour`, event `{ on: 'PlanTourSeenOff', off: 'PlanTourSeenOn' }`. `SettingsDialog`'s close relaunches
  when the row is on (`planTourOwed`) and was off at open.
- `POWER_USER_PRESET.planTourSeen = { planTourSeen: true }`.

## Data and persistence

- `planTourTracks` and `planTourSeen`: synced preferences, per person.
- The tour writes no document data: no element, item, cell or history entry. The subject is held in component
  state for the run only.
- The leftover record in `localStorage` is only read and cleared (the old tour's).

## Errors and edge cases

| Case                                              | Handling                                            |
| ------------------------------------------------- | --------------------------------------------------- |
| No board or Sheet on the tab (empty, Dashboard)   | No offer; armed until one appears while in Plan     |
| Settings rerun with no board or Sheet             | Armed; offered once one appears; nothing is placed  |
| A board with no cards                             | `move-card` and `card-panel` are left out up front  |
| The board or Sheet has not drawn when a step runs | The step's target is awaited 3500 ms, then skipped  |
| The subject is deleted mid-tour                   | The tour ends as skipped                            |
| The person switches tab or leaves Plan mid-tour   | The tour ends as skipped; the card panel is closed  |
| A Sheet's toolbar or cog not shown to this person | Its step finds no target and is skipped             |
| Diagram or Facilitate tour on screen              | The Plan tour waits for `activeTour()` to clear     |
| Locked tab                                        | No offer                                            |
| A leftover record from the old tour               | Swept on the next visit to that document, as before |

## Security and trust

The tour writes nothing, so nothing crosses a trust boundary. A Participant and a Viewer never see an offer
(`isReadOnly`).

## Performance and limits

- Nothing loads until Plan mode: `PlanTourHost` renders `null` and subscribes to one module store; its steps
  module is a few strings.
- Per render while mounted: two `filter`s over the open tab's elements (linear; a tab holds a handful of plan
  elements).
- `visiblePlanWork` runs at the offer only: one `querySelector` and one `getBoundingClientRect` per board or Sheet
  on the tab.
- `firstCardOn` is one `querySelector`, run at the offer and on the card steps only.
- The engine's 150 ms re-measure runs only while a tour is on screen (unchanged from the Diagram tour).

## Presentation and UX

As the Diagram tour. The welcome card names its offer: eyebrow **Boards tour**, **Sheets tour** or **Boards and
Sheets tour** (`ariaPrefix` the same, the chosen track's after a pick), with `BoardsTourArt` (a card sliding from
one column to the next), `SheetsTourArt` (A1 typed into, the selection stepping across and down) or
`PlanChoiceTourArt` (a two-column board beside a small sheet), all in `TourArtFrame`'s recipe: inline SVG, Tailwind
classes for light and dark, looping with `infinite`, still under reduced motion. The outro reuses `TourHelpArt`, with
**Visit Help Centre** linking `/help/canvas/plan-mode` and **Start Planning**.

## Accessibility

As the Diagram tour: the popover is a labelled dialog ("Plan tour step 2 of 7: Add cards"), buttons are
native, the ring is `aria-hidden`, reduced motion stills the art and the glide.

## Web Experience

No work at page load; the host is in the editor bundle and draws nothing until offered. No layout shift: every
surface is fixed-position over the canvas.

## Observability

- `[plan-tour] offer { offer }`, `[plan-tour] end { outcome }`, `[plan-tour] track { track }` through `debugLog`;
  the sweep's `[plan-tour] content.swept { items }`.

## Testing

| Rule                                                                    | Test                                                     |
| ----------------------------------------------------------------------- | -------------------------------------------------------- |
| Offered in Plan once a board or Sheet is on the tab, after the delay    | `PlanTourHost.test.tsx`                                  |
| Waits on an empty tab or a Dashboard; a rerun waits and places nothing  | `PlanTourHost.test.tsx`                                  |
| Not offered when seen, read-only, locked, unhydrated, embedded          | `PlanTourHost.test.tsx`                                  |
| Waits for another tour on screen; not for the Diagram tour being owed   | `PlanTourHost.test.tsx`                                  |
| Relaunch offers in Plan only                                            | `PlanTourHost.test.tsx`                                  |
| One kind skips the choice; both ask; the track runs on the subject      | `PlanTourHost.test.tsx`, `TourStage.test.tsx`            |
| A board with no cards leaves out the card steps                         | `PlanTourHost.test.tsx`, `plan-tour-steps.test.ts`       |
| Runs to the end without changing the document or sending content events | `PlanTourHost.test.tsx`                                  |
| Ends as skipped on another tab or the subject deleted                   | `PlanTourHost.test.tsx`                                  |
| Steps, selectors on the subject, nothing prepared but the card panel    | `plan-tour-steps.test.ts`                                |
| Welcome bodies per offer, Title Case step titles                        | `plan-tour-steps.test.ts`                                |
| Leftover record round trip, malformed value dropped                     | `plan-tour.test.ts`                                      |
| Sweep of a leftover record                                              | `usePlanTourLeftovers.test.ts`                           |
| Engine: prepare, skip a missing target, heal, finish outcomes           | `useTourEngine.test.tsx`                                 |
| Stage: default and Plan card words, ring, labels                        | `TourStage.test.tsx`                                     |
| Active-tour store                                                       | `tour-active.test.ts`                                    |
| Settings row inverted, events                                           | `settings-catalogue.test.ts`                             |
| Telemetry tokens charted and explained                                  | `apps/telemetry` `metric-emitters.test.ts`, explanations |

## Constants and configuration

| Constant                | Value                                | Provenance                              | Safe range   |
| ----------------------- | ------------------------------------ | --------------------------------------- | ------------ |
| `OFFER_DELAY_MS`        | 800                                  | The Diagram tour's settle delay         | 300 to 2000  |
| `TARGET_WAIT_MS`        | 3500                                 | The Diagram tour's target wait          | 1000 to 6000 |
| `PLAN_TOUR_CONTENT_KEY` | `'livediagram:v2:plan-tour-content'` | The editor's storage key scheme (sweep) | fixed        |

## Defaults ledger

D28 (how long the old tour waited for items before its card steps) in [DEFAULTS.md](DEFAULTS.md), retired with
the example cards: the card steps now read the drawn board.
