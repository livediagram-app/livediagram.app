# Plan tour blueprint

Derived from [Plan tour](../plan-tour.md). The engine, stage, popover, spotlight, shield, tour colours and the
footer's Start Tour button live once in `@liveworkspace/workbench/components/tour`
([Editor tours](../../007-editor/editor-tour.md)), shared rather than copied.

## Domain and naming

| Spec term    | Identifier                                                                                               |
| ------------ | -------------------------------------------------------------------------------------------------------- |
| Plan tour    | `PlanTourHost`, `planTourSteps(track)`, `planTourStepTelemetryType`                                      |
| tour track   | `BoardSheetTrack` (`'boards' \| 'sheets'`), of `PLAN_TOUR_TRACKS`                                        |
| offer        | `useOfferTour('plan', …)` (`tour-offer.ts`): the track the footer button names, `offerTrack`             |
| tour subject | `Subject` (`{ boardId, sheetId }`, element ids) in `PlanTourHost`, fixed at a press by `visiblePlanWork` |
| plan work    | `plan-board` / `plan-sheet` shape elements on `activeTab.elements` (`isBoard`, `isSheet`)                |
| leftovers    | `PlanTourContent` and its leftover record, swept by `usePlanTourLeftovers` (old tour only)               |
| seen guard   | `UserPreferences.planTourTracks` (the answered tracks), read by `planTrackSeen`                          |

## Files

| File                                                         | Holds                                                                                                                     |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `packages/workbench/src/components/tour/tour-step.ts`        | `TourStepOf<Api>` (the shared step shape), `hasAnchor`, `stepTelemetryType(prefix, id)`                                   |
| `packages/workbench/src/components/tour/useTourEngine.ts`    | The shared step runner: step index, direction, target rect, prepare / wait / heal                                         |
| `packages/workbench/src/components/tour/tour-offer.ts`       | `useOfferTour`, `TOUR_OFFER_RANK`: each host publishes its tour; the most specific one is on the button                   |
| `packages/workbench/src/components/tour/TourOfferButton.tsx` | The footer's Start Tour button, beside Search (`ChromeControls`)                                                          |
| `apps/editor/components/tour/TourStage.tsx`                  | The editor's overlay over the shared `TourStage`: spotlight, `TourPopover`                                                |
| `apps/editor/components/tour/plan-tour-steps.ts`             | `planTourSteps`, `PlanTourApi`, `boardRoot`, `sheetRoot`, `firstCardOn`, `visiblePlanWork`, `needsReveal`, telemetry type |
| `apps/editor/components/tour/PlanTourHost.tsx`               | Offer, subject, the example card, relaunch, end; builds `PlanTourApi`                                                     |
| `apps/editor/lib/tour-tracks.ts`                             | `tourTrackSeen`, `withTracksAnswered`: the tracks a person has taken                                                      |
| `apps/editor/lib/tour-active.ts`                             | Which tour is on screen (`'plan' \| 'dashboard' \| 'form' \| 'show-me' \| null`), a module store                          |
| `apps/editor/lib/plan-tour.ts`                               | Relaunch event, tracks, `planTrackSeen` / `markPlanTracksSeen`, the old tour's `PlanTourContent` record                   |
| `apps/editor/hooks/plan/usePlanTourLeftovers.ts`             | The sweep of an old tour's leftover record; nothing new is placed (see Leftovers)                                         |

Also touched: `ClusterPopoverButton` (a `dataTourId` prop; Card Types passes `card-types`), the Settings catalogue
and dialog, `power-user-mode.ts`, `help-articles.ts`, the help article
`apps/help/app/plan/plan-tour/page.mdx` with its registry entry, icon and colour, and the telemetry
dashboard (`../liveworkspace/apps/site/app/telemetry/liveplanner/catalogue/features.ts`, `../liveworkspace/apps/site/app/telemetry/liveplanner/catalogue/visitors.ts`,
`../liveworkspace/apps/site/app/telemetry/liveplanner/catalogue/settings.ts`, `../liveworkspace/apps/site/app/telemetry/liveplanner/config.ts`,
`../liveworkspace/apps/site/app/telemetry/liveplanner/computed-emitters.ts`, `../liveworkspace/apps/site/app/telemetry/liveplanner/event-explanations.ts`).

Wiring: `useEditorState` composes `usePlanTourLeftovers` (it returns nothing); `EditorTours` mounts `<PlanTourHost />`
with the editor. `usePlanSlice` returns `showItem(id | null)`, setting the open item without `Plan` ·
`Opened`.

## Behaviour and state

### Engine (`useTourEngine`)

`useTourEngine<Api>({ steps, apiRef, onStepView, onStart, onFinish })` returns `{ active, step, stepIndex, stepDir,
targetRect, countableSteps, start, next, back, skip, stop }`:

1. `start()` sets index 0, direction forward, clears the rect, bumps the run token, `active = true`, and calls
   `onStart`. Index 0 is the track's first real step: there is no welcome card.
2. On each step entry: `onStepView(step)`; then `prepare(api)` runs for every
   step, anchored or not; an
   anchorless step then shows centred; an anchored step awaits its target (`selector(api)` when set, else the
   `data-tour-id` of `target`) for 3500 ms. No target: the step's cleanup runs and the tour moves on in the
   direction it was going (`stepDirRef`): backward to the step before unless there is none, else forward (direction set `forward`), or finishes from the last step. A found target is revealed
   (`revealInScrollers(el, step.revealAt)`, `tour-reveal.ts`: each `overflow: auto | scroll` ancestor, innermost
   first, then an unlocked page, left alone when it wholly shows the target inside a `REVEAL_MARGIN_PX` (16) margin,
   else scrolled to centre it, or to the top for `'start'` or a target taller than its scroller; `smooth`, `auto` under reduced motion), then measured.
