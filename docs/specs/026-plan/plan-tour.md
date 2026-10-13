# Plan tour

A guided tour of [Plan mode](plan-mode.md) on the person's own board or Sheet, offered the first time they work
in Plan with one open. It is the [Diagram tour](../007-editor/editor-tour.md)'s sibling: the same welcome card,
anchored step cards, glide, dimming ring, Skip, Back and outro card, driven by the same engine, so the tours
read as one product. Where this spec is silent, the Diagram tour's rules hold.

## Domain language

| Term             | Means                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------ |
| **Plan tour**    | This tour                                                                                              |
| **Diagram tour** | The Diagram mode tour ("Getting started with Diagrams?"), [Diagram tour](../007-editor/editor-tour.md) |
| **tour track**   | Which half of Plan the tour shows: **Boards** or **Sheets**                                            |
| **tour subject** | The board or [Sheet](../029-sheets/sheet.md) the tour shows: the person's own, on the open tab         |
| **plan work**    | A board (`plan-board` element) or a Sheet (`plan-sheet` element) on the open tab, of any tab kind      |

## Where it appears

- **Only once there is plan work to show.** The tour is offered the first time a person is in Plan mode on a
  tab they may edit **with a board or a Sheet on it**: a Board tab, a Sheet tab, or a Plan tab holding a board
  or Sheet. An empty Plan tab (which shows Start Planning) and a Dashboard tab have nothing to show, so the
  offer waits, armed, until the person opens or makes a board or Sheet while still in Plan, then follows after
  the settle delay. The editor has to be usable, as for the Diagram tour (hydrated, no welcome overlay, not
  read-only, not an embed), and the tab not locked.
