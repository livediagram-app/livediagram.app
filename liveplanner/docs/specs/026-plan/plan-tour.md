# Plan tour

A guided tour of [Plan mode](plan-mode.md) on the person's own board or Sheet, started from the footer's
**Start Boards Tour** or **Start Sheets Tour** button while one is open. It runs on the shared tour engine
([Editor tours](../007-editor/editor-tour.md)): the same anchored step cards, glide, dimming, Skip, Back and last
card as every other tour, so the tours read as one product. Where this spec is silent, the
[Editor tours](../007-editor/editor-tour.md) rules hold.

## Domain language

| Term             | Means                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------- |
| **Plan tour**    | This tour                                                                                         |
| **Diagram tour** | The retired Diagram mode tour, [Editor tours](../007-editor/editor-tour.md)                       |
| **tour track**   | Which half of Plan the tour shows: **Boards** or **Sheets**                                       |
| **tour subject** | The board or [Sheet](../029-sheets/sheet.md) the tour shows: the person's own, on the open tab    |
| **plan work**    | A board (`plan-board` element) or a Sheet (`plan-sheet` element) on the open tab, of any tab kind |

## Where it appears

- **The footer's Start Tour button.** The one way in is the button in the editor's bottom bar, immediately left of
  Settings ([Editor tours](../007-editor/editor-tour.md) "Where it appears"). It never starts, prompts or offers
  itself on its own. Until 25 October 2026 it offered itself once per track on a banner ("Getting started with
  boards?", **No** / **Yes**), and asked **Boards** or **Spreadsheets** on a choice card when both were on the tab.
- **Only while there is plan work to show.** The tour is on offer while a person may edit a tab **with a board or
  a Sheet on it**: a Board tab, a Sheet tab, or a Plan tab holding a board or Sheet. An empty Plan tab (which shows
  Start Planning) and a Dashboard tab have nothing to show, so the button names another tour or is not drawn. The
  editor has to be usable (hydrated, no welcome overlay, not read-only, not an embed), and the tab not locked.
- **One track on the button.** The button names one track, **Start Boards Tour** or **Start Sheets Tour**: of the
  ones with work on the tab, the first not yet taken, Boards between equals. A press runs that track on the board
  or Sheet on screen (the [tour subject](#tour-subject)). There is no choice card.
- **On the person's own board or Sheet, never an example.** The tour places no board or Sheet: it runs on the
  tour subject (see [Tour subject](#tour-subject)).
- **Taken, on every device**, through the synced `planTourTracks` user preference
  ([User preferences](../007-editor/user-preferences.md)): however a run ends (completed or skipped mid-way), the
  track it ran is taken. That record only picks which track the button names and feeds Settings' rows; it never
  hides the button, and pressing it again reruns the tour. The old single flag `planTourSeen` stands for both
  tracks only while [Power user mode](../007-editor/power-user-mode.md) is on.
- **Replayable from Settings**: in Settings' **Tours** category, **Plan Tours** switches every track at once, and
  one switch per track sits nested beneath it: **Boards Tour**, **Sheets Tour** and **Dashboards Tour** (never
  "Plan Tour"). On means that track is not yet taken; a track's switch off marks that track alone, on forgets it
  alone. Turning one on from off and closing Settings runs the tour straight away when it is on offer (the open
  tab has a board or Sheet on it); otherwise it does nothing, and the button is there once it is. Nothing is placed
  to give it something to show: an empty Plan tab already offers Start Planning, which makes a board or Sheet, and
  the switch's description says the tour needs one.
- **One tour at a time**: a press while another tour is on screen does nothing.

## The Dashboards tour

The Plan tour's third track, a tour of its own on a dashboard (`DashboardTour.tsx`): the steps of the dashboard's
Show Me ([Plan tabs](plan-tabs.md) "Show Me": rows of slots, filling a slot, a slot's cog, Dashboard Settings),
started from the footer's **Start Dashboards Tour** button. Its cards read **Show Me** whichever way it started.

- **On offer** while an Editor's dashboard is on screen: not to a Participant or a Viewer, not in an embed, not
  while a maximised slot covers the page. It ranks above the Plan and Forms tours, so on a dashboard the button
  names it. It stays on offer once taken. Until 25 October 2026 it offered itself once, on a banner ("Getting
  started with Dashboards?", **No** / **Yes**), 800 ms after a dashboard was first on screen.
- **However it ends** (completed or skipped), a run from the button marks the `dashboards` track taken
  (`planTourTracks`), on every device. Show Me from Dashboard Settings runs the same steps and records nothing.
- **Telemetry**: `UI` · `Opened` · `DashboardTourOffer` the first time the button shows it in a page load,
  `UI` · `Started` · `DashboardTour` on a press (as on Show Me's), and Show Me's `DashboardTourCompleted` |
  `DashboardTourSkipped` at the end. `UI` · `Closed` · `DashboardTourOffer` (No) is no longer sent.

## Tour content

The Boards track makes one thing of its own, the example card: a card titled **Your First Card**, of the board's first
card type (`task` when it takes every type), added to its first column, moved to its second, opened, and deleted when
the tour ends, however it ends. Its writes have no undo step (`writeQuiet`), so Undo never brings it back, and it is
recorded as tour content (`plan-tour-content` in localStorage) while it exists, so a reload mid-tour still takes it away
(`usePlanTourLeftovers`). The Sheets track makes nothing.

## Tour subject

- The tour subject is the board (Boards track) or Sheet (Sheets track) on the open tab **that the person sees**,
  read from what is drawn when the button is pressed: one maximised or filling its tab (a Board tab, a Sheet tab)
  first, then one on screen, then the first in the tab's element order. A Board tab and a Sheet tab hold exactly
  one.
- **Its steps point at it as drawn**, wherever that is: on the canvas, maximised, or filling its tab. They never
  point at its place on the canvas while it is drawn over the canvas, where it is hidden.
- **On screen.** Its first step brings it into view when it sits on the canvas out of the window: the view pans to
  it, zooming out only if it is too big to fit. One maximised or filling its tab is already on screen.
- **Never over Start Planning.** An empty Plan tab shows Start Planning, so the tour is on offer only once the tab
  has a board or Sheet (see [Where it appears](#where-it-appears)).
- **It changes nothing.** The tour adds no element, card, row or cell, moves nothing, selects no cell and writes
  nothing, so there is nothing to take away, nothing in the project's history, and nothing a collaborator
  sees. Undo after the tour is exactly as before it.
- The one thing it opens is a card's panel (the Boards track's **The Card Panel**, on the board's first card),
  which is the person's own view, saved nowhere, and closed on leaving the step or the tour.
- A step whose part of the subject is missing is left out up front: **Move Work Along** and **The Card Panel**
  need a card, so a board with no cards shows neither.
- If the tour subject goes mid-tour (deleted, by the person or a collaborator), the tour ends as skipped.
- **Leftovers from the old tour.** Until October 2026 the tour placed its own Example Board (with three example
  cards) or Example Sheet and took them away at the end, keeping a leftover record so a reload mid-tour could
  tidy them on the next visit. That sweep stays, so content an older tour left behind is still removed; nothing
  new is ever recorded. A leftover Example Sheet goes with its element, never the element alone: until a Sheet has
  drawn to take the sheet, the element and the record stay, and the sweep tries again every 2 seconds.

## The steps

A press starts the track's first step; then its steps, then its last card, a step card in the same popover that
sits outside the step count. There is no welcome card: the button already named the track. Copy is one or two
short sentences per step and speaks of the person's board or sheet ("your board"); the exact strings live in
`apps/editor/components/tour/plan-tour-steps.ts`. The cards are named for their track, never the mode (**Boards
tour**, **Sheets tour**).

A step rings a control, never a whole board, column or sheet: a ring that size would light most of the screen, so
the opening step of each track is a card on its own (centred, counted, no ring).

### Boards

Six steps, on the tour's own example card (below).

1. **Your Board**: a centred card, no spotlight; it brings the board on screen. Columns are the stages work moves
   through, left to right.
2. **Add Cards**: adds the example card, **Your First Card**, to the board's first column and highlights it.
3. **Move Work Along**: moves the example card to the next column and highlights it there; drag a card on as the work
   moves on, and everyone in the project sees it move.
4. **The Card Panel**: opens the example card's panel and highlights it. Everything about a piece of work is here,
   saved as it is typed.
5. **The Board Header**: highlights the board's header. Its widgets count and filter the board; more come from
   the + at their end, and a column's cog sets the board up.
6. **Card Types**: highlights the Card Types button. Each type has its own colour and fields, changed or made
   there.
7. **You're ready to plan** (outro): a help-centre link to the Plan mode article (new tab) and **Start
   Planning**, which completes the tour.

### Spreadsheets

Five steps.

1. **Your Sheet**: a centred card, no ring; it brings the Sheet on screen. A sheet is a spreadsheet in the
   project: cells, formulas and charts.
2. **Type Into Cells**: highlights cell A1 alone (scrolled out of view, the step is left out). A click selects a
   cell and typing fills it; Enter moves down, Tab across, and numbers, dates and percentages are read as typed.
3. **Formulas**: highlights the formula bar, which shows the selected cell's value or formula; the tour selects
   nothing. A cell starting with `=` is a formula; clicking cells while writing one points at them.
4. **The Toolbar**: highlights the Sheet's toolbar. Its category switcher picks the tools beside it (Text,
   Cells, Numbers, Data, Charts, Functions), acting on the selected cells.
5. **Sheet Settings**: highlights the Sheet's cog. The title, CSV import and download, gridlines, sizes, freeze
   and named ranges live there.
6. **You're ready to plan** (outro): a help-centre link to the Sheets article (new tab) and **Start**,
   which completes the tour.

### Both tracks

- Back from a step goes to the step before and shows it again. Leaving a
  step closes what it opened (the card panel). Plan has no palette, so neither track has a palette step.
- A step whose target never appears is skipped, as in every tour; a step list filtered up front keeps the
  count honest. The steps are the same on a desktop and a phone.
- If the tour can no longer run where it started (the person's edit rights go, they leave Plan, they open
  another tab, or the tour subject is deleted) it ends as skipped.

## Share roles

Only someone who may edit the tab sees the button for it: an **Editor**. A **Participant** and a **Viewer** never
do (the editor is read-only for them), since what it shows (adding cards, card types, a Sheet's toolbar and
settings) is an Editor's to use.

## Telemetry ([Telemetry](../017-telemetry/telemetry.md))

The editor tours' funnel, with its own tokens, so the tours chart apart:

- **Offer**: `UI` · `Opened` · `PlanTourOffer` the first time the Start Tour button shows this tour in a page
  load. Until 25 October 2026 it counted the welcome card showing, and `UI` · `Closed` · `PlanTourOffer` counted
  **No**; nothing sends Closed now, and its explanation stays for the history.
- **Start**: `UI` · `Started` · `PlanTour` on a press of the button (or a Settings rerun). `UI` · `Selected` ·
  `PlanTourBoards` | `PlanTourSheets` (the track picked on the choice card) is no longer sent.
- **Stage views**: `UI` · `View` · `PlanTourStep<Id>` once per step entry (`PlanTourStepBoard`,
  `PlanTourStepAddCards`, `PlanTourStepMoveCard`, `PlanTourStepCardPanel`, `PlanTourStepBoardHeader`,
  `PlanTourStepCardTypes`; `PlanTourStepSheet`, `PlanTourStepCells`, `PlanTourStepFormulas`,
  `PlanTourStepSheetToolbar`, `PlanTourStepSheetSettings`; `PlanTourStepOutro` for either outro).
- **End**: `UI` · `Ended` · `PlanTourCompleted` | `PlanTourSkipped`.
- **Settings rows**: `UI` · `Toggled` · `BoardsTourSeenOn` | `BoardsTourSeenOff` and `SheetsTourSeenOn` |
  `SheetsTourSeenOff`, describing the preference as the Diagram tour's row does (`PlanTourSeenOn` |
  `PlanTourSeenOff` until the row split per track in October 2026).
- The tour sends no `Element`, `Plan` or `Sheet` events: opening a card's panel from the tour is not counted as
  the person opening it.

## Power user mode

[Power user mode](../007-editor/power-user-mode.md) marks the Plan tour seen alongside the Diagram tour.
