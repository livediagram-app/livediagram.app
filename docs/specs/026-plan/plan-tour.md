# Plan tour

A guided tour of [Plan mode](plan-mode.md), its boards or its spreadsheets, offered the first time a person works in Plan. It is the
[welcome tour](../007-editor/editor-tour.md)'s sibling: the same welcome card, anchored step cards, glide,
dimming ring, Skip, Back and outro card, driven by the same engine, so the two read as one product. Where this
spec is silent, the welcome tour's rules hold.

## Domain language

| Term              | Means                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------- |
| **Plan tour**     | This tour                                                                                   |
| **welcome tour**  | The editor tour ("Show me around"), [Interactive editor tour](../007-editor/editor-tour.md) |
| **tour track**    | Which half of Plan the tour shows, picked on its welcome card: **Boards** or **Sheets**     |
| **example board** | The Kanban board the Boards track places for itself                                         |
| **example cards** | The three items the Boards track adds to the example board                                  |
| **example sheet** | The [Sheet](../029-sheets/sheet.md) the Sheets track places for itself, with its sheet      |
| **tour content**  | Whatever the tour placed (board and cards, or sheet); never anything the person made        |

## Where it appears

- **The first time a person is in Plan mode** on a tab they may edit: switching a tab to Plan, opening a
  document whose tab opens in Plan, or creating one from a Plan template. The editor has to be usable, as for
  the welcome tour (hydrated, no welcome overlay, not read-only, not an embed), and the tab not locked.
- **Never with the welcome tour**: while the welcome tour is on screen, or its offer is still owed (its
  handoff flag is set), the Plan tour waits, and offers itself once the welcome tour has ended if the person is
  still in Plan.
- **Once ever per person**, through the synced `planTourSeen` user preference
  ([User preferences](../007-editor/user-preferences.md)): taken, skipped mid-way or declined, it never offers
  itself again, on any device.
- **Replayable from Settings**: the **Plan Tour** switch in the Accessibility category's **Show Tours** control,
  beside **Welcome Tour** and built the same way (on means "not seen yet"). Turning it on from off and closing Settings runs the tour
  straight away when the person is in Plan, or offers it the next time they enter Plan.
- The offer is the opt-in, as for the welcome tour, and it is also where the person picks the tour track: Plan
  covers both boards and spreadsheets, so the welcome card offers **Boards** and **Spreadsheets** (each starts that
  track), and **No thanks** declines it, all with equal weight. Taking either track marks the tour seen; the other
  track is a Settings rerun away.

## Tour content

The tour shows Plan working on real elements and real items, then takes them away.

- **It never touches the person's own work.** The Boards track places its own example board (a Kanban board, with statuses of
  its own like any board placed from the palette, so no existing card lands on it and no example card lands on
  another board) in the middle of the view, and adds its example cards to that board only.
- **The example cards**: "Plan the launch" (a Task) and "Write the release notes" (a Task) in To Do, and "Agree
  the launch date" (an Action) in Backlog.