3. Every 150 ms the target is re-measured; a detached target re-runs prepare and re-awaits (healing), revealing what
   it finds; a heal that finds nothing clears the rect, so the ring lets go and the popover centres. A target that
   only moves is followed, never re-revealed.
4. `next()`, `back()`, `skip()` run the current step's cleanup first. `next()` on the last step and `skip()`
   call `onFinish(outcome)` with `'completed'` or `'skipped'` (`TourOutcome`; there is no `'declined'`).
5. `stop()` ends without an outcome (the host ending it for its own reasons).

`TourStep<Api>` gains `selector?: (api) => string | null` and `revealAt?: 'center' | 'start'` (default center). `target` stays the data-tour-id anchor; a step has
an anchor when either is set.

### Offer (`PlanTourHost`)

The host publishes its offer with `useOfferTour('plan', offer)`, re-read every render; it never starts the tour on
its own (no settle delay, no arming).

| State   | Event                                                        | Guard                                                            | Effect                                                                               |
| ------- | ------------------------------------------------------------ | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| idle    | render                                                       | usable, can edit, tab unlocked, has plan work                    | publish `{ name: 'Boards' \| 'Sheets', rank: TOUR_OFFER_RANK.mode, start, onShown }` |
| idle    | render                                                       | otherwise                                                        | publish `null` (the button names another tour, or is not drawn)                      |
| idle    | the button first shows this offer in a page load (`onShown`) | none                                                             | `Opened` · `PlanTourOffer`                                                           |
| idle    | a press (`start`) or relaunch event                          | not active, no other tour, `offerTrack` set (relaunch: on offer) | fix the subject, `tourTrack = offerTrack`, `start()` (sends `Started` · `PlanTour`)  |
| running | edit rights lost / another tab / subject deleted             | none                                                             | `stop()`, end as skipped                                                             |
| running | `onFinish(outcome)`                                          | none                                                             | end (below)                                                                          |

"Usable": `hydrated && !anyWelcomeOpen && !isReadOnly && !embedMode`. "No other tour": `activeTour()` is null or
`'plan'`. "Has plan work": a `plan-board` or `plan-sheet` shape on `activeTab.elements`. `offerTrack`: of the tracks
with work on the tab (Boards first), the first not `planTrackSeen` (in `planTourTracks`, or every track when
`planTourSeen` and Power user mode are both on), else the first; so a taken tour stays on offer.

At a press: `subject = { boardId: visiblePlanWork(boardIds, boardRoot), sheetId: visiblePlanWork(sheetIds, sheetRoot) }`
(of every board and Sheet on the tab: the one inside `[data-canvas-cover]`, maximised or filling its tab, else the
first whose box meets the window, else the first). "Subject deleted": `subject[tourTrack]` no longer among
`activeTab.elements`.

End: close the item panel, remove the example card, write `markPlanTracksSeen(prefs, [tourTrack])` (rebased onto
the freshest preferences); then send `Ended` · `PlanTourCompleted` or `Ended` · `PlanTourSkipped`.

### Tracks

The engine's `steps` are `planTourSteps(tourTrack)`: that track's steps and its last card. Every board has the
card steps: the Boards track adds its own example card to show them on. The last card's help link follows the track
(`/help/plan/planning-basics/` or `/help/plan/sheets/`). There is no choice card: the button names the
track.

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

`usePlanTourLeftovers`, composed in `useEditorState`, sweeps what the old tour left: once the project has hydrated,
a leftover record for this project has its element (and sheet, through `releaseSheets`) removed with no history.
When `releaseSheets` returns false (no Sheet has drawn to take it), the element and the record stay, `[plan-tour]
content.failed` is logged once, and the sweep tries again after `LEFTOVER_SHEET_RETRY_MS` (2000, a cheap check; the
sheet goes soon after the first Sheet draws). Once the items are ready, its items go too (`writeQuiet` deletes,
`[plan-tour] content.swept`); the record is cleared only once both the element and the items are swept. A record for
another project is kept. Nothing writes a record any more.

## Interfaces and contracts

- `UserPreferences.planTourTracks?: PlanTourTrack[]` (`'boards' | 'sheets' | 'dashboards'`; PlanTourHost runs the
  first two, `BoardSheetTrack`); missing = none answered. `planTourSeen?: boolean` counts every
  track only while `powerUserMode` is on. No migration (free-form preferences blob).
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
  and `planTourTracks` = the tracks seen in `p` (the single flag folded in) with its own track added (off) or removed
  (on). The rows only record: the button stays on offer however they read. Help articles `planTour` (Boards, Sheets) and `planDashboards` (Dashboards); events
  `{ on: 'BoardsTourSeenOff', off: 'BoardsTourSeenOn' }`, `{ on: 'SheetsTourSeenOff', off: 'SheetsTourSeenOn' }` and
  `{ on: 'DashboardsTourSeenOff', off: 'DashboardsTourSeenOn' }`. `SettingsDialog`'s close relaunches when a track is
  owed that was not owed at open; the host starts the tour then only if it is on offer.
- `POWER_USER_PRESET.planTourSeen = { planTourSeen: true }`.

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