- **On the person's own board or Sheet, never an example.** The tour places nothing: it runs on the tour
  subject (see [Tour subject](#tour-subject)).
- **Once ever per person**, through the synced `planTourSeen` user preference
  ([User preferences](../007-editor/user-preferences.md)): taken, skipped mid-way or declined, it never offers
  itself again, on any device.
- **Replayable from Settings**: the **Plan Tour** switch in Settings' **Tours** category,
  beside **Diagram** and built the same way (on means "not seen yet"). Turning it on from off and closing
  Settings runs the tour straight away when the open tab is in Plan with a board or Sheet on it; otherwise it is
  offered the first time that is true, exactly as a first offer. Nothing is placed to give it something to show:
  an empty Plan tab already offers Start Planning, which makes a board or Sheet, and the switch's description
  says the tour needs one.
- **One tour at a time**: while the Diagram or Facilitate tour is on screen the Plan tour waits. Each tour
  belongs to its own mode, so the Plan tour never waits for the Diagram tour's offer to be answered.
- The offer is the opt-in, as for the Diagram tour. With only boards or only Sheets on the tab, the welcome card
  names the one it will show and offers **Yes** and **No**. With both on the tab (a Plan
  canvas holding a board and a Sheet), it asks which: **Boards**, **Spreadsheets** and **No**, all with
  equal weight. Taking the tour marks it seen; the other track is a Settings rerun away.

## Tour subject

- The tour subject is the board (Boards track) or Sheet (Sheets track) on the open tab **that the person sees**,
  read from what is drawn when the tour is offered: one maximised or filling its tab (a Board tab, a Sheet tab)
  first, then one on screen, then the first in the tab's element order. A Board tab and a Sheet tab hold exactly
  one.
- **Its steps point at it as drawn**, wherever that is: on the canvas, maximised, or filling its tab. They never
  point at its place on the canvas while it is drawn over the canvas, where it is hidden.
- **On screen.** Its first step brings it into view when it sits on the canvas out of the window: the view pans to
  it, zooming out only if it is too big to fit. One maximised or filling its tab is already on screen.
- **Never over Start Planning.** An empty Plan tab shows Start Planning, so the tour is offered only once the tab
  has a board or Sheet (see [Where it appears](#where-it-appears)).
- **It changes nothing.** The tour adds no element, card, row or cell, moves nothing, selects no cell and writes
  nothing, so there is nothing to take away, nothing in the document's history, and nothing a collaborator
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

A welcome card, then the track's steps, then its outro card. The bookend cards sit outside the step count. Copy
is one or two short sentences per step and speaks of the person's board or sheet ("your board"); the exact
strings live in `apps/live/components/tour/plan-tour-steps.ts`.

0. **Welcome to Plan** (the offer): centred card with its own illustration (a card moving across a small
   board). With one kind on the tab it says the tour will show around this board (or this sheet), without
   changing anything, then **No** and **Yes**; with both it asks which, then **No**,
   **Boards** and **Spreadsheets**.

### Boards

Up to six steps.

1. **Your Board**: highlights the board. Columns are the stages work moves through, left to right.
2. **Add Cards**: highlights the board's first column. Each column ends in Add card, which adds a card of any
   type the board takes.
3. **Move Work Along** (when the board has a card): highlights its first card. Drag a card to the next column as
   the work moves on, or Shift and an arrow key with it focused; everyone in the document sees it move.
4. **The Card Panel** (when the board has a card): opens that card's panel and highlights it. Everything about a
   piece of work is here, saved as it is typed.
5. **The Board Header**: highlights the board's header. Its widgets count and filter the board; more come from
   the + at their end, and a column's cog sets the board up.
6. **Card Types**: highlights the Card Types button. Each type has its own colour and fields, changed or made
   there.
7. **You're ready to plan** (outro): a help-centre link to the Plan mode article (new tab) and **Start
   Planning**, which completes the tour.

### Spreadsheets

Five steps.

1. **Your Sheet**: highlights the Sheet. A sheet is a spreadsheet in the document: cells, formulas and charts.
2. **Type Into Cells**: highlights the grid. A click selects a cell and typing fills it; Enter moves down, Tab
   across, and numbers, dates and percentages are read as typed.
3. **Formulas**: highlights the formula bar, which shows the selected cell's value or formula; the tour selects
   nothing. A cell starting with `=` is a formula; clicking cells while writing one points at them.
4. **The Toolbar**: highlights the Sheet's toolbar. Its category switcher picks the tools beside it (Text,
   Cells, Numbers, Data, Charts, Functions), acting on the selected cells.
5. **Sheet Settings**: highlights the Sheet's cog. The title, CSV import and download, gridlines, sizes, freeze
   and named ranges live there.
6. **You're ready to plan** (outro): a help-centre link to the Sheets article (new tab) and **Start Planning**,
   which completes the tour.

### Both tracks

- Back from a step goes to the step before and shows it again. Back never returns to the welcome card. Leaving a
  step closes what it opened (the card panel). Plan has no palette, so neither track has a palette step.
- A step whose target never appears is skipped, as in the Diagram tour; a step list filtered up front keeps the
  count honest. The steps are the same on a desktop and a phone.
- If the tour can no longer run where it started (the person's edit rights go, they leave Plan, they open
  another tab, or the tour subject is deleted) it ends as skipped.

## Share roles

Only someone who may edit the tab is offered the tour: an **Editor**. A **Participant** and a **Viewer** never
are (the editor is read-only for them), since what it shows (adding cards, card types, a Sheet's toolbar and
settings) is an Editor's to use.

## Telemetry ([Telemetry](../017-telemetry/telemetry.md))

The Diagram tour's funnel, with its own tokens, so the tours chart apart:

- **Offer**: `UI` · `Opened` · `PlanTourOffer` when the welcome card shows; `UI` · `Closed` · `PlanTourOffer` on
  No.
- **Start**: `UI` · `Selected` · `PlanTourBoards` | `PlanTourSheets` (the track picked, only when the welcome
  card asked), then `UI` · `Started` · `PlanTour`.
- **Stage views**: `UI` · `View` · `PlanTourStep<Id>` once per step entry (`PlanTourStepBoard`,
  `PlanTourStepAddCards`, `PlanTourStepMoveCard`, `PlanTourStepCardPanel`, `PlanTourStepBoardHeader`,
  `PlanTourStepCardTypes`; `PlanTourStepSheet`, `PlanTourStepCells`, `PlanTourStepFormulas`,
  `PlanTourStepSheetToolbar`, `PlanTourStepSheetSettings`; `PlanTourStepOutro` for either outro).
- **End**: `UI` · `Ended` · `PlanTourCompleted` | `PlanTourSkipped`.
- **Settings row**: `UI` · `Toggled` · `PlanTourSeenOn` | `PlanTourSeenOff`, describing the preference as the
  Diagram tour's row does.
- The tour sends no `Element`, `Plan` or `Sheet` events: opening a card's panel from the tour is not counted as
  the person opening it.

## Power user mode

[Power user mode](../007-editor/power-user-mode.md) marks the Plan tour seen alongside the Diagram tour.