- **The example sheet**: the Sheets track places a Sheet titled **Example Sheet** (or the next free title on the
  tab, as any sheet's) in the middle of the view, already set up: Setup Sheet's **Budget** start (Item, Category,
  Amount; four rows; a **Total** row `=SUM(C2:C5)`) in the **Header** look at the **Default** cell size, header row
  frozen. It never shows Setup Sheet. Taking it away deletes its sheet with it, without the **Delete Sheet?**
  question (the sheet is the tour's own).
- **It leaves no history.** Placing, filling, moving and removing tour content is never an undo step, so Undo after the
  tour never brings it back, and Undo during the tour skips over it to the person's own last change.
- **It takes everything away** however the tour ends: on reaching the outro card, on Skip, on leaving the
  document or the editor mid-tour (when that can still run), and on the next visit to the document if a reload or
  a closed window cut it short. Declining at the welcome card creates nothing.
- Collaborators in the room see the tour content come and go, as with any change; it is short-lived, and its
  title says what it is: **Example Board** or **Example Sheet**.
- The example cards take the next card numbers, as any new card does; numbers are not reused.

## The steps

A welcome card, then the picked track's steps, then its outro card. The bookend cards sit outside the step count.
Copy is one or two short sentences per step; the exact strings live in
`apps/live/components/tour/plan-tour-steps.ts`.

0. **Welcome to Plan** (the offer): centred card with its own illustration (a card moving across a small
   board), saying Plan runs work on boards and spreadsheets and asking which to look at, then **No thanks**,
   **Boards** and **Spreadsheets**.

### Boards

Seven steps.

1. **Your board**: places the example board and highlights it. Columns are the stages work moves through;
   the palette's Boards category has a board for sprints, retros, roadmaps and more.
2. **Add cards**: adds the example cards and highlights the To Do column. Each column ends in Add card, or a
   card tile from the palette's Cards category can be dropped where it should go.
3. **Move work along**: moves "Plan the launch" to In Progress and highlights it there. Drag a card to the
   next column as the work moves on, or Shift and an arrow key with it focused.
4. **The card panel**: opens "Plan the launch" in the item panel and highlights it. Everything about a piece
   of work is here, saved as it is typed.
5. **The board header**: highlights the example board's header. Its widgets count and filter the board; more
   come from the palette's Widgets, and a column's cog sets the board up.
6. **Card types**: highlights the Card Types button. Each type has its own colour and fields, changed or made
   there.
7. **The Plan palette**: opens the palette's category picker. Cards, boards, widgets, metrics and
   visualisations come from here; metrics and visualisations read every card on the tab.
8. **You're ready to plan** (outro): the tour content is gone by the time it shows. A help-centre link to the
   Plan mode article (new tab) and **Start planning**, which completes the tour.

### Spreadsheets

Six steps.

1. **Your sheet**: places the example sheet and highlights it. A sheet is a spreadsheet on the canvas; the
   palette's Sheet category places one, set up from a layout, your cards or a blank grid.
2. **Type into cells**: highlights the grid. A click selects a cell and typing fills it; Enter moves down,
   Tab across, and numbers, dates and percentages are read as typed.
3. **Formulas**: selects the Total's amount (`C6`) and highlights the formula bar, which shows its
   `=SUM(C2:C5)`. A cell starting with `=` is a formula; clicking cells while writing one points at them.
4. **The toolbar**: highlights the Sheet's toolbar. Its category switcher picks the tools beside it (Text,
   Cells, Numbers, Data, Charts, Functions), acting on the selected cells.
5. **Sheet Settings**: highlights the Sheet's cog. The title, CSV import and download, gridlines, sizes,
   freeze and named ranges live there.
6. **The Plan palette**: opens the palette's category picker. Sheets come from its Sheet category, beside the
   boards and cards a sheet can read.
7. **You're ready to plan** (outro): the example sheet is gone by the time it shows. A help-centre link to the
   Sheets article (new tab) and **Start planning**, which completes the tour.

### Both tracks

- Back from a step goes to the step before and shows it again as it was (the example cards stay; the moved
  card stays moved). Back never returns to the welcome card, so a track, once picked, is kept to the end.
  Leaving a step closes what it opened (the item panel, the category picker).
- A step whose target never appears is skipped, as in the welcome tour; a step list filtered up front keeps the
  count honest. The steps are the same on a desktop and a phone (the palette step uses the Toolbar strip's
  picker).
- If the tour can no longer run where it started (the person's edit rights go, they leave Plan, or they open
  another tab) it ends as skipped and takes its content away.

## Telemetry ([Telemetry](../017-telemetry/telemetry.md))

The welcome tour's funnel, with its own tokens, so the two tours chart apart:

- **Offer**: `UI` · `Opened` · `PlanTourOffer` when the welcome card shows; `UI` · `Closed` · `PlanTourOffer` on
  No thanks.
- **Start**: `UI` · `Selected` · `PlanTourBoards` | `PlanTourSheets` (the track picked), then `UI` · `Started` ·
  `PlanTour`.
- **Stage views**: `UI` · `View` · `PlanTourStep<Id>` once per step entry (`PlanTourStepBoard`,
  `PlanTourStepAddCards`, `PlanTourStepMoveCard`, `PlanTourStepCardPanel`, `PlanTourStepBoardHeader`,
  `PlanTourStepCardTypes`, `PlanTourStepPalette`; `PlanTourStepSheet`, `PlanTourStepCells`,
  `PlanTourStepFormulas`, `PlanTourStepSheetToolbar`, `PlanTourStepSheetSettings`, `PlanTourStepSheetPalette`;
  `PlanTourStepOutro` for either outro).
- **End**: `UI` · `Ended` · `PlanTourCompleted` | `PlanTourSkipped`.
- **Settings row**: `UI` · `Toggled` · `PlanTourSeenOn` | `PlanTourSeenOff`, describing the preference as the
  welcome tour's row does.
- Tour content is never counted as the person's work: placing the example board, adding, moving and opening the
  example cards, and placing, filling and selecting in the example sheet send no `Element`, `Plan` or `Sheet`
  events.

## Power user mode

[Power user mode](../007-editor/power-user-mode.md) marks the Plan tour seen alongside the welcome tour.
